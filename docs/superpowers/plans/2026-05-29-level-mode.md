# 关卡模式实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有沙盒模式基础上增加关卡模式，支持 5 关线性推进、三维度星级评价、localStorage 进度持久化。

**Architecture:** 新增 3 个模块文件（persistence.ts、destruction.ts、level.ts），修改 5 个现有文件。persistence 负责存储封装，destruction 提供统一的摧毁事件通道，level 管理关卡配置/状态机/目标检测/星级计算。game.ts 瘦身移除关卡逻辑，scene.ts/physics.ts 增加建筑 ID 和摧毁回调，ui.ts/weaponpanel.ts 增加关卡 UI，main.ts 接入关卡生命周期。

**Tech Stack:** TypeScript + Vite + Three.js + Cannon-es

---

### Task 1: persistence.ts — localStorage 存档模块

**Files:**
- Create: `src/persistence.ts`

- [ ] **Step 1: 创建 persistence.ts 完整文件**

```typescript
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
```

- [ ] **Step 2: 编译验证**

Run: `npx tsc --noEmit`
Expected: 无新增错误（persistence.ts 无外部依赖，应通过编译）

- [ ] **Step 3: Commit**

```bash
git add src/persistence.ts
git commit -m "feat: 新增 persistence.ts localStorage 存档模块"
```

---

### Task 2: destruction.ts — 统一摧毁事件通道

**Files:**
- Create: `src/destruction.ts`

- [ ] **Step 1: 创建 destruction.ts**

```typescript
export type DestroyType = 'building' | 'vehicle' | 'tree';

type DestroyCallback = (type: DestroyType, id: number) => void;

let callback: DestroyCallback | null = null;

export function setDestroyCallback(fn: DestroyCallback): void {
  callback = fn;
}

export function notifyDestroy(type: DestroyType, id: number): void {
  callback?.(type, id);
}
```

- [ ] **Step 2: 编译验证**

Run: `npx tsc --noEmit`
Expected: 无新增错误

- [ ] **Step 3: Commit**

```bash
git add src/destruction.ts
git commit -m "feat: 新增 destruction.ts 统一摧毁事件通道"
```

---

### Task 3: level.ts — 类型定义和 5 关配置

**Files:**
- Create: `src/level.ts`

- [ ] **Step 1: 创建 level.ts（类型 + 配置 + 状态管理 + 目标检测 + 星级计算）**

```typescript
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
      b(-8, -8, 3, 3, 6, 0),  // target id=1
      b(-2, -10, 2, 2, 4, 1),  // target id=2
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
      b(-7, -7, 3, 3, 8, 0),  // target
      b(6, -5, 2, 2, 5, 1),
      b(-5, 3, 4, 2, 6, 2),   // target
      b(7, 6, 2, 3, 7, 3),
      b(0, 0, 3, 4, 10, 4),   // target
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
      b(-12, 10, 2, 4, 9, 6), // target
      b(12, 12, 3, 3, 10, 7), // target
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

  // Check time_limit restriction
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
  // All buildings in the area must be destroyed
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

  // No weapons left - check if objectives are still achievable
  // If any placed explosives remain, they might still complete objectives
  // For now: weapons gone = fail
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

  // Star 1: All objectives complete
  if (levelState.objectiveStatus.every(s => s)) stars += 1;

  // Star 2: Remaining weapons >= 30% of initial
  let totalRemaining = 0;
  let totalInitial = 0;
  for (const [type, count] of Object.entries(levelState.config.weapons)) {
    totalInitial += count;
    totalRemaining += levelState.remainingWeapons[type] ?? 0;
  }
  if (totalInitial > 0 && totalRemaining / totalInitial >= 0.3) stars += 1;

  // Star 3: Time <= parTime * 0.6
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

  // Unlock next level
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

  // Unlock next level even on skip
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
  if (phase !== 'playing' || !levelState) return true; // sandbox
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
```

- [ ] **Step 2: 编译验证**

Run: `npx tsc --noEmit`
Expected: 无新增错误

- [ ] **Step 3: Commit**

```bash
git add src/level.ts
git commit -m "feat: 新增 level.ts 关卡类型定义/5关配置/状态机/目标检测/星级计算"
```

---

### Task 4: game.ts 清理

**Files:**
- Modify: `src/game.ts`

- [ ] **Step 1: 移除 game.ts 中已迁移到 level.ts 的代码**

需要删除的行：`LevelConfig` 接口（第 64-68 行）、`LEVELS` 数组（第 70-73 行）、`currentMode`/`currentLevel`/`remainingExplosives`（第 75-77 行）、`setMode()`（第 79-87 行）、`loadLevel()`（第 89-92 行）、`canPlace()`（第 94-98 行）、`consumeExplosive()`（第 99-104 行）、`getMode()`/`getRemaining()`/`getCurrentLevel()`/`GameMode`（第 62, 106-109 行）。

保留：`PlacedExplosiveData`、`placedExplosives`、`FRAGMENT_THRESHOLD`、`placeExplosive()`、`detonateAll()`、遥控炸弹相关、地雷相关。

