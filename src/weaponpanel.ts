export interface WeaponDef {
  type: string;
  label: string;
  icon: string;
  category: 'explosive' | 'special' | 'construct';
}

import { LEVELS, startLevel, returnToMenu, getPhase, getProgress, recordSkip, initLevelSystem, getLevelState } from './level';
import { resetProgress } from './persistence';

const WEAPONS: WeaponDef[] = [
  // 爆炸类
  { type: 'tnt', label: 'TNT桶', icon: '🧨', category: 'explosive' },
  { type: 'c4', label: 'C4炸药', icon: '💣', category: 'explosive' },
  { type: 'nitroglycerin', label: '硝酸甘油', icon: '🧪', category: 'explosive' },
  { type: 'nuke', label: '原子弹', icon: '☢️', category: 'explosive' },
  { type: 'remote_bomb', label: '遥控炸弹', icon: '📡', category: 'explosive' },
  { type: 'mine', label: '地雷', icon: '💥', category: 'explosive' },
  // 特殊类
  { type: 'incendiary', label: '燃烧弹', icon: '🔥', category: 'special' },
  { type: 'smoke', label: '烟雾弹', icon: '💨', category: 'special' },
  { type: 'flash', label: '闪光弹', icon: '⚡', category: 'special' },
  // 建造类
  { type: 'building', label: '建筑', icon: '🏠', category: 'construct' },
  { type: 'vehicle', label: '车辆', icon: '🚗', category: 'construct' },
  { type: 'tree', label: '树木', icon: '🌳', category: 'construct' },
  { type: 'sandbag', label: '沙袋', icon: '🛡️', category: 'construct' },
  { type: 'barricade', label: '路障', icon: '🚧', category: 'construct' },
];

export interface WeaponPanelState {
  selectedType: string | null;
  visible: boolean;
}

