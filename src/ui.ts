import { scoreState, ScoreBreakdown } from './game';

export interface UIState {
  selectedExplosive: string;
}

export interface StickmanStats {
  alive: number;
  total: number;
  redAlive: number;
  redTotal: number;
  blueAlive: number;
  blueTotal: number;
  redDead: number;
  blueDead: number;
  winner: 'red' | 'blue' | 'draw' | 'none';
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
    <span style="display:flex;gap:20px;align-items:center;">
      <span id="explosive-info">TNT</span>
      <span id="stickman-stats" style="display:none;gap:8px;align-items:center;"></span>
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

export function createFireRateSlider(container: HTMLElement, onChange: (rate: number) => void): void {
  const wrapper = document.createElement('div');
  wrapper.style.cssText = `
    position: absolute; top: 44px; right: 16px;
    display: flex; align-items: center; gap: 8px;
    background: rgba(0,0,0,0.6); color: #fff;
    padding: 4px 10px; border-radius: 6px;
    font-size: 12px; z-index: 10;
  `;
  const label = document.createElement('span');
  label.textContent = '射速:';
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '1';
  slider.max = '200';
  slider.value = '10';
  slider.style.cssText = 'width:100px;cursor:pointer;';
  const valDisplay = document.createElement('span');
  valDisplay.textContent = '10/s';
  valDisplay.style.minWidth = '40px';

  slider.addEventListener('input', () => {
    const v = parseInt(slider.value);
    valDisplay.textContent = `${v}/s`;
    onChange(v);
  });

  wrapper.appendChild(label);
  wrapper.appendChild(slider);
  wrapper.appendChild(valDisplay);
  container.appendChild(wrapper);
}

export function updateUI(container: HTMLElement, state: UIState): void {
  const infoEl = container.querySelector<HTMLElement>('#explosive-info');
  if (infoEl) infoEl.textContent = `当前: ${state.selectedExplosive.toUpperCase()}`;

  const totalEl = container.querySelector<HTMLElement>('#total-score');
  if (totalEl) totalEl.textContent = String(scoreState.totalScore);

  const highEl = container.querySelector<HTMLElement>('#high-score');
  if (highEl) highEl.textContent = String(scoreState.highScore);
}

export function updateStickmanStats(stats: StickmanStats): void {
  const el = document.querySelector<HTMLElement>('#stickman-stats');
  if (!el) return;

  if (stats.total === 0) {
    el.style.display = 'none';
    return;
  }

  el.style.display = 'flex';
  let winnerHtml = '';
  if (stats.winner === 'red') winnerHtml = '<span title="红方优势" style="color:#ff6666;font-weight:bold;">🏆 红方优势</span>';
  else if (stats.winner === 'blue') winnerHtml = '<span title="蓝方优势" style="color:#6666ff;font-weight:bold;">🏆 蓝方优势</span>';
  else if (stats.winner === 'draw') winnerHtml = '<span title="平局" style="color:#ffd700;">⚖️ 平局</span>';

  el.innerHTML = [
    `<span title="总数">⚔️ ${stats.total}</span>`,
    `<span title="存活" style="color:#4caf50;">👤 ${stats.alive}</span>`,
    `<span title="红方总数" style="color:#ff6666;">🟥 ${stats.redTotal}</span>`,
    `<span title="红方存活" style="color:#ff4444;">❤️ ${stats.redAlive}</span>`,
    `<span title="蓝方总数" style="color:#6666ff;">🟦 ${stats.blueTotal}</span>`,
    `<span title="蓝方存活" style="color:#4488ff;">💙 ${stats.blueAlive}</span>`,
    `<span title="红方死亡" style="color:#ff3333;">💀 ${stats.redDead}</span>`,
    `<span title="蓝方死亡" style="color:#3333ff;">💀 ${stats.blueDead}</span>`,
    winnerHtml,
  ].filter(Boolean).join('');
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
