import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { GROUND_Y } from './constants';

let world: CANNON.World;

export function initPhysics(): CANNON.World {
  world = new CANNON.World();
  world.gravity.set(0, -20, 0);
  world.broadphase = new CANNON.SAPBroadphase(world);
  world.allowSleep = true;
  (world.solver as any).iterations = 10;

  const groundShape = new CANNON.Plane();
  const groundBody = new CANNON.Body({ mass: 0, shape: groundShape });
  groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  groundBody.position.y = GROUND_Y;
  world.addBody(groundBody);

  return world;
}

export function getWorld(): CANNON.World {
  return world;
}

export interface PhysicsBody {
  body: CANNON.Body;
  mesh: THREE.Mesh | THREE.Group;
  isBuilding: boolean;
}

export function createBuildingBody(
  width: number, height: number, depth: number,
  x: number, z: number,
): CANNON.Body {
  const shape = new CANNON.Box(new CANNON.Vec3(width / 2, height / 2, depth / 2));
  const body = new CANNON.Body({ mass: 500, shape });
  body.position.set(x, height / 2, z);
  body.linearDamping = 0.3;
  body.angularDamping = 0.3;
  world.addBody(body);
  return body;
}

export interface ExplosionConfig {
  position: CANNON.Vec3;
  radius: number;
  baseForce: number;
}

export function applyExplosion(config: ExplosionConfig): void {
  const { position, radius, baseForce } = config;

  for (const body of world.bodies) {
    if (body.mass === 0) continue;

    const dist = body.position.distanceTo(position);
    if (dist > radius) continue;

    const forceMag = baseForce / (1 + (dist * dist) / (radius * radius));

    const direction = new CANNON.Vec3();
    body.position.vsub(position, direction);
    direction.normalize();

    const impulse = new CANNON.Vec3();
    direction.scale(forceMag, impulse);
    body.applyImpulse(impulse, body.position);

    const torque = new CANNON.Vec3(
      (Math.random() - 0.5) * forceMag * 0.5,
      (Math.random() - 0.5) * forceMag * 0.5,
      (Math.random() - 0.5) * forceMag * 0.5,
    );
    body.applyTorque(torque);
    body.wakeUp();
  }
}
