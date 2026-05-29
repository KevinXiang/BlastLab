# 纯沙盒打分系统 + 道具扩展 + 特效升级 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 删除关卡模式，恢复纯沙盒，新增多维度打分系统+6种道具+喷射类+特效升级+物理连锁

**Architecture:** 删除 3 个文件（persistence.ts/level.ts/destruction.ts），修改 8 个现有文件。game.ts 增加打分逻辑，ui.ts 重写为沙盒 HUD（累计分+最高分+飘字），weaponpanel.ts 移除关卡 UI 并增加新道具卡片，main.ts 还原纯沙盒循环+集成打分/喷射/震动，scene.ts/physics.ts 清除关卡相关代码，effects.ts 增加新特效函数，constants.ts 增加新武器参数，input.ts 增加喷射输入。

**Tech Stack:** TypeScript + Vite + Three.js + Cannon-es

---

### Task 1: 删除关卡模式文件

**Files:**
- Delete: `src/persistence.ts`
- Delete: `src/level.ts`
- Delete: `src/destruction.ts`

- [ ] **Step 1: 删除三个文件**

```bash
git rm src/persistence.ts src/level.ts src/destruction.ts
```

- [ ] **Step 2: 编译验证**

Run: `npx tsc --noEmit`
Expected: 大量编译错误（因其他文件仍引用被删除的模块），此步骤仅确认文件已删除

- [ ] **Step 3: Commit**

```bash
git commit -m "refactor: 删除关卡模式文件 persistence/level/destruction"
```

---

### Task 2: game.ts — 清理关卡引用 + 增加打分系统

**Files:**
- Modify: `src/game.ts`

- [ ] **Step 1: 重写 game.ts**

移除所有关卡相关引用（如 `LevelConfig`/`LEVELS`/`setMode` 残余），新增打分逻辑。保持现有的 `placeExplosive`/`detonateAll`/远程炸弹/地雷功能。

```typescript
import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { applyExplosion, fragmentBuilding, DebrisPiece, PhysicsBody, getWorld } from './physics';
import {
  spawnNitroglycerinEffect,
  spawnTntEffect,
  spawnC4Effect,
  spawnNukeEffect,
  spawnClusterEffect,
  spawnBlackHoleEffect,
  spawnEMPEffect,
} from './effects';
import { EXPLOSIVE_DEFS, ExplosiveDef, REMOTE_RADIUS, REMOTE_FORCE, MINE_RADIUS, MINE_FORCE } from './constants';
import { getScene } from './renderer';

export interface ScoreBreakdown {
  destroyScore: number;
  impactScore: number;
  chainScore: number;
}

export interface ScoreState {
  totalScore: number;
  highScore: number;
  lastScore: ScoreBreakdown | null;
  lastScorePosition: THREE.Vector3 | null;
}

const HIGH_SCORE_KEY = 'blasting_highscore';

export const scoreState: ScoreState = {
  totalScore: 0,
  highScore: 0,
  lastScore: null,
  lastScorePosition: null,
};

export function loadHighScore(): void {
  try {
    const raw = localStorage.getItem(HIGH_SCORE_KEY);
    scoreState.highScore = raw ? parseInt(raw, 10) || 0 : 0;
  } catch {
    scoreState.highScore = 0;
  }
}

function saveHighScore(): void {
  try {
    localStorage.setItem(HIGH_SCORE_KEY, String(scoreState.highScore));
  } catch { /* ignore */ }
}

export function resetScore(): void {
  scoreState.totalScore = 0;
  scoreState.lastScore = null;
  scoreState.lastScorePosition = null;
}

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

function calcDestroyScore(physicsBodies: PhysicsBody[], position: CANNON.Vec3, radius: number): number {
  let score = 0;
  for (const pb of physicsBodies) {
    const dist = pb.body.position.distanceTo(position);
    if (dist >= radius) continue;
    const forceMag = EXPLOSIVE_DEFS['tnt']?.baseForce ?? 800 / (1 + (dist * dist) / (radius * radius));
    if (forceMag < FRAGMENT_THRESHOLD) continue;
    if (pb.isBuilding) {
      const height = (pb.mesh as THREE.Mesh).geometry.boundingBox?.max.y ?? 3;
      // Use mesh.scale + boundingBox for approximate height
      const meshHeight = pb.mesh.position.y * 2; // Rough: position.y = height/2
      score += Math.round(100 * meshHeight);
    } else if (pb.isTree) {
      score += 50;
    }
  }
  // Vehicle score: count vehicles in radius
  for (const pb of physicsBodies) {
    const dist = pb.body.position.distanceTo(position);
    if (dist < radius && !pb.isBuilding && !pb.isTree && pb.body.mass > 50 && pb.body.mass < 500) {
      score += 200;
    }
  }
  return score;
}

function calcImpactScore(world: CANNON.World, position: CANNON.Vec3, radius: number): number {
  let count = 0;
  for (const body of world.bodies) {
    if (body.mass === 0) continue;
    const dist = body.position.distanceTo(position);
    if (dist < radius) count++;
  }
  return count * 10;
}

export let pendingChainScore = 0;

export function addChainScore(): void {
  pendingChainScore += 50;
}

export function detonateAll(
  physicsBodies: PhysicsBody[],
  debrisList: DebrisPiece[],
  scene: THREE.Scene,
): void {
  const world = getWorld();
  let totalDestroy = 0;
  let totalImpact = 0;
  let lastPos: CANNON.Vec3 | null = null;

  for (const exp of placedExplosives) {
    const { position, def, type } = exp;
    lastPos = position;

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

    totalDestroy += calcDestroyScore(physicsBodies, position, def.radius);
    totalImpact += calcImpactScore(world, position, def.radius);

    const pos3 = new THREE.Vector3(exp.position.x, 1, exp.position.z);
    switch (type) {
      case 'nitroglycerin': spawnNitroglycerinEffect(pos3); break;
      case 'c4': spawnC4Effect(pos3); break;
      case 'nuke': spawnNukeEffect(pos3); break;
      case 'cluster': spawnClusterEffect(pos3); break;
      case 'blackhole': spawnBlackHoleEffect(pos3); break;
      case 'emp': spawnEMPEffect(pos3); break;
      default: spawnTntEffect(pos3); break;
    }
  }

  const chainScore = pendingChainScore;
  pendingChainScore = 0;

  const totalScore = totalDestroy + totalImpact + chainScore;
  scoreState.totalScore += totalScore;
  if (scoreState.totalScore > scoreState.highScore) {
    scoreState.highScore = scoreState.totalScore;
    saveHighScore();
  }

  scoreState.lastScore = {
    destroyScore: totalDestroy,
    impactScore: totalImpact,
    chainScore,
  };
  scoreState.lastScorePosition = lastPos ? new THREE.Vector3(lastPos.x, 1, lastPos.z) : null;

  placedExplosives = [];
}

// Remote bombs: grouped detonation
interface RemoteBomb {
  position: CANNON.Vec3;
  group: number;
  mesh: THREE.Mesh;
}

const remoteBombs: RemoteBomb[] = [];

export function placeRemoteBomb(position: CANNON.Vec3, group: number, mesh: THREE.Mesh): void {
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
  // Add basic score for remote detonation
  scoreState.totalScore += positions.length * 200;
  if (scoreState.totalScore > scoreState.highScore) {
    scoreState.highScore = scoreState.totalScore;
    saveHighScore();
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

// Mines
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
    if (!mine.armed) { mine.armed = true; continue; }
    let triggered_ = false;
    for (const body of world.bodies) {
      if (body.mass === 0) continue;
      const dist = body.position.distanceTo(mine.position);
      if (dist < 1.5) { triggered_ = true; break; }
    }
    if (triggered_) {
      applyExplosion({ position: mine.position, radius: MINE_RADIUS, baseForce: MINE_FORCE });
      triggered.push({ position: mine.position, mesh: mine.mesh });
      mines.splice(i, 1);
      scoreState.totalScore += 200;
      if (scoreState.totalScore > scoreState.highScore) {
        scoreState.highScore = scoreState.totalScore;
        saveHighScore();
      }
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

- [ ] **Step 2: 编译验证**

Run: `npx tsc --noEmit`
Expected: 仍有错误（其他文件引用被删除模块），但 game.ts 本身的类型错误已修复

- [ ] **Step 3: Commit**

```bash
git add src/game.ts
git commit -m "feat: game.ts 清理关卡引用 + 增加多维度打分系统(摧毁/波及/连锁)"
```

---

### Task 3: constants.ts — 新武器参数

**Files:**
- Modify: `src/constants.ts`

- [ ] **Step 1: 添加新武器参数**

在文件末尾追加：

```typescript
// ============================================================
// 集束炸弹
// ============================================================
export const CLUSTER_RADIUS = 10;
export const CLUSTER_FORCE = 150;
export const CLUSTER_COLOR = 0x99aa00;
export const CLUSTER_SUB_COUNT = 8;
export const CLUSTER_SUB_SPREAD = 4;

