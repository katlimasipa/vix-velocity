import { DerivClient } from './deriv';

export type Milestone = { balance: number; stake: number };

export type EngineConfig = {
  symbol: string;
  maxConcurrent: number;
  milestones: Milestone[];
  drawdownPct: number;
  maxTradesPerMin: number;
  maxTradesPerSession: number;
  maxConsecutiveLosses: number;
  dailyLossLimit: number;
  dailyProfitTarget: number;
};

export type Tick = { price: number; epoch: number };

export type Trade = {
  contract_id: number;
  type: 'CALL' | 'PUT';
  stake: number;
  buy_price: number;
  status: 'open' | 'won' | 'lost';
  profit?: number;
  entry: number;
  opened_at: number;
  latencyMs?: number;
};

export type EngineState = {
  status: 'idle' | 'running' | 'stopped';
  connection: 'connecting' | 'open' | 'closed' | 'error';
  authorized: boolean;
  balance: number;
  startBalance: number;
  peakBalance: number;
  currentStake: number;
  stakeLevelIdx: number;
  ticks: Tick[];
  lastThreePrices: number[];
  tickDirection: 'up' | 'down' | 'flat';
  signal: 'CALL' | 'PUT' | null;
  lastLatencyMs: number | null;
  trades: Trade[];
  recentTrades: Trade[];
  wins: number;
  losses: number;
  pnl: number;
  consecutiveLosses: number;
  tradesThisMinute: number;
  tradesThisSession: number;
  log: { ts: number; msg: string; kind: 'info' | 'trade' | 'warn' | 'error' }[];
};

type Listener = (s: EngineState) => void;

export class BotEngine {
  client = new DerivClient();
  cfg: EngineConfig;
  state: EngineState;
  private listeners = new Set<Listener>();
  private minuteWindow: number[] = [];
  private token = '';
  private buying = false;

  constructor(cfg: EngineConfig) {
    this.cfg = cfg;
    this.state = {
      status: 'idle', connection: 'closed', authorized: false,
      balance: 0, startBalance: 0, peakBalance: 0,
      currentStake: cfg.milestones[0]?.stake ?? 0.35,
      stakeLevelIdx: 0, ticks: [],
      lastThreePrices: [], tickDirection: 'flat', signal: null,
      lastLatencyMs: null, trades: [], recentTrades: [],
      wins: 0, losses: 0, pnl: 0, consecutiveLosses: 0,
      tradesThisMinute: 0, tradesThisSession: 0, log: [],
    };
    this.client.onStatus = (s) => {
      this.state.connection = s;
      if (s === 'closed' || s === 'error') this.state.authorized = false;
      this.emit();
    };
    this.client.onReopen = () => this.reauthorize();
  }

  subscribe(l: Listener) { this.listeners.add(l); l(this.state); return () => this.listeners.delete(l); }

  private emit() {
    const snap = { ...this.state, ticks: this.state.ticks.slice(-180), log: this.state.log.slice(-100) };
    this.listeners.forEach((l) => l(snap));
  }

  private addLog(msg: string, kind: EngineState['log'][number]['kind'] = 'info') {
    this.state.log.push({ ts: Date.now(), msg, kind });
    if (this.state.log.length > 200) this.state.log.shift();
    this.emit();
  }

  private async reauthorize() {
    if (!this.token) return;
    try {
      this.addLog('Reconnected — re-authorizing…', 'info');
      const res: any = await this.client.authorize(this.token);
      if (!res?.authorize) throw new Error('Auth response missing');
      this.state.authorized = true;
      this.addLog('Re-authorized ✓', 'info');
      this.emit();
      await this.client.balance();
      await this.client.subscribeTicks(this.cfg.symbol, (p, e) => this.onTick(p, e));
    } catch (e: any) {
      this.addLog(`Re-auth failed: ${e?.message ?? e?.code ?? String(e)}`, 'error');
    }
  }

  async connect(token: string) {
    this.token = token;
    await this.client.connect();
    const authRes: any = await this.client.authorize(token);
    if (!authRes?.authorize) throw new Error('Authorization rejected — check your API token');
    this.state.authorized = true;
    this.addLog('Authorized ✓', 'info');
    this.emit();
    this.client.on((m) => {
      if (m.msg_type === 'balance' && m.balance) {
        this.state.balance = m.balance.balance;
        if (!this.state.startBalance) this.state.startBalance = m.balance.balance;
        if (m.balance.balance > this.state.peakBalance) this.state.peakBalance = m.balance.balance;
        this.applyStakeFromBalance();
        this.emit();
      }
    });
    await this.client.balance();
    await this.client.subscribeTicks(this.cfg.symbol, (p, e) => this.onTick(p, e));
    this.addLog(`Subscribed to ${this.cfg.symbol} · 1-tick mode`, 'info');
  }

  start() {
    if (this.state.status === 'running') return;
    this.state.status = 'running';
    this.addLog('Bot started — 1-tick momentum', 'info');
    this.emit();
  }

  stop() { this.state.status = 'stopped'; this.addLog('Bot stopped', 'warn'); this.emit(); }
  disconnect() { this.token = ''; this.state.authorized = false; this.client.close(); }
  updateConfig(patch: Partial<EngineConfig>) { this.cfg = { ...this.cfg, ...patch }; this.applyStakeFromBalance(); this.emit(); }

