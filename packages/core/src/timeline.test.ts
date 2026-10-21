import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LifeEvent } from "@zaitu/plugin-sdk";
import { flushLocks, TestLocks, TestStorage } from "./timeline-test-utils";

type Timeline = typeof import("./timeline");
const event = (id: string, source = "zaitu.test"): LifeEvent => ({
  id, source, type: "test.done", occurredAt: "2026-01-01T00:00:00Z", data: { secret: `secret-${id}` },
});
const backup = (events: LifeEvent[]) => ({ app: "zaitu", kind: "timeline", version: 2, events });
const publish = (tab: Timeline) => tab.appendEvent("zaitu.test", { type: "test.done", data: {} });
let locks: TestLocks;
let storage: TestStorage;
let pages: EventTarget[];

const loadPage = async () => {
  const page = new EventTarget();
  pages.push(page);
  vi.stubGlobal("window", page);
  vi.resetModules();
  const tab = await import("./timeline");
  return { tab, page };
};

beforeEach(() => {
  vi.unstubAllGlobals();
  locks = new TestLocks();
  storage = new TestStorage();
  pages = [];
  vi.stubGlobal("navigator", { locks });
  vi.stubGlobal("localStorage", storage);
});

afterEach(async () => {
  for (const page of pages) page.dispatchEvent(new Event("pagehide"));
  await flushLocks();
  vi.unstubAllGlobals();
});

describe("page-level timeline writer lock", () => {
  it("starts on module load, rejects early writes and coalesces repeated initialization", async () => {
    locks.automatic = false;
    const { tab } = await loadPage();
    const ready = tab.initializeTimeline();
    expect(tab.initializeTimeline()).toBe(ready);
    expect(locks.requests).toBe(1);
    expect(() => publish(tab)).toThrow(/正在初始化.*重试/);
    expect(storage.length).toBe(0);
    locks.grantNext();
    await ready;
    publish(tab);
    await tab.initializeTimeline();
    expect(locks.requests).toBe(1);
    expect(tab.readEvents()).toHaveLength(1);
  });

  it("keeps the lock across StrictMode-like subscribe/cleanup cycles", async () => {
    const { tab } = await loadPage();
    await tab.initializeTimeline();
    const off = tab.subscribeTimeline(() => {});
    off();
    tab.subscribeTimeline(() => {})();
    await tab.initializeTimeline();
    expect(locks.requests).toBe(1);
    const { tab: other } = await loadPage();
    await other.initializeTimeline();
    expect(() => publish(other)).toThrow("另一页面正在编辑，请关闭后重试");
    publish(tab);
  });

  it("blocks every mutation in a second tab while allowing fresh synchronous reads", async () => {
    const { tab: owner } = await loadPage();
    await owner.initializeTimeline();
    owner.importTimeline(backup([event("old")]));
    const { tab: other } = await loadPage();
    await other.initializeTimeline();
    const original = storage.getItem(owner.TIMELINE_KEY);
    const mutations = [
      () => publish(other), () => other.deleteEvent("old"), () => other.clearEvents(),
      () => other.clearEvents("zaitu.test"), () => other.importTimeline(backup([event("new")])),
      () => other.migrateTimeline(),
    ];
    for (const mutate of mutations) expect(mutate).toThrow("另一页面正在编辑，请关闭后重试");
    expect(storage.getItem(owner.TIMELINE_KEY)).toBe(original);
    owner.deleteEvent("old");
    expect(other.readEvents()).toEqual([]);
    expect(other.exportTimeline().events).toEqual([]);
  });

  it("retries after the owner closes and reads current data before its first write", async () => {
    const { tab: owner, page } = await loadPage();
    await owner.initializeTimeline();
    owner.importTimeline(backup([event("old")]));
    const { tab: other } = await loadPage();
    await other.initializeTimeline();
    owner.deleteEvent("old");
    const last = publish(owner);
    page.dispatchEvent(new Event("pagehide"));
    expect(() => publish(owner)).toThrow(/重试/);
    await flushLocks();
    expect(() => publish(other)).toThrow(/另一页面/);
    await other.initializeTimeline();
    const added = publish(other);
    expect(other.readEvents().map((item) => item.id).sort()).toEqual([last.id, added.id].sort());
  });

  it("reacquires after bfcache restore and stays blocked if another page owns the lock", async () => {
    const { tab, page } = await loadPage();
    await tab.initializeTimeline();
    page.dispatchEvent(new Event("pagehide"));
    await flushLocks();
    const { tab: other, page: otherPage } = await loadPage();
    await other.initializeTimeline();
    page.dispatchEvent(new Event("pageshow"));
    await tab.initializeTimeline();
    expect(() => publish(tab)).toThrow(/另一页面/);
    publish(other);
    otherPage.dispatchEvent(new Event("pagehide"));
    await flushLocks();
    await tab.initializeTimeline();
    publish(tab);
    expect(tab.readEvents()).toHaveLength(2);
  });

  it("does not grant permission from a stale callback arriving after pagehide", async () => {
    locks.automatic = false;
    const { tab, page } = await loadPage();
    const first = tab.initializeTimeline();
    page.dispatchEvent(new Event("pagehide"));
    await first;
    page.dispatchEvent(new Event("pageshow"));
    const resumed = tab.initializeTimeline();
    locks.grantNext();
    await flushLocks();
    expect(() => publish(tab)).toThrow(/正在初始化/);
    locks.grantNext();
    await resumed;
    publish(tab);
    expect(tab.readEvents()).toHaveLength(1);
  });

  it.each(["missing", "rejected", "throws"])("fails closed when Web Locks is %s", async (mode) => {
    if (mode === "missing") vi.stubGlobal("navigator", {});
    if (mode === "rejected") locks.failure = new Error("SecurityError");
    if (mode === "throws") {
      vi.stubGlobal("navigator", { locks: { request() { throw new Error("SecurityError"); } } });
    }
    const { tab } = await loadPage();
    await tab.initializeTimeline();
    storage.setItem(tab.TIMELINE_KEY, JSON.stringify({ version: 2, events: [event("old")] }));
    expect(tab.readEvents()).toHaveLength(1);
    expect(() => publish(tab)).toThrow(/保护.*不可用/);
    expect(storage.length).toBe(1);
    await flushLocks();
    expect(tab.readEvents()[0].id).toBe("old");
  });
});

