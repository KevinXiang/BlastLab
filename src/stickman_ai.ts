import * as THREE from 'three';
import { StickmanState } from './stickman';
import { BarracksState } from './barracks';
import { PhysicsBody } from './physics';
import {
  AI_GRID_RESOLUTION, AI_MAX_SEARCH_STEPS,
  AI_SEPARATION_RADIUS, AI_SEPARATION_WEIGHT,
  AI_COHESION_RADIUS, AI_COHESION_WEIGHT,
  AI_PATH_RECALC_INTERVAL,
  STICKMAN_WALK_SPEED, STICKMAN_RUN_SPEED,
  STICKMAN_ROAD_SPEED_BONUS,
  FEAR_EXPLOSION, FEAR_WITNESS_DEATH, FEAR_WITNESS_FLEE,
  FEAR_DECAY_RATE, FEAR_NEAR_BARRACKS_DECAY, FEAR_NEAR_ALLIES_DECAY,
  FEAR_FLEE_THRESHOLD, FEAR_RECOVER_THRESHOLD,
  FEAR_PROPAGATION_RADIUS, FEAR_PROPAGATION_COOLDOWN,
  MORALE_DEATH_PENALTY, MORALE_BARRACKS_DAMAGE,
  MORALE_EXPLOSION_NEAR, MORALE_KILL_BONUS,
  MORALE_LOW_THRESHOLD, MORALE_HIGH_THRESHOLD,
  MORALE_COOLDOWN,
  WORLD_SIZE, ROAD_WIDTH,
} from './constants';

// ============================================================
// Types
// ============================================================

export interface AIState {
  stickman: StickmanState;
  barracks: BarracksState | null;
  fear: number;
  fearTimer: number;
  targetPos: THREE.Vector3;
  idleTimer: number;
  pathWaypoints: THREE.Vector3[];
  pathRecalcTimer: number;
  lastFearPropagationTime: number;
  moveDir: THREE.Vector3;
  moveSpeed: number;
}

export type MoraleEvent =
  | { type: 'explosion'; pos: THREE.Vector3; radius: number }
  | { type: 'stickman_death'; pos: THREE.Vector3; stickman: StickmanState }
  | { type: 'enemy_kill'; pos: THREE.Vector3 }
  | { type: 'barracks_damage'; barracks: BarracksState };

// ============================================================
// Occupancy Grid
// ============================================================

let occupancyGrid: GridCell[][] = [];
let gridRebuildTimer = 0;
let dynamicObstacles: Array<{ pos: THREE.Vector3; radius: number }> = [];

interface GridCell {
  blocked: boolean;
  roadBonus: boolean;
  roadNearby: boolean;
}

const GRID_SIZE = Math.floor(WORLD_SIZE / AI_GRID_RESOLUTION);

function worldToGrid(worldPos: number): number {
  const halfWorld = WORLD_SIZE / 2;
  return Math.floor((worldPos + halfWorld) / AI_GRID_RESOLUTION);
}

function gridToWorld(gridPos: number): number {
  const halfWorld = WORLD_SIZE / 2;
  return gridPos * AI_GRID_RESOLUTION - halfWorld + AI_GRID_RESOLUTION / 2;
}

function isOnRoad(wx: number, wz: number): boolean {
  const halfRoad = ROAD_WIDTH / 2;
  return Math.abs(wx) < halfRoad || Math.abs(wz) < halfRoad;
}

