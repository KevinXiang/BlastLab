import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { applyExplosion, fragmentBuilding, DebrisPiece, PhysicsBody } from './physics';
import {
  spawnNitroglycerinEffect,
  spawnTntEffect,
  spawnC4Effect,
  spawnNukeEffect,
} from './effects';
import { EXPLOSIVE_DEFS, ExplosiveDef } from './constants';

interface PlacedExplosiveData {
  position: CANNON.Vec3;
  type: string;
  def: ExplosiveDef;
}

let placedExplosives: PlacedExplosiveData[] = [];
const FRAGMENT_THRESHOLD = 300;

export function placeExplosive(type: string, position: CANNON.Vec3): void {
  const def = EXPLOSIVE_DEFS[type];
  if (!def) return;
  placedExplosives.push({ position: position.clone(), type, def });
}

export function detonateAll(
  physicsBodies: PhysicsBody[],
  debrisList: DebrisPiece[],
  scene: THREE.Scene,
): void {
  for (const exp of placedExplosives) {
    const { position, def, type } = exp;

    for (const pb of physicsBodies) {
      const dist = pb.body.position.distanceTo(position);
      if (dist < def.radius) {
        const forceMag = def.baseForce / (1 + (dist * dist) / (def.radius * def.radius));
        if (forceMag > FRAGMENT_THRESHOLD && pb.isBuilding) {
          fragmentBuilding(
            pb.body, pb.mesh as THREE.Mesh,
            physicsBodies, debrisList, scene,
          );
        }
      }
    }

    applyExplosion({ position, radius: def.radius, baseForce: def.baseForce });

    const pos3 = new THREE.Vector3(exp.position.x, 1, exp.position.z);
    switch (type) {
      case 'nitroglycerin': spawnNitroglycerinEffect(pos3); break;
      case 'c4': spawnC4Effect(pos3); break;
      case 'nuke': spawnNukeEffect(pos3); break;
      default: spawnTntEffect(pos3); break;
    }
  }
  placedExplosives = [];
}

export type GameMode = 'sandbox' | 'level';

export interface LevelConfig {
  name: string;
  explosives: Record<string, number>;
  objective: string;
}

const LEVELS: LevelConfig[] = [
  { name: '第一关', explosives: { tnt: 3, c4: 1 }, objective: '摧毁红色建筑' },
  { name: '第二关', explosives: { tnt: 2, c4: 2, nitroglycerin: 2 }, objective: '清空区域' },
];

let currentMode: GameMode = 'sandbox';
let currentLevel = 0;
let remainingExplosives: Record<string, number> = {};

export function setMode(mode: GameMode): void {
  currentMode = mode;
  if (mode === 'sandbox') {
    remainingExplosives = { tnt: Infinity, c4: Infinity, nitroglycerin: Infinity, nuke: Infinity };
  } else {
    currentLevel = 0;
    loadLevel(currentLevel);
  }
}

function loadLevel(index: number): void {
  const level = LEVELS[index];
  remainingExplosives = { ...level.explosives };
}

export function canPlace(type: string): boolean {
  if (currentMode === 'sandbox') return true;
  return (remainingExplosives[type] ?? 0) > 0;
}

export function consumeExplosive(type: string): void {
  if (currentMode === 'sandbox') return;
  if (remainingExplosives[type] && remainingExplosives[type] > 0) {
    remainingExplosives[type]--;
  }
}

export function getMode(): GameMode { return currentMode; }
export function getRemaining(): Record<string, number> { return { ...remainingExplosives }; }
export function getCurrentLevel(): LevelConfig | null {
  return currentMode === 'level' ? LEVELS[currentLevel] : null;
}
