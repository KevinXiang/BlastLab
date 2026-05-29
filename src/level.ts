import { loadProgress, saveProgress, ProgressData, LevelRecord } from './persistence';
import { BUILDING_COLORS } from './constants';

// ============================================================
// Types
// ============================================================

export interface BuildingDef {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  color: number;
}

export type Objective =
  | { type: 'destroy_targets'; targetIds: number[] }
  | { type: 'destroy_count'; count: number }
  | { type: 'clear_area'; radius: number; center: { x: number; z: number } };

export type Restriction =
  | { type: 'no_weapon'; weapon: string }
  | { type: 'time_limit'; seconds: number };

export interface LevelConfig {
  id: number;
  name: string;
  parTime: number;
  weapons: Record<string, number>;
  objectives: Objective[];
  restrictions?: Restriction[];
  buildings: BuildingDef[];
}

export type GamePhase = 'menu' | 'playing' | 'complete' | 'failed';

export interface LevelState {
  config: LevelConfig;
  elapsedTime: number;
  remainingWeapons: Record<string, number>;
  destroyedObjectIds: Set<number>;
  objectiveStatus: boolean[];
}

// ============================================================
// Level Data
// ============================================================

function b(x: number, z: number, w: number, d: number, h: number, colorIdx: number): BuildingDef {
  return { x, z, w, d, h, color: BUILDING_COLORS[colorIdx % BUILDING_COLORS.length] };
}

export const LEVELS: LevelConfig[] = [
  {
    id: 1, name: '初入战场', parTime: 60,
    weapons: { tnt: 3, c4: 1 },
    objectives: [{ type: 'destroy_targets', targetIds: [1, 2] }],
    buildings: [
      b(-8, -8, 3, 3, 6, 0),
      b(-2, -10, 2, 2, 4, 1),
      b(5, -7, 3, 4, 8, 2),
      b(-6, 2, 4, 3, 5, 3),
      b(3, 0, 2, 3, 7, 4),
      b(-10, 8, 3, 2, 3, 5),
      b(7, 5, 2, 2, 6, 6),
      b(0, 9, 4, 4, 9, 7),
    ],
  },
  {
    id: 2, name: '扩大破坏', parTime: 60,
    weapons: { tnt: 2, nitroglycerin: 3 },
    objectives: [{ type: 'destroy_count', count: 5 }],
    buildings: [
      b(-9, -8, 4, 3, 7, 2),
      b(0, -12, 3, 4, 10, 0),
      b(8, -6, 2, 2, 5, 4),
      b(-7, 3, 3, 3, 6, 1),
      b(4, 0, 4, 2, 4, 5),
      b(-11, 9, 2, 3, 8, 3),
      b(6, 7, 3, 4, 7, 6),
      b(-3, 10, 4, 4, 5, 7),
    ],
  },
  {
    id: 3, name: '区域清理', parTime: 90,
    weapons: { c4: 2, remote_bomb: 3 },
    objectives: [{ type: 'clear_area', radius: 10, center: { x: 0, z: 0 } }],
    buildings: [
      b(-6, -6, 3, 3, 6, 3),
      b(5, -4, 4, 2, 5, 1),
      b(-3, 4, 2, 3, 7, 5),
      b(6, 6, 3, 4, 8, 0),
      b(-10, -10, 2, 2, 4, 2),
      b(10, -10, 4, 3, 6, 4),
      b(-10, 12, 3, 2, 5, 6),
      b(12, 8, 2, 4, 9, 7),
    ],
  },
  {
    id: 4, name: '争分夺秒', parTime: 90,
    weapons: { tnt: 4, c4: 2 },
    objectives: [{ type: 'destroy_targets', targetIds: [1, 3, 5] }],
    restrictions: [{ type: 'time_limit', seconds: 120 }],
    buildings: [
      b(-7, -7, 3, 3, 8, 0),
      b(6, -5, 2, 2, 5, 1),
      b(-5, 3, 4, 2, 6, 2),
      b(7, 6, 2, 3, 7, 3),
      b(0, 0, 3, 4, 10, 4),
      b(-10, 10, 2, 2, 4, 5),
      b(10, -8, 3, 3, 5, 6),
      b(-2, 12, 4, 4, 6, 7),
    ],
  },
  {
    id: 5, name: '终极挑战', parTime: 120,
    weapons: { c4: 3, nuke: 1 },
    objectives: [
      { type: 'clear_area', radius: 12, center: { x: 0, z: 0 } },
      { type: 'destroy_targets', targetIds: [7, 8] },
    ],
    restrictions: [{ type: 'no_weapon', weapon: 'tnt' }],
    buildings: [
      b(-10, -8, 3, 3, 6, 3),
      b(8, -9, 4, 2, 5, 1),
      b(-4, -5, 2, 3, 7, 5),
      b(5, -4, 3, 4, 8, 0),
      b(-8, 5, 4, 2, 4, 2),
      b(9, 3, 2, 2, 5, 4),
      b(-12, 10, 2, 4, 9, 6),
      b(12, 12, 3, 3, 10, 7),
      b(-3, 9, 4, 3, 6, 0),
      b(0, 0, 2, 2, 4, 1),
    ],
  },
];

// ============================================================
// State
// ============================================================

let phase: GamePhase = 'menu';
let levelState: LevelState | null = null;
let progress: ProgressData;

export function initLevelSystem(): void {
  progress = loadProgress();
}

export function getPhase(): GamePhase {
  return phase;
}

export function getLevelState(): LevelState | null {
  return levelState;
}

export function getProgress(): ProgressData {
  return progress;
}

