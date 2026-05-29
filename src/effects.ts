import * as THREE from 'three';
import { getScene } from './renderer';

interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
}

let particles: Particle[] = [];
const activeAnimations: Array<(dt: number) => boolean> = [];

function addParticle(
  position: THREE.Vector3,
  velocity: THREE.Vector3,
  color: number,
  size: number,
  life: number,
): void {
  const scene = getScene();
  const geo = new THREE.SphereGeometry(size, 4, 3);
  const mat = new THREE.MeshBasicMaterial({ color });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(position);
  particles.push({ mesh, velocity, life, maxLife: life });
  scene.add(mesh);
}

function randomVelocity(baseSpeed: number, upwardBias: number): THREE.Vector3 {
  const angle = Math.random() * Math.PI * 2;
  const phi = Math.random() * Math.PI * 0.5;
  const speed = baseSpeed * (0.5 + Math.random());
  return new THREE.Vector3(
    Math.cos(angle) * Math.cos(phi) * speed,
    Math.sin(phi) * speed + upwardBias,
    Math.sin(angle) * Math.cos(phi) * speed,
  );
}

// ============================================================
// Nitroglycerin: fire + debris, small radius
// ============================================================
export function spawnNitroglycerinEffect(position: THREE.Vector3): void {
  const flameColors = [0xffdd00, 0xff8800, 0xff6600, 0xff4400];
  const debrisColors = [0x666666, 0x888888, 0x555555];

  for (let i = 0; i < 20; i++) {
    const color = flameColors[Math.floor(Math.random() * flameColors.length)];
    addParticle(position, randomVelocity(6, 3), color, 0.12, 0.4 + Math.random() * 0.8);
  }
  for (let i = 0; i < 10; i++) {
    const color = debrisColors[Math.floor(Math.random() * debrisColors.length)];
    addParticle(position, randomVelocity(4, 1), color, 0.08, 0.6 + Math.random() * 1.0);
  }
}

// ============================================================
// TNT: orange-red fireball + black smoke column
// ============================================================
export function spawnTntEffect(position: THREE.Vector3): void {
  const fireColors = [0xff4400, 0xff6600, 0xff8800, 0xffaa00, 0xff2200];
  const smokeColors = [0x222222, 0x333333, 0x444444, 0x1a1a1a];

  // Fire particles burst outward
  for (let i = 0; i < 35; i++) {
    const color = fireColors[Math.floor(Math.random() * fireColors.length)];
    addParticle(position, randomVelocity(10, 3), color, 0.18, 0.5 + Math.random() * 1.2);
  }
  // Smoke particles rise upward
  for (let i = 0; i < 15; i++) {
    const color = smokeColors[Math.floor(Math.random() * smokeColors.length)];
    addParticle(
      position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2, 0.5, (Math.random() - 0.5) * 2)),
      new THREE.Vector3((Math.random() - 0.5) * 1.5, 4 + Math.random() * 6, (Math.random() - 0.5) * 1.5),
      color, 0.25, 0.8 + Math.random() * 1.5,
    );
  }
}

// ============================================================
// C4: blue-white flash core + expanding pressure ring
// ============================================================
export function spawnC4Effect(position: THREE.Vector3): void {
  const flashColors = [0x6699ff, 0xaaccff, 0xffffff, 0xccddff, 0x3366cc];

  // Blue-white flash particles
  for (let i = 0; i < 25; i++) {
    const color = flashColors[Math.floor(Math.random() * flashColors.length)];
    addParticle(position, randomVelocity(14, 2), color, 0.15, 0.3 + Math.random() * 0.5);
  }

  // Expanding shock ring
  const scene = getScene();
  const ringGeo = new THREE.TorusGeometry(0.3, 0.08, 16, 32);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x6699ff, transparent: true, opacity: 0.9 });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.copy(position);
  ring.position.y += 0.3;
  scene.add(ring);

  let ringElapsed = 0;
  const ringDuration = 1.0;

  function animateRing(dt: number): boolean {
    ringElapsed += dt;
    const t = ringElapsed / ringDuration;
    ring.scale.setScalar(1 + t * 12);
    ringMat.opacity = Math.max(0, 0.9 * (1 - t));
    if (ringElapsed >= ringDuration) {
      scene.remove(ring);
      ringGeo.dispose();
      ringMat.dispose();
      return false;
    }
    return true;
  }
  activeAnimations.push(animateRing);
}

