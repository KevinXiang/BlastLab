# 武器库系统实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有 4 种爆炸物扩展为 16 种沙盒武器库（爆炸+特殊+建造），通过左侧可收起面板选择。

**Architecture:** 新建 `weaponpanel.ts` 管理侧边面板 DOM 和选中状态。`constants.ts` 统一管理所有武器参数。`game.ts` 处理遥控炸弹分组引爆和地雷触发。`effects.ts` 新增燃烧/烟雾/闪光特效。`main.ts` 集成面板并在地雷检测循环中执行业务逻辑。

**Tech Stack:** TypeScript, Three.js, Cannon-es, HTML/CSS

---

### Task 1: 新增武器参数常量

**Files:**
- Modify: `src/constants.ts`

- [ ] **Step 1: 新增 WEAPON_DEFS 和 CONSTRUCT_DEFS**

在 `src/constants.ts` 末尾追加：

```typescript
// ============================================================
// 武器库 — 新增爆炸类
// ============================================================
export const REMOTE_RADIUS = 6;
export const REMOTE_FORCE = 1000;
export const REMOTE_COLOR = 0x228833;

export const MINE_RADIUS = 4;
export const MINE_FORCE = 600;
export const MINE_COLOR = 0x444444;

// 特殊类
export const INCENDIARY_RADIUS = 5;
export const INCENDIARY_FORCE = 300;
export const INCENDIARY_COLOR = 0xff6600;

export const SMOKE_RADIUS = 6;
export const SMOKE_COLOR = 0x888888;

export const FLASH_RADIUS = 4;
export const FLASH_COLOR = 0xffffff;

// 建造类
export const SANDBAG_COLOR = 0xc2b280;
export const BARRICADE_COLOR = 0xff6600;
```

- [ ] **Step 2: 编译检查**

```bash
npx tsc --noEmit
```

Expected: PASS

- [ ] **Step 3: 提交**

```bash
git add src/constants.ts && git commit -m "feat: 新增武器库常量参数（遥控炸弹/地雷/燃烧/烟雾/闪光/沙袋/路障）"
```

---

### Task 2: 新建武器库侧边面板

**Files:**
- Create: `src/weaponpanel.ts`

- [ ] **Step 1: 创建 weaponpanel.ts**

