import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { applyExplosion, fragmentBuilding, DebrisPiece, PhysicsBody, getWorld } from './physics';
import {
  spawnNitroglycerinEffect,
  spawnTntEffect,
  spawnC4Effect,
  spawnNukeEffect,
  spawnClusterEffect,
  spawnBlackHoleEffect,
  spawnEMPEffect,
} from './effects';
import { BLACKHOLE_SUCK_DURATION, STICKMAN_SCORE } from './constants';
import { EXPLOSIVE_DEFS, ExplosiveDef, REMOTE_RADIUS, REMOTE_FORCE, MINE_RADIUS, MINE_FORCE } from './constants';
import { getScene } from './renderer';
import { physicsBodies } from './scene';

export interface ScoreBreakdown {
  destroyScore: number;
  impactScore: number;
  chainScore: number;
}

export interface ScoreState {
  totalScore: number;
  highScore: number;
  lastScore: ScoreBreakdown | null;
  lastScorePosition: THREE.Vector3 | null;
}

const HIGH_SCORE_KEY = 'blasting_highscore';

export const scoreState: ScoreState = {
  totalScore: 0,
  highScore: 0,
  lastScore: null,
  lastScorePosition: null,
};

export function loadHighScore(): void {
  try {
    const raw = localStorage.getItem(HIGH_SCORE_KEY);
    scoreState.highScore = raw ? parseInt(raw, 10) || 0 : 0;
  } catch {
    scoreState.highScore = 0;
  }
}

function saveHighScore(): void {
  try {
    localStorage.setItem(HIGH_SCORE_KEY, String(scoreState.highScore));
  } catch { /* ignore */ }
}

export function resetScore(): void {
  scoreState.totalScore = 0;
  scoreState.lastScore = null;
  scoreState.lastScorePosition = null;
}

interface PlacedExplosiveData {
  position: CANNON.Vec3;
  type: string;
  def: ExplosiveDef;
}

let placedExplosives: PlacedExplosiveData[] = [];
export function getPlacedExplosives(): PlacedExplosiveData[] { return placedExplosives; }
const FRAGMENT_THRESHOLD = 300;

export function placeExplosive(type: string, position: CANNON.Vec3): void {
  const def = EXPLOSIVE_DEFS[type];
  if (!def) return;
  placedExplosives.push({ position: position.clone(), type, def });
}

function calcDestroyScore(physicsBodies: PhysicsBody[], position: CANNON.Vec3, radius: number): number {
  let score = 0;
  for (const pb of physicsBodies) {
    const dist = pb.body.position.distanceTo(position);
    if (dist >= radius) continue;
    const baseForce = EXPLOSIVE_DEFS['tnt']?.baseForce ?? 800;
    const forceMag = baseForce / (1 + (dist * dist) / (radius * radius));
    if (pb.isBuilding && forceMag > FRAGMENT_THRESHOLD) {
      const meshHeight = (pb.mesh as THREE.Mesh).position.y;
      score += Math.round(100 * meshHeight);
    } else if (pb.isTree && forceMag > 100) {
      score += 50;
    }
  }
  for (const pb of physicsBodies) {
    const dist = pb.body.position.distanceTo(position);
    if (dist < radius && !pb.isBuilding && !pb.isTree && pb.body.mass > 50 && pb.body.mass < 500) {
      const baseForce = EXPLOSIVE_DEFS['tnt']?.baseForce ?? 800;
      const forceMag = baseForce / (1 + (dist * dist) / (radius * radius));
      if (forceMag > 200) score += 200;
    }
  }
  return score;
}

function calcImpactScore(world: CANNON.World, position: CANNON.Vec3, radius: number): number {
  let count = 0;
  for (const body of world.bodies) {
    if (body.mass === 0) continue;
    const dist = body.position.distanceTo(position);
    if (dist < radius) count++;
  }
  return count * 10;
}

export let pendingChainScore = 0;

export function addChainScore(): void {
  pendingChainScore += 50;
}

// ============================================================
// Black Hole Physics
// ============================================================
interface BlackHoleInstance {
  position: CANNON.Vec3;
  elapsed: number;
}

const activeBlackHoles: BlackHoleInstance[] = [];

