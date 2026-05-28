# 爆炸模拟器实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 从零搭建爆炸模拟器游戏 — 2.5D 等距视角物理沙盒，支持放置爆炸物、摧毁建筑、粒子特效

**Architecture:** 单页应用，Three.js 正交相机渲染低多边形城市场景，Cannon-es 驱动物理模拟（刚体碰撞+爆炸冲击波），DOM Overlay 处理 UI 交互。物理与渲染完全分离 — Cannon-es 计算位置/速度，Three.js 读取物理状态渲染。

**Tech Stack:** Vite + TypeScript + Three.js + Cannon-es

**文件结构:**
```
src/
  main.ts              - 入口：初始化 Three.js、Cannon-es、启动游戏循环
  constants.ts          - 所有可调常量（颜色、尺寸、物理参数、爆炸物属性）
  game.ts               - 游戏循环 (requestAnimationFrame)，同步 physics→renderer
  scene.ts              - 构建 3D 场景（地面、建筑、道路、装饰、车辆）
  physics.ts            - Cannon-es 世界、刚体管理、爆炸冲击波计算
  input.ts              - 键盘/鼠标输入处理
  ui.ts                 - DOM Overlay（顶部状态栏、底部工具栏）
  effects.ts            - 粒子系统、蘑菇云、屏幕震动
```

---

## Phase 1: 项目搭建 + 静态场景 (Task 1-7)

### Task 1: 初始化 Vite + TypeScript 项目

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/main.ts`

- [ ] **Step 1: 创建 package.json**

```json
{
  "name": "blasting-simulator",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  }
}
```

- [ ] **Step 2: 安装依赖**

```bash
npm install three cannon-es @types/three
```

- [ ] **Step 3: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "lib": ["ES2020", "DOM", "DOM.Iterable"]
  },
  "include": ["src"]
}
```

- [ ] **Step 4: 创建 vite.config.ts**

```typescript
import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
  },
});
```

- [ ] **Step 5: 创建 index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>爆炸模拟器</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; }
    #app { width: 100%; height: 100%; position: relative; }
    canvas { display: block; }
  </style>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

- [ ] **Step 6: 创建 src/main.ts 骨架**

```typescript
console.log('Blasting Simulator - init');
```

- [ ] **Step 7: 验证项目能启动**

```bash
npx vite --host
```
Expected: 浏览器打开后控制台输出 "Blasting Simulator - init"

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts index.html src/main.ts
git commit -m "feat: 初始化 Vite + TypeScript 项目骨架

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 2: 场景渲染基础 — Three.js 正交相机 + 地面 + 光照

**Files:**
- Create: `src/constants.ts`
- Create: `src/renderer.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: 创建 src/constants.ts**

```typescript
// 场景尺寸
export const WORLD_SIZE = 60;
export const GROUND_Y = 0;

// 相机
export const CAMERA_ZOOM = 12;
export const CAMERA_NEAR = 0.1;
export const CAMERA_FAR = 200;

// 颜色
export const COLOR_GROUND = 0x9bbc7b;
export const COLOR_ROAD = 0x555555;
export const COLOR_ROAD_LINE = 0xffffff;
export const COLOR_SIDEWALK = 0xcccccc;
```

- [ ] **Step 2: 创建 src/renderer.ts**

```typescript
import * as THREE from 'three';
import { WORLD_SIZE, CAMERA_ZOOM, CAMERA_NEAR, CAMERA_FAR, COLOR_GROUND } from './constants';

let camera: THREE.OrthographicCamera;
let renderer: THREE.WebGLRenderer;
let scene: THREE.Scene;

export function initRenderer(container: HTMLElement) {
  const aspect = container.clientWidth / container.clientHeight;
  const frustumSize = CAMERA_ZOOM;

  camera = new THREE.OrthographicCamera(
    frustumSize * aspect / -2,
    frustumSize * aspect / 2,
    frustumSize / 2,
    frustumSize / -2,
    CAMERA_NEAR,
    CAMERA_FAR,
  );

  // 等距视角：从斜上方看
  camera.position.set(30, 30, 30);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;

  container.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.Fog(0x87ceeb, 40, 80);

  // 环境光
  scene.add(new THREE.AmbientLight(0xffeedd, 0.6));

  // 主方向光（模拟太阳，产生阴影）
  const sun = new THREE.DirectionalLight(0xffffff, 0.8);
  sun.position.set(20, 30, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -40;
  sun.shadow.camera.right = 40;
  sun.shadow.camera.top = 40;
  sun.shadow.camera.bottom = -40;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 100;
  scene.add(sun);

  // 地面
  const groundGeo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE);
  const groundMat = new THREE.MeshToonMaterial({ color: COLOR_GROUND });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  window.addEventListener('resize', () => {
    const a = container.clientWidth / container.clientHeight;
    camera.left = frustumSize * a / -2;
    camera.right = frustumSize * a / 2;
    camera.top = frustumSize / 2;
    camera.bottom = frustumSize / -2;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  });

  return { camera, renderer, scene };
}

export function getScene() { return scene; }
export function getCamera() { return camera; }
export function getRenderer() { return renderer; }
```

- [ ] **Step 3: 更新 src/main.ts**

```typescript
import { initRenderer } from './renderer';

const container = document.getElementById('app')!;
const { camera, renderer, scene } = initRenderer(container);

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

animate();
```

- [ ] **Step 4: 验证 — 启动 dev server，浏览器看到绿色地面 + 蓝色天空**

```bash
npx vite --host
```

- [ ] **Step 5: Commit**

```bash
git add src/constants.ts src/renderer.ts src/main.ts
git commit -m "feat: 添加 Three.js 正交相机渲染器 + 地面 + 光照

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 3: 建筑生成 — 低多边形建筑群

**Files:**
- Create: `src/scene.ts`
- Modify: `src/constants.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: 在 src/constants.ts 追加建筑相关常量**

```typescript
// 建筑
export const BUILDING_COLORS = [0xe8d5b0, 0xd4c4a0, 0xccbb99, 0xddc8a8, 0xbfae8e, 0xe0cfa8, 0xc8b898, 0xeedcc0];
export const BUILDING_MIN_WIDTH = 2;
export const BUILDING_MAX_WIDTH = 4;
export const BUILDING_MIN_DEPTH = 2;
export const BUILDING_MAX_DEPTH = 4;
export const BUILDING_MIN_HEIGHT = 3;
export const BUILDING_MAX_HEIGHT = 10;
export const BUILDING_COUNT = 8;
```

- [ ] **Step 2: 创建 src/scene.ts — 建筑生成函数**

```typescript
import * as THREE from 'three';
import {
  BUILDING_COLORS, BUILDING_MIN_WIDTH, BUILDING_MAX_WIDTH,
  BUILDING_MIN_DEPTH, BUILDING_MAX_DEPTH,
  BUILDING_MIN_HEIGHT, BUILDING_MAX_HEIGHT, BUILDING_COUNT,
} from './constants';
import { getScene } from './renderer';

interface Building {
  mesh: THREE.Mesh;
  width: number;
  depth: number;
  height: number;
}