```typescript
import * as CANNON from 'cannon-es';

export interface WeaponDef {
  type: string;
  label: string;
  icon: string;
  category: 'explosive' | 'special' | 'construct';
}

const WEAPONS: WeaponDef[] = [
  // 爆炸类
  { type: 'tnt', label: 'TNT桶', icon: '🧨', category: 'explosive' },
  { type: 'c4', label: 'C4炸药', icon: '💣', category: 'explosive' },
  { type: 'nitroglycerin', label: '硝酸甘油', icon: '🧪', category: 'explosive' },
  { type: 'nuke', label: '原子弹', icon: '☢️', category: 'explosive' },
  { type: 'remote_bomb', label: '遥控炸弹', icon: '📡', category: 'explosive' },
  { type: 'mine', label: '地雷', icon: '💥', category: 'explosive' },
  // 特殊类
  { type: 'incendiary', label: '燃烧弹', icon: '🔥', category: 'special' },
  { type: 'smoke', label: '烟雾弹', icon: '💨', category: 'special' },
  { type: 'flash', label: '闪光弹', icon: '⚡', category: 'special' },
  // 建造类
  { type: 'building', label: '建筑', icon: '🏠', category: 'construct' },
  { type: 'vehicle', label: '车辆', icon: '🚗', category: 'construct' },
  { type: 'tree', label: '树木', icon: '🌳', category: 'construct' },
  { type: 'sandbag', label: '沙袋', icon: '🛡️', category: 'construct' },
  { type: 'barricade', label: '路障', icon: '🚧', category: 'construct' },
];

export interface WeaponPanelState {
  selectedType: string | null;
  visible: boolean;
}

export function createWeaponPanel(container: HTMLElement): WeaponPanelState {
  const state: WeaponPanelState = { selectedType: null, visible: false };

  // Collapsed tab
  const tab = document.createElement('div');
  tab.id = 'weapon-tab';
  tab.style.cssText = `
    position: absolute; left: 0; top: 50%; transform: translateY(-50%);
    width: 24px; height: 60px; background: rgba(0,0,0,0.7); color: #fff;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; border-radius: 0 6px 6px 0; font-size: 12px;
    writing-mode: vertical-rl; z-index: 20; user-select: none;
  `;
  tab.textContent = '武';
  container.appendChild(tab);

  // Panel
  const panel = document.createElement('div');
  panel.id = 'weapon-panel';
  panel.style.cssText = `
    position: absolute; left: -300px; top: 40px; bottom: 10px;
    width: 280px; background: rgba(0,0,0,0.75); color: #fff;
    transition: left 0.2s ease; z-index: 20; overflow-y: auto;
    padding: 12px; border-radius: 0 8px 8px 0; pointer-events: auto;
  `;

  // Close button
  const closeBtn = document.createElement('div');
  closeBtn.textContent = '收起 ◀';
  closeBtn.style.cssText = 'cursor: pointer; margin-bottom: 12px; font-size: 13px; color: #aaa;';
  closeBtn.addEventListener('click', () => togglePanel(panel, tab, state));
  panel.appendChild(closeBtn);

  // Category sections
  const categories = [
    { id: 'explosive', label: '爆炸类' },
    { id: 'special', label: '特殊类' },
    { id: 'construct', label: '建造类' },
  ];

  for (const cat of categories) {
    const title = document.createElement('div');
    title.textContent = `── ${cat.label} ──`;
    title.style.cssText = 'color: #aaa; font-size: 12px; margin: 8px 0 6px;';
    panel.appendChild(title);

    const grid = document.createElement('div');
    grid.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 6px;';

    const items = WEAPONS.filter(w => w.category === cat.id);
    for (const item of items) {
      const card = document.createElement('div');
      card.dataset.weaponType = item.type;
      card.style.cssText = `
        padding: 6px 8px; background: rgba(255,255,255,0.1); border-radius: 6px;
        cursor: pointer; font-size: 12px; display: flex; align-items: center; gap: 6px;
        border: 1px solid transparent; transition: border 0.1s;
      `;
      card.innerHTML = `<span>${item.icon}</span><span>${item.label}</span>`;
      card.draggable = true;

      card.addEventListener('click', () => {
        state.selectedType = state.selectedType === item.type ? null : item.type;
        panel.querySelectorAll('[data-weapon-type]').forEach(el => {
          (el as HTMLElement).style.borderColor = 'transparent';
        });
        if (state.selectedType) {
          card.style.borderColor = '#fff';
        }
      });

      card.addEventListener('dragstart', (e) => {
        e.dataTransfer!.setData('text/plain', item.type);
        card.style.opacity = '0.5';
      });
      card.addEventListener('dragend', () => { card.style.opacity = '1'; });

      grid.appendChild(card);
    }
    panel.appendChild(grid);
  }

  container.appendChild(panel);

  tab.addEventListener('click', () => togglePanel(panel, tab, state));
  return state;
}

function togglePanel(
  panel: HTMLElement,
  tab: HTMLElement,
  state: WeaponPanelState,
): void {
  state.visible = !state.visible;
  if (state.visible) {
    panel.style.left = '0';
    tab.style.display = 'none';
  } else {
    panel.style.left = '-300px';
    tab.style.display = 'flex';
  }
}
```

- [ ] **Step 2: 编译检查**

```bash
npx tsc --noEmit
```

Expected: PASS

- [ ] **Step 3: 提交**

```bash
git add src/weaponpanel.ts && git commit -m "feat: 新增武器库侧边面板（16种武器，3分类，拖拽+点击选中）"
```

---

### Task 3: 底部工具栏移除建造卡片

**Files:**
- Modify: `src/ui.ts`

- [ ] **Step 1: 删除建造卡片区块**

在 `src/ui.ts` 中删除 `sep1`、`constructTypes` 遍历块、`sep2` 三部分。找到：

