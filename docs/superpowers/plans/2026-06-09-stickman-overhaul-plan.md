# 火柴人全面改造 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 火柴人系统全面升级：程序化行走动画 + 平滑运动过渡 + A* 寻路(道路感知) + 双层士气系统

**Architecture:** 新增 `stickman_ai.ts` 承载纯逻辑层(A*/steering/士气/状态机)，与 Three.js/Cannon-es 解耦。`stickman.ts` 负责模型+动画+运动，`barracks.ts` 加入群体士气。`main.ts` 通过 `AIState[]` 数组与 `stickmen[]` 并行管理。

**Tech Stack:** TypeScript, Three.js (toon材质), Cannon-es (物理), 无额外依赖

---

## File Structure

| 文件 | 操作 | 职责 |
|------|------|------|
| `src/constants.ts` | 修改 | 移除旧恐惧常量，新增~40个动画/AI/士气常量 |
| `src/stickman_ai.ts` | **新建** | AIState, OccupancyGrid, A*, steering, 状态机, 恐慌/士气 |
| `src/stickman.ts` | 修改 | 模型(partRefs) + 程序化动画 + 平滑运动 + 死亡ragdoll |
| `src/barracks.ts` | 修改 | 模型 + 产兵 + morale 字段 |
| `src/main.ts` | 修改 | 新集成流程(死亡→AI→运动→动画→产兵→清理) |

---

### Task 1: 更新 constants.ts — 新增常量

**Files:**
- Modify: `src/constants.ts`

- [ ] **Step 1: 追加动画/AI/士气常量**

在文件末尾追加以下常量块:

```ts
// ============================================================
// 火柴人动画
// ============================================================
export const ANIM_WALK_FREQ = 8;
export const ANIM_RUN_FREQ = 12;
export const ANIM_WALK_AMP = 0.5;
export const ANIM_RUN_AMP = 0.7;
export const ANIM_ARM_AMP = 0.4;
export const ANIM_ARM_RUN_AMP = 0.6;
export const ANIM_BOB_HEIGHT = 0.03;
export const ANIM_BOB_RUN_HEIGHT = 0.05;

// ============================================================
// 火柴人运动
// ============================================================
export const STICKMAN_ACCEL = 8;
export const STICKMAN_RUN_ACCEL = 15;
export const STICKMAN_TURN_SPEED = 8;
export const STICKMAN_ROAD_SPEED_BONUS = 1.2;

// ============================================================
// 火柴人 AI
// ============================================================
export const AI_PATH_RECALC_INTERVAL = 3;
export const AI_GRID_RESOLUTION = 2;
export const AI_MAX_SEARCH_STEPS = 200;
export const AI_SEPARATION_RADIUS = 3;
export const AI_SEPARATION_WEIGHT = 0.3;
export const AI_COHESION_RADIUS = 5;
export const AI_COHESION_WEIGHT = 0.2;

// ============================================================
// 士气
// ============================================================
export const FEAR_EXPLOSION = 60;
export const FEAR_WITNESS_DEATH = 20;
export const FEAR_WITNESS_FLEE = 10;
export const FEAR_DECAY_RATE = 5;
export const FEAR_NEAR_BARRACKS_DECAY = 10;
export const FEAR_NEAR_ALLIES_DECAY = 5;
export const FEAR_FLEE_THRESHOLD = 70;
export const FEAR_RECOVER_THRESHOLD = 20;
export const FEAR_PROPAGATION_RADIUS = 5;
export const FEAR_PROPAGATION_COOLDOWN = 3;
export const MORALE_INITIAL = 50;
export const MORALE_DEATH_PENALTY = 10;
export const MORALE_BARRACKS_DAMAGE = 30;
export const MORALE_EXPLOSION_NEAR = 20;
export const MORALE_KILL_BONUS = 15;
export const MORALE_LOW_THRESHOLD = 30;
export const MORALE_HIGH_THRESHOLD = 70;
export const MORALE_COOLDOWN = 30;
```

- [ ] **Step 2: 移除废弃常量**

删除以下两行（被新系统取代）:

```
export const STICKMAN_FEAR_RADIUS = 8;
export const STICKMAN_FEAR_DURATION = 3;
```

- [ ] **Step 3: 类型检查**

```bash
npx tsc --noEmit
```

预期: 有暂时性报错（旧 `updateStickman` 引用废弃常量），后续 Task 修复。

---

### Task 2: 创建 stickman_ai.ts — OccupancyGrid + A*

**Files:**
- Create: `src/stickman_ai.ts`

- [ ] **Step 1: 创建文件骨架 + 类型定义**

