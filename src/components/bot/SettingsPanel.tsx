import { useEngine } from '@/lib/bot/store';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { Plus, Trash2, ShieldAlert, Target, Zap } from 'lucide-react';

function NumField({ label, value, onChange, step = 1, min = 0, icon: Icon }: { label: string; value: number; onChange: (v: number) => void; step?: number; min?: number; icon?: any }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        {Icon && <Icon className="size-3 text-muted-foreground" />}
        <Label className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-mono">{label}</Label>
      </div>
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
        <div className="flex items-center gap-2 mb-4">
          <Zap className="size-4 text-primary fill-current" />
          <h3 className="font-display text-lg">Execution</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5 opacity-50">
            <Label className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-mono">Duration (Fixed)</Label>
            <div className="surface-2 border border-border h-9 rounded flex items-center px-3 font-mono text-sm">1-Tick</div>
          </div>
          <NumField label="Max Trades / Min" value={cfg.maxTradesPerMin}
            onChange={(v) => engine.updateConfig({ maxTradesPerMin: v })} />
          <NumField label="Max Session Trades" value={cfg.maxTradesPerSession}
            onChange={(v) => engine.updateConfig({ maxTradesPerSession: v })} />
          <NumField label="Concurrent" value={cfg.maxConcurrent} min={1}
            onChange={(v) => engine.updateConfig({ maxConcurrent: v })} />
        </div>
      </section>

      <section>
        <div className="flex items-center gap-2 mb-4">
          <ShieldAlert className="size-4 text-danger" />
          <h3 className="font-display text-lg">Risk Controls</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <NumField label="Max Lose Streak" value={cfg.maxConsecutiveLosses} icon={ShieldAlert}
            onChange={(v) => engine.updateConfig({ maxConsecutiveLosses: v })} />
          <NumField label="Drawdown Revert %" value={cfg.drawdownPct}
            onChange={(v) => engine.updateConfig({ drawdownPct: v })} />
          <NumField label="Daily Loss Limit ($)" value={cfg.dailyLossLimit} step={1} icon={Target}
            onChange={(v) => engine.updateConfig({ dailyLossLimit: v })} />
          <NumField label="Daily Target ($)" value={cfg.dailyProfitTarget} step={1} icon={Target}
            onChange={(v) => engine.updateConfig({ dailyProfitTarget: v })} />
        </div>
        <p className="mt-3 text-[10px] text-muted-foreground font-mono italic">
          * Stake is hard-capped at 3% of balance for safety.
        </p>
      </section>

      <section>
        <div className="flex items-baseline justify-between mb-4">
          <h3 className="font-display text-lg">Stake Milestones</h3>
          <span className="text-[10px] uppercase tracking-[0.16em] font-mono text-muted-foreground">balance → stake</span>
        </div>
        <div className="space-y-2">
          {milestones.map((m, i) => {
            const active = i === state.stakeLevelIdx;
            return (
              <div key={i} className={`grid grid-cols-[1fr_1fr_auto] gap-2 items-center rounded-md p-2 hairline ${active ? 'surface-2 border-primary/30' : 'surface'}`}>
                <div className="space-y-1">
                  <Label className="text-[9px] text-muted-foreground">Min Balance</Label>
                  <Input type="number" value={m.balance} step={1}
                    onChange={(e) => { const next = [...milestones]; next[i] = { ...m, balance: parseFloat(e.target.value) || 0 }; setMilestones(next); }}
                    onBlur={() => commitMilestones(milestones)}
                    className="h-8 font-mono num surface-2 border-border text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] text-muted-foreground">Stake</Label>
                  <Input type="number" value={m.stake} step={0.1}
                    onChange={(e) => { const next = [...milestones]; next[i] = { ...m, stake: parseFloat(e.target.value) || 0 }; setMilestones(next); }}
                    onBlur={() => commitMilestones(milestones)}
                    className="h-8 font-mono num surface-2 border-border text-xs" />
                </div>
                <Button variant="ghost" size="icon" className="size-8 mt-4 text-muted-foreground hover:text-danger"
                  onClick={() => commitMilestones(milestones.filter((_, j) => j !== i))}>
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            );
          })}
          <Button variant="outline" size="sm" className="w-full gap-1.5 border-dashed mt-2"
            onClick={() => commitMilestones([...milestones, { balance: (milestones.at(-1)?.balance ?? 0) + 100, stake: (milestones.at(-1)?.stake ?? 0.35) * 2 }])}>
            <Plus className="size-3.5" /> Add Milestone
          </Button>
        </div>
      </section>
    </div>
  );
}
