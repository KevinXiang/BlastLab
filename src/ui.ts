export interface UIState {
  selectedExplosive: string;
  score: number;
  objective: string;
}

export function createUI(container: HTMLElement): UIState {
  const state: UIState = {
    selectedExplosive: 'tnt',
    score: 0,
    objective: '',
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
