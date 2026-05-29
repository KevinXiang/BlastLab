import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { initRenderer, getCamera, getScene, renderWithDistortion, setBlackHoleDistortion } from './renderer';
import { createScene, physicsBodies, createExplosiveMesh, removeAllExplosives, createSingleBuilding, createSingleVehicle, createSingleTree, createSandbag, createBarricade, createMineModel, createRemoteBombModel } from './scene';
import { initPhysics, DebrisPiece } from './physics';
import { placeExplosive, detonateAll, placeRemoteBomb, detonateGroup, updateMines, placeMine, clearRemoteBombs, clearMines, clearPlacedExplosives, scoreState, loadHighScore, resetScore, addChainScore, updateBlackHolePhysics } from './game';
import { updateEffects, spawnIncendiaryEffect, spawnSmokeEffect, spawnFlashEffect, spawnTntEffect, sprayFlameEffect, sprayIceEffect, sprayParticleEffect, getScreenFlash, igniteObject, activeBlackHoleStates } from './effects';
import { createUI, updateUI, showFloatText } from './ui';
import { createInputState, setupInput } from './input';
import { createWeaponPanel, WeaponPanelState } from './weaponpanel';
import {
  CAMERA_ZOOM, CAMERA_MIN_ZOOM, CAMERA_MAX_ZOOM,
  CAMERA_ORBIT_DISTANCE, CAMERA_ELEVATION,
  CAMERA_ROTATE_SPEED, CAMERA_ZOOM_SPEED,
  CAMERA_DRAG_SENSITIVITY, CAMERA_SCROLL_SENSITIVITY,
  SPRAY_FLAME_RANGE, SPRAY_FLAME_FORCE,
  SPRAY_ICE_RANGE, SPRAY_ICE_SLOW_FACTOR,
  SPRAY_PARTICLE_RANGE, SPRAY_PARTICLE_FORCE,
} from './constants';

const container = document.getElementById('app')!;
const { camera, renderer, scene } = initRenderer(container);

const world = initPhysics();

createScene();

loadHighScore();

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

  const type = panelState.selectedType || uiState.selectedExplosive;

  // Spray weapons are handled continuously in animate(), not on click
  if (isSprayType(type)) return;

  mouse.x = (input.mouseX / container.clientWidth) * 2 - 1;
  mouse.y = -(input.mouseY / container.clientHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, getCamera());

  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const intersection = new THREE.Vector3();
  raycaster.ray.intersectPlane(groundPlane, intersection);

  if (intersection) {
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
  resetScore();
  for (const d of debrisList) {
    world.removeBody(d.body);
    scene.remove(d.mesh);
    d.mesh.geometry.dispose();
    (d.mesh.material as THREE.Material).dispose();
  }
  debrisList.length = 0;
});

const debrisList: DebrisPiece[] = [];
let lastTime = performance.now();

let placedCount = 0;

function placeItem(type: string, x: number, z: number): void {
  if (isSprayType(type)) return;

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
    case 'cluster':
      placeExplosive('cluster', pos);
      createExplosiveMesh('cluster', pos);
      break;
    case 'blackhole':
      placeExplosive('blackhole', pos);
      createExplosiveMesh('blackhole', pos);
      break;
    case 'emp':
      placeExplosive('emp', pos);
      createExplosiveMesh('emp', pos);
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
}

function getSelectedType(): string {
  return panelState.selectedType || uiState.selectedExplosive;
}

function isSprayType(type: string): boolean {
  return type === 'flamethrower' || type === 'ice_spray' || type === 'particle_spray';
}

let shakeAmount = 0;
let shakeDuration = 0;

function addScreenShake(intensity: number, duration: number): void {
  shakeAmount = Math.max(shakeAmount, intensity);
  shakeDuration = Math.max(shakeDuration, duration);
}

// Track per-body spray exposure time for threshold effects
const sprayExposure = new Map<number, { time: number; mode: string }>();