```typescript
  const sep1 = document.createElement('span');
  sep1.style.cssText = 'color: #555; margin: 0 8px; font-size: 18px;';
  sep1.textContent = '┃';
  bottomBar.appendChild(sep1);

  const constructTypes = [
    { id: 'building', label: '建筑', color: '#e8d5b0' },
    { id: 'vehicle', label: '车辆', color: '#e86040' },
    { id: 'tree', label: '树木', color: '#5a8a3c' },
  ];

  constructTypes.forEach(({ id, label, color }) => {
    const card = document.createElement('div');
    card.className = 'construct-card';
    card.dataset.type = id;
    card.dataset.kind = 'construct';
    card.style.cssText = `
      padding: 8px 16px; background: ${color}; color: #fff;
      border-radius: 8px; cursor: pointer; font-size: 14px;
      font-weight: bold; user-select: none;
      transition: transform 0.1s, box-shadow 0.1s;
      border: 2px solid transparent;
    `;
    card.textContent = label;
    card.draggable = true;
    card.addEventListener('dragstart', (e) => {
      e.dataTransfer!.setData('text/plain', 'construct:' + id);
      card.style.opacity = '0.5';
    });
    card.addEventListener('dragend', () => {
      card.style.opacity = '1';
    });
    card.addEventListener('click', () => {
      state.selectedConstruct = id;
      state.selectedExplosive = '';
      document.querySelectorAll('.bottom-card').forEach(c => {
        (c as HTMLElement).style.borderColor = 'transparent';
      });
      card.style.borderColor = '#fff';
      card.style.boxShadow = '0 0 8px rgba(255,255,255,0.5)';
    });
    card.classList.add('bottom-card');
    bottomBar.appendChild(card);
  });

  const sep2 = document.createElement('span');
  sep2.style.cssText = 'color: #555; margin: 0 8px; font-size: 18px;';
  sep2.textContent = '┃';
  bottomBar.appendChild(sep2);
```

全部删除。`sep`（原 `sep1`）和 `modeBtn` 之间不再有建造卡片。

- [ ] **Step 2: 移除 UIState.selectedConstruct**

将 `UIState` 接口中的 `selectedConstruct: string;` 删除，以及 `createUI` 中的 `selectedConstruct: '',`。

- [ ] **Step 3: 简化 updateUI**

```typescript
export function updateUI(container: HTMLElement, state: UIState): void {
  const infoEl = container.querySelector('#explosive-info');
  if (infoEl) infoEl.textContent = `当前: ${state.selectedExplosive.toUpperCase()}`;
  const objEl = container.querySelector('#objective-text');
  if (objEl) objEl.textContent = state.objective;
  const scoreEl = container.querySelector('#score-text');
  if (scoreEl) scoreEl.textContent = `得分: ${state.score}`;
}
```

- [ ] **Step 4: 编译检查**

```bash
npx tsc --noEmit
```

Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/ui.ts && git commit -m "refactor: 底部工具栏移除建造卡片（已迁移至武器库面板）"
```

---

### Task 4: 新增沙袋/路障/地雷/遥控炸弹模型

**Files:**
- Modify: `src/scene.ts`

- [ ] **Step 1: 新增模型函数**

在 `src/scene.ts` 的 `createSingleTree` 下方追加：

```typescript
export function createSandbag(x: number, z: number): void {
  const scene = getScene();
  const geo = new THREE.BoxGeometry(0.8, 0.4, 0.3);
  const mat = new THREE.MeshToonMaterial({ color: 0xc2b280 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, 0.2, z);
  mesh.castShadow = true;
  scene.add(mesh);

  const body = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(0.4, 0.2, 0.15)) });
  body.position.set(x, 0.2, z);
  getWorld().addBody(body);
  physicsBodies.push({ body, mesh, isBuilding: false });
}

export function createBarricade(x: number, z: number): void {
  const scene = getScene();
  const group = new THREE.Group();
  const coneGeo = new THREE.ConeGeometry(0.3, 0.8, 8);
  const coneMat = new THREE.MeshToonMaterial({ color: 0xff6600 });
  const cone = new THREE.Mesh(coneGeo, coneMat);
  cone.position.y = 0.4;
  cone.castShadow = true;
  group.add(cone);

  const stripeGeo = new THREE.TorusGeometry(0.25, 0.04, 4, 8);
  const stripeMat = new THREE.MeshToonMaterial({ color: 0xffffff });
  const stripe1 = new THREE.Mesh(stripeGeo, stripeMat);
  stripe1.position.y = 0.35;
  group.add(stripe1);
  const stripe2 = new THREE.Mesh(stripeGeo, stripeMat);
  stripe2.position.y = 0.5;
  group.add(stripe2);

  group.position.set(x, 0, z);
  scene.add(group);

  const body = new CANNON.Body({
    mass: 0,
    shape: new CANNON.Cylinder(0.3, 0.3, 0.8, 8),
  });
  body.position.set(x, 0.4, z);
  getWorld().addBody(body);
  physicsBodies.push({ body, mesh: group, isBuilding: false });
}

