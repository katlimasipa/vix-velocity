export function ConnectionDot({ status }: { status: 'connecting' | 'open' | 'closed' | 'error' }) {
  const map = {
    open:       { c: 'hsl(var(--success))', t: 'LIVE', pulse: true },
    connecting: { c: 'hsl(var(--primary))', t: 'CONNECTING', pulse: false },
    closed:     { c: 'hsl(var(--muted-foreground))', t: 'OFFLINE', pulse: false },
    error:      { c: 'hsl(var(--danger))', t: 'ERROR', pulse: false },
  } as const;
  const s = map[status];
  return (
    <span className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.16em] text-muted-foreground">
      <span className={`dot ${s.pulse ? 'pulse-dot' : ''}`} style={{ background: s.c }} />
      {s.t}
    </span>
  );
}