export function rebuildOccupancyGrid(physicsBodies: PhysicsBody[]): void {
  const halfRoad = ROAD_WIDTH / 2;

  occupancyGrid = [];
  for (let gx = 0; gx < GRID_SIZE; gx++) {
    occupancyGrid[gx] = [];
    for (let gz = 0; gz < GRID_SIZE; gz++) {
      const wx = gridToWorld(gx);
      const wz = gridToWorld(gz);
      const onRoad = Math.abs(wx) < halfRoad || Math.abs(wz) < halfRoad;
      const nearRoad = (Math.abs(wx) < halfRoad + 2 || Math.abs(wz) < halfRoad + 2) && !onRoad;
      occupancyGrid[gx][gz] = {
        blocked: false,
        roadBonus: onRoad,
        roadNearby: nearRoad,
      };
    }
  }

  for (const pb of physicsBodies) {
    if (!pb.isBuilding) continue;
    const pos = pb.body.position;
    const halfW = 2;
    const halfD = 2;
    const minGx = Math.max(0, worldToGrid(pos.x - halfW));
    const maxGx = Math.min(GRID_SIZE - 1, worldToGrid(pos.x + halfW));
    const minGz = Math.max(0, worldToGrid(pos.z - halfD));
    const maxGz = Math.min(GRID_SIZE - 1, worldToGrid(pos.z + halfD));
    for (let gx = minGx; gx <= maxGx; gx++) {
      for (let gz = minGz; gz <= maxGz; gz++) {
        occupancyGrid[gx][gz].blocked = true;
      }
    }
  }

  for (const obs of dynamicObstacles) {
    const obsGx = worldToGrid(obs.pos.x);
    const obsGz = worldToGrid(obs.pos.z);
    const obsRadius = Math.ceil(obs.radius / AI_GRID_RESOLUTION);
    for (let gx = obsGx - obsRadius; gx <= obsGx + obsRadius; gx++) {
      for (let gz = obsGz - obsRadius; gz <= obsGz + obsRadius; gz++) {
        if (gx >= 0 && gx < GRID_SIZE && gz >= 0 && gz < GRID_SIZE) {
          occupancyGrid[gx][gz].blocked = true;
        }
      }
    }
  }
}

export function setDynamicObstacles(obstacles: Array<{ pos: THREE.Vector3; radius: number }>): void {
  dynamicObstacles = obstacles;
}

function getGridCost(gx: number, gz: number): number {
  if (gx < 0 || gx >= GRID_SIZE || gz < 0 || gz >= GRID_SIZE) return Infinity;
  const cell = occupancyGrid[gx]?.[gz];
  if (!cell || cell.blocked) return Infinity;
  if (cell.roadBonus) return 0.7;
  if (cell.roadNearby) return 0.85;
  return 1.0;
}

// ============================================================
// A* Pathfinding
// ============================================================

interface AStarNode {
  gx: number; gz: number;
  g: number; h: number; f: number;
  parent: AStarNode | null;
}

function aStar(sx: number, sz: number, gx: number, gz: number): THREE.Vector3[] | null {
  const startGx = worldToGrid(sx);
  const startGz = worldToGrid(sz);
  const goalGx = worldToGrid(gx);
  const goalGz = worldToGrid(gz);

  if (getGridCost(startGx, startGz) === Infinity) return null;
  if (getGridCost(goalGx, goalGz) === Infinity) return null;
  if (startGx === goalGx && startGz === goalGz) return [new THREE.Vector3(gx, 0, gz)];

  const openSet: AStarNode[] = [];
  const closedSet = new Set<string>();
  const key = (x: number, z: number) => `${x},${z}`;

  const startNode: AStarNode = {
    gx: startGx, gz: startGz,
    g: 0, h: heuristic(startGx, startGz, goalGx, goalGz),
    f: 0, parent: null,
  };
  startNode.f = startNode.g + startNode.h;
  openSet.push(startNode);

  const dirs = [
    { dx: 0, dz: 1, cost: 1 }, { dx: 1, dz: 0, cost: 1 },
    { dx: 0, dz: -1, cost: 1 }, { dx: -1, dz: 0, cost: 1 },
    { dx: 1, dz: 1, cost: 1.4 }, { dx: 1, dz: -1, cost: 1.4 },
    { dx: -1, dz: 1, cost: 1.4 }, { dx: -1, dz: -1, cost: 1.4 },
  ];

  let steps = 0;
  while (openSet.length > 0 && steps < AI_MAX_SEARCH_STEPS) {
    steps++;
    let bestIdx = 0;
    for (let i = 1; i < openSet.length; i++) {
      if (openSet[i].f < openSet[bestIdx].f) bestIdx = i;
    }
    const current = openSet.splice(bestIdx, 1)[0];

    if (current.gx === goalGx && current.gz === goalGz) {
      return simplifyPath(retracePath(current));
    }

    closedSet.add(key(current.gx, current.gz));

    for (const dir of dirs) {
      const ngx = current.gx + dir.dx;
      const ngz = current.gz + dir.dz;
      if (closedSet.has(key(ngx, ngz))) continue;

      const cellCost = getGridCost(ngx, ngz);
      if (cellCost === Infinity) continue;

      const moveCost = dir.cost * cellCost;
      const ng = current.g + moveCost;
      const nh = heuristic(ngx, ngz, goalGx, goalGz);

      const existing = openSet.find(n => n.gx === ngx && n.gz === ngz);
      if (existing) {
        if (ng < existing.g) {
          existing.g = ng;
          existing.f = ng + nh;
          existing.parent = current;
        }
      } else {
        openSet.push({ gx: ngx, gz: ngz, g: ng, h: nh, f: ng + nh, parent: current });
      }
    }
  }

  return [new THREE.Vector3(gx, 0, gz)];
}

