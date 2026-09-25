import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronRight, Flag, Mic, Pause, Play, RotateCcw, Users } from 'lucide-react';
import type { HandoffState, Recording, Script } from '../types';
import { nextId, orderedLines } from '../lib/script';
import { formatDuration, formatTime, isLineRecorded, nextLineAfter, resolveCurrentLine } from '../lib/handoff';

type Props = {
  script: Script;
  recordings: Recording[];
  setRecordings: (r: Recording[]) => void;
  handoff: HandoffState;
  setHandoff: (h: HandoffState) => void;
  pendingCount: number;
  goPending: () => void;
  notify: (msg: string) => void;
};

const bars = Array.from({ length: 60 }, (_, i) => 18 + ((i * 29) % 44));

export default function RehearsalPage({ script, recordings, setRecordings, handoff, setHandoff, pendingCount, goPending, notify }: Props) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [savedThisTurn, setSavedThisTurn] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  const sorted = useMemo(() => orderedLines(script), [script]);
  const current = resolveCurrentLine(script, recordings, handoff);
  const currentRecording = current ? recordings.find((r) => r.lineId === current.id) : undefined;

  // 切句时复位录音面板状态
  useEffect(() => {
    setRecording(false);
    setSeconds(0);
    setPlaying(false);
    setSavedThisTurn(false);
    return () => window.clearInterval(timer.current);
  }, [current?.id]);

  useEffect(() => () => window.clearInterval(timer.current), []);

  const actor = handoff.actorCharacter;
  const isMyTurn = !!current && !!actor && current.character === actor;
  const done = sorted.length > 0 && sorted.every((l) => isLineRecorded(recordings, l.id));
  const recordedCount = sorted.filter((l) => isLineRecorded(recordings, l.id)).length;

  /** 结束当前录音并保存（同一句重录以最新一条为准） */
  const stopAndSave = () => {
    if (!current || !actor) return;
    window.clearInterval(timer.current);
    setRecording(false);
    const recordingEntry: Recording = {
      id: nextId(),
      lineId: current.id,
      character: current.character,
      recordedBy: handoff.actorName.trim() || actor,
      seconds: Math.max(1, seconds),
      createdAt: Date.now(),
    };
    setRecordings([...recordings.filter((r) => r.lineId !== current.id), recordingEntry]);
    setSavedThisTurn(true);
    notify(`第 ${sorted.findIndex((l) => l.id === current.id) + 1} 句已保存，确认无误后交给下一句`);
  };

  const toggleRecord = () => {
    if (recording) {
      stopAndSave();
      return;
    }
    setSeconds(0);
    setRecording(true);
    timer.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
  };

  /** 录完当前句，交给下一句 */
  const handoffNext = () => {
    if (!current) return;
    const next = nextLineAfter(script, recordings, current.id);
    setHandoff({ ...handoff, currentLineId: next ? next.id : null });
    notify(next ? `已交给「${next.character}」：第 ${sorted.findIndex((l) => l.id === next.id) + 1} 句` : '本轮台词全部录完');
  };

  const replay = () => {
    setPlaying((p) => !p);
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">REHEARSAL</p>
          <h1>排练交接 · {script.title}</h1>
          <p className="page-sub">先选自己的角色；只有轮到当前角色时才能开录，录完当前句再交给下一句。退出再回来会停在原处。</p>
        </div>
        {pendingCount > 0 && (
          <button className="secondary warn" onClick={goPending}>
            <Flag size={15} /> 待重排 {pendingCount} 条
          </button>
        )}
      </header>

      {/* 先选自己的角色：选择与署名随本地保存，轮到别人时保留 */}
      <section className="card actor-bar">
        <div className="actor-pick">
          <Users size={15} />
          <span>我是</span>
          <select
            value={actor ?? ''}
            onChange={(e) => setHandoff({ ...handoff, actorCharacter: e.target.value || null })}
          >
            <option value="">选择自己的角色…</option>
            {script.characters.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input
            value={handoff.actorName}
            onChange={(e) => setHandoff({ ...handoff, actorName: e.target.value })}
            placeholder="署名（可选）"
            aria-label="署名"
          />
        </div>
        <div className="turn-progress">
          <span>{recordedCount} / {sorted.length} 句已录</span>
          <div className="progress"><i style={{ width: `${sorted.length ? (recordedCount / sorted.length) * 100 : 0}%` }} /></div>
        </div>
      </section>

      <div className="content-grid">
        {/* 顺序队列：角色、顺序、完成状态一目了然 */}
        <section className="card queue-card">
          <div className="section-head">
            <div>
              <h2>台词顺序</h2>
              <p>按剧本顺序交接，绿点表示已录</p>
            </div>
          </div>
          <div className="queue-list">
            {sorted.map((line, i) => {
              const rec = isLineRecorded(recordings, line.id);
              const isCurrent = current?.id === line.id;
              return (
                <button
                  key={line.id}
                  className={`queue-item ${isCurrent ? 'current' : ''} ${rec ? 'done' : ''}`}
                  onClick={() => {
                    if (!rec && !isCurrent) {
                      setHandoff({ ...handoff, currentLineId: line.id });
                      notify(`排练指针已移到第 ${i + 1} 句（${line.character}）`);
                    }
                  }}
                  title={rec ? '已录，在右侧可重录' : isCurrent ? '当前句' : '跳到这句'}
                >
                  <span className="queue-no">{i + 1}</span>
                  <span className="queue-character">{line.character}</span>
                  <span className="queue-text">{line.text}</span>
                  {rec ? <Check size={15} className="queue-check" /> : isCurrent ? <Mic size={15} className="queue-mic" /> : <ChevronRight size={15} />}
                </button>
              );
            })}
            {sorted.length === 0 && <div className="empty">剧本还是空的，先去「剧本资料」添加台词</div>}
          </div>
        </section>

        {/* 当前句练习面板 */}
        <section className="practice-panel">
          {done && current === null ? (
            <div className="card finish-card">
              <div className="finish-badge"><Flag size={20} /></div>
              <h2>本轮全部录完</h2>
              <p>{recordedCount} 句台词都已保存。导演调整剧本后再来，或从头复排。</p>
              <button className="secondary" onClick={() => setHandoff({ ...handoff, currentLineId: sorted[0]?.id ?? null })}>
                <RotateCcw size={15} /> 从头复排
              </button>
            </div>
          ) : !current ? (
            <div className="card empty">没有可排练的台词</div>
          ) : (
            <>
              <div className="focus-card">
                <div className="focus-tag">
                  第 {sorted.findIndex((l) => l.id === current.id) + 1} 句 · 轮到
                  <b> {current.character}</b>
                </div>
                <p className="focus-text">{current.text}</p>
                <div className="focus-meta">
                  {currentRecording && <span>已录 · {currentRecording.recordedBy} · {formatTime(currentRecording.createdAt)}</span>}
                </div>
              </div>

              {/* 轮次提示：轮到别人时保留当前演员选择与署名，只提示，不抢录 */}
              {!actor && (
                <div className="turn-banner muted">
                  <Users size={15} />
                  <p>请先在上方选择自己的角色，再开始录音。</p>
                </div>
              )}
              {actor && !isMyTurn && (
                <div className="turn-banner waiting">
                  <Pause size={15} />
                  <p>现在轮到 <b>「{current.character}」</b>。你的角色与署名已保留，请等 TA 录完交句。</p>
                </div>
              )}
              {isMyTurn && (
                <div className="turn-banner go">
                  <Mic size={15} />
                  <p>{savedThisTurn ? '录好了，交给下一句；不满意可以重录。' : `轮到你了，${handoff.actorName.trim() || actor}，开录吧。`}</p>
                </div>
              )}

              <div className="card record-card">
                <div className="record-top">
                  <div>
                    <span className="label">YOUR RECORDING</span>
                    <h3>
                      {recording ? '正在录音…' : savedThisTurn ? '录音已保存，交给下一句' : currentRecording ? '这句已有录音，可回放或重录' : '准备好后开始录音'}
                    </h3>
                  </div>
                  <span className="record-time">{formatDuration(recording ? seconds : currentRecording?.seconds ?? 0)}</span>
                </div>
                <div className="record-wave">
                  {bars.slice(4, 52).map((h, i) => (
                    <i key={i} className={recording ? 'live' : ''} style={{ height: `${h * (recording ? 0.45 + ((i * 7 + seconds) % 9) / 14 : currentRecording || savedThisTurn ? 0.62 : 0.32)}%` }} />
                  ))}
                </div>
                <div className="record-actions">
                  <button
                    className={recording ? 'record-button recording' : 'record-button'}
                    onClick={toggleRecord}
                    disabled={!isMyTurn}
                    title={!isMyTurn ? `只有「${current.character}」能录这句` : ''}
                  >
                    <span>{recording ? <Pause size={16} /> : <Mic size={16} />}</span>
                    {recording ? '结束并保存' : currentRecording || savedThisTurn ? '重新录音' : '开始录音'}
                  </button>
                  <button className="secondary" onClick={replay} disabled={!currentRecording && !savedThisTurn}>
                    {playing ? <Pause size={15} /> : <Play size={15} />} 回放
                  </button>
                  <button className="primary handoff-btn" onClick={handoffNext} disabled={!isLineRecorded(recordings, current.id)}>
                    交给下一句 <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
