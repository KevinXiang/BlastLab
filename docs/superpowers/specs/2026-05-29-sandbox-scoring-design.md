# 纯沙盒模式 + 打分系统 + 道具扩展 设计文档

— 彻底删除关卡系统，恢复纯沙盒模式，新增打分系统和新道具 —

## 概述

移除关卡模式，专注于沙盒体验。引入多维度打分系统，新增 6 种道具（爆炸类 1、物理装置 1、特殊类 1、喷射类 3），升级视觉特效和物理连锁反应。

## 需求摘要

| 需求 | 决策 |
|------|------|
| 关卡模式 | 彻底删除 persistence.ts / level.ts / destruction.ts 及相关 UI |
| 打分维度 | 摧毁分 + 波及分 + 连锁分，三次引爆独立计算 |
| 分数展示 | HUD 实时累计 + 爆炸位置飘字淡出 |
| 最高分 | localStorage 持久化 |
| 新爆炸物 | 集束炸弹（空爆+8子弹散布） |
| 新物理装置 | 黑洞装置（吸入→抛射） |
| 新特殊类 | 电磁脉冲（闪电球+屏幕闪烁） |
| 新喷射类 | 火焰喷射器 / 冰冻喷射 / 粒子喷射 |
| 特效升级 | 屏幕震动 + 爆炸粒子翻倍+拖尾 |
| 物理连锁 | 碎片保留刚体 + 二次撞击摧毁 + 额外计分 |

## 架构

### 文件变更

```
删除:
  src/persistence.ts   — 关卡存档不再需要
  src/level.ts         — 关卡系统移除
  src/destruction.ts   — 摧毁事件通道不再需要

改造:
  src/game.ts          — 移除 LevelConfig/LEVELS/setMode 残余，增加打分逻辑
  src/ui.ts            — 重写为沙盒 HUD（得分+最高分+飘字）
  src/weaponpanel.ts   — 移除关卡列表/重置进度，增加新道具卡片
  src/main.ts          — 还原纯沙盒循环 + 打分调用 + 连锁检测 + 屏幕震动
  src/scene.ts         — 移除 clearScene/buildFromLayout/ID 追踪/targetMarkers
  src/physics.ts       — PhysicsBody 移除 objectId，碎片延长生命周期 + 碰撞检测
  src/effects.ts       — 粒子数量翻倍 + 拖尾 + 集束/EMP/黑洞特效
  src/constants.ts     — 新武器参数 + 喷射类参数
  src/input.ts         — 新增按住喷射的输入状态
```

## 打分系统

### 评分公式

```
单次引爆得分 = 摧毁分 + 波及分 + 连锁分

摧毁分 = sum(
  建筑 → 100 × height (高度越高分越多)
  车辆 → 200
  树木 → 50
  沙袋 → 30
  路障 → 30
)

波及分 = count(bodies_in_radius_but_not_destroyed) × 10

连锁分 = 碎片撞击其他物体 每次 +50
```

### 反馈机制

| 形式 | 描述 |
|------|------|
| HUD 累加 | 右上角显示"总分: XXXX | 🏆 最高: XXXX"，引爆后数字飞涨动画 |
| 飘字 | DOM div 在爆炸 3D 位置映射到屏幕坐标，显示"+XXX"，CSS animation 1.5s 上浮+透明淡出 |
| 飘字明细 | 主数字下方显示小字："💥摧毁 ×3" "🌊波及 ×5" "🔗连锁 ×1" |

### 最高分

- 存储键：`blasting_highscore`（localStorage）
- 读取：游戏初始化时加载，无记录默认为 0
- 写入：累计总分 > 当前最高分时更新
- 重置场景时不清除最高分

## 道具清单

### 新增：爆炸类

| 道具 | 半径 | 威力 | 特殊行为 |
|------|------|------|---------|
| 集束炸弹 | 10m | 150×8 子弹 | 放置 1s 后空爆，在上方 5m 处散布 8 颗子弹，各自独立引爆 |

### 新增：物理装置

| 道具 | 半径 | 效果 |
|------|------|------|
| 黑洞装置 | 8m | 2s 强力吸入（所有物体向中心汇聚）→ 0.5s 蓄力闪光 → 向外剧烈抛射 |

### 新增：特殊类