  private applyStakeFromBalance() {
    const ms = [...this.cfg.milestones].sort((a, b) => a.balance - b.balance);
    let idx = 0;
    for (let i = 0; i < ms.length; i++) { if (this.state.balance >= ms[i].balance) idx = i; }
    if (this.state.peakBalance > 0) {
      const dd = (this.state.peakBalance - this.state.balance) / this.state.peakBalance * 100;
      if (dd >= this.cfg.drawdownPct && idx > 0) idx = Math.max(0, idx - 1);
    }
    this.state.stakeLevelIdx = idx;
    const rawStake = ms[idx]?.stake ?? this.state.currentStake;
    // Hard cap: stake ≤ 3% of balance
    const maxStake = this.state.balance > 0 ? +(this.state.balance * 0.03).toFixed(2) : rawStake;
    this.state.currentStake = Math.min(rawStake, maxStake);
  }

  private onTick(price: number, epoch: number) {
    this.state.ticks.push({ price, epoch });
    if (this.state.ticks.length > 600) this.state.ticks.shift();

    const last = this.state.ticks.slice(-3);
    this.state.lastThreePrices = last.map((t) => t.price);

    // Tick direction (latest vs previous)
    if (last.length >= 2) {
      const d = last[last.length - 1].price - last[last.length - 2].price;
      this.state.tickDirection = d > 0 ? 'up' : d < 0 ? 'down' : 'flat';
    }

    // 3-tick momentum signal — no indicators needed
    let signal: 'CALL' | 'PUT' | null = null;
    if (last.length === 3) {
      const [p1, p2, p3] = last.map((t) => t.price);
      if (p1 < p2 && p2 < p3) signal = 'CALL';
      else if (p1 > p2 && p2 > p3) signal = 'PUT';
    }
    this.state.signal = signal;
    this.emit();

    if (this.state.status !== 'running') return;
    if (!this.state.authorized) return;
    if (this.buying) return;
    if (!signal) return;

    const gate = this.canTrade();
    if (gate.ok) this.placeTrade(signal, price);
  }

  private canTrade(): { ok: boolean; reason?: string } {
    const now = Date.now();
    this.minuteWindow = this.minuteWindow.filter((t) => now - t < 60_000);
    if (this.minuteWindow.length >= this.cfg.maxTradesPerMin) return { ok: false, reason: 'rate-limit' };
    if (this.state.tradesThisSession >= this.cfg.maxTradesPerSession) return { ok: false, reason: 'session-limit' };
    if (this.state.consecutiveLosses >= this.cfg.maxConsecutiveLosses) return { ok: false, reason: 'losing-streak' };
    if (this.state.trades.filter((t) => t.status === 'open').length >= this.cfg.maxConcurrent) return { ok: false, reason: 'concurrent' };
    if (this.state.pnl <= -Math.abs(this.cfg.dailyLossLimit)) return { ok: false, reason: 'daily-loss' };
    if (this.state.pnl >= Math.abs(this.cfg.dailyProfitTarget)) return { ok: false, reason: 'daily-target' };
    return { ok: true };
  }

  private async placeTrade(type: 'CALL' | 'PUT', price: number) {
    if (!this.state.authorized) { this.addLog('Skipped — not authorized', 'warn'); return; }
    this.buying = true;
    const stake = Number(this.state.currentStake.toFixed(2));
    const buyAt = Date.now();
    this.minuteWindow.push(buyAt);
    this.state.tradesThisSession++;
    try {
      const res: any = await this.client.buy({
        amount: stake, duration: 1, duration_unit: 't',
        contract_type: type, symbol: this.cfg.symbol,
      });
      const latencyMs = Date.now() - buyAt;
      this.state.lastLatencyMs = latencyMs;
      const buy = res.buy;
      const trade: Trade = {
        contract_id: buy.contract_id, type, stake,
        buy_price: buy.buy_price, status: 'open',
        entry: price, opened_at: buyAt, latencyMs,
      };
      this.state.trades.unshift(trade);
      this.addLog(`${type === 'CALL' ? '▲ RISE' : '▼ FALL'} @ ${price.toFixed(4)} · $${stake} · ${latencyMs}ms`, 'trade');
      this.emit();

      this.client.subscribeContract(buy.contract_id, (poc) => {
        if (!poc) return;
        const t = this.state.trades.find((x) => x.contract_id === buy.contract_id);
        if (!t) return;
        if (poc.is_sold) {
          const profit = Number(poc.profit);
          t.profit = profit;
          t.status = profit >= 0 ? 'won' : 'lost';
          this.state.pnl += profit;
          if (profit >= 0) { this.state.wins++; this.state.consecutiveLosses = 0; }
          else { this.state.losses++; this.state.consecutiveLosses++; }
          this.state.recentTrades = [t, ...this.state.recentTrades].slice(0, 50);
          this.state.trades = this.state.trades.filter((x) => x.contract_id !== buy.contract_id);
          this.addLog(
            `${t.type === 'CALL' ? '▲' : '▼'} ${t.status.toUpperCase()} · ${profit >= 0 ? '+' : ''}$${profit.toFixed(2)}`,
            profit >= 0 ? 'trade' : 'warn',
          );
          this.emit();
          // No cooldown — immediate re-entry on next tick
        }
      });
    } catch (e: any) {
      const errMsg = e?.message ?? e?.code ?? e?.error ?? JSON.stringify(e) ?? 'Unknown';
      this.addLog(`Buy failed: ${errMsg}`, 'error');
    } finally {
      this.buying = false;
    }
  }
}

export const DEFAULT_CONFIG: EngineConfig = {
  symbol: 'R_75',
  maxConcurrent: 1,
  milestones: [
    { balance: 0,    stake: 0.35 },
    { balance: 20,   stake: 0.50 },
    { balance: 50,   stake: 1.00 },
    { balance: 100,  stake: 2.00 },
    { balance: 200,  stake: 4.00 },
    { balance: 400,  stake: 8.00 },
  ],
  drawdownPct: 10,
  maxTradesPerMin: 30,
  maxTradesPerSession: 1000,
  maxConsecutiveLosses: 8,
  dailyLossLimit: 20,
  dailyProfitTarget: 50,
};