export const buildings: Building[] = [];

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function createBuildings(): void {
  const scene = getScene();

  // 固定布局：在指定区域生成建筑群
  const positions = [
    { x: -8, z: -8 }, { x: -2, z: -10 }, { x: 5, z: -7 },
    { x: -6, z: 2 }, { x: 3, z: 0 }, { x: -10, z: 8 },
    { x: 7, z: 5 }, { x: 0, z: 9 },
  ];

  for (let i = 0; i < BUILDING_COUNT; i++) {
    const w = rand(BUILDING_MIN_WIDTH, BUILDING_MAX_WIDTH);
    const d = rand(BUILDING_MIN_DEPTH, BUILDING_MAX_DEPTH);
    const h = rand(BUILDING_MIN_HEIGHT, BUILDING_MAX_HEIGHT);
    const color = BUILDING_COLORS[i % BUILDING_COLORS.length];

    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshToonMaterial({ color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const pos = positions[i];
    mesh.position.set(pos.x, h / 2, pos.z); // y=0 是地面，建筑底部在地面

    scene.add(mesh);
    buildings.push({ mesh, width: w, depth: d, height: h });
  }
}
```

- [ ] **Step 3: 更新 src/main.ts 调用场景构建**

```typescript
import { initRenderer } from './renderer';
import { createBuildings } from './scene';

const container = document.getElementById('app')!;
const { camera, renderer, scene } = initRenderer(container);

createBuildings();

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

animate();
```

- [ ] **Step 4: 验证 — 浏览器中看到8栋低多边形建筑分布在场景中**

```bash
npx vite --host
```

- [ ] **Step 5: Commit**

```bash
git add src/scene.ts src/constants.ts src/main.ts
git commit -m "feat: 添加低多边形建筑群生成逻辑

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 4: 道路系统 + 车辆 + 环境装饰

**Files:**
- Modify: `src/constants.ts`
- Modify: `src/scene.ts`

- [ ] **Step 1: 在 src/constants.ts 追加道路和装饰常量**

```typescript
// 道路
export const ROAD_WIDTH = 3;
export const ROAD_LINE_GAP = 0.8;
export const ROAD_LINE_LENGTH = 1.2;

// 车辆颜色
export const VEHICLE_COLORS = [0xe86040, 0x4080e8, 0xf0c040, 0x40c060, 0xe0e0e0];

// 环境装饰
export const TREE_TRUNK_COLOR = 0x8B7355;
export const TREE_LEAF_COLOR = 0x5a8a3c;
```

- [ ] **Step 2: 在 src/scene.ts 追加道路、车辆、装饰生成**

```typescript
import {
  // ... existing imports ...
  WORLD_SIZE, ROAD_WIDTH, ROAD_LINE_GAP, ROAD_LINE_LENGTH,
  COLOR_ROAD, COLOR_ROAD_LINE, COLOR_SIDEWALK,
  VEHICLE_COLORS, TREE_TRUNK_COLOR, TREE_LEAF_COLOR,
} from './constants';

// ... existing code ...

export function createRoads(): void {
  const scene = getScene();
  const halfWorld = WORLD_SIZE / 2;

  // 十字形道路
  const roadGeoH = new THREE.PlaneGeometry(WORLD_SIZE, ROAD_WIDTH);
  const roadGeoV = new THREE.PlaneGeometry(ROAD_WIDTH, WORLD_SIZE);
  const roadMat = new THREE.MeshToonMaterial({ color: COLOR_ROAD });
  const sidewalkMat = new THREE.MeshToonMaterial({ color: COLOR_SIDEWALK });

  // 水平道路（含人行道）
  const sidewalkH = new THREE.PlaneGeometry(WORLD_SIZE, ROAD_WIDTH + 1);
  const sH = new THREE.Mesh(sidewalkH, sidewalkMat);
  sH.rotation.x = -Math.PI / 2;
  sH.position.y = 0.01;
  scene.add(sH);

  const roadH = new THREE.Mesh(roadGeoH, roadMat);
  roadH.rotation.x = -Math.PI / 2;
  roadH.position.y = 0.02;
  scene.add(roadH);

  // 垂直道路（含人行道）
  const sidewalkV = new THREE.PlaneGeometry(ROAD_WIDTH + 1, WORLD_SIZE);
  const sV = new THREE.Mesh(sidewalkV, sidewalkMat);
  sV.rotation.x = -Math.PI / 2;
  sV.position.y = 0.01;
  scene.add(sV);

  const roadV = new THREE.Mesh(roadGeoV, roadMat);
  roadV.rotation.x = -Math.PI / 2;
  roadV.position.y = 0.02;
  scene.add(roadV);

  // 虚线标线
  const lineMat = new THREE.MeshToonMaterial({ color: COLOR_ROAD_LINE });
  for (let i = -halfWorld; i < halfWorld; i += ROAD_LINE_GAP + ROAD_LINE_LENGTH) {
    const lineH = new THREE.Mesh(
      new THREE.PlaneGeometry(ROAD_LINE_LENGTH, 0.15),
      lineMat,
    );
    lineH.rotation.x = -Math.PI / 2;
    lineH.position.set(i, 0.03, 0);
    scene.add(lineH);

    const lineV = new THREE.Mesh(
      new THREE.PlaneGeometry(0.15, ROAD_LINE_LENGTH),
      lineMat,
    );
    lineV.rotation.x = -Math.PI / 2;
    lineV.position.set(0, 0.03, i);
    scene.add(lineV);
  }
}

export interface Vehicle {
  body: THREE.Group;
  x: number;
  z: number;
}

export const vehicles: Vehicle[] = [];

export function createVehicles(): void {
  const scene = getScene();
  const positions = [
    { x: -14, z: 0.8 }, { x: 8, z: 1.2 }, { x: 0.6, z: 14 },
    { x: 1.2, z: -10 }, { x: -6, z: 0.5 },
  ];

  for (const pos of positions) {
    const color = VEHICLE_COLORS[Math.floor(Math.random() * VEHICLE_COLORS.length)];
    const group = new THREE.Group();

    // 车身
    const bodyGeo = new THREE.BoxGeometry(2, 1, 1.2);
    const bodyMat = new THREE.MeshToonMaterial({ color });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.position.y = 0.6;
    bodyMesh.castShadow = true;
    group.add(bodyMesh);

    // 车顶
    const roofGeo = new THREE.BoxGeometry(1.2, 0.5, 1.1);
    const roofMat = new THREE.MeshToonMaterial({ color: 0x333333 });
    const roofMesh = new THREE.Mesh(roofGeo, roofMat);
    roofMesh.position.set(0, 1.15, 0);
    roofMesh.castShadow = true;
    group.add(roofMesh);

    // 轮子
    const wheelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 8);
    const wheelMat = new THREE.MeshToonMaterial({ color: 0x111111 });
    const wheelPositions = [
      { x: 0.6, y: 0.3, z: 0.65 },
      { x: -0.6, y: 0.3, z: 0.65 },
      { x: 0.6, y: 0.3, z: -0.65 },
      { x: -0.6, y: 0.3, z: -0.65 },
    ];
    for (const wp of wheelPositions) {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wp.x, wp.y, wp.z);
      wheel.castShadow = true;
      group.add(wheel);
    }

    group.position.set(pos.x, 0, pos.z);
    group.rotation.y = Math.random() > 0.5 ? 0 : Math.PI / 2;
    scene.add(group);
    vehicles.push({ body: group, x: pos.x, z: pos.z });
  }
}

export function createDecorations(): void {
  const scene = getScene();
  const treePositions = [
    { x: -16, z: -14 }, { x: 14, z: -12 }, { x: -14, z: 16 },
    { x: 16, z: 14 }, { x: -18, z: 4 }, { x: 18, z: -4 },
    { x: -4, z: 16 }, { x: 4, z: -16 },
  ];

  for (const pos of treePositions) {
    const tree = new THREE.Group();

    const trunkGeo = new THREE.CylinderGeometry(0.15, 0.2, 1.5, 6);
    const trunkMat = new THREE.MeshToonMaterial({ color: TREE_TRUNK_COLOR });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 0.75;
    trunk.castShadow = true;
    tree.add(trunk);

    const leafGeo = new THREE.SphereGeometry(0.8, 6, 4);
    const leafMat = new THREE.MeshToonMaterial({ color: TREE_LEAF_COLOR });
    const leaf = new THREE.Mesh(leafGeo, leafMat);
    leaf.position.y = 1.8;
    leaf.castShadow = true;
    tree.add(leaf);

    tree.position.set(pos.x, 0, pos.z);
    scene.add(tree);
  }
}

export function createScene(): void {
  createRoads();
  createBuildings();
  createVehicles();
  createDecorations();
}
```

- [ ] **Step 3: 更新 src/main.ts 调用**

```typescript
import { initRenderer } from './renderer';
import { createScene } from './scene';

const container = document.getElementById('app')!;
const { camera, renderer, scene } = initRenderer(container);

createScene();
// ... animate() unchanged
```

- [ ] **Step 4: 验证 — 看到完整的城市街区场景**

```bash
npx vite --host
```

- [ ] **Step 5: Commit**

```bash
git add src/constants.ts src/scene.ts src/main.ts
git commit -m "feat: 添加道路系统、车辆和环境装饰

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 5: 相机控制 — 旋转 + 缩放

**Files:**
- Create: `src/input.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: 创建 src/input.ts**

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
    mouseX: 0,
    mouseY: 0,
    rightMouseDown: false,
    scrollDelta: 0,
  };
}

