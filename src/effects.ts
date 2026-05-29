import * as THREE from 'three';
import { getScene } from './renderer';
import { PhysicsBody, getWorld } from './physics';
import { physicsBodies } from './scene';

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
// Incendiary: ignites nearby buildings/trees, 10s burn then ash
// ============================================================
export function spawnIncendiaryEffect(
  position: THREE.Vector3,
  physicsBodies: PhysicsBody[],
): void {
  const fireColors = [0xffdd00, 0xff8800, 0xff4400, 0xffaa00];
  const incendiaryRadius = 5;

  // Initial fire particles at explosion point
  for (let i = 0; i < 30; i++) {
    const pos = position.clone().add(
      new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 2, (Math.random() - 0.5) * 4),
    );
    const color = fireColors[Math.floor(Math.random() * fireColors.length)];
    addParticle(pos, new THREE.Vector3(0, 2 + Math.random() * 4, 0), color, 0.12, 0.6 + Math.random() * 1.2);
  }

  // Find nearby buildings and trees to ignite
  for (const pb of physicsBodies) {
    if (!pb.isBuilding && !pb.isTree) continue;
    const p = new THREE.Vector3(pb.body.position.x, pb.body.position.y, pb.body.position.z);
    const dist = p.distanceTo(position);
    if (dist > incendiaryRadius) continue;

    igniteObject(pb, fireColors);
  }
}

interface BurningObject {
  pb: PhysicsBody;
  elapsed: number;
  originalMaterials: Array<{ obj: THREE.Mesh; mat: THREE.Material }>;
  fireParticles: Array<{ mesh: THREE.Mesh; offset: THREE.Vector3 }>;
}

const burningObjects: BurningObject[] = [];

export function igniteObject(pb: PhysicsBody, fireColors: number[]): void {
  const scene = getScene();

  // Store original materials and replace with burning colors
  const originalMaterials: Array<{ obj: THREE.Mesh; mat: THREE.Material }> = [];
  const fireParticles: Array<{ mesh: THREE.Mesh; offset: THREE.Vector3 }> = [];

  pb.mesh.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      originalMaterials.push({ obj: child, mat: child.material });
      const burnMat = new THREE.MeshBasicMaterial({
        color: fireColors[Math.floor(Math.random() * fireColors.length)],
        transparent: true,
        opacity: 0.85,
      });
      child.material = burnMat;

      // Create fire particles for this mesh part
      for (let i = 0; i < 3; i++) {
        const pGeo = new THREE.SphereGeometry(0.08 + Math.random() * 0.12, 3, 2);
        const pMat = new THREE.MeshBasicMaterial({
          color: fireColors[Math.floor(Math.random() * fireColors.length)],
        });
        const pMesh = new THREE.Mesh(pGeo, pMat);
        pMesh.position.copy(child.getWorldPosition(new THREE.Vector3()));
        const offset = new THREE.Vector3(
          (Math.random() - 0.5) * 0.8,
          Math.random() * 0.6,
          (Math.random() - 0.5) * 0.8,
        );
        pMesh.position.add(offset);
        scene.add(pMesh);
        fireParticles.push({ mesh: pMesh, offset });
      }
    }
  });

  pb.body.mass = 30; // Reduce mass so it can be affected by physics later

  burningObjects.push({
    pb,
    elapsed: 0,
    originalMaterials,
    fireParticles,
  });
}

