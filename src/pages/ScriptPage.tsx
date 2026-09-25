import { useState } from 'react';
import { Check, ChevronDown, ChevronUp, FileText, Pencil, Plus, Trash2, Users, X } from 'lucide-react';
import type { PendingItem, Recording, Script } from '../types';
import { addCharacter, addLine, makePendingItem, moveLine, orderedLines, removeCharacter, removeLine, updateLine } from '../lib/script';
import type { DetachedEntry } from '../lib/script';

type Props = {
  script: Script;
  setScript: (s: Script) => void;
  recordings: Recording[];
  setRecordings: (r: Recording[]) => void;
  appendPending: (items: PendingItem[]) => void;
  notify: (msg: string) => void;
};

export default function ScriptPage({ script, setScript, recordings, setRecordings, appendPending, notify }: Props) {
  const [titleDraft, setTitleDraft] = useState(script.title);
  const [newCharacter, setNewCharacter] = useState('');
  const [showAddLine, setShowAddLine] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  /** 把被剥离的录音统一送入待重排队列，并从正式录音列表移除 */
  const detach = (entries: DetachedEntry[]) => {
    if (!entries.length) return;
    appendPending(entries.map(makePendingItem));
    const ids = new Set(entries.map((e) => e.recording.id));
    setRecordings(recordings.filter((r) => !ids.has(r.id)));
    notify(`${entries.length} 条录音进入待重排，确认前不会丢失`);
  };

  const saveTitle = () => {
    const t = titleDraft.trim();
    if (t) setScript({ ...script, title: t });
  };

  const saveCharacter = () => {
    if (newCharacter.trim()) {
      setScript(addCharacter(script, newCharacter));
      setNewCharacter('');
    }
  };

  const dropCharacter = (name: string) => {
    const next = removeCharacter(script, name);
    if (!next) {
      notify(`「${name}」还有台词，无法移除`);
      return;
    }
    setScript(next);
  };

  const onMove = (id: number, dir: -1 | 1) => {
    const result = moveLine(script, id, dir, recordings);
    if (result.detached.length) {
      detach(result.detached);
      setScript(result.script);
    } else {
      setScript(result.script);
    }
  };

  const onRemove = (id: number) => {
    const result = removeLine(script, id, recordings);
    if (result.detached.length) {
      detach(result.detached);
      notify('台词已移除，其录音进入待重排');
    } else {
      notify('台词已移除（该句没有录音）');
    }
    setScript(result.script);
  };

  const onSaveEdit = (id: number, character: string, text: string) => {
    const result = updateLine(script, id, { character, text }, recordings);
    setScript(result.script);
    if (result.detached.length) detach(result.detached);
    setEditingId(null);
  };

  const sorted = orderedLines(script);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">SCRIPT</p>
          <h1>剧本资料</h1>
          <p className="page-sub">一句一条，标注角色与顺序；改顺序、改派角色或删除已录台词时，录音会进入待重排等待确认。</p>
        </div>
        <button className="primary" onClick={() => setShowAddLine(true)}>
          <Plus size={16} /> 添加台词
        </button>
      </header>

      <section className="card script-meta">
        <div className="script-title-row">
          <FileText size={17} />
          <input
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            aria-label="剧名"
          />
        </div>
        <div className="characters">
          <div className="characters-head">
            <Users size={14} />
            <span>出场角色（{script.characters.length}）</span>
          </div>
          <div className="character-chips">
            {script.characters.map((c) => (
              <span key={c} className="character-chip">
                {c}
                <button onClick={() => dropCharacter(c)} title={`移除角色 ${c}`} aria-label={`移除角色 ${c}`}>
                  <X size={11} />
                </button>
              </span>
            ))}
            <input
              className="character-add"
              value={newCharacter}
              onChange={(e) => setNewCharacter(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveCharacter()}
              onBlur={saveCharacter}
              placeholder="+ 新角色"
            />
          </div>
        </div>
      </section>

      <section className="card">
        <div className="line-table-head">
          <span>顺序</span><span>角色</span><span>台词</span><span />
        </div>
        <div className="line-rows">
          {sorted.map((line, i) => {
            const recorded = recordings.some((r) => r.lineId === line.id);
            if (editingId === line.id) {
              return <LineEditor key={line.id} line={line} characters={script.characters} onCancel={() => setEditingId(null)} onSave={onSaveEdit} />;
            }
            return (
              <div key={line.id} className="line-row">
                <div className="line-order">{i + 1}{recorded && <i title="已录音" />}</div>
                <span className="line-character">{line.character}</span>
                <p className="line-text">{line.text}</p>
                <div className="line-actions">
                  <button className="icon-btn" disabled={i === 0} onClick={() => onMove(line.id, -1)} title="上移">
                    <ChevronUp size={16} />
                  </button>
                  <button className="icon-btn" disabled={i === sorted.length - 1} onClick={() => onMove(line.id, 1)} title="下移">
                    <ChevronDown size={16} />
                  </button>
                  <button className="icon-btn" onClick={() => setEditingId(line.id)} title="编辑台词">
                    <Pencil size={15} />
                  </button>
                  <button className="icon-btn danger" onClick={() => onRemove(line.id)} title="移除台词">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
          {sorted.length === 0 && <div className="empty">还没有台词，点右上角「添加台词」开始建剧本</div>}
        </div>
      </section>

      {showAddLine && (
        <LineModal
          title="添加台词"
          characters={script.characters}
          defaultCharacter={script.characters[0] ?? ''}
          onCancel={() => setShowAddLine(false)}
          onConfirm={(character, text) => {
            if (!character.trim() || !text.trim()) {
              notify('角色和台词都不能为空');
              return;
            }
            setScript(addLine(addCharacter(script, character), character, text.trim()));
            setShowAddLine(false);
            notify('台词已加到队尾');
          }}
        />
      )}
    </div>
  );
}

function LineEditor({ line, characters, onCancel, onSave }: {
  line: { id: number; character: string; text: string };
  characters: string[];
  onCancel: () => void;
  onSave: (id: number, character: string, text: string) => void;
}) {
  const [character, setCharacter] = useState(line.character);
  const [text, setText] = useState(line.text);
  return (
    <div className="line-row editing">
      <div className="line-order">…</div>
      <select value={character} onChange={(e) => setCharacter(e.target.value)}>
        {characters.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <input value={text} onChange={(e) => setText(e.target.value)} autoFocus onKeyDown={(e) => {
        if (e.key === 'Enter') onSave(line.id, character, text.trim());
        if (e.key === 'Escape') onCancel();
      }} />
      <div className="line-actions">
        <button className="icon-btn" onClick={() => onSave(line.id, character, text.trim())} title="保存">
          <Check size={16} />
        </button>
        <button className="icon-btn" onClick={onCancel} title="取消">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

function LineModal({ title, characters, defaultCharacter, onCancel, onConfirm }: {
  title: string;
  characters: string[];
  defaultCharacter: string;
  onCancel: () => void;
  onConfirm: (character: string, text: string) => void;
}) {
  const [character, setCharacter] = useState(defaultCharacter);
  const [text, setText] = useState('');
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onCancel}>×</button>
        </div>
        <label className="modal-label">角色
          <input className="modal-input" list="character-options" value={character} onChange={(e) => setCharacter(e.target.value)} placeholder="选择或输入角色名" />
          <datalist id="character-options">
            {characters.map((c) => <option key={c} value={c} />)}
          </datalist>
        </label>
        <label className="modal-label">台词（一句一条）
          <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="输入这一句台词…" />
        </label>
        <div className="modal-actions">
          <button className="secondary" onClick={onCancel}>取消</button>
          <button className="primary" onClick={() => onConfirm(character, text.trim())}>加入剧本</button>
        </div>
      </div>
    </div>
  );
}
