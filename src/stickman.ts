import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { getScene } from './renderer';
import { getWorld } from './physics';
import {
  STICKMAN_HP, STICKMAN_WALK_SPEED, STICKMAN_RUN_SPEED,
  STICKMAN_HEIGHT, STICKMAN_RADIUS,
  ANIM_WALK_FREQ, ANIM_RUN_FREQ,
  ANIM_WALK_AMP, ANIM_RUN_AMP,
  ANIM_ARM_AMP, ANIM_ARM_RUN_AMP,
  ANIM_BOB_HEIGHT, ANIM_BOB_RUN_HEIGHT,
  STICKMAN_ACCEL, STICKMAN_RUN_ACCEL, STICKMAN_TURN_SPEED,
} from './constants';

export interface StickmanState {
  group: THREE.Group;
  body: CANNON.Body;
  hp: number;
  maxHp: number;
  state: 'idle' | 'walking' | 'fleeing' | 'combat_melee' | 'combat_ranged';
  alive: boolean;
  faction: 'red' | 'blue';
  healthBar: { bg: THREE.Mesh; fill: THREE.Mesh } | null;
  attackAnimTimer: number;
  deathType: 'none' | 'bomb' | 'combat';
  partRefs: Map<string, THREE.Object3D>;
  animTime: number;
  animPhase: number;
  deathTimer: number;
  isDeadReadyCleanup: boolean;
}

export function createStickman(x: number, z: number, faction: 'red' | 'blue', hp?: number): StickmanState {
  const scene = getScene();
  const world = getWorld();
  const maxHp = hp ?? STICKMAN_HP;
  const bodyColor = faction === 'red' ? 0xcc3333 : 0x3366cc;

  const group = new THREE.Group();

  // Head
  const headGeo = new THREE.SphereGeometry(0.15, 8, 6);
  const headMat = new THREE.MeshToonMaterial({ color: 0xffddaa });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = STICKMAN_HEIGHT - 0.15;
  head.castShadow = true;
  head.userData.name = 'head';
  group.add(head);

  // Body
  const bodyGeo = new THREE.CylinderGeometry(0.1, 0.12, 0.6, 6);
  const bodyMat = new THREE.MeshToonMaterial({ color: bodyColor });
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
  bodyMesh.position.y = STICKMAN_HEIGHT - 0.5;
  bodyMesh.castShadow = true;
  bodyMesh.userData.name = 'body';
  bodyMesh.userData.baseY = STICKMAN_HEIGHT - 0.5;
  group.add(bodyMesh);

  // Arms
  const armGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.5, 6);
  const armMat = new THREE.MeshToonMaterial({ color: 0xffddaa });

  const leftArm = new THREE.Mesh(armGeo, armMat);
  leftArm.position.set(-0.18, STICKMAN_HEIGHT - 0.45, 0);
  leftArm.rotation.z = 0.3;
  leftArm.castShadow = true;
  leftArm.userData.name = 'leftArm';
  group.add(leftArm);

  const rightArm = new THREE.Mesh(armGeo, armMat);
  rightArm.position.set(0.18, STICKMAN_HEIGHT - 0.45, 0);
  rightArm.rotation.z = -0.3;
  rightArm.castShadow = true;
  rightArm.userData.name = 'rightArm';
  group.add(rightArm);

  // Legs
  const legGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.7, 6);
  const legMat = new THREE.MeshToonMaterial({ color: 0x222244 });

  const leftLeg = new THREE.Mesh(legGeo, legMat);
  leftLeg.position.set(-0.08, STICKMAN_HEIGHT - 1.1, 0);
  leftLeg.castShadow = true;
  leftLeg.userData.name = 'leftLeg';
  group.add(leftLeg);

  const rightLeg = new THREE.Mesh(legGeo, legMat);
  rightLeg.position.set(0.08, STICKMAN_HEIGHT - 1.1, 0);
  rightLeg.castShadow = true;
  rightLeg.userData.name = 'rightLeg';
  group.add(rightLeg);

  // Health bar (billboard)
  const barBgGeo = new THREE.PlaneGeometry(0.6, 0.06);
  const barBgMat = new THREE.MeshBasicMaterial({ color: 0x333333, transparent: true, opacity: 0.7, depthTest: false });
  const barBg = new THREE.Mesh(barBgGeo, barBgMat);
  barBg.position.y = STICKMAN_HEIGHT + 0.25;
  barBg.renderOrder = 999;

  const barFillGeo = new THREE.PlaneGeometry(0.58, 0.04);
  const barFillMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, depthTest: false });
  const barFill = new THREE.Mesh(barFillGeo, barFillMat);
  barFill.position.z = 0.002;
  barFill.renderOrder = 1000;

  barBg.add(barFill);
  group.add(barBg);

  // Build part refs map
  const partRefs = new Map<string, THREE.Object3D>();
  group.traverse((c) => {
    if (c.userData.name) partRefs.set(c.userData.name as string, c);
  });

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
    state: 'idle',
    alive: true,
    faction,
    healthBar: { bg: barBg, fill: barFill },
    attackAnimTimer: 0,
    deathType: 'none',
    partRefs,
    animTime: 0,
    animPhase: Math.random() * Math.PI * 2,
    deathTimer: 0,
    isDeadReadyCleanup: false,
  };
}