function updateBurningObjects(dt: number, scene: THREE.Scene): void {
  for (let i = burningObjects.length - 1; i >= 0; i--) {
    const bo = burningObjects[i];
    bo.elapsed += dt;
    const t = bo.elapsed / 10;

    // Update fire particles
    for (const fp of bo.fireParticles) {
      const worldPos = bo.pb.mesh.position.clone().add(fp.offset);
      worldPos.y += Math.sin(bo.elapsed * 10 + fp.offset.x * 5) * 0.2;
      fp.mesh.position.copy(worldPos);
      fp.mesh.scale.setScalar(0.5 + Math.random() * 0.5);
    }

    // After 10s, turn to ash (shrink and remove)
    if (bo.elapsed >= 10) {
      // Remove fire particles
      for (const fp of bo.fireParticles) {
        scene.remove(fp.mesh);
        fp.mesh.geometry.dispose();
        (fp.mesh.material as THREE.Material).dispose();
      }
      // Remove object from scene
      scene.remove(bo.pb.mesh);
      bo.pb.mesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
      // Remove from physics world
      getWorld().removeBody(bo.pb.body);
      // Remove from physicsBodies
      const idx = physicsBodies.indexOf(bo.pb);
      if (idx !== -1) physicsBodies.splice(idx, 1);

      burningObjects.splice(i, 1);
    }
  }
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
// Cluster bomb: parent airburst → 8 submunitions
// ============================================================
export function spawnClusterEffect(position: THREE.Vector3): void {
  const scene = getScene();
  const parentColors = [0xff8800, 0xffaa00, 0xff6600];

  const airPos = position.clone();
  airPos.y += 5;

  for (let i = 0; i < 15; i++) {
    const color = parentColors[Math.floor(Math.random() * parentColors.length)];
    addParticle(airPos, randomVelocity(4, 2), color, 0.15, 0.3 + Math.random() * 0.4);
  }

  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 + Math.random() * 0.3;
    const spread = 2 + Math.random() * 3;
    const subPos = airPos.clone().add(
      new THREE.Vector3(Math.cos(angle) * spread, -1, Math.sin(angle) * spread),
    );

    setTimeout(() => {
      for (let j = 0; j < 8; j++) {
        const c = parentColors[Math.floor(Math.random() * parentColors.length)];
        addParticle(subPos, randomVelocity(3, 1), c, 0.1, 0.2 + Math.random() * 0.3);
      }
    }, 200 + i * 50);
  }
}

// ============================================================
// Black Hole: 3-phase realistic — formation → accretion → Hawking radiation
// ============================================================

export interface BlackHoleState {
  worldPos: THREE.Vector3;
  elapsed: number;
  active: boolean;
}

export const activeBlackHoleStates: BlackHoleState[] = [];

