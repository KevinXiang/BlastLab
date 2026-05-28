import * as THREE from 'three';
import {
  BUILDING_COLORS, BUILDING_MIN_WIDTH, BUILDING_MAX_WIDTH,
  BUILDING_MIN_DEPTH, BUILDING_MAX_DEPTH,
  BUILDING_MIN_HEIGHT, BUILDING_MAX_HEIGHT,
  WORLD_SIZE, ROAD_WIDTH, ROAD_LINE_GAP, ROAD_LINE_LENGTH,
  COLOR_ROAD, COLOR_ROAD_LINE, COLOR_SIDEWALK,
  VEHICLE_COLORS, TREE_TRUNK_COLOR, TREE_LEAF_COLOR,
  EXPLOSIVE_RADIUS, EXPLOSIVE_HEIGHT, EXPLOSIVE_COLORS,
} from './constants';
import { createBuildingBody, PhysicsBody, getWorld } from './physics';
import { getScene } from './renderer';
import * as CANNON from 'cannon-es';

interface Building {
  mesh: THREE.Mesh;
  width: number;
  depth: number;
  height: number;
}

export const buildings: Building[] = [];
export const physicsBodies: PhysicsBody[] = [];

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function createBuildings(): void {
  const scene = getScene();

  const positions = [
    { x: -8, z: -8 }, { x: -2, z: -10 }, { x: 5, z: -7 },
    { x: -6, z: 2 }, { x: 3, z: 0 }, { x: -10, z: 8 },
    { x: 7, z: 5 }, { x: 0, z: 9 },
  ];

  for (let i = 0; i < positions.length; i++) {
    const w = rand(BUILDING_MIN_WIDTH, BUILDING_MAX_WIDTH);
    const d = rand(BUILDING_MIN_DEPTH, BUILDING_MAX_DEPTH);
    const h = rand(BUILDING_MIN_HEIGHT, BUILDING_MAX_HEIGHT);
    const color = BUILDING_COLORS[i % BUILDING_COLORS.length];

    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshToonMaterial({ color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const pos = positions[i];
    mesh.position.set(pos.x, h / 2, pos.z);

    scene.add(mesh);

    const body = createBuildingBody(w, h, d, pos.x, pos.z);
    physicsBodies.push({ body, mesh, isBuilding: true });

    buildings.push({ mesh, width: w, depth: d, height: h });
  }
}

export function createRoads(): void {
  const scene = getScene();
  const halfWorld = WORLD_SIZE / 2;

  const roadGeoH = new THREE.PlaneGeometry(WORLD_SIZE, ROAD_WIDTH);
  const roadGeoV = new THREE.PlaneGeometry(ROAD_WIDTH, WORLD_SIZE);
  const roadMat = new THREE.MeshToonMaterial({ color: COLOR_ROAD });
  const sidewalkMat = new THREE.MeshToonMaterial({ color: COLOR_SIDEWALK });

  const sidewalkH = new THREE.PlaneGeometry(WORLD_SIZE, ROAD_WIDTH + 1);
  const sH = new THREE.Mesh(sidewalkH, sidewalkMat);
  sH.rotation.x = -Math.PI / 2;
  sH.position.y = 0.01;
  scene.add(sH);

  const roadH = new THREE.Mesh(roadGeoH, roadMat);
  roadH.rotation.x = -Math.PI / 2;
  roadH.position.y = 0.02;
  scene.add(roadH);

  const sidewalkV = new THREE.PlaneGeometry(ROAD_WIDTH + 1, WORLD_SIZE);
  const sV = new THREE.Mesh(sidewalkV, sidewalkMat);
  sV.rotation.x = -Math.PI / 2;
  sV.position.y = 0.01;
  scene.add(sV);

  const roadV = new THREE.Mesh(roadGeoV, roadMat);
  roadV.rotation.x = -Math.PI / 2;
  roadV.position.y = 0.02;
  scene.add(roadV);

  const lineMat = new THREE.MeshToonMaterial({ color: COLOR_ROAD_LINE });
  for (let i = -halfWorld; i < halfWorld; i += ROAD_LINE_GAP + ROAD_LINE_LENGTH) {
    const lineH = new THREE.Mesh(
      new THREE.PlaneGeometry(ROAD_LINE_LENGTH, 0.15),
      lineMat,
    );
    lineH.rotation.x = -Math.PI / 2;
    lineH.position.set(i, 0.03, 0);
    scene.add(lineH);

    const lineV = new THREE.Mesh(
      new THREE.PlaneGeometry(0.15, ROAD_LINE_LENGTH),
      lineMat,
    );
    lineV.rotation.x = -Math.PI / 2;
    lineV.position.set(0, 0.03, i);
    scene.add(lineV);
  }
}

export interface Vehicle {
  body: THREE.Group;
  x: number;
  z: number;
}

export const vehicles: Vehicle[] = [];

export function createVehicles(): void {
  const scene = getScene();
  const positions = [
    { x: -14, z: 0.8 }, { x: 8, z: 1.2 }, { x: 0.6, z: 14 },
    { x: 1.2, z: -10 }, { x: -6, z: 0.5 },
  ];

  for (const pos of positions) {
    const color = VEHICLE_COLORS[Math.floor(Math.random() * VEHICLE_COLORS.length)];
    const group = new THREE.Group();

    const bodyGeo = new THREE.BoxGeometry(2, 1, 1.2);
    const bodyMat = new THREE.MeshToonMaterial({ color });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.position.y = 0.6;
    bodyMesh.castShadow = true;
    group.add(bodyMesh);

    const roofGeo = new THREE.BoxGeometry(1.2, 0.5, 1.1);
    const roofMat = new THREE.MeshToonMaterial({ color: 0x333333 });
    const roofMesh = new THREE.Mesh(roofGeo, roofMat);
    roofMesh.position.set(0, 1.15, 0);
    roofMesh.castShadow = true;
    group.add(roofMesh);

    const wheelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 8);
    const wheelMat = new THREE.MeshToonMaterial({ color: 0x111111 });
    const wheelPositions = [
      { x: 0.6, y: 0.3, z: 0.65 },
      { x: -0.6, y: 0.3, z: 0.65 },
      { x: 0.6, y: 0.3, z: -0.65 },
      { x: -0.6, y: 0.3, z: -0.65 },
    ];
    for (const wp of wheelPositions) {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wp.x, wp.y, wp.z);
      wheel.castShadow = true;
      group.add(wheel);
    }

    group.position.set(pos.x, 0, pos.z);
    group.rotation.y = Math.abs(pos.z) < Math.abs(pos.x) ? 0 : Math.PI / 2;
    scene.add(group);

    const vehicleBody = new CANNON.Body({ mass: 200, shape: new CANNON.Box(new CANNON.Vec3(1, 0.7, 0.6)) });
    vehicleBody.position.set(pos.x, 0.7, pos.z);
    vehicleBody.linearDamping = 0.3;
    vehicleBody.angularDamping = 0.3;
    getWorld().addBody(vehicleBody);
    physicsBodies.push({ body: vehicleBody, mesh: group, isBuilding: false });

    vehicles.push({ body: group, x: pos.x, z: pos.z });
  }
}

