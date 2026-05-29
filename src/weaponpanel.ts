export interface WeaponDef {
  type: string;
  label: string;
  icon: string;
  category: 'explosive' | 'special' | 'construct';
}

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
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
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
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'r' }));
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
    if (modeBtn.textContent === '沙盒') {
      modeBtn.textContent = '关卡';
      modeBtn.style.background = '#ff9800';
    } else {
      modeBtn.textContent = '沙盒';
      modeBtn.style.background = '#4caf50';
    }
  });
  btnContainer.appendChild(modeBtn);

  panel.appendChild(btnContainer);

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