export function setupInput(input: InputState): void {
  window.addEventListener('keydown', (e) => {
    switch (e.key.toLowerCase()) {
      case 'q': input.rotateLeft = true; break;
      case 'e': input.rotateRight = true; break;
      case '=':
      case '+': input.zoomIn = true; break;
      case '-': input.zoomOut = true; break;
      case ' ': input.detonate = true; break;
      case 'r': input.reset = true; break;
    }
  });

  window.addEventListener('keyup', (e) => {
    switch (e.key.toLowerCase()) {
      case 'q': input.rotateLeft = false; break;
      case 'e': input.rotateRight = false; break;
      case '=':
      case '+': input.zoomIn = false; break;
      case '-': input.zoomOut = false; break;
      case ' ': input.detonate = false; break;
      case 'r': input.reset = false; break;
    }
  });

  window.addEventListener('mousedown', (e) => {
    if (e.button === 0) input.mouseDown = true;
    if (e.button === 2) input.rightMouseDown = true;
    input.mouseX = e.clientX;
    input.mouseY = e.clientY;
  });

  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) input.mouseDown = false;
    if (e.button === 2) input.rightMouseDown = false;
  });

  window.addEventListener('mousemove', (e) => {
    input.mouseX = e.clientX;
    input.mouseY = e.clientY;
  });

  window.addEventListener('wheel', (e) => {
    input.scrollDelta += e.deltaY;
  });

  window.addEventListener('contextmenu', (e) => e.preventDefault());
}
```

- [ ] **Step 2: 更新 src/main.ts — 添加相机控制**

```typescript
import { initRenderer, getCamera } from './renderer';
import { createScene } from './scene';
import { createInputState, setupInput } from './input';
import { CAMERA_ZOOM } from './constants';

const container = document.getElementById('app')!;
const { camera, renderer, scene } = initRenderer(container);

createScene();

const input = createInputState();
setupInput(input);

let cameraAngle = Math.PI / 4; // 45度
let cameraDistance = 30;
let zoomLevel = CAMERA_ZOOM;

function updateCamera(): void {
  // 旋转
  if (input.rotateLeft) cameraAngle += 0.03;
  if (input.rotateRight) cameraAngle -= 0.03;

  // 缩放
  if (input.scrollDelta !== 0) {
    zoomLevel += input.scrollDelta * 0.01;
    zoomLevel = Math.max(6, Math.min(25, zoomLevel));
    input.scrollDelta = 0;
  }
  if (input.zoomIn) zoomLevel -= 0.1;
  if (input.zoomOut) zoomLevel += 0.1;
  zoomLevel = Math.max(6, Math.min(25, zoomLevel));

  const height = cameraDistance * Math.sin(Math.PI / 3); // 约60度仰角
  const horizontal = cameraDistance * Math.cos(Math.PI / 3);
  const x = horizontal * Math.sin(cameraAngle);
  const z = horizontal * Math.cos(cameraAngle);

  const cam = getCamera();
  cam.position.set(x, height, z);
  cam.lookAt(0, 0, 0);

  // 更新正交相机 frustum
  const aspect = container.clientWidth / container.clientHeight;
  cam.left = zoomLevel * aspect / -2;
  cam.right = zoomLevel * aspect / 2;
  cam.top = zoomLevel / 2;
  cam.bottom = zoomLevel / -2;
  cam.updateProjectionMatrix();
}

function animate() {
  requestAnimationFrame(animate);
  updateCamera();
  renderer.render(scene, camera);
}

animate();
```

- [ ] **Step 3: 验证 — Q/E 旋转视角，滚轮缩放**

```bash
npx vite --host
```
Expected: Q/E 键旋转90度视角，滚轮缩放，右键拖拽旋转

- [ ] **Step 4: Commit**

```bash
git add src/input.ts src/main.ts
git commit -m "feat: 添加相机旋转(Q/E)和缩放(滚轮)控制

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 6: 右键拖拽旋转视角

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: 在 src/main.ts 的 updateCamera 函数中加入右键拖拽逻辑**

在 `updateCamera` 函数开头追加:

```typescript
// 右键拖拽旋转（在 updateCamera 函数内部，现有旋转逻辑之前）
if (input.rightMouseDown) {
  // 鼠标水平移动量转换为旋转角度
  const sensitivity = 0.005;
  // 需要追踪上一帧的鼠标位置，因此在 createInputState 后加两个变量:
  // let prevMouseX = 0;
  // let prevMouseY = 0;
}
```

- [ ] **Step 2: 完整修改 src/main.ts 的 Camera 控制部分**

替换 `src/main.ts` 为完整版本:

