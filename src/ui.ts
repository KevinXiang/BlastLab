import { getPhase, getLevelState, calcStars, getProgress, GamePhase } from './level';

export interface UIState {
  selectedExplosive: string;
  score: number;
}

export function createUI(container: HTMLElement): UIState {
  const state: UIState = { selectedExplosive: 'tnt', score: 0 };

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
    <span id="level-info" style="display:none;"></span>
    <span id="score-text">得分: 0</span>
  `;
  container.appendChild(topBar);

  const popup = document.createElement('div');
  popup.id = 'result-popup';
  popup.style.cssText = `
    position: absolute; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.7); display: none;
    justify-content: center; align-items: center; z-index: 30;
  `;
  container.appendChild(popup);

  return state;
}

export function updateUI(container: HTMLElement, state: UIState): void {
  const infoEl = container.querySelector<HTMLElement>('#explosive-info');
  const levelInfoEl = container.querySelector<HTMLElement>('#level-info');
  const scoreEl = container.querySelector<HTMLElement>('#score-text');

  const phase = getPhase();
  const ls = getLevelState();

  if (phase === 'playing' && ls) {
    if (infoEl) infoEl.style.display = 'none';
    if (levelInfoEl) {
      levelInfoEl.style.display = '';
      const total = Object.values(ls.config.weapons).reduce((a, b) => a + b, 0);
      const remain = Object.values(ls.remainingWeapons).reduce((a, b) => a + b, 0);
      const mins = Math.floor(ls.elapsedTime / 60);
      const secs = Math.floor(ls.elapsedTime % 60);
      const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      const progress = getProgress();
      const best = progress.records[ls.config.id]?.bestStars ?? 0;
      levelInfoEl.textContent = `${ls.config.name} | 武器 ${remain}/${total} | ${timeStr} | 最高 ⭐${best}`;
    }
    if (scoreEl) scoreEl.style.display = 'none';
  } else {
    if (infoEl) {
      infoEl.style.display = '';
      infoEl.textContent = `当前: ${state.selectedExplosive.toUpperCase()}`;
    }
    if (levelInfoEl) levelInfoEl.style.display = 'none';
    if (scoreEl) {
      scoreEl.style.display = '';
      scoreEl.textContent = `得分: ${state.score}`;
    }
  }
}

export function showResultPopup(
  container: HTMLElement,
  success: boolean,
  onNext: (() => void) | null,
  onRetry: () => void,
  onMenu: () => void,
  onSkip: (() => void) | null,
): void {
  const popup = container.querySelector<HTMLElement>('#result-popup');
  if (!popup) return;

  const ls = getLevelState();
  if (!ls) return;

  if (success) {
    const stars = calcStars();
    const mins = Math.floor(ls.elapsedTime / 60);
    const secs = Math.floor(ls.elapsedTime % 60);
    const remain = Object.values(ls.remainingWeapons).reduce((a, b) => a + b, 0);

    popup.innerHTML = `
      <div style="background:#222;padding:32px;border-radius:12px;text-align:center;color:#fff;min-width:300px;">
        <div style="font-size:40px;margin-bottom:8px;">${'⭐'.repeat(stars)}</div>
        <h3 style="margin:0 0 8px;">${ls.config.name} 通关！</h3>
        <p style="color:#aaa;font-size:13px;margin:0 0 20px;">
          用时 ${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')} | 剩余武器 ${remain}
        </p>
        <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
          ${onNext ? '<button id="btn-next" style="padding:10px 20px;background:#4caf50;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px;">下一关 ▶</button>' : ''}
          <button id="btn-retry" style="padding:10px 20px;background:#2196f3;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px;">重玩</button>
          <button id="btn-menu" style="padding:10px 20px;background:#555;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px;">返回列表</button>
        </div>
      </div>
    `;
  } else {
    const failCount = getProgress().records[ls.config.id]?.failCount ?? 0;
    popup.innerHTML = `
      <div style="background:#222;padding:32px;border-radius:12px;text-align:center;color:#fff;min-width:300px;">
        <h3 style="margin:0 0 8px;">${ls.config.name} 失败</h3>
        <p style="color:#aaa;font-size:13px;margin:0 0 20px;">武器耗尽，目标未达成</p>
        <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
          <button id="btn-retry" style="padding:10px 20px;background:#f44336;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px;">重试</button>
          ${onSkip ? '<button id="btn-skip" style="padding:10px 20px;background:#ff9800;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px;">跳过此关</button>' : ''}
          <button id="btn-menu" style="padding:10px 20px;background:#555;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px;">返回列表</button>
        </div>
        ${failCount > 0 ? `<p style="color:#888;font-size:11px;margin-top:12px;">失败 ${failCount} 次${onSkip ? '' : '（需5次才能跳过）'}</p>` : ''}
      </div>
    `;
  }

  popup.style.display = 'flex';

  popup.querySelector('#btn-next')?.addEventListener('click', () => { hidePopup(popup); onNext?.(); });
  popup.querySelector('#btn-retry')?.addEventListener('click', () => { hidePopup(popup); onRetry(); });
  popup.querySelector('#btn-menu')?.addEventListener('click', () => { hidePopup(popup); onMenu(); });
  popup.querySelector('#btn-skip')?.addEventListener('click', () => { hidePopup(popup); onSkip?.(); });
}

function hidePopup(popup: HTMLElement): void {
  popup.style.display = 'none';
  popup.innerHTML = '';
}