export function spawnBlackHoleEffect(position: THREE.Vector3): void {
  const scene = getScene();

  // === Phase 1: Core sphere + glow + accretion disc ===
  const coreGeo = new THREE.SphereGeometry(0.3, 32, 16);
  const coreMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const core = new THREE.Mesh(coreGeo, coreMat);
  core.position.copy(position).add(new THREE.Vector3(0, 1, 0));
  scene.add(core);

  // Glow halo (larger, transparent purple)
  const haloGeo = new THREE.SphereGeometry(0.6, 16, 8);
  const haloMat = new THREE.MeshBasicMaterial({ color: 0x331166, transparent: true, opacity: 0.4 });
  const halo = new THREE.Mesh(haloGeo, haloMat);
  core.add(halo);

  // Accretion disc (inner bright ring)
  const discGeo = new THREE.TorusGeometry(0.5, 0.08, 8, 32);
  const discMat = new THREE.MeshBasicMaterial({ color: 0xffaa44, transparent: true, opacity: 0.8 });
  const disc = new THREE.Mesh(discGeo, discMat);
  disc.rotation.x = Math.PI / 2;
  core.add(disc);

  // Outer disc ring (dimmer, redder)
  const outerDiscGeo = new THREE.TorusGeometry(0.8, 0.12, 8, 32);
  const outerDiscMat = new THREE.MeshBasicMaterial({ color: 0x882244, transparent: true, opacity: 0.5 });
  const outerDisc = new THREE.Mesh(outerDiscGeo, outerDiscMat);
  outerDisc.rotation.x = Math.PI / 2.1;
  core.add(outerDisc);

  // === Particle tracking ===
  interface BHSpiralParticle {
    mesh: THREE.Mesh;
    angle: number;
    radius: number;
    speed: number;
    height: number;
  }
  const spiralParticles: BHSpiralParticle[] = [];

  // Pre-create spiral particles
  for (let i = 0; i < 60; i++) {
    const pGeo = new THREE.SphereGeometry(0.05, 3, 2);
    const pMat = new THREE.MeshBasicMaterial({ color: 0x8844cc });
    const pMesh = new THREE.Mesh(pGeo, pMat);
    const angle = Math.random() * Math.PI * 2;
    const radius = 3 + Math.random() * 5;
    pMesh.position.set(
      position.x + Math.cos(angle) * radius,
      position.y + 1 + (Math.random() - 0.5) * 2,
      position.z + Math.sin(angle) * radius,
    );
    scene.add(pMesh);
    spiralParticles.push({ mesh: pMesh, angle, radius, speed: 0.5 + Math.random() * 1.5, height: pMesh.position.y });
  }

  const state: BlackHoleState = { worldPos: position.clone(), elapsed: 0, active: true };
  activeBlackHoleStates.push(state);

  // === Animation ===
  const suckDuration = 2.0;
  const flashDuration = 0.3;
  const totalDuration = suckDuration + 0.5 + flashDuration; // suck + charge + flash

  let phase2Started = false;
  let phase3Started = false;

  function animateBlackHole(dt: number): boolean {
    state.elapsed += dt;
    const elapsed = state.elapsed;

    // Phase 1+2: Formation + Suck (0 → 2.0s)
    if (elapsed < suckDuration) {
      const t = elapsed / suckDuration;
      // Core grows
      core.scale.setScalar(0.5 + t * 5);
      // Glow intensifies then stabilizes
      haloMat.opacity = 0.3 + t * 0.3;
      // Disc scales with core
      disc.scale.setScalar(0.5 + t * 4);
      disc.rotation.z += dt * 3;
      outerDisc.scale.setScalar(0.5 + t * 4.5);
      outerDisc.rotation.z -= dt * 2.5;
      // Disc color shift: white-hot inner, orange outer
      const discT = t;
      discMat.color.setRGB(0.8 + discT * 0.2, 0.4 + discT * 0.3, 0.1 + discT * 0.1);
      outerDiscMat.color.setRGB(0.4 + discT * 0.1, 0.1, 0.2 + discT * 0.1);

      // Spiral particles
      for (const sp of spiralParticles) {
        sp.radius -= dt * sp.speed * (1 + t);
        sp.angle += dt * (2 + t * 4) / (sp.radius + 0.3);
        sp.mesh.position.x = position.x + Math.cos(sp.angle) * sp.radius;
        sp.mesh.position.z = position.z + Math.sin(sp.angle) * sp.radius;
        sp.mesh.position.y += (position.y + 1 - sp.mesh.position.y) * dt * 0.5;
        // Stretch near core
        const nearCore = Math.max(0, 1 - sp.radius / 2);
        sp.mesh.scale.set(1 + nearCore * 3, 1 - nearCore * 0.5, 1);
        // Color shift: farther = purple, closer = white-hot
        const c = nearCore;
        (sp.mesh.material as THREE.MeshBasicMaterial).color.setRGB(0.5 + c * 0.5, 0.2 + c * 0.5, 1 - c * 0.5);
        // Remove if reached core
        if (sp.radius < 0.5) {
          scene.remove(sp.mesh);
          sp.mesh.geometry.dispose();
          (sp.mesh.material as THREE.Material).dispose();
          sp.radius = 999; // mark for removal
        }
      }
    }

    // Charge phase (2.0 → 2.5s) — core shrinks, disc brightens
    if (elapsed >= suckDuration && elapsed < suckDuration + 0.5) {
      if (!phase2Started) {
        phase2Started = true;
        // Remove spiral particles
        for (const sp of spiralParticles) {
          if (sp.radius === 999) continue;
          scene.remove(sp.mesh);
          sp.mesh.geometry.dispose();
          (sp.mesh.material as THREE.Material).dispose();
        }
      }
      const ct = (elapsed - suckDuration) / 0.5;
      core.scale.setScalar(5 - ct * 4.8); // shrink
      disc.scale.setScalar(4.5 - ct * 4);
      outerDisc.scale.setScalar(5 - ct * 4.5);
      haloMat.opacity = 0.6 + ct * 0.4;
      // Brighten disc
      discMat.color.setRGB(1, 0.7 + ct * 0.3, 0.5 + ct * 0.5);
      haloMat.color.setHex(0x6633cc + Math.floor(ct * 0x33));
    }

    // Phase 3: Hawking radiation flash (2.5 → 2.8s)
    if (elapsed >= suckDuration + 0.5 && elapsed < totalDuration) {
      if (!phase3Started) {
        phase3Started = true;
        // Remove core + disc
        scene.remove(core);
        coreGeo.dispose();
        coreMat.dispose();
        haloGeo.dispose();
        haloMat.dispose();
        discGeo.dispose();
        discMat.dispose();
        outerDiscGeo.dispose();
        outerDiscMat.dispose();

        // White flash sphere
        const flashGeo = new THREE.SphereGeometry(0.3, 16, 8);
        const flashMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1 });
        const flash = new THREE.Mesh(flashGeo, flashMat);
        flash.position.copy(position).add(new THREE.Vector3(0, 1, 0));
        scene.add(flash);

        // Flash animation sub-function
        let flashElapsed = 0;
        function animateFlash(dt2: number): boolean {
          flashElapsed += dt2;
          flash.scale.setScalar(1 + flashElapsed * 30);
          flashMat.opacity = Math.max(0, 1 - flashElapsed / flashDuration * 3);
          if (flashElapsed >= flashDuration) {
            scene.remove(flash);
            flashGeo.dispose();
            flashMat.dispose();
            return false;
          }
          return true;
        }
        activeAnimations.push(animateFlash);

        // High-energy particle burst (Hawking radiation)
        for (let i = 0; i < 80; i++) {
          const isHigh = i < 20;
          const color = isHigh ? 0xffffff : [0x9933ff, 0x6633cc, 0xcc88ff][Math.floor(Math.random() * 3)];
          const speed = isHigh ? 18 : 10 + Math.random() * 8;
          const burstOrigin = position.clone().add(new THREE.Vector3(0, 1, 0));
          addParticle(burstOrigin, randomVelocity(speed, speed * 0.3), color, 0.06, 0.3 + Math.random() * 0.5);
        }
      }

      state.active = false;
      return false; // Main animation done
    }

    return true;
  }
  activeAnimations.push(animateBlackHole);
}