```typescript
import { initRenderer, getCamera } from './renderer';
import { createScene } from './scene';
import { createInputState, setupInput } from './input';
import { CAMERA_ZOOM } from './constants';

const container = document.getElementById('app')!;
const { camera, renderer, scene } = initRenderer(container);

createScene();

const input = createInputState();
setupInput(input);

let cameraAngle = Math.PI / 4;
let zoomLevel = CAMERA_ZOOM;
let prevMouseX = 0;
let prevMouseY = 0;

function updateCamera(): void {
  // 右键拖拽旋转
  if (input.rightMouseDown) {
    const dx = input.mouseX - prevMouseX;
    cameraAngle += dx * 0.005;
  }

  // 键盘旋转
  if (input.rotateLeft) cameraAngle += 0.03;
  if (input.rotateRight) cameraAngle -= 0.03;

  // 缩放
  if (input.scrollDelta !== 0) {
    zoomLevel += input.scrollDelta * 0.01;
    zoomLevel = Math.max(6, Math.min(25, zoomLevel));
    input.scrollDelta = 0;
  }
  if (input.zoomIn) zoomLevel -= 0.1;
  if (input.zoomOut) zoomLevel += 0.1;
  zoomLevel = Math.max(6, Math.min(25, zoomLevel));

  const height = 30 * Math.sin(Math.PI / 3);
  const horizontal = 30 * Math.cos(Math.PI / 3);
  const x = horizontal * Math.sin(cameraAngle);
  const z = horizontal * Math.cos(cameraAngle);

  const cam = getCamera();
  cam.position.set(x, height, z);
  cam.lookAt(0, 0, 0);

  const aspect = container.clientWidth / container.clientHeight;
  cam.left = zoomLevel * aspect / -2;
  cam.right = zoomLevel * aspect / 2;
  cam.top = zoomLevel / 2;
  cam.bottom = zoomLevel / -2;
  cam.updateProjectionMatrix();

  prevMouseX = input.mouseX;
  prevMouseY = input.mouseY;
}

function animate() {
  requestAnimationFrame(animate);
  updateCamera();
  renderer.render(scene, camera);
}

animate();
```

- [ ] **Step 3: 验证 — 右键拖拽旋转视角**

```bash
npx vite --host
```

- [ ] **Step 4: Commit**

```bash
git add src/main.ts
git commit -m "feat: 添加右键拖拽旋转视角功能

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Phase 2: 物理系统 + 基础爆炸 (Task 7-10)

### Task 7: Cannon-es 物理世界初始化 + 建筑刚体

**Files:**
- Create: `src/physics.ts`
- Modify: `src/main.ts`
- Modify: `src/scene.ts`

- [ ] **Step 1: 创建 src/physics.ts — 物理世界初始化**

```typescript
import * as CANNON from 'cannon-es';
import { GROUND_Y } from './constants';

let world: CANNON.World;

export function initPhysics(): CANNON.World {
  world = new CANNON.World();
  world.gravity.set(0, -20, 0);
  world.broadphase = new CANNON.SAPBroadphase(world);
  world.allowSleep = true;
  world.solver.iterations = 10;

  // 地面静态刚体
  const groundShape = new CANNON.Plane();
  const groundBody = new CANNON.Body({ mass: 0, shape: groundShape });
  groundBody.quaternion.setFromEulerAngles(-Math.PI / 2, 0, 0);
  groundBody.position.y = GROUND_Y;
  world.addBody(groundBody);

  return world;
}

export function getWorld(): CANNON.World {
  return world;
}

export interface PhysicsBody {
  body: CANNON.Body;
  mesh: THREE.Mesh | THREE.Group;
  isBuilding: boolean;
}
```

- [ ] **Step 2: 在 src/physics.ts 追加建筑物理体创建函数**

```typescript
export function createBuildingBody(
  width: number, height: number, depth: number,
  x: number, z: number,
): CANNON.Body {
  const shape = new CANNON.Box(new CANNON.Vec3(width / 2, height / 2, depth / 2));
  const body = new CANNON.Body({ mass: 500, shape });
  body.position.set(x, height / 2, z);
  body.linearDamping = 0.3;
  body.angularDamping = 0.3;
  world.addBody(body);
  return body;
}
```

- [ ] **Step 3: 更新 src/scene.ts — 建筑创建时同步生成物理体**

在 `createBuildings` 函数中，建筑创建后追加:

```typescript
import { createBuildingBody, PhysicsBody } from './physics';

// 在文件顶部添加:
export const physicsBodies: PhysicsBody[] = [];

// 在 createBuildings 函数的 for 循环内，buildings.push 之前:
const body = createBuildingBody(w, h, d, pos.x, pos.z);
physicsBodies.push({ body, mesh, isBuilding: true });
```

- [ ] **Step 4: 更新 src/main.ts — 加入物理步进**

在 animate 函数中添加物理步进:

```typescript
import { initPhysics, getWorld } from './physics';
import { physicsBodies } from './scene';

// 初始化
const world = initPhysics();

// animate 函数内，renderer.render 之前:
function animate() {
  requestAnimationFrame(animate);
  updateCamera();

  // 物理步进
  world.step(1 / 60);

  // 同步物理体 → 渲染
  for (const pb of physicsBodies) {
    pb.mesh.position.copy(pb.body.position);
    pb.mesh.quaternion.copy(pb.body.quaternion);
  }

  renderer.render(scene, camera);
}
```

- [ ] **Step 5: 验证 — 场景正常渲染，建筑受重力影响（如果地面不是静态的会掉落）**

```bash
npx vite --host
```
Expected: 建筑保持在地面上（物理刚体和渲染网格同步），场景看起来和 Task 6 一样但物理在后台运行。

- [ ] **Step 6: Commit**

```bash
git add src/physics.ts src/main.ts src/scene.ts
git commit -m "feat: 集成 Cannon-es 物理引擎，建筑创建为动态刚体

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 8: 爆炸冲击波计算 + 施加 force

**Files:**
- Modify: `src/physics.ts`
- Create: `src/game.ts`

- [ ] **Step 1: 在 src/physics.ts 追加爆炸力计算函数**

```typescript
export interface ExplosionConfig {
  position: CANNON.Vec3;
  radius: number;
  baseForce: number;
}

export function applyExplosion(config: ExplosionConfig): void {
  const { position, radius, baseForce } = config;
  const bodies = world.bodies;

  for (const body of bodies) {
    if (body.mass === 0) continue; // 跳过静态物体

    const dist = body.position.distanceTo(position);

    if (dist > radius) continue;

    // force = baseForce / (1 + distance² / radius²)
    const forceMag = baseForce / (1 + (dist * dist) / (radius * radius));

    const direction = new CANNON.Vec3();
    body.position.vsub(position, direction);
    direction.normalize();

    // 施加冲量
    const impulse = new CANNON.Vec3();
    direction.scale(forceMag, impulse);
    body.applyImpulse(impulse, body.position);

    // 随机扭矩让物体旋转
    const torque = new CANNON.Vec3(
      (Math.random() - 0.5) * forceMag * 0.5,
      (Math.random() - 0.5) * forceMag * 0.5,
      (Math.random() - 0.5) * forceMag * 0.5,
    );
    body.applyTorque(torque);
    body.wakeUp();
  }
}
```

- [ ] **Step 2: 创建 src/game.ts — 游戏循环 + 放置/引爆逻辑**