export function createMineModel(x: number, z: number): THREE.Group {
  const scene = getScene();
  const group = new THREE.Group();

  const geo = new THREE.CylinderGeometry(0.25, 0.3, 0.1, 8);
  const mat = new THREE.MeshToonMaterial({ color: 0x444444 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 0.05;
  mesh.castShadow = true;
  group.add(mesh);

  const pinGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.12, 6);
  const pinMat = new THREE.MeshToonMaterial({ color: 0x888888 });
  const pin = new THREE.Mesh(pinGeo, pinMat);
  pin.position.y = 0.14;
  group.add(pin);

  group.position.set(x, 0, z);
  scene.add(group);
  return group;
}

export function createRemoteBombModel(x: number, z: number): THREE.Mesh {
  const scene = getScene();
  const geo = new THREE.BoxGeometry(0.4, 0.2, 0.3);
  const mat = new THREE.MeshToonMaterial({ color: 0x228833 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, 0.1, z);
  mesh.castShadow = true;
  scene.add(mesh);
  return mesh;
}
```

- [ ] **Step 2: 编译检查**

```bash
npx tsc --noEmit
```

Expected: PASS

- [ ] **Step 3: 提交**

```bash
git add src/scene.ts && git commit -m "feat: 新增沙袋/路障/地雷/遥控炸弹 3D 模型"
```

---

### Task 5: 新增燃烧/烟雾/闪光弹特效

**Files:**
- Modify: `src/effects.ts`

- [ ] **Step 1: 追加三个特效函数**

在 `src/effects.ts` 的 `spawnNukeEffect` 下方追加：

```typescript
// ============================================================
// Incendiary: persistent fire particles for 3s
// ============================================================
export function spawnIncendiaryEffect(position: THREE.Vector3): void {
  let burnElapsed = 0;
  const burnDuration = 3;
  const fireColors = [0xffdd00, 0xff8800, 0xff4400, 0xffaa00];

  function animateBurn(dt: number): boolean {
    burnElapsed += dt;
    if (burnElapsed < burnDuration && Math.random() < 0.6) {
      const pos = position.clone().add(
        new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 0.5, (Math.random() - 0.5) * 3),
      );
      const color = fireColors[Math.floor(Math.random() * fireColors.length)];
      addParticle(pos, new THREE.Vector3(0, 1 + Math.random() * 2, 0), color, 0.1, 0.8);
    }
    return burnElapsed < burnDuration;
  }
  activeAnimations.push(animateBurn);
}

// ============================================================
// Smoke: expanding grey sphere + smoke particles
// ============================================================
export function spawnSmokeEffect(position: THREE.Vector3): void {
  const scene = getScene();
  const sphereGeo = new THREE.SphereGeometry(0.5, 8, 8);
  const sphereMat = new THREE.MeshBasicMaterial({ color: 0x666666, transparent: true, opacity: 0.6 });
  const sphere = new THREE.Mesh(sphereGeo, sphereMat);
  sphere.position.copy(position);
  sphere.position.y += 1;
  scene.add(sphere);

  let elapsed = 0;
  const duration = 3;

  function animateSmoke(dt: number): boolean {
    elapsed += dt;
    const t = elapsed / duration;
    sphere.scale.setScalar(1 + t * 10);
    sphereMat.opacity = Math.max(0, 0.6 * (1 - t));
    sphere.position.y += dt * 1.5;

    if (Math.random() < 0.5) {
      addParticle(
        sphere.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 4, 1, (Math.random() - 0.5) * 4)),
        new THREE.Vector3(0, 1 + Math.random(), 0),
        0x888888, 0.2, 1.5,
      );
    }

    if (elapsed >= duration) {
      scene.remove(sphere);
      sphereGeo.dispose();
      sphereMat.dispose();
      return false;
    }
    return true;
  }
  activeAnimations.push(animateSmoke);
}

