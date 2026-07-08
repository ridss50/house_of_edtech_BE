const BUCKET_CAPACITY = 50;
const REFILL_PER_SECOND = 20;


export class TokenBucket {
  private tokens = BUCKET_CAPACITY;
  private lastRefill = Date.now();

  tryConsume(): boolean {
    const now = Date.now();
    const elapsedSeconds = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(BUCKET_CAPACITY, this.tokens + elapsedSeconds * REFILL_PER_SECOND);
    this.lastRefill = now;

    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
}