// ============================================================
// EMP: blue-white lightning sphere + screen flash
// ============================================================
let screenFlashIntensity = 0;

export function getScreenFlash(): number {
  const v = screenFlashIntensity;
  screenFlashIntensity *= 0.9;
  return v;
}

export function spawnEMPEffect(position: THREE.Vector3): void {
  const scene = getScene();
  const colors = [0x4488ff, 0x88bbff, 0xffffff, 0xaaccff];

  const sphereGeo = new THREE.SphereGeometry(0.5, 8, 8);
  const sphereMat = new THREE.MeshBasicMaterial({ color: 0x4488ff, transparent: true, opacity: 0.9 });
  const sphere = new THREE.Mesh(sphereGeo, sphereMat);
  sphere.position.copy(position);
  sphere.position.y += 1;
  scene.add(sphere);

  let elapsed = 0;
  const duration = 0.6;

  function animateEMP(dt: number): boolean {
    elapsed += dt;
    const t = elapsed / duration;
    sphere.scale.setScalar(1 + t * 12);
    sphereMat.opacity = Math.max(0, 0.9 * (1 - t));

    for (let i = 0; i < 5; i++) {
      const color = colors[Math.floor(Math.random() * colors.length)];
      const p = sphere.position.clone().add(
        new THREE.Vector3((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 6),
      );
      addParticle(p, new THREE.Vector3(0, 10, 0), color, 0.06, 0.15);
    }

    if (elapsed >= duration) {
      scene.remove(sphere);
      sphereGeo.dispose();
      sphereMat.dispose();
      return false;
    }
    return true;
  }
  activeAnimations.push(animateEMP);

  screenFlashIntensity = 1;
}

// ============================================================
// Spray effects (continuous, called each frame while spraying)
// ============================================================
export function sprayFlameEffect(origin: THREE.Vector3, direction: THREE.Vector3, dt: number): void {
  const colors = [0xff4400, 0xff6600, 0xff8800, 0xffaa00, 0xff2200];
  const count = Math.floor(8 * dt * 60);
  for (let i = 0; i < Math.max(1, count); i++) {
    const spreadDir = direction.clone();
    spreadDir.x += (Math.random() - 0.5) * 0.3;
    spreadDir.z += (Math.random() - 0.5) * 0.3;
    spreadDir.normalize();
    const color = colors[Math.floor(Math.random() * colors.length)];
    const speed = 4 + Math.random() * 6;
    addParticle(
      origin.clone().add(new THREE.Vector3((Math.random()-0.5)*0.3, (Math.random()-0.5)*0.3, (Math.random()-0.5)*0.3)),
      spreadDir.multiplyScalar(speed),
      color, 0.06, 0.3 + Math.random() * 0.4,
    );
  }
}

export function sprayIceEffect(origin: THREE.Vector3, direction: THREE.Vector3, dt: number): void {
  const colors = [0x88ccff, 0xaaddff, 0xccddff, 0xffffff, 0x6699cc];
  const count = Math.floor(6 * dt * 60);
  for (let i = 0; i < Math.max(1, count); i++) {
    const spreadDir = direction.clone();
    spreadDir.x += (Math.random() - 0.5) * 0.3;
    spreadDir.z += (Math.random() - 0.5) * 0.3;
    spreadDir.normalize();
    const color = colors[Math.floor(Math.random() * colors.length)];
    addParticle(origin, spreadDir.multiplyScalar(3 + Math.random() * 5), color, 0.05, 0.4 + Math.random() * 0.5);
  }
}

export function sprayParticleEffect(origin: THREE.Vector3, direction: THREE.Vector3, dt: number): void {
  const colors = [0x9933ff, 0xcc66ff, 0xaa44ff, 0xffffff, 0xdd88ff];
  const count = Math.floor(5 * dt * 60);
  for (let i = 0; i < Math.max(1, count); i++) {
    const spreadDir = direction.clone();
    spreadDir.x += (Math.random() - 0.5) * 0.2;
    spreadDir.z += (Math.random() - 0.5) * 0.2;
    spreadDir.normalize();
    const color = colors[Math.floor(Math.random() * colors.length)];
    const p = origin.clone().add(new THREE.Vector3((Math.random()-0.5)*0.2, (Math.random()-0.5)*0.2, (Math.random()-0.5)*0.2));
    addParticle(p, spreadDir.multiplyScalar(8 + Math.random() * 10), color, 0.06, 0.2 + Math.random() * 0.3);
  }
}

// ============================================================
// Shared update
// ============================================================
export function updateEffects(dt: number): void {
  const scene = getScene();

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    p.velocity.y -= 15 * dt;

    // Extra drag for smoke-like particles (slow velocity)
    p.mesh.position.add(p.velocity.clone().multiplyScalar(dt));
    p.mesh.scale.setScalar(Math.max(0, p.life / p.maxLife));

    if (p.life <= 0) {
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

  updateBurningObjects(dt, scene);
}
