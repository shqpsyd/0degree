import type { LifeEvent } from "@zaitu/plugin-sdk";
import { readJSON, removeKey, writeJSON } from "./storage";

export const TIMELINE_KEY = "zaitu.timeline.v2";
const LEGACY_V1_KEY = "zaitu.timeline.v1";
const WRITE_LOCK = "zaitu.timeline.writer";
export const MAX_EVENTS = 500;
const EVENT_TYPE = /^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/;

type TimelineFile = { version: 2; events: LifeEvent[] };
export type TimelineExport = { app: "zaitu"; kind: "timeline"; version: 2; exportedAt: string; events: LifeEvent[] };

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

type WriterState = "idle" | "pending" | "held" | "blocked" | "unavailable" | "suspended";
let writerState: WriterState = "idle";
let generation = 0;
let ready: Promise<void> | undefined;
let finishReady: (() => void) | undefined;
let release: (() => void) | undefined;
let lifecycleInstalled = false;
let blockedByOtherPage = false;

const suspendWriter = () => {
  // 先撤销同步写权限，随后释放浏览器锁；旧异步回调不能重新授予权限。
  generation++;
  writerState = "suspended";
  blockedByOtherPage = false;
  finishReady?.();
  release?.();
  ready = undefined;
  finishReady = undefined;
  release = undefined;
};

const resumeWriter = () => {
  if (writerState !== "suspended") return;
  writerState = "idle";
  void initializeTimeline();
};

/** 模块加载时启动；幂等等待本轮申请完成，不等待页面级锁释放，也不保证获得锁。 */
export const initializeTimeline = (): Promise<void> => {
  if (writerState === "suspended") return Promise.resolve();
  if (ready && (writerState === "pending" || writerState === "held")) return ready;
  if (typeof window === "undefined" || typeof navigator === "undefined" || !navigator.locks) {
    writerState = "unavailable";
    return Promise.resolve();
  }
  if (!lifecycleInstalled) {
    window.addEventListener("pagehide", suspendWriter);
    window.addEventListener("pageshow", resumeWriter);
    lifecycleInstalled = true;
  }
  const ticket = ++generation;
  writerState = "pending";
  ready = new Promise<void>((resolve) => { finishReady = resolve; });
  const done = finishReady!;
  const failed = () => {
    if (ticket === generation) writerState = "unavailable";
    done();
  };
  try {
    void navigator.locks.request(WRITE_LOCK, { mode: "exclusive", ifAvailable: true }, (lock) => {
      if (ticket !== generation) { done(); return; }
      if (!lock) {
        writerState = "blocked";
        blockedByOtherPage = true;
        done();
        return;
      }
      writerState = "held";
      blockedByOtherPage = false;
      const lifetime = new Promise<void>((resolve) => { release = resolve; });
      done();
      return lifetime;
    }).catch(failed);
  } catch {
    failed();
  }
  return ready;
};

const requireWriter = () => {
  if (writerState === "held") return;
  const blocked = blockedByOtherPage;
  const unavailable = writerState === "unavailable";
  void initializeTimeline();
  if (unavailable || writerState === "unavailable") {
    throw new Error("浏览器写入保护不可用，请使用支持 Web Locks 的安全页面后重试");
  }
  if (blocked) throw new Error("另一页面正在编辑，请关闭后重试");
  throw new Error("足迹写入保护正在初始化，请稍后重试");
};

// 不绑定 React 挂载/卸载；StrictMode 不会释放页面级锁。SSR 不申请浏览器锁。
if (typeof window !== "undefined") void initializeTimeline();
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    window.removeEventListener("pagehide", suspendWriter);
    window.removeEventListener("pageshow", resumeWriter);
    suspendWriter();
  });
}

/** 订阅足迹变化，返回取消订阅函数。 */
export const subscribeTimeline = (fn: () => void) => {
  listeners.add(fn);
  return () => void listeners.delete(fn);
};

export const isLifeEvent = (value: unknown): value is LifeEvent => {
  const e = value as LifeEvent;
  return (
    !!e &&
    typeof e === "object" &&
    typeof e.id === "string" &&
    e.id.length > 0 &&
    typeof e.type === "string" &&
    EVENT_TYPE.test(e.type) &&
    typeof e.source === "string" &&
    /^zaitu\.[a-z][a-z0-9-]*$/.test(e.source) &&
    typeof e.occurredAt === "string" &&
    !Number.isNaN(Date.parse(e.occurredAt)) &&
    !!e.data &&
    typeof e.data === "object" &&
    !Array.isArray(e.data)
  );
};

