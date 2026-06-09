# 火柴人全面改造 — 设计规格

**日期:** 2026-06-09
**继任自:** 2026-05-30-stickman-design.md (初版已实现)
**范围:** stickman.ts, barracks.ts, 新增 stickman_ai.ts
**目标:** 程序化行走动画 + 平滑运动过渡 + A* 寻路(道路感知) + 双层士气系统

---

## 1. 模块拆分

当前: `stickman.ts`（模型+创建+伤害+AI更新）、`barracks.ts`（兵营模型+产兵）、`constants.ts`（参数）

改为:
- `stickman.ts` — 模型创建 + 程序化动画 + 伤害处理 + 平滑运动 + 物理同步
- `stickman_ai.ts` — 新文件: A* 寻路 + 道路感知 + 转向行为 (steering) + 状态机 + 个体恐慌 + 群体士气
- `barracks.ts` — 模型创建 + 产兵 + 群体士气状态
- `constants.ts` — 新增动画/AI/士气相关参数

依赖关系:
```
main.ts → stickman_ai.ts → stickman.ts
        → barracks.ts
```

`stickman_ai.ts` 读写 `StickmanState`/`BarracksState`，不直接操作 Three.js/Cannon-es，保持可测试性。

---

## 2. 动画系统 (stickman.ts)

### 2.1 模型改造

`createStickman()` 中为四肢添加 `userData.name` 以便动画查找:

- `leftLeg.userData.name = 'leftLeg'`
- `rightLeg.userData.name = 'rightLeg'`
- `leftArm.userData.name = 'leftArm'`
- `rightArm.userData.name = 'rightArm'`
- `head.userData.name = 'head'`
- `bodyMesh.userData.name = 'body'`

`StickmanState` 新增字段:

```ts
animTime: number        // 动画累计时间 (秒)
animPhase: number       // 随机相位偏移 (0 ~ 2π)，创建时随机
deathTimer: number      // 死亡倒地计时器，damageStickman 设为 0.5
isDeadReadyCleanup: boolean  // deathTimer<=0 时设为 true
```

在 `createStickman()` 末尾预缓存四肢引用到 `Map<string, THREE.Object3D>`，避免每帧 `traverse`:

```ts
const partRefs = new Map<string, THREE.Object3D>()
group.traverse((c) => { if (c.userData.name) partRefs.set(c.userData.name, c) })
```

### 2.2 行走动画 (walk/run)

每帧 `updateStickmanAnimation(sm, dt)` 调用，直接操作 `partRefs`:

腿部摆动 (rotation.x):
```
cycle = sm.animTime * frequency + sm.animPhase
leftLeg.rotation.x  = sin(cycle) * amplitude
rightLeg.rotation.x = sin(cycle + π) * amplitude
```
- 走路: frequency=8, amplitude=0.5
- 逃跑: frequency=12, amplitude=0.7
- 切换时 lerp amplitude 防跳变

手臂摆动 (rotation.x):
与对侧腿同相（左臂跟右腿）:
```
leftArm.rotation.x  = sin(cycle + π) * armAmplitude
rightArm.rotation.x = sin(cycle) * armAmplitude
```
- 走路: armAmplitude=0.4
- 逃跑: armAmplitude=0.6

身体 bob: 在 `bodyMesh` 的基础位置 (`STICKMAN_HEIGHT - 0.5`) 上叠加 y 偏移。需在创建时将基础位置存入 `bodyMesh.userData.baseY`:
```
bodyBob = abs(sin(cycle * 2)) * bobHeight
bodyMesh.position.y = bodyMesh.userData.baseY + bodyBob
```
- 走路: bobHeight=0.03
- 逃跑: bobHeight=0.05

`animTime` 累加: `dt * currentSpeed / STICKMAN_WALK_SPEED * ANIM_WALK_FREQ`
（当前速度越快动画越快）

### 2.3 待机动画

```
idleSway = sin(sm.animTime * 2) * 0.02
leftLeg.rotation.x  = idleSway
rightLeg.rotation.x = -idleSway
leftArm.rotation.x  = idleSway * 0.5
rightArm.rotation.x = -idleSway * 0.5
```

### 2.4 死亡动画

`damageStickman()` 触发死亡时:
1. `sm.alive = false; sm.deathTimer = 0.5`
2. 四肢旋转归零（恢复初始姿态）
3. 物理体 `angularDamping` 设为 0.1（快速倒下）, 不再归零 `angularVelocity`

