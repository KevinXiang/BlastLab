export interface UIState {
  selectedExplosive: string;
  quantities: Record<string, number>;
  score: number;
  objective: string;
  mode: 'sandbox' | 'level';
}

export function createUI(container: HTMLElement): UIState {
  const state: UIState = {
    selectedExplosive: 'tnt',
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
      document.querySelectorAll('.bottom-card').forEach(c => {
        (c as HTMLElement).style.borderColor = 'transparent';
      });
      card.style.borderColor = '#fff';
    });
    card.classList.add('bottom-card');
    bottomBar.appendChild(card);
  });

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
  if (infoEl) infoEl.textContent = `当前: ${state.selectedExplosive.toUpperCase()}`;
  const objEl = container.querySelector('#objective-text');
  if (objEl) objEl.textContent = state.objective;
  const scoreEl = container.querySelector('#score-text');
  if (scoreEl) scoreEl.textContent = `得分: ${state.score}`;
}
