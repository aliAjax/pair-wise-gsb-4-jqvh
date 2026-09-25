import { useState } from 'react';
import { Check, Flag, Mic, Play, RotateCcw, Trash2, Undo2 } from 'lucide-react';
import type { HandoffState, PendingItem, Recording, Script } from '../types';
import { orderedLines } from '../lib/script';
import { formatDuration, formatTime } from '../lib/handoff';

type Props = {
  pending: PendingItem[];
  setPending: (p: PendingItem[]) => void;
  recordings: Recording[];
  setRecordings: (r: Recording[]) => void;
  script: Script;
  setScript: (s: Script) => void;
  handoff: HandoffState;
  setHandoff: (h: HandoffState) => void;
  notify: (msg: string) => void;
};

const reasonLabel = {
  reordered: '顺序调整',
  removed: '台词移除',
  reassigned: '角色改派',
} as const;

export default function PendingPage({ pending, setPending, recordings, setRecordings, script, setScript, handoff, setHandoff, notify }: Props) {
  const [confirmId, setConfirmId] = useState<number | 'all' | null>(null);

  const close = (item: PendingItem) => setPending(pending.filter((p) => p.id !== item.id));

  /** 确认接回：录音重新关联到台词（同一台词已重录时以本条为最新） */
  const reattach = (item: PendingItem) => {
    const line = script.lines.find((l) => l.id === item.lineSnapshot.id);
    if (!line) {
      notify('原台词已不在剧本中，请先恢复台词');
      return;
    }
    setRecordings([...recordings.filter((r) => r.lineId !== line.id), { ...item.recording, lineId: line.id }]);
    close(item);
    notify('录音已接回，台词恢复为已录状态');
  };

  /** 恢复被移除的台词到原位置（按快照的 order 插入），并接回录音 */
  const restoreLine = (item: PendingItem) => {
    if (script.lines.some((l) => l.id === item.lineSnapshot.id)) {
      reattach(item);
      return;
    }
    const restored = { ...item.lineSnapshot };
    const lines = [...script.lines, restored].sort((a, b) => a.order - b.order).map((l, i) => ({ ...l, order: i }));
    setScript({ ...script, lines });
    setRecordings([...recordings, { ...item.recording, lineId: restored.id }]);
    close(item);
    notify('台词已恢复到原位置，录音一并接回');
  };

  /** 确认前不能丢：丢弃单条需要二次确认 */
  const discard = (item: PendingItem) => {
    close(item);
    setConfirmId(null);
    notify('已丢弃该录音');
  };

  const discardAll = () => {
    setPending([]);
    setConfirmId(null);
    notify(`${pending.length} 条待重排录音已全部丢弃`);
  };

  const resetRehearsal = () => {
    setRecordings([]);
    setHandoff({ ...handoff, currentLineId: orderedLines(script)[0]?.id ?? null });
    notify('已清空全部录音，从第一句重新排练');
  };

  const sorted = orderedLines(script);
  const recordedCount = sorted.filter((l) => recordings.some((r) => r.lineId === l.id)).length;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">HANDOFF</p>
          <h1>排练交接</h1>
          <p className="page-sub">导演改顺序、移除台词或改派角色后，相关录音在这里等待确认：接回、恢复或丢弃，没确认前不会丢。</p>
        </div>
        {pending.length > 0 && (
          <button className="secondary danger" onClick={() => setConfirmId('all')}>
            <Trash2 size={15} /> 全部丢弃
          </button>
        )}
      </header>

      <div className="content-grid pending-grid">
        <section className="card">
          <div className="section-head">
            <div>
              <h2>待重排录音（{pending.length}）</h2>
              <p>逐条确认处理，未确认的录音不受任何剧本改动影响</p>
            </div>
          </div>
          <div className="pending-list">
            {pending.map((item) => {
              const lineExists = script.lines.some((l) => l.id === item.lineSnapshot.id);
              return (
                <div key={item.id} className="pending-item">
                  <div className="pending-top">
                    <span className={`reason-tag ${item.reason}`}>{reasonLabel[item.reason]}</span>
                    <span className="pending-snapshot">第 {item.lineSnapshot.order + 1} 句 · {item.lineSnapshot.character}</span>
                    <span className="pending-time">{formatTime(item.createdAt)}</span>
                  </div>
                  <p className="pending-text">{item.lineSnapshot.text}</p>
                  <div className="pending-rec">
                    <span className="pending-rec-icon"><Mic size={13} /></span>
                    <span>{item.recording.recordedBy} · {formatDuration(item.recording.seconds)}</span>
                    <button className="mini-btn" title="试听（模拟）"><Play size={12} /></button>
                  </div>
                  <div className="pending-actions">
                    {lineExists ? (
                      <button className="primary small" onClick={() => reattach(item)}>
                        <Undo2 size={14} /> 接回这句
                      </button>
                    ) : (
                      <button className="primary small" onClick={() => restoreLine(item)}>
                        <Undo2 size={14} /> 恢复台词并接回
                      </button>
                    )}
                    {confirmId === item.id ? (
                      <span className="confirm-inline">
                        确认丢弃？
                        <button className="mini-btn danger-text" onClick={() => discard(item)}>确认</button>
                        <button className="mini-btn" onClick={() => setConfirmId(null)}>取消</button>
                      </span>
                    ) : (
                      <button className="secondary small" onClick={() => setConfirmId(item.id)}>
                        <Trash2 size={14} /> 丢弃
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {pending.length === 0 && (
              <div className="empty">
                <Check size={18} /> 没有待重排录音。导演改动已录台词时，旧录音会自动收集到这里。
              </div>
            )}
          </div>
          {confirmId === 'all' && (
            <div className="confirm-bar">
              <Flag size={15} />
              <span>将丢弃全部 {pending.length} 条待重排录音，此操作不可恢复。</span>
              <button className="mini-btn danger-text" onClick={discardAll}>全部丢弃</button>
              <button className="mini-btn" onClick={() => setConfirmId(null)}>取消</button>
            </div>
          )}
        </section>

        <section className="card">
          <div className="section-head">
            <div>
              <h2>本轮录音进度</h2>
              <p>{recordedCount} / {sorted.length} 句已录</p>
            </div>
            <button className="ghost" onClick={resetRehearsal} title="清空录音从头再来">
              <RotateCcw size={14} /> 重新排练
            </button>
          </div>
          <div className="progress big"><i style={{ width: `${sorted.length ? (recordedCount / sorted.length) * 100 : 0}%` }} /></div>
          <div className="ledger-list">
            {sorted.map((line, i) => {
              const rec = recordings.find((r) => r.lineId === line.id);
              return (
                <div key={line.id} className={`ledger-item ${rec ? '' : 'missing'}`}>
                  <span className="ledger-no">{i + 1}</span>
                  <div className="ledger-copy">
                    <strong>{line.character}</strong>
                    <p>{line.text}</p>
                    {rec ? (
                      <span className="ledger-rec"><Mic size={11} /> {rec.recordedBy} · {formatDuration(rec.seconds)} · {formatTime(rec.createdAt)}</span>
                    ) : (
                      <span className="ledger-missing">未录</span>
                    )}
                  </div>
                  {rec && <span className="ledger-check"><Check size={14} /></span>}
                </div>
              );
            })}
            {sorted.length === 0 && <div className="empty">剧本中还没有台词</div>}
          </div>
        </section>
      </div>
    </div>
  );
}