export function damageStickman(sm: StickmanState, amount: number, source: 'bomb' | 'combat' = 'bomb'): boolean {
  if (!sm.alive) return false;
  sm.hp -= amount;

  // Update health bar
  if (sm.healthBar) {
    const pct = Math.max(0, sm.hp / sm.maxHp);
    sm.healthBar.fill.scale.x = Math.max(0.01, pct);
    const r = pct < 0.5 ? 1 : 2 * (1 - pct);
    const g = pct > 0.5 ? 1 : 2 * pct;
    (sm.healthBar.fill.material as THREE.MeshBasicMaterial).color.setRGB(r, g, 0);
  }

  // Flash red briefly
  sm.group.traverse((c) => {
    if (c instanceof THREE.Mesh && (c.material as THREE.MeshToonMaterial).color) {
      const mat = c.material as THREE.MeshToonMaterial;
      const orig = mat.color.getHex();
      mat.color.setHex(0xff0000);
      setTimeout(() => { mat.color.setHex(orig); }, 100);
    }
  });
  if (sm.hp <= 0) {
    sm.alive = false;
    sm.deathType = source;

    if (source === 'combat') {
      // Corpse: gray body, stay forever
      sm.deathTimer = -1;
      const bodyMesh = sm.partRefs?.get('body');
      if (bodyMesh) (bodyMesh as THREE.Mesh).material = new THREE.MeshToonMaterial({ color: 0x666666 });
      const headMesh = sm.partRefs?.get('head');
      if (headMesh) (headMesh as THREE.Mesh).material = new THREE.MeshToonMaterial({ color: 0x999999 });
      if (sm.healthBar) sm.healthBar.bg.visible = false;
      sm.body.mass = 0;
    } else {
      sm.deathTimer = 0.5;
    }
    const { partRefs } = sm;
    if (partRefs) {
      for (const part of partRefs.values()) {
        if (part.userData.name !== 'head' && part.userData.name !== 'body') {
          part.rotation.x = 0;
        }
      }
    }
    return true;
  }
  return false;
}

export function triggerAttackAnim(sm: StickmanState, _isMelee: boolean): void {
  sm.attackAnimTimer = 0.15;
}

export function updateStickmanDeath(sm: StickmanState, dt: number): void {
  if (sm.alive || sm.deathTimer <= 0) return;
  sm.deathTimer -= dt;
  sm.body.angularDamping = 0.1;
  if (sm.deathTimer <= 0) {
    sm.isDeadReadyCleanup = true;
  }
}

