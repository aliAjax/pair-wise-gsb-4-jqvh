import type { HandoffState, Recording, Script } from '../types';
import { orderedLines } from './script';

export const seedHandoff: HandoffState = {
  currentLineId: null,
  actorCharacter: null,
  actorName: '',
};

/** 某句是否已录：以录音列表为准（录音丢弃后自动回到未录状态） */
export const isLineRecorded = (recordings: Recording[], lineId: number) =>
  recordings.some((r) => r.lineId === lineId);

/**
 * 当前应该排练的台词：
 * - 指针句存在且未录，就停在它上面（退出再回来接着上次进度）
 * - 指针句已录（例如刚在旧句子上重录完），回到第一句未录
 * - 指针句已被删除，同样落到第一句未录
 * - 全部录完返回 null
 */
export function resolveCurrentLine(
  script: Script,
  recordings: Recording[],
  handoff: HandoffState,
) {
  const sorted = orderedLines(script);
  if (sorted.length === 0) return null;
  const firstUnrecorded = sorted.find((l) => !isLineRecorded(recordings, l.id)) ?? null;
  const pointer = sorted.find((l) => l.id === handoff.currentLineId);
  if (pointer && !isLineRecorded(recordings, pointer.id)) return pointer;
  return firstUnrecorded;
}

/** 交给下一句：当前句之后的第一句未录；没有则本轮完成（null） */
export function nextLineAfter(script: Script, recordings: Recording[], currentId: number) {
  const sorted = orderedLines(script);
  const idx = sorted.findIndex((l) => l.id === currentId);
  for (let i = idx + 1; i < sorted.length; i++) {
    if (!isLineRecorded(recordings, sorted[i].id)) return sorted[i];
  }
  for (let i = 0; i <= idx; i++) {
    if (!isLineRecorded(recordings, sorted[i].id)) return sorted[i];
  }
  return null;
}

export const formatTime = (ts: number) => {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

export const formatDuration = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