// ============================================================
// Nuke: white flash → mushroom cloud → shockwave
// ============================================================
export function spawnNukeEffect(position: THREE.Vector3): void {
  const scene = getScene();

  // White flash overlay
  const flashGeo = new THREE.SphereGeometry(2, 8, 8);
  const flashMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1 });
  const flash = new THREE.Mesh(flashGeo, flashMat);
  flash.position.copy(position);
  flash.position.y += 1;
  scene.add(flash);

  let flashElapsed = 0;
  const flashDuration = 0.4;

  function animateFlash(dt: number): boolean {
    flashElapsed += dt;
    flash.scale.setScalar(1 + flashElapsed * 20);
    flashMat.opacity = Math.max(0, 1 - flashElapsed / flashDuration * 2);
    if (flashElapsed >= flashDuration) {
      scene.remove(flash);
      flashGeo.dispose();
      flashMat.dispose();
      return false;
    }
    return true;
  }
  activeAnimations.push(animateFlash);

  // Shockwave ring (after flash fades)
  let shockElapsed = 0;
  const shockDuration = 2.5;
  const shockGeo = new THREE.TorusGeometry(1, 0.4, 8, 32);
  const shockMat = new THREE.MeshBasicMaterial({ color: 0xccaaff, transparent: true, opacity: 0.7 });
  const shockRing = new THREE.Mesh(shockGeo, shockMat);
  shockRing.rotation.x = Math.PI / 2;
  shockRing.position.copy(position);
  shockRing.position.y += 0.1;

  let shockStarted = false;
  function animateShock(dt: number): boolean {
    shockElapsed += dt;
    // Start shockwave after flash
    if (!shockStarted && shockElapsed > 0.3) {
      shockStarted = true;
      scene.add(shockRing);
    }
    if (shockStarted) {
      const t = (shockElapsed - 0.3) / (shockDuration - 0.3);
      shockRing.scale.setScalar(1 + t * 20);
      shockMat.opacity = Math.max(0, 0.7 * (1 - t));
    }
    if (shockElapsed >= shockDuration) {
      if (shockStarted) {
        scene.remove(shockRing);
        shockGeo.dispose();
        shockMat.dispose();
      }
      return false;
    }
    return true;
  }
  activeAnimations.push(animateShock);

  // Mushroom cloud (existing)
  spawnMushroomCloud(position);
}

// ============================================================
// Incendiary: persistent fire particles for 3s
// ============================================================
export function spawnIncendiaryEffect(position: THREE.Vector3): void {
  let burnElapsed = 0;
  const burnDuration = 3;
  const fireColors = [0xffdd00, 0xff8800, 0xff4400, 0xffaa00];

  function animateBurn(dt: number): boolean {
    burnElapsed += dt;
    if (burnElapsed < burnDuration && Math.random() < 0.6) {
      const pos = position.clone().add(
        new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 0.5, (Math.random() - 0.5) * 3),
      );
      const color = fireColors[Math.floor(Math.random() * fireColors.length)];
      addParticle(pos, new THREE.Vector3(0, 1 + Math.random() * 2, 0), color, 0.1, 0.8);
    }
    return burnElapsed < burnDuration;
  }
  activeAnimations.push(animateBurn);
}

