import { useEngine } from '@/lib/bot/store';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ShieldAlert, Target, Zap, Hash, ArrowUpCircle } from 'lucide-react';

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

  return (
    <div className="space-y-8">
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Zap className="size-4 text-primary fill-current" />
          <h3 className="font-display text-lg">Execution</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <NumField label="Base Stake ($)" value={cfg.baseStake} step={0.1} min={0.35}
            onChange={(v) => engine.updateConfig({ baseStake: v })} />
          <NumField label="Duration (Ticks)" value={cfg.duration} min={1} max={10}
            onChange={(v) => engine.updateConfig({ duration: v })} />
          <NumField label="Max Trades / Min" value={cfg.maxTradesPerMin}
            onChange={(v) => engine.updateConfig({ maxTradesPerMin: v })} />
          <NumField label="Max Concurrent" value={cfg.maxConcurrent} min={1}
            onChange={(v) => engine.updateConfig({ maxConcurrent: v })} />
        </div>
      </section>

      <section>
        <div className="flex items-center gap-2 mb-4">
          <ShieldAlert className="size-4 text-danger" />
          <h3 className="font-display text-lg">Risk & Recovery</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <NumField label="Martingale" value={cfg.martingaleEnabled ? 1 : 0} step={1} min={0}
            onChange={(v) => engine.updateConfig({ martingaleEnabled: v === 1 })} />
          <NumField label="Martingale Multiplier" value={cfg.martingaleMultiplier} step={0.1} min={1}
            onChange={(v) => engine.updateConfig({ martingaleMultiplier: v })} />
          <NumField label="Recovery Mode (x1.5)" value={cfg.recoveryMode ? 1 : 0} step={1} min={0}
            onChange={(v) => engine.updateConfig({ recoveryMode: v === 1 })} />
          <NumField label="Streak Boost (x1.25)" value={cfg.streakBoost ? 1 : 0} step={1} min={0}
            onChange={(v) => engine.updateConfig({ streakBoost: v === 1 })} />
          <NumField label="Daily Loss Limit ($)" value={cfg.dailyLossLimit} step={1} icon={Target}
            onChange={(v) => engine.updateConfig({ dailyLossLimit: v })} />
          <NumField label="Daily Target ($)" value={cfg.dailyProfitTarget} step={1} icon={Target}
            onChange={(v) => engine.updateConfig({ dailyProfitTarget: v })} />
        </div>
      </section>

      <section className="surface-2 hairline p-4 rounded-lg">
        <div className="flex items-center gap-2 text-primary mb-2">
          <Zap className="size-4" />
          <h4 className="font-display text-sm">Manual Mode Active</h4>
        </div>
        <p className="text-[10px] text-muted-foreground font-mono leading-relaxed">
          The system will use your <strong>Base Stake</strong> for every trade. 
          If Martingale or Recovery are enabled, they will only trigger temporarily after a loss.
        </p>
      </section>
    </div>
  );
}
