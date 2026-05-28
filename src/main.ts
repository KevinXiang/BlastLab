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
