import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, ChevronDown, ChevronRight, ChevronUp, Mic, Pause, Play, Plus, RotateCcw, Search, Trash2, UserRound, Users, Volume2 } from 'lucide-react';
import {
  addLine, charactersOf, confirmPending, currentLine, finishRecording,
  isDone, isMyTurn, jumpTo, loadState, moveLine, pickRole, recordingOf, removeLine,
  restart, saveState, skipLine, type RehearsalState,
} from './lib/rehearsal';

const bars = Array.from({ length: 68 }, (_, i) => 18 + ((i * 29) % 44));
const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
const charStyle = (name: string) => {
  const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return { background: `hsl(${hue} 55% 92%)`, color: `hsl(${hue} 45% 32%)` };
};

export default function App() {
  const [state, setState] = useState<RehearsalState>(() => loadState());
  const [view, setView] = useState<'stage' | 'pending'>('stage');
  const [query, setQuery] = useState('');
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showRoles, setShowRoles] = useState(false);
  const [toast, setToast] = useState('');
  const [newChar, setNewChar] = useState('');
  const [newText, setNewText] = useState('');
  const [newNote, setNewNote] = useState('');
  const timer = useRef<number | undefined>(undefined);
  const recLine = useRef<number | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  const update = (fn: (s: RehearsalState) => RehearsalState) => setState(s => fn(s));
  const notify = (msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 2600);
  };

  useEffect(() => { saveState(state); }, [state]);                 // 退出回来接着上次进度
  useEffect(() => { if (!state.actor) setShowRoles(true); }, []);   // 排练前先选角色
  useEffect(() => () => { window.clearInterval(timer.current); window.clearTimeout(toastTimer.current); }, []);

  const line = currentLine(state);
  const done = isDone(state);
  const myTurn = isMyTurn(state);
  const chars = charactersOf(state.lines);
  const pendingLineIds = new Set(state.pending.map(p => p.lineId));
  const filtered = state.lines
    .map((l, i) => ({ l, i }))
    .filter(({ l }) => l.text.includes(query) || l.character.includes(query));
  const progress = state.lines.length ? Math.round(Math.min(state.cursor, state.lines.length) / state.lines.length * 100) : 0;

  const stopTimer = () => { window.clearInterval(timer.current); setRecording(false); };

  const toggleRecord = () => {
    if (!myTurn || !line) return;
    if (recording) {
      stopTimer();
      if (recLine.current === line.id) {          // 录音期间导演改了顺序则丢弃本次，避免挂错句
        update(s => finishRecording(s, seconds));
        notify(`已保存 ${fmt(seconds)}，交给下一句`);
      } else {
        notify('台词顺序刚被调整，本次录音未保存');
      }
      recLine.current = null;
      return;
    }
    recLine.current = line.id;
    setSeconds(0);
    setRecording(true);
    timer.current = window.setInterval(() => setSeconds(s => s + 1), 1000);
  };

  const jump = (i: number) => {
    if (recording) { stopTimer(); recLine.current = null; notify('已切换起点，进行中的录音未保存'); }
    update(s => jumpTo(s, i));
  };

  const addNewLine = () => {
    if (!newChar.trim() || !newText.trim()) return;
    update(s => addLine(s, newChar, newText, newNote));
    setNewChar(''); setNewText(''); setNewNote(''); setShowAdd(false);
    notify('已加入剧本末尾');
  };

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Volume2 size={19}/></div><div><strong>声线练习室</strong><span>Troupe rehearsal</span></div></div>
      <div className="side-label">排练</div>
      <nav>
        <button className={view === 'stage' ? 'side-link active' : 'side-link'} onClick={() => setView('stage')}><Mic size={17}/>排练台 <b>{Math.max(state.lines.length - Math.min(state.cursor, state.lines.length), 0)}</b></button>
        <button className={view === 'pending' ? 'side-link active' : 'side-link'} onClick={() => setView('pending')}><AlertTriangle size={17}/>待重排 <b>{state.pending.length}</b></button>
      </nav>
      <div className="sidebar-foot">
        <div className="streak"><span>本轮进度</span><strong>{progress}<small>%</small></strong><i>第 {Math.min(state.cursor + 1, state.lines.length)} / {state.lines.length} 句</i></div>
        <button className="profile" onClick={() => setShowRoles(true)}>
          <div className="avatar">{state.actor ? state.actor.slice(0, 2) : <UserRound size={15}/>}</div>
          <div><strong>{state.actor ?? '未选角色'}</strong><span>{state.actor ? '我的角色 · 点击切换' : '排练前先选角色'}</span></div>
          <ChevronRight size={16}/>
        </button>
      </div>
    </aside>

    <main className="main">
      <header className="topbar">
        <div><p className="eyebrow">REHEARSAL ROOM</p><h1>{done ? '本轮排练完成' : line ? `轮到「${line.character}」` : '今天排哪段？'}</h1></div>
        <div className="top-actions">
          <div className="search"><Search size={16}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="搜索台词或角色"/></div>
          <button className="primary" onClick={() => setShowAdd(true)}><Plus size={17}/>添加台词</button>
        </div>
      </header>

      <section className="stats">
        <div><span>排练进度</span><strong>{Math.min(state.cursor, state.lines.length)} <em>/ {state.lines.length} 句</em></strong><div className="progress"><i style={{ width: `${progress}%` }}/></div></div>
        <div><span>已录台词</span><strong>{state.recordings.length} <em>条</em></strong><small>录音只保存在本机</small></div>
        <div><span>待重排</span><strong className={state.pending.length ? 'amber' : ''}>{state.pending.length} <em>条</em></strong><small>{state.pending.length ? '确认前录音不会丢失' : '导演改动会暂存在这里'}</small></div>
      </section>

      {view === 'pending' ? (
        <section className="pending-panel">
          <div className="section-head"><div><h2>待重排</h2><p>导演调整顺序或移除台词后，相关录音暂存于此；逐条确认之前不会丢失。</p></div><button className="ghost" onClick={() => setView('stage')}>返回排练台</button></div>
          {state.pending.length === 0 && <div className="empty">没有待重排的录音</div>}
          <div className="pending-list">
            {state.pending.map(p => (
              <div className="pending-item" key={p.key}>
                <div className="pending-copy">
                  <strong>“{p.lineText}”</strong>
                  <div className="phrase-meta">
                    <i className="char-chip" style={charStyle(p.character)}>{p.character}</i>
                    <small>{p.reason === 'removed' ? '台词已移除' : '顺序已调整'} · {p.actor} 录 · {p.attempts} 次 · {fmt(p.seconds)} · {p.savedAt}</small>
                  </div>
                </div>
                <div className="row-actions">
                  <button className="secondary" onClick={() => { update(s => confirmPending(s, p.key, 'keep')); notify(p.reason === 'removed' ? '已恢复台词并挂回录音' : '录音已挂回原句'); }}>
                    <Check size={14}/>{p.reason === 'removed' ? '恢复台词并保留' : '保留录音'}
                  </button>
                  <button className="danger" onClick={() => { update(s => confirmPending(s, p.key, 'drop')); notify('已确认丢弃该录音'); }}><Trash2 size={14}/>丢弃录音</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <div className="content-grid">
          <section className="library">
            <div className="section-head"><div><h2>剧本 · 台词顺序</h2><p>点一句可从该句开始；调整或删除已录台词会进入待重排</p></div></div>
            <div className="phrase-list">
              {filtered.map(({ l, i }) => {
                const rec = recordingOf(state, l.id);
                return (
                  <div key={l.id} className={i === state.cursor ? 'phrase current' : 'phrase'} onClick={() => jump(i)}>
                    <span className="seq">{i + 1}</span>
                    <div className="phrase-copy">
                      <strong>{l.text}</strong>
                      <div className="phrase-meta">
                        <i className="char-chip" style={charStyle(l.character)}>{l.character}</i>
                        {l.note && <small>{l.note}</small>}
                        {rec && <small>已录 {rec.attempts} 次 · {rec.actor}</small>}
                        {pendingLineIds.has(l.id) && <small className="warn-text">待重排</small>}
                      </div>
                    </div>
                    {i === state.cursor && <span className="turn-tag">轮到TA</span>}
                    <div className="row-actions" onClick={e => e.stopPropagation()}>
                      <button title="上移" disabled={i === 0} onClick={() => { update(s => moveLine(s, l.id, -1)); if (rec) notify('顺序已调整，相关录音进入待重排'); }}><ChevronUp size={14}/></button>
                      <button title="下移" disabled={i === state.lines.length - 1} onClick={() => { update(s => moveLine(s, l.id, 1)); if (rec) notify('顺序已调整，相关录音进入待重排'); }}><ChevronDown size={14}/></button>
                      <button title="移除台词" className="del" onClick={() => { update(s => removeLine(s, l.id)); notify(rec ? '台词已移除，录音进入待重排' : '台词已移除'); }}><Trash2 size={14}/></button>
                    </div>
                  </div>
                );
              })}
              {filtered.length === 0 && <div className="empty">没有找到匹配台词</div>}
            </div>
          </section>

          <section className="practice">
            <div className="practice-head"><div><span className="label">ON STAGE</span><h2>{done ? '本轮台词全部过完' : '排练台'}</h2></div></div>
            {done ? (
              <div className="done-card">
                <div className="ok"><Check size={20}/></div>
                <h3>{state.lines.length} 句全部过完</h3>
                <p>录音已保存在本机。导演若调整顺序或移除台词，相关录音会进入「待重排」，确认前不会丢失。</p>
                <button className="primary" onClick={() => { update(restart); notify('从第一句重新开始'); }}><RotateCcw size={15}/>再排一遍</button>
              </div>
            ) : line && (
              <>
                <div className="focus-card">
                  <div className="focus-tag">第 {state.cursor + 1} / {state.lines.length} 句 · {line.character}</div>
                  <p className="focus-text">{line.text}</p>
                  <p className="focus-translation">{line.note ?? '无舞台提示'}</p>
                  <div className="audio-sample">
                    <button className="round-btn" onClick={() => setPlaying(!playing)}>{playing ? <Pause size={18}/> : <Play size={18}/>}</button>
                    <div className="sample-wave">{bars.map((h, i) => <i key={i} style={{ height: `${h * (playing ? 1.15 : 0.72)}%` }}/>)}</div>
                    <span>示范</span>
                  </div>
                </div>
                <div className="record-card">
                  <div className="record-top">
                    <div><span className="label">YOUR TAKE</span><h3>{myTurn ? (recordingOf(state, line.id) ? '这句已录过，可以重录' : '轮到你，准备好开始') : '还没轮到你'}</h3></div>
                    <span className="record-time">{fmt(seconds)}</span>
                  </div>
                  <div className="record-wave">{bars.slice(5, 58).map((h, i) => <i key={i} className={recording ? 'live' : ''} style={{ height: `${h * (recording ? (0.4 + ((i % 5) / 7)) : 0.4)}%` }}/>)}</div>
                  {!state.actor ? (
                    <div className="record-actions"><button className="record-button" onClick={() => setShowRoles(true)}><span><UserRound size={16}/></span>先选择我的角色</button></div>
                  ) : myTurn ? (
                    <div className="record-actions">
                      <button className={recording ? 'record-button recording' : 'record-button'} onClick={toggleRecord}><span>{recording ? <Pause size={16}/> : <Mic size={16}/>}</span>{recording ? '结束并交给下一句' : recordingOf(state, line.id) ? '重新录音' : '开始录音'}</button>
                      {recordingOf(state, line.id) && !recording && <button className="secondary" onClick={() => setPlaying(!playing)}>{playing ? <Pause size={15}/> : <Play size={15}/>} 回放</button>}
                    </div>
                  ) : (
                    <div className="record-actions">
                      <div className="turn-banner"><Users size={15}/>现在轮到「{line.character}」，你的输入和录音已保留，轮到你会自动放开</div>
                      <button className="secondary" onClick={() => { update(skipLine); notify(`已跳过，交给下一句`); }}>跳过此句</button>
                    </div>
                  )}
                </div>
                <div className="tip"><span>排练约定</span><p>几个人共用这一页：先认领角色，录完当前句自动交给下一句；轮到别人时页面会锁定录音。</p><RotateCcw size={15}/></div>
              </>
            )}
          </section>
        </div>
      )}
    </main>

    {showRoles && <div className="modal-backdrop" onClick={() => setShowRoles(false)}><div className="modal" onClick={e => e.stopPropagation()}>
      <div className="modal-head"><h2>选择我的角色</h2><button className="icon-btn" onClick={() => setShowRoles(false)}>×</button></div>
      <p className="modal-sub">几个人共用这一页，先认领自己的角色；轮到别人时录音会锁定，避免抢录。</p>
      <div className="role-grid">
        {chars.map(c => <button key={c} className={c === state.actor ? 'role-btn active' : 'role-btn'} style={c === state.actor ? {} : charStyle(c)} onClick={() => { update(s => pickRole(s, c)); setShowRoles(false); notify(`已认领「${c}」`); }}>{c}</button>)}
      </div>
      <div className="modal-actions"><button className="secondary" onClick={() => setShowRoles(false)}>先看看</button></div>
    </div></div>}

    {showAdd && <div className="modal-backdrop" onClick={() => setShowAdd(false)}><div className="modal" onClick={e => e.stopPropagation()}>
      <div className="modal-head"><h2>添加台词</h2><button className="icon-btn" onClick={() => setShowAdd(false)}>×</button></div>
      <label>角色<input list="chars" value={newChar} onChange={e => setNewChar(e.target.value)} placeholder="选择或输入新角色"/><datalist id="chars">{chars.map(c => <option key={c} value={c}/>)}</datalist></label>
      <label>台词<textarea autoFocus value={newText} onChange={e => setNewText(e.target.value)} placeholder="一句一条，按演出顺序追加到末尾"/></label>
      <label>舞台提示（可选）<input value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="例如：灯光渐起"/></label>
      <div className="modal-actions"><button className="secondary" onClick={() => setShowAdd(false)}>取消</button><button className="primary" onClick={addNewLine}>加入剧本</button></div>
    </div></div>}

    {toast && <div className="toast">{toast}</div>}
  </div>;
}
