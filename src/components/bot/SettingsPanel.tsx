import { useEngine } from '@/lib/bot/store';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

function NumField({ label, value, onChange, step = 1, min = 0 }: { label: string; value: number; onChange: (v: number) => void; step?: number; min?: number }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-mono">{label}</Label>
      <Input
        type="number" value={value} step={step} min={min}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="surface-2 border-border h-9 font-mono num"
      />
    </div>
  );
}

export function SettingsPanel() {
  const { engine, state } = useEngine();
  const cfg = engine.cfg;
  const [milestones, setMilestones] = useState(cfg.milestones);

  function commitMilestones(next: typeof milestones) {
    const sorted = [...next].sort((a, b) => a.balance - b.balance);
    setMilestones(sorted);
    engine.updateConfig({ milestones: sorted });
  }

  return (
    <div className="space-y-8">
      <section>
        <h3 className="font-display text-lg mb-4">Execution</h3>
        <div className="grid grid-cols-2 gap-3">
          <NumField label="Duration (ticks)" value={cfg.duration} step={1} min={5}
            onChange={(v) => engine.updateConfig({ duration: Math.max(5, Math.min(10, v)) })} />
          <NumField label="Max concurrent" value={cfg.maxConcurrent} step={1} min={1}
            onChange={(v) => engine.updateConfig({ maxConcurrent: Math.max(1, Math.min(3, v)) })} />
          <NumField label="Trades / minute" value={cfg.maxTradesPerMin}
            onChange={(v) => engine.updateConfig({ maxTradesPerMin: v })} />
          <NumField label="Trades / session" value={cfg.maxTradesPerSession}
            onChange={(v) => engine.updateConfig({ maxTradesPerSession: v })} />
        </div>
      </section>

      <section>
        <h3 className="font-display text-lg mb-4">Risk</h3>
        <div className="grid grid-cols-2 gap-3">
          <NumField label="Drawdown revert %" value={cfg.drawdownPct}
            onChange={(v) => engine.updateConfig({ drawdownPct: v })} />
          <NumField label="Max losing streak" value={cfg.maxConsecutiveLosses}
            onChange={(v) => engine.updateConfig({ maxConsecutiveLosses: v })} />
          <NumField label="Daily loss limit ($)" value={cfg.dailyLossLimit} step={1}
            onChange={(v) => engine.updateConfig({ dailyLossLimit: v })} />
          <NumField label="Daily target ($)" value={cfg.dailyProfitTarget} step={1}
            onChange={(v) => engine.updateConfig({ dailyProfitTarget: v })} />
        </div>
      </section>

      <section>
        <div className="flex items-baseline justify-between mb-4">
          <h3 className="font-display text-lg">Stake milestones</h3>
          <span className="text-[10px] uppercase tracking-[0.16em] font-mono text-muted-foreground">balance → stake</span>
        </div>
        <div className="space-y-2">
          {milestones.map((m, i) => {
            const active = i === state.stakeLevelIdx;
            return (
              <div key={i} className={`grid grid-cols-[1fr_1fr_auto] gap-2 items-center rounded-md p-2 hairline ${active ? 'surface-2' : 'surface'}`}>
                <Input type="number" value={m.balance} step={1}
                  onChange={(e) => { const next = [...milestones]; next[i] = { ...m, balance: parseFloat(e.target.value) || 0 }; setMilestones(next); }}
                  onBlur={() => commitMilestones(milestones)}
                  className="h-9 font-mono num surface-2 border-border" />
                <Input type="number" value={m.stake} step={0.1}
                  onChange={(e) => { const next = [...milestones]; next[i] = { ...m, stake: parseFloat(e.target.value) || 0 }; setMilestones(next); }}
                  onBlur={() => commitMilestones(milestones)}
                  className="h-9 font-mono num surface-2 border-border" />
                <Button variant="ghost" size="icon" className="size-9 text-muted-foreground hover:text-danger"
                  onClick={() => commitMilestones(milestones.filter((_, j) => j !== i))}>
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            );
          })}
          <Button variant="outline" size="sm" className="w-full gap-1.5 border-dashed"
            onClick={() => commitMilestones([...milestones, { balance: (milestones.at(-1)?.balance ?? 0) * 2 || 10, stake: (milestones.at(-1)?.stake ?? 0.5) * 2 }])}>
            <Plus className="size-3.5" /> Add milestone
          </Button>
        </div>
      </section>
    </div>
  );
}
