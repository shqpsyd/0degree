import { plugin as mood } from "@zaitu/plugin-mood";
import { plugin as meal } from "@zaitu/plugin-meal";
import { plugin as nutrition } from "@zaitu/plugin-nutrition";
import { plugin as leisure } from "@zaitu/plugin-leisure";
import { plugin as reading } from "@zaitu/plugin-reading";
import { plugin as fire } from "@zaitu/plugin-fire";
import { registerPlugins } from "@zaitu/core";
import type { Permission } from "@zaitu/plugin-sdk";

/** 新插件在这里注册（同时加入 apps/web/package.json 依赖）。 */
export const plugins = registerPlugins([mood, meal, nutrition, leisure, reading, fire]);

export const pluginById = (id: string) => plugins.find((p) => p.id === id);

export const permissionLabels: Record<Permission, string> = {
  "profile.read": "读取个人资料（预留）",
  "timeline.read": "读取全部足迹（仅声明检查，未实现用户授权）",
  "timeline.write": "写入足迹",
  "ai.invoke": "将你输入的内容发送给 AI",
};