```ts
import * as THREE from 'three';
import { StickmanState } from './stickman';
import { BarracksState } from './barracks';
import { PhysicsBody } from './physics';
import {
  AI_GRID_RESOLUTION, AI_MAX_SEARCH_STEPS,
  AI_SEPARATION_RADIUS, AI_SEPARATION_WEIGHT,
  AI_COHESION_RADIUS, AI_COHESION_WEIGHT,
  AI_PATH_RECALC_INTERVAL,
  STICKMAN_WALK_SPEED, STICKMAN_RUN_SPEED,
  STICKMAN_ROAD_SPEED_BONUS,
  FEAR_EXPLOSION, FEAR_WITNESS_DEATH, FEAR_WITNESS_FLEE,
  FEAR_DECAY_RATE, FEAR_NEAR_BARRACKS_DECAY, FEAR_NEAR_ALLIES_DECAY,
  FEAR_FLEE_THRESHOLD, FEAR_RECOVER_THRESHOLD,
  FEAR_PROPAGATION_RADIUS, FEAR_PROPAGATION_COOLDOWN,
  MORALE_INITIAL, MORALE_DEATH_PENALTY, MORALE_BARRACKS_DAMAGE,
  MORALE_EXPLOSION_NEAR, MORALE_KILL_BONUS,
  MORALE_LOW_THRESHOLD, MORALE_HIGH_THRESHOLD,
  MORALE_COOLDOWN,
  WORLD_SIZE, ROAD_WIDTH,
} from './constants';

export interface AIState {
  stickman: StickmanState;
  barracks: BarracksState | null;
  fear: number;
  fearTimer: number;
  targetPos: THREE.Vector3;
  idleTimer: number;
  pathWaypoints: THREE.Vector3[];
  pathRecalcTimer: number;
  lastFearPropagationTime: number;
  moveDir: THREE.Vector3;
  moveSpeed: number;
}

export type MoraleEvent =
  | { type: 'explosion'; pos: THREE.Vector3; radius: number }
  | { type: 'stickman_death'; pos: THREE.Vector3; stickman: StickmanState }
  | { type: 'enemy_kill'; pos: THREE.Vector3 }
  | { type: 'barracks_damage'; barracks: BarracksState };

let occupancyGrid: GridCell[][] = [];
let gridRebuildTimer = 0;
let dynamicObstacles: Array<{ pos: THREE.Vector3; radius: number }> = [];

interface GridCell {
  blocked: boolean;
  roadBonus: boolean;
  roadNearby: boolean;
}

function worldToGrid(worldPos: number): number {
  const halfWorld = WORLD_SIZE / 2;
  return Math.floor((worldPos + halfWorld) / AI_GRID_RESOLUTION);
}

function gridToWorld(gridPos: number): number {
  const halfWorld = WORLD_SIZE / 2;
  return gridPos * AI_GRID_RESOLUTION - halfWorld + AI_GRID_RESOLUTION / 2;
}

const GRID_SIZE = Math.floor(WORLD_SIZE / AI_GRID_RESOLUTION); // 30

function isOnRoad(wx: number, wz: number): boolean {
  const halfRoad = ROAD_WIDTH / 2;
  return Math.abs(wx) < halfRoad || Math.abs(wz) < halfRoad;
}
```

- [ ] **Step 2: 实现 OccupancyGrid**

```ts
export function rebuildOccupancyGrid(physicsBodies: PhysicsBody[]): void {
  const halfRoad = ROAD_WIDTH / 2;

  occupancyGrid = [];
  for (let gx = 0; gx < GRID_SIZE; gx++) {
    occupancyGrid[gx] = [];
    for (let gz = 0; gz < GRID_SIZE; gz++) {
      const wx = gridToWorld(gx);
      const wz = gridToWorld(gz);
      const onRoad = Math.abs(wx) < halfRoad || Math.abs(wz) < halfRoad;
      const nearRoad = Math.abs(wx) < halfRoad + 2 || Math.abs(wz) < halfRoad + 2;
      occupancyGrid[gx][gz] = {
        blocked: false,
        roadBonus: onRoad,
        roadNearby: nearRoad && !onRoad,
      };
    }
  }

  // Mark buildings as blocked
  for (const pb of physicsBodies) {
    if (!pb.isBuilding) continue;
    const pos = pb.body.position;
    const halfW = 2;
    const halfD = 2;
    const minGx = Math.max(0, worldToGrid(pos.x - halfW));
    const maxGx = Math.min(GRID_SIZE - 1, worldToGrid(pos.x + halfW));
    const minGz = Math.max(0, worldToGrid(pos.z - halfD));
    const maxGz = Math.min(GRID_SIZE - 1, worldToGrid(pos.z + halfD));
    for (let gx = minGx; gx <= maxGx; gx++) {
      for (let gz = minGz; gz <= maxGz; gz++) {
        occupancyGrid[gx][gz].blocked = true;
      }
    }
  }

  // Mark dynamic obstacles
  for (const obs of dynamicObstacles) {
    const obsGx = worldToGrid(obs.pos.x);
    const obsGz = worldToGrid(obs.pos.z);
    const obsRadius = Math.ceil(obs.radius / AI_GRID_RESOLUTION);
    for (let gx = obsGx - obsRadius; gx <= obsGx + obsRadius; gx++) {
      for (let gz = obsGz - obsRadius; gz <= obsGz + obsRadius; gz++) {
        if (gx >= 0 && gx < GRID_SIZE && gz >= 0 && gz < GRID_SIZE) {
          occupancyGrid[gx][gz].blocked = true;
        }
      }
    }
  }
}

export function setDynamicObstacles(obstacles: Array<{ pos: THREE.Vector3; radius: number }>): void {
  dynamicObstacles = obstacles;
}

export function isWalkable(worldX: number, worldZ: number): boolean {
  const gx = worldToGrid(worldX);
  const gz = worldToGrid(worldZ);
  if (gx < 0 || gx >= GRID_SIZE || gz < 0 || gz >= GRID_SIZE) return false;
  return !occupancyGrid[gx]?.[gz]?.blocked;
}

function getGridCost(gx: number, gz: number): number {
  if (gx < 0 || gx >= GRID_SIZE || gz < 0 || gz >= GRID_SIZE) return Infinity;
  const cell = occupancyGrid[gx][gz];
  if (!cell || cell.blocked) return Infinity;
  if (cell.roadBonus) return 0.7;
  if (cell.roadNearby) return 0.85;
  return 1.0;
}
```

- [ ] **Step 3: 实现 A***

