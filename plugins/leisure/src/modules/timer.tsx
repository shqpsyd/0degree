import { useEffect, useRef, useState } from "react";
import { remainingSeconds } from "../model";

export function BreakTimer() {
  const [duration, setDuration] = useState(120);
  const [remaining, setRemaining] = useState(120);
  const [running, setRunning] = useState(false);
  const deadline = useRef(0);

  useEffect(() => {
    if (!running) return;
    const tick = () => {
      const seconds = remainingSeconds(deadline.current, Date.now());
      setRemaining(seconds);
      if (seconds === 0) setRunning(false);
    };
    const interval = window.setInterval(tick, 250);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [running]);

  function reset(seconds = duration) {
    setRunning(false);
    setRemaining(seconds);
  }

  return <div className="stack">
    <div className="row" role="group" aria-label="休息时长">
      {[60, 120, 300].map(seconds => <button key={seconds} type="button"
        className={`btn${duration === seconds ? "" : " secondary"}`} aria-pressed={duration === seconds}
        onClick={() => { setDuration(seconds); reset(seconds); }}>{seconds / 60} 分钟</button>)}
    </div>
    <p className="leisure-clock" role="timer" aria-label="剩余休息时间">
      {String(Math.floor(remaining / 60)).padStart(2, "0")}:{String(remaining % 60).padStart(2, "0")}
    </p>
    <progress className="leisure-progress" max={duration} value={duration - remaining} aria-label="休息进度" />
    <p className="notice" role="status">{remaining === 0 ? "休息时间到了。带着一点轻松，按自己的节奏继续吧。"
      : running ? "正在休息，暂时放下手里的忙碌。"
      : remaining < duration ? "计时已暂停，准备好后再继续。" : "准备好了就开始，不必急着做什么。"}</p>
    <div className="row">
      <button type="button" className="btn" disabled={remaining === 0} onClick={() => {
        if (running) {
          setRemaining(remainingSeconds(deadline.current, Date.now()));
          setRunning(false);
        } else {
          deadline.current = Date.now() + remaining * 1000;
          setRunning(true);
        }
      }}>{running ? "暂停" : remaining < duration && remaining > 0 ? "继续休息" : "开始休息"}</button>
      <button type="button" className="btn secondary" onClick={() => reset()}>重新计时</button>
    </div>
    <small className="muted">无声音或系统通知；返回页面时会校准剩余时间。切换工具或离开摸鱼湾会取消计时。</small>
  </div>;
}
