import { useEngine } from '@/lib/bot/store';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { TickChart } from './TickChart';
import { Stat } from './Stat';
import { ConnectionDot } from './ConnectionDot';
import { SettingsPanel } from './SettingsPanel';
import { Play, Square, Settings2, TrendingUp, TrendingDown, Power } from 'lucide-react';
import { useEffect, useRef } from 'react';

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
      // re-trigger
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
      <header className="hairline-b">
        <div className="px-6 h-14 flex items-center gap-6">
          <div className="flex items-center gap-2.5">
            <div className="size-7 rounded-md surface-2 hairline grid place-items-center">
              <span className="font-display text-primary text-sm leading-none">V</span>
            </div>
            <div className="font-display text-base leading-none">Velox</div>
          </div>
          <div className="hidden md:flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] font-mono text-muted-foreground">
            <span>VIX75</span>
            <span className="text-border">/</span>
            <span>R_75</span>
          </div>
          <div className="flex items-center gap-1.5 ml-1">
            <span ref={flashRef} className="rounded px-2 py-0.5 font-mono text-sm num">
              {last ? last.toFixed(4) : '—'}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-4">
            <ConnectionDot status={state.connection} authorized={state.authorized} />
            <Button variant="ghost" size="sm" onClick={() => { engine.disconnect(); onDisconnect(); }}
              className="text-muted-foreground hover:text-foreground gap-1.5">
              <Power className="size-3.5" /> Disconnect
            </Button>
          </div>
        </div>
      </header>

      {/* Stats row */}
      <section className="grid grid-cols-2 md:grid-cols-5 hairline-b">
        <div className="hairline-r border-r border-border md:border-r">
          <Stat label="Balance" value={`$${state.balance.toFixed(2)}`}
            sub={state.startBalance ? `${state.balance >= state.startBalance ? '+' : ''}${(state.balance - state.startBalance).toFixed(2)} session` : '—'}
            accent="gold" />
        </div>
        <div className="border-r border-border">
          <Stat label="Stake" value={`$${state.currentStake.toFixed(2)}`}
            sub={`Tier ${state.stakeLevelIdx + 1} of ${engine.cfg.milestones.length}`} />
        </div>
        <div className="border-r border-border">
          <Stat label="Session P/L" value={
            <span className={state.pnl >= 0 ? 'text-up' : 'text-down'}>
              {state.pnl >= 0 ? '+' : ''}${state.pnl.toFixed(2)}
            </span>
          } sub={`${state.wins}W · ${state.losses}L`} />
        </div>
        <div className="border-r border-border">
          <Stat label="Win rate" value={`${winRate}%`}
            sub={`${state.wins + state.losses} closed`} />
        </div>
        <div>
          <Stat label="Open" value={openTrades.length}
            sub={`${state.tradesThisSession} session · ${state.consecutiveLosses} streak`}
            accent={openTrades.length > 0 ? 'gold' : 'muted'} />
        </div>
      </section>

      {/* Main grid */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-px bg-border">
        {/* Chart + signals */}
        <div className="surface flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 hairline-b">
            <div>
              <div className="font-display text-lg">Live ticks</div>
              <div className="text-[11px] text-muted-foreground font-mono">
                EMA10 · EMA20 · RSI(7)
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!running ? (
                <Button onClick={() => engine.start()}
                  disabled={state.connection !== 'open' || !state.authorized}
                  title={!state.authorized ? 'Not authorized — reconnect with a valid token' : undefined}
                  className="gap-1.5 h-9">
                  <Play className="size-3.5 fill-current" /> Start bot
                </Button>
              ) : (
                <Button onClick={() => engine.stop()} variant="outline" className="gap-1.5 h-9 border-danger/40 text-danger hover:text-danger hover:bg-danger/5">
                  <Square className="size-3.5 fill-current" /> Stop
                </Button>
              )}
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon" className="size-9"><Settings2 className="size-4" /></Button>
                </SheetTrigger>
                <SheetContent className="surface w-[420px] sm:max-w-[420px] overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle className="font-display text-2xl">Configuration</SheetTitle>
                  </SheetHeader>
                  <div className="mt-6"><SettingsPanel /></div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
          <div className="px-4 py-3">
            <TickChart ticks={state.ticks} ema10={state.ema10} ema20={state.ema20} />
          </div>
          {/* Indicators */}
          <div className="grid grid-cols-3 hairline-t">
            <Stat label="EMA 10" value={state.ema10 ? state.ema10.toFixed(4) : '—'} />
            <div className="border-l border-border"><Stat label="EMA 20" value={state.ema20 ? state.ema20.toFixed(4) : '—'} /></div>
            <div className="border-l border-border">
              <Stat label="RSI 7" value={state.rsi != null ? state.rsi.toFixed(1) : '—'}
                accent={state.rsi == null ? 'muted' : state.rsi > 55 ? 'up' : state.rsi < 45 ? 'down' : 'muted'} />
            </div>
          </div>

          {/* Open trades */}
          <div className="px-6 py-4 hairline-t">
            <div className="flex items-baseline justify-between mb-3">
              <div className="font-display text-base">Open positions</div>
              <div className="text-[10px] uppercase tracking-[0.16em] font-mono text-muted-foreground">{openTrades.length} active</div>
            </div>
            {openTrades.length === 0 ? (
              <div className="text-sm text-muted-foreground font-mono py-6 text-center surface-2 hairline rounded">
                No open positions. Waiting for signal.
              </div>
            ) : (
              <div className="space-y-2">
                {openTrades.map((t) => (
                  <div key={t.contract_id} className="surface-2 hairline rounded px-3 py-2.5 flex items-center gap-3 fade-in">
                    <span className={`size-7 rounded grid place-items-center ${t.type === 'CALL' ? 'bg-success/15 text-up' : 'bg-danger/15 text-down'}`}>
                      {t.type === 'CALL' ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
                    </span>
                    <div className="flex-1">
                      <div className="text-sm font-mono">{t.type === 'CALL' ? 'RISE' : 'FALL'} · {t.duration}t</div>
                      <div className="text-[11px] text-muted-foreground font-mono num">@ {t.entry.toFixed(4)} · ${t.stake.toFixed(2)}</div>
                    </div>
                    <span className="text-[10px] uppercase tracking-[0.18em] font-mono text-primary">live</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column: history + log */}
        <aside className="surface flex flex-col">
          <div className="px-5 py-4 hairline-b">
            <div className="font-display text-base mb-3">Recent trades</div>
            <div className="space-y-1.5 max-h-[360px] overflow-y-auto -mx-1 px-1">
              {state.recentTrades.length === 0 && (
                <div className="text-sm text-muted-foreground font-mono py-3">—</div>
              )}
              {state.recentTrades.map((t) => (
                <div key={t.contract_id} className="flex items-center gap-2 text-[12px] font-mono py-1.5 border-b border-border/50 last:border-0">
                  <span className={`dot`} style={{ background: t.status === 'won' ? 'hsl(var(--success))' : 'hsl(var(--danger))' }} />
                  <span className="w-10 text-muted-foreground">{t.type === 'CALL' ? 'RISE' : 'FALL'}</span>
                  <span className="num text-muted-foreground">${t.stake.toFixed(2)}</span>
                  <span className={`ml-auto num ${t.status === 'won' ? 'text-up' : 'text-down'}`}>
                    {(t.profit ?? 0) >= 0 ? '+' : ''}{(t.profit ?? 0).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="px-5 py-4 flex-1 flex flex-col">
            <div className="font-display text-base mb-3">Activity</div>
            <div className="space-y-1 overflow-y-auto flex-1 max-h-[280px]">
              {state.log.slice().reverse().map((l, i) => (
                <div key={i} className="text-[11px] font-mono flex gap-2">
                  <span className="text-muted-foreground/60 w-14 shrink-0">{new Date(l.ts).toLocaleTimeString().slice(0, 8)}</span>
                  <span className={
                    l.kind === 'trade' ? 'text-primary-soft' :
                    l.kind === 'warn' ? 'text-down' :
                    l.kind === 'error' ? 'text-danger' : 'text-foreground/80'
                  }>{l.msg}</span>
                </div>
              ))}
              {state.log.length === 0 && <div className="text-[11px] font-mono text-muted-foreground">No activity yet.</div>}
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