**死亡阶段更新 (main.ts, 在 `if (!sm.alive) continue` 之前):**
```
if (!sm.alive && sm.deathTimer > 0) {
  sm.deathTimer -= dt
  // 让物理体自由倒下 (ragdoll)
  if (sm.deathTimer <= 0) sm.isDeadReadyCleanup = true
  continue  // 跳过正常 AI/动画更新
}
```

**清理 (main.ts 现有清理循环):**
检查 `isDeadReadyCleanup` 执行 `scene.remove`/`dispose`/`world.removeBody`。

---

## 3. 平滑运动 (stickman.ts)

### 3.1 速度平滑

`updateStickmanMotion(sm, targetSpeed, targetDir, dt)`:

```ts
const targetVx = targetDir.x * targetSpeed
const targetVz = targetDir.z * targetSpeed
const accel = (sm.state === 'fleeing') ? 15 : 8  // 加速度 m/s²
const t = 1 - Math.exp(-accel * dt * 2)           // 指数平滑因子

sm.body.velocity.x += (targetVx - sm.body.velocity.x) * t
sm.body.velocity.z += (targetVz - sm.body.velocity.z) * t
```

停止时: targetSpeed=0，同上公式向 0 衰减。

### 3.2 旋转平滑

```ts
const targetAngle = Math.atan2(targetDir.x, targetDir.z)
let diff = targetAngle - sm.group.rotation.y
diff = ((diff + Math.PI + Math.PI * 2) % (Math.PI * 2)) - Math.PI  // 标准化到 [-π, π]
const maxTurn = STICKMAN_TURN_SPEED * dt
diff = Math.max(-maxTurn, Math.min(maxTurn, diff))
sm.group.rotation.y += diff
```

### 3.3 物理同步增强

保持现有 `group.position.copy(body.position)` + `quaternion.copy`。额外:
- 每帧 `body.velocity.x *= 0.95; body.velocity.z *= 0.95` 防止侧滑
- `body.angularVelocity.set(0, 0, 0)` 防止旋转动能累积
- group 同步时 `group.position.y -= STICKMAN_HEIGHT / 2`（和现在一样）

---

## 4. AI 系统 (stickman_ai.ts)

### 4.1 A* 寻路

网格:
- 世界 60×60，网格分辨率 2m → 30×30=900 节点
- 8 方向移动 (允许对角线，cost ×1.4)
- `OccupancyGrid` 单例，`rebuildGrid()` 每 5 秒调用一次

OccupancyGrid 通过遍历 `physicsBodies[]` 全局数组识别障碍:
- 检查对应 Three.js mesh 的 `isBuilding` 标志 → 标记为不可通行 (wall)
- 检查 `isVehicle` → 车辆占据的格子和建筑一样处理
- 道路格子 (十字区域) → g-cost ×0.7

瓦片代价:
- 道路格子: g-cost ×0.7（偏好走道路）
- 建筑内部: 不可通行（标记为 wall）
- 爆炸点/黑洞 3 格半径: 临时不可通行（动态障碍），由 `moraleEvents` 队列提供

寻路策略:
- 每个火柴人独立 path，每 3 秒重算
- 最大搜索步数 200（足够覆盖 900 节点）
- 路径简化: A* 输出 → 仅保留转弯点（方向变化处）
- 缓存最近路径，避免无意义重算（目标未变 + 路径未失效）

### 4.2 道路感知

道路定义为 `|x| < ROAD_WIDTH/2` 或 `|z| < ROAD_WIDTH/2`。

效果:
- A* 代价折扣（见上）
- 道路附近 2m 内的格子半折扣 (×0.85)
- `updateStickmanAI` 在设置 `aiState.moveSpeed` 时检查火柴人是否在道路上 (`|pos.x|<1.5` 或 `|pos.z|<1.5`) → 在道路上则 `moveSpeed *= STICKMAN_ROAD_SPEED_BONUS` (1.2)

### 4.3 转向行为 (Steering)

每帧计算三层力，加权混合后输出 `moveDir`:

1. Seek (权重 1.0): 指向 A* 下一个 waypoint
2. Separation (权重 0.3): 3m 内所有其他火柴人 → 推开方向
3. Cohesion (权重 0.2): 朝向同兵营友军中心（仅当距离 >5m）

三层力归一化后加权求和，再归一化得到最终移动方向。到达 waypoint (距离 < 0.5m) 时切换到下一个。

### 4.4 状态机

