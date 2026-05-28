import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { initRenderer, getCamera } from './renderer';
import { createScene, physicsBodies, createExplosiveMesh, removeAllExplosives, createSingleBuilding, createSingleVehicle, createSingleTree } from './scene';
import { initPhysics, DebrisPiece } from './physics';
import { placeExplosive, detonateAll } from './game';
import { updateEffects } from './effects';
import { createUI, updateUI } from './ui';
import { createInputState, setupInput } from './input';
import {
  CAMERA_ZOOM, CAMERA_MIN_ZOOM, CAMERA_MAX_ZOOM,
  CAMERA_ORBIT_DISTANCE, CAMERA_ELEVATION,
  CAMERA_ROTATE_SPEED, CAMERA_ZOOM_SPEED,
  CAMERA_DRAG_SENSITIVITY, CAMERA_SCROLL_SENSITIVITY,
} from './constants';

const container = document.getElementById('app')!;
const { camera, renderer, scene } = initRenderer(container);

const world = initPhysics();

createScene();

const input = createInputState();
setupInput(input, renderer.domElement);

const uiState = createUI(container);

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
    const pos = new CANNON.Vec3(intersection.x, 0, intersection.z);
    if (uiState.selectedConstruct) {
      placeConstruct(uiState.selectedConstruct, intersection.x, intersection.z);
    } else {
      placeExplosive(uiState.selectedExplosive, pos);
      createExplosiveMesh(uiState.selectedExplosive, pos);
    }
  }

  input.mouseDown = false;
}

container.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.dataTransfer!.dropEffect = 'move';
});

container.addEventListener('drop', (e) => {
  e.preventDefault();
  const data = e.dataTransfer!.getData('text/plain');
  if (!data) return;

  const intersection = getGroundIntersection(e.clientX, e.clientY);
  if (!intersection) return;

  if (data.startsWith('construct:')) {
    placeConstruct(data.slice('construct:'.length), intersection.x, intersection.z);
  } else {
    const pos = new CANNON.Vec3(intersection.x, 0, intersection.z);
    placeExplosive(data, pos);
    createExplosiveMesh(data, pos);
  }
});

const debrisList: DebrisPiece[] = [];
let lastTime = performance.now();

function placeConstruct(type: string, x: number, z: number): void {
  switch (type) {
    case 'building': createSingleBuilding(x, z); break;
    case 'vehicle': createSingleVehicle(x, z); break;
    case 'tree': createSingleTree(x, z); break;
  }
}

function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  updateCamera(dt);
  handleClick();
  updateUI(container, uiState);

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