```typescript
import * as CANNON from 'cannon-es';
import { applyExplosion, ExplosionConfig } from './physics';

interface PlacedExplosiveData {
  position: CANNON.Vec3;
  type: string;
  config: ExplosionConfig;
}

let placedExplosives: PlacedExplosiveData[] = [];

export function placeExplosive(type: string, position: CANNON.Vec3): void {
  // 简化版：先统一用 TNT 参数
  placedExplosives.push({
    position: position.clone(),
    type,
    config: { position: position.clone(), radius: 8, baseForce: 800 },
  });
}

export function detonateAll(): void {
  for (const exp of placedExplosives) {
    applyExplosion(exp.config);
  }
  placedExplosives = [];
}
```

- [ ] **Step 3: Commit**

```bash
git add src/physics.ts src/game.ts
git commit -m "feat: 添加爆炸冲击波计算逻辑（距离衰减+impulse施加）

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 9: TNT 放置 + 引爆交互

**Files:**
- Modify: `src/main.ts`
- Modify: `src/scene.ts`
- Modify: `src/game.ts`
- Modify: `src/constants.ts`

- [ ] **Step 1: 在 src/constants.ts 追加爆炸物常量**

```typescript
// 爆炸物
export const EXPLOSIVE_RADIUS = 0.3;
export const EXPLOSIVE_HEIGHT = 0.6;
export const EXPLOSIVE_COLORS: Record<string, number> = {
  tnt: 0xcc6600,
  c4: 0x3366cc,
  nitroglycerin: 0x8B4513,
  nuke: 0xcc0000,
};
```

- [ ] **Step 2: 在 src/scene.ts 追加爆炸物放置函数**

```typescript
import * as THREE from 'three';
import { EXPLOSIVE_RADIUS, EXPLOSIVE_HEIGHT, EXPLOSIVE_COLORS } from './constants';

export interface PlacedExplosive {
  mesh: THREE.Mesh;
  position: CANNON.Vec3;
}

export const placedExplosiveMeshes: PlacedExplosive[] = [];

export function createExplosiveMesh(type: string, position: CANNON.Vec3): PlacedExplosive {
  const geo = new THREE.CylinderGeometry(EXPLOSIVE_RADIUS, EXPLOSIVE_RADIUS + 0.1, EXPLOSIVE_HEIGHT, 8);
  const mat = new THREE.MeshToonMaterial({ color: EXPLOSIVE_COLORS[type] || 0xff0000 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(position as any);
  mesh.position.y += EXPLOSIVE_HEIGHT / 2;
  mesh.castShadow = true;
  getScene().add(mesh);

  const exp: PlacedExplosive = { mesh, position: position.clone() };
  placedExplosiveMeshes.push(exp);
  return exp;
}

export function removeAllExplosives(): void {
  for (const exp of placedExplosiveMeshes) {
    getScene().remove(exp.mesh);
    exp.mesh.geometry.dispose();
    (exp.mesh.material as THREE.Material).dispose();
  }
  placedExplosiveMeshes.length = 0;
}
```

- [ ] **Step 3: 更新 src/main.ts — 绑定 Space 键引爆 + 点击放置**

```typescript
import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { placeExplosive, detonateAll } from './game';
import { createExplosiveMesh, removeAllExplosives } from './scene';
import { getScene, getCamera } from './renderer';

// 在 animate 之前添加 raycaster 点击放置逻辑:
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function handleClick(): void {
  if (!input.mouseDown) return;

  mouse.x = (input.mouseX / container.clientWidth) * 2 - 1;
  mouse.y = -(input.mouseY / container.clientHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, getCamera());

  // 检测与地面的交点
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const intersection = new THREE.Vector3();
  raycaster.ray.intersectPlane(groundPlane, intersection);

  if (intersection) {
    const pos = new CANNON.Vec3(intersection.x, 0, intersection.z);
    placeExplosive('tnt', pos);
    createExplosiveMesh('tnt', pos);
  }
}

function animate() {
  requestAnimationFrame(animate);
  updateCamera();

  // 点击放置
  handleClick();
  input.mouseDown = false; // 单次触发

  // 引爆
  if (input.detonate) {
    detonateAll();
    removeAllExplosives();
    input.detonate = false;
  }

  // 重置
  if (input.reset) {
    removeAllExplosives();
    input.reset = false;
  }

  world.step(1 / 60);

  for (const pb of physicsBodies) {
    pb.mesh.position.copy(pb.body.position);
    pb.mesh.quaternion.copy(pb.body.quaternion);
  }

  renderer.render(scene, camera);
}
```

- [ ] **Step 4: 验证 — 点击放置TNT桶，按Space引爆**

```bash
npx vite --host
```
Expected: 点击地面放置橘色TNT桶，按空格引爆后附近建筑受力移动/飞起

- [ ] **Step 5: Commit**

```bash
git add src/constants.ts src/scene.ts src/main.ts src/game.ts
git commit -m "feat: 添加 TNT 放置(点击地面)和引爆(Space)交互

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 10: 爆炸粒子特效 + 火球

**Files:**
- Create: `src/effects.ts`
- Modify: `src/game.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: 创建 src/effects.ts — 粒子系统**

```typescript
import * as THREE from 'three';
import { getScene } from './renderer';

interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
}

let particles: Particle[] = [];

const PARTICLE_GEO = new THREE.SphereGeometry(0.15, 4, 3);
const PARTICLE_COLORS = [0xff4400, 0xff6600, 0xff8800, 0xffaa00, 0x333333];

export function spawnExplosionEffect(position: THREE.Vector3, count: number = 30): void {
  const scene = getScene();

  for (let i = 0; i < count; i++) {
    const color = PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)];
    const mat = new THREE.MeshBasicMaterial({ color });
    const mesh = new THREE.Mesh(PARTICLE_GEO, mat);
    mesh.position.copy(position);

    const speed = 5 + Math.random() * 15;
    const angle = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI * 0.5;
    const velocity = new THREE.Vector3(
      Math.cos(angle) * Math.cos(phi) * speed,
      Math.sin(phi) * speed + 2,
      Math.sin(angle) * Math.cos(phi) * speed,
    );

    const life = 0.5 + Math.random() * 1.5;
    particles.push({ mesh, velocity, life, maxLife: life });
    scene.add(mesh);
  }
}

export function updateParticles(dt: number): void {
  const scene = getScene();

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    p.velocity.y -= 15 * dt; // 重力
    p.mesh.position.add(p.velocity.clone().multiplyScalar(dt));
    p.mesh.scale.setScalar(Math.max(0, p.life / p.maxLife));

    if (p.life <= 0) {
      scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      (p.mesh.material as THREE.Material).dispose();
      particles.splice(i, 1);
    }
  }
}
```

- [ ] **Step 2: 在 src/game.ts 的 detonateAll 中触发粒子特效**

```typescript
import { spawnExplosionEffect } from './effects';
import * as THREE from 'three';

export function detonateAll(): void {
  for (const exp of placedExplosives) {
    applyExplosion(exp);
    spawnExplosionEffect(
      new THREE.Vector3(exp.position.x, 1, exp.position.z),
      40,
    );
  }
  placedExplosives = [];
}
```

- [ ] **Step 3: 在 src/main.ts 的 animate 循环中更新粒子**

```typescript
import { updateParticles } from './effects';

// 在 animate 函数中，world.step(1/60) 之前添加:
let lastTime = performance.now();

