import { scoreState, ScoreBreakdown } from './game';

export interface UIState {
  selectedExplosive: string;
}

export function createUI(container: HTMLElement): UIState {
  const state: UIState = { selectedExplosive: 'tnt' };

  const topBar = document.createElement('div');
  topBar.id = 'top-bar';
  topBar.style.cssText = `
    position: absolute; top: 0; left: 0; right: 0;
    display: flex; justify-content: space-between; align-items: center;
    padding: 8px 16px; background: rgba(0,0,0,0.6); color: #fff;
    font-size: 14px; z-index: 10; pointer-events: none;
  `;
  topBar.innerHTML = `
    <span style="display:flex;gap:20px;">
      <span id="explosive-info">TNT</span>
      <span id="stickman-count" style="color:#ff9800;display:none;">👤 0</span>
    </span>
    <span id="score-display" style="font-size:16px;">
      总分: <span id="total-score" style="color:#ffd700;font-size:20px;">0</span>
      &nbsp;🏆 最高: <span id="high-score" style="color:#ff9800;">0</span>
    </span>
  `;
  container.appendChild(topBar);

  const floatLayer = document.createElement('div');
  floatLayer.id = 'float-layer';
  floatLayer.style.cssText = `
    position: absolute; top: 0; left: 0; right: 0; bottom: 0;
    pointer-events: none; z-index: 20; overflow: hidden;
  `;
  container.appendChild(floatLayer);

  return state;
}

export function updateUI(container: HTMLElement, state: UIState): void {
  const infoEl = container.querySelector<HTMLElement>('#explosive-info');
  if (infoEl) infoEl.textContent = `当前: ${state.selectedExplosive.toUpperCase()}`;

  const totalEl = container.querySelector<HTMLElement>('#total-score');
  if (totalEl) totalEl.textContent = String(scoreState.totalScore);

  const highEl = container.querySelector<HTMLElement>('#high-score');
  if (highEl) highEl.textContent = String(scoreState.highScore);
}

export function updateStickmanCount(count: number): void {
  const el = document.querySelector<HTMLElement>('#stickman-count');
  if (!el) return;
  if (count > 0) {
    el.style.display = '';
    el.textContent = `👤 ${count}`;
  } else {
    el.style.display = 'none';
  }
}

export function showFloatText(
  container: HTMLElement,
  totalScore: number,
  destroyScore: number,
  impactScore: number,
  chainScore: number,
  screenX: number,
  screenY: number,
): void {
  const layer = container.querySelector<HTMLElement>('#float-layer');
  if (!layer) return;

  const el = document.createElement('div');
  el.style.cssText = `
    position: absolute; left: ${screenX}px; top: ${screenY}px;
    color: #ffd700; font-size: 22px; font-weight: bold;
    text-shadow: 0 0 12px rgba(255,200,0,0.9), 0 0 24px rgba(255,150,0,0.5);
    pointer-events: none; z-index: 25;
    animation: floatUp 1.5s ease-out forwards;
  `;
  el.innerHTML = `+${totalScore}`;

  if (destroyScore > 0 || impactScore > 0 || chainScore > 0) {
    const detail = document.createElement('div');
    detail.style.cssText = 'font-size:11px;font-weight:normal;color:#ccc;';
    const parts: string[] = [];
    if (destroyScore > 0) parts.push(`💥摧毁 +${destroyScore}`);
    if (impactScore > 0) parts.push(`🌊波及 +${impactScore}`);
    if (chainScore > 0) parts.push(`🔗连锁 +${chainScore}`);
    detail.textContent = parts.join('  ');
    el.appendChild(detail);
  }

  layer.appendChild(el);
  setTimeout(() => {
    if (el.parentNode) el.parentNode.removeChild(el);
  }, 1600);
}

// Inject float animation CSS
const floatStyle = document.createElement('style');
floatStyle.textContent = `
  @keyframes floatUp {
    0% { opacity: 1; transform: translateY(0) scale(1); }
    30% { opacity: 1; transform: translateY(-30px) scale(1.1); }
    100% { opacity: 0; transform: translateY(-90px) scale(0.8); }
  }
`;
document.head.appendChild(floatStyle);