// ============================================================
// Flashbang: white hemisphere flash 0.5s
// ============================================================
export function spawnFlashEffect(position: THREE.Vector3): void {
  const scene = getScene();
  const geo = new THREE.SphereGeometry(1, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1 });
  const flash = new THREE.Mesh(geo, mat);
  flash.position.copy(position);
  flash.position.y += 1;
  scene.add(flash);

  let elapsed = 0;
  const duration = 0.5;

  function animateFlash(dt: number): boolean {
    elapsed += dt;
    flash.scale.setScalar(1 + elapsed * 15);
    mat.opacity = Math.max(0, 1 - elapsed / duration);
    if (elapsed >= duration) {
      scene.remove(flash);
      geo.dispose();
      mat.dispose();
      return false;
    }
    return true;
  }
  activeAnimations.push(animateFlash);
}
```

- [ ] **Step 2: 编译检查**

```bash
npx tsc --noEmit
```

Expected: PASS

- [ ] **Step 3: 提交**

```bash
git add src/effects.ts && git commit -m "feat: 新增燃烧弹/烟雾弹/闪光弹特效"
```

---

### Task 6: 遥控炸弹分组引爆 + 地雷触发

**Files:**
- Modify: `src/game.ts`

- [ ] **Step 1: 追加遥控炸弹和地雷逻辑**

在 `src/game.ts` 末尾追加：

```typescript
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
      bomb.mesh.removeFromParent?.();
      remoteBombs.splice(i, 1);
    }
  }
  return positions;
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

    // Arm after 1s
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
```

- [ ] **Step 2: 在顶部追加必要的 import**

```typescript
import { REMOTE_RADIUS, REMOTE_FORCE, MINE_RADIUS, MINE_FORCE } from './constants';
```

- [ ] **Step 3: 导出现有 getWorld**

检查 `getWorld` 是否已从 physics 导出。在 `src/physics.ts` 中已有 `export function getWorld()`。

- [ ] **Step 4: 编译检查**

```bash
npx tsc --noEmit
```

Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/game.ts && git commit -m "feat: 遥控炸弹分组引爆 + 地雷接近触发逻辑"
```

---

### Task 7: 新增按键（遥控引爆 1/2/3 + 面板切换）

**Files:**
- Modify: `src/input.ts`

- [ ] **Step 1: 扩展 InputState**

```typescript
export interface InputState {
  rotateLeft: boolean;
  rotateRight: boolean;
  zoomIn: boolean;
  zoomOut: boolean;
  detonate: boolean;
  reset: boolean;
  mouseDown: boolean;
  mouseX: number;
  mouseY: number;
  rightMouseDown: boolean;
  scrollDelta: number;
  detonateGroup1: boolean;
  detonateGroup2: boolean;
  detonateGroup3: boolean;
  togglePanel: boolean;
}
```

- [ ] **Step 2: 初始化新字段**

在 `createInputState` 返回对象中追加：

```typescript
detonateGroup1: false,
detonateGroup2: false,
detonateGroup3: false,
togglePanel: false,
```

- [ ] **Step 3: keydown 处理**

在 switch 中追加：

```typescript
case '1': input.detonateGroup1 = true; break;
case '2': input.detonateGroup2 = true; break;
case '3': input.detonateGroup3 = true; break;
case '`': input.togglePanel = true; break;
```

- [ ] **Step 4: keyup 处理**

在 switch 中追加：

```typescript
case '1': input.detonateGroup1 = false; break;
case '2': input.detonateGroup2 = false; break;
case '3': input.detonateGroup3 = false; break;
case '`': input.togglePanel = false; break;
```

- [ ] **Step 5: 编译检查**

```bash
npx tsc --noEmit
```

Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add src/input.ts && git commit -m "feat: 新增按键 1/2/3（遥控引爆）+ `（武器面板切换）"
```

---

### Task 8: main.ts 集成武器库面板 + 新武器路由

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: 更新 imports**

```typescript
import { createWeaponPanel, WeaponPanelState } from './weaponpanel';
import { createSingleBuilding, createSingleVehicle, createSingleTree, createSandbag, createBarricade, createMineModel, createRemoteBombModel } from './scene';
import { placeRemoteBomb, detonateGroup, updateMines, placeMine } from './game';
import { spawnIncendiaryEffect, spawnSmokeEffect, spawnFlashEffect, spawnTntEffect } from './effects';

