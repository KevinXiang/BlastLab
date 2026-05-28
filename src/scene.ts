import * as THREE from 'three';
import {
  BUILDING_COLORS, BUILDING_MIN_WIDTH, BUILDING_MAX_WIDTH,
  BUILDING_MIN_DEPTH, BUILDING_MAX_DEPTH,
  BUILDING_MIN_HEIGHT, BUILDING_MAX_HEIGHT,
  WORLD_SIZE, ROAD_WIDTH, ROAD_LINE_GAP, ROAD_LINE_LENGTH,
  COLOR_ROAD, COLOR_ROAD_LINE, COLOR_SIDEWALK,
  VEHICLE_COLORS, TREE_TRUNK_COLOR, TREE_LEAF_COLOR,
} from './constants';
import { createBuildingBody, PhysicsBody } from './physics';
import { getScene } from './renderer';

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
