import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createHandler, MAX_BODY_BYTES } from "./app";
import { loadConfig } from "./config";

let server: Server | undefined;
afterEach(() => new Promise<void>((r) => (server ? server.close(() => r()) : r())));

const start = async (env: Record<string, string>, providerFetch?: typeof fetch, timeoutMs?: number) => {
  const config = loadConfig({ DEEPSEEK_API_KEY: "test-key", ...env });
  if (timeoutMs) config.timeoutMs = timeoutMs;
  server = createServer(createHandler(config, { fetch: providerFetch, log: () => {} }));
  await new Promise<void>((r) => server!.listen(0, "127.0.0.1", r));
  const { port } = server.address() as AddressInfo;
  return (path: string, init?: RequestInit) => fetch(`http://127.0.0.1:${port}${path}`, init);
};

const chat = (body: unknown) => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: typeof body === "string" ? body : JSON.stringify(body),
});
const hi = { messages: [{ role: "user", content: "你好" }] };
const okProvider = () =>
  vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: "你好呀" } }] }), { status: 200 }));

describe("api gateway", () => {
  it("returns a readable JSON 413 for chunked oversized bodies", async () => {
    const provider = okProvider();
    const req = await start({}, provider as unknown as typeof fetch);
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("x".repeat(MAX_BODY_BYTES + 1)));
        controller.close();
      },
    });
    const res = await req("/api/chat", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: stream, duplex: "half"
    } as RequestInit);
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: "请求内容过长" });
    expect(provider).not.toHaveBeenCalled();
  });

  it.each(["headers", "body"])("times out while waiting for provider %s", async (phase) => {
    const provider = vi.fn(async () => {
      if (phase === "headers") return new Promise<Response>(() => {});
      return new Response(new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode("{")); } }));
    });
    const req = await start({}, provider as unknown as typeof fetch, 20);
    const res = await req("/api/chat", chat(hi));
    expect(res.status).toBe(504);
    expect((await res.json()).error).toMatch(/超时/);
  });

  it("rejects malformed provider success responses", async () => {
    const req = await start({}, vi.fn(async () => new Response("not json")) as unknown as typeof fetch);
    expect((await req("/api/chat", chat(hi))).status).toBe(502);
  });
  it("reports health without exposing the key", async () => {
    const req = await start({});
    const res = await req("/api/health");
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, aiConfigured: true });
    expect(JSON.stringify(body)).not.toContain("test-key");
  });

  it("returns 503 when no key is configured", async () => {
    const req = await start({ DEEPSEEK_API_KEY: "" });
    expect((await req("/api/chat", chat(hi))).status).toBe(503);
  });

  it("forwards valid chats with server-side key, system prompt and token cap", async () => {
    const provider = okProvider();
    const req = await start({ AI_MAX_TOKENS: "256" }, provider as unknown as typeof fetch);
    const res = await req("/api/chat", chat({ messages: [{ role: "user", content: "你好", extra: "x" }] }));
    expect(await res.json()).toEqual({ message: "你好呀" });
    const [, init] = provider.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-key");
    const sent = JSON.parse(init.body as string);
    expect(sent.max_tokens).toBe(256);
    expect(sent.messages[0].role).toBe("system");
    expect(sent.messages[1]).toEqual({ role: "user", content: "你好" });
  });

  it("rejects bad input", async () => {
    const provider = okProvider();
    const req = await start({}, provider as unknown as typeof fetch);
    expect((await req("/api/chat", chat("not json"))).status).toBe(400);
    expect((await req("/api/chat", chat({ messages: [{ role: "system", content: "x" }] }))).status).toBe(400);
    expect((await req("/api/chat", { ...chat(hi), headers: { "Content-Type": "text/plain" } })).status).toBe(415);
    expect((await req("/api/chat", chat({
      messages: [{ role: "user", content: "x".repeat(MAX_BODY_BYTES) }]
    }))).status).toBe(413);
    expect((await req("/api/chat")).status).toBe(405);
    expect((await req("/api/nope")).status).toBe(404);
    expect(provider).not.toHaveBeenCalled();
  });

  it("enforces per-client rate limit and daily budget", async () => {
    const req = await start(
      { AI_RATE_PER_MINUTE: "2", AI_DAILY_LIMIT: "100" }, okProvider() as unknown as typeof fetch
    );
    expect((await req("/api/chat", chat(hi))).status).toBe(200);
    expect((await req("/api/chat", chat(hi))).status).toBe(200);
    const limited = await req("/api/chat", chat(hi));
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBeTruthy();
  });

  it("stops forwarding after the daily budget is used", async () => {
    const req = await start({ AI_DAILY_LIMIT: "1" }, okProvider() as unknown as typeof fetch);
    expect((await req("/api/chat", chat(hi))).status).toBe(200);
    expect((await req("/api/chat", chat(hi))).status).toBe(429);
  });

  it("maps provider failures to user-facing errors", async () => {
    const failing = vi.fn(async () => new Response("{}", { status: 401 }));
    const req = await start({}, failing as unknown as typeof fetch);
    const res = await req("/api/chat", chat(hi));
    expect(res.status).toBe(502);
    expect((await res.json()).error).toMatch(/鉴权/);
  });
});
