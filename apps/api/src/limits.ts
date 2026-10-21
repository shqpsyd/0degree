/** 固定窗口限流，按 key（客户端 IP）计数。仅适用于单进程本地网关。 */
export const createRateLimiter = (limit: number, windowMs: number, now: () => number = Date.now) => {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (key: string): { ok: true } | { ok: false; retryAfterSec: number } => {
    const t = now();
    if (hits.size > 10_000) for (const [k, v] of hits) if (v.resetAt <= t) hits.delete(k);
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= t) {
      hits.set(key, { count: 1, resetAt: t + windowMs });
      return { ok: true };
    }
    if (entry.count >= limit) return { ok: false, retryAfterSec: Math.ceil((entry.resetAt - t) / 1000) };
    entry.count++;
    return { ok: true };
  };
};

/** 每日预算：按本地日期计数，跨天自动归零。 */
export const createDailyBudget = (limit: number, now: () => number = Date.now) => {
  let day = "";
  let used = 0;
  return {
    tryConsume: () => {
      const today = new Date(now()).toDateString();
      if (today !== day) {
        day = today;
        used = 0;
      }
      if (used >= limit) return false;
      used++;
      return true;
    },
    remaining: () => (new Date(now()).toDateString() === day ? Math.max(0, limit - used) : limit),
  };
};
