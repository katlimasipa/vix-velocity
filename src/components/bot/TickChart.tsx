import { LineChart, Line, YAxis, ResponsiveContainer, Tooltip, ReferenceLine } from 'recharts';
import { Tick } from '@/lib/bot/engine';
import { useMemo } from 'react';

export function TickChart({ ticks, ema10, ema20 }: { ticks: Tick[]; ema10: number | null; ema20: number | null }) {
  const data = useMemo(() => ticks.map((t, i) => ({ i, price: t.price })), [ticks]);
  const last = ticks[ticks.length - 1]?.price;
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
          <YAxis
            domain={['dataMin', 'dataMax']}
            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))', fontFamily: 'JetBrains Mono' }}
            axisLine={false} tickLine={false} width={56}
          />
          <Tooltip
            contentStyle={{ background: 'hsl(var(--surface-2))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ display: 'none' }}
            formatter={(v: any) => [Number(v).toFixed(4), 'Price']}
          />
          {ema10 != null && <ReferenceLine y={ema10} stroke="hsl(var(--primary))" strokeDasharray="3 3" strokeOpacity={0.5} />}
          {ema20 != null && <ReferenceLine y={ema20} stroke="hsl(var(--accent))" strokeDasharray="3 3" strokeOpacity={0.4} />}
          <Line type="monotone" dataKey="price" stroke="hsl(var(--primary-soft))" strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
      {last && (
        <div className="flex items-center gap-4 px-1 pt-2 text-[11px] font-mono text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="dot" style={{ background: 'hsl(var(--primary))' }} /> EMA10 {ema10?.toFixed(4)}</span>
          <span className="flex items-center gap-1.5"><span className="dot" style={{ background: 'hsl(var(--accent))' }} /> EMA20 {ema20?.toFixed(4)}</span>
          <span className="ml-auto">LAST {last.toFixed(4)}</span>
        </div>
      )}
    </div>
  );
}
