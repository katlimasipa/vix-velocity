interface Props {
  status: 'connecting' | 'open' | 'closed' | 'error';
  authorized: boolean;
}

export function ConnectionDot({ status, authorized }: Props) {
  const connMap = {
    open:       { c: 'hsl(var(--success))', t: 'LIVE',       pulse: true  },
    connecting: { c: 'hsl(var(--primary))', t: 'CONNECTING', pulse: false },
    closed:     { c: 'hsl(var(--muted-foreground))', t: 'OFFLINE',     pulse: false },
    error:      { c: 'hsl(var(--danger))',   t: 'ERROR',      pulse: false },
  } as const;

  const s = connMap[status];

  return (
    <span className="inline-flex items-center gap-3 text-[11px] font-mono uppercase tracking-[0.16em] text-muted-foreground">
      {/* Connection status */}
      <span className="inline-flex items-center gap-1.5">
        <span className={`dot ${s.pulse ? 'pulse-dot' : ''}`} style={{ background: s.c }} />
        {s.t}
      </span>

      {/* Auth status — only show once connected */}
      {status === 'open' && (
        <>
          <span className="text-border/60">|</span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="dot"
              style={{ background: authorized ? 'hsl(var(--success))' : 'hsl(var(--danger))' }}
            />
            {authorized ? 'AUTH ✓' : 'UNAUTH'}
          </span>
        </>
      )}
    </span>
  );
}