// ============================================================
// 黑洞装置
// ============================================================
export const BLACKHOLE_RADIUS = 8;
export const BLACKHOLE_COLOR = 0x331166;
export const BLACKHOLE_SUCK_DURATION = 2.0;
export const BLACKHOLE_CHARGE_DURATION = 0.5;
export const BLACKHOLE_EJECT_FORCE = 2000;

// ============================================================
// 电磁脉冲
// ============================================================
export const EMP_RADIUS = 6;
export const EMP_FORCE = 400;
export const EMP_COLOR = 0x4488ff;
export const EMP_FLASH_DURATION = 0.3;

// ============================================================
// 喷射类
// ============================================================
export const SPRAY_FLAME_RANGE = 7;
export const SPRAY_FLAME_ENERGY = 5;
export const SPRAY_FLAME_FORCE = 80;
export const SPRAY_FLAME_TREE_IGNITE_TIME = 2;

export const SPRAY_ICE_RANGE = 8;
export const SPRAY_ICE_ENERGY = 4;
export const SPRAY_ICE_SLOW_FACTOR = 0.1;

export const SPRAY_PARTICLE_RANGE = 10;
export const SPRAY_PARTICLE_ENERGY = 3;
export const SPRAY_PARTICLE_FORCE = 500;

export const SPRAY_CONE_ANGLE = Math.PI / 6; // 30 degrees

// 更新 EXPLOSIVE_DEFS
// 在原有对象中追加：
// cluster: { radius: CLUSTER_RADIUS, baseForce: CLUSTER_FORCE, color: CLUSTER_COLOR, label: '集束炸弹' },
```

但 `EXPLOSIVE_DEFS` 是 `Record<string, ExplosiveDef>` 类型，不能直接追加。需要就地编辑 `EXPLOSIVE_DEFS` 对象，添加：

```typescript
// 在 EXPLOSIVE_DEFS 对象的 } 结尾分号前添加：
  cluster: { radius: CLUSTER_RADIUS, baseForce: CLUSTER_FORCE, color: CLUSTER_COLOR, label: '集束炸弹' },
  blackhole: { radius: BLACKHOLE_RADIUS, baseForce: 0, color: BLACKHOLE_COLOR, label: '黑洞装置' },
  emp: { radius: EMP_RADIUS, baseForce: EMP_FORCE, color: EMP_COLOR, label: '电磁脉冲' },