```typescript
// game.ts — 完整清理后内容
import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { applyExplosion, fragmentBuilding, DebrisPiece, PhysicsBody, getWorld } from './physics';
import {
  spawnNitroglycerinEffect,
  spawnTntEffect,
  spawnC4Effect,
  spawnNukeEffect,
} from './effects';
import { EXPLOSIVE_DEFS, ExplosiveDef, REMOTE_RADIUS, REMOTE_FORCE, MINE_RADIUS, MINE_FORCE } from './constants';
import { getScene } from './renderer';

interface PlacedExplosiveData {
  position: CANNON.Vec3;
  type: string;
  def: ExplosiveDef;
}

let placedExplosives: PlacedExplosiveData[] = [];
const FRAGMENT_THRESHOLD = 300;

export function placeExplosive(type: string, position: CANNON.Vec3): void {
  const def = EXPLOSIVE_DEFS[type];
  if (!def) return;
  placedExplosives.push({ position: position.clone(), type, def });
}

export function detonateAll(
  physicsBodies: PhysicsBody[],
  debrisList: DebrisPiece[],
  scene: THREE.Scene,
): void {
  for (const exp of placedExplosives) {
    const { position, def, type } = exp;

    for (const pb of physicsBodies) {
      const dist = pb.body.position.distanceTo(position);
      if (dist < def.radius) {
        const forceMag = def.baseForce / (1 + (dist * dist) / (def.radius * def.radius));
        if (forceMag > FRAGMENT_THRESHOLD && pb.isBuilding) {
          fragmentBuilding(
            pb.body, pb.mesh as THREE.Mesh,
            physicsBodies, debrisList, scene,
          );
        }
      }
    }

    applyExplosion({ position, radius: def.radius, baseForce: def.baseForce });

    const pos3 = new THREE.Vector3(exp.position.x, 1, exp.position.z);
    switch (type) {
      case 'nitroglycerin': spawnNitroglycerinEffect(pos3); break;
      case 'c4': spawnC4Effect(pos3); break;
      case 'nuke': spawnNukeEffect(pos3); break;
      default: spawnTntEffect(pos3); break;
    }
  }
  placedExplosives = [];
}

// Remote bombs: grouped detonation
interface RemoteBomb {
  position: CANNON.Vec3;
  group: number;
  mesh: THREE.Mesh;
}

const remoteBombs: RemoteBomb[] = [];

export function placeRemoteBomb(
  position: CANNON.Vec3,
  group: number,
  mesh: THREE.Mesh,
): void {
  remoteBombs.push({ position: position.clone(), group, mesh });
}

export function detonateGroup(group: number): THREE.Vector3[] {
  const positions: THREE.Vector3[] = [];
  for (let i = remoteBombs.length - 1; i >= 0; i--) {
    const bomb = remoteBombs[i];
    if (bomb.group === group) {
      applyExplosion({ position: bomb.position, radius: REMOTE_RADIUS, baseForce: REMOTE_FORCE });
      positions.push(new THREE.Vector3(bomb.position.x, 1, bomb.position.z));
      bomb.mesh.removeFromParent();
      bomb.mesh.geometry.dispose();
      (bomb.mesh.material as THREE.Material).dispose();
      remoteBombs.splice(i, 1);
    }
  }
  return positions;
}

export function clearRemoteBombs(): void {
  for (const bomb of remoteBombs) {
    bomb.mesh.removeFromParent();
    bomb.mesh.geometry.dispose();
    (bomb.mesh.material as THREE.Material).dispose();
  }
  remoteBombs.length = 0;
}

// Mines: proximity detection
interface MineData {
  position: CANNON.Vec3;
  mesh: THREE.Group;
  armed: boolean;
}

const mines: MineData[] = [];

export function placeMine(position: CANNON.Vec3, mesh: THREE.Group): void {
  mines.push({ position: position.clone(), mesh, armed: false });
}

export function updateMines(dt: number): Array<{ position: CANNON.Vec3; mesh: THREE.Group }> {
  const triggered: Array<{ position: CANNON.Vec3; mesh: THREE.Group }> = [];
  const world = getWorld();

  for (let i = mines.length - 1; i >= 0; i--) {
    const mine = mines[i];

    if (!mine.armed) {
      mine.armed = true;
      continue;
    }

    let triggered_ = false;
    for (const body of world.bodies) {
      if (body.mass === 0) continue;
      const dist = body.position.distanceTo(mine.position);
      if (dist < 1.5) {
        triggered_ = true;
        break;
      }
    }

    if (triggered_) {
      applyExplosion({ position: mine.position, radius: MINE_RADIUS, baseForce: MINE_FORCE });
      triggered.push({ position: mine.position, mesh: mine.mesh });
      mines.splice(i, 1);
    }
  }

  return triggered;
}

export function clearMines(): void {
  for (const mine of mines) {
    mine.mesh.removeFromParent();
    mine.mesh.traverse((c) => {
      if (c instanceof THREE.Mesh) { c.geometry.dispose(); (c.material as THREE.Material).dispose(); }
    });
  }
  mines.length = 0;
}

export function clearPlacedExplosives(): void {
  placedExplosives.length = 0;
}
```

- [ ] **Step 2: 编译验证 + 修复引用**

