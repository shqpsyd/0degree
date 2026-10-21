// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { PluginContext } from "@zaitu/plugin-sdk";
import { plugin } from "./index";

let root: Root;
let container: HTMLDivElement;
const context: PluginContext = {
  storage: { get: (_key, fallback) => fallback, set: vi.fn(), remove: vi.fn() },
  publish: vi.fn(), readTimeline: vi.fn(() => []), invokeAI: vi.fn(),
};
beforeEach(async () => {
  vi.useFakeTimers();
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<plugin.Component context={context} />));
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
async function click(text: string) {
  const button = [...container.querySelectorAll("button")].find(item => item.textContent === text);
  expect(button).toBeDefined();
  await act(async () => button!.click());
}
async function advance(ms: number) {
  await act(async () => vi.advanceTimersByTime(ms));
}
async function fill(value: string) {
  const input = container.querySelector("textarea")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
it("pauses, resumes, finishes and resets the timer", async () => {
  await click("打开休息计时器");
  await click("1 分钟");
  await click("开始休息");
  await advance(10000);
  expect(container.querySelector('[role="timer"]')?.textContent).toBe("00:50");
  await click("暂停");
  await advance(10000);
  expect(container.querySelector('[role="timer"]')?.textContent).toBe("00:50");
  expect(vi.getTimerCount()).toBe(0);
  await click("继续休息");
  await advance(50000);
  expect(container.querySelector('[role="status"]')?.textContent).toContain("休息时间到了");
  expect(vi.getTimerCount()).toBe(0);
  await click("重新计时");
  expect(container.querySelector('[role="timer"]')?.textContent).toBe("01:00");
});
it("cleans resources on switching tools and remounts a fresh timer", async () => {
  await click("打开休息计时器");
  await click("开始休息");
  expect(vi.getTimerCount()).toBe(1);
  await click("打开随心选一个");
  expect(vi.getTimerCount()).toBe(0);
  await click("打开休息计时器");
  expect(container.querySelector('[role="timer"]')?.textContent).toBe("02:00");
  await click("开始休息");
  await act(async () => root.render(null));
  expect(vi.getTimerCount()).toBe(0);
});
it("reconciles a background time jump when returning to the page", async () => {
  await click("打开休息计时器");
  await click("开始休息");
  vi.setSystemTime(Date.now() + 180000);
  await act(async () => document.dispatchEvent(new Event("visibilitychange")));
  expect(container.querySelector('[role="timer"]')?.textContent).toBe("00:00");
  expect(vi.getTimerCount()).toBe(0);
});
it("validates choices, avoids repeats and clears stale results on edits", async () => {
  await click("打开随心选一个");
  await fill("散步\n散步");
  expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
  await fill("散步\n听歌");
  await click("帮我选一个");
  const first = container.querySelector('[role="status"]')!.textContent;
  await click("再选一次");
  expect(container.querySelector('[role="status"]')!.textContent).not.toBe(first);
  await fill("字".repeat(41) + "\n散步");
  expect(container.querySelector("textarea")!.getAttribute("aria-invalid")).toBe("true");
  expect(container.querySelector('[role="status"]')!.textContent).toContain("还没有抽签结果");
  expect(context.storage.set).not.toHaveBeenCalled();
  expect(context.publish).not.toHaveBeenCalled();
});
