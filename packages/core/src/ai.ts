import type { ChatMessage } from "@zaitu/plugin-sdk";
import { readBooleanMap, writeJSON } from "./storage";

const CONSENT_KEY = "zaitu.ai-consent.v1";

/** 用户对各插件“把输入发送给 AI 服务商”的同意记录。 */
export const readAIConsent = (): Record<string, boolean> => readBooleanMap(CONSENT_KEY);
const revisions = new Map<string, number>();
export const consentRevision = (id: string) => revisions.get(id) ?? 0;

export const setAIConsent = (pluginId: string, granted: boolean) => {
  if (!/^zaitu\.[a-z][a-z0-9-]*$/.test(pluginId) || typeof granted !== "boolean") throw new Error("无效的 AI 授权");
  revisions.set(pluginId, consentRevision(pluginId) + 1);
  const next = { ...readAIConsent() };
  if (granted) next[pluginId] = true;
  else delete next[pluginId];
  writeJSON(CONSENT_KEY, next);
};

/** 调用 apps/api 网关。网络错误、非 JSON 响应和服务端错误都转换为可展示的中文错误。 */
export const chat = async (messages: ChatMessage[], signal?: AbortSignal): Promise<string> => {
  let response: Response;
  try {
    response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
      signal,
    });
  } catch (e) {
    if ((e as Error)?.name === "AbortError") throw e;
    throw new Error("无法连接 AI 服务，请确认本地 API 已启动");
  }
  const body = (await response.json().catch((error: unknown) => {
    if (signal?.aborted) throw error;
    return null;
  })) as { message?: unknown; error?: unknown } | null;
  if (!response.ok) throw new Error(typeof body?.error === "string" ? body.error : `AI 服务暂不可用（${response.status}）`);
  if (typeof body?.message !== "string") throw new Error("AI 服务返回了无法识别的结果");
  return body.message;
};
