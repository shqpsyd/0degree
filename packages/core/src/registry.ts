import { CATEGORIES, PERMISSIONS, type ZaituPlugin } from "@zaitu/plugin-sdk";
import { readBooleanMap, writeJSON } from "./storage";

const ENABLED_KEY = "zaitu.enabled.v1";
const PLUGIN_ID = /^zaitu\.[a-z][a-z0-9-]*$/;
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/** 校验插件声明，返回问题列表（空数组表示合法）。 */
export const validatePlugin = (p: ZaituPlugin): string[] => {
  const problems: string[] = [];
  if (!PLUGIN_ID.test(p.id)) problems.push(`id 需形如 zaitu.<name>：${p.id}`);
  if (!p.name?.trim()) problems.push("缺少 name");
  if (!CATEGORIES.includes(p.category)) problems.push(`未知 category：${p.category}`);
  if (!HEX_COLOR.test(p.accent)) problems.push(`accent 需为 6 位十六进制颜色：${p.accent}`);
  for (const perm of p.permissions ?? []) {
    if (!PERMISSIONS.includes(perm)) problems.push(`未知权限：${perm}`);
  }
  if (typeof p.Component !== "function" && typeof p.Component !== "object") problems.push("缺少 Component");
  return problems;
};

/** 注册插件：校验声明、拒绝重复 id，并冻结列表。 */
export const registerPlugins = (plugins: ZaituPlugin[]): readonly ZaituPlugin[] => {
  const ids = new Set<string>();
  for (const p of plugins) {
    const problems = validatePlugin(p);
    if (problems.length) throw new Error(`插件 ${p.id} 声明无效：${problems.join("；")}`);
    if (ids.has(p.id)) throw new Error("Duplicate plugin: " + p.id);
    ids.add(p.id);
  }
  return Object.freeze([...plugins]);
};

export const readEnabled = (): Record<string, boolean> => readBooleanMap(ENABLED_KEY);

export const isEnabled = (id: string) => readEnabled()[id] !== false;

export const setEnabled = (id: string, enabled: boolean) => {
  if (!PLUGIN_ID.test(id) || typeof enabled !== "boolean") throw new Error("无效的插件启停设置");
  writeJSON(ENABLED_KEY, { ...readEnabled(), [id]: enabled });
};
