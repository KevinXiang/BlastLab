import * as THREE from 'three';
import { WORLD_SIZE, CAMERA_ZOOM, CAMERA_NEAR, CAMERA_FAR, COLOR_GROUND } from './constants';

let camera: THREE.OrthographicCamera;
let renderer: THREE.WebGLRenderer;
let scene: THREE.Scene;

// Distortion post-processing
let renderTarget: THREE.WebGLRenderTarget;
let distortionQuad: THREE.Mesh;
let distortionScene: THREE.Scene;
let distortionUniforms: {
  tDiffuse: { value: THREE.Texture | null };
  uCenter: { value: THREE.Vector2 };
  uRadius: { value: number };
  uIntensity: { value: number };
};

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

  // 主方向光
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

  // === Distortion post-processing setup ===
  const w = container.clientWidth;
  const h = container.clientHeight;
  renderTarget = new THREE.WebGLRenderTarget(w, h, { samples: 4 });

  distortionUniforms = {
    tDiffuse: { value: null },
    uCenter: { value: new THREE.Vector2(0.5, 0.5) },
    uRadius: { value: 0.15 },
    uIntensity: { value: 0 },
  };

  const distortionShader = new THREE.ShaderMaterial({
    uniforms: distortionUniforms,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse;
      uniform vec2 uCenter;
      uniform float uRadius;
      uniform float uIntensity;
      varying vec2 vUv;

      void main() {
        vec2 uv = vUv;
        float dist = distance(uv, uCenter);
        if (dist < uRadius && uIntensity > 0.01) {
          float strength = (1.0 - dist / uRadius);
          strength = pow(strength, 2.5) * uIntensity;
          vec2 dir = normalize(uv - uCenter);
          uv -= dir * strength * 0.25;
        }
        gl_FragColor = texture2D(tDiffuse, uv);
      }
    `,
  });

  const quadGeo = new THREE.PlaneGeometry(2, 2);
  distortionQuad = new THREE.Mesh(quadGeo, distortionShader);
  distortionScene = new THREE.Scene();
  distortionScene.add(distortionQuad);

  window.addEventListener('resize', () => {
    const rw = container.clientWidth;
    const rh = container.clientHeight;
    renderer.setSize(rw, rh);
    renderTarget.setSize(rw, rh);
  });

  return { camera, renderer, scene };
}

export function getScene() { return scene; }
export function getCamera() { return camera; }
export function getRenderer() { return renderer; }

// Set black hole screen position for distortion effect
let lastBHWorldPos: THREE.Vector3 | null = null;
let lastBHRadius = 0;

export function setBlackHoleDistortion(worldPos: THREE.Vector3 | null, radius: number): void {
  if (!worldPos) {
    lastBHWorldPos = null;
    lastBHRadius = 0;
    return;
  }
  // Project 3D world position to normalized screen coordinates
  const screenPos = worldPos.clone().project(camera);
  distortionUniforms.uCenter.value.set(
    screenPos.x * 0.5 + 0.5,
    -screenPos.y * 0.5 + 0.5,
  );
  lastBHWorldPos = worldPos;
  lastBHRadius = radius;
}

export function renderWithDistortion(): void {
  // Render 3D scene to offscreen target
  renderer.setRenderTarget(renderTarget);
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);

  // Smooth intensity transition
  const targetIntensity = lastBHWorldPos ? 1 : 0;
  distortionUniforms.uIntensity.value += (targetIntensity - distortionUniforms.uIntensity.value) * 0.1;
  distortionUniforms.uRadius.value = lastBHRadius > 0 ? 0.12 : 0;
  distortionUniforms.tDiffuse.value = renderTarget.texture;

  // Render distortion quad to screen
  renderer.render(distortionScene, camera);
}
