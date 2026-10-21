import { expect, it } from "vitest";
import type { LifeEvent } from "@zaitu/plugin-sdk";
import { dailyEntries, dayKey, monthDays, streak } from "./model";

function event(date: Date, mood = "晴·开心", source = "zaitu.mood"): LifeEvent {
  return { id: "test", source, type: "mood.logged", occurredAt: date.toISOString(), data: { mood, note: "一天" } };
}

it("filters unrelated and invalid events and uses the latest entry per local day", () => {
  const morning = new Date(2026, 9, 21, 8);
  const evening = new Date(2026, 9, 21, 22);
  const entries = dailyEntries([
    event(morning), event(evening, "雨·低落"), event(evening, "雪·平静", "zaitu.other"),
    event(evening, "未知"), { ...event(evening), occurredAt: "invalid" },
  ]);
  expect(entries.size).toBe(1);
  expect(entries.get(dayKey(evening))).toMatchObject({ mood: 3, note: "一天" });
});

it("handles streaks across month boundaries, including an unfinished today", () => {
  const events = [new Date(2026, 1, 28, 12), new Date(2026, 2, 1, 12)].map(date => event(date));
  expect(streak(dailyEntries(events), new Date(2026, 2, 2))).toBe(2);
  expect(streak(dailyEntries(events), new Date(2026, 2, 3))).toBe(0);
  expect(streak(dailyEntries(events), new Date(2026, 2, 1))).toBe(2);
});

it("builds a Monday-first calendar with leap days", () => {
  const days = monthDays(new Date(2024, 1, 1));
  expect(days.slice(0, 4)).toEqual([null, null, null, "2024-02-01"]);
  expect(days.at(-1)).toBe("2024-02-29");
  expect(days.filter(Boolean)).toHaveLength(29);
});