export function createWeaponPanel(container: HTMLElement): WeaponPanelState {
  const state: WeaponPanelState = { selectedType: null, visible: false };

  // Collapsed tab
  const tab = document.createElement('div');
  tab.id = 'weapon-tab';
  tab.style.cssText = `
    position: absolute; left: 0; top: 50%; transform: translateY(-50%);
    width: 24px; height: 60px; background: rgba(0,0,0,0.7); color: #fff;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; border-radius: 0 6px 6px 0; font-size: 12px;
    writing-mode: vertical-rl; z-index: 20; user-select: none;
  `;
  tab.textContent = '武';
  container.appendChild(tab);

  // Panel
  const panel = document.createElement('div');
  panel.id = 'weapon-panel';
  panel.style.cssText = `
    position: absolute; left: -300px; top: 40px; bottom: 10px;
    width: 280px; background: rgba(0,0,0,0.75); color: #fff;
    transition: left 0.2s ease; z-index: 20; overflow-y: auto;
    padding: 12px; border-radius: 0 8px 8px 0; pointer-events: auto;
  `;

  // Close button
  const closeBtn = document.createElement('div');
  closeBtn.textContent = '收起 ◀';
  closeBtn.style.cssText = 'cursor: pointer; margin-bottom: 12px; font-size: 13px; color: #aaa;';
  closeBtn.addEventListener('click', () => togglePanel(panel, tab, state));
  panel.appendChild(closeBtn);

  // Category sections
  const categories = [
    { id: 'explosive', label: '爆炸类' },
    { id: 'special', label: '特殊类' },
    { id: 'construct', label: '建造类' },
  ];

  for (const cat of categories) {
    const title = document.createElement('div');
    title.textContent = `── ${cat.label} ──`;
    title.style.cssText = 'color: #aaa; font-size: 12px; margin: 8px 0 6px;';
    panel.appendChild(title);

    const grid = document.createElement('div');
    grid.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 6px;';

    const items = WEAPONS.filter(w => w.category === cat.id);
    for (const item of items) {
      const card = document.createElement('div');
      card.dataset.weaponType = item.type;
      card.style.cssText = `
        padding: 6px 8px; background: rgba(255,255,255,0.1); border-radius: 6px;
        cursor: pointer; font-size: 12px; display: flex; align-items: center; gap: 6px;
        border: 1px solid transparent; transition: border 0.1s;
      `;
      card.innerHTML = `<span>${item.icon}</span><span>${item.label}</span>`;
      card.draggable = true;

      card.addEventListener('click', () => {
        state.selectedType = state.selectedType === item.type ? null : item.type;
        panel.querySelectorAll('[data-weapon-type]').forEach(el => {
          (el as HTMLElement).style.borderColor = 'transparent';
        });
        if (state.selectedType) {
          card.style.borderColor = '#fff';
        }
      });

      card.addEventListener('dragstart', (e) => {
        e.dataTransfer!.setData('text/plain', item.type);
        card.style.opacity = '0.5';
      });
      card.addEventListener('dragend', () => { card.style.opacity = '1'; });

      grid.appendChild(card);
    }
    panel.appendChild(grid);
  }

  // Action buttons
  const btnContainer = document.createElement('div');
  btnContainer.style.cssText = 'display: flex; gap: 8px; margin-top: 16px; flex-wrap: wrap;';

  const detonateBtn = document.createElement('button');
  detonateBtn.textContent = '引爆';
  detonateBtn.style.cssText = `
    flex: 1; padding: 10px 16px; background: #ff5722; color: #fff;
    border: none; border-radius: 8px; font-size: 15px;
    font-weight: bold; cursor: pointer;
  `;
  detonateBtn.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('game-detonate'));
  });
  btnContainer.appendChild(detonateBtn);

  const resetBtn = document.createElement('button');
  resetBtn.textContent = '重置';
  resetBtn.style.cssText = `
    flex: 1; padding: 10px 16px; background: #555; color: #fff;
    border: none; border-radius: 8px; font-size: 14px;
    cursor: pointer;
  `;
  resetBtn.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('game-reset'));
  });
  btnContainer.appendChild(resetBtn);

  const modeBtn = document.createElement('button');
  modeBtn.textContent = '沙盒';
  modeBtn.style.cssText = `
    flex: 1; padding: 8px 16px; background: #4caf50; color: #fff;
    border: none; border-radius: 6px; cursor: pointer;
    font-size: 13px;
  `;
  modeBtn.addEventListener('click', () => {
    const phase = getPhase();
    if (phase === 'playing') {
      returnToMenu();
      modeBtn.textContent = '关卡';
      modeBtn.style.background = '#ff9800';
      levelList.style.display = 'none';
    } else {
      levelList.style.display = levelList.style.display === 'none' ? '' : 'none';
      if (levelList.style.display !== 'none') refreshLevelList();
      modeBtn.textContent = levelList.style.display !== 'none' ? '隐藏' : '关卡';
    }
  });
  btnContainer.appendChild(modeBtn);

  const resetProgressBtn = document.createElement('button');
  resetProgressBtn.textContent = '重置进度';
  resetProgressBtn.style.cssText = `
    width: 100%; padding: 6px; background: #c62828; color: #fff;
    border: none; border-radius: 4px; font-size: 11px; cursor: pointer;
    margin-top: 8px;
  `;
  resetProgressBtn.addEventListener('click', () => {
    if (confirm('确定要重置所有关卡进度吗？此操作不可撤销。')) {
      resetProgress();
      initLevelSystem();
      refreshLevelList();
      returnToMenu();
    }
  });
  btnContainer.appendChild(resetProgressBtn);

  panel.appendChild(btnContainer);

  // Level list section
  const levelList = document.createElement('div');
  levelList.id = 'level-list';
  levelList.style.cssText = `
    margin-top: 12px; border-top: 1px solid rgba(255,255,255,0.15); padding-top: 12px;
    display: none;
  `;
  const levelTitle = document.createElement('div');
  levelTitle.textContent = '关卡列表';
  levelTitle.style.cssText = 'font-size: 11px; color: #aaa; margin-bottom: 8px;';
  levelList.appendChild(levelTitle);

  const levelGrid = document.createElement('div');
  levelGrid.style.cssText = 'display: flex; gap: 6px; flex-wrap: wrap;';
  levelList.appendChild(levelGrid);
  panel.appendChild(levelList);

  function refreshLevelList(): void {
    const progress = getProgress();
    levelGrid.innerHTML = '';

    for (const level of LEVELS) {
      const record = progress.records[level.id];
      const unlocked = level.id <= progress.unlockedLevel;
      const card = document.createElement('div');
      card.style.cssText = `
        padding: 6px 10px; border-radius: 6px; font-size: 11px;
        cursor: ${unlocked ? 'pointer' : 'default'};
        background: ${unlocked ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.03)'};
        opacity: ${unlocked ? '1' : '0.4'}; text-align: center; user-select: none;
      `;

      if (record?.completed) {
        card.textContent = `${level.id} ${'⭐'.repeat(record.bestStars)}`;
        card.style.background = 'rgba(76,175,80,0.3)';
      } else if (record?.skipped) {
        card.textContent = `${level.id} ⏭`;
        card.style.background = 'rgba(255,152,0,0.3)';
      } else if (unlocked) {
        card.textContent = `${level.id}`;
      } else {
        card.textContent = `${level.id} 🔒`;
      }

      if (unlocked) {
        card.addEventListener('click', () => {
          window.dispatchEvent(new CustomEvent('level-start', { detail: { id: level.id } }));
        });
      }
      levelGrid.appendChild(card);
    }
  }

  (window as any).__refreshLevelList = refreshLevelList;

  container.appendChild(panel);

  tab.addEventListener('click', () => togglePanel(panel, tab, state));
  return state;
}

function togglePanel(
  panel: HTMLElement,
  tab: HTMLElement,
  state: WeaponPanelState,
): void {
  state.visible = !state.visible;
  if (state.visible) {
    panel.style.left = '0';
    tab.style.display = 'none';
  } else {
    panel.style.left = '-300px';
    tab.style.display = 'flex';
  }
}
