import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { applyExplosion, ExplosionConfig } from './physics';
import { spawnExplosionEffect } from './effects';

interface PlacedExplosiveData {
  position: CANNON.Vec3;
  type: string;
  config: ExplosionConfig;
}

let placedExplosives: PlacedExplosiveData[] = [];

export function placeExplosive(type: string, position: CANNON.Vec3): void {
  placedExplosives.push({
    position: position.clone(),
    type,
    config: { position: position.clone(), radius: 8, baseForce: 800 },
  });
}

export function detonateAll(): void {
  for (const exp of placedExplosives) {
    applyExplosion(exp.config);
    spawnExplosionEffect(
      new THREE.Vector3(exp.position.x, 1, exp.position.z),
      40,
    );
  }
  placedExplosives = [];
}