function heuristic(ax: number, az: number, bx: number, bz: number): number {
  const dx = Math.abs(ax - bx);
  const dz = Math.abs(az - bz);
  return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz);
}

function retracePath(node: AStarNode): THREE.Vector3[] {
  const path: THREE.Vector3[] = [];
  let current: AStarNode | null = node;
  while (current) {
    path.push(new THREE.Vector3(gridToWorld(current.gx), 0, gridToWorld(current.gz)));
    current = current.parent;
  }
  path.reverse();
  return path;
}

function simplifyPath(path: THREE.Vector3[]): THREE.Vector3[] {
  if (path.length <= 2) return path;
  const result: THREE.Vector3[] = [path[0]];
  for (let i = 1; i < path.length - 1; i++) {
    const prev = path[i - 1];
    const curr = path[i];
    const next = path[i + 1];
    const dir1 = new THREE.Vector3(curr.x - prev.x, 0, curr.z - prev.z).normalize();
    const dir2 = new THREE.Vector3(next.x - curr.x, 0, next.z - curr.z).normalize();
    if (dir1.dot(dir2) < 0.95) {
      result.push(curr);
    }
  }
  result.push(path[path.length - 1]);
  return result;
}

// ============================================================
// Steering Behaviors
// ============================================================

function pickInterestPoint(smAI: AIState, aiStates: AIState[]): THREE.Vector3 {
  const roll = Math.random();
  const pos = smAI.stickman.body.position;

  if (roll < 0.3) {
    for (let attempt = 0; attempt < 10; attempt++) {
      const rx = (Math.random() - 0.5) * WORLD_SIZE * 0.9;
      const rz = (Math.random() - 0.5) * WORLD_SIZE * 0.9;
      if (isOnRoad(rx, rz)) {
        return new THREE.Vector3(rx, 0, rz);
      }
    }
    return new THREE.Vector3(
      (Math.random() - 0.5) * WORLD_SIZE * 0.8, 0,
      (Math.random() - 0.5) * WORLD_SIZE * 0.8,
    );
  } else if (roll < 0.6) {
    if (smAI.barracks) {
      const mates = aiStates.filter(a => a.barracks === smAI.barracks && a !== smAI && a.stickman.alive);
      if (mates.length > 0) {
        let cx = 0, cz = 0;
        for (const m of mates) {
          cx += m.stickman.body.position.x;
          cz += m.stickman.body.position.z;
        }
        cx /= mates.length; cz /= mates.length;
        const offset = 3 + Math.random() * 8;
        const angle = Math.random() * Math.PI * 2;
        return new THREE.Vector3(cx + Math.cos(angle) * offset, 0, cz + Math.sin(angle) * offset);
      }
    }
    return new THREE.Vector3(
      pos.x + (Math.random() - 0.5) * 16, 0,
      pos.z + (Math.random() - 0.5) * 16,
    );
  } else {
    return new THREE.Vector3(
      (Math.random() - 0.5) * WORLD_SIZE * 0.8, 0,
      (Math.random() - 0.5) * WORLD_SIZE * 0.8,
    );
  }
}

