import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { initRenderer, getCamera } from './renderer';
import { createScene, physicsBodies, createExplosiveMesh, removeAllExplosives } from './scene';
import { initPhysics, getWorld } from './physics';
import { placeExplosive, detonateAll } from './game';
import { updateParticles } from './effects';
import { createInputState, setupInput } from './input';
import {
  CAMERA_ZOOM, CAMERA_MIN_ZOOM, CAMERA_MAX_ZOOM,
  CAMERA_ORBIT_DISTANCE, CAMERA_ELEVATION,
  CAMERA_ROTATE_SPEED, CAMERA_ZOOM_SPEED,
  CAMERA_DRAG_SENSITIVITY, CAMERA_SCROLL_SENSITIVITY,
} from './constants';

const container = document.getElementById('app')!;
const { camera, renderer, scene } = initRenderer(container);

createScene();

const world = initPhysics();

const input = createInputState();
setupInput(input);

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
    placeExplosive('tnt', pos);
    createExplosiveMesh('tnt', pos);
  }

  input.mouseDown = false;
}

let lastTime = performance.now();

function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  updateCamera(dt);
  handleClick();

  if (input.detonate) {
    detonateAll();
    removeAllExplosives();
    input.detonate = false;
  }

  if (input.reset) {
    removeAllExplosives();
    input.reset = false;
  }

  world.step(1 / 60);

  updateParticles(dt);

  for (const pb of physicsBodies) {
    pb.mesh.position.copy(pb.body.position as any);
    pb.mesh.quaternion.copy(pb.body.quaternion as any);
  }

  renderer.render(scene, camera);
}

animate();
