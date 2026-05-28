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