function computeSteering(smAI: AIState, aiStates: AIState[]): { moveDir: THREE.Vector3; moveSpeed: number } {
  const sm = smAI.stickman;
  const pos = new THREE.Vector3(sm.body.position.x, 0, sm.body.position.z);
  const forces: THREE.Vector3[] = [];

  // Seek toward next waypoint
  if (smAI.pathWaypoints.length > 0) {
    const wp = smAI.pathWaypoints[0];
    const toWp = new THREE.Vector3(wp.x - pos.x, 0, wp.z - pos.z);
    if (toWp.length() < 0.5) {
      smAI.pathWaypoints.shift();
    }
    if (smAI.pathWaypoints.length > 0) {
      const nextWp = smAI.pathWaypoints[0];
      forces.push(new THREE.Vector3(nextWp.x - pos.x, 0, nextWp.z - pos.z).normalize().multiplyScalar(1.0));
    }
  }

  // Separation
  const sepForce = new THREE.Vector3();
  let sepCount = 0;
  for (const other of aiStates) {
    if (other === smAI || !other.stickman.alive) continue;
    const otherPos = new THREE.Vector3(other.stickman.body.position.x, 0, other.stickman.body.position.z);
    const dist = pos.distanceTo(otherPos);
    if (dist < AI_SEPARATION_RADIUS && dist > 0.01) {
      sepForce.add(pos.clone().sub(otherPos).normalize().divideScalar(dist));
      sepCount++;
    }
  }
  if (sepCount > 0) {
    forces.push(sepForce.normalize().multiplyScalar(AI_SEPARATION_WEIGHT));
  }

  // Cohesion toward barracks mates
  if (smAI.barracks) {
    const mates = aiStates.filter(a => a.barracks === smAI.barracks && a !== smAI && a.stickman.alive);
    if (mates.length > 0) {
      let cx = 0, cz = 0;
      for (const m of mates) {
        cx += m.stickman.body.position.x;
        cz += m.stickman.body.position.z;
      }
      cx /= mates.length; cz /= mates.length;
      const toCenter = new THREE.Vector3(cx - pos.x, 0, cz - pos.z);
      if (toCenter.length() > AI_COHESION_RADIUS) {
        forces.push(toCenter.normalize().multiplyScalar(AI_COHESION_WEIGHT));
      }
    }
  }

  const finalDir = new THREE.Vector3();
  if (forces.length === 0) {
    return { moveDir: new THREE.Vector3(), moveSpeed: 0 };
  }
  for (const f of forces) finalDir.add(f);
  finalDir.normalize();

  let speed = sm.state === 'fleeing' ? STICKMAN_RUN_SPEED : STICKMAN_WALK_SPEED;
  if (isOnRoad(pos.x, pos.z)) speed *= STICKMAN_ROAD_SPEED_BONUS;

  return { moveDir: finalDir, moveSpeed: speed };
}

// ============================================================
// Fear System
// ============================================================

function updateFear(smAI: AIState, dt: number, aiStates: AIState[]): void {
  const sm = smAI.stickman;
  const pos = new THREE.Vector3(sm.body.position.x, 0, sm.body.position.z);

  smAI.fear = Math.max(0, smAI.fear - FEAR_DECAY_RATE * dt);

  if (smAI.barracks) {
    const bp = smAI.barracks.body.position;
    const distToBarracks = Math.sqrt((pos.x - bp.x) ** 2 + (pos.z - bp.z) ** 2);
    if (distToBarracks < 8) {
      smAI.fear = Math.max(0, smAI.fear - FEAR_NEAR_BARRACKS_DECAY * dt);
    }
  }

  let nearbyAllies = 0;
  for (const other of aiStates) {
    if (other === smAI || !other.stickman.alive) continue;
    const op = new THREE.Vector3(other.stickman.body.position.x, 0, other.stickman.body.position.z);
    if (pos.distanceTo(op) < 5) nearbyAllies++;
  }
  if (nearbyAllies >= 3) {
    smAI.fear = Math.max(0, smAI.fear - FEAR_NEAR_ALLIES_DECAY * dt);
  }
}

