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
    renderer.setSize(container.clientWidth, container.clientHeight);
  });

  return { camera, renderer, scene };
}

export function getScene() { return scene; }
export function getCamera() { return camera; }
export function getRenderer() { return renderer; }