```ts
interface AStarNode {
  gx: number; gz: number;
  g: number; h: number; f: number;
  parent: AStarNode | null;
}

function aStar(sx: number, sz: number, gx: number, gz: number): THREE.Vector3[] | null {
  const startGx = worldToGrid(sx);
  const startGz = worldToGrid(sz);
  const goalGx = worldToGrid(gx);
  const goalGz = worldToGrid(gz);

  if (getGridCost(startGx, startGz) === Infinity) return null;
  if (getGridCost(goalGx, goalGz) === Infinity) return null;
  if (startGx === goalGx && startGz === goalGz) return [new THREE.Vector3(gx, 0, gz)];

  const openSet: AStarNode[] = [];
  const closedSet = new Set<string>();
  const key = (x: number, z: number) => `${x},${z}`;

  const startNode: AStarNode = {
    gx: startGx, gz: startGz,
    g: 0,
    h: heuristic(startGx, startGz, goalGx, goalGz),
    f: 0, parent: null,
  };
  startNode.f = startNode.g + startNode.h;
  openSet.push(startNode);

  const dirs = [
    { dx: 0, dz: 1, cost: 1 }, { dx: 1, dz: 0, cost: 1 },
    { dx: 0, dz: -1, cost: 1 }, { dx: -1, dz: 0, cost: 1 },
    { dx: 1, dz: 1, cost: 1.4 }, { dx: 1, dz: -1, cost: 1.4 },
    { dx: -1, dz: 1, cost: 1.4 }, { dx: -1, dz: -1, cost: 1.4 },
  ];

  let steps = 0;
  while (openSet.length > 0 && steps < AI_MAX_SEARCH_STEPS) {
    steps++;
    let bestIdx = 0;
    for (let i = 1; i < openSet.length; i++) {
      if (openSet[i].f < openSet[bestIdx].f) bestIdx = i;
    }
    const current = openSet.splice(bestIdx, 1)[0];

    if (current.gx === goalGx && current.gz === goalGz) {
      return simplifyPath(retracePath(current));
    }

    closedSet.add(key(current.gx, current.gz));

    for (const dir of dirs) {
      const ngx = current.gx + dir.dx;
      const ngz = current.gz + dir.dz;
      if (closedSet.has(key(ngx, ngz))) continue;

      const cellCost = getGridCost(ngx, ngz);
      if (cellCost === Infinity) continue;

      const moveCost = dir.cost * cellCost;
      const ng = current.g + moveCost;
      const nh = heuristic(ngx, ngz, goalGx, goalGz);

      const existing = openSet.find(n => n.gx === ngx && n.gz === ngz);
      if (existing) {
        if (ng < existing.g) {
          existing.g = ng;
          existing.f = ng + nh;
          existing.parent = current;
        }
      } else {
        openSet.push({ gx: ngx, gz: ngz, g: ng, h: nh, f: ng + nh, parent: current });
      }
    }
  }

  return [new THREE.Vector3(gx, 0, gz)];
}

function heuristic(ax: number, az: number, bx: number, bz: number): number {
  const dx = Math.abs(ax - bx);
  const dz = Math.abs(az - bz);
  return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz);
}

function retracePath(node: AStarNode): THREE.Vector3[] {
  const path: THREE.Vector3[] = [];
  let current: AStarNode | null = node;
  while (current) {
    path.push(new THREE.Vector3(gridToWorld(current.gx), 0, gridToWorld(current.gz)));
    current = current.parent;
  }
  path.reverse();
  return path;
}

function simplifyPath(path: THREE.Vector3[]): THREE.Vector3[] {
  if (path.length <= 2) return path;
  const result: THREE.Vector3[] = [path[0]];
  for (let i = 1; i < path.length - 1; i++) {
    const prev = path[i - 1];
    const curr = path[i];
    const next = path[i + 1];
    const dir1 = new THREE.Vector3(curr.x - prev.x, 0, curr.z - prev.z).normalize();
    const dir2 = new THREE.Vector3(next.x - curr.x, 0, next.z - curr.z).normalize();
    if (dir1.dot(dir2) < 0.95) {
      result.push(curr);
    }
  }
  result.push(path[path.length - 1]);
  return result;
}
```

- [ ] **Step 4: 类型检查**

```bash
npx tsc --noEmit
```

预期: 无新报错（新文件独立，无调用方）。

---

### Task 3: 创建 stickman_ai.ts — Steering + 状态机 + 士气

**Files:**
- Modify: `src/stickman_ai.ts` (追加代码)

- [ ] **Step 1: 选择兴趣点**

```ts
function pickInterestPoint(smAI: AIState, aiStates: AIState[]): THREE.Vector3 {
  const roll = Math.random();
  const pos = smAI.stickman.body.position;

  if (roll < 0.3) {
    // 30%: 道路上的随机点
    for (let attempt = 0; attempt < 10; attempt++) {
      const rx = (Math.random() - 0.5) * WORLD_SIZE * 0.9;
      const rz = (Math.random() - 0.5) * WORLD_SIZE * 0.9;
      if (isOnRoad(rx, rz)) {
        return new THREE.Vector3(rx, 0, rz);
      }
    }
    return new THREE.Vector3(
      (Math.random() - 0.5) * WORLD_SIZE * 0.8, 0,
      (Math.random() - 0.5) * WORLD_SIZE * 0.8,
    );
  } else if (roll < 0.6) {
    // 30%: 同兵营友军中心 + 随机偏移
    if (smAI.barracks) {
      const mates = aiStates.filter(a => a.barracks === smAI.barracks && a !== smAI);
      if (mates.length > 0) {
        let cx = 0, cz = 0;
        for (const m of mates) {
          cx += m.stickman.body.position.x;
          cz += m.stickman.body.position.z;
        }
        cx /= mates.length;
        cz /= mates.length;
        const offset = 3 + Math.random() * 8;
        const angle = Math.random() * Math.PI * 2;
        return new THREE.Vector3(cx + Math.cos(angle) * offset, 0, cz + Math.sin(angle) * offset);
      }
    }
    return new THREE.Vector3(
      pos.x + (Math.random() - 0.5) * 16, 0,
      pos.z + (Math.random() - 0.5) * 16,
    );
  } else {
    // 40%: 纯随机点
    return new THREE.Vector3(
      (Math.random() - 0.5) * WORLD_SIZE * 0.8, 0,
      (Math.random() - 0.5) * WORLD_SIZE * 0.8,
    );
  }
}
```

- [ ] **Step 2: Steering 转向行为**

