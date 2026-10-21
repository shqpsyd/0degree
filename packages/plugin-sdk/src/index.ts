import type { ComponentType } from "react";

/** 插件可声明的全部权限。profile.read 为预留，当前不提供能力。 */
export const PERMISSIONS = ["profile.read", "timeline.read", "timeline.write", "ai.invoke"] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const CATEGORIES = ["health", "growth", "finance", "leisure"] as const;
export type PluginCategory = (typeof CATEGORIES)[number];

/** 个人事件。type 命名为 `<domain>.<past-tense-verb>`，如 `mood.logged`。 */
export type LifeEvent = {
  id: string;
  type: string;
  source: string;
  occurredAt: string;
  data: Record<string, unknown>;
};

export type ChatMessage = { role: "user" | "assistant"; content: string };

/** 按插件 id 分隔的 key-value 存储；同源代码仍可直接访问 localStorage，不是安全沙箱。 */
export type PluginStorage = {
  get: <T>(key: string, fallback: T) => T;
  set: (key: string, value: unknown) => void;
  remove: (key: string) => void;
};

/** 运行时注入给插件的能力。除 storage 外均需在 permissions 中声明。 */
export type PluginContext = {
  /** 需要 timeline.write */
  publish: (event: Omit<LifeEvent, "id" | "occurredAt" | "source">) => void;
  /** 需要 timeline.read；MVP 仅检查声明，没有最终用户授权流程，可读取全部足迹。 */
  readTimeline: () => LifeEvent[];
  /** 需要 ai.invoke；首次调用会请求用户同意，用户拒绝时抛出错误 */
  invokeAI: (messages: ChatMessage[]) => Promise<string>;
  storage: PluginStorage;
};

export type ZaituPlugin = {
  /** 形如 `zaitu.<name>`，全局唯一 */
  id: string;
  name: string;
  tagline: string;
  description: string;
  icon: string;
  category: PluginCategory;
  /** 6 位十六进制颜色，如 #8daec3 */
  accent: string;
  permissions: Permission[];
  Component: ComponentType<{ context: PluginContext }>;
  /** 打开插件时调用；返回的函数在关闭、切换或禁用时调用 */
  onActivate?: (context: PluginContext) => void | (() => void);
};