export function createDecorations(): void {
  const scene = getScene();
  const treePositions = [
    { x: -16, z: -14 }, { x: 14, z: -12 }, { x: -14, z: 16 },
    { x: 16, z: 14 }, { x: -18, z: 4 }, { x: 18, z: -4 },
    { x: -4, z: 16 }, { x: 4, z: -16 },
  ];

  for (const pos of treePositions) {
    const tree = new THREE.Group();

    const trunkGeo = new THREE.CylinderGeometry(0.15, 0.2, 1.5, 6);
    const trunkMat = new THREE.MeshToonMaterial({ color: TREE_TRUNK_COLOR });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 0.75;
    trunk.castShadow = true;
    tree.add(trunk);

    const leafGeo = new THREE.SphereGeometry(0.8, 6, 4);
    const leafMat = new THREE.MeshToonMaterial({ color: TREE_LEAF_COLOR });
    const leaf = new THREE.Mesh(leafGeo, leafMat);
    leaf.position.y = 1.8;
    leaf.castShadow = true;
    tree.add(leaf);

    tree.position.set(pos.x, 0, pos.z);
    scene.add(tree);
  }
}

export function createScene(): void {
  createRoads();
  createBuildings();
  createVehicles();
  createDecorations();
}

export interface PlacedExplosive {
  mesh: THREE.Mesh | THREE.Group;
  position: CANNON.Vec3;
}

export const placedExplosiveMeshes: PlacedExplosive[] = [];

function disposeMesh(obj: THREE.Mesh | THREE.Group): void {
  if (obj instanceof THREE.Mesh) {
    obj.geometry.dispose();
    (obj.material as THREE.Material).dispose();
  } else {
    obj.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    });
  }
}

function createTNT(): THREE.Group {
  const group = new THREE.Group();
  const color = EXPLOSIVE_COLORS['tnt'];
  const bodyMat = new THREE.MeshToonMaterial({ color });

  const bodyGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.7, 12);
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.35;
  body.castShadow = true;
  group.add(body);

  const strapMat = new THREE.MeshToonMaterial({ color: 0x444444 });
  const strapGeo = new THREE.TorusGeometry(0.36, 0.04, 8, 12);
  for (const y of [0.2, 0.5]) {
    const strap = new THREE.Mesh(strapGeo, strapMat);
    strap.position.y = y;
    group.add(strap);
  }

  return group;
}