```

- [ ] **Step 2: 编译验证**

Run: `npx tsc --noEmit`
Expected: 无与 constants.ts 相关的新增错误

- [ ] **Step 3: Commit**

```bash
git add src/constants.ts
git commit -m "feat: constants.ts 新增集束炸弹/黑洞/EMP/喷射类武器参数"
```

---

### Task 4: input.ts — 喷射输入

**Files:**
- Modify: `src/input.ts`

- [ ] **Step 1: 添加 `spraying` 字段**

在 `InputState` 接口中增加 `spraying: boolean`：

```typescript
export interface InputState {
  rotateLeft: boolean;
  rotateRight: boolean;
  zoomIn: boolean;
  zoomOut: boolean;
  detonate: boolean;
  reset: boolean;
  mouseDown: boolean;
  spraying: boolean;
  mouseX: number;
  mouseY: number;
  rightMouseDown: boolean;
  scrollDelta: number;
  detonateGroup1: boolean;
  detonateGroup2: boolean;
  detonateGroup3: boolean;
  togglePanel: boolean;
}

export function createInputState(): InputState {
  return {
    rotateLeft: false,
    rotateRight: false,
    zoomIn: false,
    zoomOut: false,
    detonate: false,
    reset: false,
    mouseDown: false,
    spraying: false,
    mouseX: 0,
    mouseY: 0,
    rightMouseDown: false,
    scrollDelta: 0,
    detonateGroup1: false,
    detonateGroup2: false,
    detonateGroup3: false,
    togglePanel: false,
  };
}
```

- [ ] **Step 2: 修改鼠标事件以区分喷射和点放**

在 `setupInput` 中修改 `mousedown` 处理：对非左键（右键/中键）不设 `mouseDown`，左键按下时设 `mouseDown = true`，`spraying` 在 main.ts 中根据选中武器类型控制。

main.ts 中通过 `input. mouseDown` 区分：如果选中的是喷射类武器，按住时持续喷射；如果是点放型，单击放置。

不需要修改 `setupInput` 本身——`spraying` 由 main.ts 在每帧设置：
```typescript
input.spraying = input.mouseDown && isSprayType(selectedType);
```

- [ ] **Step 3: 编译验证**

Run: `npx tsc --noEmit`
Expected: 无新增错误

- [ ] **Step 4: Commit**

```bash
git add src/input.ts
git commit -m "feat: input.ts 新增 spraying 喷射输入状态"
```

---

### Task 5: scene.ts — 移除关卡代码

**Files:**
- Modify: `src/scene.ts`

- [ ] **Step 1: 移除关卡相关代码**

需要删除/还原：

1. 删除 `import { BuildingDef } from './level';`（第 1 行区域）
2. 还原 `Building` 接口，删除 `id: number;` 字段：
   ```typescript
   interface Building {
     mesh: THREE.Mesh;
     width: number;
     depth: number;
     height: number;
   }
   ```
3. 删除 `nextId` 变量和 `resetIdCounter()` 函数
4. 还原 `createBuildings()` 中的 `physicsBodies.push` 和 `buildings.push`，去掉 `objectId: id` 和 `id` ：
   ```typescript
   physicsBodies.push({ body, mesh, isBuilding: true });
   buildings.push({ mesh, width: w, depth: d, height: h });
   ```
5. 还原 `createSingleBuilding()` 同理去掉 ID 分配
6. 还原 `createSingleVehicle()` 去掉 `objectId`
7. 还原 `createSingleTree()` 去掉 `objectId`
8. 删除 `targetMarkers` 数组
9. 删除 `clearScene()` 函数中的 `targetMarkers` 清理代码
10. 删除 `clearScene()` 函数
11. 删除 `buildFromLayout()` 函数
12. 从导出列表中移除 `clearScene` 和 `buildFromLayout`

`createScene()` 函数保持不变。

- [ ] **Step 2: 编译验证**

Run: `npx tsc --noEmit`
Expected: 修复 scene.ts 相关的类型错误

- [ ] **Step 3: Commit**

```bash
git add src/scene.ts
git commit -m "refactor: scene.ts 移除关卡相关代码(Building.id/clearScene/buildFromLayout)"
```

---

### Task 6: physics.ts — 移除 objectId + 碎片碰撞检测

**Files:**
- Modify: `src/physics.ts`

- [ ] **Step 1: 移除关卡相关 + 增加碎片碰撞**

1. 删除 `import { notifyDestroy } from './destruction';`
2. 从 `PhysicsBody` 接口中删除 `objectId?: number;` 字段
3. 从 `fragmentBuilding()` 中删除 notifyDestroy 调用（顶部 3 行）
4. 在碎片更新逻辑中（main.ts 的 animate 循环里），增加碰撞检测代码。在 main.ts 中碎片更新循环内添加：

```typescript
// In main.ts animate(), in the debrisList loop, before speed check:
// Chain reaction: debris hits other objects
if (d.body.velocity.length() > 8) {
  for (const pb of physicsBodies) {
    if (pb.isBuilding) {
      const dist = d.body.position.distanceTo(pb.body.position);
      if (dist < 2.5) {
        const impactForce = d.body.velocity.length() * d.body.mass;
        if (impactForce > 300) {
          // Apply impulse to the building
          const dir = new CANNON.Vec3(
            d.body.position.x - pb.body.position.x,
            0,
            d.body.position.z - pb.body.position.z,
          );
          dir.normalize();
          pb.body.applyImpulse(dir.scale(impactForce * 0.3), pb.body.position);
          addChainScore();
        }
      }
    }
  }
}
```

这需要从 main.ts 能访问 `addChainScore`，所以 main.ts 已经导入了 game.ts。

- [ ] **Step 2: 编译验证**

Run: `npx tsc --noEmit`
Expected: 修复所有类型错误

- [ ] **Step 3: Commit**

```bash
git add src/physics.ts src/main.ts
git commit -m "feat: physics.ts 移除objectId+增加碎片碰撞连锁检测"
```

---

### Task 7: effects.ts — 新特效函数

**Files:**
- Modify: `src/effects.ts`

- [ ] **Step 1: 添加集束炸弹特效**

在文件末尾（`updateEffects` 之前）添加：

```typescript
// ============================================================
// Cluster bomb: parent airburst → 8 submunitions
// ============================================================
export function spawnClusterEffect(position: THREE.Vector3): void {
  const scene = getScene();
  const parentColors = [0xff8800, 0xffaa00, 0xff6600];

  // Parent flash at 5m height
  const airPos = position.clone();
  airPos.y += 5;

  for (let i = 0; i < 15; i++) {
    const color = parentColors[Math.floor(Math.random() * parentColors.length)];
    addParticle(airPos, randomVelocity(4, 2), color, 0.15, 0.3 + Math.random() * 0.4);
  }

  // 8 submunitions spread outward and downward
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 + Math.random() * 0.3;
    const spread = 2 + Math.random() * 3;
    const subPos = airPos.clone().add(
      new THREE.Vector3(Math.cos(angle) * spread, -1, Math.sin(angle) * spread),
    );

    // Small flash at each sub impact
    setTimeout(() => {
      for (let j = 0; j < 8; j++) {
        const c = parentColors[Math.floor(Math.random() * parentColors.length)];
        addParticle(subPos, randomVelocity(3, 1), c, 0.1, 0.2 + Math.random() * 0.3);
      }
    }, 200 + i * 50);
  }
}

