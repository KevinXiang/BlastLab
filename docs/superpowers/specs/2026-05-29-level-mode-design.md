# 关卡模式设计文档

## 概述

在现有沙盒模式基础上增加关卡模式。玩家通过线性关卡链推进，每关有明确的武器数量限制和通关目标，完成后获 1-3 星评价。进度持久化到 localStorage。

## 需求摘要

| 需求 | 决策 |
|------|------|
| 目标类型 | destroy_targets + destroy_count + clear_area，可多目标组合 |
| 推进方式 | 线性解锁，失败 5 次后可跳过 |
| 星级评价 | 三维度：目标完成 + 剩余武器 ≥30% + 用时 ≤ par 60% |
| 关卡差异 | 场景布局 + 武器配置 + 后期引入特殊规则（限时、禁用武器） |
| 关卡数量 | 初版 5 关，数据结构可扩展 |
| 进度存储 | localStorage，刷新后保留 |

## 架构

```
src/
├── level.ts        (新增) — 关卡配置、状态机、目标检测、星级计算
├── persistence.ts  (新增) — localStorage 读写封装
├── game.ts         (修改) — 移除 LevelConfig，委托到 level.ts
├── ui.ts           (修改) — 顶部 HUD 目标/计时/星级显示 + 结算弹窗
├── weaponpanel.ts  (修改) — 模式切换生效、关卡列表、重置进度按钮
└── main.ts         (修改) — 接入关卡生命周期
```

### 模块职责

| 模块 | 职责 | 新增/修改 |
|------|------|-----------|
| `level.ts` | LevelConfig 类型定义、5 关数据、LevelState 运行时状态、目标检测 `checkObjectives()`、星级计算 `calcStars()`、当前关卡状态管理 | 新增 |
| `persistence.ts` | `ProgressData` 接口、`loadProgress()`、`saveProgress()`、`resetProgress()` | 新增 |
| `game.ts` | 移除 `LevelConfig`/`LEVELS`/`setMode()`/计时相关，保留爆炸物放置和引爆逻辑 | 修改 |
| `ui.ts` | 顶部 HUD 显示关卡名称/目标/计时/星级、通关结算弹窗 DOM 组件 | 修改 |
| `weaponpanel.ts` | 模式切换按钮真正调用 `setMode()`、关卡列表卡片（锁定/星级/跳过标记）、重置进度按钮 | 修改 |
| `main.ts` | 关卡生命周期：`startLevel()` → 每帧 `checkObjectives()` → 通关 `onComplete()` / 失败 `onFail()` | 修改 |

## 数据结构

### LevelConfig

```typescript
interface LevelConfig {
  id: number;                    // 关卡编号 1-5
  name: string;                  // 显示名称
  parTime: number;               // 目标时间（秒），用于三星评定
  weapons: Record<string, number>; // 可用武器及数量
  objectives: Objective[];       // 目标列表（可多目标）
  restrictions?: Restriction[];  // 可选：特殊规则限制
}

type Objective =
  | { type: 'destroy_targets'; targetIds: number[] }  // 摧毁指定建筑
  | { type: 'destroy_count'; count: number }          // 摧毁 N 个物体
  | { type: 'clear_area'; radius: number; center: { x: number; z: number } };  // 清空区域

type Restriction =
  | { type: 'no_weapon'; weapon: string }    // 禁用某武器
  | { type: 'time_limit'; seconds: number }; // 时间限制
```

### LevelState（运行时）

```typescript
interface LevelState {
  config: LevelConfig;
  elapsedTime: number;           // 已过秒数
  remainingWeapons: Record<string, number>; // 剩余武器数量（递减）
  destroyedObjectIds: Set<number>; // 已摧毁物体 ID 集合
  objectiveStatus: boolean[];    // 每个目标是否完成
}
```

### ProgressData（持久化）

```typescript
interface ProgressData {
  unlockedLevel: number;                    // 已解锁关卡数 (1-5，默认 1)
  records: Record<number, LevelRecord>;     // key = level id
}

interface LevelRecord {
  bestStars: number;       // 最高星级 0-3
  bestTime: number;        // 最快通关时间（秒）
  failCount: number;       // 累计失败次数
  skipped: boolean;        // 是否已跳过
  completed: boolean;      // 是否已通关
}
```

## 关卡列表

| # | 名称 | 武器 | 目标 | parTime | 特殊规则 |
|---|------|------|------|---------|----------|
| 1 | 初入战场 | TNT×3, C4×1 | destroy_targets: 2 栋指定建筑 | 60s | — |
| 2 | 扩大破坏 | TNT×2, 硝甘×3 | destroy_count: 5 个物体 | 60s | — |
| 3 | 区域清理 | C4×2, 遥控×3 | clear_area: 中心区域 r=10m | 90s | — |
| 4 | 争分夺秒 | TNT×4, C4×2 | destroy_targets: 3 栋指定建筑 | 90s | time_limit: 120s |
| 5 | 终极挑战 | C4×3, 核×1 | clear_area r=12m + destroy_targets 2 | 120s | no_weapon: tnt |

