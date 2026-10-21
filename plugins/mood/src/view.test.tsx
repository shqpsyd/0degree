// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { LifeEvent, PluginContext } from "@zaitu/plugin-sdk";
import { plugin } from "./index";
import { WEATHER } from "./model";

let root: Root;
let container: HTMLDivElement;
let context: PluginContext;
let events: LifeEvent[];
beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  events = [];
  context = {
    storage: { get: (_key, fallback) => fallback, set: vi.fn(), remove: vi.fn() },
    invokeAI: vi.fn(),
    readTimeline: vi.fn(() => events),
    publish: vi.fn(event => {
      events = [{
        ...event, id: String(events.length), source: plugin.id, occurredAt: new Date().toISOString(),
      }, ...events];
    }),
  };
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
async function mount() {
  await act(async () => root.render(<plugin.Component context={context} />));
}
async function save() {
  await act(async () => container.querySelector<HTMLButtonElement>('button[type="submit"]')!.click());
}

it("offers all seven moods, publishes each choice and counts a day only once", async () => {
  await mount();
  const radios = container.querySelectorAll<HTMLInputElement>('input[type="radio"]');
  expect(radios).toHaveLength(7);
  for (let i = 0; i < WEATHER.length; i++) {
    await act(async () => radios[i].click());
    await save();
    expect(context.publish).toHaveBeenLastCalledWith({
      type: "mood.logged", data: { mood: WEATHER[i].label, note: "" },
    });
    expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
  }
  expect(container.querySelector(".mood-metrics strong")?.textContent).toBe("1");
  expect(context.invokeAI).not.toHaveBeenCalled();
  expect(context.storage.set).not.toHaveBeenCalled();
});

it("preserves the selection on failure and allows retry", async () => {
  await mount();
  await act(async () => container.querySelectorAll<HTMLInputElement>('input[type="radio"]')[3].click());
  vi.mocked(context.publish).mockImplementationOnce(() => { throw new Error("quota"); });
  await save();
  expect(container.querySelector('[role="alert"]')?.textContent).toContain("保存失败");
  expect(container.querySelectorAll<HTMLInputElement>('input[type="radio"]')[3].checked).toBe(true);
  await save();
  expect(container.querySelector('[role="status"]')?.textContent).toContain("已记录");
});

it("explains when another page owns the timeline editor", async () => {
  await mount();
  vi.mocked(context.publish).mockImplementationOnce(() => {
    throw new Error("另一页面正在编辑，请关闭后重试");
  });
  await save();
  expect(container.querySelector('[role="alert"]')?.textContent).toContain("另一页面正在编辑，请关闭后重试");
});

it("loads existing legacy records and prevents unchanged repeat submissions", async () => {
  events = [{
    id: "old", source: plugin.id, type: "mood.logged", occurredAt: new Date().toISOString(),
    data: { mood: "雪·平静", note: "安静的一天" },
  }];
  await mount();
  expect(container.querySelector("textarea")?.value).toBe("安静的一天");
  expect(container.querySelectorAll<HTMLInputElement>('input[type="radio"]')[5].checked).toBe(true);
  await save();
  expect(context.publish).not.toHaveBeenCalled();
  expect(container.querySelector(".mood-entry")?.textContent).toContain("安静的一天");
});

it("shows unavailable history instead of misleading empty statistics, then retries", async () => {
  vi.mocked(context.readTimeline).mockImplementationOnce(() => { throw new Error("unavailable"); });
  await mount();
  expect(container.querySelector(".mood-metrics")).toBeNull();
  expect(container.querySelector('[role="alert"]')?.textContent).toContain("历史记录读取失败");
  await clickButton("重新读取");
  expect(container.querySelector(".mood-calendar")).not.toBeNull();
});

async function clickButton(label: string) {
  await act(async () => {
    [...container.querySelectorAll("button")].find(button => button.textContent === label)!.click();
  });
}