Run: `npx tsc --noEmit`
Expected: main.ts 会有错误（引用了已删除的 `setMode`/`canPlace`/`consumeExplosive` 等），这些将在后续 Task 修复。确认 game.ts 本身无编译错误即可。

- [ ] **Step 3: Commit**

```bash
git add src/game.ts
git commit -m "refactor: game.ts 移除关卡配置到 level.ts，保留爆炸/地雷/遥控核心逻辑"
```

---

### Task 5: scene.ts — 建筑 ID + 摧毁回调 + 场景重置

**Files:**
- Modify: `src/scene.ts`

- [ ] **Step 1: 修改 scene.ts**

需要改动的关键点：
1. 给 Building 接口增加 `id` 字段
2. 增加 `buildingIdCounter` 和 `clearScene()` 函数
3. 修改 `createBuildings()` 和 `createSingleBuilding()` 分配 ID
4. 新增 `buildFromLayout()` 使用关卡布局数据
5. 在 `removeAllExplosives` 之前先清理所有场景物体
6. 增加对 vehicles/trees/constructs 的追踪（ID 分配给可摧毁物体）

```typescript
// scene.ts — 新增/修改部分

// 在文件顶部 import 之后添加：
import { notifyDestroy, DestroyType } from './destruction';

// 修改 Building 接口（约第 15 行），增加 id：
interface Building {
  mesh: THREE.Mesh;
  width: number;
  depth: number;
  height: number;
  id: number;
}

// 新增：
interface TrackedObject {
  type: DestroyType;
  id: number;
  mesh: THREE.Mesh | THREE.Group;
  body: CANNON.Body;
}

export const trackedObjects: TrackedObject[] = [];

let nextId = 1;

export function resetIdCounter(): void {
  nextId = 1;
}

// 新增：清除所有场景物体
export function clearScene(): void {
  const scene = getScene();
  const world = getWorld();

  // Remove buildings
  for (const b of buildings) {
    scene.remove(b.mesh);
    b.mesh.geometry.dispose();
    (b.mesh.material as THREE.Material).dispose();
  }
  buildings.length = 0;

  // Remove vehicles
  for (const v of vehicles) {
    scene.remove(v.body);
    v.body.traverse((c) => {
      if (c instanceof THREE.Mesh) { c.geometry.dispose(); (c.material as THREE.Material).dispose(); }
    });
  }
  vehicles.length = 0;

  // Remove tracked objects
  for (const t of trackedObjects) {
    scene.remove(t.mesh);
    if (t.mesh instanceof THREE.Mesh) {
      t.mesh.geometry.dispose();
      (t.mesh.material as THREE.Material).dispose();
    } else {
      t.mesh.traverse((c) => {
        if (c instanceof THREE.Mesh) { c.geometry.dispose(); (c.material as THREE.Material).dispose(); }
      });
    }
    world.removeBody(t.body);
  }
  trackedObjects.length = 0;

  // Remove physics bodies
  for (const pb of physicsBodies) {
    world.removeBody(pb.body);
  }
  physicsBodies.length = 0;

  // Remove all explosives
  removeAllExplosives();
  clearPlacedExplosives();
  clearRemoteBombs();
  clearMines();

  resetIdCounter();
}

// 新增：从布局数据创建建筑
import { BuildingDef } from './level';

export function buildFromLayout(layout: BuildingDef[]): void {
  const scene = getScene();

  for (const def of layout) {
    const geo = new THREE.BoxGeometry(def.w, def.h, def.d);
    const mat = new THREE.MeshToonMaterial({ color: def.color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.set(def.x, def.h / 2, def.z);
    scene.add(mesh);

    const body = createBuildingBody(def.w, def.h, def.d, def.x, def.z);
    const id = nextId++;
    physicsBodies.push({ body, mesh, isBuilding: true, objectId: id });
    buildings.push({ mesh, width: def.w, depth: def.d, height: def.h, id });

    trackedObjects.push({ type: 'building', id, mesh, body });
  }
}

// 修改 createBuildings()（原第 29-60 行），为每个建筑分配 ID：
// 在 buildings.push 前增加 id 的分配
// 替换 createBuildings 中的相应部分，给每个建筑 mesh 加 userData.id

// 修改 createSingleBuilding()（原第 215-233 行），同样分配 ID
```

等等，这需要修改 physics.ts 的 PhysicsBody 接口来包含 objectId。让我重新整理这一部分...

实际上，为了防止计划过于复杂，让我简化设计：

- buildingId 通过 `mesh.userData.id` 存储（Three.js 内置机制）
- 摧毁回调在 `fragmentBuilding()` 中通过 `mesh.userData.id` 读取
- trackedObjects 不必要，用 mesh.userData 就够了

让我重写 Task 5。

- [ ] **Step 1: 修改 physics.ts 的 PhysicsBody 接口和 fragmentBuilding**

在 physics.ts 中：
- PhysicsBody 增加 `objectId?: number` 字段
- fragmentBuilding 在摧毁建筑前调用 `notifyDestroy('building', body.objectId || 0)`

