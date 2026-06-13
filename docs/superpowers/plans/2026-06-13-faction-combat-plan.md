# 阵营对战系统 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 红蓝双阵营兵营 + 火柴人对战(远程射击+近战拳击) + 头顶血条

**Architecture:** faction 字段贯穿 `StickmanState`/`BarracksState`/`AIState`。`stickman_ai.ts` 新增弹丸系统(projectile)和战斗状态机(combat_ranged/combat_melee)，武器面板换为红/蓝两张卡片。

**Tech Stack:** TypeScript, Three.js, Cannon-es

---

## File Structure

| 文件 | 操作 | 职责 |
|------|------|------|
| `src/constants.ts` | 修改 | +11 战斗常量 |
| `src/stickman.ts` | 修改 | faction + healthBar + 战斗出手动画 + state 类型扩展 |
| `src/barracks.ts` | 修改 | faction + 颜色分化 + createStickman 传 faction |
| `src/stickman_ai.ts` | 修改 | Projectile系统 + combatTarget + 战斗状态机 + 目标扫描 |
| `src/weaponpanel.ts` | 修改 | 替换 barracks 为 barracks_red / barracks_blue |
| `src/main.ts` | 修改 | 弹丸更新 + 战斗AI调用 + faction路由 + healthBar billboard |

---

### Task 1: 更新 constants.ts — 战斗参数

**Files:**
- Modify: `src/constants.ts`

- [ ] **Step 1: 追加战斗常量**

在文件末尾「士气」块之后追加:

```ts
// ============================================================
// 战斗
// ============================================================
export const COMBAT_SCAN_RADIUS = 12;
export const COMBAT_SCAN_INTERVAL = 1;
export const COMBAT_RANGED_RANGE = 8;
export const COMBAT_MELEE_RANGE = 2;
export const COMBAT_LOSE_TARGET_RANGE = 15;
export const COMBAT_RANGED_COOLDOWN = 1.5;
export const COMBAT_MELEE_COOLDOWN = 0.8;
export const COMBAT_RANGED_DAMAGE = 15;
export const COMBAT_MELEE_DAMAGE = 10;
export const PROJECTILE_SPEED = 15;
export const PROJECTILE_LIFETIME = 2;
```

- [ ] **Step 2: 类型检查**

```bash
npx tsc --noEmit
```

预期: 无报错（常量未被引用时无副作用）。

---

### Task 2: 改造 stickman.ts — faction + healthBar + 状态类型扩展

**Files:**
- Modify: `src/stickman.ts`

- [ ] **Step 1: 更新 import 常量**

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

- [ ] **Step 2: StickmanState 接口 — 加 faction + healthBar + attackAnimTimer + 扩展 state 类型**

```ts
export interface StickmanState {
  group: THREE.Group;
  body: CANNON.Body;
  hp: number;
  maxHp: number;
  state: 'idle' | 'walking' | 'fleeing' | 'combat_melee' | 'combat_ranged';
  alive: boolean;
  faction: 'red' | 'blue';
  healthBar: { bg: THREE.Mesh; fill: THREE.Mesh } | null;
  attackAnimTimer: number;
  partRefs: Map<string, THREE.Object3D>;
  animTime: number;
  animPhase: number;
  deathTimer: number;
  isDeadReadyCleanup: boolean;
}
```

- [ ] **Step 3: createStickman 签名加 faction + 颜色 + healthBar 创建**

替换函数签名:
```ts
export function createStickman(x: number, z: number, faction: 'red' | 'blue', hp?: number): StickmanState {
```

身体颜色:
```ts
const bodyColor = faction === 'red' ? 0xcc3333 : 0x3366cc;
const bodyMat = new THREE.MeshToonMaterial({ color: bodyColor });
```

在 `group.position.set(x, 0, z)` 之前插入 healthBar 创建:
```ts
// Health bar (billboard)
const barBgGeo = new THREE.PlaneGeometry(0.6, 0.06);
const barBgMat = new THREE.MeshBasicMaterial({ color: 0x333333, transparent: true, opacity: 0.7, depthTest: false });
const barBg = new THREE.Mesh(barBgGeo, barBgMat);
barBg.position.y = STICKMAN_HEIGHT + 0.25;
barBg.renderOrder = 999;

const barFillGeo = new THREE.PlaneGeometry(0.58, 0.04);
const barFillMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, depthTest: false });
const barFill = new THREE.Mesh(barFillGeo, barFillMat);
barFill.position.z = 0.002;
barFill.renderOrder = 1000;

barBg.add(barFill);
group.add(barBg);
```

返回值加:
```ts
faction,
healthBar: { bg: barBg, fill: barFill },
attackAnimTimer: 0,
```

- [ ] **Step 4: damageStickman — 死亡前更新血条**