function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  updateCamera();
  handleClick();
  updateParticles(dt);
  // ... rest
}
```

- [ ] **Step 4: 验证 — 引爆后看到橙色/黑色粒子飞溅**

```bash
npx vite --host
```

- [ ] **Step 5: Commit**

```bash
git add src/effects.ts src/game.ts src/main.ts
git commit -m "feat: 添加爆炸粒子特效（火球碎片飞溅+重力衰减）

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Phase 3: 完整破坏系统 (Task 11-13)

### Task 11: 建筑碎裂系统 — 大块刚体替换为碎片

**Files:**
- Modify: `src/physics.ts`
- Modify: `src/game.ts`
- Modify: `src/scene.ts`

- [ ] **Step 1: 在 src/physics.ts 追加碎裂函数**

```typescript
export interface DebrisPiece {
  body: CANNON.Body;
  mesh: THREE.Mesh;
  life: number;
}

export function fragmentBuilding(
  body: CANNON.Body,
  mesh: THREE.Mesh,
  physicsBodies: PhysicsBody[],
  debrisList: DebrisPiece[],
  scene: THREE.Scene,
): void {
  const pos = body.position.clone();
  const size = new CANNON.Vec3(0.4, 0.4, 0.4);

  // 把大刚体移除
  world.removeBody(body);
  scene.remove(mesh);
  mesh.geometry.dispose();
  (mesh.material as THREE.Material).dispose();

  // 从 physicsBodies 中移除
  const idx = physicsBodies.findIndex(pb => pb.body === body);
  if (idx >= 0) physicsBodies.splice(idx, 1);

  // 生成碎片
  const pieceCount = 15 + Math.floor(Math.random() * 15);
  for (let i = 0; i < pieceCount; i++) {
    const pieceSize = 0.2 + Math.random() * 0.5;
    const shape = new CANNON.Box(new CANNON.Vec3(pieceSize, pieceSize, pieceSize));
    const pieceBody = new CANNON.Body({ mass: 5 + Math.random() * 10, shape });
    pieceBody.position.set(
      pos.x + (Math.random() - 0.5) * size.x,
      pos.y + (Math.random() - 0.5) * size.y,
      pos.z + (Math.random() - 0.5) * size.z,
    );
    pieceBody.linearDamping = 0.4;
    pieceBody.angularDamping = 0.4;
    world.addBody(pieceBody);

    const pieceGeo = new THREE.BoxGeometry(pieceSize, pieceSize, pieceSize);
    const pieceMat = new THREE.MeshToonMaterial({
      color: (mesh.material as THREE.MeshToonMaterial).color,
    });
    const pieceMesh = new THREE.Mesh(pieceGeo, pieceMat);
    pieceMesh.castShadow = true;
    scene.add(pieceMesh);

    debrisList.push({ body: pieceBody, mesh: pieceMesh, life: 4 });
  }
}
```

- [ ] **Step 2: 在 src/game.ts 的爆炸逻辑中加入碎裂判定**

```typescript
import { fragmentBuilding, DebrisPiece, PhysicsBody } from './physics';
import { spawnExplosionEffect } from './effects';
import * as THREE from 'three';

const FRAGMENT_THRESHOLD = 300;

export function detonateAll(
  physicsBodies: PhysicsBody[],
  debrisList: DebrisPiece[],
  scene: THREE.Scene,
): void {
  for (const exp of placedExplosives) {
    // 爆炸前检测哪些建筑需要碎裂
    for (const pb of physicsBodies) {
      const dist = pb.body.position.distanceTo(exp.config.position);
      if (dist < exp.config.radius) {
        const forceMag = exp.config.baseForce / (1 + (dist * dist) / (exp.config.radius * exp.config.radius));
        if (forceMag > FRAGMENT_THRESHOLD && pb.isBuilding) {
          fragmentBuilding(
            pb.body, pb.mesh as THREE.Mesh,
            physicsBodies, debrisList, scene,
          );
        }
      }
    }

    applyExplosion(exp.config);
    spawnExplosionEffect(
      new THREE.Vector3(exp.config.position.x, 1, exp.config.position.z),
      40,
    );
  }
  placedExplosives = [];
}
```

- [ ] **Step 3: 更新 src/main.ts — 碎片同步 + 生命周期管理**

在 animate 循环中添加碎片同步和回收:

```typescript
// 同步碎片
for (const d of debrisList) {
  d.mesh.position.copy(d.body.position);
  d.mesh.quaternion.copy(d.body.quaternion);
  d.life -= 1 / 60;

  // 碎片减速后回收→缩小消失
  const speed = d.body.velocity.length();
  if (speed < 0.3 || d.life <= 0) {
    // 缩小淡出
    d.mesh.scale.multiplyScalar(0.95);
    if (d.mesh.scale.x < 0.1) {
      world.removeBody(d.body);
      scene.remove(d.mesh);
      d.mesh.geometry.dispose();
      (d.mesh.material as THREE.Material).dispose();
      debrisList.splice(debrisList.indexOf(d), 1);
    }
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/physics.ts src/game.ts src/main.ts
git commit -m "feat: 添加建筑碎裂系统（强冲击下替换为碎片刚体）

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 12: 车辆物理刚体 + 掀翻效果

**Files:**
- Modify: `src/scene.ts`

- [ ] **Step 1: 在 src/scene.ts 的 createVehicles 中添加物理刚体**

```typescript
import { createBuildingBody, PhysicsBody, getWorld } from './physics';
import * as CANNON from 'cannon-es';

// 在 createVehicles 函数中，每个车辆创建后追加:
const vehicleBody = new CANNON.Body({ mass: 200, shape: new CANNON.Box(new CANNON.Vec3(1, 0.7, 0.6)) });
vehicleBody.position.set(pos.x, 0.7, pos.z);
vehicleBody.linearDamping = 0.3;
vehicleBody.angularDamping = 0.3;
getWorld().addBody(vehicleBody);

physicsBodies.push({ body: vehicleBody, mesh: group, isBuilding: false });
```

- [ ] **Step 2: 验证 — 引爆后车辆被掀翻飞起**

```bash
npx vite --host
```
Expected: 点击放置TNT靠近车辆，按Space引爆后车辆飞起翻转

- [ ] **Step 3: Commit**

```bash
git add src/scene.ts
git commit -m "feat: 车辆添加物理刚体，支持爆炸掀翻效果

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 13: 原子弹蘑菇云特效

**Files:**
- Modify: `src/effects.ts`
- Modify: `src/constants.ts`

- [ ] **Step 1: 在 src/effects.ts 追加蘑菇云生成函数**

