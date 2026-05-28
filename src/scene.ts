import * as THREE from 'three';
import {
  BUILDING_COLORS, BUILDING_MIN_WIDTH, BUILDING_MAX_WIDTH,
  BUILDING_MIN_DEPTH, BUILDING_MAX_DEPTH,
  BUILDING_MIN_HEIGHT, BUILDING_MAX_HEIGHT,
} from './constants';
import { getScene } from './renderer';

interface Building {
  mesh: THREE.Mesh;
  width: number;
  depth: number;
  height: number;
}

export const buildings: Building[] = [];

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
    buildings.push({ mesh, width: w, depth: d, height: h });
  }
}