```typescript
// physics.ts — PhysicsBody 接口修改（约第 27 行）：
export interface PhysicsBody {
  body: CANNON.Body;
  mesh: THREE.Mesh | THREE.Group;
  isBuilding: boolean;
  isTree?: boolean;
  objectId?: number;  // 新增
}

// physics.ts — fragmentBuilding 开头新增（约第 88 行后）：
import { notifyDestroy } from './destruction';

export function fragmentBuilding(
  body: CANNON.Body,
  mesh: THREE.Mesh,
  physicsBodies: PhysicsBody[],
  debrisList: DebrisPiece[],
  scene: THREE.Scene,
): void {
  // 查找 PhysicsBody 获取 objectId
  const pb = physicsBodies.find(p => p.body === body);
  if (pb?.objectId !== undefined) {
    notifyDestroy('building', pb.objectId);
  }

  const pos = body.position.clone();
  // ... 原有代码不变
```

- [ ] **Step 2: 修改 scene.ts 的 createBuildings 分配 ID**

```typescript
// scene.ts 文件顶部新增 import
import { BuildingDef } from './level';

// 新增变量
let nextId = 1;

export function resetIdCounter(): void {
  nextId = 1;
}

// 修改 createBuildings 循环体（约第 38-59 行），增加 id：
for (let i = 0; i < positions.length; i++) {
  const w = rand(BUILDING_MIN_WIDTH, BUILDING_MAX_WIDTH);
  const d = rand(BUILDING_MIN_DEPTH, BUILDING_MAX_DEPTH);
  const h = rand(BUILDING_MIN_HEIGHT, BUILDING_MAX_HEIGHT);
  const color = BUILDING_COLORS[i % BUILDING_COLORS.length];

  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshToonMaterial({ color });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const pos = positions[i];
  mesh.position.set(pos.x, h / 2, pos.z);
  scene.add(mesh);

  const body = createBuildingBody(w, h, d, pos.x, pos.z);
  const id = nextId++;
  physicsBodies.push({ body, mesh, isBuilding: true, objectId: id });
  buildings.push({ mesh, width: w, depth: d, height: h, id });
}
```

- [ ] **Step 3: 修改 scene.ts 的 createSingleBuilding 分配 ID**

```typescript
// createSingleBuilding（约第 215-233 行），最后两行改为：
  const body = createBuildingBody(w, h, d, x, z);
  const id = nextId++;
  physicsBodies.push({ body, mesh, isBuilding: true, objectId: id });
  buildings.push({ mesh, width: w, depth: d, height: h, id });
```

- [ ] **Step 4: 修改 scene.ts 的 createSingleVehicle/createSingleTree 分配 ID**

车辆和树木也需要 objectId 以支持 destroy_count 计数：

```typescript
// createSingleVehicle — 在 physicsBodies.push 时增加 objectId
  vehicleBody.position.set(x, 0.7, z);
  vehicleBody.linearDamping = 0.3;
  vehicleBody.angularDamping = 0.3;
  getWorld().addBody(vehicleBody);
  const vid = nextId++;
  physicsBodies.push({ body: vehicleBody, mesh: group, isBuilding: false, objectId: vid });
  vehicles.push({ body: group, x, z });

// createSingleTree — 同理
  treeBody.position.set(x, 0.75, z);
  treeBody.linearDamping = 0.4;
  treeBody.angularDamping = 0.4;
  getWorld().addBody(treeBody);
  const tid = nextId++;
  physicsBodies.push({ body: treeBody, mesh: tree, isBuilding: false, isTree: true, objectId: tid });
```

- [ ] **Step 5: 新增 scene.ts 的 clearScene 和 buildFromLayout**

在 scene.ts 末尾添加：

```typescript
export function clearScene(): void {
  const scene = getScene();
  const world = getWorld();

  for (const b of buildings) {
    scene.remove(b.mesh);
    b.mesh.geometry.dispose();
    (b.mesh.material as THREE.Material).dispose();
  }
  buildings.length = 0;

  for (const v of vehicles) {
    scene.remove(v.body);
    v.body.traverse((c) => {
      if (c instanceof THREE.Mesh) { c.geometry.dispose(); (c.material as THREE.Material).dispose(); }
    });
  }
  vehicles.length = 0;

  for (const pb of physicsBodies) {
    world.removeBody(pb.body);
  }
  physicsBodies.length = 0;

  removeAllExplosives();
  clearPlacedExplosives();
  clearRemoteBombs();
  clearMines();

  resetIdCounter();
}

export function buildFromLayout(layout: BuildingDef[]): void {
  const scene = getScene();

  for (const def of layout) {
    const geo = new THREE.BoxGeometry(def.w, def.h, def.d);
    const mat = new THREE.MeshToonMaterial({ color: def.color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.set(def.x, def.h / 2, def.z);
    scene.add(mesh);

    const body = createBuildingBody(def.w, def.h, def.d, def.x, def.z);
    const id = nextId++;
    physicsBodies.push({ body, mesh, isBuilding: true, objectId: id });
    buildings.push({ mesh, width: def.w, depth: def.d, height: def.h, id });
  }
}
```

注意：`clearScene` 调用了 `clearPlacedExplosives`/`clearRemoteBombs`/`clearMines`，这些来自 game.ts。scene.ts 需要导入它们，或者 main.ts 在调用 clearScene 后单独调用这些清理函数。

为了简单，让 `clearScene` 不调用 game.ts 的函数，由 main.ts 负责完整清理：

