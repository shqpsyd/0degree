export const IDEAS = [
  { title: "起身，舒展一下", description: "离开座位，轻轻活动肩膀和手腕，按舒服的幅度伸展。", icon: "🌿", duration: "约 2 分钟" },
  { title: "让目光去远方", description: "从屏幕上移开视线，看看窗外的树、天空或远处的风景。", icon: "🌤️", duration: "约 1 分钟" },
  { title: "喝口水，慢一点", description: "拿起水杯，小口喝水，把这片刻留给自己。", icon: "💧", duration: "约 1 分钟" },
  { title: "给自己一句鼓励", description: "想想今天已经做好的一个小事，对自己说一句：辛苦了。", icon: "✉️", duration: "约 1 分钟" },
  { title: "走一小段路", description: "在附近走走，换一个视角，不需要记录步数或赶往哪里。", icon: "🌱", duration: "约 3 分钟" },
  { title: "听听周围的声音", description: "暂时放下手里的事，留意身边的三种声音，保持自然呼吸。", icon: "🐚", duration: "约 1 分钟" },
] as const;

/** Exclude the current item when possible; a single-item collection stays usable. */
export function pickNext<T>(items: readonly T[], current?: T): T {
  if (!items.length) throw new Error("没有可抽取的选项");
  const candidates = items.length > 1 ? items.filter(item => item !== current) : items;
  const pool = candidates.length ? candidates : items;
  return pool[Math.floor(Math.random() * pool.length)]!;
}

export function parseOptions(input: string): string[] {
  return [...new Set(input.split(/\r?\n/).map(option => option.trim()).filter(Boolean))];
}

export function remainingSeconds(deadline: number, now: number): number {
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}
