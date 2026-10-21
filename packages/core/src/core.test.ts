import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ZaituPlugin } from "@zaitu/plugin-sdk";
import { initializeTimeline } from "./timeline";
import { flushLocks, TestLocks } from "./timeline-test-utils";
import {
  clearPluginData,
  createPluginStorage,
  deleteEvent,
  exportTimeline,
  importTimeline,
  makeContext,
  readEvents,
  registerPlugins,
  setEnabled,
  isEnabled,
  readEnabled,
  readAIConsent,
  setAIConsent,
  MAX_EVENTS,
} from "./index";

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() { return this.map.size; }
  clear() { this.map.clear(); }
  getItem(k: string) { return this.map.get(k) ?? null; }
  key(i: number) { return [...this.map.keys()][i] ?? null; }
  removeItem(k: string) { this.map.delete(k); }
  setItem(k: string, v: string) { this.map.set(k, String(v)); }
}

const plugin = (overrides: Partial<ZaituPlugin> = {}): ZaituPlugin => ({
  id: "zaitu.test",
  name: "测试",
  tagline: "",
  description: "",
  icon: "🧪",
  category: "growth",
  accent: "#123456",
  permissions: [],
  Component: () => null,
  ...overrides,
});

const noConsent = { requestAIConsent: async () => false };
const timelinePage = new EventTarget();
const timelineLocks = new TestLocks();

beforeEach(async () => {
  timelinePage.dispatchEvent(new Event("pagehide"));
  await flushLocks();
  vi.unstubAllGlobals();
  vi.stubGlobal("localStorage", new MemoryStorage());
  vi.stubGlobal("window", timelinePage);
  vi.stubGlobal("navigator", { locks: timelineLocks });
  timelinePage.dispatchEvent(new Event("pageshow"));
  await initializeTimeline();
});

describe("registry", () => {
  it("rejects duplicate ids and invalid declarations", () => {
    expect(() => registerPlugins([plugin(), plugin()])).toThrow(/Duplicate/);
    expect(() => registerPlugins([plugin({ id: "Bad Id" })])).toThrow(/id/);
    expect(() => registerPlugins([plugin({ permissions: ["root" as never] })])).toThrow(/未知权限/);
  });

  it("tracks enabled state, defaulting to enabled", () => {
    expect(isEnabled("zaitu.test")).toBe(true);
    setEnabled("zaitu.test", false);
    expect(isEnabled("zaitu.test")).toBe(false);
  });
});

describe("permissions", () => {
  it("blocks undeclared capabilities", async () => {
    const ctx = makeContext(plugin(), noConsent);
    expect(() => ctx.publish({ type: "test.done", data: {} })).toThrow(/timeline.write/);
    expect(() => ctx.readTimeline()).toThrow(/timeline.read/);
    await expect(ctx.invokeAI([])).rejects.toThrow(/ai.invoke/);
  });

  it("does not call AI when the user declines consent", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const ctx = makeContext(plugin({ permissions: ["ai.invoke"] }), noConsent);
    await expect(ctx.invokeAI([{ role: "user", content: "hi" }])).rejects.toThrow(/没有同意/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("asks consent once, then calls the gateway", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ message: "ok" }), { status: 200 })));
    const ask = vi.fn(async () => true);
    const ctx = makeContext(plugin({ permissions: ["ai.invoke"] }), { requestAIConsent: ask });
    expect(await ctx.invokeAI([{ role: "user", content: "hi" }])).toBe("ok");
    expect(await ctx.invokeAI([{ role: "user", content: "hi" }])).toBe("ok");
    expect(ask).toHaveBeenCalledTimes(1);
  });
});

describe("timeline", () => {
  it("publishes with source/id/time and validates type", () => {
    const ctx = makeContext(plugin({ permissions: ["timeline.write", "timeline.read"] }), noConsent);
    ctx.publish({ type: "test.logged", data: { a: 1 } });
    const [e] = ctx.readTimeline();
    expect(e).toMatchObject({ type: "test.logged", source: "zaitu.test", data: { a: 1 } });
    expect(e.id).toBeTruthy();
    expect(() => ctx.publish({ type: "Bad", data: {} })).toThrow(/domain.verb/);
  });

  it("migrates v1 array storage", () => {
    const legacy = [
      { id: "1", type: "mood.logged", source: "zaitu.mood", occurredAt: "2026-01-01T00:00:00Z", data: {} },
      { junk: true },
    ];
    localStorage.setItem("zaitu.timeline.v1", JSON.stringify(legacy));
    expect(readEvents()).toHaveLength(1);
    expect(localStorage.getItem("zaitu.timeline.v1")).toBeNull();
  });

  it("round-trips export/import with dedupe, and deletes", () => {
    const ctx = makeContext(plugin({ permissions: ["timeline.write"] }), noConsent);
    ctx.publish({ type: "test.logged", data: {} });
    const dump = exportTimeline();
    expect(importTimeline(dump)).toEqual({ added: 0, skipped: 1 });
    localStorage.clear();
    expect(importTimeline(JSON.parse(JSON.stringify(dump)))).toEqual({ added: 1, skipped: 0 });
    deleteEvent(dump.events[0].id);
    expect(readEvents()).toHaveLength(0);
    expect(() => importTimeline({ foo: 1 })).toThrow();
  });
});

