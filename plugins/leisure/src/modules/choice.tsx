import { useId, useState } from "react";
import { parseOptions, pickNext } from "../model";

export function Choice() {
  const id = useId();
  const [input, setInput] = useState("");
  const [result, setResult] = useState("");
  const options = parseOptions(input);
  const error = options.length > 12 ? "最多填写 12 个不同选项。"
    : options.some(option => option.length > 40) ? "每个选项最多 40 个字符。" : "";
  return <form className="stack" onSubmit={event => {
    event.preventDefault();
    if (!error && options.length >= 2) setResult(pickNext(options, result));
  }}>
    <label className="field-label" htmlFor={id}>
      <span>写下你的备选项，每行一个</span>
      <textarea id={id} className="field leisure-options" rows={4} maxLength={1000}
        placeholder={"散步\n听一首歌\n看一会儿天空"} value={input}
        aria-invalid={Boolean(error)} aria-describedby={`${id}-hint`}
        onChange={event => { setInput(event.target.value); setResult(""); }} />
    </label>
    <small id={`${id}-hint`} className={error ? "leisure-error" : "muted"}>
      {error || `已填写 ${options.length} 个不同选项；需要 2–12 个，每个最多 40 字。空行和重复项会自动忽略。`}
    </small>
    <div><button className="btn" type="submit"
      disabled={Boolean(error) || options.length < 2}>{result ? "再选一次" : "帮我选一个"}</button></div>
    <p className="notice leisure-result" role="status">{result ? `这次不妨试试：${result}` : "还没有抽签结果。填好选项后，看看这次会遇见什么。"}</p>
    <small className="muted">只用于日常小选择，最终决定仍由你来做。再次抽取会避开上一次的结果。</small>
  </form>;
}