export function propagateFear(aiStates: AIState[], now: number): void {
  for (const smAI of aiStates) {
    if (!smAI.stickman.alive) continue;
    if (smAI.fear < 50) continue;
    if (now - smAI.lastFearPropagationTime < FEAR_PROPAGATION_COOLDOWN) continue;

    const pos = new THREE.Vector3(
      smAI.stickman.body.position.x, 0, smAI.stickman.body.position.z,
    );

    for (const other of aiStates) {
      if (other === smAI || !other.stickman.alive) continue;
      if (other.stickman.state === 'fleeing') continue;
      const op = new THREE.Vector3(
        other.stickman.body.position.x, 0, other.stickman.body.position.z,
      );
      if (pos.distanceTo(op) < FEAR_PROPAGATION_RADIUS) {
        other.fear = Math.min(100, other.fear + FEAR_WITNESS_FLEE);
        other.lastFearPropagationTime = now;
      }
    }
    smAI.lastFearPropagationTime = now;
  }
}

// ============================================================
// Morale Events
// ============================================================

export function processMoraleEvents(
  events: MoraleEvent[],
  aiStates: AIState[],
  barracksList: BarracksState[],
  now: number,
): void {
  for (const event of events) {
    switch (event.type) {
      case 'explosion': {
        for (const smAI of aiStates) {
          if (!smAI.stickman.alive) continue;
          const pos = new THREE.Vector3(
            smAI.stickman.body.position.x, 0, smAI.stickman.body.position.z,
          );
          if (pos.distanceTo(event.pos) < event.radius) {
            smAI.fear = Math.min(100, smAI.fear + FEAR_EXPLOSION);
          }
        }
        for (const b of barracksList) {
          if (!b.alive) continue;
          const bp = b.body.position;
          const dist = Math.sqrt((bp.x - event.pos.x) ** 2 + (bp.z - event.pos.z) ** 2);
          if (dist < 15 && now - b.lastMoraleEventTime > MORALE_COOLDOWN) {
            b.morale = Math.max(0, b.morale - MORALE_EXPLOSION_NEAR);
            b.lastMoraleEventTime = now;
          }
        }
        break;
      }
      case 'stickman_death': {
        for (const smAI of aiStates) {
          if (!smAI.stickman.alive || smAI.stickman === event.stickman) continue;
          const pos = new THREE.Vector3(
            smAI.stickman.body.position.x, 0, smAI.stickman.body.position.z,
          );
          if (pos.distanceTo(event.pos) < 10) {
            smAI.fear = Math.min(100, smAI.fear + FEAR_WITNESS_DEATH);
          }
        }
        for (const b of barracksList) {
          if (!b.alive) continue;
          if (aiStates.find(a => a.stickman === event.stickman && a.barracks === b)) {
            b.morale = Math.max(0, b.morale - MORALE_DEATH_PENALTY);
          }
        }
        break;
      }
      case 'enemy_kill': {
        for (const b of barracksList) {
          if (!b.alive) continue;
          b.morale = Math.min(100, b.morale + MORALE_KILL_BONUS);
        }
        break;
      }
      case 'barracks_damage': {
        if (now - event.barracks.lastMoraleEventTime > MORALE_COOLDOWN) {
          event.barracks.morale = Math.max(0, event.barracks.morale - MORALE_BARRACKS_DAMAGE);
          event.barracks.lastMoraleEventTime = now;
        }
        break;
      }
    }
  }
}

// ============================================================
// Pre-update & AI update
// ============================================================

export function preUpdateAI(
  dt: number,
  aiStates: AIState[],
  barracksList: BarracksState[],
  moraleEvents: MoraleEvent[],
  physicsBodies: PhysicsBody[],
  now: number,
): void {
  gridRebuildTimer += dt;
  if (gridRebuildTimer >= 5) {
    gridRebuildTimer = 0;
    rebuildOccupancyGrid(physicsBodies);
  }

  if (moraleEvents.length > 0) {
    processMoraleEvents(moraleEvents, aiStates, barracksList, now);
    moraleEvents.length = 0;
  }

  propagateFear(aiStates, now);
}

