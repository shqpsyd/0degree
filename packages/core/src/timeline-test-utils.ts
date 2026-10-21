/** 可控 Web Locks 模拟：授锁回调异步执行，并持锁直到回调返回的 Promise 完成。 */
export class TestLocks {
  private held = new Set<string>();
  private pending: (() => void)[] = [];
  requests = 0;
  automatic = true;
  failure?: Error;

  request(name: string, options: LockOptions, callback: LockGrantedCallback<unknown>): Promise<unknown> {
    this.requests++;
    if (this.failure) return Promise.reject(this.failure);
    if (options.mode !== "exclusive" || options.ifAvailable !== true) {
      return Promise.reject(new Error("Expected exclusive ifAvailable request"));
    }
    return new Promise((resolve, reject) => {
      const run = () => {
        const acquired = !this.held.has(name);
        if (acquired) this.held.add(name);
        const lock = acquired ? { name, mode: "exclusive" as const } : null;
        Promise.resolve().then(() => callback(lock)).then(
          (result) => {
            if (acquired) this.held.delete(name);
            resolve(result);
          },
          (error) => {
            if (acquired) this.held.delete(name);
            reject(error);
          },
        );
      };
      if (this.automatic) queueMicrotask(run);
      else this.pending.push(run);
    });
  }

  grantNext() {
    const run = this.pending.shift();
    if (!run) throw new Error("No pending lock request");
    run();
  }
}

export class TestStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  getItem(key: string) { return this.values.get(key) ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  clear() { this.values.clear(); }
  setItem(key: string, value: string) { this.values.set(key, String(value)); }
}

export const flushLocks = async () => {
  for (let index = 0; index < 8; index++) await Promise.resolve();
};
