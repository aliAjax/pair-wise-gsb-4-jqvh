// 共享数据类型：剧本资料、排练进度、待重排录音各自独立存储（见 lib/storage.ts）

/** 一条台词：一句一条，固定归属一个角色，顺序由 order 决定 */
export type Line = {
  id: number;
  order: number;
  character: string;
  text: string;
};

/** 剧本资料：剧名 + 出场角色 + 台词列表 */
export type Script = {
  title: string;
  characters: string[];
  lines: Line[];
};

/** 已保存的录音（当前为模拟录音：仅记录时长与时间，不存音频数据） */
export type Recording = {
  id: number;
  lineId: number;
  character: string;
  recordedBy: string;
  seconds: number;
  createdAt: number;
};

/** 待重排原因：调整顺序、台词被移除，或角色被改派 */
export type PendingReason = 'reordered' | 'removed' | 'reassigned';

/** 待重排队列条目：台词离开原位置时，录音不删除，进入此处等待导演确认 */
export type PendingItem = {
  id: number;
  recording: Recording;
  /** 失联台词的快照，保证台词已被删除后仍能展示 */
  lineSnapshot: { id: number; order: number; character: string; text: string };
  reason: PendingReason;
  createdAt: number;
};

/** 排练交接状态：当前轮到哪一句、当前演员选择，随页面退出保留 */
export type HandoffState = {
  currentLineId: number | null;
  /** 当前坐在页面前的演员（先选自己的角色再录） */
  actorCharacter: string | null;
  /** 演员可选署名 */
  actorName: string;
};
