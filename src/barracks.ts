import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { getScene } from './renderer';
import { getWorld } from './physics';
import { BARRACKS_HP, BARRACKS_SPAWN_RATE, MORALE_INITIAL, MORALE_LOW_THRESHOLD, MORALE_HIGH_THRESHOLD } from './constants';
import { createStickman, StickmanState } from './stickman';

export interface BarracksState {
  group: THREE.Group;
  body: CANNON.Body;
  hp: number;
  maxHp: number;
  spawnRate: number;
  spawnTimer: number;
  maxUnits: number;
  alive: boolean;
  faction: 'red' | 'blue';
  morale: number;
  lastMoraleEventTime: number;
}

export function createBarracks(x: number, z: number, faction: 'red' | 'blue'): BarracksState {
  const scene = getScene();
  const world = getWorld();

  const tentColor = faction === 'red' ? 0x883333 : 0x334488;
  const flagColor = faction === 'red' ? 0xff4444 : 0x4488ff;

  const group = new THREE.Group();

  // Base platform
  const baseGeo = new THREE.BoxGeometry(1, 0.2, 1);
  const baseMat = new THREE.MeshToonMaterial({ color: 0x888888 });
  const base = new THREE.Mesh(baseGeo, baseMat);
  base.position.y = 0.1;
  base.castShadow = true;
  group.add(base);

  // Tent
  const tentGeo = new THREE.ConeGeometry(0.5, 1.2, 4);
  const tentMat = new THREE.MeshToonMaterial({ color: tentColor });
  const tent = new THREE.Mesh(tentGeo, tentMat);
  tent.position.y = 0.8;
  tent.rotation.y = Math.PI / 4;
  tent.castShadow = true;
  group.add(tent);

  // Flag pole
  const poleGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.8, 6);
  const poleMat = new THREE.MeshToonMaterial({ color: 0x886644 });
  const pole = new THREE.Mesh(poleGeo, poleMat);
  pole.position.y = 1.2;
  pole.castShadow = true;
  group.add(pole);

  // Flag
  const flagGeo = new THREE.PlaneGeometry(0.3, 0.2);
  const flagMat = new THREE.MeshToonMaterial({ color: flagColor, side: THREE.DoubleSide });
  const flag = new THREE.Mesh(flagGeo, flagMat);
  flag.position.set(0.15, 1.9, 0);
  flag.castShadow = true;
  group.add(flag);

  group.position.set(x, 0, z);
  scene.add(group);

  // Physics
  const shape = new CANNON.Box(new CANNON.Vec3(0.5, 0.8, 0.5));
  const body = new CANNON.Body({ mass: 80, shape });
  body.position.set(x, 0.8, z);
  body.linearDamping = 0.4;
  body.angularDamping = 0.5;
  world.addBody(body);

  return {
    group, body,
    hp: BARRACKS_HP, maxHp: BARRACKS_HP,
    spawnRate: BARRACKS_SPAWN_RATE, spawnTimer: 0,
    maxUnits: Infinity, alive: true,
    faction,
    morale: MORALE_INITIAL,
    lastMoraleEventTime: 0,
  };
}

export function setSpawnRate(barracks: BarracksState, rate: number): void {
  barracks.spawnRate = Math.max(0.5, rate);
}

export function damageBarracks(barracks: BarracksState, amount: number): boolean {
  barracks.hp -= amount;
  return barracks.hp <= 0;
}

export function updateBarracks(
  barracks: BarracksState,
  dt: number,
  activeStickmen: StickmanState[],
): StickmanState[] {
  if (!barracks.alive) return [];

  const spawned: StickmanState[] = [];
  barracks.spawnTimer += dt;

  let effectiveRate = barracks.spawnRate;
  if (barracks.morale < MORALE_LOW_THRESHOLD) {
    effectiveRate = barracks.spawnRate * 2;
  } else if (barracks.morale > MORALE_HIGH_THRESHOLD) {
    effectiveRate = barracks.spawnRate * 0.67;
  }

  const aliveCount = activeStickmen.filter(s => s.alive).length;
  if (barracks.spawnTimer >= effectiveRate && aliveCount < barracks.maxUnits) {
    barracks.spawnTimer = 0;
    const angle = Math.random() * Math.PI * 2;
    const dist = 1 + Math.random() * 2;
    const sx = barracks.body.position.x + Math.cos(angle) * dist;
    const sz = barracks.body.position.z + Math.sin(angle) * dist;
    const sm = createStickman(sx, sz, barracks.faction);
    spawned.push(sm);
  }

  return spawned;
}
