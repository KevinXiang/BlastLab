import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { getScene } from './renderer';
import { getWorld } from './physics';
import {
  STICKMAN_HP, STICKMAN_WALK_SPEED, STICKMAN_RUN_SPEED,
  STICKMAN_FEAR_RADIUS, STICKMAN_FEAR_DURATION,
  STICKMAN_HEIGHT, STICKMAN_RADIUS,
} from './constants';

export interface StickmanState {
  group: THREE.Group;
  body: CANNON.Body;
  hp: number;
  maxHp: number;
  state: 'idle' | 'walking' | 'fleeing';
  fearTimer: number;
  walkTarget: THREE.Vector3;
  idleTimer: number;
  alive: boolean;
}

export function createStickman(x: number, z: number, hp?: number): StickmanState {
  const scene = getScene();
  const world = getWorld();
  const maxHp = hp ?? STICKMAN_HP;

  const group = new THREE.Group();

  // Head
  const headGeo = new THREE.SphereGeometry(0.15, 8, 6);
  const headMat = new THREE.MeshToonMaterial({ color: 0xffddaa });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = STICKMAN_HEIGHT - 0.15;
  head.castShadow = true;
  group.add(head);

  // Body
  const bodyGeo = new THREE.CylinderGeometry(0.1, 0.12, 0.6, 6);
  const bodyMat = new THREE.MeshToonMaterial({ color: 0x3366cc });
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
  bodyMesh.position.y = STICKMAN_HEIGHT - 0.5;
  bodyMesh.castShadow = true;
  group.add(bodyMesh);

  // Arms
  const armGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.5, 6);
  const armMat = new THREE.MeshToonMaterial({ color: 0xffddaa });

  const leftArm = new THREE.Mesh(armGeo, armMat);
  leftArm.position.set(-0.18, STICKMAN_HEIGHT - 0.45, 0);
  leftArm.rotation.z = 0.3;
  leftArm.castShadow = true;
  group.add(leftArm);

  const rightArm = new THREE.Mesh(armGeo, armMat);
  rightArm.position.set(0.18, STICKMAN_HEIGHT - 0.45, 0);
  rightArm.rotation.z = -0.3;
  rightArm.castShadow = true;
  group.add(rightArm);

  // Legs
  const legGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.7, 6);
  const legMat = new THREE.MeshToonMaterial({ color: 0x222244 });

  const leftLeg = new THREE.Mesh(legGeo, legMat);
  leftLeg.position.set(-0.08, STICKMAN_HEIGHT - 1.1, 0);
  leftLeg.castShadow = true;
  group.add(leftLeg);

  const rightLeg = new THREE.Mesh(legGeo, legMat);
  rightLeg.position.set(0.08, STICKMAN_HEIGHT - 1.1, 0);
  rightLeg.castShadow = true;
  group.add(rightLeg);

  group.position.set(x, 0, z);
  scene.add(group);

  // Physics
  const shape = new CANNON.Cylinder(STICKMAN_RADIUS, STICKMAN_RADIUS, STICKMAN_HEIGHT, 6);
  const body = new CANNON.Body({ mass: 70, shape });
  body.position.set(x, STICKMAN_HEIGHT / 2, z);
  body.linearDamping = 0.5;
  body.angularDamping = 0.9;
  world.addBody(body);

  return {
    group, body, hp: maxHp, maxHp,
    state: 'idle', fearTimer: 0,
    walkTarget: new THREE.Vector3(x, 0, z),
    idleTimer: Math.random() * 2,
    alive: true,
  };
}

export function damageStickman(sm: StickmanState, amount: number): boolean {
  if (!sm.alive) return false;
  sm.hp -= amount;
  // Flash red briefly
  sm.group.traverse((c) => {
    if (c instanceof THREE.Mesh) {
      const mat = c.material as THREE.MeshToonMaterial;
      const orig = mat.color.getHex();
      mat.color.setHex(0xff0000);
      setTimeout(() => { mat.color.setHex(orig); }, 100);
    }
  });
  if (sm.hp <= 0) {
    sm.alive = false;
    return true;
  }
  return false;
}

export function updateStickman(
  sm: StickmanState,
  dt: number,
  dangerSources: Array<{ pos: THREE.Vector3; radius: number }>,
): void {
  if (!sm.alive) return;

  const pos = new THREE.Vector3(sm.body.position.x, sm.body.position.y, sm.body.position.z);

  // Check for danger
  let nearestDanger = Infinity;
  let dangerDir = new THREE.Vector3();
  for (const d of dangerSources) {
    const dist = pos.distanceTo(d.pos);
    if (dist < d.radius + STICKMAN_FEAR_RADIUS && dist < nearestDanger) {
      nearestDanger = dist;
      dangerDir = pos.clone().sub(d.pos).normalize();
    }
  }

  if (nearestDanger < Infinity) {
    sm.state = 'fleeing';
    sm.fearTimer = STICKMAN_FEAR_DURATION;
  } else if (sm.fearTimer > 0) {
    sm.fearTimer -= dt;
    if (sm.fearTimer <= 0) {
      sm.state = 'idle';
      sm.idleTimer = 1 + Math.random() * 2;
    }
  }

  // Movement
  let speed = 0;
  let moveDir = new THREE.Vector3();

  if (sm.state === 'fleeing') {
    speed = STICKMAN_RUN_SPEED;
    moveDir = dangerDir;
  } else if (sm.state === 'walking') {
    speed = STICKMAN_WALK_SPEED;
    const toTarget = sm.walkTarget.clone().sub(pos);
    const dist = toTarget.length();
    if (dist < 0.3) {
      sm.state = 'idle';
      sm.idleTimer = 1 + Math.random() * 3;
    } else {
      moveDir = toTarget.normalize();
    }
  } else {
    sm.idleTimer -= dt;
    if (sm.idleTimer <= 0) {
      sm.state = 'walking';
      const angle = Math.random() * Math.PI * 2;
      const dist = 3 + Math.random() * 8;
      sm.walkTarget.set(pos.x + Math.cos(angle) * dist, 0, pos.z + Math.sin(angle) * dist);
    }
  }

  if (speed > 0 && moveDir.length() > 0.01) {
    sm.body.velocity.x = moveDir.x * speed;
    sm.body.velocity.z = moveDir.z * speed;
    sm.group.rotation.y = Math.atan2(moveDir.x, moveDir.z);
  } else {
    sm.body.velocity.x *= 0.9;
    sm.body.velocity.z *= 0.9;
  }

  // Sync mesh to physics
  sm.group.position.copy(sm.body.position as any);
  sm.group.position.y -= STICKMAN_HEIGHT / 2;
  sm.group.quaternion.copy(sm.body.quaternion as any);

  // Keep upright
  const q = sm.body.quaternion;
  if (Math.abs(q.x) > 0.1 || Math.abs(q.z) > 0.1) {
    q.x *= 0.9;
    q.z *= 0.9;
    q.normalize();
  }
}
