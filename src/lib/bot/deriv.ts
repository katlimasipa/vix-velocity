// Minimal Deriv WebSocket client.

export type DerivMsg = Record<string, any>;

type Pending = { resolve: (v: any) => void; reject: (e: any) => void };

export class DerivClient {
  private ws: WebSocket | null = null;
  private nextReq = 1;
  private pending = new Map<number, Pending>();
  private subs = new Map<string, (msg: DerivMsg) => void>();
  private listeners = new Set<(msg: DerivMsg) => void>();
  private connected = false;
  private authorized = false;
  private reconnectTimer: any = null;
  private intentionallyClosed = false;

  public onStatus: (s: 'connecting' | 'open' | 'closed' | 'error') => void = () => {};
  /** Called after a successful automatic reconnect so the engine can re-authorize. */
  public onReopen: () => void = () => {};

  constructor(private appId: string = '1089') {}

  connect(): Promise<void> {
    this.intentionallyClosed = false;
    return new Promise((resolve, reject) => {
      try {
        this.onStatus('connecting');
        const ws = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${this.appId}`);
        this.ws = ws;
        ws.onopen = () => { this.connected = true; this.onStatus('open'); resolve(); };
        ws.onerror = () => { this.onStatus('error'); reject(new Error('WebSocket error')); };
        ws.onclose = () => {
          this.connected = false;
          this.authorized = false;
          this.onStatus('closed');
          if (!this.intentionallyClosed) {
            // Reconnect after 3 s — then fire onReopen so engine can re-authorize
            this.reconnectTimer = setTimeout(() => {
              this.connect()
                .then(() => this.onReopen())
                .catch(() => {});
            }, 3000);
          }
        };
        ws.onmessage = (ev) => this.handle(JSON.parse(ev.data));
      } catch (e) { reject(e); }
    });
  }

  private handle(msg: DerivMsg) {
    this.listeners.forEach((l) => l(msg));
    if (msg.req_id && this.pending.has(msg.req_id)) {
      const p = this.pending.get(msg.req_id)!;
      this.pending.delete(msg.req_id);
      if (msg.error) p.reject(msg.error);
      else p.resolve(msg);
    }
    if (msg.subscription?.id && this.subs.has(msg.subscription.id)) {
      this.subs.get(msg.subscription.id)!(msg);
    }
    if (msg.msg_type === 'tick' && this.subs.has('ticks:' + msg.tick?.symbol)) {
      this.subs.get('ticks:' + msg.tick.symbol)!(msg);
    }
    if (msg.msg_type === 'proposal_open_contract' && msg.proposal_open_contract?.contract_id) {
      const k = 'poc:' + msg.proposal_open_contract.contract_id;
      if (this.subs.has(k)) this.subs.get(k)!(msg);
    }
  }

  on(listener: (m: DerivMsg) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  send<T = DerivMsg>(payload: DerivMsg): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('Not connected'));
    }
    const req_id = this.nextReq++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(req_id, { resolve, reject });
      this.ws!.send(JSON.stringify({ ...payload, req_id }));
      setTimeout(() => {
        if (this.pending.has(req_id)) {
          this.pending.delete(req_id);
          reject(new Error('Request timeout'));
        }
      }, 15000);
    });
  }

  async authorize(token: string) {
    const res = await this.send<DerivMsg>({ authorize: token });
    if (res.authorize) this.authorized = true;
    return res;
  }

  balance() { return this.send({ balance: 1, subscribe: 1 }); }

  subscribeTicks(symbol: string, cb: (price: number, epoch: number) => void) {
    this.subs.set('ticks:' + symbol, (msg) => {
      if (msg.tick) cb(msg.tick.quote, msg.tick.epoch);
    });
    return this.send({ ticks: symbol, subscribe: 1 });
  }

  forgetAll(type: string) { return this.send({ forget_all: type }); }

  buy(params: { amount: number; duration: number; duration_unit: 't'; contract_type: 'CALL' | 'PUT'; symbol: string }) {
    return this.send({
      buy: 1,
      price: params.amount,
      parameters: {
        amount: params.amount,
        basis: 'stake',
        contract_type: params.contract_type,
        currency: 'USD',
        duration: params.duration,
        duration_unit: params.duration_unit,
        symbol: params.symbol,
      },
    });
  }

  subscribeContract(contract_id: number, cb: (poc: any) => void) {
    this.subs.set('poc:' + contract_id, (msg) => cb(msg.proposal_open_contract));
    return this.send({ proposal_open_contract: 1, contract_id, subscribe: 1 });
  }

  close() {
    this.intentionallyClosed = true;
    this.authorized = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
  }

  isConnected() { return this.connected; }
  isAuthorized() { return this.authorized; }
}
