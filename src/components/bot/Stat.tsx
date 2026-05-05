import { ReactNode } from 'react';

export function Stat({ label, value, sub, accent }: { label: string; value: ReactNode; sub?: ReactNode; accent?: 'up' | 'down' | 'gold' | 'muted' }) {
  const color =
    accent === 'up' ? 'text-up' :
    accent === 'down' ? 'text-down' :
    accent === 'gold' ? 'text-primary' :
    'text-foreground';
  return (
    <div className="flex flex-col gap-1.5 px-5 py-4">
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-mono">{label}</div>
      <div className={`font-display text-2xl num ${color}`}>{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground font-mono num">{sub}</div>}
    </div>
  );
}
