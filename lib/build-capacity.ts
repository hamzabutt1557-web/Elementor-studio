/** Bounded admission per warm server instance. This is not a distributed job queue. */
export class CapacityError extends Error {
  readonly status = 429;
  constructor() { super("All conversion slots are busy. Wait a moment and try again. No build was started."); }
}
type Waiter = { grant: () => void; reject: (e: unknown) => void; cleanup: () => void };
export class BuildCapacity {
  private active = 0;
  private waiting: Waiter[] = [];
  constructor(private limit = 2, private queueLimit = 6, private waitMs = 15000) {}
  get snapshot() { return { active: this.active, waiting: this.waiting.length, limit: this.limit }; }
  async acquire(signal: AbortSignal, queued: () => void = () => {}): Promise<() => void> {
    signal.throwIfAborted();
    if (this.active < this.limit) { this.active++; return this.releaseOnce(); }
    if (this.waiting.length >= this.queueLimit) throw new CapacityError();
    queued();
    return new Promise((resolve, reject) => {
      const remove = (error: unknown) => {
        const index = this.waiting.indexOf(waiter);
        if (index < 0) return;
        this.waiting.splice(index, 1); waiter.cleanup(); reject(error);
      };
      const abort = () => remove(signal.reason);
      const timer = setTimeout(() => remove(new CapacityError()), this.waitMs);
      const waiter: Waiter = {
        grant: () => { waiter.cleanup(); this.active++; resolve(this.releaseOnce()); },
        reject,
        cleanup: () => { clearTimeout(timer); signal.removeEventListener("abort", abort); },
      };
      this.waiting.push(waiter);
      signal.addEventListener("abort", abort, { once: true });
      if (signal.aborted) abort();
    });
  }
  private releaseOnce() {
    let released = false;
    return () => {
      if (released) return;
      released = true; this.active--;
      this.waiting.shift()?.grant();
    };
  }
}
const state = globalThis as typeof globalThis & { studioBuildCapacity?: BuildCapacity };
export const buildCapacity = state.studioBuildCapacity ??= new BuildCapacity();
