import * as THREE from 'three';
import { getScene } from './renderer';

interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
}

let particles: Particle[] = [];

const PARTICLE_GEO = new THREE.SphereGeometry(0.15, 4, 3);
const PARTICLE_COLORS = [0xff4400, 0xff6600, 0xff8800, 0xffaa00, 0x333333];

export function spawnExplosionEffect(position: THREE.Vector3, count: number = 30): void {
  const scene = getScene();

  for (let i = 0; i < count; i++) {
    const color = PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)];
    const mat = new THREE.MeshBasicMaterial({ color });
    const mesh = new THREE.Mesh(PARTICLE_GEO, mat);
    mesh.position.copy(position);

    const speed = 5 + Math.random() * 15;
    const angle = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI * 0.5;
    const velocity = new THREE.Vector3(
      Math.cos(angle) * Math.cos(phi) * speed,
      Math.sin(phi) * speed + 2,
      Math.sin(angle) * Math.cos(phi) * speed,
    );

    const life = 0.5 + Math.random() * 1.5;
    particles.push({ mesh, velocity, life, maxLife: life });
    scene.add(mesh);
  }
}

export function updateParticles(dt: number): void {
  const scene = getScene();

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    p.velocity.y -= 15 * dt;
    p.mesh.position.add(p.velocity.clone().multiplyScalar(dt));
    p.mesh.scale.setScalar(Math.max(0, p.life / p.maxLife));

    if (p.life <= 0) {
      scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      (p.mesh.material as THREE.Material).dispose();
      particles.splice(i, 1);
    }
  }
}

const activeAnimations: Array<(dt: number) => boolean> = [];

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

export function updateEffects(dt: number): void {
  updateParticles(dt);
  for (let i = activeAnimations.length - 1; i >= 0; i--) {
    if (!activeAnimations[i](dt)) {
      activeAnimations.splice(i, 1);
    }
  }
}