export function startLevel(id: number): LevelConfig | null {
  const config = LEVELS.find(l => l.id === id);
  if (!config) return null;

  levelState = {
    config,
    elapsedTime: 0,
    remainingWeapons: { ...config.weapons },
    destroyedObjectIds: new Set(),
    objectiveStatus: new Array(config.objectives.length).fill(false),
  };
  phase = 'playing';
  return config;
}

export function updateLevelTimer(dt: number): void {
  if (phase !== 'playing' || !levelState) return;
  levelState.elapsedTime += dt;

  const timeLimit = levelState.config.restrictions?.find(
    (r): r is { type: 'time_limit'; seconds: number } => r.type === 'time_limit'
  );
  if (timeLimit && levelState.elapsedTime >= timeLimit.seconds) {
    phase = 'failed';
    recordFail();
  }
}

export function checkObjectives(): boolean {
  if (phase !== 'playing' || !levelState) return false;

  const { config, destroyedObjectIds } = levelState;
  let allComplete = true;

  for (let i = 0; i < config.objectives.length; i++) {
    const obj = config.objectives[i];
    let complete = false;

    switch (obj.type) {
      case 'destroy_targets':
        complete = obj.targetIds.every(id => destroyedObjectIds.has(id));
        break;
      case 'destroy_count':
        complete = destroyedObjectIds.size >= obj.count;
        break;
      case 'clear_area':
        complete = checkClearArea(obj.center.x, obj.center.z, obj.radius, destroyedObjectIds);
        break;
    }

    levelState.objectiveStatus[i] = complete;
    if (!complete) allComplete = false;
  }

  if (allComplete) {
    phase = 'complete';
    recordComplete();
  }

  return allComplete;
}

function checkClearArea(
  cx: number, cz: number, radius: number,
  destroyedIds: Set<number>,
): boolean {
  const config = levelState!.config;
  for (let i = 0; i < config.buildings.length; i++) {
    const b = config.buildings[i];
    const dist = Math.sqrt((b.x - cx) ** 2 + (b.z - cz) ** 2);
    if (dist <= radius && !destroyedIds.has(i + 1)) {
      return false;
    }
  }
  return true;
}

export function checkFailCondition(): boolean {
  if (phase !== 'playing' || !levelState) return false;

  const { remainingWeapons, config } = levelState;
  const hasWeapons = Object.values(remainingWeapons).some(v => v > 0);
  if (hasWeapons) return false;

  phase = 'failed';
  recordFail();
  return true;
}

// ============================================================
// Stars
// ============================================================

export function calcStars(): number {
  if (!levelState || phase !== 'complete') return 0;

  let stars = 0;

  if (levelState.objectiveStatus.every(s => s)) stars += 1;

  let totalRemaining = 0;
  let totalInitial = 0;
  for (const [type, count] of Object.entries(levelState.config.weapons)) {
    totalInitial += count;
    totalRemaining += levelState.remainingWeapons[type] ?? 0;
  }
  if (totalInitial > 0 && totalRemaining / totalInitial >= 0.3) stars += 1;

  if (levelState.elapsedTime <= levelState.config.parTime * 0.6) stars += 1;

  return stars;
}

// ============================================================
// Persistence integration
// ============================================================

function recordComplete(): void {
  if (!levelState) return;
  const id = levelState.config.id;
  const stars = calcStars();
  const existing = progress.records[id];

  const newRecord: LevelRecord = {
    bestStars: existing ? Math.max(existing.bestStars, stars) : stars,
    bestTime: existing ? Math.min(existing.bestTime, levelState.elapsedTime) : levelState.elapsedTime,
    failCount: existing?.failCount ?? 0,
    skipped: existing?.skipped ?? false,
    completed: true,
  };

  progress.records[id] = newRecord;

  if (id >= progress.unlockedLevel && id < LEVELS.length) {
    progress.unlockedLevel = id + 1;
  }

  saveProgress(progress);
}

function recordFail(): void {
  if (!levelState) return;
  const id = levelState.config.id;
  const existing = progress.records[id];
  progress.records[id] = {
    bestStars: existing?.bestStars ?? 0,
    bestTime: existing?.bestTime ?? Infinity,
    failCount: (existing?.failCount ?? 0) + 1,
    skipped: existing?.skipped ?? false,
    completed: existing?.completed ?? false,
  };
  saveProgress(progress);
}

export function recordSkip(): void {
  if (!levelState) return;
  const id = levelState.config.id;
  const existing = progress.records[id];
  progress.records[id] = {
    bestStars: existing?.bestStars ?? 0,
    bestTime: existing?.bestTime ?? Infinity,
    failCount: existing?.failCount ?? 0,
    skipped: true,
    completed: existing?.completed ?? false,
  };

  if (id >= progress.unlockedLevel && id < LEVELS.length) {
    progress.unlockedLevel = id + 1;
  }

  saveProgress(progress);
  phase = 'menu';
  levelState = null;
}

export function returnToMenu(): void {
  phase = 'menu';
  levelState = null;
}

export function canPlace(type: string): boolean {
  if (phase !== 'playing' || !levelState) return true;
  return (levelState.remainingWeapons[type] ?? 0) > 0;
}

export function consumeWeapon(type: string): void {
  if (phase !== 'playing' || !levelState) return;
  if (levelState.remainingWeapons[type] && levelState.remainingWeapons[type] > 0) {
    levelState.remainingWeapons[type]--;
  }
}

export function isWeaponRestricted(type: string): boolean {
  if (phase !== 'playing' || !levelState) return false;
  return levelState.config.restrictions?.some(
    (r): r is { type: 'no_weapon'; weapon: string } =>
      r.type === 'no_weapon' && r.weapon === type
  ) ?? false;
}
