import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { applyExplosion, ExplosionConfig, fragmentBuilding, DebrisPiece, PhysicsBody } from './physics';
import { spawnExplosionEffect, spawnMushroomCloud } from './effects';

interface PlacedExplosiveData {
  position: CANNON.Vec3;
  type: string;
  config: ExplosionConfig;
}

let placedExplosives: PlacedExplosiveData[] = [];
const FRAGMENT_THRESHOLD = 300;

export function placeExplosive(type: string, position: CANNON.Vec3): void {
  placedExplosives.push({
    position: position.clone(),
    type,
    config: { position: position.clone(), radius: 8, baseForce: 800 },
  });
}

export function detonateAll(
  physicsBodies: PhysicsBody[],
  debrisList: DebrisPiece[],
  scene: THREE.Scene,
): void {
  for (const exp of placedExplosives) {
    const { position, radius, baseForce } = exp.config;

    for (const pb of physicsBodies) {
      const dist = pb.body.position.distanceTo(position);
      if (dist < radius) {
        const forceMag = baseForce / (1 + (dist * dist) / (radius * radius));
        if (forceMag > FRAGMENT_THRESHOLD && pb.isBuilding) {
          fragmentBuilding(
            pb.body, pb.mesh as THREE.Mesh,
            physicsBodies, debrisList, scene,
          );
        }
      }
    }

    applyExplosion(exp.config);
    spawnExplosionEffect(
      new THREE.Vector3(exp.position.x, 1, exp.position.z),
      40,
    );

    if (exp.type === 'nuke') {
      spawnMushroomCloud(new THREE.Vector3(exp.position.x, 0, exp.position.z));
    }
  }
  placedExplosives = [];
}