```ts
function computeSteering(smAI: AIState, aiStates: AIState[]): { moveDir: THREE.Vector3; moveSpeed: number } {
  const sm = smAI.stickman;
  const pos = new THREE.Vector3(sm.body.position.x, 0, sm.body.position.z);
  const forces: THREE.Vector3[] = [];

  // 1. Seek — 指向 A* 路径 next waypoint
  if (smAI.pathWaypoints.length > 0) {
    const wp = smAI.pathWaypoints[0];
    const toWp = new THREE.Vector3(wp.x - pos.x, 0, wp.z - pos.z);
    if (toWp.length() < 0.5) {
      smAI.pathWaypoints.shift();
    }
    if (smAI.pathWaypoints.length > 0) {
      const nextWp = smAI.pathWaypoints[0];
      forces.push(new THREE.Vector3(nextWp.x - pos.x, 0, nextWp.z - pos.z).normalize().multiplyScalar(1.0));
    }
  }

  // 2. Separation — 推开附近火柴人
  const sepForce = new THREE.Vector3();
  let sepCount = 0;
  for (const other of aiStates) {
    if (other === smAI || !other.stickman.alive) continue;
    const otherPos = new THREE.Vector3(other.stickman.body.position.x, 0, other.stickman.body.position.z);
    const dist = pos.distanceTo(otherPos);
    if (dist < AI_SEPARATION_RADIUS && dist > 0.01) {
      sepForce.add(pos.clone().sub(otherPos).normalize().divideScalar(dist));
      sepCount++;
    }
  }
  if (sepCount > 0) {
    forces.push(sepForce.normalize().multiplyScalar(AI_SEPARATION_WEIGHT));
  }

  // 3. Cohesion — 朝向同兵营友军中心
  if (smAI.barracks) {
    const mates = aiStates.filter(a => a.barracks === smAI.barracks && a !== smAI && a.stickman.alive);
    if (mates.length > 0) {
      let cx = 0, cz = 0;
      for (const m of mates) {
        cx += m.stickman.body.position.x;
        cz += m.stickman.body.position.z;
      }
      cx /= mates.length; cz /= mates.length;
      const toCenter = new THREE.Vector3(cx - pos.x, 0, cz - pos.z);
      if (toCenter.length() > AI_COHESION_RADIUS) {
        forces.push(toCenter.normalize().multiplyScalar(AI_COHESION_WEIGHT));
      }
    }
  }

  // Blend forces
  const finalDir = new THREE.Vector3();
  if (forces.length === 0) {
    return { moveDir: new THREE.Vector3(), moveSpeed: 0 };
  }
  for (const f of forces) finalDir.add(f);
  finalDir.normalize();

  let speed = sm.state === 'fleeing' ? STICKMAN_RUN_SPEED : STICKMAN_WALK_SPEED;
  if (isOnRoad(pos.x, pos.z)) speed *= STICKMAN_ROAD_SPEED_BONUS;

  return { moveDir: finalDir, moveSpeed: speed };
}
```

- [ ] **Step 3: 状态机 — updateStickmanAI**

```ts
export function updateStickmanAI(smAI: AIState, dt: number, aiStates: AIState[]): void {
  const sm = smAI.stickman;
  if (!sm.alive) return;

  const pos = new THREE.Vector3(sm.body.position.x, 0, sm.body.position.z);

  // Fear logic
  updateFear(smAI, dt, aiStates);

  // State transitions
  if (smAI.fear > FEAR_FLEE_THRESHOLD) {
    sm.state = 'fleeing';
    smAI.fearTimer = 3;
  } else if (sm.state === 'fleeing' && smAI.fear < FEAR_RECOVER_THRESHOLD) {
    smAI.fearTimer -= dt;
    if (smAI.fearTimer <= 0) {
      sm.state = 'idle';
      smAI.idleTimer = 1 + Math.random() * 3;
      smAI.pathWaypoints = [];
    }
  }

  smAI.pathRecalcTimer -= dt;

  if (sm.state === 'idle') {
    smAI.idleTimer -= dt;
    if (smAI.idleTimer <= 0) {
      sm.state = 'walking';
      smAI.targetPos = pickInterestPoint(smAI, aiStates);
      smAI.pathWaypoints = aStar(pos.x, pos.z, smAI.targetPos.x, smAI.targetPos.z) || [
        new THREE.Vector3(smAI.targetPos.x, 0, smAI.targetPos.z),
      ];
      smAI.pathRecalcTimer = AI_PATH_RECALC_INTERVAL;
    }
  } else if (sm.state === 'walking') {
    if (pos.distanceTo(smAI.targetPos) < 0.5) {
      sm.state = 'idle';
      smAI.idleTimer = 1 + Math.random() * 4;
      smAI.pathWaypoints = [];
    } else if (smAI.pathRecalcTimer <= 0) {
      smAI.pathWaypoints = aStar(pos.x, pos.z, smAI.targetPos.x, smAI.targetPos.z) || [
        new THREE.Vector3(smAI.targetPos.x, 0, smAI.targetPos.z),
      ];
      smAI.pathRecalcTimer = AI_PATH_RECALC_INTERVAL;
    }
  } else if (sm.state === 'fleeing') {
    if (smAI.barracks) {
      const bp = smAI.barracks.body.position;
      smAI.targetPos = new THREE.Vector3(bp.x, 0, bp.z);
    } else {
      const fleeDir = new THREE.Vector3(
        pos.x - smAI.targetPos.x, 0, pos.z - smAI.targetPos.z,
      ).normalize();
      if (fleeDir.length() < 0.01) {
        fleeDir.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
      }
      smAI.targetPos = pos.clone().add(fleeDir.multiplyScalar(20));
    }
    if (smAI.pathRecalcTimer <= 0) {
      smAI.pathWaypoints = aStar(pos.x, pos.z, smAI.targetPos.x, smAI.targetPos.z) || [
        new THREE.Vector3(smAI.targetPos.x, 0, smAI.targetPos.z),
      ];
      smAI.pathRecalcTimer = AI_PATH_RECALC_INTERVAL;
    }
  }

  const steer = computeSteering(smAI, aiStates);
  smAI.moveDir = steer.moveDir;
  smAI.moveSpeed = steer.moveSpeed;
}
```

- [ ] **Step 4: 恐慌更新**