在 `if (sm.hp <= 0)` 之前插入:
```ts
if (sm.healthBar) {
  const pct = Math.max(0, sm.hp / sm.maxHp);
  sm.healthBar.fill.scale.x = Math.max(0.01, pct);
  const r = pct < 0.5 ? 1 : 2 * (1 - pct);
  const g = pct > 0.5 ? 1 : 2 * pct;
  (sm.healthBar.fill.material as THREE.MeshBasicMaterial).color.setRGB(r, g, 0);
}
```

- [ ] **Step 5: updateStickmanAnimation — 战斗出手动画**

在函数开头 `const isMoving = speed > 0.1;` 之前加:
```ts
const isAttacking = sm.attackAnimTimer > 0;
if (isAttacking) sm.attackAnimTimer -= dt;
```

在 idle sway 分支之前插入:
```ts
if (isAttacking && rightArm) {
  const t = sm.attackAnimTimer / 0.15;
  rightArm.rotation.x = -0.8 * Math.sin(t * Math.PI);
}
```

- [ ] **Step 6: 新增 triggerAttackAnim 导出**

```ts
export function triggerAttackAnim(sm: StickmanState, _isMelee: boolean): void {
  sm.attackAnimTimer = 0.15;
}
```

- [ ] **Step 7: 更新 updateStickmanMotion 末尾 — healthBar billboard**

在 `sm.group.quaternion.copy` 之后插入:
```ts
// Update health bar visibility
if (sm.healthBar) {
  sm.healthBar.bg.visible = sm.alive && sm.deathTimer > 0 ? false : sm.alive;
}
```

- [ ] **Step 8: 类型检查**

```bash
npx tsc --noEmit
```

预期: `barracks.ts` 报错（`createStickman` 签名变了），`main.ts` 报错（`updateStickman` 被移除），后续 task 修复。

---

### Task 3: 改造 barracks.ts — faction + 颜色分化

**Files:**
- Modify: `src/barracks.ts`

- [ ] **Step 1: BarracksState 加 faction**

```ts
export interface BarracksState {
  group: THREE.Group;
  body: CANNON.Body;
  hp: number; maxHp: number;
  spawnRate: number; spawnTimer: number;
  maxUnits: number;
  alive: boolean;
  faction: 'red' | 'blue';
  morale: number;
  lastMoraleEventTime: number;
}
```

- [ ] **Step 2: createBarracks 签名 + faction 参数**

```ts
export function createBarracks(x: number, z: number, faction: 'red' | 'blue'): BarracksState {
```

帐篷颜色:
```ts
const tentColor = faction === 'red' ? 0x883333 : 0x334488;
const poleColor = faction === 'red' ? 0xff4444 : 0x4488ff;
```

返回值加:
```ts
faction,
```

- [ ] **Step 3: updateBarracks — createStickman 传 faction**

```ts
const sm = createStickman(sx, sz, barracks.faction);
```

- [ ] **Step 4: 类型检查**

```bash
npx tsc --noEmit
```

预期: `main.ts` 报错（`createBarracks` 签名变了, `updateStickman` 不存在），下一步修复。

---

### Task 4: 改造 stickman_ai.ts — 弹丸 + 战斗 AI

**Files:**
- Modify: `src/stickman_ai.ts`

- [ ] **Step 1: import 追加战斗常量**

```ts
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
  MORALE_DEATH_PENALTY, MORALE_BARRACKS_DAMAGE,
  MORALE_EXPLOSION_NEAR, MORALE_KILL_BONUS,
  MORALE_LOW_THRESHOLD, MORALE_HIGH_THRESHOLD,
  MORALE_COOLDOWN,
  WORLD_SIZE, ROAD_WIDTH,
  COMBAT_SCAN_RADIUS, COMBAT_SCAN_INTERVAL,
  COMBAT_RANGED_RANGE, COMBAT_MELEE_RANGE,
  COMBAT_LOSE_TARGET_RANGE,
  COMBAT_RANGED_COOLDOWN, COMBAT_MELEE_COOLDOWN,
  COMBAT_RANGED_DAMAGE, COMBAT_MELEE_DAMAGE,
  PROJECTILE_SPEED, PROJECTILE_LIFETIME,
} from './constants';
```

- [ ] **Step 2: Projectile 接口 + 模块数组**

在文件顶部 (import 之后) 加:
```ts
export interface Projectile {
  pos: THREE.Vector3;
  dir: THREE.Vector3;
  speed: number;
  faction: 'red' | 'blue';
  damage: number;
  lifetime: number;
  mesh: THREE.Mesh;
}

const projectiles: Projectile[] = [];
```

- [ ] **Step 3: AIState 加 combat 字段**