// ============================================================
// Black Hole: suck → charge → eject
// ============================================================
export function spawnBlackHoleEffect(position: THREE.Vector3): void {
  const scene = getScene();

  // Dark sphere core
  const coreGeo = new THREE.SphereGeometry(0.5, 8, 8);
  const coreMat = new THREE.MeshBasicMaterial({ color: 0x110022, transparent: true, opacity: 0.8 });
  const core = new THREE.Mesh(coreGeo, coreMat);
  core.position.copy(position);
  core.position.y += 1;
  scene.add(core);

  let elapsed = 0;
  const suckDuration = 2.0;
  const chargeDuration = 0.5;
  const totalDuration = suckDuration + chargeDuration;

  function animateBlackHole(dt: number): boolean {
    elapsed += dt;

    if (elapsed < suckDuration) {
      // Suck phase: pull particles inward
      const t = elapsed / suckDuration;
      core.scale.setScalar(1 + t * 3);
      coreMat.opacity = 0.8 * (1 - t * 0.3);
      for (let i = 0; i < 3; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 5 + Math.random() * 3;
        const p = position.clone().add(
          new THREE.Vector3(Math.cos(angle) * dist, Math.random() * 3, Math.sin(angle) * dist),
        );
        const dir = position.clone().sub(p).normalize();
        addParticle(p, dir.multiplyScalar(3 + Math.random() * 5), 0x6633aa, 0.08, 0.8);
      }
    } else if (elapsed < totalDuration) {
      // Charge flash
      coreMat.color.setHex(0xffffff);
      coreMat.opacity = 1;
      core.scale.setScalar(5 + Math.random());
    } else {
      // Eject
      scene.remove(core);
      coreGeo.dispose();
      coreMat.dispose();
      // Outward blast particles
      for (let i = 0; i < 40; i++) {
        const color = [0x9933ff, 0x6633cc, 0xffffff][Math.floor(Math.random() * 3)];
        addParticle(position.clone().add(new THREE.Vector3(0, 1, 0)), randomVelocity(15, 5), color, 0.12, 0.6 + Math.random() * 0.5);
      }
      return false;
    }
    return true;
  }
  activeAnimations.push(animateBlackHole);
}

// ============================================================
// EMP: blue-white lightning sphere + screen flash
// ============================================================
let screenFlashIntensity = 0;

export function getScreenFlash(): number {
  const v = screenFlashIntensity;
  screenFlashIntensity *= 0.9;
  return v;
}