```ts
function updateFear(smAI: AIState, dt: number, aiStates: AIState[]): void {
  const sm = smAI.stickman;
  const pos = new THREE.Vector3(sm.body.position.x, 0, sm.body.position.z);

  // Base decay
  smAI.fear = Math.max(0, smAI.fear - FEAR_DECAY_RATE * dt);

  // Near barracks decay
  if (smAI.barracks) {
    const bp = smAI.barracks.body.position;
    const distToBarracks = Math.sqrt((pos.x - bp.x) ** 2 + (pos.z - bp.z) ** 2);
    if (distToBarracks < 8) {
      smAI.fear = Math.max(0, smAI.fear - FEAR_NEAR_BARRACKS_DECAY * dt);
    }
  }

  // Near 3+ allies decay
  let nearbyAllies = 0;
  for (const other of aiStates) {
    if (other === smAI || !other.stickman.alive) continue;
    const op = new THREE.Vector3(other.stickman.body.position.x, 0, other.stickman.body.position.z);
    if (pos.distanceTo(op) < 5) nearbyAllies++;
  }
  if (nearbyAllies >= 3) {
    smAI.fear = Math.max(0, smAI.fear - FEAR_NEAR_ALLIES_DECAY * dt);
  }
}
```

- [ ] **Step 5: 恐慌传播**

```ts
export function propagateFear(aiStates: AIState[], now: number): void {
  for (const smAI of aiStates) {
    if (!smAI.stickman.alive) continue;
    if (smAI.fear < 50) continue;
    if (now - smAI.lastFearPropagationTime < FEAR_PROPAGATION_COOLDOWN) continue;

    const pos = new THREE.Vector3(
      smAI.stickman.body.position.x, 0, smAI.stickman.body.position.z,
    );

    for (const other of aiStates) {
      if (other === smAI || !other.stickman.alive) continue;
      if (other.stickman.state === 'fleeing') continue;
      const op = new THREE.Vector3(
        other.stickman.body.position.x, 0, other.stickman.body.position.z,
      );
      if (pos.distanceTo(op) < FEAR_PROPAGATION_RADIUS) {
        other.fear = Math.min(100, other.fear + FEAR_WITNESS_FLEE);
        other.lastFearPropagationTime = now;
      }
    }
    smAI.lastFearPropagationTime = now;
  }
}
```

- [ ] **Step 6: 士气事件处理 + preUpdateAI**

```ts
export function processMoraleEvents(
  events: MoraleEvent[],
  aiStates: AIState[],
  barracksList: BarracksState[],
  now: number,
): void {
  for (const event of events) {
    switch (event.type) {
      case 'explosion': {
        for (const smAI of aiStates) {
          if (!smAI.stickman.alive) continue;
          const pos = new THREE.Vector3(
            smAI.stickman.body.position.x, 0, smAI.stickman.body.position.z,
          );
          if (pos.distanceTo(event.pos) < event.radius) {
            smAI.fear = Math.min(100, smAI.fear + FEAR_EXPLOSION);
          }
        }
        for (const b of barracksList) {
          if (!b.alive) continue;
          const bp = b.body.position;
          const dist = Math.sqrt((bp.x - event.pos.x) ** 2 + (bp.z - event.pos.z) ** 2);
          if (dist < 15 && now - b.lastMoraleEventTime > MORALE_COOLDOWN) {
            b.morale = Math.max(0, b.morale - MORALE_EXPLOSION_NEAR);
            b.lastMoraleEventTime = now;
          }
        }
        break;
      }
      case 'stickman_death': {
        for (const smAI of aiStates) {
          if (!smAI.stickman.alive || smAI.stickman === event.stickman) continue;
          const pos = new THREE.Vector3(
            smAI.stickman.body.position.x, 0, smAI.stickman.body.position.z,
          );
          if (pos.distanceTo(event.pos) < 10) {
            smAI.fear = Math.min(100, smAI.fear + FEAR_WITNESS_DEATH);
          }
        }
        for (const b of barracksList) {
          if (!b.alive) continue;
          if (aiStates.find(a => a.stickman === event.stickman && a.barracks === b)) {
            b.morale = Math.max(0, b.morale - MORALE_DEATH_PENALTY);
          }
        }
        break;
      }
      case 'enemy_kill': {
        for (const b of barracksList) {
          if (!b.alive) continue;
          b.morale = Math.min(100, b.morale + MORALE_KILL_BONUS);
        }
        break;
      }
      case 'barracks_damage': {
        if (now - event.barracks.lastMoraleEventTime > MORALE_COOLDOWN) {
          event.barracks.morale = Math.max(0, event.barracks.morale - MORALE_BARRACKS_DAMAGE);
          event.barracks.lastMoraleEventTime = now;
        }
        break;
      }
    }
  }
}

export function preUpdateAI(
  dt: number,
  aiStates: AIState[],
  barracksList: BarracksState[],
  moraleEvents: MoraleEvent[],
  physicsBodies: PhysicsBody[],
  now: number,
): void {
  gridRebuildTimer += dt;
  if (gridRebuildTimer >= 5) {
    gridRebuildTimer = 0;
    rebuildOccupancyGrid(physicsBodies);
  }

  if (moraleEvents.length > 0) {
    processMoraleEvents(moraleEvents, aiStates, barracksList, now);
    moraleEvents.length = 0;
  }

  propagateFear(aiStates, now);
}

export function createAIState(sm: StickmanState, barracks: BarracksState | null): AIState {
  return {
    stickman: sm,
    barracks,
    fear: barracks && barracks.morale < MORALE_LOW_THRESHOLD ? 20 : 0,
    fearTimer: 0,
    targetPos: new THREE.Vector3(sm.body.position.x, 0, sm.body.position.z),
    idleTimer: Math.random() * 2,
    pathWaypoints: [],
    pathRecalcTimer: 0,
    lastFearPropagationTime: 0,
    moveDir: new THREE.Vector3(),
    moveSpeed: 0,
  };
}
```

- [ ] **Step 7: 类型检查**

```bash
npx tsc --noEmit
```

预期: 无新报错。

---

### Task 4: 改造 stickman.ts — 模型 + 动画 + 运动

**Files:**
- Modify: `src/stickman.ts`

- [ ] **Step 1: 更新 import**

将现有 import 替换为:

```ts
import {
  STICKMAN_HP, STICKMAN_WALK_SPEED, STICKMAN_RUN_SPEED,
  STICKMAN_HEIGHT, STICKMAN_RADIUS,
  ANIM_WALK_FREQ, ANIM_RUN_FREQ,
  ANIM_WALK_AMP, ANIM_RUN_AMP,
  ANIM_ARM_AMP, ANIM_ARM_RUN_AMP,
  ANIM_BOB_HEIGHT, ANIM_BOB_RUN_HEIGHT,
  STICKMAN_ACCEL, STICKMAN_RUN_ACCEL, STICKMAN_TURN_SPEED,
} from './constants';
```

