import { useId, useState } from "react";
import type { PluginContext, ZaituPlugin } from "@zaitu/plugin-sdk";
import { calculate, DEFAULT_PLAN, parseDraft, readPlan, STORAGE_KEY, toDraft } from "./model";
import "./style.css";

const money = (value: number) => `¥${Math.round(value).toLocaleString("zh-CN")}`;
const fields = [
  { key: "monthlyCost", label: "期望每月支出（元）", hint: "按今天的生活成本填写，包含日常与年度支出的月均值。", min: 0, max: 1e9, step: "any" },
  { key: "assets", label: "当前可投资净资产（元）", hint: "填写可用于支持生活支出的净资产，不含自住住房等不可动用资产。", min: 0, max: 1e12, step: "any" },
  { key: "rate", label: "假设初始年度提款率（%）", hint: "首年支出占目标资产的比例；不是年化投资收益率。", min: 0.1, max: 20, step: "any" },
] as const;

function View({ context }: { context: PluginContext }) {
  const id = useId();
  const [initial] = useState(() => readPlan(context.storage));
  const [draft, setDraft] = useState(() => toDraft(initial.plan));
  const [message, setMessage] = useState(initial.message);
  const [failed, setFailed] = useState(false);
  const { plan, errors } = parseDraft(draft);
  const result = plan ? calculate(plan) : null;

  function save() {
    if (!plan) return;
    try {
      context.storage.set(STORAGE_KEY, { version: 1, ...plan });
      setFailed(false);
      setMessage("方案已保存到当前浏览器。");
    } catch {
      setFailed(true);
      setMessage("保存失败，本次参数仍可计算。请检查浏览器存储空间或设置后重试。");
    }
  }

  return (
    <div className="fire-view stack">
      <header>
        <p className="eyebrow">自由航线 · FIRE</p>
        <h2>让自由的目标，清晰一点</h2>
        <p className="muted">从你期待的生活出发，看看支出与提款假设如何影响资产目标。</p>
      </header>
      <div className="fire-layout">
        <form className="stack" noValidate onSubmit={event => { event.preventDefault(); save(); }}>
          <h3>设定你的参数</h3>
          {fields.map(field => (
            <label className="field-label" key={field.key} htmlFor={`${id}-${field.key}`}>
              <span>{field.label}</span>
              <input
                className="field"
                id={`${id}-${field.key}`}
                type="number"
                inputMode="decimal"
                min={field.min}
                max={field.max}
                step={field.step}
                required
                value={draft[field.key]}
                aria-invalid={Boolean(errors[field.key])}
                aria-describedby={`${id}-${field.key}-hint`}
                onChange={event => {
                  setDraft({ ...draft, [field.key]: event.target.value });
                  setFailed(false);
                  setMessage("参数已修改，尚未保存。");
                }}
              />
              <small id={`${id}-${field.key}-hint`} className={errors[field.key] ? "fire-error" : "muted"}>
                {errors[field.key] || field.hint}
              </small>
            </label>
          ))}
          <div className="row">
            <button className="btn" type="submit" disabled={!plan}>保存本机方案</button>
            <button className="btn secondary" type="button" onClick={() => {
              setDraft(toDraft(DEFAULT_PLAN));
              setFailed(false);
              setMessage("已填入示例参数，尚未保存。");
            }}>填入示例</button>
          </div>
          <p className={`notice${failed ? " error" : ""}`} role={failed ? "alert" : "status"}>{message}</p>
          <small className="muted">仅保存一份方案到当前浏览器，不同步到其他设备。清理插件数据将删除已保存方案。</small>
        </form>
        <section className="card fire-summary stack" aria-label="当前计算结果" aria-live="polite">
          <h3>你的资产目标</h3>
          {result && plan ? <>
            <div>
              <p className="muted">按当前假设，目标资产约</p>
              <strong className="fire-total">{money(result.target)}</strong>
            </div>
            <dl className="fire-metrics">
              <div><dt>年度支出</dt><dd>{money(result.annualCost)}</dd></div>
              <div><dt>资产缺口</dt><dd>{money(result.gap)}</dd></div>
              <div><dt>目标覆盖比例</dt><dd>{result.coverage === null ? "不适用"
                : `${result.coverage.toLocaleString("zh-CN", { maximumFractionDigits: 1 })}%`}</dd></div>
            </dl>
            {result.coverage !== null && <progress className="fire-progress" max={100}
              value={Math.min(100, result.coverage)} aria-label="当前资产占目标资产比例" />}
            <p className="muted">{result.target === 0
              ? "月支出为零时，公式目标为零，覆盖比例不适用。这不代表生活没有成本。"
              : result.gap === 0
                ? "当前资产已覆盖本次计算目标，但不代表可以安全退休。"
                : "这是静态资产差额，不包含未来储蓄与收益，也不预测达成时间。"}</p>
          </> : <p className="muted">请修正左侧参数后查看结果；无效输入不会用于计算或保存。</p>}
        </section>
      </div>
      {plan && <section className="stack" aria-labelledby={`${id}-compare`}>
        <div>
          <h3 id={`${id}-compare`}>换个提款假设看看</h3>
          <p className="muted">保持支出与资产不变。提款率越低，计算目标越高；以下仅作参数对照，不代表推荐或安全水平。</p>
        </div>
        <div className="fire-comparison">
          {[3, 4, 5].map(rate => {
            const scenario = calculate({ ...plan, rate });
            return <article className="card stack" key={rate}>
              <h4>{rate}% 提款率 {plan.rate === rate && <span className="pill">当前假设</span>}</h4>
              <div><small className="muted">目标资产</small><p
                className="fire-scenario-value">{money(scenario.target)}</p></div>
              <small className="muted">缺口 {money(scenario.gap)}</small>
              <button className="btn secondary" type="button" disabled={plan.rate === rate} onClick={() => {
                setDraft({ ...draft, rate: String(rate) });
                setFailed(false);
                setMessage(`已采用 ${rate}% 提款假设，尚未保存。`);
              }}>采用 {rate}% 假设</button>
            </article>;
          })}
        </div>
      </section>}
      <section className="fire-explanation stack" aria-labelledby={`${id}-formula`}>
        <h3 id={`${id}-formula`}>理解这次计算</h3>
        <p>目标资产 = 月支出 × 12 ÷（年度提款率 ÷ 100）。例如每月支出 10,000 元、提款率 4%，目标资产为 300 万元。</p>
        <p className="muted">
          计算使用当前购买力，未模拟通胀、税费、投资波动、收益顺序风险、未来收入或退休年限。4% 提款率不等于 4% 年化投资收益，也不保证资产不会耗尽。结果仅用于理解假设，不构成投资建议、退休保障或收益承诺。
        </p>
      </section>
    </div>
  );
}

export const plugin: ZaituPlugin = {
  id: "zaitu.fire",
  name: "自由航线",
  tagline: "规划更自由的人生",
  description: "测算财务独立目标，理解关键假设。",
  icon: "⛵",
  category: "finance",
  accent: "#9caec5",
  permissions: [],
  Component: View,
};