describe("plugin storage", () => {
  it("rejects ambiguous namespaces", () => {
    expect(() => createPluginStorage("zaitu.a.nested")).toThrow(/命名空间/);
    expect(() => clearPluginData("")).toThrow();
  });
  it("namespaces keys per plugin and can be cleared", () => {
    const a = createPluginStorage("zaitu.a");
    const b = createPluginStorage("zaitu.b");
    a.set("k", { v: 1 });
    expect(a.get("k", null)).toEqual({ v: 1 });
    expect(b.get("k", null)).toBeNull();
    clearPluginData("zaitu.a");
    expect(a.get("k", null)).toBeNull();
  });
});

describe("persistence resilience", () => {
  it("ignores malformed boolean settings rather than trusting truthy values", () => {
    localStorage.setItem("zaitu.enabled.v1", '{"zaitu.test":"false"}');
    localStorage.setItem("zaitu.ai-consent.v1", '{"zaitu.test":"yes"}');
    expect(readEnabled()).toEqual({});
    expect(readAIConsent()).toEqual({});
    expect(() => setEnabled("zaitu.test", "false" as never)).toThrow();
  });

  it("survives denied storage reads and reports failed writes/deletes", () => {
    const denied = () => { throw new Error("SecurityError"); };
    vi.stubGlobal("localStorage", { getItem: denied, setItem: denied, removeItem: denied });
    expect(readEvents()).toEqual([]);
    expect(readEnabled()).toEqual({});
    expect(() => createPluginStorage("zaitu.test").set("x", 1)).toThrow(/未保存/);
    expect(() => createPluginStorage("zaitu.test").remove("x")).toThrow(/未删除/);
  });

  it("reads legacy data when migration cannot persist", () => {
    localStorage.setItem("zaitu.timeline.v1", JSON.stringify([
      { id: "old", type: "test.done", source: "zaitu.test", occurredAt: "2026-01-01", data: {} },
    ]));
    vi.spyOn(localStorage, "setItem").mockImplementation(() => { throw new Error("quota"); });
    expect(readEvents()).toHaveLength(1);
    expect(localStorage.getItem("zaitu.timeline.v1")).not.toBeNull();
  });

  it("validates export versions and reports only retained new events", () => {
    const events = Array.from({ length: MAX_EVENTS + 1 }, (_, i) => ({
      id: String(i), type: "test.done", source: "zaitu.test",
      occurredAt: new Date(2026, 0, 1, 0, i).toISOString(), data: {},
    }));
    const file = { ...exportTimeline(), events: [...events, events[0], { bad: true }] };
    expect(() => importTimeline({ ...file, version: 3 })).toThrow();
    expect(() => importTimeline({ ...file, kind: "other" })).toThrow();
    expect(() => importTimeline(events)).toThrow();
    expect(importTimeline(file)).toEqual({ added: MAX_EVENTS, skipped: 3 });
    expect(readEvents()).toHaveLength(MAX_EVENTS);
    expect(importTimeline(file)).toEqual({ added: 0, skipped: MAX_EVENTS + 3 });
  });
});

describe("context lifecycle", () => {
  it("coalesces concurrent consent requests", async () => {
    let resolve!: (value: boolean) => void;
    const ask = vi.fn(() => new Promise<boolean>((r) => { resolve = r; }));
    const fetchSpy = vi.fn(async () => Response.json({ message: "ok" }));
    vi.stubGlobal("fetch", fetchSpy);
    const ctx = makeContext(plugin({ permissions: ["ai.invoke"] }), { requestAIConsent: ask });
    const a = ctx.invokeAI([]);
    const b = ctx.invokeAI([]);
    expect(ask).toHaveBeenCalledTimes(1);
    resolve(true);
    await expect(Promise.all([a, b])).resolves.toEqual(["ok", "ok"]);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it.each(["dispose", "disable", "revoke"] as const)("blocks late consent after %s", async (action) => {
    let resolve!: (value: boolean) => void;
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const ctx = makeContext(plugin({ permissions: ["ai.invoke", "timeline.write"] }), {
      requestAIConsent: () => new Promise((r) => { resolve = r; }),
    });
    const result = ctx.invokeAI([]);
    if (action === "dispose") ctx.dispose();
    if (action === "disable") setEnabled("zaitu.test", false);
    if (action === "revoke") setAIConsent("zaitu.test", false);
    resolve(true);
    await expect(result).rejects.toThrow();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(readAIConsent()["zaitu.test"]).not.toBe(true);
    if (action !== "revoke") expect(() => ctx.publish({ type: "test.done", data: {} })).toThrow();
  });

  it("aborts in-flight AI on disposal", async () => {
    setAIConsent("zaitu.test", true);
    let signal: AbortSignal | undefined;
    vi.stubGlobal("fetch", vi.fn((_url, init) => {
      signal = init.signal;
      return new Promise((_, reject) => signal!.addEventListener(
        "abort", () => reject(new DOMException("Aborted", "AbortError")),
      ));
    }));
    const ctx = makeContext(plugin({ permissions: ["ai.invoke"] }), noConsent);
    const result = ctx.invokeAI([]);
    ctx.dispose();
    await expect(result).rejects.toThrow(/Aborted/);
    expect(signal?.aborted).toBe(true);
  });
});