function createC4(): THREE.Group {
  const group = new THREE.Group();
  const color = EXPLOSIVE_COLORS['c4'];

  const clayGeo = new THREE.BoxGeometry(0.55, 0.2, 0.4);
  const clayMat = new THREE.MeshToonMaterial({ color });
  const clay = new THREE.Mesh(clayGeo, clayMat);
  clay.position.y = 0.1;
  clay.castShadow = true;
  group.add(clay);

  const detGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.3, 8);
  const detMat = new THREE.MeshToonMaterial({ color: 0x888888 });
  const det = new THREE.Mesh(detGeo, detMat);
  det.position.set(0.15, 0.3, 0);
  group.add(det);

  const wireGeo = new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.15, 0.45, 0),
      new THREE.Vector3(0.25, 0.5, 0.05),
      new THREE.Vector3(0.35, 0.4, -0.1),
      new THREE.Vector3(0.3, 0.3, -0.25),
    ]), 8, 0.015, 6, false,
  );
  const wireMat = new THREE.MeshToonMaterial({ color: 0x222222 });
  const wire = new THREE.Mesh(wireGeo, wireMat);
  group.add(wire);

  return group;
}

function createNitroglycerin(): THREE.Group {
  const group = new THREE.Group();
  const color = EXPLOSIVE_COLORS['nitroglycerin'];

  const bottleGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.45, 12);
  const bottleMat = new THREE.MeshToonMaterial({ color, transparent: true, opacity: 0.7 });
  const bottle = new THREE.Mesh(bottleGeo, bottleMat);
  bottle.position.y = 0.225;
  bottle.castShadow = true;
  group.add(bottle);

  const neckGeo = new THREE.CylinderGeometry(0.06, 0.09, 0.3, 10);
  const neck = new THREE.Mesh(neckGeo, bottleMat);
  neck.position.y = 0.55;
  group.add(neck);

  const rimGeo = new THREE.TorusGeometry(0.07, 0.02, 8, 10);
  const rimMat = new THREE.MeshToonMaterial({ color: 0x222222 });
  const rim = new THREE.Mesh(rimGeo, rimMat);
  rim.position.y = 0.7;
  group.add(rim);

  const corkGeo = new THREE.CylinderGeometry(0.05, 0.06, 0.08, 8);
  const corkMat = new THREE.MeshToonMaterial({ color: 0xccaa66 });
  const cork = new THREE.Mesh(corkGeo, corkMat);
  cork.position.y = 0.73;
  group.add(cork);

  return group;
}

function createNuke(): THREE.Group {
  const group = new THREE.Group();
  const color = EXPLOSIVE_COLORS['nuke'];

  const bodyGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.65, 12);
  const bodyMat = new THREE.MeshToonMaterial({ color });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.325;
  body.castShadow = true;
  group.add(body);

  const noseGeo = new THREE.ConeGeometry(0.22, 0.3, 12);
  const nose = new THREE.Mesh(noseGeo, bodyMat);
  nose.position.y = 0.8;
  nose.castShadow = true;
  group.add(nose);

  const finMat = new THREE.MeshToonMaterial({ color: 0x666666 });
  const finGeo = new THREE.BoxGeometry(0.08, 0.2, 0.05);
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    const fin = new THREE.Mesh(finGeo, finMat);
    fin.position.set(
      Math.sin(angle) * 0.25,
      -0.05,
      Math.cos(angle) * 0.25,
    );
    fin.rotation.z = angle;
    fin.castShadow = true;
    group.add(fin);
  }

  return group;
}

export function createExplosiveMesh(type: string, position: CANNON.Vec3): PlacedExplosive {
  let group: THREE.Group;

  switch (type) {
    case 'c4': group = createC4(); break;
    case 'nitroglycerin': group = createNitroglycerin(); break;
    case 'nuke': group = createNuke(); break;
    default: group = createTNT(); break;
  }

  group.position.copy(position as any);
  group.position.y += 0.01;
  group.traverse((child) => {
    if (child instanceof THREE.Mesh) child.castShadow = true;
  });
  getScene().add(group);

  const exp: PlacedExplosive = { mesh: group, position: position.clone() };
  placedExplosiveMeshes.push(exp);
  return exp;
}

export function removeAllExplosives(): void {
  for (const exp of placedExplosiveMeshes) {
    getScene().remove(exp.mesh);
    disposeMesh(exp.mesh);
  }
  placedExplosiveMeshes.length = 0;
}
