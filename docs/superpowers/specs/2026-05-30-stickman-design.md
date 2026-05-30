# 火柴人 AI 小兵系统设计

## 概述

武器库建造类新增"兵营"建筑，放置后持续产出低多边形火柴人小兵。火柴人具有 AI 行为（自由走动+危险逃跑）、HP 血量系统、被击杀 +100 分。兵营可被武器摧毁。

## 需求

| 维度 | 决策 |
|------|------|
| 生成方式 | 兵营建筑拖放到场景，持续产出 |
| 生产速率 | 面板可调，默认 2s/个 |
| 行为 | 平时随机走动，爆炸/武器靠近时加速逃跑 |
| 血量 | HP 制，面板可调默认值 |
| 造型 | 球头+圆柱体+细圆柱四肢 |
| 击杀分 | +100/个 |
| 兵营 | 可被武器摧毁 |

## 架构

```
src/
├── stickman.ts      (新增) — 火柴人 3D 模型、AI 行为、HP、移动
├── barracks.ts      (新增) — 兵营 3D 模型、定时产兵、速率控制
├── constants.ts     (修改) — 火柴人参数常量
├── weaponpanel.ts   (修改) — 建造类新增兵营卡片
├── game.ts          (修改) — 击杀计分
└── main.ts          (修改) — animate 中更新火柴人 AI + 兵营计时
```

## 火柴人数据

| 参数 | 默认值 | 说明 |
|------|--------|------|
| HP | 100 | 面板可调 |
| 行走速度 | 2 m/s | 正常走动 |
| 逃跑速度 | 5 m/s | 危险时加速 |
| 恐惧半径 | 8m | 爆炸源在此范围内触发逃跑 |
| 模型高度 | 1.8m | 真人比例缩小 |
| 击杀分 | 100 | 固定 |

## 兵营数据

| 参数 | 默认值 | 说明 |
|------|--------|------|
| 生产速率 | 2s | 面板可调 |
| 最大兵力 | 20 | 场上同时存在的上限 |
| 占地面积 | 1×1×1.5m | 低多边形盒子+帐篷造型 |
| HP | 300 | 被摧毁后停止产兵 |

## 火柴人 AI

```
每帧 update:
  1. 扫描周围爆炸源/武器 → 距离 < 恐惧半径 → 逃跑模式
  2. 逃跑模式：向远离危险方向以 5m/s 移动，持续 3s
  3. 无危险：随机选目标点，以 2m/s 走向该点
  4. 到达目标点后随机等待 1-3s，再选新目标
  5. 检测受到的物理冲量 → 换算伤害 → 扣 HP
  6. HP ≤ 0 → 碎裂特效 + 移除 + +100 分
```

## 火柴人物理

- 每个火柴人是 `CANNON.Body` + `THREE.Group`
- 受爆炸冲击波影响（与现有建筑/车辆一样）
- 被冲击波推动时触发伤害计算
- 从高处坠落也会受伤

## 文件细节

### stickman.ts
- `createStickman(x, z, hp)` — 返回 `{ group, body, hp, state }`
- `updateStickman(sm, dt, dangerSources)` — AI 逻辑
- `damageStickman(sm, amount)` — 扣血
- `destroyStickman(sm)` — 碎裂特效+清理

### barracks.ts
- `createBarracks(x, z)` — 返回 `{ group, body, hp, spawnRate }`
- `updateBarracks(b, dt)` — 计时产兵
- `setSpawnRate(b, seconds)` — 调整速率
- `damageBarracks(b, amount)` — 扣血

### constants.ts 新增
```typescript
export const STICKMAN_HP = 100;
export const STICKMAN_WALK_SPEED = 2;
export const STICKMAN_RUN_SPEED = 5;
export const STICKMAN_FEAR_RADIUS = 8;
export const STICKMAN_SCORE = 100;
export const BARRACKS_HP = 300;
export const BARRACKS_SPAWN_RATE = 2;
export const BARRACKS_MAX_UNITS = 20;
export const STICKMAN_HEIGHT = 1.8;
```
