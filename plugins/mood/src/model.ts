import type { LifeEvent } from "@zaitu/plugin-sdk";

export const WEATHER = [
  { id: "sun", icon: "☀️", label: "晴·开心" },
  { id: "cloud-sun", icon: "🌤️", label: "多云·还行" },
  { id: "cloud", icon: "☁️", label: "阴·平淡" },
  { id: "rain", icon: "🌧️", label: "雨·低落" },
  { id: "storm", icon: "⛈️", label: "雷雨·烦躁" },
  { id: "snow", icon: "❄️", label: "雪·平静" },
  { id: "rainbow", icon: "🌈", label: "彩虹·治愈" },
] as const;

export type Entry = { day: string; mood: number; note: string; timestamp: number };

/** 使用本地日历日期；不用 UTC 截断或固定 24 小时推算日期。 */
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${
    String(date.getDate()).padStart(2, "0")}`;
}

export function dailyEntries(events: LifeEvent[]): Map<string, Entry> {
  const entries = new Map<string, Entry>();
  for (const event of events) {
    if (event.source !== "zaitu.mood" || event.type !== "mood.logged" || !event.data) continue;
    const mood = WEATHER.findIndex(item => item.label === event.data.mood);
    const timestamp = Date.parse(event.occurredAt);
    if (mood < 0 || !Number.isFinite(timestamp)) continue;
    const day = dayKey(new Date(timestamp));
    // 足迹倒序；时间相同时保留先出现的事件。
    if (entries.has(day) && entries.get(day)!.timestamp >= timestamp) continue;
    entries.set(day, { day, mood, note: typeof event.data.note === "string" ? event.data.note : "", timestamp });
  }
  return entries;
}

export function streak(entries: Map<string, Entry>, now: Date): number {
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  if (!entries.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let count = 0;
  while (entries.has(dayKey(cursor))) {
    count++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}

export function monthDays(month: Date): (string | null)[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const padding = (first.getDay() + 6) % 7;
  const length = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return [
    ...Array<null>(padding).fill(null),
    ...Array.from({ length }, (_, i) => dayKey(new Date(month.getFullYear(), month.getMonth(), i + 1))),
  ];
}
