import type { Permission, PluginContext, PluginStorage, ZaituPlugin } from "@zaitu/plugin-sdk";
import { chat, consentRevision, readAIConsent, setAIConsent } from "./ai";
import { isEnabled } from "./registry";
import { keysWithPrefix, readJSON, removeKey, writeJSON } from "./storage";
import { appendEvent, readEvents } from "./timeline";

export class PermissionError extends Error {
  constructor(pluginId: string, permission: Permission) {
    super(`插件 ${pluginId} 未声明权限 ${permission}`);
    this.name = "PermissionError";
  }
}

export type ContextOptions = {
  /** 插件首次调用 AI 时由宿主弹出确认；resolve(true) 表示用户同意。 */
  requestAIConsent: (plugin: ZaituPlugin) => Promise<boolean>;
};

const pluginPrefix = (id: string) => {
  if (!/^zaitu\.[a-z][a-z0-9-]*$/.test(id)) throw new Error("无效的插件存储命名空间");
  return `zaitu.plugin.${id}.`;
};

export const createPluginStorage = (pluginId: string): PluginStorage => {
  const prefix = pluginPrefix(pluginId);
  return {
    get: (key, fallback) => readJSON(prefix + key, fallback),
    set: (key, value) => writeJSON(prefix + key, value),
    remove: (key) => removeKey(prefix + key),
  };
};

/** 删除某插件的全部私有数据。 */
export const clearPluginData = (pluginId: string) => keysWithPrefix(pluginPrefix(pluginId)).forEach(removeKey);

/** 为插件创建受权限约束的上下文。这只是代码侧检查，不是对恶意代码的隔离。 */
export const makeContext = (plugin: ZaituPlugin, options: ContextOptions): PluginContext & { dispose: () => void } => {
  let disposed = false;
  let pending: Promise<void> | undefined;
  const abort = new AbortController();
  const assertActive = () => {
    if (disposed || !isEnabled(plugin.id)) throw new Error("插件已停用或上下文已释放");
  };
  const require = (permission: Permission) => {
    assertActive();
    if (!plugin.permissions.includes(permission)) throw new PermissionError(plugin.id, permission);
  };
  return {
    dispose: () => { disposed = true; abort.abort(); },
    publish: (event) => {
      require("timeline.write");
      appendEvent(plugin.id, event);
    },
    readTimeline: () => {
      require("timeline.read");
      return readEvents();
    },
    invokeAI: async (messages) => {
      require("ai.invoke");
      if (!readAIConsent()[plugin.id]) {
        if (!pending) {
          const revision = consentRevision(plugin.id);
          pending = (async () => {
            const granted = await options.requestAIConsent(plugin);
            assertActive();
            if (!granted) throw new Error("你没有同意发送内容给 AI，本次未发送");
            if (revision !== consentRevision(plugin.id)) throw new Error("AI 授权已变更，请重试");
            setAIConsent(plugin.id, true);
          })().finally(() => { pending = undefined; });
        }
        await pending;
      }
      assertActive();
      if (!readAIConsent()[plugin.id]) throw new Error("AI 授权已撤销");
      return chat(messages, abort.signal);
    },
    storage: createPluginStorage(plugin.id),
  };
};