```typescript
export function clearScene(): void {
  const scene = getScene();
  const world = getWorld();

  for (const b of buildings) {
    scene.remove(b.mesh);
    b.mesh.geometry.dispose();
    (b.mesh.material as THREE.Material).dispose();
  }
  buildings.length = 0;

  for (const v of vehicles) {
    scene.remove(v.body);
    v.body.traverse((c) => {
      if (c instanceof THREE.Mesh) { c.geometry.dispose(); (c.material as THREE.Material).dispose(); }
    });
  }
  vehicles.length = 0;

  for (const pb of physicsBodies) {
    world.removeBody(pb.body);
  }
  physicsBodies.length = 0;

  removeAllExplosives();
  resetIdCounter();
}
```

- [ ] **Step 6: 编译验证**

Run: `npx tsc --noEmit`
Expected: 检查 scene.ts 和 physics.ts 相关编译错误，逐一修复

- [ ] **Step 7: Commit**

```bash
git add src/scene.ts src/physics.ts
git commit -m "feat: scene.ts/physics.ts 增加建筑ID追踪+摧毁回调+场景重置+布局构建"
```

---

### Task 6: ui.ts — 关卡 HUD + 结算弹窗

**Files:**
- Modify: `src/ui.ts`

- [ ] **Step 1: 重写 ui.ts**