// 移除: createExplosiveMesh, removeAllExplosives, createInputState
// 保留: initRenderer, getCamera, getScene
// 新增: WeaponPanelState
```

- [ ] **Step 2: 初始化面板**

在 `setupInput` 下方追加：

```typescript
const panelState = createWeaponPanel(container);
```

- [ ] **Step 3: 更新 handleClick**

```typescript
function handleClick(): void {
  if (!input.mouseDown) return;

  mouse.x = (input.mouseX / container.clientWidth) * 2 - 1;
  mouse.y = -(input.mouseY / container.clientHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, getCamera());
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const intersection = new THREE.Vector3();
  raycaster.ray.intersectPlane(groundPlane, intersection);

  if (intersection) {
    const type = panelState.selectedType || uiState.selectedExplosive;
    placeItem(type, intersection.x, intersection.z);
  }

  input.mouseDown = false;
}
```

- [ ] **Step 4: 更新 drop handler**

```typescript
container.addEventListener('drop', (e) => {
  e.preventDefault();
  const type = e.dataTransfer!.getData('text/plain');
  if (!type) return;
  const intersection = getGroundIntersection(e.clientX, e.clientY);
  if (!intersection) return;
  placeItem(type, intersection.x, intersection.z);
});
```

- [ ] **Step 5: 新增 placeItem 分发函数**

```typescript
function placeItem(type: string, x: number, z: number): void {
  const pos = new CANNON.Vec3(x, 0, z);
  const pos3 = new THREE.Vector3(x, 1, z);

  switch (type) {
    // Explosives (existing)
    case 'tnt':
    case 'c4':
    case 'nitroglycerin':
    case 'nuke':
      placeExplosive(type, pos);
      createExplosiveMesh(type, pos);
      break;
    // New explosives
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
    // Special
    case 'incendiary': spawnIncendiaryEffect(pos3); break;
    case 'smoke': spawnSmokeEffect(pos3); break;
    case 'flash': spawnFlashEffect(pos3); break;
    // Constructs
    case 'building': createSingleBuilding(x, z); break;
    case 'vehicle': createSingleVehicle(x, z); break;
    case 'tree': createSingleTree(x, z); break;
    case 'sandbag': createSandbag(x, z); break;
    case 'barricade': createBarricade(x, z); break;
  }
}

let placedCount = 0;
```

- [ ] **Step 6: 动画循环中处理新输入**

在 `animate()` 中添加：

```typescript
// Panel toggle
if (input.togglePanel) {
  // Handled by weaponpanel internal toggle; just consume the flag
  const tab = document.getElementById('weapon-tab');
  if (tab) tab.click();
  input.togglePanel = false;
}

// Remote detonation groups
if (input.detonateGroup1) {
  for (const p of detonateGroup(0)) spawnTntEffect(p);
  input.detonateGroup1 = false;
}
if (input.detonateGroup2) {
  for (const p of detonateGroup(1)) spawnTntEffect(p);
  input.detonateGroup2 = false;
}
if (input.detonateGroup3) {
  for (const p of detonateGroup(2)) spawnTntEffect(p);
  input.detonateGroup3 = false;
}

// Mine detection
const triggered = updateMines(dt);
for (const mine of triggered) {
  spawnTntEffect(new THREE.Vector3(mine.position.x, 1, mine.position.z));
  getScene().remove(mine.mesh);
  mine.mesh.traverse((c) => {
    if (c instanceof THREE.Mesh) { c.geometry.dispose(); (c.material as THREE.Material).dispose(); }
  });
}
```

- [ ] **Step 7: 编译检查**

```bash
npx tsc --noEmit
```

Expected: PASS

- [ ] **Step 8: 提交**

```bash
git add src/main.ts && git commit -m "feat: main.ts 集成武器库面板 + 16种武器路由 + 遥控引爆 + 地雷检测"
```

---

### Task 9: 端到端验证 + 最终提交

- [ ] **Step 1: 构建验证**

```bash
npx tsc --noEmit && npx vite build
```

Expected: PASS (both commands succeed)

- [ ] **Step 2: 运行时验证**

启动 dev server，测试：
1. 左侧 `[武]` 标签点击展开面板 ✅
2. 面板内点击卡片选中 ✅
3. 点击 canvas 放置武器 ✅
4. 拖拽卡片到 canvas 放置 ✅
5. 按 1/2/3 分组遥控引爆 ✅
6. 地雷车辆碾压触发 ✅
7. 燃烧/烟雾/闪光弹特效 ✅
8. 沙袋/路障放置 + 爆炸摧毁 ✅
9. 点击面板空白处不触发放置 ✅
10. 收起面板后底部快捷栏仍可正常使用 ✅

- [ ] **Step 3: 最终提交**

```bash
git add . && git commit -m "chore: 武器库系统端到端验证通过"
```
