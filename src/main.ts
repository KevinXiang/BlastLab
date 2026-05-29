import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { initRenderer, getCamera, getScene } from './renderer';
import { createScene, physicsBodies, createExplosiveMesh, removeAllExplosives, createSingleBuilding, createSingleVehicle, createSingleTree, createSandbag, createBarricade, createMineModel, createRemoteBombModel, clearScene, buildFromLayout, createVehicles, createDecorations } from './scene';
import { initPhysics, DebrisPiece } from './physics';
import { placeExplosive, detonateAll, placeRemoteBomb, detonateGroup, updateMines, placeMine, clearRemoteBombs, clearMines, clearPlacedExplosives } from './game';
import { updateEffects, spawnIncendiaryEffect, spawnSmokeEffect, spawnFlashEffect, spawnTntEffect } from './effects';
import { createUI, updateUI, showResultPopup } from './ui';
import { createInputState, setupInput } from './input';
import { createWeaponPanel, WeaponPanelState } from './weaponpanel';
import {
  CAMERA_ZOOM, CAMERA_MIN_ZOOM, CAMERA_MAX_ZOOM,
  CAMERA_ORBIT_DISTANCE, CAMERA_ELEVATION,
  CAMERA_ROTATE_SPEED, CAMERA_ZOOM_SPEED,
  CAMERA_DRAG_SENSITIVITY, CAMERA_SCROLL_SENSITIVITY,
} from './constants';
import { setDestroyCallback } from './destruction';
import { initLevelSystem, startLevel, updateLevelTimer, checkObjectives, checkFailCondition, getPhase, getLevelState, recordSkip, returnToMenu, canPlace, consumeWeapon, isWeaponRestricted, LEVELS, getProgress } from './level';

const container = document.getElementById('app')!;
const { camera, renderer, scene } = initRenderer(container);

const world = initPhysics();

createScene();

initLevelSystem();

const input = createInputState();
setupInput(input, renderer.domElement);

const uiState = createUI(container);
const panelState = createWeaponPanel(container);

let cameraAngle = Math.PI / 4;
let zoomLevel = CAMERA_ZOOM;
let prevMouseX = 0;

function updateCamera(dt: number): void {
  if (input.rightMouseDown) {
    const dx = input.mouseX - prevMouseX;
    cameraAngle += dx * CAMERA_DRAG_SENSITIVITY * dt;
  }

  if (input.rotateLeft) cameraAngle += CAMERA_ROTATE_SPEED * dt;
  if (input.rotateRight) cameraAngle -= CAMERA_ROTATE_SPEED * dt;

  if (input.scrollDelta !== 0) {
    zoomLevel += input.scrollDelta * CAMERA_SCROLL_SENSITIVITY * dt;
    zoomLevel = Math.max(CAMERA_MIN_ZOOM, Math.min(CAMERA_MAX_ZOOM, zoomLevel));
    input.scrollDelta = 0;
  }
  if (input.zoomIn) zoomLevel -= CAMERA_ZOOM_SPEED * dt;
  if (input.zoomOut) zoomLevel += CAMERA_ZOOM_SPEED * dt;
  zoomLevel = Math.max(CAMERA_MIN_ZOOM, Math.min(CAMERA_MAX_ZOOM, zoomLevel));

  const height = CAMERA_ORBIT_DISTANCE * Math.sin(CAMERA_ELEVATION);
  const horizontal = CAMERA_ORBIT_DISTANCE * Math.cos(CAMERA_ELEVATION);
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
}

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function getGroundIntersection(clientX: number, clientY: number): THREE.Vector3 | null {
  const rect = container.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * 2 - 1;
  const y = -((clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(new THREE.Vector2(x, y), getCamera());
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const intersection = new THREE.Vector3();
  if (raycaster.ray.intersectPlane(groundPlane, intersection)) {
    return intersection;
  }
  return null;
}

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

container.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.dataTransfer!.dropEffect = 'move';
});

container.addEventListener('drop', (e) => {
  e.preventDefault();
  const type = e.dataTransfer!.getData('text/plain');
  if (!type) return;
  const intersection = getGroundIntersection(e.clientX, e.clientY);
  if (!intersection) return;
  placeItem(type, intersection.x, intersection.z);
});

window.addEventListener('game-detonate', () => {
  input.detonate = true;
});

window.addEventListener('game-reset', () => {
  removeAllExplosives();
  clearPlacedExplosives();
  clearRemoteBombs();
  clearMines();
  for (const d of debrisList) {
    world.removeBody(d.body);
    scene.remove(d.mesh);
    d.mesh.geometry.dispose();
    (d.mesh.material as THREE.Material).dispose();
  }
  debrisList.length = 0;
});

