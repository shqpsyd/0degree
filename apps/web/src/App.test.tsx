// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { PluginContext } from "@zaitu/plugin-sdk";
import App from "./App";
import { parseHash } from "./router";

const fixture = vi.hoisted(() => ({
  contexts: [] as PluginContext[],
  cleanup: vi.fn(),
}));
vi.mock("./plugins", () => {
  const plugin = {
    id: "zaitu.test", name: "Test plugin", tagline: "", description: "", icon: "", category: "growth",
    accent: "#123456", permissions: ["ai.invoke", "timeline.write"],
    Component: () => <p>Plugin content</p>,
    onActivate: (ctx: PluginContext) => { fixture.contexts.push(ctx); return fixture.cleanup; },
  };
  return { plugins: [plugin], pluginById: (id: string) => id === plugin.id ? plugin : undefined, permissionLabels: {} };
});

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  localStorage.clear();
  history.replaceState(null, "", "/#/plugins/zaitu.test");
  fixture.contexts.length = 0;
  fixture.cleanup.mockClear();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("keeps context stable during consent and theme updates, then revokes on navigation", async () => {
  await act(async () => root.render(<React.StrictMode><App /></React.StrictMode>));
  const ctx = fixture.contexts.at(-1)!;
  const activationCount = fixture.contexts.length;
  const fetchSpy = vi.fn(async () => Response.json({ message: "ok" }));
  vi.stubGlobal("fetch", fetchSpy);
  let result!: Promise<string>;
  await act(async () => {
    result = ctx.invokeAI([{ role: "user", content: "hi" }]);
  });
  expect(container.querySelector("dialog")?.open).toBe(true);
  expect(fetchSpy).not.toHaveBeenCalled();
  await act(async () => {
    (container.querySelector('[aria-label="切换深浅主题"]') as HTMLButtonElement).click();
  });
  expect(fixture.contexts).toHaveLength(activationCount);
  await act(async () => {
    [...container.querySelectorAll("button")].find((b) => b.textContent === "同意发送")!.click();
    await result;
  });
  expect(await result).toBe("ok");
  expect(fetchSpy).toHaveBeenCalledTimes(1);
  await act(async () => {
    history.replaceState(null, "", "/#/timeline");
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });
  expect(container.querySelector("h1")?.textContent).toBe("我的足迹");
  expect(container.querySelector('[aria-current="page"]')?.getAttribute("href")).toBe("#/timeline");
  expect(() => ctx.publish({ type: "test.done", data: {} })).toThrow(/释放/);
  expect(fixture.cleanup).toHaveBeenCalled();
});

it("declines pending consent when leaving the plugin", async () => {
  await act(async () => root.render(<App />));
  const ctx = fixture.contexts.at(-1)!;
  const fetchSpy = vi.fn();
  vi.stubGlobal("fetch", fetchSpy);
  let outcome!: Promise<unknown>;
  await act(async () => {
    outcome = ctx.invokeAI([]).catch((e: unknown) => e);
  });
  await act(async () => {
    history.replaceState(null, "", "/#/");
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });
  expect(await outcome).toBeInstanceOf(Error);
  expect(fetchSpy).not.toHaveBeenCalled();
  expect(container.querySelector("dialog")?.open).toBe(false);
});

it("handles encoded deep links and malformed URL escapes", () => {
  expect(parseHash("#/plugins/zaitu%2Etest")).toEqual({ name: "plugin", id: "zaitu.test" });
  expect(parseHash("#/plugins/%ZZ")).toEqual({ name: "plugins" });
});
