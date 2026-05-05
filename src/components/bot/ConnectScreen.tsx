import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useEngine } from '@/lib/bot/store';
import { toast } from 'sonner';
import { Lock, Zap, ArrowRight } from 'lucide-react';

export function ConnectScreen({ onConnected }: { onConnected: () => void }) {
  const { engine } = useEngine();
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);

  async function connect() {
    if (!token.trim()) { toast.error('Enter a Deriv API token'); return; }
    setBusy(true);
    try {
      sessionStorage.setItem('deriv_token', token.trim());
      await engine.connect(token.trim());
      toast.success('Connected to Deriv');
      onConnected();
    } catch (e: any) {
      toast.error(e?.message || 'Connection failed');
    } finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen grid-bg flex items-center justify-center px-6">
      <div className="w-full max-w-[440px] fade-in">
        <div className="mb-10 flex items-center gap-3">
          <div className="size-9 rounded-md surface-2 hairline grid place-items-center">
            <span className="font-display text-primary text-lg leading-none">V</span>
          </div>
          <div>
            <div className="font-display text-xl leading-tight">Velox</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-mono">VIX75 · Auto Execution</div>
          </div>
        </div>

        <h1 className="font-display text-[2.5rem] leading-[1.05] mb-3">
          Disciplined speed,<br />
          <span className="text-primary italic">no martingale.</span>
        </h1>
        <p className="text-sm text-muted-foreground max-w-[36ch] mb-10">
          Connect a Deriv API token to begin. Tokens stay in your browser session — never sent to any server.
        </p>

        <div className="surface hairline rounded-lg p-6 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="token" className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-mono">Deriv API Token</Label>
            <Input
              id="token"
              type="password"
              autoComplete="off"
              placeholder="••••••••••••••••"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && connect()}
              className="font-mono surface-2 border-border h-11"
            />
            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <Lock className="size-3" /> Stored only in this tab. Cleared on close.
            </p>
          </div>

          <Button onClick={connect} disabled={busy} className="w-full h-11 gap-2 group">
            {busy ? 'Connecting…' : (<>Connect <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" /></>)}
          </Button>

          <a
            href="https://app.deriv.com/account/api-token"
            target="_blank" rel="noreferrer"
            className="block text-[11px] text-muted-foreground hover:text-primary transition-colors text-center"
          >
            Need a token? Create one on Deriv →
          </a>
        </div>

        <div className="mt-8 grid grid-cols-3 gap-2 text-[10px] uppercase tracking-[0.16em] font-mono text-muted-foreground">
          <div className="surface hairline rounded px-3 py-2 flex items-center gap-1.5"><Zap className="size-3 text-primary" /> Tick-fast</div>
          <div className="surface hairline rounded px-3 py-2">EMA · RSI</div>
          <div className="surface hairline rounded px-3 py-2">Balance scaling</div>
        </div>
      </div>
    </div>
  );
}
