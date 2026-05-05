import { useState } from 'react';
import { ConnectScreen } from '@/components/bot/ConnectScreen';
import { Dashboard } from '@/components/bot/Dashboard';

export default function Index() {
  const [connected, setConnected] = useState(false);
  return connected
    ? <Dashboard onDisconnect={() => setConnected(false)} />
    : <ConnectScreen onConnected={() => setConnected(true)} />;
}