- [ ] **Step 2: 更新 StickmanState 接口**

```ts
export interface StickmanState {
  group: THREE.Group;
  body: CANNON.Body;
  hp: number;
  maxHp: number;
  state: 'idle' | 'walking' | 'fleeing';
  alive: boolean;
  partRefs: Map<string, THREE.Object3D>;
  animTime: number;
  animPhase: number;
  deathTimer: number;
  isDeadReadyCleanup: boolean;
}
```

- [ ] **Step 3: 改造 createStickman — userData.name + partRefs**

替换完整 `createStickman` 函数:

```ts
export function createStickman(x: number, z: number, hp?: number): StickmanState {
  const scene = getScene();
  const world = getWorld();
  const maxHp = hp ?? STICKMAN_HP;

  const group = new THREE.Group();

  // Head
  const headGeo = new THREE.SphereGeometry(0.15, 8, 6);
  const headMat = new THREE.MeshToonMaterial({ color: 0xffddaa });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = STICKMAN_HEIGHT - 0.15;
  head.castShadow = true;
  head.userData.name = 'head';
  group.add(head);

  // Body
  const bodyGeo = new THREE.CylinderGeometry(0.1, 0.12, 0.6, 6);
  const bodyMat = new THREE.MeshToonMaterial({ color: 0x3366cc });
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
  bodyMesh.position.y = STICKMAN_HEIGHT - 0.5;
  bodyMesh.castShadow = true;
  bodyMesh.userData.name = 'body';
  bodyMesh.userData.baseY = STICKMAN_HEIGHT - 0.5;
  group.add(bodyMesh);

  // Arms
  const armGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.5, 6);
  const armMat = new THREE.MeshToonMaterial({ color: 0xffddaa });

  const leftArm = new THREE.Mesh(armGeo, armMat);
  leftArm.position.set(-0.18, STICKMAN_HEIGHT - 0.45, 0);
  leftArm.rotation.z = 0.3;
  leftArm.castShadow = true;
  leftArm.userData.name = 'leftArm';
  group.add(leftArm);

  const rightArm = new THREE.Mesh(armGeo, armMat);
  rightArm.position.set(0.18, STICKMAN_HEIGHT - 0.45, 0);
  rightArm.rotation.z = -0.3;
  rightArm.castShadow = true;
  rightArm.userData.name = 'rightArm';
  group.add(rightArm);

  // Legs
  const legGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.7, 6);
  const legMat = new THREE.MeshToonMaterial({ color: 0x222244 });

  const leftLeg = new THREE.Mesh(legGeo, legMat);
  leftLeg.position.set(-0.08, STICKMAN_HEIGHT - 1.1, 0);
  leftLeg.castShadow = true;
  leftLeg.userData.name = 'leftLeg';
  group.add(leftLeg);

  const rightLeg = new THREE.Mesh(legGeo, legMat);
  rightLeg.position.set(0.08, STICKMAN_HEIGHT - 1.1, 0);
  rightLeg.castShadow = true;
  rightLeg.userData.name = 'rightLeg';
  group.add(rightLeg);

  // Build part refs map
  const partRefs = new Map<string, THREE.Object3D>();
  group.traverse((c) => {
    if (c.userData.name) partRefs.set(c.userData.name as string, c);
  });

  group.position.set(x, 0, z);
  scene.add(group);

  // Physics
  const shape = new CANNON.Cylinder(STICKMAN_RADIUS, STICKMAN_RADIUS, STICKMAN_HEIGHT, 6);
  const body = new CANNON.Body({ mass: 70, shape });
  body.position.set(x, STICKMAN_HEIGHT / 2, z);
  body.linearDamping = 0.5;
  body.angularDamping = 0.9;
  world.addBody(body);

  return {
    group, body, hp: maxHp, maxHp,
    state: 'idle',
    alive: true,
    partRefs,
    animTime: 0,
    animPhase: Math.random() * Math.PI * 2,
    deathTimer: 0,
    isDeadReadyCleanup: false,
  };
}
```

- [ ] **Step 4: 修改 damageStickman — 触发死亡动画**

```ts
export function damageStickman(sm: StickmanState, amount: number): boolean {
  if (!sm.alive) return false;
  sm.hp -= amount;
  sm.group.traverse((c) => {
    if (c instanceof THREE.Mesh) {
      const mat = c.material as THREE.MeshToonMaterial;
      const orig = mat.color.getHex();
      mat.color.setHex(0xff0000);
      setTimeout(() => { mat.color.setHex(orig); }, 100);
    }
  });
  if (sm.hp <= 0) {
    sm.alive = false;
    sm.deathTimer = 0.5;
    // Reset limb rotations
    const { partRefs } = sm;
    if (partRefs) {
      for (const part of partRefs.values()) {
        if (part.userData.name !== 'head' && part.userData.name !== 'body') {
          part.rotation.x = 0;
        }
      }
    }
    return true;
  }
  return false;
}
```

- [ ] **Step 5: 添加 updateStickmanAnimation**

