import { useCallback, useEffect, useId, useState, type FormEvent } from "react";
import type { ZaituPlugin, PluginContext, LifeEvent } from "@zaitu/plugin-sdk";
import { WEATHER, dailyEntries, dayKey, monthDays, streak } from "./model";
import "./style.css";

function View({ context }: { context: PluginContext }) {
  const id = useId();
  const [now, setNow] = useState(() => new Date());
  const today = dayKey(now);
  const [history, setHistory] = useState<{ events: LifeEvent[]; failed: boolean }>(() => {
    try { return { events: context.readTimeline(), failed: false }; }
    catch { return { events: [], failed: true }; }
  });
  const entries = dailyEntries(history.events);
  const [mood, setMood] = useState(() => entries.get(today)?.mood ?? 0);
  const [note, setNote] = useState(() => entries.get(today)?.note ?? "");
  const [editingDay, setEditingDay] = useState(today);
  const [baseline, setBaseline] = useState(() => ({
    mood: entries.get(today)?.mood ?? 0, note: entries.get(today)?.note ?? "",
  }));
  const dirty = mood !== baseline.mood || note !== baseline.note;
  const crossedDay = editingDay !== today;
  const [month, setMonth] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const [selected, setSelected] = useState(today);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const loadToday = useCallback((time: Date) => {
    try {
      const events = context.readTimeline();
      const day = dayKey(time);
      const entry = dailyEntries(events).get(day);
      const value = { mood: entry?.mood ?? 0, note: entry?.note ?? "" };
      setHistory({ events, failed: false });
      setMood(value.mood);
      setNote(value.note);
      setBaseline(value);
      setEditingDay(day);
      setSelected(day);
      setMonth(new Date(time.getFullYear(), time.getMonth(), 1));
      setMessage("");
      setFailed(false);
    } catch {
      setHistory(previous => ({ ...previous, failed: true }));
      setFailed(true);
      setMessage("今天的记录读取失败，原内容仍保留。请重试加载今天。");
    }
  }, [context]);
  useEffect(() => {
    if (crossedDay && !dirty) loadToday(new Date());
  }, [today, crossedDay, dirty, loadToday]);

  const savedToday = entries.get(editingDay);
  const unchanged = !crossedDay && savedToday?.mood === mood && savedToday.note === note.trim();
  const monthKey = dayKey(month).slice(0, 7);
  const monthly = [...entries.values()].filter(entry => entry.day.startsWith(monthKey));
  const counts = WEATHER.map((_, index) => monthly.filter(entry => entry.mood === index).length);
  const selectedEntry = entries.get(selected);
  const edit = () => { setMessage(""); setFailed(false); };

  function save(event: FormEvent) {
    event.preventDefault();
    const time = new Date();
    setNow(time);
    if (dayKey(time) !== editingDay) {
      if (!dirty) loadToday(time);
      return;
    }
    if (unchanged) return;
    try {
      context.publish({ type: "mood.logged", data: { mood: WEATHER[mood].label, note: note.trim() } });
    } catch (cause) {
      setFailed(true);
      const reason = cause instanceof Error ? cause.message : "请检查浏览器存储空间或设置后重试。";
      setMessage(`保存失败，内容仍保留在这里。${reason}`);
      return;
    }
    setNow(time);
    setNote(note.trim());
    setBaseline({ mood, note: note.trim() });
    setFailed(false);
    setMessage("已记录在本机的旅途足迹里。");
    // 写入成功后的读取失败不能提示“保存失败”，避免用户误重复提交。
    try { setHistory({ events: context.readTimeline(), failed: false }); }
    catch { setHistory(previous => ({ ...previous, failed: true })); }
    setSelected(dayKey(time));
    setMonth(new Date(time.getFullYear(), time.getMonth(), 1));
  }

  function changeMonth(offset: number) {
    const next = new Date(month.getFullYear(), month.getMonth() + offset, 1);
    setMonth(next);
    setSelected(dayKey(next));
  }

  return <div className="mood-view stack">
    <header>
      <p className="eyebrow">心晴 · 给心情留一页</p>
      <h2>今天的心情是什么天气？</h2>
      <p className="muted">晴雨都有自己的节奏。记下此刻，不必给情绪打分。</p>
    </header>
    <div className="mood-layout">
      <form className="stack" onSubmit={save}>
        <div className="row mood-heading">
          <h3>{crossedDay ? "待处理的天气" : "今日天气"}</h3>
          <time className="muted" dateTime={editingDay}>{editingDay}</time>
        </div>
        {crossedDay && <div className="notice" role="alert">
          <p>日期已变更为 {today}。当前内容属于 {editingDay}，不会自动保存到今天。</p>
          <p>保留草稿可继续编辑；转为今天后仍需手动保存，保存会更新今天的记录。</p>
          <div className="row">
            <button className="btn secondary" type="button" onClick={() => {
              const time = new Date();
              setNow(time);
              setEditingDay(dayKey(time));
              edit();
            }}>将草稿转为今天</button>
            <button className="btn secondary" type="button" onClick={() => {
              const time = new Date();
              setNow(time);
              loadToday(time);
            }}>{dirty ? "放弃草稿并加载今天" : "重试加载今天"}</button>
          </div>
        </div>}
        <fieldset className="mood-picker">
          <legend className="sr-only">选择今天的情绪天气</legend>
          <div className="mood-options">
            {WEATHER.map((weather, index) => <label
              className={`mood-option ${mood === index ? "is-selected" : ""}`} key={weather.id}>
              <input type="radio" name={`${id}-weather`} value={weather.id} checked={mood === index}
                onChange={() => { setMood(index); edit(); }} />
              <span aria-hidden="true" className="mood-icon">{weather.icon}</span>
              <span>{weather.label}</span>
            </label>)}
          </div>
        </fieldset>
        <label className="field-label" htmlFor={`${id}-note`}>今日复盘 <span className="muted">可选，一句话也很好。</span></label>
        <textarea id={`${id}-note`} className="field mood-note" rows={5} maxLength={2000} value={note}
          onChange={event => { setNote(event.target.value); edit(); }}
          placeholder="今天发生了什么？有什么想对自己说？" aria-describedby={`${id}-hint`} />
        <p id={`${id}-hint`} className="muted mood-hint">
          {note.length}/2000 字。同一天可以再次记录，月历和统计采用当天最后一次天气，足迹保留每次记录。
        </p>
        <div className="row"><button className="btn" type="submit" disabled={unchanged || crossedDay}>
          {crossedDay ? "请先处理跨日内容" : unchanged ? "今天的天气已保存"
            : savedToday ? "更新今天的天气" : "保存今天的天气"}
        </button></div>
        {message && <p className={`notice ${failed ? "error" : ""}`} role={failed ? "alert" : "status"}>{message}</p>}
        <p className="muted mood-hint">仅保存在当前浏览器，不会上传或同步。复盘内容会随足迹导出，请妥善保管导出文件。</p>
      </form>
      <section className="mood-summary stack" aria-label="记录概览">
        <span className="mood-hero-icon" aria-hidden="true">{WEATHER[mood].icon}</span>
        <h3>每一种天气，都值得被看见</h3>
        <p className="muted">留一点时间给自己，慢慢看见生活里的变化。</p>
        {!history.failed && <div className="mood-metrics">
          <div><strong>{entries.size}</strong><span>已记录天数</span></div>
          <div><strong>{streak(entries, now)}</strong><span>连续记录天数</span></div>
        </div>}
        <p className="muted mood-hint">连续记录从今天或昨天向前计算；今天还没写，也不急。</p>
      </section>
    </div>
    {history.failed ? <div className="notice error" role="alert">
      历史记录读取失败，月历和统计暂不可用。
      <button className="btn secondary" type="button" onClick={() => {
        try { setHistory({ events: context.readTimeline(), failed: false }); }
        catch { /* 保留可重试的错误状态。 */ }
      }}>重新读取</button>
    </div> : <section className="mood-history stack" aria-label="天气日历与统计">
      <div className="row mood-heading">
        <h3>天气日历</h3>
        <div className="row">
          <button className="ghost" type="button" aria-label="上个月" onClick={() => changeMonth(-1)}>←</button>
          <span aria-live="polite">{month.getFullYear()} 年 {month.getMonth() + 1} 月</span>
          <button className="ghost" type="button" aria-label="下个月" disabled={monthKey >= today.slice(0, 7)}
            onClick={() => changeMonth(1)}>→</button>
        </div>
      </div>
      <div className="mood-layout">
        <div className="stack">
          <div className="mood-calendar" role="group"
            aria-label={`${month.getFullYear()} 年 ${month.getMonth() + 1} 月记录`}>
            {["一", "二", "三", "四", "五", "六", "日"].map(day =>
              <span className="mood-weekday" key={day} aria-hidden="true">{day}</span>)}
            {monthDays(month).map((day, index) => {
              if (!day) return <span key={`blank-${index}`} />;
              const entry = entries.get(day);
              return <button type="button" key={day}
                className={`mood-day ${selected === day ? "is-selected" : ""}`} disabled={day > today}
                aria-pressed={selected === day} aria-current={day === today ? "date" : undefined}
                aria-label={`${day}，${entry ? WEATHER[entry.mood].label : "未记录"}`} onClick={() => setSelected(day)}>
                <span>{Number(day.slice(-2))}</span>
                <span aria-hidden="true">{entry ? WEATHER[entry.mood].icon : "·"}</span>
              </button>;
            })}
          </div>
          <div className="mood-entry" aria-live="polite">
            <h4>{selected} {selectedEntry ? WEATHER[selectedEntry.mood].label : "未记录"}</h4>
            <p>{selectedEntry ? selectedEntry.note || "这一天只记下了天气，没有留下文字。" : "这一天还没有天气记录。"}</p>
          </div>
        </div>
        <section className="stack" aria-label="所选月份天气分布">
          <h3>本月天气分布 <span className="muted">· {monthly.length} 天</span></h3>
          {monthly.length === 0 ? <p className="muted">这个月还没有记录。写下今天的天气，让日历慢慢丰富起来。</p>
            : <ul className="mood-distribution">
            {WEATHER.map((weather, index) => <li key={weather.id}>
              <div className="row mood-heading">
                <span>{weather.icon} {weather.label}</span><span>{counts[index]} 天</span>
              </div>
              <div className="mood-bar" aria-hidden="true">
                <span style={{ width: `${counts[index] / monthly.length * 100}%` }} />
              </div>
            </li>)}
          </ul>}
          <p className="muted mood-hint">按本地日期、每天最后一次记录统计，不代表心理健康评估。统计仅覆盖仍保留的足迹；平台最多保留最近 500 条足迹。</p>
        </section>
      </div>
    </section>}
  </div>;
}

export const plugin: ZaituPlugin = {
  id: "zaitu.mood", name: "心晴", tagline: "把情绪记成天气",
  description: "七种天气记录心情，用日历和分布回看生活里的变化。",
  icon: "🌤️", category: "health", accent: "#8daec3",
  permissions: ["timeline.write", "timeline.read"], Component: View,
};
