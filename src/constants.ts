// 场景尺寸
export const WORLD_SIZE = 60;
export const GROUND_Y = 0;

// 相机
export const CAMERA_ZOOM = 30;
export const CAMERA_MIN_ZOOM = 8;
export const CAMERA_MAX_ZOOM = 30;
export const CAMERA_NEAR = 0.1;
export const CAMERA_FAR = 200;
export const CAMERA_ORBIT_DISTANCE = 30;
export const CAMERA_ELEVATION = Math.PI / 2.3;
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
  cluster: { radius: 10, baseForce: 150, color: 0x99aa00, label: '集束炸弹' },
  blackhole: { radius: 25, baseForce: 0, color: 0x331166, label: '黑洞装置' },
  emp: { radius: 6, baseForce: 400, color: 0x4488ff, label: '电磁脉冲' },
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

// ============================================================
// 集束炸弹
// ============================================================
export const CLUSTER_RADIUS = 10;
export const CLUSTER_FORCE = 150;
export const CLUSTER_COLOR = 0x99aa00;
export const CLUSTER_SUB_COUNT = 8;
export const CLUSTER_SUB_SPREAD = 4;

// ============================================================
// 黑洞装置
// ============================================================
export const BLACKHOLE_RADIUS = 25;
export const BLACKHOLE_COLOR = 0x331166;
export const BLACKHOLE_SUCK_DURATION = 2.0;
export const BLACKHOLE_CHARGE_DURATION = 0.5;
export const BLACKHOLE_EJECT_FORCE = 2000;

// ============================================================
// 电磁脉冲
// ============================================================
export const EMP_RADIUS = 6;
export const EMP_FORCE = 400;
export const EMP_COLOR = 0x4488ff;
export const EMP_FLASH_DURATION = 0.3;

// ============================================================
// 喷射类
// ============================================================
export const SPRAY_FLAME_RANGE = 7;
export const SPRAY_FLAME_ENERGY = 5;
export const SPRAY_FLAME_FORCE = 80;
export const SPRAY_FLAME_TREE_IGNITE_TIME = 2;

export const SPRAY_ICE_RANGE = 8;
export const SPRAY_ICE_ENERGY = 4;
export const SPRAY_ICE_SLOW_FACTOR = 0.1;

export const SPRAY_PARTICLE_RANGE = 10;
export const SPRAY_PARTICLE_ENERGY = 3;
export const SPRAY_PARTICLE_FORCE = 500;

export const SPRAY_CONE_ANGLE = Math.PI / 6;

// ============================================================
// 火柴人 & 兵营
// ============================================================
export const STICKMAN_HP = 100;
export const STICKMAN_WALK_SPEED = 2;
export const STICKMAN_RUN_SPEED = 5;
export const STICKMAN_SCORE = 100;
export const STICKMAN_HEIGHT = 1.8;
export const STICKMAN_RADIUS = 0.25;

export const BARRACKS_HP = 300;
export const BARRACKS_SPAWN_RATE = 2;
export const BARRACKS_MAX_UNITS = 20;

// ============================================================
// 火柴人动画
// ============================================================
export const ANIM_WALK_FREQ = 8;
export const ANIM_RUN_FREQ = 12;
export const ANIM_WALK_AMP = 0.5;
export const ANIM_RUN_AMP = 0.7;
export const ANIM_ARM_AMP = 0.4;
export const ANIM_ARM_RUN_AMP = 0.6;
export const ANIM_BOB_HEIGHT = 0.03;
export const ANIM_BOB_RUN_HEIGHT = 0.05;

// ============================================================
// 火柴人运动
// ============================================================
export const STICKMAN_ACCEL = 8;
export const STICKMAN_RUN_ACCEL = 15;
export const STICKMAN_TURN_SPEED = 8;
export const STICKMAN_ROAD_SPEED_BONUS = 1.2;

// ============================================================
// 火柴人 AI
// ============================================================
export const AI_PATH_RECALC_INTERVAL = 3;
export const AI_GRID_RESOLUTION = 2;
export const AI_MAX_SEARCH_STEPS = 200;
export const AI_SEPARATION_RADIUS = 3;
export const AI_SEPARATION_WEIGHT = 0.3;
export const AI_COHESION_RADIUS = 5;
export const AI_COHESION_WEIGHT = 0.2;

// ============================================================
// 士气
// ============================================================
export const FEAR_EXPLOSION = 60;
export const FEAR_WITNESS_DEATH = 20;
export const FEAR_WITNESS_FLEE = 10;
export const FEAR_DECAY_RATE = 15;
export const FEAR_NEAR_BARRACKS_DECAY = 10;
export const FEAR_NEAR_ALLIES_DECAY = 5;
export const FEAR_FLEE_THRESHOLD = 70;
export const FEAR_RECOVER_THRESHOLD = 20;
export const FEAR_PROPAGATION_RADIUS = 5;
export const FEAR_PROPAGATION_COOLDOWN = 3;
export const MORALE_INITIAL = 50;
export const MORALE_DEATH_PENALTY = 10;
export const MORALE_BARRACKS_DAMAGE = 30;
export const MORALE_EXPLOSION_NEAR = 20;
export const MORALE_KILL_BONUS = 15;
export const MORALE_LOW_THRESHOLD = 30;
export const MORALE_HIGH_THRESHOLD = 70;
export const MORALE_COOLDOWN = 30;

// ============================================================
// 战斗
// ============================================================
export const COMBAT_SCAN_RADIUS = 12;
export const COMBAT_SCAN_INTERVAL = 1;
export const COMBAT_RANGED_RANGE = 8;
export const COMBAT_MELEE_RANGE = 2;
export const COMBAT_LOSE_TARGET_RANGE = 15;
export const COMBAT_RANGED_COOLDOWN = 1.5;
export const COMBAT_MELEE_COOLDOWN = 0.8;
export const COMBAT_RANGED_DAMAGE = 15;
export const COMBAT_MELEE_DAMAGE = 10;
export const PROJECTILE_SPEED = 15;
export const PROJECTILE_LIFETIME = 2;
