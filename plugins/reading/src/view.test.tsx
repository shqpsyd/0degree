// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { PluginContext } from "@zaitu/plugin-sdk";
import { plugin } from "./index";
import { EMPTY_DRAFT, STORAGE_KEY } from "./model";

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
    storage: { get: <T,>() => ({ version: 1, ...EMPTY_DRAFT, title: "测试作品" }) as T, set: vi.fn(), remove: vi.fn() },
    publish: vi.fn(), readTimeline: vi.fn(() => []), invokeAI: vi.fn(async () => "阅读建议"),
  };
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
async function mount() { await act(async () => root.render(<plugin.Component context={context} />)); }
async function click(text: string) {
  await act(async () => [...container.querySelectorAll("button")].find(button => button.textContent === text)!.click());
}

it("only sends on explicit analysis and marks missing source material", async () => {
  await mount();
  expect(context.invokeAI).not.toHaveBeenCalled();
  await click("分析阅读价值");
  expect(context.invokeAI).toHaveBeenCalledTimes(1);
  expect(container.textContent).toContain("未提供原文：AI 无法核实");
  expect(container.textContent).toContain("阅读建议");
  expect(context.storage.set).not.toHaveBeenCalled();
  expect(context.publish).not.toHaveBeenCalled();
});

it("shows AI failure and retries empty responses", async () => {
  vi.mocked(context.invokeAI).mockRejectedValueOnce(new Error("授权被拒绝")).mockResolvedValueOnce(" ");
  await mount();
  await click("分析阅读价值");
  expect(container.querySelector('[role="alert"]')?.textContent).toContain("授权被拒绝");
  await click("重试分析");
  expect(container.querySelector('[role="alert"]')?.textContent).toContain("AI 未返回内容");
  await click("重试分析");
  expect(container.textContent).toContain("阅读建议");
});

it("locks inputs and duplicate requests until analysis settles", async () => {
  let resolve!: (text: string) => void;
  vi.mocked(context.invokeAI).mockReturnValue(new Promise(done => { resolve = done; }));
  await mount();
  await click("分析阅读价值");
  expect(container.querySelector("input")!.disabled).toBe(true);
  await click("正在分析…");
  expect(context.invokeAI).toHaveBeenCalledTimes(1);
  await act(async () => resolve("完成"));
  expect(container.querySelector("input")!.disabled).toBe(false);
});

it("handles save and delete failures without losing the draft", async () => {
  await mount();
  vi.mocked(context.storage.set).mockImplementationOnce(() => { throw Error("quota"); });
  await click("保存本机草稿");
  expect(container.querySelector('[role="alert"]')?.textContent).toContain("保存失败");
  await click("保存本机草稿");
  expect(context.storage.set).toHaveBeenLastCalledWith(STORAGE_KEY, { version: 1, ...EMPTY_DRAFT, title: "测试作品" });
  vi.mocked(context.storage.remove).mockImplementationOnce(() => { throw Error("denied"); });
  await click("清空输入与本机草稿");
  expect(container.querySelector("input")!.value).toBe("测试作品");
  await click("清空输入与本机草稿");
  expect(container.querySelector("input")!.value).toBe("");
});