```ts
export function updateStickmanAnimation(sm: StickmanState, dt: number, speed: number): void {
  const { partRefs } = sm;
  if (!partRefs || partRefs.size === 0) return;

  const leftLeg = partRefs.get('leftLeg');
  const rightLeg = partRefs.get('rightLeg');
  const leftArm = partRefs.get('leftArm');
  const rightArm = partRefs.get('rightArm');
  const bodyMesh = partRefs.get('body');

  const isMoving = speed > 0.1;

  if (!sm.alive) {
    if (leftLeg) leftLeg.rotation.x = 0;
    if (rightLeg) rightLeg.rotation.x = 0;
    if (leftArm) leftArm.rotation.x = 0;
    if (rightArm) rightArm.rotation.x = 0;
    return;
  }

  sm.animTime += dt * Math.max(speed / STICKMAN_WALK_SPEED, 0.2) * ANIM_WALK_FREQ;

  if (isMoving) {
    const isRunning = sm.state === 'fleeing';
    const legAmp = isRunning ? ANIM_RUN_AMP : ANIM_WALK_AMP;
    const armAmp = isRunning ? ANIM_ARM_RUN_AMP : ANIM_ARM_AMP;
    const bobHeight = isRunning ? ANIM_BOB_RUN_HEIGHT : ANIM_BOB_HEIGHT;
    const cycle = sm.animTime + sm.animPhase;

    if (leftLeg) leftLeg.rotation.x = Math.sin(cycle) * legAmp;
    if (rightLeg) rightLeg.rotation.x = Math.sin(cycle + Math.PI) * legAmp;
    if (leftArm) leftArm.rotation.x = Math.sin(cycle + Math.PI) * armAmp;
    if (rightArm) rightArm.rotation.x = Math.sin(cycle) * armAmp;

    if (bodyMesh) {
      const baseY = bodyMesh.userData.baseY as number;
      if (baseY !== undefined) {
        bodyMesh.position.y = baseY + Math.abs(Math.sin(cycle * 2)) * bobHeight;
      }
    }
  } else {
    const sway = Math.sin(sm.animTime * 2) * 0.02;
    if (leftLeg) leftLeg.rotation.x = sway;
    if (rightLeg) rightLeg.rotation.x = -sway;
    if (leftArm) leftArm.rotation.x = sway * 0.5;
    if (rightArm) rightArm.rotation.x = -sway * 0.5;
    if (bodyMesh) {
      const baseY = bodyMesh.userData.baseY as number;
      if (baseY !== undefined) {
        bodyMesh.position.y += (baseY - bodyMesh.position.y) * 0.1;
      }
    }
  }
}
```

- [ ] **Step 6: 添加 updateStickmanMotion**

```ts
export function updateStickmanMotion(
  sm: StickmanState,
  targetDir: THREE.Vector3,
  targetSpeed: number,
  dt: number,
): void {
  if (!sm.alive) return;

  const hasTarget = targetSpeed > 0.01 && targetDir.length() > 0.01;
  const accel = sm.state === 'fleeing' ? STICKMAN_RUN_ACCEL : STICKMAN_ACCEL;
  const t = 1 - Math.exp(-accel * dt * 2);

  if (hasTarget) {
    sm.body.velocity.x += (targetDir.x * targetSpeed - sm.body.velocity.x) * t;
    sm.body.velocity.z += (targetDir.z * targetSpeed - sm.body.velocity.z) * t;
  } else {
    sm.body.velocity.x *= 1 - t;
    sm.body.velocity.z *= 1 - t;
  }

  if (hasTarget) {
    const targetAngle = Math.atan2(targetDir.x, targetDir.z);
    let diff = targetAngle - sm.group.rotation.y;
    diff = ((diff + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    const maxTurn = STICKMAN_TURN_SPEED * dt;
    diff = Math.max(-maxTurn, Math.min(maxTurn, diff));
    sm.group.rotation.y += diff;
  }

  sm.body.velocity.x *= 0.95;
  sm.body.velocity.z *= 0.95;
  sm.body.angularVelocity.set(0, 0, 0);

  sm.group.position.copy(sm.body.position as any);
  sm.group.position.y -= STICKMAN_HEIGHT / 2;
  sm.group.quaternion.copy(sm.body.quaternion as any);

  const q = sm.body.quaternion;
  if (Math.abs(q.x) > 0.1 || Math.abs(q.z) > 0.1) {
    q.x *= 0.9;
    q.z *= 0.9;
    q.normalize();
  }
}
```

- [ ] **Step 7: 添加 updateStickmanDeath**

```ts
export function updateStickmanDeath(sm: StickmanState, dt: number): void {
  if (sm.alive || sm.deathTimer <= 0) return;
  sm.deathTimer -= dt;
  sm.body.angularDamping = 0.1;
  if (sm.deathTimer <= 0) {
    sm.isDeadReadyCleanup = true;
  }
}
```

- [ ] **Step 8: 删除旧的 updateStickman 函数**

删除整个 `updateStickman` 函数体。

- [ ] **Step 9: 类型检查**

```bash
npx tsc --noEmit
```

预期: main.ts 有报错（引用旧的 `updateStickman`），下一步修复。

---

### Task 5: 改造 barracks.ts — morale 字段

**Files:**
- Modify: `src/barracks.ts`

- [ ] **Step 1: 更新 import**

```ts
import { BARRACKS_HP, BARRACKS_SPAWN_RATE, MORALE_INITIAL, MORALE_LOW_THRESHOLD, MORALE_HIGH_THRESHOLD } from './constants';
```

- [ ] **Step 2: 更新 BarracksState 接口**

```ts
export interface BarracksState {
  group: THREE.Group;
  body: CANNON.Body;
  hp: number;
  maxHp: number;
  spawnRate: number;
  spawnTimer: number;
  maxUnits: number;
  alive: boolean;
  morale: number;
  lastMoraleEventTime: number;
}
```

- [ ] **Step 3: 更新 createBarracks 返回值**

```ts
return {
  group, body, hp: BARRACKS_HP, maxHp: BARRACKS_HP,
  spawnRate: BARRACKS_SPAWN_RATE, spawnTimer: 0,
  maxUnits: Infinity, alive: true,
  morale: MORALE_INITIAL,
  lastMoraleEventTime: 0,
};
```

- [ ] **Step 4: 更新 updateBarracks — 士气影响产兵**