```typescript
export function spawnMushroomCloud(position: THREE.Vector3): void {
  const scene = getScene();

  // 1. 白色闪光 — 全屏白 overlay（在 main.ts 中处理）
  // 2. 火球 — 半球 scale 动画
  const fireballGeo = new THREE.SphereGeometry(1, 16, 8);
  const fireballMat = new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 1 });
  const fireball = new THREE.Mesh(fireballGeo, fireballMat);
  fireball.position.copy(position);
  fireball.position.y += 2;
  scene.add(fireball);

  // 3. 蘑菇云茎 — 圆柱 scale 动画
  const stemGeo = new THREE.CylinderGeometry(0.5, 1, 3, 8);
  const stemMat = new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.8 });
  const stem = new THREE.Mesh(stemGeo, stemMat);
  stem.position.copy(position);
  stem.position.y += 4;
  scene.add(stem);

  // 4. 烟尘环
  const ringGeo = new THREE.TorusGeometry(2, 0.5, 8, 16);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x666666, transparent: true, opacity: 0.6 });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.copy(position);
  ring.position.y += 5;
  scene.add(ring);

  // 动画
  let elapsed = 0;
  const duration = 3;

  function animateMushroom(dt: number): boolean {
    elapsed += dt;
    const t = elapsed / duration;

    fireball.scale.setScalar(1 + t * 10);
    fireballMat.opacity = Math.max(0, 1 - t * 1.5);
    fireball.position.y += dt * 5;

    stem.scale.setScalar(1 + t * 3);
    stemMat.opacity = Math.max(0, 0.8 - t);
    stem.position.y += dt * 3;

    ring.scale.setScalar(1 + t * 8);
    ringMat.opacity = Math.max(0, 0.6 - t);

    if (elapsed >= duration) {
      scene.remove(fireball);
      scene.remove(stem);
      scene.remove(ring);
      fireballGeo.dispose();
      fireballMat.dispose();
      stemGeo.dispose();
      stemMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      return false;
    }
    return true;
  }

  // 注册动画
  activeAnimations.push(animateMushroom);
}

const activeAnimations: Array<(dt: number) => boolean> = [];

export function updateEffects(dt: number): void {
  updateParticles(dt);
  for (let i = activeAnimations.length - 1; i >= 0; i--) {
    if (!activeAnimations[i](dt)) {
      activeAnimations.splice(i, 1);
    }
  }
}
```

- [ ] **Step 2: 在 src/game.ts 中为原子弹类型的爆炸调用蘑菇云**

```typescript
// 在 detonateAll 中，如果爆炸物类型是 nuke:
if (exp.type === 'nuke') {
  spawnMushroomCloud(new THREE.Vector3(exp.position.x, 0, exp.position.z));
}
```

- [ ] **Step 3: Commit**

```bash
git add src/effects.ts src/game.ts
git commit -m "feat: 添加原子弹蘑菇云特效（火球膨胀+烟尘环扩散）

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Phase 4: UI 叠加层 + 游戏模式 (Task 14-17)

### Task 14: DOM UI — 顶部状态栏 + 底部工具栏

**Files:**
- Create: `src/ui.ts`
- Modify: `src/main.ts`
- Modify: `index.html`

- [ ] **Step 1: 创建 src/ui.ts**

```typescript
export interface UIState {
  selectedExplosive: string;
  quantities: Record<string, number>;
  score: number;
  objective: string;
  mode: 'sandbox' | 'level';
}

