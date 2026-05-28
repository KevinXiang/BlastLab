import { initRenderer } from './renderer';

const container = document.getElementById('app')!;
const { camera, renderer, scene } = initRenderer(container);

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

animate();