function getBodyKey(pb: { body: CANNON.Body }): number {
  return pb.body.id;
}

function applySprayForce(origin: THREE.Vector3, direction: THREE.Vector3, range: number, force: number, dt: number, mode: 'burn' | 'freeze' | 'push'): void {
  const exposedIds = new Set<number>();

  for (const pb of physicsBodies) {
    if (pb.body.mass === 0) continue;
    const p = new THREE.Vector3(pb.body.position.x, pb.body.position.y, pb.body.position.z);
    const toTarget = p.clone().sub(origin);
    const dist = toTarget.length();
    if (dist > range) continue;
    const toTargetNorm = toTarget.normalize();
    const dot = toTargetNorm.dot(direction);
    if (dot < 0.7) continue;

    const key = getBodyKey(pb);
    exposedIds.add(key);

    if (mode === 'freeze') {
      pb.body.velocity.scale(1 - (1 - force) * dt * (1 - dist / range), pb.body.velocity);
      // Accumulate exposure for ice effect
      const exp = sprayExposure.get(key) || { time: 0, mode: 'freeze' };
      exp.time += dt;
      sprayExposure.set(key, exp);
      // Freeze building after 1.5s exposure
      if (exp.time > 1.5 && pb.isBuilding) {
        freezeBuilding(pb);
      }
    } else if (mode === 'burn') {
      const impulse = direction.clone().multiplyScalar(force * dt * (1 - dist / range));
      pb.body.applyImpulse(new CANNON.Vec3(impulse.x, impulse.y, impulse.z), pb.body.position);
      // Accumulate exposure for burn effect
      const exp = sprayExposure.get(key) || { time: 0, mode: 'burn' };
      exp.time += dt;
      sprayExposure.set(key, exp);
      // Ignite building/tree after 2s exposure
      if (exp.time > 2 && (pb.isBuilding || pb.isTree)) {
        igniteObject(pb, [0xff4400, 0xff6600, 0xff8800, 0xffaa00, 0xff2200]);
        sprayExposure.delete(key);
        scoreState.totalScore += 150;
      }
    } else {
      // Push — strong force + damage
      const impulse = direction.clone().multiplyScalar(force * dt * (1 - dist / range));
      pb.body.applyImpulse(new CANNON.Vec3(impulse.x, impulse.y, impulse.z), pb.body.position);
      const exp = sprayExposure.get(key) || { time: 0, mode: 'push' };
      exp.time += dt;
      sprayExposure.set(key, exp);
      // Disintegrate building after 1.5s exposure
      if (exp.time > 1.5 && pb.isBuilding) {
        fragmentBuildingBySpray(pb);
        sprayExposure.delete(key);
        scoreState.totalScore += 300;
      }
    }
  }

  // Clean up exposure for bodies no longer in spray cone
  for (const [key, exp] of sprayExposure) {
    if (!exposedIds.has(key)) {
      sprayExposure.delete(key);
    }
  }
}

function freezeBuilding(pb: { mesh: THREE.Mesh | THREE.Group; body: CANNON.Body }): void {
  pb.mesh.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const mat = child.material as THREE.MeshToonMaterial;
      if (mat.color) {
        mat.color.setHex(0xaaccff);
      }
    }
  });
  pb.body.mass *= 0.5;
  pb.body.linearDamping = 0.9;
}

function fragmentBuildingBySpray(pb: { body: CANNON.Body; mesh: THREE.Mesh | THREE.Group; isBuilding?: boolean }): void {
  // Mark as building for fragmentBuilding
  pb.isBuilding = true;
  // Directly remove the body from physics and mesh from scene as "disintegration"
  const scene = getScene();
  const world = (pb.body as any).world;
  if (world) world.removeBody(pb.body);
  scene.remove(pb.mesh);
  pb.mesh.traverse((c) => {
    if (c instanceof THREE.Mesh) { c.geometry.dispose(); (c.material as THREE.Material).dispose(); }
  });
  // Remove from physicsBodies
  const idx = physicsBodies.indexOf(pb as any);
  if (idx !== -1) physicsBodies.splice(idx, 1);
}

