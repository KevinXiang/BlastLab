export interface LevelRecord {
  bestStars: number;
  bestTime: number;
  failCount: number;
  skipped: boolean;
  completed: boolean;
}

export interface ProgressData {
  unlockedLevel: number;
  records: Record<number, LevelRecord>;
}

const SAVE_KEY = 'blasting_progress';

function getDefaultProgress(): ProgressData {
  return { unlockedLevel: 1, records: {} };
}

export function loadProgress(): ProgressData {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return getDefaultProgress();
    const data = JSON.parse(raw) as ProgressData;
    if (typeof data.unlockedLevel !== 'number' || !data.records) {
      return getDefaultProgress();
    }
    return data;
  } catch {
    return getDefaultProgress();
  }
}

export function saveProgress(data: ProgressData): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // localStorage 不可用时静默忽略
  }
}

export function resetProgress(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // 忽略
  }
}
