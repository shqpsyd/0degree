import { useEffect, useId, useRef, useState } from "react";
import type { PluginContext, ZaituPlugin } from "@zaitu/plugin-sdk";
import { buildMessages, parsePlan, type Preferences, type MealPlan } from "./model";
import "./style.css";

const emptyPreferences: Preferences = { preference: "", restrictions: "", time: "30 分钟以内" };
const meals = [["breakfast", "早餐", "01"], ["lunch", "午餐", "02"], ["dinner", "晚餐", "03"]] as const;

function View({ context }: { context: PluginContext }) {
  const id = useId();
  const [draft, setDraft] = useState(emptyPreferences);
  const [result, setResult] = useState<{ plan: MealPlan; input: Preferences } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const active = useRef(false);
  const pending = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);
  const valid = draft.preference.trim().length > 0
    && draft.preference.length <= 1500 && draft.restrictions.length <= 500;
  const changed = result && JSON.stringify(result.input) !== JSON.stringify(draft);

  async function generate() {
    if (!valid || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    const input = { ...draft };
    try {
      const plan = parsePlan(await context.invokeAI(buildMessages(input)));
      if (active.current) setResult({ plan, input });
    } catch (cause) {
      if (active.current) setError(cause instanceof Error ? cause.message : "暂时无法生成建议，请稍后重试。");
    } finally {
      pending.current = false;
      if (active.current) setBusy(false);
    }
  }

  return <div className="meal-view stack">
    <header>
      <p className="eyebrow">食光 · 每日三餐</p>
      <h2>好好吃饭，也好好生活</h2>
      <p className="muted">从喜欢的口味出发，为今天留一点好好吃饭的时间。</p>
    </header>
    <div className="meal-layout">
      <form className="stack" onSubmit={event => { event.preventDefault(); void generate(); }}>
        <h3>今天想怎么吃？</h3>
        <fieldset className="meal-fields stack" disabled={busy}>
          <legend className="sr-only">饮食偏好与限制</legend>
          <label className="field-label" htmlFor={`${id}-preference`}>
            <span>口味与食材偏好（必填）</span>
            <textarea className="field" id={`${id}-preference`} rows={4} maxLength={1500} required
              placeholder="比如：喜欢清淡的家常菜，家里有鸡蛋、番茄和米饭。"
              aria-describedby={`${id}-preference-hint`}
              value={draft.preference} onChange={event => setDraft({ ...draft, preference: event.target.value })} />
            <small className="muted" id={`${id}-preference-hint`}>可以写喜欢的食材、就餐人数或预算。最多 1500 字。</small>
          </label>
          <label className="field-label" htmlFor={`${id}-restrictions`}>
            <span>忌口与过敏食材（选填）</span>
            <textarea className="field" id={`${id}-restrictions`} rows={2} maxLength={500}
              placeholder="比如：不吃辣，对花生过敏。"
              aria-describedby={`${id}-restrictions-hint`}
              value={draft.restrictions} onChange={event => setDraft({ ...draft, restrictions: event.target.value })} />
            <small className="muted" id={`${id}-restrictions-hint`}>只填写愿意发送给 AI 的信息，最多 500 字。</small>
          </label>
          <label className="field-label" htmlFor={`${id}-time`}>
            <span>每餐可用的准备时间</span>
            <select className="field" id={`${id}-time`} value={draft.time}
              onChange={event => setDraft({ ...draft, time: event.target.value })}>
              <option>15 分钟以内</option><option>30 分钟以内</option><option>60 分钟以内</option><option>不限时间</option>
            </select>
          </label>
          <button className="btn secondary" type="button" onClick={() => {
            setDraft({ preference: "一人食，喜欢清淡家常菜，家里有鸡蛋、番茄、青菜和米饭。", restrictions: "", time: "30 分钟以内" });
            setError("");
          }}>填入示例</button>
        </fieldset>
        <p className="notice" id={`${id}-privacy`}>点击生成后，以上偏好、忌口和准备时间将经平台网关发送给 AI 服务商。首次使用需要授权，可在插件中心撤销。</p>
        <button className="btn" type="submit" disabled={!valid || busy} aria-describedby={`${id}-privacy`}>
          {busy ? "正在安排三餐…" : error ? "重试生成" : result ? "重新生成今日食谱" : "生成今日食谱"}
        </button>
        {error && <p className="notice error" role="alert">{error}{result ? " 上次成功的计划仍保留在右侧。" : ""}</p>}
        <small className="muted">偏好与结果仅保留在本次页面中，离开或刷新后清空。</small>
      </form>
      <section className="meal-plan stack" aria-labelledby={`${id}-plan`} aria-busy={busy}>
        <div className="row meal-plan-heading">
          <h3 id={`${id}-plan`}>今日三餐建议</h3>
          <span className="pill">AI 灵感 · 自由调整</span>
        </div>
        <p className="muted" role="status">{busy ? "正在根据你的偏好生成建议，请稍候。"
          : changed ? "偏好已修改，以下仍是上次生成的计划。"
          : result ? "三餐建议已生成，可以按实际情况调整。" : "填好左侧偏好，让今天的三餐有个着落。"}</p>
        {result ? <>
          {meals.map(([key, label, number]) => <article className="card meal-card stack" key={key}>
            <div className="row"><span className="meal-number" aria-hidden="true">{number}</span><h4>{label}</h4></div>
            <h5 className="meal-dish">{result.plan[key].name}</h5>
            <p className="meal-copy">{result.plan[key].description}</p>
            <div className="meal-alternative"><span className="pill">换个选择</span><p
              className="meal-copy">{result.plan[key].alternative}</p></div>
          </article>)}
          <div className="notice stack"><h4>给今天的小建议</h4><p className="meal-copy">{result.plan.tip}</p></div>
        </> : <div className="card empty-state meal-empty">
          <span aria-hidden="true">🥗</span>
          <h4>一日三餐，慢慢安排</h4>
          <p className="muted">早餐、午餐、晚餐与可替换选项会出现在这里。</p>
          <div className="row meal-preview" aria-hidden="true"><span className="pill">早餐</span><span
            className="pill">午餐</span><span className="pill">晚餐</span></div>
        </div>}
      </section>
    </div>
    <footer className="meal-footer muted">
      AI 建议仅作日常饮食参考，不构成医疗或营养处方，也不预测寿命或健康效果。食用前请自行核对过敏原、配料与交叉接触风险；有特殊饮食需求时请咨询专业人士。
    </footer>
  </div>;
}

export const plugin: ZaituPlugin = {
  id: "zaitu.meal", name: "食光", tagline: "好好吃饭，也好好生活",
  description: "记录口味，生成适合当下的一日三餐建议。", icon: "🥗",
  category: "health", accent: "#9dbb86", permissions: ["ai.invoke"], Component: View,
};
