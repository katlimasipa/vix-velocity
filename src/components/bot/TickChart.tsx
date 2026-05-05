import { AreaChart, Area, YAxis, ResponsiveContainer, Tooltip, ReferenceLine } from 'recharts';
import { Tick } from '@/lib/bot/engine';
import { useMemo } from 'react';

interface Props {
  ticks: Tick[];
  lastThreePrices: number[];
  signal: 'CALL' | 'PUT' | null;
}

export function TickChart({ ticks, lastThreePrices, signal }: Props) {
  const data = useMemo(() => ticks.map((t, i) => ({ i, price: t.price })), [ticks]);
  const last = ticks[ticks.length - 1]?.price;

  // Color the area based on current signal
  const areaColor = signal === 'CALL'
    ? 'hsl(var(--success))'
    : signal === 'PUT'
      ? 'hsl(var(--danger))'
      : 'hsl(var(--primary-soft))';

  return (
    <div className="h-[240px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="tickGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={areaColor} stopOpacity={0.18} />
              <stop offset="95%" stopColor={areaColor} stopOpacity={0} />
            </linearGradient>
          </defs>
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
          {/* Mark the 3 momentum ticks as reference lines */}
          {lastThreePrices.map((p, i) => (
            <ReferenceLine key={i} y={p} stroke={areaColor} strokeOpacity={0.25 + i * 0.15} strokeDasharray="2 4" />
          ))}
          <Area
            type="monotone" dataKey="price"
            stroke={areaColor} strokeWidth={1.5}
            fill="url(#tickGrad)" dot={false} isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
      {last && (
        <div className="flex items-center gap-4 px-1 pt-1 text-[11px] font-mono text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="dot" style={{ background: areaColor }} />
            {signal ? (signal === 'CALL' ? '▲ MOMENTUM UP' : '▼ MOMENTUM DOWN') : '— NO SIGNAL'}
          </span>
          <span className="ml-auto num">LAST {last.toFixed(4)}</span>
        </div>
      )}
    </div>
  );
}