function startBlackHolePhysics(position: CANNON.Vec3, world: CANNON.World): void {
  activeBlackHoles.push({ position: position.clone(), elapsed: 0 });
}

export function updateBlackHolePhysics(dt: number, scene: THREE.Scene): void {
  const world = getWorld();
  for (let i = activeBlackHoles.length - 1; i >= 0; i--) {
    const bh = activeBlackHoles[i];
    bh.elapsed += dt;

    if (bh.elapsed < BLACKHOLE_SUCK_DURATION) {
      // Suck phase: pull ALL bodies toward center
      // Use applyForce (not applyImpulse) — frame-rate independent, accumulates in world.step()
      for (let j = world.bodies.length - 1; j >= 0; j--) {
        const body = world.bodies[j];
        if (body.mass === 0) continue;

        const dx = bh.position.x - body.position.x;
        const dy = bh.position.y - body.position.y;
        const dz = bh.position.z - body.position.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        const strength = 8000 + dist * 500;
        const invDist = 1 / Math.max(dist, 0.01);
        // Pull horizontally toward BH; lift slightly upward to overcome ground friction
        const dir = new CANNON.Vec3(dx * invDist, Math.max(dy * invDist, 0.15), dz * invDist);
        body.applyForce(dir.scale(strength), body.position);

        if (dist < 2.5) {
          let wasBuilding = false;
          for (const pb of physicsBodies) {
            if (pb.body === body) {
              wasBuilding = pb.isBuilding || false;
              scene.remove(pb.mesh);
              pb.mesh.traverse((c) => {
                if (c instanceof THREE.Mesh) {
                  c.geometry.dispose();
                  const mat = c.material as THREE.Material;
                  if (Array.isArray(mat)) mat.forEach(m => m.dispose());
                  else mat.dispose();
                }
              });
              const idx = physicsBodies.indexOf(pb);
              if (idx !== -1) physicsBodies.splice(idx, 1);
              break;
            }
          }
          world.removeBody(body);
          scoreState.totalScore += wasBuilding ? 500 : 200;
        }
      }
      scoreState.totalScore += Math.floor(dt * 10);
    } else if (bh.elapsed < BLACKHOLE_SUCK_DURATION + 0.5) {
      // Charge phase
    } else {
      // Eject: push ALL bodies outward with upward lift
      for (const body of world.bodies) {
        if (body.mass === 0) continue;
        const dx = body.position.x - bh.position.x;
        const dy = body.position.y - bh.position.y;
        const dz = body.position.z - bh.position.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < 0.3) continue;
        const strength = 12000 + dist * 400;
        const invDist = 1 / Math.max(dist, 0.01);
        const dir = new CANNON.Vec3(dx * invDist, Math.max(dy * invDist, 0.3), dz * invDist);
        body.applyForce(dir.scale(strength), body.position);
      }
      activeBlackHoles.splice(i, 1);
      if (scoreState.totalScore > scoreState.highScore) {
        scoreState.highScore = scoreState.totalScore;
        saveHighScore();
      }
    }
  }
}

export function detonateAll(
  physicsBodies: PhysicsBody[],
  debrisList: DebrisPiece[],
  scene: THREE.Scene,
): void {
  const world = getWorld();
  let totalDestroy = 0;
  let totalImpact = 0;
  let lastPos: CANNON.Vec3 | null = null;

  for (const exp of placedExplosives) {
    const { position, def, type } = exp;
    lastPos = position;

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

    totalDestroy += calcDestroyScore(physicsBodies, position, def.radius);
    totalImpact += calcImpactScore(world, position, def.radius);

    const pos3 = new THREE.Vector3(exp.position.x, 1, exp.position.z);
    switch (type) {
      case 'nitroglycerin': spawnNitroglycerinEffect(pos3); break;
      case 'c4': spawnC4Effect(pos3); break;
      case 'nuke': spawnNukeEffect(pos3); break;
      case 'cluster': spawnClusterEffect(pos3); break;
      case 'blackhole':
        spawnBlackHoleEffect(pos3);
        startBlackHolePhysics(exp.position, world);
        break;
      case 'emp': spawnEMPEffect(pos3); break;
      default: spawnTntEffect(pos3); break;
    }
  }

  const chainScore = pendingChainScore;
  pendingChainScore = 0;

  const totalScore = totalDestroy + totalImpact + chainScore;
  scoreState.totalScore += totalScore;
  if (scoreState.totalScore > scoreState.highScore) {
    scoreState.highScore = scoreState.totalScore;
    saveHighScore();
  }

  scoreState.lastScore = {
    destroyScore: totalDestroy,
    impactScore: totalImpact,
    chainScore,
  };
  scoreState.lastScorePosition = lastPos ? new THREE.Vector3(lastPos.x, 1, lastPos.z) : null;

  placedExplosives = [];
}

