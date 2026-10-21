import type { ComponentType } from "react";
import type { PluginContext } from "@zaitu/plugin-sdk";

/** Local tools/games only. Components must clean up timers/listeners in effects. */
export type LeisureModule = {
  id: string;
  name: string;
  description: string;
  icon: string;
  Component: ComponentType<{ context: PluginContext }>;
};

export function registerModules(entries: readonly LeisureModule[]): readonly LeisureModule[] {
  const ids = new Set<string>();
  for (const entry of entries) {
    if (!/^[a-z][a-z0-9-]*$/.test(entry.id) || ids.has(entry.id)) {
      throw new Error(`无效或重复的休闲模块 ID：${entry.id}`);
    }
    ids.add(entry.id);
  }
  return Object.freeze(entries.map(entry => Object.freeze({ ...entry })));
}