setDestroyCallback((type, id) => {
  const ls = getLevelState();
  if (ls && getPhase() === 'playing') {
    ls.destroyedObjectIds.add(id);
  }
});

window.addEventListener('level-start', ((e: CustomEvent) => {
  const id = e.detail.id;
  clearScene();
  for (const d of debrisList) {
    world.removeBody(d.body);
    scene.remove(d.mesh);
    d.mesh.geometry.dispose();
    (d.mesh.material as THREE.Material).dispose();
  }
  debrisList.length = 0;
  resultPopupShown = false;

  const config = startLevel(id);
  if (config) {
    buildFromLayout(config.buildings);
    createVehicles();
    createDecorations();
  }
}) as EventListener);

const debrisList: DebrisPiece[] = [];
let lastTime = performance.now();

let placedCount = 0;

function placeItem(type: string, x: number, z: number): void {
  if (isWeaponRestricted(type)) return;
  if (!canPlace(type)) return;

  const pos = new CANNON.Vec3(x, 0, z);
  const pos3 = new THREE.Vector3(x, 1, z);

  switch (type) {
    case 'tnt':
    case 'c4':
    case 'nitroglycerin':
    case 'nuke':
      placeExplosive(type, pos);
      createExplosiveMesh(type, pos);
      break;
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
    case 'incendiary': spawnIncendiaryEffect(pos3, physicsBodies); break;
    case 'smoke': spawnSmokeEffect(pos3); break;
    case 'flash': spawnFlashEffect(pos3); break;
    case 'building': createSingleBuilding(x, z); break;
    case 'vehicle': createSingleVehicle(x, z); break;
    case 'tree': createSingleTree(x, z); break;
    case 'sandbag': createSandbag(x, z); break;
    case 'barricade': createBarricade(x, z); break;
  }

  consumeWeapon(type);
}

let resultPopupShown = false;

function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  updateCamera(dt);
  handleClick();
  updateUI(container, uiState);

  // Level mode lifecycle
  const phase = getPhase();
  if (phase === 'playing') {
    updateLevelTimer(dt);
    checkObjectives();
    checkFailCondition();
  }

  // Result popup (only once per state transition)
  const newPhase = getPhase();
  if ((newPhase === 'complete' || newPhase === 'failed') && !resultPopupShown) {
    resultPopupShown = true;
    const ls = getLevelState();
    if (ls) {
      const isComplete = newPhase === 'complete';
      const progress = getProgress();
      const record = progress.records[ls.config.id];
      const canSkip = (record?.failCount ?? 0) >= 5;

      showResultPopup(
        container,
        isComplete,
        isComplete && ls.config.id < LEVELS.length ? () => {
          clearScene();
          for (const d of debrisList) {
            world.removeBody(d.body);
            scene.remove(d.mesh);
            d.mesh.geometry.dispose();
            (d.mesh.material as THREE.Material).dispose();
          }
          debrisList.length = 0;
          resultPopupShown = false;
          const next = startLevel(ls.config.id + 1);
          if (next) {
            buildFromLayout(next.buildings);
            createVehicles();
            createDecorations();
          }
        } : null,
        () => {
          clearScene();
          for (const d of debrisList) {
            world.removeBody(d.body);
            scene.remove(d.mesh);
            d.mesh.geometry.dispose();
            (d.mesh.material as THREE.Material).dispose();
          }
          debrisList.length = 0;
          resultPopupShown = false;
          const config = startLevel(ls.config.id);
          if (config) {
            buildFromLayout(config.buildings);
            createVehicles();
            createDecorations();
          }
        },
        () => {
          returnToMenu();
          clearScene();
          for (const d of debrisList) {
            world.removeBody(d.body);
            scene.remove(d.mesh);
            d.mesh.geometry.dispose();
            (d.mesh.material as THREE.Material).dispose();
          }
          debrisList.length = 0;
          resultPopupShown = false;
          createScene();
        },
        canSkip ? () => { recordSkip(); returnToMenu(); } : null,
      );
    }
  }

  // Panel toggle
  if (input.togglePanel) {
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

  if (input.detonate) {
    detonateAll(physicsBodies, debrisList, scene);
    removeAllExplosives();
    input.detonate = false;
  }

  if (input.reset) {
    removeAllExplosives();
    input.reset = false;
  }

  world.step(1 / 60);

  updateEffects(dt);

  for (const pb of physicsBodies) {
    pb.mesh.position.copy(pb.body.position as any);
    pb.mesh.quaternion.copy(pb.body.quaternion as any);
  }

  for (const d of debrisList) {
    d.mesh.position.copy(d.body.position as any);
    d.mesh.quaternion.copy(d.body.quaternion as any);
    d.life -= dt;

    const speed = d.body.velocity.length();
    if (speed < 0.3 || d.life <= 0) {
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

  renderer.render(scene, camera);
}

animate();