export function updateStickmanAnimation(sm: StickmanState, dt: number, speed: number): void {
  const { partRefs } = sm;
  if (!partRefs || partRefs.size === 0) return;

  const leftLeg = partRefs.get('leftLeg');
  const rightLeg = partRefs.get('rightLeg');
  const leftArm = partRefs.get('leftArm');
  const rightArm = partRefs.get('rightArm');
  const bodyMesh = partRefs.get('body');

  const isMoving = speed > 0.1;
  const isAttacking = sm.attackAnimTimer > 0;
  if (isAttacking) sm.attackAnimTimer -= dt;

  if (!sm.alive) {
    if (leftLeg) leftLeg.rotation.x = 0;
    if (rightLeg) rightLeg.rotation.x = 0;
    if (leftArm) leftArm.rotation.x = 0;
    if (rightArm) rightArm.rotation.x = 0;
    return;
  }

  sm.animTime += dt * Math.max(speed / STICKMAN_WALK_SPEED, 0.2) * ANIM_WALK_FREQ;

  if (isMoving) {
    const isRunning = sm.state === 'fleeing';
    const legAmp = isRunning ? ANIM_RUN_AMP : ANIM_WALK_AMP;
    const armAmp = isRunning ? ANIM_ARM_RUN_AMP : ANIM_ARM_AMP;
    const bobHeight = isRunning ? ANIM_BOB_RUN_HEIGHT : ANIM_BOB_HEIGHT;
    const cycle = sm.animTime + sm.animPhase;

    if (leftLeg) leftLeg.rotation.x = Math.sin(cycle) * legAmp;
    if (rightLeg) rightLeg.rotation.x = Math.sin(cycle + Math.PI) * legAmp;
    if (leftArm) leftArm.rotation.x = Math.sin(cycle + Math.PI) * armAmp;
    if (rightArm) rightArm.rotation.x = Math.sin(cycle) * armAmp;

    if (bodyMesh) {
      const baseY = bodyMesh.userData.baseY as number;
      if (baseY !== undefined) {
        bodyMesh.position.y = baseY + Math.abs(Math.sin(cycle * 2)) * bobHeight;
      }
    }
  } else {
    const sway = Math.sin(sm.animTime * 2) * 0.02;
    if (leftLeg) leftLeg.rotation.x = sway;
    if (rightLeg) rightLeg.rotation.x = -sway;
    if (leftArm) leftArm.rotation.x = sway * 0.5;
    if (rightArm) rightArm.rotation.x = -sway * 0.5;
    if (bodyMesh) {
      const baseY = bodyMesh.userData.baseY as number;
      if (baseY !== undefined) {
        bodyMesh.position.y += (baseY - bodyMesh.position.y) * 0.1;
      }
    }
  }

  // Combat attack punch
  if (isAttacking && rightArm) {
    const t = sm.attackAnimTimer / 0.15;
    rightArm.rotation.x = -0.8 * Math.sin(t * Math.PI);
  }
}

export function updateStickmanMotion(
  sm: StickmanState,
  targetDir: THREE.Vector3,
  targetSpeed: number,
  dt: number,
): void {
  if (!sm.alive) return;

  const hasTarget = targetSpeed > 0.01 && targetDir.length() > 0.01;
  const accel = sm.state === 'fleeing' ? STICKMAN_RUN_ACCEL : STICKMAN_ACCEL;
  const t = 1 - Math.exp(-accel * dt * 2);

  if (hasTarget) {
    sm.body.velocity.x += (targetDir.x * targetSpeed - sm.body.velocity.x) * t;
    sm.body.velocity.z += (targetDir.z * targetSpeed - sm.body.velocity.z) * t;
  } else {
    sm.body.velocity.x *= 1 - t;
    sm.body.velocity.z *= 1 - t;
  }

  if (hasTarget) {
    const targetAngle = Math.atan2(targetDir.x, targetDir.z);
    let diff = targetAngle - sm.group.rotation.y;
    diff = ((diff + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    const maxTurn = STICKMAN_TURN_SPEED * dt;
    diff = Math.max(-maxTurn, Math.min(maxTurn, diff));
    sm.group.rotation.y += diff;
  }

  sm.body.velocity.x *= 0.95;
  sm.body.velocity.z *= 0.95;
  sm.body.angularVelocity.set(0, 0, 0);

  sm.group.position.copy(sm.body.position as any);
  sm.group.position.y -= STICKMAN_HEIGHT / 2;
  sm.group.quaternion.copy(sm.body.quaternion as any);

  const q = sm.body.quaternion;
  if (Math.abs(q.x) > 0.1 || Math.abs(q.z) > 0.1) {
    q.x *= 0.9;
    q.z *= 0.9;
    q.normalize();
  }

  if (sm.healthBar) {
    sm.healthBar.bg.visible = sm.alive && sm.deathTimer <= 0;
  }
}
