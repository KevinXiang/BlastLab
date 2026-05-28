import * as CANNON from 'cannon-es';
import { applyExplosion, ExplosionConfig } from './physics';

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
  }
  placedExplosives = [];
}
