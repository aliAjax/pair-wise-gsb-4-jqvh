import { useEffect, useState } from 'react';

// 剧本资料、排练交接、待重排队列分开保存：三个独立的 localStorage key，
// 任一部分损坏或缺失都不影响另外两部分。
const KEYS = {
  script: 'sound-lab-script-v1',
  handoff: 'sound-lab-handoff-v1',
  // 录音是排练交接的产物，独立成档：剧本删改不会直接碰到录音
  recordings: 'sound-lab-recordings-v1',
  pending: 'sound-lab-pending-v1',
};

export function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** 本地持久化状态：沿用 localStorage，不引入任何新依赖 */
export function usePersistentState<T>(key: keyof typeof KEYS, initial: T | (() => T)) {
  const [value, setValue] = useState<T>(() => {
    const fallback = typeof initial === 'function' ? (initial as () => T)() : initial;
    return loadJSON(KEYS[key], fallback);
  });

  useEffect(() => {
    try {
      localStorage.setItem(KEYS[key], JSON.stringify(value));
    } catch {
      // 存储不可用时仅在当前会话内有效，不阻断排练
    }
  }, [key, value]);

  return [value, setValue] as const;
}
