import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { GROUND_Y } from './constants';
import { notifyDestroy } from './destruction';

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
  isTree?: boolean;
  objectId?: number;
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

export interface DebrisPiece {
  body: CANNON.Body;
  mesh: THREE.Mesh;
  life: number;
}

export function fragmentBuilding(
  body: CANNON.Body,
  mesh: THREE.Mesh,
  physicsBodies: PhysicsBody[],
  debrisList: DebrisPiece[],
  scene: THREE.Scene,
): void {
  const pb = physicsBodies.find(p => p.body === body);
  if (pb?.objectId !== undefined) {
    notifyDestroy('building', pb.objectId);
  }

  const pos = body.position.clone();
  const size = new CANNON.Vec3(0.4, 0.4, 0.4);

  world.removeBody(body);
  scene.remove(mesh);
  mesh.geometry.dispose();
  (mesh.material as THREE.Material).dispose();

  const idx = physicsBodies.findIndex(pb => pb.body === body);
  if (idx >= 0) physicsBodies.splice(idx, 1);

  const pieceCount = 15 + Math.floor(Math.random() * 15);
  for (let i = 0; i < pieceCount; i++) {
    const pieceSize = 0.2 + Math.random() * 0.5;
    const shape = new CANNON.Box(new CANNON.Vec3(pieceSize, pieceSize, pieceSize));
    const pieceBody = new CANNON.Body({ mass: 5 + Math.random() * 10, shape });
    pieceBody.position.set(
      pos.x + (Math.random() - 0.5) * size.x,
      pos.y + (Math.random() - 0.5) * size.y,
      pos.z + (Math.random() - 0.5) * size.z,
    );
    pieceBody.linearDamping = 0.4;
    pieceBody.angularDamping = 0.4;
    world.addBody(pieceBody);

    const pieceGeo = new THREE.BoxGeometry(pieceSize, pieceSize, pieceSize);
    const pieceMat = new THREE.MeshToonMaterial({
      color: (mesh.material as THREE.MeshToonMaterial).color,
    });
    const pieceMesh = new THREE.Mesh(pieceGeo, pieceMat);
    pieceMesh.castShadow = true;
    scene.add(pieceMesh);

    debrisList.push({ body: pieceBody, mesh: pieceMesh, life: 4 });
  }
}
