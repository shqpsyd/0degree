import { useId, useState } from "react";
import type { PluginContext, ZaituPlugin } from "@zaitu/plugin-sdk";
import { calculate, DATA_VERSION, FOODS, parseGrams, readSelection, STORAGE_KEY } from "./model";
import type { Nutrients } from "./model";
import "./style.css";

const format = (value: number) => value.toLocaleString("zh-CN", { maximumFractionDigits: 1 });
const metrics: { key: keyof Nutrients; label: string; unit: string }[] = [
  { key: "energy", label: "能量", unit: "kcal" },
  { key: "protein", label: "蛋白质", unit: "g" },
  { key: "fat", label: "脂肪", unit: "g" },
  { key: "carbohydrate", label: "碳水化合物", unit: "g" },
  { key: "fiber", label: "膳食纤维", unit: "g" },
];
const categories = ["全部", ...new Set(FOODS.map(food => food.category))];

function View({ context }: { context: PluginContext }) {
  const id = useId();
  const [initial] = useState(() => readSelection(context.storage));
  const [foodId, setFoodId] = useState(initial.selection.foodId);
  const [weight, setWeight] = useState(String(initial.selection.grams));
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("全部");
  const [message, setMessage] = useState(initial.message);
  const [failed, setFailed] = useState(false);
  const food = FOODS.find(item => item.id === foodId)!;
  const grams = parseGrams(weight);
  const result = grams === null ? null : calculate(food, grams);
  const filtered = FOODS.filter(item =>
    (category === "全部" || item.category === category) && item.name.includes(query.trim()));

  function markChanged() {
    setFailed(false);
    setMessage("选择已修改，尚未保存。");
  }

  function save() {
    if (grams === null) return;
    try {
      context.storage.set(STORAGE_KEY, { version: 1, foodId, grams });
      setFailed(false);
      setMessage("食物与重量已保存到当前浏览器。");
    } catch {
      setFailed(true);
      setMessage("保存失败，仍可查看换算结果。请检查浏览器存储空间或设置后重试。");
    }
  }

  return (
    <div className="nutrition-view stack">
      <header>
        <p className="eyebrow">生命刻度 · 食物实验室</p>
        <h2>看见食物里的营养</h2>
        <p className="muted">从一种熟悉的食物开始，了解份量与营养构成。这里是示例探索，不是饮食评分。</p>
      </header>
      <div className="nutrition-layout">
        <section className="stack" aria-labelledby={`${id}-foods`}>
          <h3 id={`${id}-foods`}>选择一种食物</h3>
          <label className="field-label" htmlFor={`${id}-search`}>
            <span>搜索食物</span>
            <input id={`${id}-search`} className="field" type="search" placeholder="试试苹果、米饭…" value={query}
              onChange={event => setQuery(event.target.value)} />
          </label>
          <div className="row" role="group" aria-label="食物分类">
            {categories.map(item => <button key={item} type="button"
              className={`btn${category === item ? "" : " secondary"}`}
              aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}
          </div>
          <div className="nutrition-foods" role="group" aria-label="示例食物">
            {filtered.map(item => <button
              key={item.id}
              type="button"
              className="nutrition-food"
              aria-pressed={foodId === item.id}
              onClick={() => { setFoodId(item.id); markChanged(); }}
            >
              <strong>{item.name}</strong>
              <span className="muted">{item.category} · {item.per100g.energy} kcal / 100g</span>
            </button>)}
          </div>
          {filtered.length === 0 && <div className="empty-state">
            <p className="muted">没有匹配的示例食物，当前营养结果仍保留。</p>
            <button className="btn secondary" type="button"
              onClick={() => { setQuery(""); setCategory("全部"); }}>查看全部食物</button>
          </div>}
          <form className="stack nutrition-portion" noValidate onSubmit={event => { event.preventDefault(); save(); }}>
            <label className="field-label" htmlFor={`${id}-grams`}>
              <span>{food.name}的可食部重量（克）</span>
              <input
                id={`${id}-grams`} className="field" type="number" inputMode="decimal"
                min={1} max={2000} step="any" required value={weight}
                aria-invalid={grams === null} aria-describedby={`${id}-weight-hint`}
                onChange={event => { setWeight(event.target.value); markChanged(); }}
              />
              <small id={`${id}-weight-hint`} className={grams === null ? "nutrition-error" : "muted"}>
                {grams === null ? "请输入 1–2000 克之间的有效重量。" : "按上述食物状态称量可食部；不包含果核、蛋壳等不可食部分。"}
              </small>
            </label>
            <div className="row" role="group" aria-label="快捷重量">
              {[50, 100, 200].map(value => <button className="btn secondary" type="button" key={value}
                aria-pressed={grams === value}
                onClick={() => { setWeight(String(value)); markChanged(); }}>{value} 克</button>)}
            </div>
            <button className="btn" type="submit" disabled={grams === null}>保存本机选择</button>
            <p className={`notice${failed ? " error" : ""}`} role={failed ? "alert" : "status"}>{message}</p>
            <small className="muted">仅保存一份食物与重量，不记录摄入历史，不跨设备同步。清理插件数据会删除已保存的选择。</small>
          </form>
        </section>
        <section className="card nutrition-summary stack" aria-labelledby={`${id}-result`}>
          <div>
            <div className="row"><h3 id={`${id}-result`}>{food.name}</h3><span className="pill">示例数据</span></div>
            <p className="muted">{food.preparation}</p>
          </div>
          <div aria-live="polite" aria-atomic="true">
            {result ? <>
              <p className="muted">{format(grams!)} 克可食部 · 换算能量约</p>
              <p className="nutrition-total">{format(result.energy)} <span>kcal</span></p>
            </> : <p className="notice">请修正重量后查看换算结果。</p>}
          </div>
          <div className="nutrition-table-wrap">
            <table className="nutrition-table">
              <caption>营养构成对照（示例值）</caption>
              <thead><tr><th scope="col">营养项</th><th scope="col">每 100 克</th><th scope="col">当前份量</th></tr></thead>
              <tbody>{metrics.map(metric => <tr key={metric.key}>
                <th scope="row">{metric.label}</th>
                <td>{format(food.per100g[metric.key])} {metric.unit}</td>
                <td>{result ? `${format(result[metric.key])} ${metric.unit}` : "—"}</td>
              </tr>)}</tbody>
            </table>
          </div>
          <p className="muted">换算值 = 每 100 克数值 × 重量 ÷ 100，显示时保留最多一位小数。膳食纤维不应与碳水化合物简单相加；本表不代表食物的全部成分。</p>
          <div className="nutrition-source stack">
            <h4>这些数值从哪里来？</h4>
            <p>来源：项目内置演示数据（{DATA_VERSION}）。尚未接入或逐项核验权威食物成分数据库，不是特定品牌标签或检测报告。</p>
            <p className="muted">本页所有食物均适用此来源说明。品种、加工方式与含水量会影响数值；实际记录请参考对应产品标签或可信食物成分资料。</p>
          </div>
        </section>
      </div>
      <section className="nutrition-explanation stack" aria-labelledby={`${id}-about`}>
        <h3 id={`${id}-about`}>理解营养，也保留一点余地</h3>
        <p className="muted">单一食物不能代表整体饮食质量。营养需求取决于整体饮食、活动与个体情况；这里不提供医疗建议，也不会把一餐换算成真实寿命的增减。</p>
      </section>
    </div>
  );
}

export const plugin: ZaituPlugin = {
  id: "zaitu.nutrition",
  name: "生命刻度",
  tagline: "看见食物里的营养",
  description: "探索常见食物的示例营养构成、份量换算与数据来源。",
  icon: "🍎",
  category: "health",
  accent: "#e1a886",
  permissions: [],
  Component: View,
};
