import { useEffect, useId, useRef, useState } from "react";
import type { PluginContext, ZaituPlugin } from "@zaitu/plugin-sdk";
import { buildMessages, EMPTY_DRAFT, fields, readDraft, STORAGE_KEY, validateDraft, type Draft } from "./model";
import "./style.css";

function View({ context }: { context: PluginContext }) {
  const id = useId();
  const [initial] = useState(() => readDraft(context.storage));
  const [draft, setDraft] = useState(initial.draft);
  const [storageMessage, setStorageMessage] = useState(initial.message);
  const [storageError, setStorageError] = useState(initial.failed);
  const [result, setResult] = useState<{ title: string; text: string; hasExcerpt: boolean } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const active = useRef(true);
  const pending = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);
  const errors = validateDraft(draft);
  const valid = Object.keys(errors).length === 0;

  function update(key: keyof Draft, value: string) {
    setDraft(current => ({ ...current, [key]: value }));
    setResult(null);
    setError("");
    setStorageError(false);
    setStorageMessage("内容已修改，尚未保存。");
  }

  function save() {
    if (!valid) return;
    try {
      context.storage.set(STORAGE_KEY, { version: 1, ...draft });
      setStorageError(false);
      setStorageMessage("草稿已保存到当前浏览器。");
    } catch {
      setStorageError(true);
      setStorageMessage("保存失败，输入仍保留在页面中。请检查浏览器存储空间或设置后重试。");
    }
  }

  async function analyze() {
    if (!valid || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const text = await context.invokeAI(buildMessages(draft));
      if (!text.trim()) throw new Error("AI 未返回内容，请重试。");
      if (active.current) setResult({ title: draft.title.trim(), text, hasExcerpt: Boolean(draft.excerpt.trim()) });
    } catch (cause) {
      if (active.current) setError(cause instanceof Error ? cause.message : "暂时无法获取建议，请稍后重试。");
    } finally {
      pending.current = false;
      if (active.current) setBusy(false);
    }
  }

  return <div className="reading-view stack">
    <header>
      <p className="eyebrow">知行 · 阅读罗盘</p>
      <h2>把时间留给值得的知识</h2>
      <p className="muted">从一个想弄懂的问题出发，找到适合自己的阅读方式。</p>
    </header>
    <div className="reading-layout">
      <form className="stack" noValidate onSubmit={event => { event.preventDefault(); void analyze(); }}>
        <h3>这次，想读什么？</h3>
        {fields.map(field => <label className="field-label" key={field.key} htmlFor={`${id}-${field.key}`}>
          <span>{field.label}</span>
          {field.key === "title" ? <input
            className="field" id={`${id}-${field.key}`} value={draft[field.key]}
            maxLength={field.max} required disabled={busy} placeholder={field.placeholder}
            aria-invalid={Boolean(errors[field.key])} aria-describedby={`${id}-${field.key}-hint`}
            onChange={event => update(field.key, event.target.value)}
          /> : <textarea
            className="field" id={`${id}-${field.key}`} value={draft[field.key]}
            rows={field.key === "excerpt" ? 5 : 3} maxLength={field.max} disabled={busy}
            placeholder={field.placeholder} aria-invalid={Boolean(errors[field.key])}
            aria-describedby={`${id}-${field.key}-hint`} onChange={event => update(field.key, event.target.value)}
          />}
          <small id={`${id}-${field.key}-hint`} className={errors[field.key] ? "reading-error" : "muted"}>
            {errors[field.key] || field.hint} · {draft[field.key].length}/{field.max}
          </small>
        </label>)}
        <p className="notice" id={`${id}-privacy`}>点击分析会将以上书名、目标、个人评价与摘录发送给 AI 服务。请仅填写愿意发送的内容；首次调用还需平台授权。</p>
        <div className="row">
          <button className="btn" type="submit" disabled={!valid || busy}
            aria-describedby={`${id}-privacy`}>{busy ? "正在分析…" : "分析阅读价值"}</button>
          <button className="btn secondary" type="button" disabled={!valid || busy} onClick={save}>保存本机草稿</button>
        </div>
        <p className={`notice${storageError ? " error" : ""}`}
          role={storageError ? "alert" : "status"}>{storageMessage}</p>
        <small className="muted">仅保留一份本机草稿，不自动保存、不跨设备同步；AI 结果仅在本次页面显示。</small>
        <button className="ghost reading-clear" type="button" disabled={busy} onClick={() => {
          try {
            context.storage.remove(STORAGE_KEY);
            setDraft({ ...EMPTY_DRAFT });
            setResult(null);
            setError("");
            setStorageError(false);
            setStorageMessage("已清空输入及本机草稿。");
          } catch {
            setStorageError(true);
            setStorageMessage("清除失败，草稿与输入仍保留。请检查浏览器存储设置后重试。");
          }
        }}>清空输入与本机草稿</button>
      </form>
      <section className="card stack reading-result" aria-labelledby={`${id}-result`} aria-busy={busy}>
        <div><p className="eyebrow">阅读之前，先找方向</p><h3 id={`${id}-result`}>你的阅读参考</h3></div>
        <div aria-live="polite">
          {busy && <p className="notice" role="status">正在结合你的输入整理建议，请稍候…</p>}
          {!busy && !result && !error && <div className="reading-empty">
            <span aria-hidden="true">📖</span>
            <h4>先留下你的问题</h4>
            <p className="muted">填写书名或文章名即可开始。补充目标与个人评价，能让建议更贴近你。</p>
            <p className="muted">你会得到阅读价值、适合读者，以及全文、逐章、逐节阅读和 AI 总结之间的取舍建议。</p>
          </div>}
          {result && <div className="stack">
            <h4>《{result.title}》</h4>
            <p className="notice">{result.hasExcerpt
              ? "仅提供了摘录：建议不代表对完整原文的核验，不能据此推断整本书的章节。"
              : "未提供原文：AI 无法核实本次作品内容，以下仅作待核实的阅读参考，不代表真实目录或章节解析。"}</p>
            <div className="reading-response">{result.text}</div>
            <small className="muted">AI 建议可能存在偏差。请结合原文和自己的判断决定如何阅读。</small>
          </div>}
        </div>
        {error && <div className="stack">
          <p className="notice error" role="alert">分析未完成：{error}</p>
          <button className="btn secondary" type="button" disabled={busy || !valid}
            onClick={() => void analyze()}>重试分析</button>
        </div>}
      </section>
    </div>
    <section className="stack" aria-labelledby={`${id}-modes`}>
      <div><h3 id={`${id}-modes`}>阅读没有唯一的路线</h3><p className="muted">以下是通用方法，不是针对当前作品的分析。由你决定投入多少时间。</p></div>
      <div className="reading-modes">
        {[
          ["全文阅读", "适合重视完整论证或叙事体验时，保留作者铺陈的上下文。"],
          ["逐章阅读", "有真实目录时，按问题选择章节；注意章节之间的依赖。"],
          ["逐节精读", "针对关键概念和难点反复阅读，并回看前后文。"],
          ["AI 辅助总结", "用于建立初步印象与整理问题；关键结论仍需回到原文核对。"],
        ].map(([title, text]) => <article className="card stack" key={title}><h4>{title}</h4><p
          className="muted">{text}</p></article>)}
      </div>
    </section>
  </div>;
}

export const plugin: ZaituPlugin = {
  id: "zaitu.reading", name: "知行", tagline: "把时间留给值得的知识",
  description: "选择书籍，思考阅读方式和投入价值。", icon: "📚",
  category: "growth", accent: "#b6a189", permissions: ["ai.invoke"], Component: View,
};