| 道具 | 半径 | 威力 | 效果 |
|------|------|------|------|
| 电磁脉冲 | 6m | 400 | 蓝白闪电球型扩散，屏幕短暂黑白闪烁 0.3s |

### 新增：喷射类

喷射类按住鼠标持续施放，有能量限制（用完即止）。

| 道具 | 射程 | 能量 | 效果 |
|------|------|------|------|
| 火焰喷射器 | 7m | 5s | 锥形火焰粒子灼烧，树木 2s 后点燃摧毁，物体持续受力 |
| 冰冻喷射 | 8m | 4s | 锥形冰晶减速物体至 10% 速度，表面蓝白霜冻 |
| 粒子喷射 | 10m | 3s | 紫色高能粒子束强力推飞物体 |

### 武器库最终布局（22 种，5 分类）

```
💣 爆炸类 (7): TNT桶 · C4 · 硝酸甘油 · 原子弹 · 遥控炸弹 · 地雷 · 集束炸弹
🔥 喷射类 (3): 火焰喷射器 · 冰冻喷射 · 粒子喷射
🌀 物理装置 (3): 黑洞装置 · 磁铁(后续) · 弹力板(后续)
🎆 特殊类 (4): 燃烧弹 · 烟雾弹 · 闪光弹 · 电磁脉冲
🏗️ 建造类 (5): 建筑 · 车辆 · 树木 · 沙袋 · 路障
```

## 特效与物理

### P0 — 本轮实施

| 效果 | 描述 |
|------|------|
| 屏幕震动 | 大爆炸（原子弹/集束）触发，振幅 3-8px，持续 0.3-0.8s，随距离衰减 |
| 粒子翻倍 | 爆炸粒子 ~100+，碎片带颜色渐变拖尾轨迹 |
| 碎片物理 | 碎片延长刚体生命周期（落地后才回收），飞行中撞击其他物体时检测碰撞力，超过阈值触发二次碎裂 |
| 连锁计分 | 碎片撞击触发 `notifyChainHit()` → +50 连锁分 + 飘字显示 |

### P1 — 后续迭代

- 爆炸瞬间点光源闪烁
- 车辆自燃 + 二次爆炸
- 建筑多米诺倒塌动画

## 文件细节

### physics.ts — 碎片碰撞检测

在 `animate` 循环的 debris 更新中增加碰撞检测：
- 碎片刚体速度 > 阈值时，遍历 physicsBodies 检测距离
- 距离 < 碰撞半径 → 对目标施加冲击力，累加连锁分

### input.ts — 喷射输入

新增 `input.spraying: boolean`，鼠标左键按住时 true，松开 false。
main.ts 中检测 `input.spraying && selectedType 是喷射类` 时持续施放粒子。

### effects.ts — 新增特效函数

| 函数 | 用途 |
|------|------|
| `spawnClusterEffect(position)` | 集束炸弹空爆 + 8 颗子弹轨迹 |
| `spawnBlackHoleEffect(position)` | 黑洞吸入粒子 → 闪光 → 抛射 |
| `spawnEMPEffect(position)` | 蓝白闪电球 + 屏幕闪过 |
| `sprayFlameEffect(origin, direction, dt)` | 锥形火焰粒子流 |
| `sprayIceEffect(origin, direction, dt)` | 锥形冰晶粒子流 |
| `sprayParticleEffect(origin, direction, dt)` | 紫色粒子束 |
| `addScreenShake(intensity, duration)` | 屏幕震动 |

## 实现要点

1. **彻底清理** — 删除 persistence.ts/level.ts/destruction.ts，确保 git rm
2. **scene.ts 回退** — 移除 Building.id、nextId、resetIdCounter、clearScene、buildFromLayout、targetMarkers，恢复原本的 createBuildings/createScene
3. **physics.ts 回退** — PhysicsBody 移除 objectId，移除 destruction 导入和 notifyDestroy 调用
4. **weaponpanel 改造** — 移除关卡列表 DOM/重置进度按钮/模式切换逻辑/level 导入，增加新分类和道具卡片
5. **喷射类特殊处理** — 不通过 placeItem + handleClick 触发，而是在 animate 中检测 input.spraying 持续调用喷射函数
6. **飘字坐标映射** — 用 Three.js Vector3.project() 将爆炸世界坐标映射到屏幕 CSS 坐标
