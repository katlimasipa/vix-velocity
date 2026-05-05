// Streaming indicators for tick data.

export class EMA {
  private k: number;
  private value: number | null = null;
  constructor(public readonly period: number) {
    this.k = 2 / (period + 1);
  }
  push(price: number): number {
    if (this.value === null) this.value = price;
    else this.value = price * this.k + this.value * (1 - this.k);
    return this.value;
  }
  get(): number | null { return this.value; }
}

export class RSI {
  private prev: number | null = null;
  private avgGain = 0;
  private avgLoss = 0;
  private count = 0;
  constructor(public readonly period: number = 7) {}
  push(price: number): number | null {
    if (this.prev === null) { this.prev = price; return null; }
    const change = price - this.prev;
    this.prev = price;
    const gain = Math.max(0, change);
    const loss = Math.max(0, -change);
    this.count++;
    if (this.count <= this.period) {
      this.avgGain += gain / this.period;
      this.avgLoss += loss / this.period;
      if (this.count < this.period) return null;
    } else {
      this.avgGain = (this.avgGain * (this.period - 1) + gain) / this.period;
      this.avgLoss = (this.avgLoss * (this.period - 1) + loss) / this.period;
    }
    if (this.avgLoss === 0) return 100;
    const rs = this.avgGain / this.avgLoss;
    return 100 - 100 / (1 + rs);
  }
}
