import type { Line, PendingItem, PendingReason, Recording, Script } from '../types';

/** 内置示例剧本：《灯塔守望者》（原创示例，可自由替换） */
export const seedScript: Script = {
  title: '灯塔守望者',
  characters: ['老守塔人', '学徒', '信使'],
  lines: [
    { id: 101, order: 0, character: '老守塔人', text: '潮声不对，今夜会有大雾。' },
    { id: 102, order: 1, character: '学徒', text: '灯芯我刚换过，光可以照到三海里外。' },
    { id: 103, order: 2, character: '信使', text: '山下的信，说补给船推迟到后天。' },
    { id: 104, order: 3, character: '老守塔人', text: '那就把备用油搬上来，灯不能灭。' },
    { id: 105, order: 4, character: '学徒', text: '我去搬，您先把信读完吧。' },
    { id: 106, order: 5, character: '信使', text: '信尾还写了一句：谢谢你们一直亮着。' },
  ],
};

export const nextId = () => Date.now() + Math.floor(Math.random() * 1000);

/** 被剥离出正式序列的录音（等待进入待重排队列） */
export type DetachedEntry = { recording: Recording; reason: PendingReason; line: Line };

export const orderedLines = (script: Script) =>
  [...script.lines].sort((a, b) => a.order - b.order);

/** 把任意台词列表重排为连续 order */
function reorder(lines: Line[]): Line[] {
  return lines.map((l, i) => ({ ...l, order: i }));
}

/** 新增台词，追加到队尾 */
export function addLine(script: Script, character: string, text: string): Script {
  return {
    ...script,
    lines: [
      ...script.lines,
      { id: nextId(), order: script.lines.length, character, text },
    ],
  };
}

/** 修改一句台词；若改派角色且该句已有录音，返回需要进待重排的录音 */
export function updateLine(
  script: Script,
  id: number,
  patch: { character?: string; text?: string },
  recordings: Recording[],
): { script: Script; detached: { recording: Recording; reason: PendingReason; line: Line }[] } {
  const before = script.lines.find((l) => l.id === id);
  const detached: { recording: Recording; reason: PendingReason; line: Line }[] = [];
  const lines = script.lines.map((l) => {
    if (l.id !== id) return l;
    const changedCharacter = patch.character && patch.character !== l.character;
    if (changedCharacter) {
      recordings
        .filter((r) => r.lineId === id)
        .forEach((recording) => detached.push({ recording, reason: 'reassigned', line: l }));
    }
    return { ...l, ...patch };
  });
  return { script: { ...script, lines }, detached };
}

/**
 * 上移 / 下移台词。
 * 导演改变已录台词的顺序时，相关录音进入待重排队列，由导演确认接回或丢弃，
 * 顺序变化不会静默保留旧顺序下录好的音频。
 */
export function moveLine(
  script: Script,
  id: number,
  dir: -1 | 1,
  recordings: Recording[],
): { script: Script; detached: { recording: Recording; reason: PendingReason; line: Line }[] } {
  const sorted = orderedLines(script);
  const idx = sorted.findIndex((l) => l.id === id);
  const target = idx + dir;
  if (idx < 0 || target < 0 || target >= sorted.length) return { script, detached: [] };
  const affected = [sorted[idx], sorted[target]];
  const detached = affected.flatMap((line) =>
    recordings
      .filter((r) => r.lineId === line.id)
      .map((recording) => ({ recording, reason: 'reordered' as PendingReason, line })),
  );
  [sorted[idx], sorted[target]] = [sorted[target], sorted[idx]];
  return { script: { ...script, lines: reorder(sorted) }, detached };
}

/**
 * 删除台词：该句已有录音时，录音进入待重排，由导演确认后才丢弃，绝不直接删除。
 */
export function removeLine(
  script: Script,
  id: number,
  recordings: Recording[],
): { script: Script; detached: { recording: Recording; reason: PendingReason; line: Line }[] } {
  const line = script.lines.find((l) => l.id === id);
  if (!line) return { script, detached: [] };
  const detached = recordings
    .filter((r) => r.lineId === id)
    .map((recording) => ({ recording, reason: 'removed' as PendingReason, line }));
  const lines = reorder(script.lines.filter((l) => l.id !== id));
  return { script: { ...script, lines }, detached };
}

/** 新增角色（去重） */
export function addCharacter(script: Script, name: string): Script {
  const trimmed = name.trim();
  if (!trimmed || script.characters.includes(trimmed)) return script;
  return { ...script, characters: [...script.characters, trimmed] };
}

/** 移除角色：角色仍被台词使用时拒绝，返回 null */
export function removeCharacter(script: Script, name: string): Script | null {
  if (script.lines.some((l) => l.character === name)) return null;
  return { ...script, characters: script.characters.filter((c) => c !== name) };
}

export function makePendingItem(
  entry: { recording: Recording; reason: PendingReason; line: Line },
): PendingItem {
  return {
    id: nextId(),
    recording: entry.recording,
    lineSnapshot: { ...entry.line },
    reason: entry.reason,
    createdAt: Date.now(),
  };
}
