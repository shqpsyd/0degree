// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { PluginContext } from "@zaitu/plugin-sdk";
import { plugin } from "./index";

const meal = { name: "番茄鸡蛋饭", description: "搭配煮熟的青菜。", alternative: "豆腐饭。" };
const reply = JSON.stringify({ breakfast: meal, lunch: meal, dinner: meal, tip: "按食量调整。" });
let root: Root;
let container: HTMLDivElement;
let context: PluginContext;
beforeEach(async () => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  context = {
    storage: { get: vi.fn((_key, fallback) => fallback), set: vi.fn(), remove: vi.fn() },
    publish: vi.fn(), readTimeline: vi.fn(() => []), invokeAI: vi.fn().mockResolvedValue(reply),
  };
  await act(async () => root.render(<plugin.Component context={context} />));
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
async function click(text: string) {
  await act(async () => [...container.querySelectorAll("button")].find(button => button.textContent === text)!.click());
}

it("requires preferences and never sends or saves data just by filling an example", async () => {
  expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
  for (const field of container.querySelectorAll("textarea, select")) {
    expect(container.querySelector(`label[for="${field.id}"]`)).not.toBeNull();
  }
  await click("填入示例");
  expect(context.invokeAI).not.toHaveBeenCalled();
  expect(context.storage.set).not.toHaveBeenCalled();
  await click("生成今日食谱");
  expect(container.querySelectorAll(".meal-card")).toHaveLength(3);
  expect(container.textContent).toContain("按食量调整");
  expect(context.readTimeline).not.toHaveBeenCalled();
  expect(context.publish).not.toHaveBeenCalled();
});

it("reports denied consent and supports retry", async () => {
  vi.mocked(context.invokeAI).mockRejectedValueOnce(new Error("你没有同意发送内容给 AI，本次未发送"));
  await click("填入示例");
  await click("生成今日食谱");
  expect(container.querySelector('[role="alert"]')?.textContent).toContain("本次未发送");
  await click("重试生成");
  expect(container.querySelector('[role="alert"]')).toBeNull();
  expect(container.querySelectorAll(".meal-card")).toHaveLength(3);
});

it("keeps a successful plan when a subsequent response is malformed", async () => {
  await click("填入示例");
  await click("生成今日食谱");
  vi.mocked(context.invokeAI).mockResolvedValueOnce("{}");
  await click("重新生成今日食谱");
  expect(container.querySelector('[role="alert"]')?.textContent).toContain("完整的三餐建议");
  expect(container.querySelectorAll(".meal-card")).toHaveLength(3);
});

it("prevents duplicate requests while pending and ignores completion after leaving", async () => {
  let resolve!: (value: string) => void;
  vi.mocked(context.invokeAI).mockImplementation(() => new Promise(done => { resolve = done; }));
  await click("填入示例");
  await click("生成今日食谱");
  expect(container.querySelector("fieldset")!.disabled).toBe(true);
  await act(async () => {
    container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  expect(context.invokeAI).toHaveBeenCalledTimes(1);
  await act(async () => root.unmount());
  await act(async () => resolve(reply));
  root = createRoot(container);
  await act(async () => root.render(<plugin.Component context={context} />));
  expect(container.querySelectorAll(".meal-card")).toHaveLength(0);
});

it("marks results stale when preferences change and renders model text safely", async () => {
  vi.mocked(context.invokeAI).mockResolvedValueOnce(reply.replace("按食量调整。", "<img src=x onerror=alert(1)>"));
  await click("填入示例");
  await click("生成今日食谱");
  expect(container.querySelector("img")).toBeNull();
  const input = container.querySelector("textarea")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(input, "想吃面");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(container.querySelector('[role="status"]')?.textContent).toContain("上次生成");
});
