import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@zaitu/plugin-sdk";
import { Button, Notice } from "@zaitu/design-system";
import { chat } from "@zaitu/core";

export function Assistant() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [configured, setConfigured] = useState<boolean | null>(null);
  const abort = useRef<AbortController | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const health = new AbortController();
    fetch("/api/health", { signal: health.signal })
      .then((r) => r.json())
      .then((d: { aiConfigured?: boolean }) => {
        if (!health.signal.aborted) setConfigured(!!d.aiConfigured);
      })
      .catch(() => {
        if (!health.signal.aborted) setConfigured(false);
      });
    return () => {
      health.abort();
      abort.current?.abort();
    };
  }, []);

  useEffect(() => {
    box.current?.scrollTo({ top: box.current.scrollHeight });
  }, [messages, busy]);

  const request = async (history: ChatMessage[]) => {
    abort.current = new AbortController();
    setBusy(true);
    setError("");
    try {
      const reply = await chat(history, abort.current.signal);
      setMessages([...history, { role: "assistant", content: reply }]);
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") setError(e instanceof Error ? e.message : "请求失败");
    } finally {
      setBusy(false);
    }
  };

  const send = () => {
    const text = draft.trim();
    if (!text || busy) return;
    // 网关最多接受 24 条消息，保留最近的上下文
    const next = [...messages, { role: "user" as const, content: text }].slice(-23);
    setMessages(next);
    setDraft("");
    request(next);
  };

  const lastIsUser = messages.at(-1)?.role === "user";

  return (
    <>
      <div className="heading">
        <p className="eyebrow">YOUR AI COMPANION</p>
        <h1 tabIndex={-1}>AI 旅伴</h1>
        <p className="muted">对话经本地后端转发给 DeepSeek，仅在本页面内存中保留，刷新即清空。不要输入不愿发送给服务商的隐私信息。</p>
      </div>
      {configured === false && <Notice tone="error">AI 暂不可用：本地 API 未启动，或仓库根目录 .env 未配置 DEEPSEEK_API_KEY。</Notice>}
      <div className="card stack">
        <div className="chat-box" ref={box} role="log" aria-live="polite" aria-label="对话记录">
          {messages.length ? (
            messages.map((m, i) => (
              <div key={i} className={`bubble ${m.role}`}>
                <span className="sr-only">{m.role === "user" ? "你：" : "AI："}</span>
                {m.content}
              </div>
            ))
          ) : (
            <p className="muted">今天有什么想聊聊的？</p>
          )}
          {busy && <p className="muted" role="status">正在思考…</p>}
        </div>
        <label className="sr-only" htmlFor="ai-draft">输入消息</label>
        <textarea
          id="ai-draft"
          className="field"
          rows={3}
          maxLength={5000}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send();
          }}
          placeholder="向在途提问…（⌘/Ctrl + Enter 发送）"
        />
        <div className="row">
          <Button disabled={!draft.trim() || busy} onClick={send}>{busy ? "正在思考…" : "发送"}</Button>
          {busy && <Button variant="secondary" onClick={() => abort.current?.abort()}>停止</Button>}
          {error && lastIsUser && !busy && <Button variant="secondary" onClick={() => request(messages)}>重试</Button>}
          {messages.length > 0 && !busy && (
            <Button variant="ghost" onClick={() => { setMessages([]); setError(""); }}>
              清空对话
            </Button>
          )}
        </div>
        {error && <Notice tone="error">{error}</Notice>}
      </div>
    </>
  );
}