async function writeNote(note: string) {
  await act(async () => {
    const textarea = container.querySelector("textarea")!;
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(textarea, note);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function beforeMidnight() {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 31, 23, 59, 50));
}

function record(note: string, date = new Date()): LifeEvent {
  return {
    id: note, source: plugin.id, type: "mood.logged", occurredAt: date.toISOString(),
    data: { mood: WEATHER[5].label, note },
  };
}

it.each([false, true])("loads the new day's content without a draft (existing: %s)", async existing => {
  beforeMidnight();
  events = [record("昨天已保存")];
  await mount();
  if (existing) events = [record("今天已有记录", new Date(2026, 10, 1, 0, 0, 5)), ...events];
  await act(async () => { vi.advanceTimersByTime(30_000); });
  expect(container.querySelector("form time")?.textContent).toBe("2026-11-01");
  expect(container.querySelector("textarea")?.value).toBe(existing ? "今天已有记录" : "");
  expect(container.querySelectorAll<HTMLInputElement>('input[type="radio"]')[existing ? 5 : 0].checked).toBe(true);
  expect(context.publish).not.toHaveBeenCalled();
  expect(container.querySelector(".mood-heading [aria-live]")?.textContent).toContain("11 月");
});

it.each(["note", "mood"])("retains a %s draft across midnight until explicitly transferred", async field => {
  beforeMidnight();
  await mount();
  if (field === "note") await writeNote("未保存的昨天");
  else await act(async () => container.querySelectorAll<HTMLInputElement>('input[type="radio"]')[3].click());
  await act(async () => { vi.advanceTimersByTime(30_000); });
  expect(container.querySelector("form time")?.textContent).toBe("2026-10-31");
  expect(container.querySelector('[role="alert"]')?.textContent).toContain("不会自动保存到今天");
  await save();
  expect(context.publish).not.toHaveBeenCalled();
  await clickButton("将草稿转为今天");
  expect(context.publish).not.toHaveBeenCalled();
  expect(container.querySelector("form time")?.textContent).toBe("2026-11-01");
  await save();
  expect(context.publish).toHaveBeenCalledExactlyOnceWith({
    type: "mood.logged",
    data: { mood: WEATHER[field === "mood" ? 3 : 0].label, note: field === "note" ? "未保存的昨天" : "" },
  });
});

it("discards a draft only after explicit choice and reloads today's record", async () => {
  beforeMidnight();
  await mount();
  await writeNote("旧草稿");
  await act(async () => { vi.advanceTimersByTime(30_000); });
  events = [record("今天已有记录")];
  expect(container.querySelector("textarea")?.value).toBe("旧草稿");
  await clickButton("放弃草稿并加载今天");
  expect(container.querySelector("textarea")?.value).toBe("今天已有记录");
  expect(context.publish).not.toHaveBeenCalled();
});

it.each([false, true])("guards save before the midnight timer refresh (draft: %s)", async draft => {
  beforeMidnight();
  await mount();
  if (draft) await writeNote("午夜前草稿");
  vi.setSystemTime(new Date(2026, 10, 1, 0, 0, 1));
  await save();
  expect(context.publish).not.toHaveBeenCalled();
  expect(container.querySelector("form time")?.textContent).toBe(draft ? "2026-10-31" : "2026-11-01");
  expect(container.querySelector("textarea")?.value).toBe(draft ? "午夜前草稿" : "");
  if (draft) expect(container.querySelector('[role="alert"]')?.textContent).toContain("不会自动保存到今天");
});

it("treats a successful save as clean even if the following timeline read fails", async () => {
  beforeMidnight();
  await mount();
  await writeNote("已保存");
  vi.mocked(context.readTimeline).mockImplementationOnce(() => { throw new Error("unavailable"); });
  await save();
  await act(async () => { vi.advanceTimersByTime(30_000); });
  expect(container.querySelector("form time")?.textContent).toBe("2026-11-01");
  expect(container.querySelector("textarea")?.value).toBe("");
  expect(context.publish).toHaveBeenCalledTimes(1);
});

it("keeps the draft when loading today fails and permits retry", async () => {
  beforeMidnight();
  await mount();
  await writeNote("不能丢失");
  await act(async () => { vi.advanceTimersByTime(30_000); });
  vi.mocked(context.readTimeline).mockImplementationOnce(() => { throw new Error("unavailable"); });
  await clickButton("放弃草稿并加载今天");
  expect(container.querySelector("textarea")?.value).toBe("不能丢失");
  expect(container.querySelector("form time")?.textContent).toBe("2026-10-31");
  await clickButton("放弃草稿并加载今天");
  expect(container.querySelector("textarea")?.value).toBe("");
  expect(container.querySelector("form time")?.textContent).toBe("2026-11-01");
});
