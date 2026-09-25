// 排练交接：轮流规则、导演改词、待重排确认，以及本地保存
import { seedScript, type Line } from '../data/script';

export type Recording = {
  lineId: number;
  actor: string;     // 录音时的角色
  seconds: number;
  attempts: number;
  savedAt: string;
};

// 待重排：导演改动波及的录音，确认前一直保留
export type PendingItem = {
  key: string;
  lineId: number;
  lineText: string;  // 台词快照，移除后也能找回
  character: string;
  actor: string;
  seconds: number;
  attempts: number;
  savedAt: string;
  reason: 'reorder' | 'removed';
};

export type RehearsalState = {
  lines: Line[];            // 剧本（顺序即演出顺序）
  recordings: Recording[];  // 已挂到台词上的录音
  pending: PendingItem[];   // 待重排的录音
  cursor: number;           // 当前轮到第几句（等于 lines.length 表示本轮过完）
  actor: string | null;     // 本机演员认领的角色
};

const KEY = 'troupe-rehearsal-v1';

export const initialState = (): RehearsalState => ({
  lines: seedScript,
  recordings: [],
  pending: [],
  cursor: 0,
  actor: null,
});

export function loadState(): RehearsalState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return initialState();
    const s = JSON.parse(raw) as Partial<RehearsalState>;
    if (!Array.isArray(s.lines) || s.lines.length === 0) return initialState();
    return {
      lines: s.lines,
      recordings: s.recordings ?? [],
      pending: s.pending ?? [],
      cursor: Math.min(Math.max(s.cursor ?? 0, 0), s.lines.length),
      actor: s.actor ?? null,
    };
  } catch {
    return initialState();
  }
}

export function saveState(s: RehearsalState) {
  localStorage.setItem(KEY, JSON.stringify(s));
}

// ---- 轮流 ----

export const charactersOf = (lines: Line[]) => Array.from(new Set(lines.map(l => l.character)));
export const currentLine = (s: RehearsalState) => s.lines[s.cursor] ?? null;
export const isDone = (s: RehearsalState) => s.cursor >= s.lines.length;
export const isMyTurn = (s: RehearsalState) => {
  const line = currentLine(s);
  return !!line && !!s.actor && line.character === s.actor;
};
export const recordingOf = (s: RehearsalState, lineId: number) =>
  s.recordings.find(r => r.lineId === lineId);

const now = () => new Date().toLocaleString('zh-CN', { hour12: false });

// 录完当前句：录音挂到这句上，自动交给下一句
export function finishRecording(s: RehearsalState, seconds: number): RehearsalState {
  const line = currentLine(s);
  if (!line || !s.actor) return s;
  const prev = recordingOf(s, line.id);
  const rec: Recording = { lineId: line.id, actor: s.actor, seconds, attempts: (prev?.attempts ?? 0) + 1, savedAt: now() };
  return {
    ...s,
    recordings: [...s.recordings.filter(r => r.lineId !== line.id), rec],
    cursor: s.cursor + 1,
  };
}

export const skipLine = (s: RehearsalState): RehearsalState => ({ ...s, cursor: Math.min(s.cursor + 1, s.lines.length) });
export const jumpTo = (s: RehearsalState, index: number): RehearsalState => ({ ...s, cursor: Math.max(0, Math.min(index, s.lines.length)) });
export const restart = (s: RehearsalState): RehearsalState => ({ ...s, cursor: 0 });
export const pickRole = (s: RehearsalState, actor: string | null): RehearsalState => ({ ...s, actor });

// ---- 导演改词 ----

const toPending = (line: Line, rec: Recording, reason: PendingItem['reason']): PendingItem => ({
  key: `${line.id}-${reason}-${Date.now()}`,
  lineId: line.id,
  lineText: line.text,
  character: line.character,
  actor: rec.actor,
  seconds: rec.seconds,
  attempts: rec.attempts,
  savedAt: rec.savedAt,
  reason,
});

// 调整顺序：位置变化的两句若已有录音，录音进入待重排
export function moveLine(s: RehearsalState, id: number, dir: -1 | 1): RehearsalState {
  const i = s.lines.findIndex(l => l.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= s.lines.length) return s;
  const lines = [...s.lines];
  [lines[i], lines[j]] = [lines[j], lines[i]];
  const affected = [lines[i], lines[j]];
  const hits = affected
    .map(l => ({ line: l, rec: s.recordings.find(r => r.lineId === l.id) }))
    .filter((x): x is { line: Line; rec: Recording } => !!x.rec);
  return {
    ...s,
    lines,
    recordings: s.recordings.filter(r => !hits.some(h => h.rec.lineId === r.lineId)),
    pending: [...s.pending, ...hits.map(h => toPending(h.line, h.rec, 'reorder'))],
  };
}

// 移除台词：已录的录音不丢，进入待重排
export function removeLine(s: RehearsalState, id: number): RehearsalState {
  const i = s.lines.findIndex(l => l.id === id);
  if (i < 0) return s;
  const rec = recordingOf(s, id);
  const lines = s.lines.filter(l => l.id !== id);
  return {
    ...s,
    lines,
    recordings: s.recordings.filter(r => r.lineId !== id),
    pending: rec ? [...s.pending, toPending(s.lines[i], rec, 'removed')] : s.pending,
    cursor: Math.min(s.cursor > i ? s.cursor - 1 : s.cursor, lines.length),
  };
}

export function addLine(s: RehearsalState, character: string, text: string, note: string): RehearsalState {
  const line: Line = { id: Date.now(), character: character.trim(), text: text.trim(), note: note.trim() || undefined };
  return { ...s, lines: [...s.lines, line] };
}

// 确认待重排：keep 挂回（被移除的连台词一起恢复），drop 才允许丢弃
export function confirmPending(s: RehearsalState, key: string, action: 'keep' | 'drop'): RehearsalState {
  const item = s.pending.find(p => p.key === key);
  if (!item) return s;
  const pending = s.pending.filter(p => p.key !== key);
  if (action === 'drop') return { ...s, pending };
  const rec: Recording = { lineId: item.lineId, actor: item.actor, seconds: item.seconds, attempts: item.attempts, savedAt: item.savedAt };
  const recordings = [...s.recordings.filter(r => r.lineId !== item.lineId), rec];
  if (item.reason === 'removed' && !s.lines.some(l => l.id === item.lineId)) {
    const line: Line = { id: item.lineId, character: item.character, text: item.lineText };
    return { ...s, pending, lines: [...s.lines, line], recordings };
  }
  return { ...s, pending, recordings };
}
