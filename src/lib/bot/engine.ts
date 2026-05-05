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
  // Chaotic Features
  chaoticMode: boolean;
  recoveryMode: boolean; // Stake x1.5 after loss
  burstMode: boolean;    // Rapid entries
  streakBoost: boolean;  // Increase stake after 3 wins
  maxStakePct: number;   // e.g. 5 for 5%
  microCooldown: number; // ms
};

export type Tick = { price: number; epoch: number };

export type Trade = {
  contract_id: number;
  type: string;
  stake: number;
  buy_price: number;
  status: 'open' | 'won' | 'lost';
  profit?: number;
  entry: number;
  opened_at: number;
  latencyMs?: number;
  barrier?: string;
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
  tickCount: number;
  lastDigit: number | null;
  signal: 'DIFFERS' | null;
  lastLatencyMs: number | null;
  trades: Trade[];
  recentTrades: Trade[];
  wins: number;
  losses: number;
  pnl: number;
  consecutiveLosses: number;
  consecutiveWins: number;
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
  private lastTradeResult: 'won' | 'lost' | null = null;

  constructor(cfg: EngineConfig) {
    this.cfg = cfg;
    this.state = {
      status: 'idle', connection: 'closed', authorized: false,
      balance: 0, startBalance: 0, peakBalance: 0,
      currentStake: cfg.milestones[0]?.stake ?? 0.35,
      stakeLevelIdx: 0, ticks: [],
      lastThreePrices: [], tickCount: 0, lastDigit: null, signal: null,
      lastLatencyMs: null, trades: [], recentTrades: [],
      wins: 0, losses: 0, pnl: 0, 
      consecutiveLosses: 0, consecutiveWins: 0,
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
      this.addLog('System Rebooting...', 'info');
      const res: any = await this.client.authorize(this.token);
      if (res?.authorize) {
        this.state.authorized = true;
        this.emit();
        await this.client.balance();
        await this.client.subscribeTicks(this.cfg.symbol, (p, e) => this.onTick(p, e));
      }
    } catch (e) { this.addLog('Re-auth failed', 'error'); }
  }

  async connect(token: string) {
    this.token = token;
    await this.client.connect();
    const authRes: any = await this.client.authorize(token);
    if (!authRes?.authorize) throw new Error('Auth Failed');
    this.state.authorized = true;
    this.addLog('System Online. Digit Dynamics Active.', 'info');
    this.client.on((m) => {
      if (m.msg_type === 'balance' && m.balance) {
        this.state.balance = m.balance.balance;
        if (!this.state.startBalance) this.state.startBalance = m.balance.balance;
        if (m.balance.balance > this.state.peakBalance) this.state.peakBalance = m.balance.balance;
        this.emit();
      }
    });
    await this.client.balance();
    await this.client.subscribeTicks(this.cfg.symbol, (p, e) => this.onTick(p, e));
  }

  start() { this.state.status = 'running'; this.addLog('Bot started — Last Digit Differs', 'info'); this.emit(); }
  stop() { this.state.status = 'stopped'; this.addLog('Bot stopped', 'warn'); this.emit(); }
  disconnect() { this.token = ''; this.state.authorized = false; this.client.close(); }
  updateConfig(patch: Partial<EngineConfig>) { this.cfg = { ...this.cfg, ...patch }; this.emit(); }

  private calculateStake(): number {
    const ms = [...this.cfg.milestones].sort((a, b) => a.balance - b.balance);
    let baseIdx = 0;
    for (let i = 0; i < ms.length; i++) { if (this.state.balance >= ms[i].balance) baseIdx = i; }
    let stake = ms[baseIdx]?.stake ?? 0.35;
    if (this.cfg.recoveryMode && this.lastTradeResult === 'lost') stake *= 1.5;
    if (this.cfg.streakBoost && this.state.consecutiveWins >= 3) stake *= 1.25;
    const maxStake = this.state.balance * (this.cfg.maxStakePct / 100);
    return Math.min(stake, maxStake);
  }

  private onTick(price: number, epoch: number) {
    this.state.ticks.push({ price, epoch });
    if (this.state.ticks.length > 600) this.state.ticks.shift();

    const priceStr = price.toFixed(2);
    const lastDigit = parseInt(priceStr[priceStr.length - 1]);
    this.state.lastDigit = lastDigit;
    this.state.tickCount++;
    
    const last = this.state.ticks.slice(-3);
    this.state.lastThreePrices = last.map((t) => t.price);

    // Strategy: Trade every 3 ticks
    const isTradeTick = this.state.tickCount % 3 === 0;
    this.state.signal = isTradeTick ? 'DIFFERS' : null;
    this.emit();

    if (this.state.status !== 'running' || !this.state.authorized || this.buying) return;
    
    if (isTradeTick) {
      const gate = this.canTrade();
      if (gate.ok) this.placeTrade(lastDigit);
    }
  }

  private canTrade(): { ok: boolean; reason?: string } {
    const now = Date.now();
    this.minuteWindow = this.minuteWindow.filter((t) => now - t < 60_000);
    if (this.minuteWindow.length >= this.cfg.maxTradesPerMin) return { ok: false, reason: 'limit' };
    if (this.state.consecutiveLosses >= this.cfg.maxConsecutiveLosses) return { ok: false, reason: 'streak' };
    if (this.state.pnl <= -Math.abs(this.cfg.dailyLossLimit)) return { ok: false, reason: 'loss' };
    if (this.state.pnl >= this.cfg.dailyProfitTarget) return { ok: false, reason: 'target' };
    if (this.state.trades.some(t => t.status === 'open') && !this.cfg.burstMode) return { ok: false, reason: 'open' };
    return { ok: true };
  }

  private async placeTrade(digit: number, retries = 2) {
    this.buying = true;
    const stake = Number(this.calculateStake().toFixed(2));
    const buyAt = Date.now();
    this.minuteWindow.push(buyAt);
    this.state.tradesThisSession++;

    try {
      const res: any = await this.client.buy({
        amount: stake, duration: 1, duration_unit: 't',
        contract_type: 'DIGITDIFF', symbol: this.cfg.symbol,
        barrier: digit.toString()
      });
      const latencyMs = Date.now() - buyAt;
      this.state.lastLatencyMs = latencyMs;
      
      const trade: Trade = {
        contract_id: res.buy.contract_id, type: 'DIFFERS', stake,
        buy_price: res.buy.buy_price, status: 'open',
        entry: digit, opened_at: buyAt, latencyMs, barrier: digit.toString()
      };
      this.state.trades.unshift(trade);
      this.addLog(`Entry: DIFFERS ${digit} ($${stake})`, 'trade');
      this.emit();

      this.client.subscribeContract(res.buy.contract_id, (poc) => {
        if (poc.is_sold) {
          const profit = Number(poc.profit);
          const t = this.state.trades.find(x => x.contract_id === res.buy.contract_id);
          if (t) {
            t.profit = profit;
            t.status = profit >= 0 ? 'won' : 'lost';
            this.state.pnl += profit;
            if (profit >= 0) {
              this.state.wins++;
              this.state.consecutiveWins++;
              this.state.consecutiveLosses = 0;
              this.lastTradeResult = 'won';
            } else {
              this.state.losses++;
              this.state.consecutiveLosses++;
              this.state.consecutiveWins = 0;
              this.lastTradeResult = 'lost';
            }
            this.state.recentTrades = [t, ...this.state.recentTrades].slice(0, 50);
            this.state.trades = this.state.trades.filter(x => x.contract_id !== res.buy.contract_id);
            this.addLog(`${t.status.toUpperCase()}: ${profit >= 0 ? '+' : ''}${profit.toFixed(2)}`, profit >= 0 ? 'trade' : 'warn');
            this.emit();
          }
        }
      });
    } catch (e: any) {
      this.addLog(`Error: ${e?.message || 'Buy Failed'}`, 'error');
      if (retries > 0) {
        await new Promise(r => setTimeout(r, 200));
        await this.placeTrade(digit, retries - 1);
      }
    } finally {
      setTimeout(() => { this.buying = false; }, this.cfg.microCooldown);
    }
  }
}

export const DEFAULT_CONFIG: EngineConfig = {
  symbol: 'R_75',
  maxConcurrent: 1,
  milestones: [
    { balance: 0,    stake: 0.35 },
    { balance: 20,   stake: 0.50 },
    { balance: 40,   stake: 1.00 },
    { balance: 80,   stake: 2.00 },
    { balance: 160,  stake: 4.00 },
  ],
  drawdownPct: 15,
  maxTradesPerMin: 60,
  maxTradesPerSession: 5000,
  maxConsecutiveLosses: 10,
  dailyLossLimit: 50,
  dailyProfitTarget: 100,
  chaoticMode: true,
  recoveryMode: true,
  burstMode: false,
  streakBoost: true,
  maxStakePct: 10,
  microCooldown: 300,
};
