// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { PluginContext } from "@zaitu/plugin-sdk";
import { plugin } from "./index";
import { STORAGE_KEY } from "./model";

let root: Root;
let container: HTMLDivElement;
let context: PluginContext;
beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  context = {
    storage: { get: (_key, fallback) => fallback, set: vi.fn(), remove: vi.fn() },
    publish: vi.fn(), readTimeline: vi.fn(() => []), invokeAI: vi.fn(),
  };
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
async function mount() {
  await act(async () => root.render(<plugin.Component context={context} />));
}
async function click(text: string) {
  const button = [...container.querySelectorAll("button")].find(item => item.textContent === text);
  expect(button).toBeDefined();
  await act(async () => button!.click());
}
async function input(selector: string, value: string) {
  const element = container.querySelector<HTMLInputElement>(selector)!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

it("retains the selected portion after a failed save and supports retry", async () => {
  await mount();
  await click("200 克");
  expect(container.querySelector(".nutrition-total")?.textContent).toBe("104 kcal");
  expect(context.storage.set).not.toHaveBeenCalled();
  vi.mocked(context.storage.set).mockImplementationOnce(() => { throw new Error("quota"); });
  await click("保存本机选择");
  expect(container.querySelector('[role="alert"]')?.textContent).toContain("保存失败");
  expect(container.querySelector<HTMLInputElement>('input[type="number"]')!.value).toBe("200");
  await click("保存本机选择");
  expect(context.storage.set).toHaveBeenLastCalledWith(STORAGE_KEY, { version: 1, foodId: "apple", grams: 200 });
  expect(container.querySelector('[role="status"]')?.textContent).toContain("已保存");
  expect(context.publish).not.toHaveBeenCalled();
  expect(context.readTimeline).not.toHaveBeenCalled();
  expect(context.invokeAI).not.toHaveBeenCalled();
});

it("blocks invalid portions without hiding the per-100g reference", async () => {
  await mount();
  await input('input[type="number"]', "");
  expect(container.querySelector('input[type="number"]')?.getAttribute("aria-invalid")).toBe("true");
  expect(container.querySelector(".nutrition-total")).toBeNull();
  expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
  expect(container.querySelector("table")?.textContent).toContain("52 kcal");
  await input('input[type="number"]', "150");
  expect(container.querySelector(".nutrition-total")?.textContent).toBe("78 kcal");
});

it("filters foods and recovers from an empty search without changing the selection", async () => {
  await mount();
  await click("谷薯");
  expect(container.querySelectorAll(".nutrition-food")).toHaveLength(1);
  expect(container.querySelector(".nutrition-food")?.textContent).toContain("米饭");
  await act(async () => container.querySelector<HTMLButtonElement>(".nutrition-food")!.click());
  expect(container.querySelector(".nutrition-summary h3")?.textContent).toBe("米饭");
  await input('input[type="search"]', "不存在");
  expect(container.querySelectorAll(".nutrition-food")).toHaveLength(0);
  expect(container.querySelector(".empty-state")?.textContent).toContain("没有匹配");
  expect(container.querySelector(".nutrition-summary h3")?.textContent).toBe("米饭");
  await click("查看全部食物");
  expect(container.querySelectorAll(".nutrition-food")).toHaveLength(6);
  expect(container.querySelector(".nutrition-source")?.textContent).toContain("尚未接入");
});

it("restores the saved food and weight after remounting", async () => {
  let saved: unknown = null;
  context.storage.get = <T,>(_key: string, fallback: T) => (saved ?? fallback) as T;
  context.storage.set = (_key, value) => { saved = value; };
  await mount();
  await click("肉类");
  await act(async () => container.querySelector<HTMLButtonElement>(".nutrition-food")!.click());
  await click("50 克");
  await click("保存本机选择");
  await act(async () => root.unmount());
  root = createRoot(container);
  await mount();
  expect(container.querySelector(".nutrition-summary h3")?.textContent).toBe("鸡胸肉");
  expect(container.querySelector<HTMLInputElement>('input[type="number"]')!.value).toBe("50");
  expect(container.querySelector(".nutrition-total")?.textContent).toBe("82.5 kcal");
  expect(container.querySelector('[role="status"]')?.textContent).toContain("已恢复");
});