export function spawnEMPEffect(position: THREE.Vector3): void {
  const scene = getScene();
  const colors = [0x4488ff, 0x88bbff, 0xffffff, 0xaaccff];

  // Lightning sphere
  const sphereGeo = new THREE.SphereGeometry(0.5, 8, 8);
  const sphereMat = new THREE.MeshBasicMaterial({ color: 0x4488ff, transparent: true, opacity: 0.9 });
  const sphere = new THREE.Mesh(sphereGeo, sphereMat);
  sphere.position.copy(position);
  sphere.position.y += 1;
  scene.add(sphere);

  let elapsed = 0;
  const duration = 0.6;

  function animateEMP(dt: number): boolean {
    elapsed += dt;
    const t = elapsed / duration;
    sphere.scale.setScalar(1 + t * 12);
    sphereMat.opacity = Math.max(0, 0.9 * (1 - t));

    // Lightning bolt particles
    for (let i = 0; i < 5; i++) {
      const color = colors[Math.floor(Math.random() * colors.length)];
      const p = sphere.position.clone().add(
        new THREE.Vector3((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 6),
      );
      addParticle(p, new THREE.Vector3(0, 10, 0), color, 0.06, 0.15);
    }

    if (elapsed >= duration) {
      scene.remove(sphere);
      sphereGeo.dispose();
      sphereMat.dispose();
      return false;
    }
    return true;
  }
  activeAnimations.push(animateEMP);

  // Trigger screen flash
  screenFlashIntensity = 1;
}

// ============================================================
// Spray effects (continuous, called each frame while spraying)
// ============================================================
export function sprayFlameEffect(origin: THREE.Vector3, direction: THREE.Vector3, dt: number): void {
  const colors = [0xff4400, 0xff6600, 0xff8800, 0xffaa00, 0xff2200];
  const count = Math.floor(8 * dt * 60); // Scale to ~8 particles per frame at 60fps
  for (let i = 0; i < Math.max(1, count); i++) {
    const spreadAngle = (Math.random() - 0.5) * SPRAY_CONE_ANGLE * 2;
    const spreadDir = direction.clone();
    spreadDir.x += (Math.random() - 0.5) * 0.3;
    spreadDir.z += (Math.random() - 0.5) * 0.3;
    spreadDir.normalize();
    const color = colors[Math.floor(Math.random() * colors.length)];
    const speed = 4 + Math.random() * 6;
    addParticle(
      origin.clone().add(new THREE.Vector3((Math.random()-0.5)*0.3, (Math.random()-0.5)*0.3, (Math.random()-0.5)*0.3)),
      spreadDir.multiplyScalar(speed),
      color, 0.06, 0.3 + Math.random() * 0.4,
    );
  }
}

export function sprayIceEffect(origin: THREE.Vector3, direction: THREE.Vector3, dt: number): void {
  const colors = [0x88ccff, 0xaaddff, 0xccddff, 0xffffff, 0x6699cc];
  const count = Math.floor(6 * dt * 60);
  for (let i = 0; i < Math.max(1, count); i++) {
    const spreadDir = direction.clone();
    spreadDir.x += (Math.random() - 0.5) * 0.3;
    spreadDir.z += (Math.random() - 0.5) * 0.3;
    spreadDir.normalize();
    const color = colors[Math.floor(Math.random() * colors.length)];
    addParticle(origin, spreadDir.multiplyScalar(3 + Math.random() * 5), color, 0.05, 0.4 + Math.random() * 0.5);
  }
}

export function sprayParticleEffect(origin: THREE.Vector3, direction: THREE.Vector3, dt: number): void {
  const colors = [0x9933ff, 0xcc66ff, 0xaa44ff, 0xffffff, 0xdd88ff];
  const count = Math.floor(5 * dt * 60);
  for (let i = 0; i < Math.max(1, count); i++) {
    const spreadDir = direction.clone();
    spreadDir.x += (Math.random() - 0.5) * 0.2;
    spreadDir.z += (Math.random() - 0.5) * 0.2;
    spreadDir.normalize();
    const color = colors[Math.floor(Math.random() * colors.length)];
    const p = origin.clone().add(new THREE.Vector3((Math.random()-0.5)*0.2, (Math.random()-0.5)*0.2, (Math.random()-0.5)*0.2));
    addParticle(p, spreadDir.multiplyScalar(8 + Math.random() * 10), color, 0.06, 0.2 + Math.random() * 0.3);
  }
}

// 需要导入 SPRAY_CONE_ANGLE
import { SPRAY_CONE_ANGLE } from './constants';
```

- [ ] **Step 2: 编译验证**

Run: `npx tsc --noEmit`
Expected: 修复 effects.ts 相关错误

- [ ] **Step 3: Commit**

```bash
git add src/effects.ts
git commit -m "feat: effects.ts 新增集束炸弹/黑洞/EMP/喷射特效+屏幕闪光"
```

---

### Task 8: ui.ts — 重写为沙盒评分 HUD

**Files:**
- Modify: `src/ui.ts`

- [ ] **Step 1: 重写 ui.ts**

移除关卡相关导入和逻辑，重写为纯沙盒 HUD + 飘字 + 最高分显示：

```typescript
import { scoreState, ScoreBreakdown } from './game';

export interface UIState {
  selectedExplosive: string;
}

export function createUI(container: HTMLElement): UIState {
  const state: UIState = { selectedExplosive: 'tnt' };

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
    <span id="score-display" style="font-size:16px;">
      总分: <span id="total-score" style="color:#ffd700;font-size:20px;">0</span>
      &nbsp;🏆 最高: <span id="high-score" style="color:#ff9800;">0</span>
    </span>
  `;
  container.appendChild(topBar);

  // Floating score text container
  const floatLayer = document.createElement('div');
  floatLayer.id = 'float-layer';
  floatLayer.style.cssText = `
    position: absolute; top: 0; left: 0; right: 0; bottom: 0;
    pointer-events: none; z-index: 20; overflow: hidden;
  `;
  container.appendChild(floatLayer);

  return state;
}

export function updateUI(container: HTMLElement, state: UIState): void {
  const infoEl = container.querySelector<HTMLElement>('#explosive-info');
  if (infoEl) infoEl.textContent = `当前: ${state.selectedExplosive.toUpperCase()}`;

  const totalEl = container.querySelector<HTMLElement>('#total-score');
  if (totalEl) totalEl.textContent = String(scoreState.totalScore);

  const highEl = container.querySelector<HTMLElement>('#high-score');
  if (highEl) highEl.textContent = String(scoreState.highScore);

  // Show floating score text for last detonation
  if (scoreState.lastScore && scoreState.lastScorePosition) {
    spawnFloatingScore(container, scoreState.lastScore, scoreState.lastScorePosition);
    scoreState.lastScore = null;
    scoreState.lastScorePosition = null;
  }
}

function spawnFloatingScore(
  container: HTMLElement,
  breakdown: ScoreBreakdown,
  worldPos: THREE.Vector3,
): void {
  // Convert 3D position to screen coordinates using a simple clamped approach
  const layer = container.querySelector<HTMLElement>('#float-layer');
  if (!layer) return;

  // We can't easily project 3D→2D here (no camera access),
  // so we place the float text at a random position near center-top.
  // The main.ts animate loop handles the actual projection and calls showFloatText directly.

  // This function is a fallback; actual call goes through main.ts
}

// Called from main.ts with screen-space coordinates
export function showFloatText(
  container: HTMLElement,
  totalScore: number,
  destroyScore: number,
  impactScore: number,
  chainScore: number,
  screenX: number,
  screenY: number,
): void {
  const layer = container.querySelector<HTMLElement>('#float-layer');
  if (!layer) return;

  const el = document.createElement('div');
  el.style.cssText = `
    position: absolute; left: ${screenX}px; top: ${screenY}px;
    color: #ffd700; font-size: 22px; font-weight: bold;
    text-shadow: 0 0 12px rgba(255,200,0,0.9), 0 0 24px rgba(255,150,0,0.5);
    pointer-events: none; z-index: 25;
    animation: floatUp 1.5s ease-out forwards;
  `;
  el.innerHTML = `+${totalScore}`;

  if (destroyScore > 0 || impactScore > 0 || chainScore > 0) {
    const detail = document.createElement('div');
    detail.style.cssText = 'font-size:11px;font-weight:normal;color:#ccc;';
    const parts: string[] = [];
    if (destroyScore > 0) parts.push(`💥摧毁 +${destroyScore}`);
    if (impactScore > 0) parts.push(`🌊波及 +${impactScore}`);
    if (chainScore > 0) parts.push(`🔗连锁 +${chainScore}`);
    detail.textContent = parts.join('  ');
    el.appendChild(detail);
  }

  layer.appendChild(el);
  setTimeout(() => { layer.removeChild(el); }, 1600);
}

// Inject float animation CSS
const floatStyle = document.createElement('style');
floatStyle.textContent = `
  @keyframes floatUp {
    0% { opacity: 1; transform: translateY(0) scale(1); }
    30% { opacity: 1; transform: translateY(-30px) scale(1.1); }
    100% { opacity: 0; transform: translateY(-90px) scale(0.8); }
  }
`;
document.head.appendChild(floatStyle);
```

- [ ] **Step 2: 编译验证**

Run: `npx tsc --noEmit`
Expected: 修复 ui.ts 相关错误

- [ ] **Step 3: Commit**

```bash
git add src/ui.ts
git commit -m "feat: ui.ts 重写为沙盒评分HUD(总分/最高分/飘字)"
```

---

### Task 9: weaponpanel.ts — 移除关卡 UI + 新道具卡片

**Files:**
- Modify: `src/weaponpanel.ts`

- [ ] **Step 1: 清理关卡相关 + 增加新分类和道具**

1. 删除关卡相关 import（`LEVELS`/`startLevel`/`returnToMenu`/`getPhase`/`getProgress`/`recordSkip`/`initLevelSystem`/`getLevelState` from `./level` 和 `resetProgress` from `./persistence`）
2. 删除关卡列表 DOM（`levelList`/`levelGrid`/`refreshLevelList` 等）
3. 删除 `(window as any).__refreshLevelList` 赋值
4. 删除重置进度按钮
5. 简化模式按钮逻辑——移除关卡模式切换，仅保留沙盒标识
6. 在武器分类区域增加新道具卡片：

**爆炸类**中增加：集束炸弹卡片
**新增"喷射类"分类**：火焰喷射器 / 冰冻喷射 / 粒子喷射
**新增"物理装置"分类**：黑洞装置（磁铁/弹力板灰色占位）
**特殊类**中增加：电磁脉冲

关键修改——在 `createWeaponPanel` 中的武器分类 grid 区域之后、`btnContainer` 之前，插入新分类的 DOM 元素。具体新增卡片 HTML 结构与现有卡片一致（emoji + 名称，data-type 属性）。

新增喷射类分类：

```typescript
// After 特殊类 section, before btnContainer:
const spraySection = document.createElement('div');
spraySection.style.cssText = 'margin-top: 8px;';
spraySection.innerHTML = '<div style="font-size:11px;color:#4dd0e1;margin-bottom:4px;">── 喷射类 ──</div>';
const sprayGrid = document.createElement('div');
sprayGrid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:4px;';
const sprayItems = [
  { type: 'flamethrower', emoji: '🔥', name: '火焰喷射' },
  { type: 'ice_spray', emoji: '❄️', name: '冰冻喷射' },
  { type: 'particle_spray', emoji: '⚛️', name: '粒子喷射' },
];
for (const item of sprayItems) {
  const card = createWeaponCard(item.type, item.emoji, item.name);
  sprayGrid.appendChild(card);
}
spraySection.appendChild(sprayGrid);
panel.insertBefore(spraySection, btnContainer);
```

新增物理装置分类（在特殊类之后）：

```typescript
const physicsSection = document.createElement('div');
physicsSection.style.cssText = 'margin-top: 8px;';
physicsSection.innerHTML = '<div style="font-size:11px;color:#4fc3f7;margin-bottom:4px;">── 物理装置 ──</div>';
const physicsGrid = document.createElement('div');
physicsGrid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:4px;';
const physicsItems = [
  { type: 'blackhole', emoji: '🕳️', name: '黑洞装置' },
  { type: 'magnet', emoji: '🧲', name: '磁铁', disabled: true },
  { type: 'bounce', emoji: '🦘', name: '弹力板', disabled: true },
];
for (const item of physicsItems) {
  const card = createWeaponCard(item.type, item.emoji, item.name, item.disabled);
  physicsGrid.appendChild(card);
}
physicsSection.appendChild(physicsGrid);
panel.insertBefore(physicsSection, btnContainer);
```

在爆炸类 grid 中增加集束炸弹卡片：
```typescript
{ type: 'cluster', emoji: '💥', name: '集束炸弹' },
```

在特殊类 grid 中增加电磁脉冲卡片：
```typescript
{ type: 'emp', emoji: '⚡', name: '电磁脉冲' },
```

`createWeaponCard` 函数增加 `disabled` 参数，禁用卡片灰色显示不可点击。

- [ ] **Step 2: 编译验证**

Run: `npx tsc --noEmit`
Expected: 修复 weaponpanel.ts 相关错误

- [ ] **Step 3: Commit**

```bash
git add src/weaponpanel.ts
git commit -m "feat: weaponpanel.ts 移除关卡UI+增加喷射类/物理装置/集束/EMP道具卡片"
```

---

### Task 10: main.ts — 完整集成

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: 重写 main.ts 的 import 和集成逻辑**

这是最大的改动。关键集成点：

1. **删除关卡相关 import**：移除 `destruction` / `level` 相关导入
2. **删除关卡生命周期代码**：移除 `initLevelSystem`/`startLevel`/`checkObjectives` 等调用
3. **增加 score/floating text import**：`import { showFloatText } from './ui'`
4. **增加特效 import**：`import { sprayFlameEffect, sprayIceEffect, sprayParticleEffect, getScreenFlash } from './effects'`
5. **增加打分相关**：从 game.ts 导入 `scoreState`/`loadHighScore`/`resetScore`/`addChainScore`
6. **喷射武器处理**：在 `animate()` 中检测 `isSprayType(selectedType) && input.spraying`，持续调用喷射特效 + 对前方锥形区域施加力
7. **屏幕震动**：大爆炸后触发 camera 偏移
8. **飘字投影**：引爆后将 3D 坐标投影到屏幕坐标
9. **碎片碰撞检测**：在 debris 更新循环中增加（Task 6 已有）

主要代码结构：

```typescript
// imports...
import { scoreState, loadHighScore, resetScore, addChainScore } from './game';
import { sprayFlameEffect, sprayIceEffect, sprayParticleEffect, getScreenFlash } from './effects';
import { showFloatText } from './ui';
import { SPRAY_FLAME_RANGE, SPRAY_ICE_RANGE, SPRAY_PARTICLE_RANGE, SPRAY_FLAME_FORCE, SPRAY_ICE_SLOW_FACTOR, SPRAY_PARTICLE_FORCE } from './constants';

// ... after createScene():
loadHighScore();

// ... after createUI/WeaponPanel...

// Determine selected weapon type
function getSelectedType(): string {
  return panelState.selectedType || uiState.selectedExplosive;
}

function isSprayType(type: string): boolean {
  return type === 'flamethrower' || type === 'ice_spray' || type === 'particle_spray';
}

// Screen shake state
let shakeAmount = 0;
let shakeDuration = 0;

function addScreenShake(intensity: number, duration: number): void {
  shakeAmount = Math.max(shakeAmount, intensity);
  shakeDuration = Math.max(shakeDuration, duration);
}

// In placeItem(), handle spray types as no-op (they're handled in animate):
function placeItem(type: string, x: number, z: number): void {
  if (isSprayType(type)) return; // Spray weapons handled in animate loop
  // ... rest of existing placeItem logic (unchanged)
  // Add new weapon cases:
  // case 'cluster': placeExplosive('cluster', pos); createExplosiveMesh('cluster', pos); break;
  // case 'blackhole': ... (place as explosive for detonateAll)
  // case 'emp': ... (place as explosive for detonateAll)
}

// In animate():
function animate() {
  // ... existing code ...

  // Screen shake
  if (shakeDuration > 0) {
    shakeDuration -= dt;
    const cam = getCamera();
    const sx = (Math.random() - 0.5) * shakeAmount * 2;
    const sy = (Math.random() - 0.5) * shakeAmount * 2;
    cam.position.x += sx;
    cam.position.y += sy;
    if (shakeDuration <= 0) shakeAmount = 0;
  }

  // Spray weapon handling
  const selectedType = getSelectedType();
  input.spraying = input.mouseDown && isSprayType(selectedType);
  if (input.spraying) {
    const intersection = getGroundIntersection(input.mouseX, input.mouseY);
    if (intersection) {
      const origin = intersection.clone();
      origin.y += 1.5;
      // Direction: forward from camera
      const cam = getCamera();
      const dir = new THREE.Vector3();
      cam.getWorldDirection(dir);
      dir.y = 0; // Keep spray horizontal
      dir.normalize();

      switch (selectedType) {
        case 'flamethrower':
          sprayFlameEffect(origin, dir, dt);
          // Apply force to bodies in cone
          applySprayForce(origin, dir, SPRAY_FLAME_RANGE, SPRAY_FLAME_FORCE, dt, 'burn');
          break;
        case 'ice_spray':
          sprayIceEffect(origin, dir, dt);
          applySprayForce(origin, dir, SPRAY_ICE_RANGE, SPRAY_ICE_SLOW_FACTOR, dt, 'freeze');
          break;
        case 'particle_spray':
          sprayParticleEffect(origin, dir, dt);
          applySprayForce(origin, dir, SPRAY_PARTICLE_RANGE, SPRAY_PARTICLE_FORCE, dt, 'push');
          break;
      }
    }
  }

  // Screen flash (EMP effect)
  const flash = getScreenFlash();
  if (flash > 0.01) {
    const flashEl = document.getElementById('emp-flash');
    if (!flashEl) {
      const el = document.createElement('div');
      el.id = 'emp-flash';
      el.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;background:white;pointer-events:none;z-index:15;';
      container.appendChild(el);
    }
    const el = document.getElementById('emp-flash')!;
    el.style.opacity = String(flash * 0.4);
    if (flash < 0.02) el.style.opacity = '0';
  }

  // After detonateAll in animate:
  if (input.detonate) {
    detonateAll(physicsBodies, debrisList, scene);
    removeAllExplosives();

    // Show floating score
    if (scoreState.lastScore && scoreState.lastScorePosition) {
      const cam = getCamera();
      const screenPos = scoreState.lastScorePosition.clone().project(cam);
      const sx = (screenPos.x * 0.5 + 0.5) * container.clientWidth;
      const sy = (-screenPos.y * 0.5 + 0.5) * container.clientHeight;
      const b = scoreState.lastScore;
      const total = b.destroyScore + b.impactScore + b.chainScore;
      showFloatText(container, total, b.destroyScore, b.impactScore, b.chainScore, sx, sy);
    }

    // Screen shake for big explosions
    if (placedCount > 0) { // use last explosion type...
      // For nuke/cluster: addScreenShake(8, 0.8);
      // For C4/EMP: addScreenShake(3, 0.3);
    }

    input.detonate = false;
  }

  // ... rest of existing code ...

  // Debris chain collision detection (from Task 6)
  for (const d of debrisList) {
    // ... existing update code ...
    if (d.body.velocity.length() > 8) {
      for (const pb of physicsBodies) {
        if (pb.isBuilding) {
          const dist = d.body.position.distanceTo(pb.body.position);
          if (dist < 2.5) {
            const impactForce = d.body.velocity.length() * d.body.mass;
            if (impactForce > 300) {
              const dir = new CANNON.Vec3(
                d.body.position.x - pb.body.position.x,
                0,
                d.body.position.z - pb.body.position.z,
              );
              dir.normalize();
              pb.body.applyImpulse(dir.scale(impactForce * 0.3), pb.body.position);
              addChainScore();
            }
          }
        }
      }
    }
  }
}

// Helper: apply spray force to physics bodies in cone
function applySprayForce(
  origin: THREE.Vector3,
  direction: THREE.Vector3,
  range: number,
  force: number,
  dt: number,
  mode: 'burn' | 'freeze' | 'push',
): void {
  for (const pb of physicsBodies) {
    if (pb.body.mass === 0) continue;
    const p = new THREE.Vector3(pb.body.position.x, pb.body.position.y, pb.body.position.z);
    const toTarget = p.clone().sub(origin);
    const dist = toTarget.length();
    if (dist > range) continue;

    const toTargetNorm = toTarget.normalize();
    const dot = toTargetNorm.dot(direction);
    if (dot < 0.7) continue; // ~45 degree half-cone

    const impulse = direction.clone().multiplyScalar(force * dt * (1 - dist / range));
    if (mode === 'freeze') {
      pb.body.velocity.scale(1 - (1 - force) * dt * (1 - dist / range), pb.body.velocity);
    } else {
      pb.body.applyImpulse(
        new CANNON.Vec3(impulse.x, impulse.y, impulse.z),
        pb.body.position,
      );
    }
  }
}
```

- [ ] **Step 2: 编译验证**

Run: `npx tsc --noEmit`
Expected: 修复所有类型错误，确保零错误

- [ ] **Step 3: Commit**

```bash
git add src/main.ts
git commit -m "feat: main.ts 集成打分/喷射武器/屏幕震动/飘字/碎片连锁"
```

---

### Task 11: 端到端验证

- [ ] **Step 1: 编译检查**

Run: `npx tsc --noEmit`
Expected: 零错误

- [ ] **Step 2: 启动开发服务器**

Run: `npm run dev`
Expected: 正常启动

- [ ] **Step 3: 验证功能**
- 沙盒模式正常加载
- 武器面板显示全部 5 个分类
- 放置 TNT → 引爆 → HUD 显示得分
- 引爆位置出现飘字
- 最高分持久化（刷新后保留）
- 喷射类武器按住鼠标持续施放
- 集束炸弹空爆效果
- 黑洞吸入抛射效果
- EMP 屏幕闪烁

- [ ] **Step 4: Commit（如有修复）**

```bash
git add -A
git commit -m "fix: 端到端验证修复"
```
