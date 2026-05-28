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
