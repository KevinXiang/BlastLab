import { initRenderer, getCamera } from './renderer';
import { createScene, physicsBodies } from './scene';
import { initPhysics, getWorld } from './physics';
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
  // 右键拖拽旋转
  if (input.rightMouseDown) {
    const dx = input.mouseX - prevMouseX;
    cameraAngle += dx * CAMERA_DRAG_SENSITIVITY * dt;
  }

  // 键盘旋转
  if (input.rotateLeft) cameraAngle += CAMERA_ROTATE_SPEED * dt;
  if (input.rotateRight) cameraAngle -= CAMERA_ROTATE_SPEED * dt;

  // 缩放
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

let lastTime = performance.now();

function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  updateCamera(dt);

  world.step(1 / 60);

  for (const pb of physicsBodies) {
    pb.mesh.position.copy(pb.body.position as any);
    pb.mesh.quaternion.copy(pb.body.quaternion as any);
  }

  renderer.render(scene, camera);
}

animate();
