import { DerivClient } from './deriv';
import { EMA, RSI } from './indicators';

export type Milestone = { balance: number; stake: number };

export type EngineConfig = {
  symbol: string;
  duration: number;          // ticks
  maxConcurrent: number;
  milestones: Milestone[];
  drawdownPct: number;       // % drop that reverts stake tier
  maxTradesPerMin: number;
  maxTradesPerSession: number;
  maxConsecutiveLosses: number;
  dailyLossLimit: number;    // USD
  dailyProfitTarget: number; // USD
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
  duration: number;
  opened_at: number;
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
  ema10: number | null;
  ema20: number | null;
  rsi: number | null;
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
  private ema10 = new EMA(10);
  private ema20 = new EMA(20);
  private rsi = new RSI(7);
  private listeners = new Set<Listener>();
  private minuteWindow: number[] = [];
  private warmupTicks = 0;
  private cooldownUntil = 0;
  private token = '';
  private buying = false; // prevent concurrent buy calls

  constructor(cfg: EngineConfig) {
    this.cfg = cfg;
    this.state = {
      status: 'idle',
      connection: 'closed',
      authorized: false,
      balance: 0,
      startBalance: 0,
      peakBalance: 0,
      currentStake: cfg.milestones[0]?.stake ?? 0.50,
      stakeLevelIdx: 0,
      ticks: [],
      ema10: null, ema20: null, rsi: null,
      trades: [], recentTrades: [],
      wins: 0, losses: 0, pnl: 0,
      consecutiveLosses: 0,
      tradesThisMinute: 0,
      tradesThisSession: 0,
      log: [],
    };

    this.client.onStatus = (s) => {
      this.state.connection = s;
      if (s === 'closed' || s === 'error') this.state.authorized = false;
      this.emit();
    };

    // After auto-reconnect: re-authorize + re-subscribe without restarting the bot
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

  /** Re-authorize + re-subscribe after an automatic WebSocket reconnect. */
  private async reauthorize() {
    if (!this.token) return;
    try {
      this.addLog('Reconnected — re-authorizing…', 'info');
      const res: any = await this.client.authorize(this.token);
      if (!res?.authorize) throw new Error('Auth response missing authorize field');
      this.state.authorized = true;
      this.addLog('Re-authorized ✓', 'info');
      this.emit();
      await this.client.balance();
      await this.client.subscribeTicks(this.cfg.symbol, (price, epoch) => this.onTick(price, epoch));
    } catch (e: any) {
      const msg = e?.message ?? e?.code ?? e?.error ?? String(e);
      this.addLog(`Re-auth failed: ${msg}`, 'error');
    }
  }

  async connect(token: string) {
    this.token = token;
    await this.client.connect();

    // Send authorize and wait — trade execution is blocked until this succeeds
    const authRes: any = await this.client.authorize(token);
    if (!authRes?.authorize) throw new Error('Authorization rejected — check your API token');
    this.state.authorized = true;
    this.addLog('Authorized with Deriv ✓', 'info');
    this.emit();

    // Balance subscription (real-time updates)
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

    // Tick subscription
    await this.client.subscribeTicks(this.cfg.symbol, (price, epoch) => this.onTick(price, epoch));
    this.addLog(`Subscribed to ${this.cfg.symbol} ticks`, 'info');
  }

  start() {
    if (this.state.status === 'running') return;
    this.state.status = 'running';
    this.addLog('Bot started', 'info');
    this.emit();
  }

  stop() {
    this.state.status = 'stopped';
    this.addLog('Bot stopped', 'warn');
    this.emit();
  }

  disconnect() {
    this.token = '';
    this.state.authorized = false;
    this.client.close();
  }

  updateConfig(patch: Partial<EngineConfig>) {
    this.cfg = { ...this.cfg, ...patch };
    this.applyStakeFromBalance();
    this.emit();
  }

  /** Milestone-based stake scaling with 5% balance cap + drawdown revert. */
  private applyStakeFromBalance() {
    const ms = [...this.cfg.milestones].sort((a, b) => a.balance - b.balance);
    let idx = 0;
    for (let i = 0; i < ms.length; i++) {
      if (this.state.balance >= ms[i].balance) idx = i;
    }
    // Revert to lower tier on drawdown
    if (this.state.peakBalance > 0) {
      const dd = (this.state.peakBalance - this.state.balance) / this.state.peakBalance * 100;
      if (dd >= this.cfg.drawdownPct && idx > 0) idx = Math.max(0, idx - 1);
    }
    this.state.stakeLevelIdx = idx;
    const rawStake = ms[idx]?.stake ?? this.state.currentStake;
    // Hard cap: stake must never exceed 5% of balance
    const maxStake = this.state.balance > 0 ? +(this.state.balance * 0.05).toFixed(2) : rawStake;
    this.state.currentStake = Math.min(rawStake, maxStake);
  }

  private onTick(price: number, epoch: number) {
    this.state.ticks.push({ price, epoch });
    if (this.state.ticks.length > 600) this.state.ticks.shift();
    const e10 = this.ema10.push(price);
    const e20 = this.ema20.push(price);
    const r = this.rsi.push(price);
    this.state.ema10 = e10; this.state.ema20 = e20; this.state.rsi = r;
    this.warmupTicks++;
    this.emit();

    if (this.state.status !== 'running') return;
    if (!this.state.authorized) return;  // hard-block — never trade without auth
    if (this.warmupTicks < 25) return;   // warm up indicators first
    if (Date.now() < this.cooldownUntil) return;
    if (this.buying) return;             // prevent overlapping buy requests

    this.evaluateSignal(price);
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

  /** Simplified fast-execution signals — no momentum confirmation required. */
  private evaluateSignal(price: number) {
    const { ema10, ema20, rsi } = this.state;
    if (ema10 == null || ema20 == null || rsi == null) return;

    let signal: 'CALL' | 'PUT' | null = null;
    if (ema10 > ema20 && rsi > 50) signal = 'CALL';
    else if (ema10 < ema20 && rsi < 50) signal = 'PUT';
    if (!signal) return;

    const gate = this.canTrade();
    if (!gate.ok) return;

    this.placeTrade(signal, price);
  }

  private async placeTrade(type: 'CALL' | 'PUT', price: number) {
    // Final auth guard at execution time
    if (!this.state.authorized) {
      this.addLog('Trade skipped — not authorized', 'warn');
      return;
    }

    this.buying = true;
    const stake = Number(this.state.currentStake.toFixed(2));
    this.cooldownUntil = Date.now() + 500; // brief anti-spam while awaiting buy response
    this.minuteWindow.push(Date.now());
    this.state.tradesThisSession++;

    try {
      const res: any = await this.client.buy({
        amount: stake,
        duration: this.cfg.duration,
        duration_unit: 't',
        contract_type: type,
        symbol: this.cfg.symbol,
      });

      const buy = res.buy;
      const trade: Trade = {
        contract_id: buy.contract_id,
        type, stake,
        buy_price: buy.buy_price,
        status: 'open',
        entry: price,
        duration: this.cfg.duration,
        opened_at: Date.now(),
      };
      this.state.trades.unshift(trade);
      this.addLog(`${type === 'CALL' ? 'RISE' : 'FALL'} @ ${price.toFixed(4)} · $${stake}`, 'trade');
      this.emit();

      // Watch contract until it settles
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
            `${t.type === 'CALL' ? 'RISE' : 'FALL'} ${t.status.toUpperCase()} · ${profit >= 0 ? '+' : ''}$${profit.toFixed(2)}`,
            profit >= 0 ? 'trade' : 'warn',
          );
          this.emit();
          // Re-entry: 1-second cooldown then next tick re-evaluates automatically
          this.cooldownUntil = Date.now() + 1000;
        }
      });
    } catch (e: any) {
      // Log exact API error — do NOT stop the bot
      const errMsg = e?.message ?? e?.code ?? e?.error ?? JSON.stringify(e) ?? 'Unknown error';
      this.addLog(`Buy failed: ${errMsg}`, 'error');
      this.cooldownUntil = Date.now() + 2000; // short pause after failed order
    } finally {
      this.buying = false;
    }
  }
}

export const DEFAULT_CONFIG: EngineConfig = {
  symbol: 'R_75',
  duration: 5,
  maxConcurrent: 1,
  milestones: [
    { balance: 0,    stake: 0.50 },
    { balance: 10,   stake: 0.50 },
    { balance: 20,   stake: 1.00 },
    { balance: 40,   stake: 2.00 },
    { balance: 80,   stake: 4.00 },
    { balance: 160,  stake: 8.00 },
    { balance: 320,  stake: 16.00 },
  ],
  drawdownPct: 15,
  maxTradesPerMin: 12,
  maxTradesPerSession: 500,
  maxConsecutiveLosses: 5,
  dailyLossLimit: 20,
  dailyProfitTarget: 50,
};