```
            ┌─────────────────────────────────────────┐
            │                                         │
     ┌──────┴──────┐    fear>70     ┌──────────┐    │
     │    idle     │ ───────────────→│ fleeing  │    │
     │ (待机动画)  │                 │ (逃跑)   │    │
     └──────┬──────┘                 └────┬─────┘    │
            │ idleTimer<=0       fear<20               │
            │ + 选兴趣点         + timer到期           │
            ↓                           │              │
     ┌─────────────┐                    │              │
     │   walking   │ ←──────────────────┘              │
     │ (A*路径移动)│                                   │
     └──────┬──────┘                                   │
            │ 到达目标                                 │
            └──────────────────────────────────────────┘
```

兴趣点选择:
```
30%: 道路上的随机点
30%: 同兵营其他火柴人的中心 ± 随机偏移 (3~8m)
20%: 随机建筑附近 (3m)
20%: 纯粹随机点 (安全区域内)
```

到达目标后 idle 1~4 秒，再选新目标。

### 4.5 性能预算

- A* 重算: 每个火柴人 3 秒一次 → 20 人时每帧 ~0.3 次
- OccupancyGrid 重建: 5 秒一次 → 遍历 physicsBodies 开销可忽略
- 邻近查询: 每帧 O(n²) 暴力，n≤40 时可接受

---

## 5. 士气系统

### 5.1 个体恐慌 (AIState.fear: 0~100)

增长:
| 事件 | fear 增加值 | 条件 |
|------|------------|------|
| 爆炸在恐惧半径内 | +60 | 距离 < 12m |
| 看到同伴死亡 | +20 | 距离 < 10m |
| 看到同伴逃跑 | +10 | 距离 < 5m, 传播冷却 3s |

衰减:
| 条件 | 衰减速度 |
|------|---------|
| 基础衰减 | -5/s |
| 靠近友方兵营 (8m) | -10/s |
| 附近 3+ 友军 (5m) | -5/s |

阈值:
- fear > 70 → 强制进入 fleeing
- fear < 20 + fearTimer 归零 → 可退出 fleeing

### 5.2 传播机制

`propagateFear()` 在 `preUpdateAI` 中调用:
1. 遍历所有 alive 火柴人
2. 对每个 fear > 50 的火柴人，5m 内其他 idle/walking 火柴人 fear +15
3. 对每个传播行为记录时间戳 (`lastFearPropagationTime`)，3 秒内不再传播

### 5.3 群体士气 (BarracksState.morale: 0~100)

初始值 50。

| 事件 | morale 变化 | 冷却 |
|------|------------|------|
| 本兵营单位死亡 | -10 | 无 |
| 兵营受伤 | -30 | 30s 冷却 |
| 爆炸靠近兵营 (15m) | -20 | 30s 冷却 |
| 击杀敌人/摧毁建筑 | +15 | 无 (上限 100) |

士气影响:
| 士气范围 | 效果 |
|---------|------|
| < 30 | 产兵速率 ×0.5, 新兵初始 fear +20 |
| 30~70 | 无修正 |
| > 70 | 产兵速率 ×1.5, 全体移速 +15% |

### 5.4 事件通知

新增 `notifyMoraleEvent(event)` 导出函数:

```ts
type MoraleEvent =
  | { type: 'explosion'; pos: THREE.Vector3; radius: number }
  | { type: 'stickman_death'; pos: THREE.Vector3; stickman: StickmanState }
  | { type: 'enemy_kill'; pos: THREE.Vector3 }
  | { type: 'barracks_damage'; barracks: BarracksState }
```

在 main.ts 引爆/击杀/伤害流程中调用，`stickman_ai.ts` 处理事件分发。

---

## 6. 接口变更

### StickmanState (stickman.ts) — 修改

```ts
export interface StickmanState {
  // 不变
  group: THREE.Group
  body: CANNON.Body
  hp: number; maxHp: number
  state: 'idle' | 'walking' | 'fleeing'
  alive: boolean
  // 移除: fearTimer, walkTarget, idleTimer
  // 新增:
  partRefs: Map<string, THREE.Object3D>  // 四肢引用
  animTime: number
  animPhase: number
  deathTimer: number           // 死亡倒地倒计时
  isDeadReadyCleanup: boolean  // deathTimer<=0 时设为 true
}
```

### AIState (stickman_ai.ts) — 新增

```ts
export interface AIState {
  stickman: StickmanState
  barracks: BarracksState | null
  fear: number
  fearTimer: number
  targetPos: THREE.Vector3
  idleTimer: number
  pathWaypoints: THREE.Vector3[]
  pathRecalcTimer: number
  lastFearPropagationTime: number
  // 每帧 AI 输出的运动目标
  moveDir: THREE.Vector3
  moveSpeed: number
}
```

### BarracksState (barracks.ts) — 修改

新增字段:
```ts
morale: number           // 初始 50
lastMoraleEventTime: number  // 冷却用时间戳
```