export function createUI(container: HTMLElement): UIState {
  const state: UIState = {
    selectedExplosive: 'tnt',
    quantities: { tnt: Infinity, c4: 5, nitroglycerin: 3, nuke: 1 },
    score: 0,
    objective: '',
    mode: 'sandbox',
  };

  // 顶部状态栏
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
    <span id="objective-text"></span>
    <span id="score-text">得分: 0</span>
  `;
  container.appendChild(topBar);

  // 底部工具栏
  const bottomBar = document.createElement('div');
  bottomBar.id = 'bottom-bar';
  bottomBar.style.cssText = `
    position: absolute; bottom: 0; left: 0; right: 0;
    display: flex; justify-content: center; align-items: center; gap: 12px;
    padding: 12px 16px; background: rgba(0,0,0,0.6); z-index: 10;
  `;

  const explosiveTypes = [
    { id: 'nitroglycerin', label: '硝酸甘油', color: '#8B4513' },
    { id: 'tnt', label: 'TNT', color: '#cc6600' },
    { id: 'c4', label: 'C4', color: '#3366cc' },
    { id: 'nuke', label: '原子弹', color: '#cc0000' },
  ];

  explosiveTypes.forEach(({ id, label, color }) => {
    const card = document.createElement('div');
    card.className = 'explosive-card';
    card.dataset.type = id;
    card.style.cssText = `
      padding: 8px 16px; background: ${color}; color: #fff;
      border-radius: 8px; cursor: pointer; font-size: 14px;
      font-weight: bold; user-select: none;
      transition: transform 0.1s, box-shadow 0.1s;
      border: 2px solid transparent;
    `;
    card.textContent = `${label} x∞`;
    card.addEventListener('click', () => {
      state.selectedExplosive = id;
      document.querySelectorAll('.explosive-card').forEach(c => {
        (c as HTMLElement).style.borderColor = 'transparent';
      });
      card.style.borderColor = '#fff';
    });
    bottomBar.appendChild(card);
  });

  // 分隔符
  const sep = document.createElement('span');
  sep.style.cssText = 'color: #666; margin: 0 8px;';
  sep.textContent = '|';
  bottomBar.appendChild(sep);

  // 引爆按钮
  const detonateBtn = document.createElement('button');
  detonateBtn.textContent = '引爆';
  detonateBtn.style.cssText = `
    padding: 10px 24px; background: #ff5722; color: #fff;
    border: none; border-radius: 8px; font-size: 16px;
    font-weight: bold; cursor: pointer;
    transition: transform 0.1s;
  `;
  detonateBtn.addEventListener('click', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
  });
  bottomBar.appendChild(detonateBtn);

  // 重置按钮
  const resetBtn = document.createElement('button');
  resetBtn.textContent = '重置';
  resetBtn.style.cssText = `
    padding: 10px 20px; background: #555; color: #fff;
    border: none; border-radius: 8px; font-size: 14px;
    cursor: pointer;
  `;
  resetBtn.addEventListener('click', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'r' }));
  });
  bottomBar.appendChild(resetBtn);

  container.appendChild(bottomBar);

  // 默认选中 TNT
  const defaultCard = bottomBar.querySelector('[data-type="tnt"]') as HTMLElement;
  if (defaultCard) defaultCard.style.borderColor = '#fff';

  return state;
}

export function updateUI(container: HTMLElement, state: UIState): void {
  const infoEl = container.querySelector('#explosive-info');
  if (infoEl) infoEl.textContent = `当前: ${state.selectedExplosive.toUpperCase()}`;
}
```

- [ ] **Step 2: 更新 src/main.ts 调用 UI**

```typescript
import { createUI, updateUI } from './ui';

const uiState = createUI(container);

function animate() {
  // ... existing code ...
  updateUI(container, uiState);
}
```

- [ ] **Step 3: 验证 — 顶部状态栏 + 底部工具栏可见**

```bash
npx vite --host
```
Expected: 看到顶部状态栏和底部工具栏，点击卡片可切换选中状态

- [ ] **Step 4: Commit**

```bash
git add src/ui.ts src/main.ts
git commit -m "feat: 添加 DOM UI 叠加层（顶部状态栏+底部工具栏）

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 15: 拖拽放置爆炸物

**Files:**
- Modify: `src/ui.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: 在 src/ui.ts 的卡片创建逻辑中添加拖拽支持**

在每个卡片的创建代码中追加:

```typescript
card.draggable = true;
card.addEventListener('dragstart', (e) => {
  e.dataTransfer!.setData('text/plain', id);
  card.style.opacity = '0.5';
});
card.addEventListener('dragend', () => {
  card.style.opacity = '1';
});
```

- [ ] **Step 2: 在 src/main.ts 中处理 drop 事件**

```typescript
// 在 setupInput 调用之后添加:
container.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.dataTransfer!.dropEffect = 'move';
});

container.addEventListener('drop', (e) => {
  e.preventDefault();
  const type = e.dataTransfer!.getData('text/plain');
  if (!type) return;

  // 将屏幕坐标转换为场景坐标
  const rect = container.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(x, y), getCamera());
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const intersection = new THREE.Vector3();
  raycaster.ray.intersectPlane(groundPlane, intersection);

  if (intersection) {
    const pos = new CANNON.Vec3(intersection.x, 0, intersection.z);
    placeExplosive(type, pos);
    createExplosiveMesh(type, pos);
  }
});
```

- [ ] **Step 3: 验证 — 从工具栏拖拽爆炸物卡片到场景中放置**

```bash
npx vite --host
```

- [ ] **Step 4: Commit**

```bash
git add src/ui.ts src/main.ts
git commit -m "feat: 添加拖拽放置爆炸物交互

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 16: 四种爆炸物完整实现

**Files:**
- Modify: `src/constants.ts`
- Modify: `src/game.ts`
- Modify: `src/scene.ts`

- [ ] **Step 1: 在 src/constants.ts 定义爆炸物属性表**

```typescript
export interface ExplosiveDef {
  radius: number;
  baseForce: number;
  color: number;
  label: string;
}

export const EXPLOSIVE_DEFS: Record<string, ExplosiveDef> = {
  nitroglycerin: { radius: 3, baseForce: 500, color: 0x8B4513, label: '硝酸甘油' },
  tnt: { radius: 8, baseForce: 800, color: 0xcc6600, label: 'TNT' },
  c4: { radius: 6, baseForce: 1200, color: 0x3366cc, label: 'C4' },
  nuke: { radius: 30, baseForce: 3000, color: 0xcc0000, label: '原子弹' },
};
```

- [ ] **Step 2: 更新 src/game.ts 的 placeExplosive — 根据类型读取参数**

```typescript
import { EXPLOSIVE_DEFS, ExplosiveDef } from './constants';

interface PlacedExplosiveData {
  position: CANNON.Vec3;
  type: string;
  def: ExplosiveDef;
}

let placedExplosives: PlacedExplosiveData[] = [];

export function placeExplosive(type: string, position: CANNON.Vec3): void {
  const def = EXPLOSIVE_DEFS[type];
  if (!def) return;
  placedExplosives.push({ position: position.clone(), type, def });
}

export function detonateAll(/* ... */): void {
  for (const exp of placedExplosives) {
    // 应用对应爆炸物的参数
    applyExplosion({
      position: exp.position,
      radius: exp.def.radius,
      baseForce: exp.def.baseForce,
    });
    // ... 特效 ...
  }
}
```

- [ ] **Step 3: 更新 src/scene.ts 的 createExplosiveMesh — 按类型渲染不同颜色**

```typescript
export function createExplosiveMesh(type: string, position: CANNON.Vec3): PlacedExplosive {
  const def = EXPLOSIVE_DEFS[type];
  const geo = new THREE.CylinderGeometry(EXPLOSIVE_RADIUS, EXPLOSIVE_RADIUS + 0.1, EXPLOSIVE_HEIGHT, 8);
  const mat = new THREE.MeshToonMaterial({ color: def?.color ?? 0xff0000 });
  // ... rest unchanged
}
```

- [ ] **Step 4: 验证 — 选择不同爆炸物放置并引爆，观察不同的爆炸半径/威力**

```bash
npx vite --host
```

- [ ] **Step 5: Commit**

```bash
git add src/constants.ts src/game.ts src/scene.ts
git commit -m "feat: 实现四种爆炸物（硝酸甘油/TNT/C4/原子弹）的不同参数

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 17: 游戏模式 — 沙盒模式 + 关卡模式基础

**Files:**
- Modify: `src/game.ts`
- Modify: `src/ui.ts`

- [ ] **Step 1: 在 src/game.ts 添加模式切换和关卡逻辑**

```typescript
export type GameMode = 'sandbox' | 'level';

export interface LevelConfig {
  name: string;
  explosives: Record<string, number>;
  objective: string;
}

const LEVELS: LevelConfig[] = [
  {
    name: '第一关',
    explosives: { tnt: 3, c4: 1 },
    objective: '摧毁红色建筑',
  },
  {
    name: '第二关',
    explosives: { tnt: 2, c4: 2, nitroglycerin: 2 },
    objective: '清空区域',
  },
];

let currentMode: GameMode = 'sandbox';
let currentLevel = 0;
let remainingExplosives: Record<string, number> = {};

export function setMode(mode: GameMode): void {
  currentMode = mode;
  if (mode === 'sandbox') {
    remainingExplosives = { tnt: Infinity, c4: Infinity, nitroglycerin: Infinity, nuke: Infinity };
  } else {
    currentLevel = 0;
    loadLevel(currentLevel);
  }
}

function loadLevel(index: number): void {
  const level = LEVELS[index];
  remainingExplosives = { ...level.explosives };
}

export function canPlace(type: string): boolean {
  if (currentMode === 'sandbox') return true;
  return (remainingExplosives[type] ?? 0) > 0;
}

export function consumeExplosive(type: string): void {
  if (currentMode === 'sandbox') return;
  if (remainingExplosives[type] && remainingExplosives[type] > 0) {
    remainingExplosives[type]--;
  }
}

export function getMode(): GameMode { return currentMode; }
export function getRemaining(): Record<string, number> { return { ...remainingExplosives }; }
export function getCurrentLevel(): LevelConfig | null {
  return currentMode === 'level' ? LEVELS[currentLevel] : null;
}
```

- [ ] **Step 2: 在 UI 中加入模式切换按钮**

在 `src/ui.ts` 的 bottomBar 创建逻辑中追加:

```typescript
const modeBtn = document.createElement('button');
modeBtn.textContent = '沙盒';
modeBtn.style.cssText = `
  padding: 8px 16px; background: #4caf50; color: #fff;
  border: none; border-radius: 6px; cursor: pointer;
`;
modeBtn.addEventListener('click', () => {
  // toggle mode
});
```

- [ ] **Step 3: Commit**

```bash
git add src/game.ts src/ui.ts
git commit -m "feat: 添加沙盒/关卡双模式及关卡配置

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## 验证清单

每个 Phase 完成后运行:

```bash
npx tsc --noEmit   # TypeScript 类型检查
npx vite build      # 确保构建成功
npx vite --host     # 在浏览器中手动验证交互
```

---

## Phase 依赖关系

```
Phase 1 (Task 1-6)  ──► Phase 2 (Task 7-10)  ──► Phase 3 (Task 11-13)  ──► Phase 4 (Task 14-17)
   静态场景               物理+基础爆炸              完整破坏系统              UI+游戏模式
```

每个 Phase 内部 Task 必须按顺序执行。Phase 之间必须按顺序执行。