describe("v2 physical storage contract", () => {
  it("physically removes deleted payloads and clears only the requested source", async () => {
    const { tab } = await loadPage();
    await tab.initializeTimeline();
    tab.importTimeline(backup([event("a"), event("b"), event("c", "zaitu.other")]));
    tab.deleteEvent("a");
    expect(storage.getItem(tab.TIMELINE_KEY)).not.toContain("secret-a");
    tab.clearEvents("zaitu.test");
    expect(storage.getItem(tab.TIMELINE_KEY)).not.toContain("secret-b");
    expect(tab.readEvents().map((item) => item.id)).toEqual(["c"]);
    tab.clearEvents();
    expect(storage.getItem(tab.TIMELINE_KEY)).toBe('{"version":2,"events":[]}');
    expect(storage.length).toBe(1);
  });

  it("physically caps append/import at 500 and never revives evicted rows", async () => {
    const { tab } = await loadPage();
    await tab.initializeTimeline();
    const events = Array.from({ length: tab.MAX_EVENTS + 1 }, (_, index) => ({
      ...event(String(index)), occurredAt: new Date(2026, 0, 1, 0, index).toISOString(),
    }));
    expect(tab.importTimeline(backup(events))).toEqual({ added: 500, skipped: 1 });
    const added = publish(tab);
    let saved = JSON.parse(storage.getItem(tab.TIMELINE_KEY)!);
    expect(saved.events).toHaveLength(500);
    expect(saved.events.some((item: LifeEvent) => item.id === "0" || item.id === "1")).toBe(false);
    tab.deleteEvent(added.id);
    saved = JSON.parse(storage.getItem(tab.TIMELINE_KEY)!);
    expect(saved.events).toHaveLength(499);
    expect(tab.readEvents()).toHaveLength(499);
    expect(storage.length).toBe(1);
  });

  it("leaves the previous table intact and sends no notification on failed writes", async () => {
    const { tab } = await loadPage();
    await tab.initializeTimeline();
    tab.importTimeline(backup([event("old")]));
    const listener = vi.fn();
    tab.subscribeTimeline(listener);
    const original = storage.getItem(tab.TIMELINE_KEY);
    vi.spyOn(storage, "setItem").mockImplementation(() => { throw new Error("quota"); });
    expect(() => tab.clearEvents()).toThrow(/未保存/);
    expect(() => tab.importTimeline(backup([event("a"), event("b")]))).toThrow(/未保存/);
    expect(storage.getItem(tab.TIMELINE_KEY)).toBe(original);
    expect(listener).not.toHaveBeenCalled();
  });

  it("reads v1 without migration in a non-owner, then migrates only after acquiring", async () => {
    const { tab: owner, page } = await loadPage();
    await owner.initializeTimeline();
    const { tab } = await loadPage();
    await tab.initializeTimeline();
    storage.setItem("zaitu.timeline.v1", JSON.stringify([event("old"), { junk: true }]));
    expect(tab.readEvents()).toEqual([event("old")]);
    expect(storage.getItem(tab.TIMELINE_KEY)).toBeNull();
    expect(storage.getItem("zaitu.timeline.v1")).not.toBeNull();
    page.dispatchEvent(new Event("pagehide"));
    await flushLocks();
    await tab.initializeTimeline();
    expect(tab.readEvents()).toEqual([event("old")]);
    expect(storage.getItem("zaitu.timeline.v1")).toBeNull();
    tab.deleteEvent("old");
    expect(storage.getItem(tab.TIMELINE_KEY)).not.toContain("secret-old");
  });

  it("does not report a successful delete while legacy cleanup has failed", async () => {
    const { tab } = await loadPage();
    await tab.initializeTimeline();
    storage.setItem("zaitu.timeline.v1", JSON.stringify([event("old")]));
    const remove = vi.spyOn(storage, "removeItem").mockImplementation(() => { throw new Error("denied"); });
    expect(() => tab.deleteEvent("old")).toThrow(/未删除/);
    expect(tab.readEvents()).toEqual([event("old")]);
    remove.mockRestore();
    tab.deleteEvent("old");
    expect(storage.getItem("zaitu.timeline.v1")).toBeNull();
    expect(storage.getItem(tab.TIMELINE_KEY)).not.toContain("secret-old");
  });
});
