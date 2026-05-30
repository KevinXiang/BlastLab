# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # 启动开发服务器 (Vite, 默认 http://localhost:5173)
npm run build        # TypeScript 编译 + Vite 打包输出到 dist/
npx tsc --noEmit    # 仅类型检查，不输出文件
```

## 架构概览

一款基于 Three.js 2.5D 等距视角 + Cannon-es 物理引擎的沙盒破坏模拟器。玩家从左侧武器面板选择道具，点击/拖拽放置到 3D 场景，引爆后观察物理破坏效果。22 种道具分 5 类：爆炸类、喷射类、物理装置、特殊类、建造类。

**核心循环** (`main.ts` — 入口 + 游戏主循环):
```
animate() 每帧:
  相机更新 → 点击放置 → HUD 更新 → 屏幕震动 → 喷射武器 → EMP 闪光
  → 黑洞物理 → 火柴人 AI → 兵营产兵 → 遥控引爆 → 地雷检测
  → 引爆处理(计分+飘字) → 重置 → world.step(1/60) → 粒子更新
  → 物理体同步 → 碎片更新(连锁检测) → 黑洞扭曲 → 渲染
```

## 模块职责

| 文件 | 职责 |
|------|------|
| `main.ts` | 入口，游戏循环，集成所有子系统。包含放置路由(`placeItem`)、喷射力(`applySprayForce`)、屏幕震动、飘字投影 |
| `renderer.ts` | Three.js 渲染器初始化 (正交相机 + 光照 + 地面 + 阴影)，黑洞后处理管线 (RenderTarget → distortion shader → screen)，`renderWithDistortion()` 替代直接 `renderer.render()` |
| `physics.ts` | Cannon-es 世界初始化，`createBuildingBody()`, `applyExplosion()` (爆炸冲击波冲量), `fragmentBuilding()` (建筑碎裂成碎片刚体) |
| `scene.ts` | 场景构建：道路、建筑群、车辆、装饰(树木)、单件放置函数 (建筑/车辆/树/沙袋/路障)。导出 `physicsBodies[]` 全局数组 |
| `game.ts` | 爆炸物管理 (`placeExplosive`/`detonateAll`)、打分系统 (`ScoreState`/`calcDestroyScore`/`calcImpactScore`/连锁分)、遥控炸弹分组引爆、地雷触发、黑洞物理 (`updateBlackHolePhysics` 吸入/抛射 + 核心摧毁) |
| `effects.ts` | 粒子系统 + 各爆炸物特效 + 喷射粒子 + 黑洞三阶段动画 + EMP 闪光。粒子用 `addParticle()` + 动画用 `activeAnimations[]` 回调 |
| `constants.ts` | 所有可调参数：相机、建筑、武器参数、喷雾参数、火柴人/兵营参数 |
| `input.ts` | 键盘+鼠标输入状态 (`InputState`)，含 `spraying` 字段供喷射武器持续施放 |
| `ui.ts` | DOM HUD：顶栏 (武器名/总分/最高分/火柴人数)，飘字 (`showFloatText` CSS 动画) |
| `weaponpanel.ts` | 左侧滑出面板：22 种道具卡片 (5 分类)，拖拽/点击选中，引爆/重置按钮 |
| `stickman.ts` | 火柴人：球头+圆柱体低多边形模型 (`createStickman`)，AI 状态机 (idle/walking/fleeing)，HP+伤害 (`damageStickman`)，`updateStickman` 每帧更新 |
| `barracks.ts` | 兵营：帐篷+旗杆模型，`updateBarracks` 定时产兵(无上限)，`setSpawnRate`/`damageBarracks` |

## 关键数据流

- **放置 → 引爆 → 计分**: `handleClick()` → `placeItem()` → `placeExplosive()`/`createExplosiveMesh()` → 用户点引爆 → `detonateAll()` → `applyExplosion()` + `fragmentBuilding()` → `calcDestroyScore()`/`calcImpactScore()` → `scoreState` → `updateUI()` 刷新 HUD + `showFloatText()` 飘字
- **物理同步**: `world.step(1/60)` 后遍历 `physicsBodies[]` 将 Cannon-es 位置/四元数同步到 Three.js mesh
- **碎片连锁**: debris 飞行中检测与建筑碰撞 → `applyImpulse` + `addChainScore()`
- **火柴人**: 兵营 `updateBarracks()` 产兵 → `stickmen[]` → `updateStickman()` AI → 爆炸冲击波推开 → 速度 >15 触发 `damageStickman()` → HP≤0 清理 + `addStickmanKillScore()`
- **摧毁事件**: 黑洞吸入核心 2.5m 摧毁物体/火柴人，`physicsBodies` 和 `stickmen` 分别管理生命周期

## 重要约定

- 物理体用 `applyForce` (持续力) 而非 `applyImpulse` (瞬时冲量) — 后者与 `world.step(1/60)` 固定步长脱钩，帧率变化时行为不一致
- 不在 `world.bodies` 正向迭代中删除元素 — 用反向 `for` 循环
- Group mesh 不能标记 `isBuilding: true` — `fragmentBuilding()` 会访问 `.geometry` 崩溃
- 喷射武器不经过 `handleClick` 的放置流程 — 在 animate 中通过 `input.spraying` + 锥形检测持续施放

## AI Agent 编码行为约束

**权衡:** 这些准则偏向谨慎而非速度。对于简单任务，可自行判断。

### 1. 思考先行

实施之前:
- 明确陈述你的假设。如果不确定，主动询问。
- 如果存在更简单的方法，说出来。必要时提出反对意见。

### 2. 简洁至上

- 不实现超出需求的功能。
- 不为单次使用的代码创建抽象。
- 不为不可能发生的场景做错误处理。

### 3. 精准修改

- 只动必须动的。不要"改进"相邻的代码、注释或格式。
- 匹配现有风格，即使你更倾向不同的写法。
- 变更导致的孤立 import/变量/函数必须清理。

### 4. 目标驱动执行

将任务转化为可验证的目标，"修复 Bug" → "先复现，再修复，最后验证"。

## Git 提交规范

每实现一个独立功能点做一次 commit，保持粒度细、可独立回滚。

## 沟通规范

默认使用中文沟通，文档默认使用中文，术语和专业名词保持英文原样。