function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  updateCamera(dt);
  handleClick();
  updateUI(container, uiState);

  // Screen shake
  if (shakeDuration > 0) {
    shakeDuration -= dt;
    const cam = getCamera();
    cam.position.x += (Math.random() - 0.5) * shakeAmount * 0.1;
    cam.position.y += (Math.random() - 0.5) * shakeAmount * 0.1;
    if (shakeDuration <= 0) shakeAmount = 0;
  }

  // Spray weapons
  const selectedType = getSelectedType();
  input.spraying = input.mouseDown && isSprayType(selectedType);
  if (input.spraying) {
    const cam = getCamera();
    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    dir.y = 0; dir.normalize();
    const intersection = getGroundIntersection(input.mouseX, input.mouseY);
    if (intersection) {
      const origin = intersection.clone().add(new THREE.Vector3(0, 1.5, 0));
      switch (selectedType) {
        case 'flamethrower':
          sprayFlameEffect(origin, dir, dt);
          applySprayForce(origin, dir, SPRAY_FLAME_RANGE, SPRAY_FLAME_FORCE, dt, 'burn');
          break;
        case 'ice_spray':
          sprayIceEffect(origin, dir, dt);
          applySprayForce(origin, dir, SPRAY_ICE_RANGE, SPRAY_ICE_SLOW_FACTOR, dt, 'freeze');
          break;
        case 'particle_spray':
          sprayParticleEffect(origin, dir, dt);
          applySprayForce(origin, dir, SPRAY_PARTICLE_RANGE, SPRAY_PARTICLE_FORCE, dt, 'push');
          break;
      }
    }
  }

  // Screen flash (EMP)
  const flash = getScreenFlash();
  if (flash > 0.01) {
    let flashEl = document.getElementById('emp-flash');
    if (!flashEl) {
      flashEl = document.createElement('div');
      flashEl.id = 'emp-flash';
      flashEl.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;background:white;pointer-events:none;z-index:15;';
      container.appendChild(flashEl);
    }
    flashEl.style.opacity = String(flash * 0.4);
    if (flash < 0.02) flashEl.style.opacity = '0';
  }

  // Black hole physics
  updateBlackHolePhysics(dt);

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
    if (scoreState.lastScore && scoreState.lastScorePosition) {
      const cam = getCamera();
      const screenPos = scoreState.lastScorePosition.clone().project(cam);
      const sx = (screenPos.x * 0.5 + 0.5) * container.clientWidth;
      const sy = (-screenPos.y * 0.5 + 0.5) * container.clientHeight;
      const b = scoreState.lastScore;
      const total = b.destroyScore + b.impactScore + b.chainScore;
      if (total > 0) {
        showFloatText(container, total, b.destroyScore, b.impactScore, b.chainScore, sx, sy);
      }
    }
    addScreenShake(6, 0.6);
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

    if (d.body.velocity.length() > 8) {
      for (const pb of physicsBodies) {
        if (!pb.isBuilding) continue;
        const dist = d.body.position.distanceTo(pb.body.position);
        if (dist < 2.5) {
          const impactForce = d.body.velocity.length() * d.body.mass;
          if (impactForce > 300) {
            const dir = new CANNON.Vec3(d.body.position.x - pb.body.position.x, 0.1, d.body.position.z - pb.body.position.z);
            dir.normalize();
            pb.body.applyImpulse(dir.scale(impactForce * 0.3), pb.body.position);
            addChainScore();
          }
        }
      }
    }

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

  // Black hole distortion
  const activeBH = activeBlackHoleStates.find(bh => bh.active);
  if (activeBH) {
    setBlackHoleDistortion(activeBH.worldPos, 5);
  } else {
    setBlackHoleDistortion(null, 0);
  }

  renderWithDistortion();
}

animate();