```ts
export interface AIState {
  stickman: StickmanState;
  barracks: BarracksState | null;
  fear: number;
  fearTimer: number;
  targetPos: THREE.Vector3;
  dangerPos: THREE.Vector3;
  idleTimer: number;
  pathWaypoints: THREE.Vector3[];
  pathRecalcTimer: number;
  lastFearPropagationTime: number;
  moveDir: THREE.Vector3;
  moveSpeed: number;
  combatTarget: AIState | null;
  combatScanTimer: number;
  attackCooldown: number;
}
```

- [ ] **Step 4: 弹丸管理函数**

```ts
export function updateProjectiles(dt: number, aiStates: AIState[], scene: THREE.Scene): void {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.pos.x += p.dir.x * p.speed * dt;
    p.pos.y += p.dir.y * p.speed * dt;
    p.pos.z += p.dir.z * p.speed * dt;
    p.mesh.position.copy(p.pos);
    p.lifetime -= dt;

    let hit = false;
    for (const target of aiStates) {
      if (!target.stickman.alive) continue;
      if (target.stickman.faction === p.faction) continue;
      const tp = target.stickman.body.position;
      const dx = p.pos.x - tp.x;
      const dy = p.pos.y - (tp.y + 0.5);
      const dz = p.pos.z - tp.z;
      if (dx * dx + dy * dy + dz * dz < 0.25) {
        hit = true;
        target.stickman.hp = Math.max(0, target.stickman.hp - p.damage);
        if (target.stickman.hp <= 0) target.stickman.alive = false;
        break;
      }
    }

    if (hit || p.lifetime <= 0) {
      scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      (p.mesh.material as THREE.Material).dispose();
      projectiles.splice(i, 1);
    }
  }
}

export function spawnProjectile(
  origin: THREE.Vector3, dir: THREE.Vector3,
  faction: 'red' | 'blue', damage: number, scene: THREE.Scene,
): void {
  const geo = new THREE.SphereGeometry(0.08, 4, 4);
  const mat = new THREE.MeshBasicMaterial({ color: faction === 'red' ? 0xff4444 : 0x4488ff });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(origin);
  scene.add(mesh);

  projectiles.push({
    pos: origin.clone(),
    dir: dir.clone().normalize(),
    speed: PROJECTILE_SPEED,
    faction, damage,
    lifetime: PROJECTILE_LIFETIME,
    mesh,
  });
}
```

- [ ] **Step 5: 战斗 AI — updateCombatAI**

```ts
export function updateCombatAI(
  smAI: AIState, dt: number, aiStates: AIState[], scene: THREE.Scene,
): void {
  const sm = smAI.stickman;
  if (!sm.alive || sm.state === 'fleeing') {
    smAI.combatTarget = null;
    return;
  }

  smAI.attackCooldown = Math.max(0, smAI.attackCooldown - dt);
  smAI.combatScanTimer -= dt;

  // Validate current target
  if (smAI.combatTarget) {
    const ts = smAI.combatTarget.stickman;
    if (!ts.alive || ts.faction === sm.faction) {
      smAI.combatTarget = null;
    } else {
      const tp = ts.body.position;
      const dist = Math.hypot(sm.body.position.x - tp.x, sm.body.position.z - tp.z);
      if (dist > COMBAT_LOSE_TARGET_RANGE) smAI.combatTarget = null;
    }
  }

  // Scan for new target
  if (!smAI.combatTarget && smAI.combatScanTimer <= 0) {
    smAI.combatScanTimer = COMBAT_SCAN_INTERVAL;
    const enemies = aiStates.filter(other =>
      other !== smAI && other.stickman.alive &&
      other.stickman.faction !== sm.faction &&
      Math.hypot(sm.body.position.x - other.stickman.body.position.x, sm.body.position.z - other.stickman.body.position.z) <= COMBAT_SCAN_RADIUS,
    );
    if (enemies.length > 0) {
      smAI.combatTarget = enemies[Math.floor(Math.random() * enemies.length)];
    }
  }

  if (!smAI.combatTarget) return;

  const tp = smAI.combatTarget.stickman.body.position;
  const dist = Math.hypot(sm.body.position.x - tp.x, sm.body.position.z - tp.z);

  if (dist < COMBAT_MELEE_RANGE) {
    sm.state = 'combat_melee';
  } else if (dist <= COMBAT_RANGED_RANGE) {
    sm.state = 'combat_ranged';
  } else {
    sm.state = 'walking';
    smAI.targetPos = new THREE.Vector3(tp.x, 0, tp.z);
    smAI.pathWaypoints = [];
  }

  // Execute attack
  if (sm.state === 'combat_melee' && smAI.attackCooldown <= 0) {
    smAI.attackCooldown = COMBAT_MELEE_COOLDOWN;
    smAI.combatTarget.stickman.hp = Math.max(0, smAI.combatTarget.stickman.hp - COMBAT_MELEE_DAMAGE);
    if (smAI.combatTarget.stickman.hp <= 0) smAI.combatTarget.stickman.alive = false;
    sm.attackAnimTimer = 0.15;
  } else if (sm.state === 'combat_ranged' && smAI.attackCooldown <= 0) {
    smAI.attackCooldown = COMBAT_RANGED_COOLDOWN;
    const origin = new THREE.Vector3(sm.body.position.x, sm.body.position.y + 0.5, sm.body.position.z);
    const dir = new THREE.Vector3(tp.x - origin.x, tp.y - origin.y, tp.z - origin.z);
    spawnProjectile(origin, dir, sm.faction, COMBAT_RANGED_DAMAGE, scene);
    sm.attackAnimTimer = 0.15;
  }
}
```

