import { useRef, useState } from "react";
import { Button, EmptyState, Modal, Notice } from "@zaitu/design-system";
import { clearEvents, deleteEvent, exportTimeline, importTimeline, MAX_EVENTS } from "@zaitu/core";
import { formatTime, useTimeline } from "../hooks";
import { pluginById } from "../plugins";

export function Timeline() {
  const events = useTimeline();
  const fileInput = useRef<HTMLInputElement>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const run = (fn: () => string) => {
    try {
      setNotice({ tone: "success", text: fn() });
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : String(e) });
    }
  };

  const download = () => {
    const blob = new Blob([JSON.stringify(exportTimeline(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zaitu-timeline-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setNotice({ tone: "success", text: `已导出 ${events.length} 条足迹` });
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    try {
      if (file.size > 5_000_000) throw new Error("导入文件不得超过 5 MB");
      const text = await file.text();
      run(() => {
        const { added, skipped } = importTimeline(JSON.parse(text));
        return `导入完成：新增 ${added} 条，跳过 ${skipped} 条（重复、格式无效或超过容量）`;
      });
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : String(e) });
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  return (
    <>
      <div className="heading">
        <p className="eyebrow">MY JOURNEY</p>
        <h1 tabIndex={-1}>我的足迹</h1>
        <p className="muted">记录只保存在当前浏览器（最多 {MAX_EVENTS} 条），不会自动上传，也不会跨设备同步。换浏览器前请先导出。</p>
      </div>
      <div className="row toolbar">
        <Button variant="secondary" onClick={download} disabled={!events.length}>导出 JSON</Button>
        <Button variant="secondary" onClick={() => fileInput.current?.click()}>导入</Button>
        <input ref={fileInput} type="file" accept="application/json,.json" className="sr-only"
          tabIndex={-1} aria-hidden="true" onChange={(e) => upload(e.target.files?.[0])} />
        <Button variant="danger" onClick={() => setConfirmClear(true)} disabled={!events.length}>清空全部</Button>
      </div>
      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
      <div className="card">
        {events.length ? (
          <ol className="event-list">
            {events.map((e) => (
              <li className="event" key={e.id}>
                <div className="event-head">
                  <span>
                    <b>{pluginById(e.source)?.name ?? e.source}</b> · {e.type} <small
                      className="muted">{formatTime(e.occurredAt)}</small>
                  </span>
                  <Button variant="ghost" aria-label={`删除 ${formatTime(e.occurredAt)} 的记录`}
                    onClick={() => run(() => (deleteEvent(e.id), "已删除一条足迹"))}>删除</Button>
                </div>
                <pre className="event-data">{JSON.stringify(e.data, null, 2)}</pre>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState icon="👣" title="还没有足迹">去记录一下今天吧。</EmptyState>
        )}
      </div>
      <Modal
        open={confirmClear}
        title="清空全部足迹？"
        onClose={() => setConfirmClear(false)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirmClear(false)}>取消</Button>
            <Button variant="danger" onClick={() => {
              run(() => (clearEvents(), "足迹已清空")); setConfirmClear(false);
            }}>清空</Button>
          </>
        }
      >
        <p>将删除本浏览器中的全部 {events.length} 条足迹，无法撤销。建议先导出备份。</p>
      </Modal>
    </>
  );
}
