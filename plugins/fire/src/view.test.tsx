// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { PluginContext } from "@zaitu/plugin-sdk";
import { plugin } from "./index";
import { DEFAULT_PLAN, STORAGE_KEY } from "./model";

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
  await act(async () => [...container.querySelectorAll("button")].find(button => button.textContent === text)!.click());
}
it("saves explicitly, reports failure and retries without losing parameters", async () => {
  await mount();
  expect(context.storage.set).not.toHaveBeenCalled();
  vi.mocked(context.storage.set).mockImplementationOnce(() => { throw new Error("quota"); });
  await click("保存本机方案");
  expect(container.querySelector('[role="alert"]')?.textContent).toContain("保存失败");
  expect(container.textContent).toContain("¥3,000,000");
  await click("保存本机方案");
  expect(context.storage.set).toHaveBeenLastCalledWith(STORAGE_KEY, { version: 1, ...DEFAULT_PLAN });
  expect(container.querySelector('[role="status"]')?.textContent).toContain("已保存");
  expect(context.publish).not.toHaveBeenCalled();
  expect(context.invokeAI).not.toHaveBeenCalled();
});
it("applies a comparison and marks it unsaved", async () => {
  await mount();
  await click("采用 3% 假设");
  expect(container.querySelectorAll("input")[2].value).toBe("3");
  expect(container.querySelector(".fire-total")?.textContent).toBe("¥4,000,000");
  expect(container.querySelector('[role="status"]')?.textContent).toContain("尚未保存");
  expect(context.storage.set).not.toHaveBeenCalled();
});
it("removes misleading results and blocks saving when a field is cleared", async () => {
  await mount();
  const input = container.querySelector("input")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(input.getAttribute("aria-invalid")).toBe("true");
  expect(container.querySelector(".fire-total")).toBeNull();
  expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
});
it("loads the saved plan again after remounting", async () => {
  let saved: unknown = null;
  context.storage.get = <T,>(_key: string, fallback: T) => (saved ?? fallback) as T;
  context.storage.set = (_key, value) => { saved = value; };
  await mount();
  await click("采用 5% 假设");
  await click("保存本机方案");
  await act(async () => root.unmount());
  root = createRoot(container);
  await mount();
  expect(container.querySelectorAll("input")[2].value).toBe("5");
  expect(container.querySelector('[role="status"]')?.textContent).toContain("已载入");
});
