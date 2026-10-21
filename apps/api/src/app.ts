import type { IncomingMessage, ServerResponse } from "node:http";
import type { GatewayConfig } from "./config";
import { createDailyBudget, createRateLimiter } from "./limits";

export const MAX_BODY_BYTES = 24_000;
export const MAX_MESSAGES = 24;
export const MAX_MESSAGE_CHARS = 5_000;

const SYSTEM_PROMPT =
  "你是在途 AI 生活助手。提供温暖、简洁、可执行的帮助；涉及医疗与投资时说明不确定性，不提供确定性诊断或收益承诺。";

type ChatMessage = { role: "user" | "assistant"; content: string };

class HttpError extends Error {
  constructor(readonly status: number, message: string, readonly headers: Record<string, string> = {}) {
    super(message);
  }
}

const send = (res: ServerResponse, status: number, data: unknown, headers: Record<string, string> = {}) => {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...headers,
  });
  res.end(JSON.stringify(data));
};

const readBody = (req: IncomingMessage): Promise<string> => new Promise((resolve, reject) => {
  const chunks: Buffer[] = [];
  let size = 0;
  const cleanup = () => {
    req.off("data", onData);
    req.off("end", onEnd);
    req.off("error", onError);
    req.off("aborted", onAborted);
  };
  const onError = (error: Error) => { cleanup(); reject(error); };
  const onAborted = () => onError(new HttpError(400, "请求已中断"));
  const onEnd = () => { cleanup(); resolve(Buffer.concat(chunks).toString("utf8")); };
  const onData = (chunk: Buffer) => {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      cleanup();
      // Do not destroy the socket (async-iterator return does that) before sending 413.
      req.resume();
      reject(new HttpError(413, "请求内容过长", { Connection: "close" }));
      return;
    }
    chunks.push(chunk);
  };
  req.on("data", onData);
  req.on("end", onEnd);
  req.on("error", onError);
  req.on("aborted", onAborted);
});

export const parseMessages = (raw: string): ChatMessage[] => {
  let body: { messages?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    throw new HttpError(400, "请求不是合法 JSON");
  }
  const messages = body?.messages;
  const valid =
    Array.isArray(messages) &&
    messages.length > 0 &&
    messages.length <= MAX_MESSAGES &&
    messages.every(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0 &&
        m.content.length <= MAX_MESSAGE_CHARS,
    ) &&
    messages[messages.length - 1].role === "user";
  if (!valid) throw new HttpError(400, `消息格式无效（最多 ${MAX_MESSAGES} 条，每条不超过 ${MAX_MESSAGE_CHARS} 字，最后一条须为用户消息）`);
  // 只转发白名单字段，丢弃客户端附带的其他属性
  return (messages as ChatMessage[]).map(({ role, content }) => ({ role, content }));
};

export type Deps = { fetch?: typeof fetch; now?: () => number; log?: (msg: string) => void };

export const createHandler = (config: GatewayConfig, deps: Deps = {}) => {
  const doFetch = deps.fetch ?? fetch;
  const log = deps.log ?? ((msg: string) => console.log(msg));
  const rateLimit = createRateLimiter(config.ratePerMinute, 60_000, deps.now);
  const budget = createDailyBudget(config.dailyLimit, deps.now);

  const callProvider = async (messages: ChatMessage[]) => {
    let response: Response;
    let data: { choices?: { message?: { content?: string } }[] } | null;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const operation = async () => {
      const response = await doFetch(`${config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: config.model,
          messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
          max_tokens: config.maxTokens,
          stream: false,
        }),
        signal: controller.signal,
      });
      const data = await response.json().catch(() => null);
      return { response, data };
      };
      ({ response, data } = await Promise.race([
        operation(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new HttpError(504, "AI 服务响应超时，请稍后重试"));
          }, config.timeoutMs);
        }),
      ]));
    } catch (e) {
      if (e instanceof HttpError) throw e;
      const name = (e as Error)?.name;
      if (name === "TimeoutError" || name === "AbortError") throw new HttpError(504, "AI 服务响应超时，请稍后重试");
      throw new HttpError(502, "无法连接 AI 服务商");
    } finally {
      clearTimeout(timer);
    }
    if (!response.ok) {
      // 只记录状态码，不记录用户内容或服务商返回体
      log(`[api] provider error status=${response.status}`);
      if (response.status === 401 || response.status === 403)
        throw new HttpError(502, "AI 服务鉴权失败，请检查服务端 DEEPSEEK_API_KEY");
      if (response.status === 402) throw new HttpError(502, "AI 服务账户余额不足");
      if (response.status === 429) throw new HttpError(503, "AI 服务繁忙，请稍后重试", { "Retry-After": "30" });
      throw new HttpError(502, "AI 服务请求失败");
    }
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string") throw new HttpError(502, "AI 服务返回了无法识别的结果");
    return content;
  };

  return async (req: IncomingMessage, res: ServerResponse) => {
    const path = new URL(req.url ?? "/", "http://localhost").pathname;
    try {
      if (path === "/api/health") {
        if (req.method !== "GET") throw new HttpError(405, "Method not allowed", { Allow: "GET" });
        return send(res, 200, { ok: true, aiConfigured: !!config.apiKey, dailyRemaining: budget.remaining() });
      }
      if (path !== "/api/chat") throw new HttpError(404, "Not found");
      if (req.method !== "POST") throw new HttpError(405, "Method not allowed", { Allow: "POST" });
      // 要求 JSON：跨站页面无法在不触发 CORS 预检的情况下发出该请求，而网关不响应预检
      if (!req.headers["content-type"]?.toLowerCase().startsWith("application/json")) {
        throw new HttpError(415, "Content-Type 必须为 application/json");
      }
      if (!config.apiKey) throw new HttpError(503, "AI 未配置：请在仓库根目录 .env 设置 DEEPSEEK_API_KEY");

      const limited = rateLimit(req.socket.remoteAddress ?? "unknown");
      if (!limited.ok) throw new HttpError(429, "请求过于频繁，请稍后再试", { "Retry-After": String(limited.retryAfterSec) });

      const messages = parseMessages(await readBody(req));
      if (!budget.tryConsume()) throw new HttpError(429, "今日 AI 调用额度已用完");
      return send(res, 200, { message: await callProvider(messages) });
    } catch (e) {
      if (e instanceof HttpError) return send(res, e.status, { error: e.message }, e.headers);
      log(`[api] unexpected error: ${(e as Error)?.name ?? "unknown"}`);
      return send(res, 500, { error: "服务内部错误" });
    }
  };
};