- [ ] **Step 6: createAIState 初始化 combat 字段**

```ts
combatTarget: null,
combatScanTimer: Math.random() * COMBAT_SCAN_INTERVAL,
attackCooldown: 0,
```

- [ ] **Step 7: updateStickmanAI — fleeing 时清空 combatTarget**

在 `sm.state = 'fleeing'` 行之后加:
```ts
smAI.combatTarget = null;
```

- [ ] **Step 8: 类型检查**

```bash
npx tsc --noEmit
```

预期: 失败（`StickmanState` 无 `hp` 对外暴露直接修改权限...... 实际上 `hp` 是 public 的，`alive` 也是，应该 OK。不过 `main.ts` 还需要更新）。

---

### Task 5: 改造 weaponpanel.ts — 红蓝兵营卡片

**Files:**
- Modify: `src/weaponpanel.ts`

- [ ] **Step 1: 替换兵营卡片**

删除:
```ts
{ type: 'barracks', label: '兵营', icon: '🏕️', category: 'construct' },
```

替换为:
```ts
{ type: 'barracks_red', label: '红方兵营', icon: '🟥', category: 'construct' },
{ type: 'barracks_blue', label: '蓝方兵营', icon: '🟦', category: 'construct' },
```

- [ ] **Step 2: 类型检查**

```bash
npx tsc --noEmit
```

预期: `main.ts` 中 `case 'barracks'` 报 unreachable（已删除），需修复。

---

### Task 6: 改造 main.ts — 集成

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: placeItem switch — 替换 barrack 路由**

删除:
```ts
case 'barracks': {
  const b = createBarracks(x, z);
  barracksList.push(b);
  physicsBodies.push({ body: b.body, mesh: b.group, isBuilding: false });
  break;
}
```

替换为:
```ts
case 'barracks_red': {
  const b = createBarracks(x, z, 'red');
  barracksList.push(b);
  physicsBodies.push({ body: b.body, mesh: b.group, isBuilding: false });
  break;
}
case 'barracks_blue': {
  const b = createBarracks(x, z, 'blue');
  barracksList.push(b);
  physicsBodies.push({ body: b.body, mesh: b.group, isBuilding: false });
  break;
}
```

- [ ] **Step 2: 主循环 — 在 updateStickmanAI 后插入 updateCombatAI**

在 `updateStickmanAI(smAI, dt, aiStates);` 之后加:
```ts
updateCombatAI(smAI, dt, aiStates, scene);
```

- [ ] **Step 3: 主循环 — 在 AI 循环结束 + 兵营循环之后加弹丸更新**

在所有 AI+tick+兵营循环之后、清理循环之前加:
```ts
// Update projectiles
updateProjectiles(dt, aiStates, scene);
```

- [ ] **Step 4: healthBar billboard — 所有循环之后**

在所有循环之后加 billboard 更新:
```ts
// Billboard health bars
const cam = getCamera();
for (const sm of stickmen) {
  if (sm.healthBar && sm.alive && sm.deathTimer <= 0) {
    sm.healthBar.bg.lookAt(cam.position);
  }
}
```

- [ ] **Step 5: 类型检查**

```bash
npx tsc --noEmit
```

预期: 零错误。

---

### Task 7: 视觉验证

- [ ] **Step 1: 启动**

```bash
npm run dev
```

- [ ] **Step 2: 验证清单**
  1. 放置红方兵营 → 产红火柴人(身体 0xcc3333)
  2. 放置蓝方兵营 → 产蓝火柴人(身体 0x3366cc)
  3. 双方在 12m 内 → 锁定目标 + 远程射击弹丸
  4. 双方 <2m → 近战拳击 + 手臂动画
  5. 引爆炸弹 → 恐惧逃跑(中断战斗)
  6. 击杀 → 血条归零 → 死亡 ragdoll

---

### Task 8: 提交

```bash
git add src/constants.ts src/stickman.ts src/barracks.ts src/stickman_ai.ts src/weaponpanel.ts src/main.ts
git commit -m "feat: 红蓝双阵营对战系统(远程射击+近战+血条+弹丸)"
```