const sortDesc = (events: LifeEvent[]) => {
  const unique = new Map<string, LifeEvent>();
  for (const event of events) {
    if (!unique.has(event.id)) unique.set(event.id, event);
  }
  return [...unique.values()]
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt) || a.id.localeCompare(b.id))
    .slice(0, MAX_EVENTS);
};

/** 只允许持锁页面迁移。先持久化 v2，再清理 v1；清理失败可重试。 */
export const migrateTimeline = () => {
  requireWriter();
  const file = readJSON<Partial<TimelineFile>>(TIMELINE_KEY, {});
  const legacy = readJSON<unknown>(LEGACY_V1_KEY, null);
  if (!(file.version === 2 && Array.isArray(file.events)) && Array.isArray(legacy)) {
    writeJSON(TIMELINE_KEY, { version: 2, events: sortDesc(legacy.filter(isLifeEvent)) } satisfies TimelineFile);
  }
  if (legacy !== null) removeKey(LEGACY_V1_KEY);
};

const save = (events: LifeEvent[]) => {
  requireWriter();
  writeJSON(TIMELINE_KEY, { version: 2, events } satisfies TimelineFile);
  notify();
};

/** 同步读取；未持锁页面不执行迁移写入。 */
export const readEvents = (): LifeEvent[] => {
  if (writerState === "held") {
    try { migrateTimeline(); } catch { /* Read-only/private storage must not crash the shell. */ }
  }
  const file = readJSON<Partial<TimelineFile>>(TIMELINE_KEY, {});
  if (file.version === 2 && Array.isArray(file.events)) return sortDesc(file.events.filter(isLifeEvent));
  const legacy = readJSON<unknown>(LEGACY_V1_KEY, []);
  return Array.isArray(legacy) ? sortDesc(legacy.filter(isLifeEvent)) : [];
};

export const appendEvent = (source: string, event: Omit<LifeEvent, "id" | "occurredAt" | "source">): LifeEvent => {
  requireWriter();
  if (!EVENT_TYPE.test(event.type)) throw new Error(`事件类型需形如 domain.verb：${event.type}`);
  if (!event.data || typeof event.data !== "object" || Array.isArray(event.data)) throw new Error("事件 data 必须是对象");
  const item: LifeEvent = {
    type: event.type,
    data: event.data,
    id: crypto.randomUUID(),
    occurredAt: new Date().toISOString(),
    source,
  };
  if (!isLifeEvent(item)) throw new Error("无效的足迹事件来源或数据");
  migrateTimeline();
  save([item, ...readEvents()].slice(0, MAX_EVENTS));
  return item;
};

const removeEvents = (matches: (event: LifeEvent) => boolean) => {
  migrateTimeline();
  save(readEvents().filter((event) => !matches(event)));
};

export const deleteEvent = (id: string) => removeEvents((event) => event.id === id);

export const clearEvents = (source?: string) => removeEvents((event) => !source || event.source === source);

export const exportTimeline = (): TimelineExport => ({
  app: "zaitu",
  kind: "timeline",
  version: 2,
  exportedAt: new Date().toISOString(),
  events: readEvents(),
});

/** 导入导出文件并按 id 去重合并。返回新增和跳过的条数。 */
export const importTimeline = (payload: unknown): { added: number; skipped: number } => {
  requireWriter();
  const file = payload as Partial<TimelineExport>;
  const incoming = file?.app === "zaitu" && file.kind === "timeline"
    && file.version === 2 && Array.isArray(file.events) ? file.events : null;
  if (!incoming) throw new Error("不是有效的在途足迹导出文件");
  migrateTimeline();
  const current = readEvents();
  const known = new Set(current.map((e) => e.id));
  const valid: LifeEvent[] = [];
  for (const e of incoming) {
    if (!isLifeEvent(e) || known.has(e.id)) continue;
    known.add(e.id);
    valid.push({ id: e.id, type: e.type, source: e.source, occurredAt: e.occurredAt, data: e.data });
  }
  const merged = sortDesc([...current, ...valid]);
  const retained = new Set(merged.map((e) => e.id));
  const added = valid.filter((e) => retained.has(e.id)).length;
  save(merged);
  return { added, skipped: incoming.length - added };
};
