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
          <div className="space-y-1.5 opacity-50">
            <Label className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-mono">Duration (Fixed)</Label>
            <div className="surface-2 border border-border h-9 rounded flex items-center px-3 font-mono text-sm">1-Tick</div>
          </div>
          <NumField label="Max Trades / Min" value={cfg.maxTradesPerMin}
            onChange={(v) => engine.updateConfig({ maxTradesPerMin: v })} />
          <NumField label="Max Concurrent" value={cfg.maxConcurrent} min={1}
            onChange={(v) => engine.updateConfig({ maxConcurrent: v })} />
          <NumField label="Martingale" value={cfg.martingaleEnabled ? 1 : 0} step={1} min={0}
            onChange={(v) => engine.updateConfig({ martingaleEnabled: v === 1 })} />
          <NumField label="Martingale Multiplier" value={cfg.martingaleMultiplier} step={0.1} min={1}
            onChange={(v) => engine.updateConfig({ martingaleMultiplier: v })} />
          <NumField label="Recovery Mode" value={cfg.recoveryMode ? 1 : 0} step={1} min={0}
            onChange={(v) => engine.updateConfig({ recoveryMode: v === 1 })} />
          <NumField label="Burst Mode" value={cfg.burstMode ? 1 : 0} step={1} min={0}
            onChange={(v) => engine.updateConfig({ burstMode: v === 1 })} />
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
          <NumField label="Daily Loss Limit ($)" value={cfg.dailyLossLimit} step={1} icon={Target}
            onChange={(v) => engine.updateConfig({ dailyLossLimit: v })} />
          <NumField label="Daily Target ($)" value={cfg.dailyProfitTarget} step={1} icon={Target}
            onChange={(v) => engine.updateConfig({ dailyProfitTarget: v })} />
          <NumField label="Micro Cooldown" value={cfg.microCooldown} step={100} icon={Hash}
            onChange={(v) => engine.updateConfig({ microCooldown: v })} />
        </div>
        <p className="mt-3 text-[10px] text-danger font-mono italic">
          * WARNING: Safety cap removed. Stake will execute at full tier amounts.
        </p>
      </section>

      <section>
        <div className="flex items-baseline justify-between mb-4">
          <h3 className="font-display text-lg">Profit Stake Tiers</h3>
          <ArrowUpCircle className="size-4 text-primary" />
        </div>
        <div className="space-y-3">
          <div className="surface-2 hairline p-3 rounded flex justify-between items-center">
            <div className="space-y-0.5">
              <div className="text-[10px] text-muted-foreground uppercase font-mono">Tier 1 (Base)</div>
              <div className="text-sm font-mono font-bold">Profit: $0+</div>
            </div>
            <div className="text-lg font-mono font-bold text-primary">$10.00</div>
          </div>
          
          <div className={`surface-2 hairline p-3 rounded flex justify-between items-center ${state.pnl >= 100 ? 'border-primary' : 'opacity-60'}`}>
            <div className="space-y-0.5">
              <div className="text-[10px] text-muted-foreground uppercase font-mono">Tier 2</div>
              <div className="text-sm font-mono font-bold">Profit: $100+</div>
            </div>
            <div className="text-lg font-mono font-bold text-primary">$100.00</div>
          </div>

          <div className={`surface-2 hairline p-3 rounded flex justify-between items-center ${state.pnl >= 1000 ? 'border-primary' : 'opacity-60'}`}>
            <div className="space-y-0.5">
              <div className="text-[10px] text-muted-foreground uppercase font-mono">Tier 3</div>
              <div className="text-sm font-mono font-bold">Profit: $1000+</div>
            </div>
            <div className="text-lg font-mono font-bold text-primary">$1000.00</div>
          </div>
        </div>
      </section>
    </div>
  );
}