## 状态机

```
MENU ──→ PLAYING ──→ COMPLETE ──→ 结算弹窗 ──→ MENU
  ↑        │              │
  │        └──→ FAILED ───┘
  └────────────── 重试/跳过 ──┘
```

### 状态转换

| 转换 | 触发条件 |
|------|---------|
| MENU → PLAYING | 玩家点击解锁的关卡卡片，调用 `startLevel(id)` |
| PLAYING → COMPLETE | 所有 `objectives[]` 同时满足 |
| PLAYING → FAILED | 武器耗尽且目标不可达成，或限时关卡时间到 |
| COMPLETE → MENU | 玩家点击"下一关"/"返回列表" |
| FAILED → PLAYING | 玩家点击"重试"（失败次数+1） |
| FAILED → MENU | 玩家点击"跳过"（需 failCount ≥ 5）或"返回" |

## 三星计算

```typescript
function calcStars(state: LevelState): number {
  let stars = 0;
  if (allObjectivesComplete(state)) stars += 1;
  if (remainingWeaponRatio(state) >= 0.3) stars += 1;
  if (state.elapsedTime <= state.config.parTime * 0.6) stars += 1;
  return stars; // 1, 2, or 3
}
```

## 目标检测

每帧在 main.ts animate() 中调用 `checkObjectives()`：

### destroy_targets
场景初始化时为每栋建筑分配 `buildingId`。爆炸后检测被移除建筑的 ID 是否在 targetIds 中。建筑通过 `fragmentBuilding()` 被移除时标记其 ID 为 destroyed。

### destroy_count
维护一个 `destroyedCount` 计数器，每次 `fragmentBuilding()` 调用时递增。建筑、车辆、树木均计入。

### clear_area
每帧遍历区域内可破坏物体，检查是否还有剩余。区域内物体全部被摧毁即完成。

## 持久化

- **存储键**: `blasting_progress`（localStorage）
- **读取**: main.ts 初始化时 `loadProgress()` 一次，缓存到内存
- **写入**: 通关 COMPLETE / 跳过时 `saveProgress()`，星级只保存最高纪录
- **清除**: 面板底部"重置进度"按钮，调用 `resetProgress()` 删除键并恢复默认

## UI 改动

### weaponpanel.ts
- 模式切换按钮从纯 UI 变为实际调用 `setMode('level')` / `setMode('sandbox')`
- 关卡模式下，面板下半部分显示关卡列表（圆形编号卡片 + 星级 + 锁定图标）
- 已解锁关卡可点击进入，未解锁显示 🔒
- 面板底部增加红色"重置进度"按钮（带二次确认）

### ui.ts
- 更新 `UIState` 增加 `levelName`、`objectiveText`、`elapsedTime`、`bestStars` 字段
- 顶部 HUD 关卡模式下显示：关卡名称 | 目标描述 | 计时器 | 最高星级
- 新增结算弹窗函数 `showResultPopup(stars, time, weapons)` 返回 Promise

### 结算弹窗
- DOM overlay，居中显示
- 星级动画 + 完成数据（用时、剩余武器）
- 三个按钮：下一关（如有关卡）| 重玩 | 返回列表
- 失败弹窗：显示失败原因 + 重试 / 跳过（≥5次时可用）/ 返回

## 实现要点

1. **buildingId 追踪** — 当前建筑没有 ID 系统，需要在 `createBuildings()` / `createSingleBuilding()` 时为每个建筑分配递增 ID，并在 `fragmentBuilding()` 时标记摧毁
2. **关卡场景重置** — `startLevel()` 需要清除所有建筑/车辆/装饰，按关卡配置重新生成场景
3. **遥控炸弹/地雷不计入武器计数** — 它们在关卡模式下可能不可用（除非配置了）
4. **武器消耗时机** — 放置时 `consumeExplosive()`，引爆前检测剩余数量
5. **跳过按钮可见性** — 失败弹窗中"跳过"按钮仅在 `failCount >= 5` 时显示
6. **统一摧毁回调** — 当前只有建筑通过 `fragmentBuilding()` 被追踪。需要为车辆和树木添加统一的摧毁通知机制（回调或事件），以便 `destroy_count` 和 `clear_area` 目标能正确计数
7. **关卡场景差异化** — 每关使用不同的建筑布局（位置、数量、颜色）。布局数据作为 `LevelConfig` 的可选字段，未指定时使用默认随机布局
