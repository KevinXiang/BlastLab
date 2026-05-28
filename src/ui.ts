export interface UIState {
  selectedExplosive: string;
  selectedConstruct: string;
  quantities: Record<string, number>;
  score: number;
  objective: string;
  mode: 'sandbox' | 'level';
}

export function createUI(container: HTMLElement): UIState {
  const state: UIState = {
    selectedExplosive: 'tnt',
    selectedConstruct: '',
    quantities: { tnt: Infinity, c4: 5, nitroglycerin: 3, nuke: 1 },
    score: 0,
    objective: '',
    mode: 'sandbox',
  };

  const topBar = document.createElement('div');
  topBar.id = 'top-bar';
  topBar.style.cssText = `
    position: absolute; top: 0; left: 0; right: 0;
    display: flex; justify-content: space-between; align-items: center;
    padding: 8px 16px; background: rgba(0,0,0,0.6); color: #fff;
    font-size: 14px; z-index: 10; pointer-events: none;
  `;
  topBar.innerHTML = `
    <span id="explosive-info">TNT</span>
    <span id="objective-text"></span>
    <span id="score-text">得分: 0</span>
  `;
  container.appendChild(topBar);

  const bottomBar = document.createElement('div');
  bottomBar.id = 'bottom-bar';
  bottomBar.style.cssText = `
    position: absolute; bottom: 0; left: 0; right: 0;
    display: flex; justify-content: center; align-items: center; gap: 12px;
    padding: 12px 16px; background: rgba(0,0,0,0.6); z-index: 10;
  `;

  const explosiveTypes = [
    { id: 'nitroglycerin', label: '硝酸甘油', color: '#8B4513' },
    { id: 'tnt', label: 'TNT', color: '#cc6600' },
    { id: 'c4', label: 'C4', color: '#3366cc' },
    { id: 'nuke', label: '原子弹', color: '#cc0000' },
  ];

  explosiveTypes.forEach(({ id, label, color }) => {
    const card = document.createElement('div');
    card.className = 'explosive-card';
    card.dataset.type = id;
    card.dataset.kind = 'explosive';
    card.style.cssText = `
      padding: 8px 16px; background: ${color}; color: #fff;
      border-radius: 8px; cursor: pointer; font-size: 14px;
      font-weight: bold; user-select: none;
      transition: transform 0.1s, box-shadow 0.1s;
      border: 2px solid transparent;
    `;
    card.textContent = `${label} x∞`;
    card.draggable = true;
    card.addEventListener('dragstart', (e) => {
      e.dataTransfer!.setData('text/plain', id);
      card.style.opacity = '0.5';
    });
    card.addEventListener('dragend', () => {
      card.style.opacity = '1';
    });
    card.addEventListener('click', () => {
      state.selectedExplosive = id;
      state.selectedConstruct = '';
      document.querySelectorAll('.bottom-card').forEach(c => {
        (c as HTMLElement).style.borderColor = 'transparent';
      });
      card.style.borderColor = '#fff';
    });
    card.classList.add('bottom-card');
    bottomBar.appendChild(card);
  });

  const sep1 = document.createElement('span');
  sep1.style.cssText = 'color: #555; margin: 0 8px; font-size: 18px;';
  sep1.textContent = '┃';
  bottomBar.appendChild(sep1);

  const constructTypes = [
    { id: 'building', label: '建筑', color: '#e8d5b0' },
    { id: 'vehicle', label: '车辆', color: '#e86040' },
    { id: 'tree', label: '树木', color: '#5a8a3c' },
  ];

  constructTypes.forEach(({ id, label, color }) => {
    const card = document.createElement('div');
    card.className = 'construct-card';
    card.dataset.type = id;
    card.dataset.kind = 'construct';
    card.style.cssText = `
      padding: 8px 16px; background: ${color}; color: #fff;
      border-radius: 8px; cursor: pointer; font-size: 14px;
      font-weight: bold; user-select: none;
      transition: transform 0.1s, box-shadow 0.1s;
      border: 2px solid transparent;
    `;
    card.textContent = label;
    card.draggable = true;
    card.addEventListener('dragstart', (e) => {
      e.dataTransfer!.setData('text/plain', 'construct:' + id);
      card.style.opacity = '0.5';
    });
    card.addEventListener('dragend', () => {
      card.style.opacity = '1';
    });
    card.addEventListener('click', () => {
      state.selectedConstruct = id;
      state.selectedExplosive = '';
      document.querySelectorAll('.bottom-card').forEach(c => {
        (c as HTMLElement).style.borderColor = 'transparent';
      });
      card.style.borderColor = '#fff';
      card.style.boxShadow = '0 0 8px rgba(255,255,255,0.5)';
    });
    card.classList.add('bottom-card');
    bottomBar.appendChild(card);
  });

  const sep2 = document.createElement('span');
  sep2.style.cssText = 'color: #555; margin: 0 8px; font-size: 18px;';
  sep2.textContent = '┃';
  bottomBar.appendChild(sep2);

  const modeBtn = document.createElement('button');
  modeBtn.textContent = '切换模式';
  modeBtn.style.cssText = `
    padding: 8px 16px; background: #4caf50; color: #fff;
    border: none; border-radius: 6px; cursor: pointer;
    font-size: 13px;
  `;
  modeBtn.addEventListener('click', () => {
    if (state.mode === 'sandbox') {
      state.mode = 'level';
      modeBtn.textContent = '关卡模式';
      modeBtn.style.background = '#ff9800';
    } else {
      state.mode = 'sandbox';
      modeBtn.textContent = '沙盒模式';
      modeBtn.style.background = '#4caf50';
    }
  });
  bottomBar.appendChild(modeBtn);

  const detonateBtn = document.createElement('button');
  detonateBtn.textContent = '引爆';
  detonateBtn.style.cssText = `
    padding: 10px 24px; background: #ff5722; color: #fff;
    border: none; border-radius: 8px; font-size: 16px;
    font-weight: bold; cursor: pointer;
    transition: transform 0.1s;
  `;
  detonateBtn.addEventListener('click', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
  });
  bottomBar.appendChild(detonateBtn);

  const resetBtn = document.createElement('button');
  resetBtn.textContent = '重置';
  resetBtn.style.cssText = `
    padding: 10px 20px; background: #555; color: #fff;
    border: none; border-radius: 8px; font-size: 14px;
    cursor: pointer;
  `;
  resetBtn.addEventListener('click', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'r' }));
  });
  bottomBar.appendChild(resetBtn);

  container.appendChild(bottomBar);

  const defaultCard = bottomBar.querySelector('[data-type="tnt"]') as HTMLElement;
  if (defaultCard) defaultCard.style.borderColor = '#fff';

  return state;
}

export function updateUI(container: HTMLElement, state: UIState): void {
  const infoEl = container.querySelector('#explosive-info');
  if (infoEl) {
    if (state.selectedConstruct) {
      infoEl.textContent = `建造: ${state.selectedConstruct.toUpperCase()}`;
    } else {
      infoEl.textContent = `当前: ${state.selectedExplosive.toUpperCase()}`;
    }
  }
  const objEl = container.querySelector('#objective-text');
  if (objEl) objEl.textContent = state.objective;
  const scoreEl = container.querySelector('#score-text');
  if (scoreEl) scoreEl.textContent = `得分: ${state.score}`;
}