```ts
export function updateBarracks(
  barracks: BarracksState,
  dt: number,
  activeStickmen: StickmanState[],
): StickmanState[] {
  if (!barracks.alive) return [];

  const spawned: StickmanState[] = [];
  barracks.spawnTimer += dt;

  let effectiveRate = barracks.spawnRate;
  if (barracks.morale < MORALE_LOW_THRESHOLD) {
    effectiveRate = barracks.spawnRate * 2;
  } else if (barracks.morale > MORALE_HIGH_THRESHOLD) {
    effectiveRate = barracks.spawnRate * 0.67;
  }

  const aliveCount = activeStickmen.filter(s => s.alive).length;
  if (barracks.spawnTimer >= effectiveRate && aliveCount < barracks.maxUnits) {
    barracks.spawnTimer = 0;
    const angle = Math.random() * Math.PI * 2;
    const dist = 1 + Math.random() * 2;
    const sx = barracks.body.position.x + Math.cos(angle) * dist;
    const sz = barracks.body.position.z + Math.sin(angle) * dist;
    const sm = createStickman(sx, sz);
    spawned.push(sm);
  }

  return spawned;
}
```

- [ ] **Step 5: 类型检查**

```bash
npx tsc --noEmit
```

预期: main.ts 报错（引用旧 `updateStickman`），下一步修复。

---

### Task 6: 改造 main.ts — 集成新调用流程

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: 更新 import**

替换第 5 行:

```ts
import { createStickman, StickmanState, updateStickmanMotion, updateStickmanAnimation, updateStickmanDeath, damageStickman } from './stickman';
```

在第 8 行后追加:

```ts
import { createAIState, AIState, updateStickmanAI, preUpdateAI, MoraleEvent, rebuildOccupancyGrid, setDynamicObstacles } from './stickman_ai';
```

- [ ] **Step 2: 添加数组**

在 `const stickmen: StickmanState[] = [];` 后:

```ts
const aiStates: AIState[] = [];
const moraleEvents: MoraleEvent[] = [];
```

- [ ] **Step 3: 首次初始化 OccupancyGrid**

在 `createScene();` 之后:

```ts
rebuildOccupancyGrid(physicsBodies);
```

- [ ] **Step 4: 在 game-reset handler 中清理 aiStates**

在 `stickmen.length = 0;` 后追加:

```ts
aiStates.length = 0;
```

- [ ] **Step 5: 替换 Stickman AI + Barracks block**

将第 413-443 行替换为:

```ts
  const now = performance.now() / 1000;

  const dynamicObs = activeBlackHoleStates.map(bh => ({
    pos: new THREE.Vector3(bh.worldPos.x, bh.worldPos.y, bh.worldPos.z),
    radius: 25,
  }));
  setDynamicObstacles(dynamicObs);

  // 0. Death updates
  for (const sm of stickmen) {
    updateStickmanDeath(sm, dt);
  }

  // 1. AI preprocessing
  preUpdateAI(dt, aiStates, barracksList, moraleEvents, physicsBodies, now);

  // 2. AI + motion + animation
  for (const smAI of aiStates) {
    if (!smAI.stickman.alive && smAI.stickman.deathTimer <= 0) continue;
    if (smAI.stickman.alive) {
      updateStickmanAI(smAI, dt, aiStates);
      updateStickmanMotion(smAI.stickman, smAI.moveDir, smAI.moveSpeed, dt);
      if (smAI.stickman.body.velocity.length() > 15) {
        const killed = damageStickman(smAI.stickman, smAI.stickman.body.velocity.length() * 5 * dt);
        if (killed) {
          addStickmanKillScore();
          moraleEvents.push({
            type: 'stickman_death',
            pos: new THREE.Vector3(
              smAI.stickman.body.position.x, 0, smAI.stickman.body.position.z,
            ),
            stickman: smAI.stickman,
          });
        }
      }
    }
    updateStickmanAnimation(smAI.stickman, dt, smAI.moveSpeed);
  }

  // 3. Barracks spawn
  for (const b of barracksList) {
    if (!b.alive) continue;
    const spawned = updateBarracks(b, dt, stickmen);
    for (const sm of spawned) {
      stickmen.push(sm);
      aiStates.push(createAIState(sm, b));
    }
  }

  // 4. Cleanup dead
  for (let i = stickmen.length - 1; i >= 0; i--) {
    const sm = stickmen[i];
    if (!sm.alive && sm.isDeadReadyCleanup) {
      scene.remove(sm.group);
      sm.group.traverse((c) => {
        if (c instanceof THREE.Mesh) { c.geometry.dispose(); (c.material as THREE.Material).dispose(); }
      });
      world.removeBody(sm.body);
      stickmen.splice(i, 1);
      aiStates.splice(i, 1);
    }
  }
  updateStickmanCount(stickmen.length);
```

- [ ] **Step 6: 在引爆处推送 morale 事件**

在 `game.ts` 的 `detonateAll` 调用附近推送爆炸事件。找到 main.ts 中所有 `detonateAll()` 调用，追加:

```ts
moraleEvents.push({
  type: 'explosion',
  pos: new THREE.Vector3(/*爆炸位置 x*/, 0, /*爆炸位置 z*/),
  radius: explosiveDef.radius,
});
```

注: 需要从 `detonateAll` 获取引爆位置。如果 `detonateAll` 不返回位置，则需要在 main.ts 中已有位置的上下文中推送。

- [ ] **Step 7: 类型检查**

```bash
npx tsc --noEmit
```

预期: 无报错。

---

### Task 7: 视觉验证 + 调参

- [ ] **Step 1: 启动开发服务器**

```bash
npm run dev
```

- [ ] **Step 2: 观察调参**

浏览器中放置兵营，观察:
1. 走路动画 — 腿摆动幅度自然否？调整 `ANIM_WALK_AMP`/`ANIM_RUN_AMP`
2. 移动平滑度 — 加速曲线合适否？调整 `STICKMAN_ACCEL`/`STICKMAN_RUN_ACCEL`
3. 转向 — 转头平顺否？调整 `STICKMAN_TURN_SPEED`
4. 寻路 — 绕开建筑否？偏好道路否？
5. 恐慌 — 引爆后逃跑行为合理否？
6. 士气 — HUD 可查看士气变化

- [ ] **Step 3: 类型检查**

```bash
npx tsc --noEmit
```

预期: 无报错。

---

### Task 8: 提交

- [ ] **Step 1: 提交**

```bash
git add src/constants.ts src/stickman_ai.ts src/stickman.ts src/barracks.ts src/main.ts
git commit -m "feat: 火柴人全面改造(行走动画+平滑运动+A*寻路+士气系统)"
```