```typescript
import { getPhase, getLevelState, calcStars, getProgress, GamePhase } from './level';

export interface UIState {
  selectedExplosive: string;
  score: number;
}

export function createUI(container: HTMLElement): UIState {
  const state: UIState = { selectedExplosive: 'tnt', score: 0 };

  // Top bar
  const topBar = document.createElement('div');
  topBar.id = 'top-bar';
  topBar.style.cssText = `
    position: absolute; top: 0; left: 0; right: 0;
    display: flex; justify-content: space-between; align-items: center;
    padding: 8px 16px; background: rgba(0,0,0,0.6); color: #fff;
    font-size: 14px; z-index: 10; pointer-events: none;
  `;
  topBar.innerHTML = `
    <span id="explosive-info">TNT</span>
    <span id="level-info" style="display:none;"></span>
    <span id="score-text">得分: 0</span>
  `;
  container.appendChild(topBar);

  // Result popup container
  const popup = document.createElement('div');
  popup.id = 'result-popup';
  popup.style.cssText = `
    position: absolute; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.7); display: none;
    justify-content: center; align-items: center; z-index: 30;
  `;
  container.appendChild(popup);

  return state;
}

export function updateUI(container: HTMLElement, state: UIState): void {
  const infoEl = container.querySelector('#explosive-info');
  const levelInfoEl = container.querySelector<HTMLElement>('#level-info');
  const scoreEl = container.querySelector('#score-text');

  const phase = getPhase();
  const ls = getLevelState();

  if (phase === 'playing' && ls) {
    if (infoEl) infoEl.style.display = 'none';
    if (levelInfoEl) {
      levelInfoEl.style.display = '';
      const total = Object.values(ls.config.weapons).reduce((a, b) => a + b, 0);
      const remain = Object.values(ls.remainingWeapons).reduce((a, b) => a + b, 0);
      const mins = Math.floor(ls.elapsedTime / 60);
      const secs = Math.floor(ls.elapsedTime % 60);
      const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      const progress = getProgress();
      const best = progress.records[ls.config.id]?.bestStars ?? 0;
      levelInfoEl.textContent = `${ls.config.name} | 🎯 武器 ${remain}/${total} | ⏱ ${timeStr} | ⭐ ${best}`;
    }
    if (scoreEl) scoreEl.style.display = 'none';
  } else if (phase === 'menu') {
    if (infoEl) infoEl.style.display = '';
    if (infoEl) infoEl.textContent = `当前: ${state.selectedExplosive.toUpperCase()}`;
    if (levelInfoEl) levelInfoEl.style.display = 'none';
    if (scoreEl) scoreEl.style.display = '';
    if (scoreEl) scoreEl.textContent = `得分: ${state.score}`;
  } else {
    if (infoEl) infoEl.style.display = '';
    if (levelInfoEl) levelInfoEl.style.display = 'none';
    if (scoreEl) scoreEl.style.display = '';
  }
}

export function showResultPopup(
  container: HTMLElement,
  success: boolean,
  onNext: (() => void) | null,
  onRetry: () => void,
  onMenu: () => void,
  onSkip: (() => void) | null,
): void {
  const popup = container.querySelector<HTMLElement>('#result-popup');
  if (!popup) return;

  const ls = getLevelState();
  if (!ls) return;

  if (success) {
    const stars = calcStars();
    const mins = Math.floor(ls.elapsedTime / 60);
    const secs = Math.floor(ls.elapsedTime % 60);
    const remain = Object.values(ls.remainingWeapons).reduce((a, b) => a + b, 0);

    popup.innerHTML = `
      <div style="background:#222;padding:32px;border-radius:12px;text-align:center;color:#fff;min-width:300px;">
        <div style="font-size:40px;margin-bottom:8px;">${'⭐'.repeat(stars)}</div>
        <h3 style="margin:0 0 8px;">${ls.config.name} 通关！</h3>
        <p style="color:#aaa;font-size:13px;margin:0 0 20px;">
          用时 ${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')} | 剩余武器 ${remain}
        </p>
        <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
          ${onNext ? '<button id="btn-next" style="padding:10px 20px;background:#4caf50;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px;">下一关 ▶</button>' : ''}
          <button id="btn-retry" style="padding:10px 20px;background:#2196f3;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px;">重玩</button>
          <button id="btn-menu" style="padding:10px 20px;background:#555;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px;">返回列表</button>
        </div>
      </div>
    `;
  } else {
    const failCount = getProgress().records[ls.config.id]?.failCount ?? 0;
    popup.innerHTML = `
      <div style="background:#222;padding:32px;border-radius:12px;text-align:center;color:#fff;min-width:300px;">
        <h3 style="margin:0 0 8px;">${ls.config.name} 失败</h3>
        <p style="color:#aaa;font-size:13px;margin:0 0 20px;">武器耗尽，目标未达成</p>
        <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
          <button id="btn-retry" style="padding:10px 20px;background:#f44336;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px;">重试</button>
          ${onSkip ? '<button id="btn-skip" style="padding:10px 20px;background:#ff9800;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px;">跳过此关</button>' : ''}
          <button id="btn-menu" style="padding:10px 20px;background:#555;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px;">返回列表</button>
        </div>
        ${failCount > 0 ? `<p style="color:#888;font-size:11px;margin-top:12px;">失败 ${failCount} 次${onSkip ? '' : '（需5次才能跳过）'}</p>` : ''}
      </div>
    `;
  }

  popup.style.display = 'flex';

  // Bind buttons
  popup.querySelector('#btn-next')?.addEventListener('click', () => { hidePopup(popup); onNext?.(); });
  popup.querySelector('#btn-retry')?.addEventListener('click', () => { hidePopup(popup); onRetry(); });
  popup.querySelector('#btn-menu')?.addEventListener('click', () => { hidePopup(popup); onMenu(); });
  popup.querySelector('#btn-skip')?.addEventListener('click', () => { hidePopup(popup); onSkip?.(); });
}

function hidePopup(popup: HTMLElement): void {
  popup.style.display = 'none';
  popup.innerHTML = '';
}
```

- [ ] **Step 2: 编译验证**

Run: `npx tsc --noEmit`
Expected: 无新增错误（level.ts 已存在，ui.ts 正确导入）

- [ ] **Step 3: Commit**

```bash
git add src/ui.ts
git commit -m "feat: ui.ts 增加关卡HUD显示+通关/失败结算弹窗"
```

---

### Task 7: weaponpanel.ts — 模式切换 + 关卡列表 + 重置进度

**Files:**
- Modify: `src/weaponpanel.ts`

- [ ] **Step 1: 修改 weaponpanel.ts**

需要改动：
1. 模式按钮点击时调用 `startLevel()` / `returnToMenu()`
2. 关卡模式下显示关卡列表
3. 底部增加重置进度按钮

由于改动较大，需要整体重写部分逻辑。关键修改点：

```typescript
// weaponpanel.ts — 新增 import
import { LEVELS, startLevel, returnToMenu, getPhase, GamePhase, getProgress, recordSkip, initLevelSystem, getLevelState } from './level';
import { resetProgress } from './persistence';
import { clearScene } from './scene';

// 在 createWeaponPanel 函数末尾、btnContainer 构建之前，添加关卡列表区域：
const levelList = document.createElement('div');
levelList.id = 'level-list';
levelList.style.cssText = `
  margin-top: 12px; border-top: 1px solid rgba(255,255,255,0.15); padding-top: 12px;
  display: none;
`;
const levelTitle = document.createElement('div');
levelTitle.textContent = '关卡列表';
levelTitle.style.cssText = 'font-size: 11px; color: #aaa; margin-bottom: 8px;';
levelList.appendChild(levelTitle);

const levelGrid = document.createElement('div');
levelGrid.style.cssText = 'display: flex; gap: 6px; flex-wrap: wrap;';
levelList.appendChild(levelGrid);
panel.appendChild(levelList);

// 刷新关卡列表函数
function refreshLevelList(): void {
  const progress = getProgress();
  levelGrid.innerHTML = '';

  for (const level of LEVELS) {
    const record = progress.records[level.id];
    const unlocked = level.id <= progress.unlockedLevel;
    const card = document.createElement('div');
    card.style.cssText = `
      padding: 6px 10px; border-radius: 6px; font-size: 11px;
      cursor: ${unlocked ? 'pointer' : 'default'};
      background: ${unlocked ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.03)'};
      opacity: ${unlocked ? '1' : '0.4'}; text-align: center;
    `;

    if (record?.completed) {
      card.textContent = `${level.id} ${'⭐'.repeat(record.bestStars)}`;
      card.style.background = 'rgba(76,175,80,0.3)';
    } else if (record?.skipped) {
      card.textContent = `${level.id} ⏭`;
      card.style.background = 'rgba(255,152,0,0.3)';
    } else if (unlocked) {
      card.textContent = `${level.id}`;
    } else {
      card.textContent = `${level.id} 🔒`;
    }

    if (unlocked) {
      card.addEventListener('click', () => {
        // Dispatch level start event
        window.dispatchEvent(new CustomEvent('level-start', { detail: { id: level.id } }));
      });
    }
    levelGrid.appendChild(card);
  }
}

// 刷新函数暴露到全局以在模式切换时调用
(window as any).__refreshLevelList = refreshLevelList;
```

- [ ] **Step 2: 修改模式按钮逻辑**

替换模式按钮（原约第 143-158 行）的 click 处理：

```typescript
modeBtn.addEventListener('click', () => {
  const phase = getPhase();
  if (phase === 'menu') {
    // 切换到关卡模式时显示关卡列表
    levelList.style.display = '';
    refreshLevelList();
    modeBtn.textContent = '沙盒';
    modeBtn.style.background = '#4caf50';
  } else {
    // 返回沙盒/菜单（不变）
    // 当前在关卡中，点击切回沙盒
  }
});
```

实际上，模式按钮的逻辑应该更简单：切换模式时切换 UI 展示。

让我重新设计：面板上始终显示模式按钮和关卡列表。模式按钮在 `menu` 状态时显示"关卡"，点击后显示关卡列表（但不自动开始关卡）。在 `playing` 状态时显示"退出"，点击后返回菜单。

更新设计——modeBtn 的点击逻辑：

```typescript
modeBtn.addEventListener('click', () => {
  const phase = getPhase();
  if (phase === 'playing') {
    returnToMenu();
    modeBtn.textContent = '关卡';
    modeBtn.style.background = '#ff9800';
    levelList.style.display = 'none';
  } else {
    // Show level list
    levelList.style.display = levelList.style.display === 'none' ? '' : 'none';
    if (levelList.style.display !== 'none') refreshLevelList();
    modeBtn.textContent = levelList.style.display !== 'none' ? '隐藏' : '关卡';
  }
});
```

- [ ] **Step 3: 添加重置进度按钮**

```typescript
const resetProgressBtn = document.createElement('button');
resetProgressBtn.textContent = '重置进度';
resetProgressBtn.style.cssText = `
  width: 100%; padding: 6px; background: #c62828; color: #fff;
  border: none; border-radius: 4px; font-size: 11px; cursor: pointer;
  margin-top: 8px;
`;
resetProgressBtn.addEventListener('click', () => {
  if (confirm('确定要重置所有关卡进度吗？此操作不可撤销。')) {
    resetProgress();
    initLevelSystem(); // 重新加载默认进度
    refreshLevelList();
    returnToMenu();
  }
});
btnContainer.appendChild(resetProgressBtn);
```

- [ ] **Step 4: 编译验证**

Run: `npx tsc --noEmit`
Expected: 修复 weaponpanel.ts 相关的类型错误

- [ ] **Step 5: Commit**

```bash
git add src/weaponpanel.ts
git commit -m "feat: weaponpanel.ts 模式切换+关卡列表+重置进度按钮"
```

---

### Task 8: main.ts — 集成关卡生命周期

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: 修改 main.ts 的 import 和初始化**

```typescript
// 新增 import
import { setDestroyCallback } from './destruction';
import { initLevelSystem, startLevel, updateLevelTimer, checkObjectives, checkFailCondition, getPhase, getLevelState, recordSkip, returnToMenu, canPlace, consumeWeapon, isWeaponRestricted } from './level';
import { clearScene, buildFromLayout } from './scene';

// 在 createScene() 之后、initLevelSystem() 调用：
initLevelSystem();
```

- [ ] **Step 2: 设置摧毁回调**

在 `animate()` 之前设置回调：

```typescript
setDestroyCallback((type, id) => {
  const ls = getLevelState();
  if (ls && getPhase() === 'playing') {
    ls.destroyedObjectIds.add(id);
  }
});
```

- [ ] **Step 3: 修改 placeItem 函数，增加关卡模式检查**

```typescript
function placeItem(type: string, x: number, z: number): void {
  // Check level restrictions
  if (isWeaponRestricted(type)) return;
  if (!canPlace(type)) return;

  const pos = new CANNON.Vec3(x, 0, z);
  const pos3 = new THREE.Vector3(x, 1, z);

  switch (type) {
    case 'tnt':
    case 'c4':
    case 'nitroglycerin':
    case 'nuke':
      placeExplosive(type, pos);
      createExplosiveMesh(type, pos);
      break;
    case 'remote_bomb': {
      const mesh = createRemoteBombModel(x, z);
      placeRemoteBomb(pos, placedCount % 3, mesh);
      placedCount++;
      break;
    }
    case 'mine': {
      const mesh = createMineModel(x, z);
      placeMine(pos, mesh);
      break;
    }
    case 'incendiary': spawnIncendiaryEffect(pos3, physicsBodies); break;
    case 'smoke': spawnSmokeEffect(pos3); break;
    case 'flash': spawnFlashEffect(pos3); break;
    case 'building': createSingleBuilding(x, z); break;
    case 'vehicle': createSingleVehicle(x, z); break;
    case 'tree': createSingleTree(x, z); break;
    case 'sandbag': createSandbag(x, z); break;
    case 'barricade': createBarricade(x, z); break;
  }

  // Consume weapon in level mode
  consumeWeapon(type);
}
```

- [ ] **Step 4: 监听关卡启动事件和修改 animate 循环**

添加关卡启动事件监听（在现有 `window.addEventListener` 区域）：

```typescript
window.addEventListener('level-start', ((e: CustomEvent) => {
  const id = e.detail.id;
  clearScene();
  for (const d of debrisList) {
    world.removeBody(d.body);
    scene.remove(d.mesh);
    d.mesh.geometry.dispose();
    (d.mesh.material as THREE.Material).dispose();
  }
  debrisList.length = 0;
  resultPopupShown = false;

  const config = startLevel(id);
  if (config) {
    buildFromLayout(config.buildings);
    createVehicles();
    createDecorations();
  }
}) as EventListener);
```

修改 `animate()` 函数中的关卡逻辑（在 `handleClick()` 之后，`world.step()` 之前）。

将 `resultPopupShown` 变量定义在 `animate()` 之前的顶层：

```typescript
let resultPopupShown = false;
```

```typescript
function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  updateCamera(dt);
  handleClick();
  updateUI(container, uiState);

  // Level timer and objective checking
  const phase = getPhase();
  if (phase === 'playing' || phase === 'complete' || phase === 'failed') {
    updateLevelTimer(dt);
    checkObjectives();
    checkFailCondition();
  }

  // Handle completion/failure popups (guard prevents re-showing)

  // Level timer and objective checking
  const phase = getPhase();
  if (phase === 'playing' || phase === 'complete' || phase === 'failed') {
    updateLevelTimer(dt);
    checkObjectives();
    checkFailCondition();
  }

  if ((phase === 'complete' || phase === 'failed') && !resultPopupShown) {
    resultPopupShown = true;
    const ls = getLevelState();
    if (ls) {
      const isComplete = phase === 'complete';
      const progress = getProgress();
      const record = progress.records[ls.config.id];
      const canSkip = (record?.failCount ?? 0) >= 5;

      showResultPopup(
        container,
        isComplete,
        isComplete && ls.config.id < LEVELS.length ? () => {
          clearScene();
          for (const d of debrisList) {
            world.removeBody(d.body);
            scene.remove(d.mesh);
            d.mesh.geometry.dispose();
            (d.mesh.material as THREE.Material).dispose();
          }
          debrisList.length = 0;
          const next = startLevel(ls.config.id + 1);
          if (next) {
            buildFromLayout(next.buildings);
            createVehicles();
            createDecorations();
          }
        } : null,
        () => {
          clearScene();
          for (const d of debrisList) {
            world.removeBody(d.body);
            scene.remove(d.mesh);
            d.mesh.geometry.dispose();
            (d.mesh.material as THREE.Material).dispose();
          }
          debrisList.length = 0;
          const config = startLevel(ls.config.id);
          if (config) {
            buildFromLayout(config.buildings);
            createVehicles();
            createDecorations();
          }
        },
        () => {
          returnToMenu();
          clearScene();
          for (const d of debrisList) {
            world.removeBody(d.body);
            scene.remove(d.mesh);
            d.mesh.geometry.dispose();
            (d.mesh.material as THREE.Material).dispose();
          }
          debrisList.length = 0;
          createScene();
        },
        canSkip ? () => { recordSkip(); returnToMenu(); } : null,
      );
    }
  }

  // Panel toggle
  if (input.togglePanel) {
    const tab = document.getElementById('weapon-tab');
    if (tab) tab.click();
    input.togglePanel = false;
  }

  // ... 其余代码（遥控引爆、地雷检测、引爆、重置）保持不变
```

- [ ] **Step 5: 编译验证**

Run: `npx tsc --noEmit`
Expected: 修复所有类型错误

- [ ] **Step 6: Commit**

```bash
git add src/main.ts
git commit -m "feat: main.ts 集成关卡生命周期（初始化/启动/检测/结算/场景切换）"
```

---

### Task 9: 端到端验证

- [ ] **Step 1: 启动开发服务器**

Run: `npm run dev`
Expected: Vite 启动，显示本地 URL

- [ ] **Step 2: 验证沙盒模式仍然正常工作**
- 打开浏览器访问开发 URL
- 选择 TNT 放置在场景中
- 点击引爆，确认爆炸特效和物理正常
- 确认武器面板正常工作

- [ ] **Step 3: 验证关卡模式**
- 展开武器面板，点击"关卡"按钮
- 确认关卡列表出现，第 1 关可点击
- 点击第 1 关，确认场景切换为关卡布局
- 顶部 HUD 显示关卡名称、武器数量、计时器
- 放置 TNT，确认剩余数量递减
- 引爆，确认目标检测（摧毁指定建筑）
- 达标后确认结算弹窗出现
- 验证星级评价

- [ ] **Step 4: 验证进度持久化**
- 刷新页面，确认关卡进度保留
- 已解锁关卡不会重新锁定

- [ ] **Step 5: 验证跳过机制**
- 在同一关失败 5 次后，失败弹窗应出现"跳过"按钮
- 点击跳过，下一关解锁

- [ ] **Step 6: Commit（如有修复）**

```bash
git add -A
git commit -m "fix: 端到端验证修复"
```
