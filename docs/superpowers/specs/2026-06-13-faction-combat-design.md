# 阵营对战系统 — 设计规格

**日期:** 2026-06-13
**范围:** stickman.ts, stickman_ai.ts, barracks.ts, weaponpanel.ts, main.ts, constants.ts
**目标:** 红蓝双阵营兵营 + 火柴人对战(远程射击+近战) + 头顶血条

---

## 1. 阵营系统

### 1.1 数据结构

```ts
// StickmanState 新增
faction: 'red' | 'blue';

// BarracksState 新增
faction: 'red' | 'blue';

// AIState 新增
combatTarget: AIState | null;
```

### 1.2 视觉区分

**红方 (faction: 'red')：**
- 火柴人身体颜色: `0xcc3333`
- 兵营帐篷颜色: `0x883333`
- 兵营旗杆颜色: `0xff4444`

**蓝方 (faction: 'blue')：**
- 火柴人身体颜色: `0x3366cc`
- 兵营帐篷颜色: `0x334488`
- 兵营旗杆颜色: `0x4488ff`

### 1.3 头顶血条

每个火柴人头顶加极简平面血条，始终面向相机(billboard)，只显示敌对阵营的。

```
血条: 0.6w × 0.06h
背景: #333  |  血量填充: 绿色 → 黄色 → 红色 (hp比例插值)
位置: head 上方 0.25m
```

`StickmanState.healthBar` — 两个 PlaneGeometry mesh(背景+填充)，MeshBasicMaterial。每帧 `lookAt(camera)`，更新填充 scale.x 和颜色。

### 1.4 武器面板

建造类替换现有「兵营」为：

| 卡片 | ID |
|------|-----|
| 红方兵营 | `barracks_red` |
| 蓝方兵营 | `barracks_blue` |

---

## 2. 战斗系统

### 2.1 状态机 (优先级从高到低)

```
fleeing (fear > 70)              优先跑
    ↓
combat_melee (目标存在, 距离 < 2m)  近战拳击
    ↓
combat_ranged (目标存在, 2~12m)    远程投掷
    ↓
walking / idle                    正常漫游
```

### 2.2 目标选择

每 1 秒扫描 12m 内敌对阵营 alive → 随机选一个 `combatTarget` → 锁定追击直到目标死亡或 >15m → 清空重扫。

### 2.3 攻击参数

| 类型 | 射程 | 冷却 | 伤害 | 表现 |
|------|------|------|------|------|
| 远程 | 2~8m | 1.5s | 15 | 小球体 15m/s 直线飞 2s |
| 近战 | 0~2m | 0.8s | 10 | 手臂快速前伸收回 |

弹丸碰撞: 每帧检测 vs 敌对火柴人距离 < 0.5m → `damageStickman` + 移除弹丸。

### 2.4 弹丸系统

`stickman_ai.ts` 中的 `projectiles[]`:

```ts
interface Projectile {
  pos: THREE.Vector3; dir: THREE.Vector3;
  speed: number;       // 15
  faction: 'red' | 'blue';
  damage: number;      // 15
  lifetime: number;    // 2s
  mesh: THREE.Mesh;    // SphereGeometry(0.08)
}
```

`updateProjectiles(dt)`: pos移动 → 碰撞检测 → lifetime/自毁 → scene.remove + dispose。

### 2.5 战斗动画

出手后 0.15s 内右手臂 rotation.x 快速前伸(-0.6 远程 / -0.8 近战)，其他时间正常。

---

## 3. 士气联动

- 击杀敌人 → 己方兵营 morale+15 (已有)
- 同伴死亡(10m) → fear+20 (已有)
- 己方兵营受伤 → 该兵营火柴人 fear+40

---

## 4. 常量新增

```ts
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

---

## 5. 文件变更汇总

| 文件 | 改动 |
|------|------|
| `constants.ts` | +12 战斗常量 |
| `stickman.ts` | faction + healthBar + 战斗动画出手 + 血条更新 |
| `stickman_ai.ts` | Projectile系统 + combatTarget + 战斗状态机 + 目标扫描 |
| `barracks.ts` | faction + 颜色分化 |
| `weaponpanel.ts` | 红/蓝兵营两张卡片 |
| `main.ts` | 弹丸更新 + faction传递 + barracks路由 |

---

## 6. 实施顺序

1. `constants.ts`
2. `stickman.ts` (faction + healthBar)
3. `barracks.ts` (faction)
4. `stickman_ai.ts` (弹丸 + 战斗AI)
5. `weaponpanel.ts`
6. `main.ts` (集成)
7. `tsc --noEmit` + 视觉验证