export function updateStickmanAI(smAI: AIState, dt: number, aiStates: AIState[]): void {
  const sm = smAI.stickman;
  if (!sm.alive) return;

  const pos = new THREE.Vector3(sm.body.position.x, 0, sm.body.position.z);

  updateFear(smAI, dt, aiStates);

  if (smAI.fear > FEAR_FLEE_THRESHOLD) {
    sm.state = 'fleeing';
    smAI.fearTimer = 3;
  } else if (sm.state === 'fleeing' && smAI.fear < FEAR_RECOVER_THRESHOLD) {
    smAI.fearTimer -= dt;
    if (smAI.fearTimer <= 0) {
      sm.state = 'idle';
      smAI.idleTimer = 1 + Math.random() * 3;
      smAI.pathWaypoints = [];
    }
  }

  smAI.pathRecalcTimer -= dt;

  if (sm.state === 'idle') {
    smAI.idleTimer -= dt;
    if (smAI.idleTimer <= 0) {
      sm.state = 'walking';
      smAI.targetPos = pickInterestPoint(smAI, aiStates);
      smAI.pathWaypoints = aStar(pos.x, pos.z, smAI.targetPos.x, smAI.targetPos.z) || [
        new THREE.Vector3(smAI.targetPos.x, 0, smAI.targetPos.z),
      ];
      smAI.pathRecalcTimer = AI_PATH_RECALC_INTERVAL;
    }
  } else if (sm.state === 'walking') {
    if (pos.distanceTo(smAI.targetPos) < 0.5) {
      sm.state = 'idle';
      smAI.idleTimer = 1 + Math.random() * 4;
      smAI.pathWaypoints = [];
    } else if (smAI.pathRecalcTimer <= 0) {
      smAI.pathWaypoints = aStar(pos.x, pos.z, smAI.targetPos.x, smAI.targetPos.z) || [
        new THREE.Vector3(smAI.targetPos.x, 0, smAI.targetPos.z),
      ];
      smAI.pathRecalcTimer = AI_PATH_RECALC_INTERVAL;
    }
  } else if (sm.state === 'fleeing') {
    if (smAI.barracks) {
      const bp = smAI.barracks.body.position;
      smAI.targetPos = new THREE.Vector3(bp.x, 0, bp.z);
    } else {
      const fleeDir = new THREE.Vector3(
        pos.x - smAI.targetPos.x, 0, pos.z - smAI.targetPos.z,
      ).normalize();
      if (fleeDir.length() < 0.01) {
        fleeDir.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
      }
      smAI.targetPos = pos.clone().add(fleeDir.multiplyScalar(20));
    }
    if (smAI.pathRecalcTimer <= 0) {
      smAI.pathWaypoints = aStar(pos.x, pos.z, smAI.targetPos.x, smAI.targetPos.z) || [
        new THREE.Vector3(smAI.targetPos.x, 0, smAI.targetPos.z),
      ];
      smAI.pathRecalcTimer = AI_PATH_RECALC_INTERVAL;
    }
  }

  const steer = computeSteering(smAI, aiStates);
  smAI.moveDir = steer.moveDir;
  smAI.moveSpeed = steer.moveSpeed;
}

export function createAIState(sm: StickmanState, barracks: BarracksState | null): AIState {
  return {
    stickman: sm,
    barracks,
    fear: barracks && barracks.morale < MORALE_LOW_THRESHOLD ? 20 : 0,
    fearTimer: 0,
    targetPos: new THREE.Vector3(sm.body.position.x, 0, sm.body.position.z),
    idleTimer: Math.random() * 2,
    pathWaypoints: [],
    pathRecalcTimer: 0,
    lastFearPropagationTime: 0,
    moveDir: new THREE.Vector3(),
    moveSpeed: 0,
  };
}