---

## 7. constants.ts 变更

移除旧常量: `STICKMAN_FEAR_RADIUS`, `STICKMAN_FEAR_DURATION`（被新系统取代）

新增分块:

```ts
// 火柴人动画
export const ANIM_WALK_FREQ = 8
export const ANIM_RUN_FREQ = 12
export const ANIM_WALK_AMP = 0.5
export const ANIM_RUN_AMP = 0.7
export const ANIM_ARM_AMP = 0.4
export const ANIM_ARM_RUN_AMP = 0.6
export const ANIM_BOB_HEIGHT = 0.03
export const ANIM_BOB_RUN_HEIGHT = 0.05

// 火柴人运动
export const STICKMAN_ACCEL = 8
export const STICKMAN_RUN_ACCEL = 15
export const STICKMAN_TURN_SPEED = 8
export const STICKMAN_ROAD_SPEED_BONUS = 1.2

// 火柴人 AI
export const AI_PATH_RECALC_INTERVAL = 3
export const AI_GRID_RESOLUTION = 2
export const AI_MAX_SEARCH_STEPS = 200
export const AI_SEPARATION_RADIUS = 3
export const AI_SEPARATION_WEIGHT = 0.3
export const AI_COHESION_RADIUS = 5
export const AI_COHESION_WEIGHT = 0.2

// 士气
export const FEAR_EXPLOSION = 60
export const FEAR_WITNESS_DEATH = 20
export const FEAR_WITNESS_FLEE = 10
export const FEAR_DECAY_RATE = 5
export const FEAR_NEAR_BARRACKS_DECAY = 10
export const FEAR_NEAR_ALLIES_DECAY = 5
export const FEAR_FLEE_THRESHOLD = 70
export const FEAR_RECOVER_THRESHOLD = 20
export const FEAR_PROPAGATION_RADIUS = 5
export const FEAR_PROPAGATION_COOLDOWN = 3
export const MORALE_INITIAL = 50
export const MORALE_DEATH_PENALTY = 10
export const MORALE_BARRACKS_DAMAGE = 30
export const MORALE_EXPLOSION_NEAR = 20
export const MORALE_KILL_BONUS = 15
export const MORALE_LOW_THRESHOLD = 30
export const MORALE_HIGH_THRESHOLD = 70
export const MORALE_COOLDOWN = 30
```

---

## 8. main.ts 集成变更

animate() 中当前 stickman/barracks block 改为:

```
// 0. 死亡阶段更新（在跳过 alive 检查之前）
for (const sm of stickmen) updateStickmanDeath(sm, dt)
// 1. AI 预处理 — 士气事件分发、恐慌传播、A* 路网重建
preUpdateAI(dt, aiStates, barracksList, moraleEvents)
// 2. 逐火柴人 AI 更新 + 运动 + 动画（一个循环完成）
for (const smAI of aiStates) {
  updateStickmanAI(smAI, dt, aiStates, occupancyGrid)
  updateStickmanMotion(smAI.stickman, smAI.moveDir, smAI.moveSpeed, dt)
  updateStickmanAnimation(smAI.stickman, dt)
}
// 3. 兵营产兵（士气影响 spawnRate）
for (const b of barracksList) updateBarracks(b, dt, stickmen)
// 4. 清理死火柴人（检查 isDeadReadyCleanup）
cleanDeadStickmen()
```

`aiStates[]` 与 `stickmen[]` 并行维护。新建时同时 push 到两个数组，清理时同时 splice。
`moraleEvents` 队列由引爆/击杀路径在 animate() 中推入，在 preUpdateAI 开始处理并清空。

---

## 9. 测试策略

- `stickman_ai.ts` 中 A* 寻路可独立测试（无 Three.js/Cannon 依赖）
- OccupancyGrid 重建用单元测试验证道路格子代价
- 恐慌传播逻辑用纯数据测试
- 动画系统通过视觉观察验证（难以自动测试）
- 最终: `npx tsc --noEmit` 类型检查通过

---

## 10. 实施顺序

1. 更新 `constants.ts` — 新增动画/AI/士气常量
2. 写 `stickman_ai.ts` — AIState/MoraleEvent/OccupancyGrid/A*/steering/士气（纯逻辑，无副作用）
3. 改造 `stickman.ts` — 加 partRefs + 动画函数 + 平滑运动，移除 AI 逻辑，删除 fearTimer/walkTarget/idleTimer
4. 改造 `barracks.ts` — 加 morale 字段
5. 更新 `main.ts` — 集成新调用流程
6. 视觉验证 + 调参