// ============================================================
// Smoke: expanding grey sphere + smoke particles
// ============================================================
export function spawnSmokeEffect(position: THREE.Vector3): void {
  const scene = getScene();
  const sphereGeo = new THREE.SphereGeometry(0.5, 8, 8);
  const sphereMat = new THREE.MeshBasicMaterial({ color: 0x666666, transparent: true, opacity: 0.6 });
  const sphere = new THREE.Mesh(sphereGeo, sphereMat);
  sphere.position.copy(position);
  sphere.position.y += 1;
  scene.add(sphere);

  let elapsed = 0;
  const duration = 3;

  function animateSmoke(dt: number): boolean {
    elapsed += dt;
    const t = elapsed / duration;
    sphere.scale.setScalar(1 + t * 10);
    sphereMat.opacity = Math.max(0, 0.6 * (1 - t));
    sphere.position.y += dt * 1.5;

    if (Math.random() < 0.5) {
      addParticle(
        sphere.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 4, 1, (Math.random() - 0.5) * 4)),
        new THREE.Vector3(0, 1 + Math.random(), 0),
        0x888888, 0.2, 1.5,
      );
    }

    if (elapsed >= duration) {
      scene.remove(sphere);
      sphereGeo.dispose();
      sphereMat.dispose();
      return false;
    }
    return true;
  }
  activeAnimations.push(animateSmoke);
}

// ============================================================
// Flashbang: white hemisphere flash 0.5s
// ============================================================
export function spawnFlashEffect(position: THREE.Vector3): void {
  const scene = getScene();
  const geo = new THREE.SphereGeometry(1, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1 });
  const flash = new THREE.Mesh(geo, mat);
  flash.position.copy(position);
  flash.position.y += 1;
  scene.add(flash);

  let elapsed = 0;
  const duration = 0.5;

  function animateFlash(dt: number): boolean {
    elapsed += dt;
    flash.scale.setScalar(1 + elapsed * 15);
    mat.opacity = Math.max(0, 1 - elapsed / duration);
    if (elapsed >= duration) {
      scene.remove(flash);
      geo.dispose();
      mat.dispose();
      return false;
    }
    return true;
  }
  activeAnimations.push(animateFlash);
}

// ============================================================
// Mushroom cloud (internal nuke component)
// ============================================================
export function spawnMushroomCloud(position: THREE.Vector3): void {
  const scene = getScene();

  const fireballGeo = new THREE.SphereGeometry(1, 16, 8);
  const fireballMat = new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 1 });
  const fireball = new THREE.Mesh(fireballGeo, fireballMat);
  fireball.position.copy(position);
  fireball.position.y += 2;
  scene.add(fireball);

  const stemGeo = new THREE.CylinderGeometry(0.5, 1, 3, 8);
  const stemMat = new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.8 });
  const stem = new THREE.Mesh(stemGeo, stemMat);
  stem.position.copy(position);
  stem.position.y += 4;
  scene.add(stem);

  const ringGeo = new THREE.TorusGeometry(2, 0.5, 8, 16);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x666666, transparent: true, opacity: 0.6 });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.copy(position);
  ring.position.y += 5;
  scene.add(ring);

  let elapsed = 0;
  const duration = 3;

  function animateMushroom(dt: number): boolean {
    elapsed += dt;
    const t = elapsed / duration;

    fireball.scale.setScalar(1 + t * 10);
    fireballMat.opacity = Math.max(0, 1 - t * 1.5);
    fireball.position.y += dt * 5;

    stem.scale.setScalar(1 + t * 3);
    stemMat.opacity = Math.max(0, 0.8 - t);
    stem.position.y += dt * 3;

    ring.scale.setScalar(1 + t * 8);
    ringMat.opacity = Math.max(0, 0.6 - t);

    if (elapsed >= duration) {
      scene.remove(fireball);
      scene.remove(stem);
      scene.remove(ring);
      fireballGeo.dispose();
      fireballMat.dispose();
      stemGeo.dispose();
      stemMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      return false;
    }
    return true;
  }
  activeAnimations.push(animateMushroom);
}

// ============================================================
// Shared update
// ============================================================
export function updateEffects(dt: number): void {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    p.velocity.y -= 15 * dt;

    // Extra drag for smoke-like particles (slow velocity)
    p.mesh.position.add(p.velocity.clone().multiplyScalar(dt));
    p.mesh.scale.setScalar(Math.max(0, p.life / p.maxLife));

    if (p.life <= 0) {
      const scene = getScene();
      scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      (p.mesh.material as THREE.Material).dispose();
      particles.splice(i, 1);
    }
  }

  for (let i = activeAnimations.length - 1; i >= 0; i--) {
    if (!activeAnimations[i](dt)) {
      activeAnimations.splice(i, 1);
    }
  }
}