// Remote bombs: grouped detonation
interface RemoteBomb {
  position: CANNON.Vec3;
  group: number;
  mesh: THREE.Mesh;
}

const remoteBombs: RemoteBomb[] = [];

export function placeRemoteBomb(position: CANNON.Vec3, group: number, mesh: THREE.Mesh): void {
  remoteBombs.push({ position: position.clone(), group, mesh });
}

export function detonateGroup(group: number): THREE.Vector3[] {
  const positions: THREE.Vector3[] = [];
  for (let i = remoteBombs.length - 1; i >= 0; i--) {
    const bomb = remoteBombs[i];
    if (bomb.group === group) {
      applyExplosion({ position: bomb.position, radius: REMOTE_RADIUS, baseForce: REMOTE_FORCE });
      positions.push(new THREE.Vector3(bomb.position.x, 1, bomb.position.z));
      bomb.mesh.removeFromParent();
      bomb.mesh.geometry.dispose();
      (bomb.mesh.material as THREE.Material).dispose();
      remoteBombs.splice(i, 1);
    }
  }
  scoreState.totalScore += positions.length * 200;
  if (scoreState.totalScore > scoreState.highScore) {
    scoreState.highScore = scoreState.totalScore;
    saveHighScore();
  }
  return positions;
}

export function clearRemoteBombs(): void {
  for (const bomb of remoteBombs) {
    bomb.mesh.removeFromParent();
    bomb.mesh.geometry.dispose();
    (bomb.mesh.material as THREE.Material).dispose();
  }
  remoteBombs.length = 0;
}

// Mines
interface MineData {
  position: CANNON.Vec3;
  mesh: THREE.Group;
  armed: boolean;
}

const mines: MineData[] = [];

export function placeMine(position: CANNON.Vec3, mesh: THREE.Group): void {
  mines.push({ position: position.clone(), mesh, armed: false });
}

export function updateMines(dt: number): Array<{ position: CANNON.Vec3; mesh: THREE.Group }> {
  const triggered: Array<{ position: CANNON.Vec3; mesh: THREE.Group }> = [];
  const world = getWorld();

  for (let i = mines.length - 1; i >= 0; i--) {
    const mine = mines[i];
    if (!mine.armed) { mine.armed = true; continue; }
    let triggered_ = false;
    for (const body of world.bodies) {
      if (body.mass === 0) continue;
      const dist = body.position.distanceTo(mine.position);
      if (dist < 1.5) { triggered_ = true; break; }
    }
    if (triggered_) {
      applyExplosion({ position: mine.position, radius: MINE_RADIUS, baseForce: MINE_FORCE });
      triggered.push({ position: mine.position, mesh: mine.mesh });
      mines.splice(i, 1);
      scoreState.totalScore += 200;
      if (scoreState.totalScore > scoreState.highScore) {
        scoreState.highScore = scoreState.totalScore;
        saveHighScore();
      }
    }
  }
  return triggered;
}

export function clearMines(): void {
  for (const mine of mines) {
    mine.mesh.removeFromParent();
    mine.mesh.traverse((c) => {
      if (c instanceof THREE.Mesh) { c.geometry.dispose(); (c.material as THREE.Material).dispose(); }
    });
  }
  mines.length = 0;
}

export function clearPlacedExplosives(): void {
  placedExplosives.length = 0;
}

export function addStickmanKillScore(): void {
  scoreState.totalScore += STICKMAN_SCORE;
  if (scoreState.totalScore > scoreState.highScore) {
    scoreState.highScore = scoreState.totalScore;
    saveHighScore();
  }
}
