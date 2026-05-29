// 场景尺寸
export const WORLD_SIZE = 60;
export const GROUND_Y = 0;

// 相机
export const CAMERA_ZOOM = 12;
export const CAMERA_MIN_ZOOM = 6;
export const CAMERA_MAX_ZOOM = 25;
export const CAMERA_NEAR = 0.1;
export const CAMERA_FAR = 200;
export const CAMERA_ORBIT_DISTANCE = 30;
export const CAMERA_ELEVATION = Math.PI / 3;
export const CAMERA_ROTATE_SPEED = 1.8;
export const CAMERA_ZOOM_SPEED = 6;
export const CAMERA_DRAG_SENSITIVITY = 0.3;
export const CAMERA_SCROLL_SENSITIVITY = 0.6;

// 颜色
export const COLOR_GROUND = 0x9bbc7b;
export const COLOR_ROAD = 0x555555;
export const COLOR_ROAD_LINE = 0xffffff;
export const COLOR_SIDEWALK = 0xcccccc;

// 建筑
export const BUILDING_COLORS = [0xe8d5b0, 0xd4c4a0, 0xccbb99, 0xddc8a8, 0xbfae8e, 0xe0cfa8, 0xc8b898, 0xeedcc0];
export const BUILDING_MIN_WIDTH = 2;
export const BUILDING_MAX_WIDTH = 4;
export const BUILDING_MIN_DEPTH = 2;
export const BUILDING_MAX_DEPTH = 4;
export const BUILDING_MIN_HEIGHT = 3;
export const BUILDING_MAX_HEIGHT = 10;

// 道路
export const ROAD_WIDTH = 3;
export const ROAD_LINE_GAP = 0.8;
export const ROAD_LINE_LENGTH = 1.2;

// 车辆颜色
export const VEHICLE_COLORS = [0xe86040, 0x4080e8, 0xf0c040, 0x40c060, 0xe0e0e0];

// 环境装饰
export const TREE_TRUNK_COLOR = 0x8B7355;
export const TREE_LEAF_COLOR = 0x5a8a3c;

// 爆炸物
export const EXPLOSIVE_RADIUS = 0.3;
export const EXPLOSIVE_HEIGHT = 0.6;
export const EXPLOSIVE_COLORS: Record<string, number> = {
  tnt: 0xcc6600,
  c4: 0x3366cc,
  nitroglycerin: 0x8B4513,
  nuke: 0xcc0000,
};

export interface ExplosiveDef {
  radius: number;
  baseForce: number;
  color: number;
  label: string;
}

export const EXPLOSIVE_DEFS: Record<string, ExplosiveDef> = {
  nitroglycerin: { radius: 3, baseForce: 500, color: 0x8B4513, label: '硝酸甘油' },
  tnt: { radius: 8, baseForce: 800, color: 0xcc6600, label: 'TNT' },
  c4: { radius: 6, baseForce: 1200, color: 0x3366cc, label: 'C4' },
  nuke: { radius: 30, baseForce: 3000, color: 0xcc0000, label: '原子弹' },
};

// ============================================================
// 武器库 — 新增爆炸类
// ============================================================
export const REMOTE_RADIUS = 6;
export const REMOTE_FORCE = 1000;
export const REMOTE_COLOR = 0x228833;

export const MINE_RADIUS = 4;
export const MINE_FORCE = 600;
export const MINE_COLOR = 0x444444;

// 特殊类
export const INCENDIARY_RADIUS = 5;
export const INCENDIARY_FORCE = 300;
export const INCENDIARY_COLOR = 0xff6600;

export const SMOKE_RADIUS = 6;
export const SMOKE_COLOR = 0x888888;

export const FLASH_RADIUS = 4;
export const FLASH_COLOR = 0xffffff;

// 建造类
export const SANDBAG_COLOR = 0xc2b280;
export const BARRICADE_COLOR = 0xff6600;
