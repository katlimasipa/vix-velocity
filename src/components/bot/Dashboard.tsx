import { useEngine } from '@/lib/bot/store';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { TickChart } from './TickChart';
import { Stat } from './Stat';
import { ConnectionDot } from './ConnectionDot';
import { SettingsPanel } from './SettingsPanel';
import { Play, Square, Settings2, TrendingUp, TrendingDown, Power, Zap, Activity, Flame, ShieldAlert, Crosshair } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

export function Dashboard({ onDisconnect }: { onDisconnect: () => void }) {
  const { engine, state } = useEngine();
  const lastPriceRef = useRef<number | null>(null);
  const flashRef = useRef<HTMLSpanElement>(null);

  const last = state.ticks.at(-1)?.price;

  useEffect(() => {
    if (!last || !flashRef.current) return;
    const prev = lastPriceRef.current;
    if (prev != null && last !== prev) {
      const cls = last > prev ? 'tick-flash-up' : 'tick-flash-down';
      flashRef.current.classList.remove('tick-flash-up', 'tick-flash-down');
      void flashRef.current.offsetWidth;
      flashRef.current.classList.add(cls);
    }
    lastPriceRef.current = last;
  }, [last]);

  const winRate = state.wins + state.losses > 0
    ? Math.round((state.wins / (state.wins + state.losses)) * 100) : 0;

  const running = state.status === 'running';
  const openTrades = state.trades.filter((t) => t.status === 'open');

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="hairline-b bg-background/50 backdrop-blur-md sticky top-0 z-50">
        <div className="px-6 h-14 flex items-center gap-6">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded bg-primary/20 hairline-primary grid place-items-center">
              <Zap className="size-4 text-primary fill-current" />
            </div>
            <div className="font-display text-lg tracking-tight">VELOX <span className="text-primary/60 font-mono text-xs">CHAOS</span></div>
          </div>
          
          <div className="hidden md:flex items-center gap-4 ml-4">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full surface-2 hairline text-[10px] font-mono">
              <span className="size-1.5 rounded-full bg-primary animate-pulse" />
              VIX75 · 1-TICK LOOP
            </div>
            {state.consecutiveWins >= 2 && (
              <div className="flex items-center gap-1 text-up animate-bounce">
                <Flame className="size-3 fill-current" />
                <span className="text-[10px] font-bold font-mono">{state.consecutiveWins} STREAK</span>
              </div>
            )}
          </div>

          <div className="ml-auto flex items-center gap-4">
            <ConnectionDot status={state.connection} authorized={state.authorized} />
            <Button variant="ghost" size="sm" onClick={() => { engine.disconnect(); onDisconnect(); }}
              className="text-muted-foreground hover:text-foreground gap-1.5">
              <Power className="size-3.5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Stats row */}
      <section className="grid grid-cols-2 md:grid-cols-5 hairline-b bg-surface/50">
        <Stat label="Account Balance" value={`$${state.balance.toFixed(2)}`}
          sub={state.startBalance ? `${state.balance >= state.startBalance ? '+' : ''}${(state.balance - state.startBalance).toFixed(2)} Profit` : '—'}
          accent="gold" />
        <Stat label="Current Stake" value={`$${state.currentStake.toFixed(2)}`}
          sub={state.consecutiveWins >= 3 ? 'STREAK BOOST ACTIVE' : state.consecutiveLosses > 0 ? 'RECOVERY ACTIVE' : 'BASE STAKE'} />
        <Stat label="Session P/L" value={
          <span className={state.pnl >= 0 ? 'text-up' : 'text-down'}>
            {state.pnl >= 0 ? '+' : ''}${state.pnl.toFixed(2)}
          </span>
        } sub={`${state.wins}W · ${state.losses}L`} />
        <Stat label="Win Rate" value={`${winRate}%`}
          sub={`Streak: ${state.consecutiveWins || state.consecutiveLosses || 0}${state.consecutiveWins > 0 ? 'W' : 'L'}`} />
        <Stat label="Latency" value={state.lastLatencyMs ? `${state.lastLatencyMs}ms` : '—'}
          sub="Execution Speed"
          accent={state.lastLatencyMs && state.lastLatencyMs < 250 ? 'up' : 'muted'} />
      </section>

      {/* Main grid */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-px bg-border">
        <div className="surface flex flex-col">
          {/* Controls Bar */}
          <div className="px-6 py-3 hairline-b bg-surface-2/30 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch 
                  id="chaotic-mode" 
                  checked={engine.cfg.chaoticMode} 
                  onCheckedChange={(v) => engine.updateConfig({ chaoticMode: v })}
                />
                <Label htmlFor="chaotic-mode" className="text-[10px] uppercase font-mono tracking-wider cursor-pointer">Chaotic</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch 
                  id="recovery-mode" 
                  checked={engine.cfg.recoveryMode} 
                  onCheckedChange={(v) => engine.updateConfig({ recoveryMode: v })}
                />
                <Label htmlFor="recovery-mode" className="text-[10px] uppercase font-mono tracking-wider cursor-pointer">Recovery</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch 
                  id="burst-mode" 
                  checked={engine.cfg.burstMode} 
                  onCheckedChange={(v) => engine.updateConfig({ burstMode: v })}
                />
                <Label htmlFor="burst-mode" className="text-[10px] uppercase font-mono tracking-wider cursor-pointer text-primary/70">Burst</Label>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!running ? (
                <Button onClick={() => engine.start()}
                  disabled={state.connection !== 'open' || !state.authorized}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-6 h-9 shadow-lg shadow-primary/20">
                  ENGAGE SYSTEM
                </Button>
              ) : (
                <Button onClick={() => engine.stop()} variant="destructive" className="font-bold px-6 h-9 animate-pulse">
                  EMERGENCY STOP
                </Button>
              )}
            </div>
          </div>

          <div className="px-4 py-3">
            <TickChart 
              ticks={state.ticks} 
              lastThreePrices={state.lastThreePrices} 
              signal={state.signal} 
            />
          </div>

          <div className="grid grid-cols-3 hairline-t hairline-b">
            <div className="px-6 py-4 flex flex-col gap-1 border-r">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Flow</span>
              <div className="flex items-center gap-2">
                {state.tickDirection === 'up' ? <TrendingUp className="size-5 text-up" /> : <TrendingDown className="size-5 text-down" />}
                <span className={`text-sm font-bold font-mono uppercase ${state.tickDirection === 'up' ? 'text-up' : 'text-down'}`}>
                  {state.tickDirection}
                </span>
              </div>
            </div>
            <div className="px-6 py-4 flex flex-col gap-1 border-r">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Signal</span>
              <div className="flex items-center gap-2">
                {state.signal ? (
                  <div className={`px-2 py-0.5 rounded font-bold text-[10px] ${state.signal === 'CALL' ? 'bg-success/20 text-up' : 'bg-danger/20 text-down'}`}>
                    {state.signal === 'CALL' ? 'BUY / RISE' : 'SELL / FALL'}
                  </div>
                ) : <span className="text-[10px] font-mono text-muted-foreground">SCANNING...</span>}
              </div>
            </div>
            <div className="px-6 py-4 flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Momentum</span>
              <div className="flex gap-1.5">
                {state.lastThreePrices.map((p, i) => (
                  <div key={i} className="text-[11px] font-mono bg-surface-3 px-2 py-0.5 rounded hairline">
                    {p.toFixed(2)}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Activity Logs */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="px-6 py-3 flex items-center justify-between hairline-b bg-surface-2/10">
              <div className="flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-widest">
                <Activity className="size-3 text-primary" />
                Live Execution Feed
              </div>
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-8"><Settings2 className="size-4 text-muted-foreground" /></Button>
                </SheetTrigger>
                <SheetContent className="surface w-[420px] sm:max-w-[420px] overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle className="font-display text-2xl">Core Logic</SheetTitle>
                  </SheetHeader>
                  <div className="mt-6"><SettingsPanel /></div>
                </SheetContent>
              </Sheet>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-1 font-mono text-[11px]">
              {state.log.slice().reverse().map((l, i) => (
                <div key={i} className="flex gap-3 items-start animate-in slide-in-from-left-2 duration-300">
                  <span className="text-muted-foreground/40 shrink-0">[{new Date(l.ts).toLocaleTimeString()}]</span>
                  <span className={
                    l.kind === 'trade' ? 'text-primary font-bold' :
                    l.kind === 'warn' ? 'text-down' :
                    l.kind === 'error' ? 'text-danger bg-danger/10 px-1 rounded' : 'text-foreground/70'
                  }>{l.msg}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Sidebar: Active Trades & Stats */}
        <aside className="surface flex flex-col hairline-l">
          <div className="p-5 hairline-b bg-surface-2/20">
            <h3 className="text-xs font-mono font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
              <Crosshair className="size-3 text-primary" />
              Active System
            </h3>
            {openTrades.length === 0 ? (
              <div className="py-8 text-center border-2 border-dashed border-border rounded-lg">
                <span className="text-[10px] font-mono text-muted-foreground italic">No Active Contracts</span>
              </div>
            ) : (
              <div className="space-y-3">
                {openTrades.map(t => (
                  <div key={t.contract_id} className="p-3 rounded bg-primary/5 hairline-primary relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                    <div className="flex justify-between items-start mb-2">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${t.type === 'CALL' ? 'bg-success/20 text-up' : 'bg-danger/20 text-down'}`}>
                        {t.type}
                      </span>
                      <span className="text-[10px] font-mono text-primary animate-pulse">LIVE</span>
                    </div>
                    <div className="text-lg font-mono font-bold leading-none mb-1 num">${t.stake.toFixed(2)}</div>
                    <div className="text-[10px] font-mono text-muted-foreground italic">ID: {t.contract_id}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-5 flex-1 overflow-y-auto">
            <h3 className="text-xs font-mono font-bold uppercase tracking-widest mb-4 flex items-center gap-2 text-muted-foreground">
              <ShieldAlert className="size-3" />
              Recent Cycles
            </h3>
            <div className="space-y-2">
              {state.recentTrades.map(t => (
                <div key={t.contract_id} className="flex items-center justify-between text-[11px] font-mono p-2 rounded surface-2/50 hairline">
                  <div className="flex items-center gap-2">
                    <div className={`size-1.5 rounded-full ${t.status === 'won' ? 'bg-success' : 'bg-danger'}`} />
                    <span className="uppercase text-muted-foreground w-8">{t.type}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="num opacity-60">${t.stake.toFixed(2)}</span>
                    <span className={`num font-bold ${t.status === 'won' ? 'text-up' : 'text-down'}`}>
                      {t.status === 'won' ? '+' : ''}{t.profit?.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
