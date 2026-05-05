import { useEffect, useState } from 'react';
import { BotEngine, DEFAULT_CONFIG, EngineState } from './engine';

let _engine: BotEngine | null = null;
export function getEngine() {
  if (!_engine) _engine = new BotEngine(DEFAULT_CONFIG);
  return _engine;
}

export function useEngine() {
  const engine = getEngine();
  const [state, setState] = useState<EngineState>(engine.state);
  useEffect(() => engine.subscribe(setState), [engine]);
  return { engine, state };
}
