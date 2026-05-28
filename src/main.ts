import { initRenderer } from './renderer';
import { createScene } from './scene';

const container = document.getElementById('app')!;
const { camera, renderer, scene } = initRenderer(container);

createScene();

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

animate();
