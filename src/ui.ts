import { getPhase, getLevelState, calcStars, getProgress, GamePhase, LevelConfig, Objective } from './level';

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
      const objText = formatObjectiveProgress(ls.config, ls.destroyedObjectIds);
      levelInfoEl.innerHTML = `<div style="font-size:13px;">${ls.config.name} | ${objText} | ⏱ ${timeStr} | ⭐ ${best}</div>`;
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

function formatObjectiveProgress(
  config: LevelConfig,
  destroyedIds: Set<number>,
): string {
  const parts = config.objectives.map((obj, i) => {
    switch (obj.type) {
      case 'destroy_targets': {
        const done = obj.targetIds.filter(id => destroyedIds.has(id)).length;
        const total = obj.targetIds.length;
        return `🎯${done}/${total}`;
      }
      case 'destroy_count': {
        const done = destroyedIds.size;
        return `💥${Math.min(done, obj.count)}/${obj.count}`;
      }
      case 'clear_area': {
        let remaining = 0;
        for (let j = 0; j < config.buildings.length; j++) {
          const b = config.buildings[j];
          const dist = Math.sqrt((b.x - obj.center.x) ** 2 + (b.z - obj.center.z) ** 2);
          if (dist <= obj.radius && !destroyedIds.has(j + 1)) {
            remaining++;
          }
        }
        return `🧹剩余${remaining}`;
      }
      default:
        return '';
    }
  });
  return parts.join(' ');
}

function formatObjective(obj: Objective): string {
  switch (obj.type) {
    case 'destroy_targets':
      return `摧毁 ${obj.targetIds.length} 栋指定建筑`;
    case 'destroy_count':
      return `摧毁任意 ${obj.count} 个物体（建筑/车辆/树木）`;
    case 'clear_area':
      return `清空中心半径 ${obj.radius}m 区域内的所有建筑`;
    default:
      return '';
  }
}

function starRulesText(parTime: number): string {
  return `⭐×1 完成目标 | ⭐×1 节省≥30%武器 | ⭐×1 ${parTime * 0.6}s内完成`;
}

export function showLevelIntro(
  container: HTMLElement,
  config: LevelConfig,
  onStart: () => void,
): void {
  const popup = container.querySelector<HTMLElement>('#result-popup');
  if (!popup) return;

  const weaponList = Object.entries(config.weapons)
    .map(([k, v]) => `${k}×${v}`)
    .join('、');

  popup.innerHTML = `
    <div style="background:#1a1a2e;padding:28px;border-radius:12px;text-align:center;color:#fff;min-width:340px;max-width:400px;">
      <h2 style="margin:0 0 4px;color:#ff9800;">${config.name}</h2>
      <p style="color:#aaa;font-size:13px;margin:0 0 16px;">第 ${config.id} 关</p>
      <div style="background:rgba(255,255,255,0.05);padding:12px;border-radius:8px;margin-bottom:12px;text-align:left;">
        <div style="font-size:12px;color:#888;margin-bottom:6px;">任务目标</div>
        ${config.objectives.map((o, i) => `<div style="font-size:14px;margin-bottom:4px;">${i + 1}. ${formatObjective(o)}</div>`).join('')}
      </div>
      <div style="background:rgba(255,255,255,0.05);padding:12px;border-radius:8px;margin-bottom:12px;text-align:left;">
        <div style="font-size:12px;color:#888;margin-bottom:6px;">可用武器</div>
        <div style="font-size:14px;">${weaponList}</div>
      </div>
      ${config.restrictions?.length ? `
        <div style="background:rgba(255,0,0,0.1);padding:12px;border-radius:8px;margin-bottom:12px;text-align:left;">
          <div style="font-size:12px;color:#f44;margin-bottom:4px;">特殊规则</div>
          ${config.restrictions.map(r => {
            if (r.type === 'no_weapon') return `<div style="font-size:13px;">禁止使用: ${r.weapon}</div>`;
            if (r.type === 'time_limit') return `<div style="font-size:13px;">时间限制: ${r.seconds}秒</div>`;
            return '';
          }).join('')}
        </div>
      ` : ''}
      <div style="background:rgba(255,215,0,0.08);padding:12px;border-radius:8px;margin-bottom:16px;text-align:left;">
        <div style="font-size:12px;color:#ffd700;margin-bottom:6px;">星级评定</div>
        <div style="font-size:12px;color:#ccc;">${starRulesText(config.parTime)}</div>
      </div>
      <button id="btn-start-level" style="padding:12px 48px;background:#ff9800;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:16px;font-weight:bold;">开始挑战</button>
    </div>
  `;

  popup.style.display = 'flex';

  popup.querySelector('#btn-start-level')?.addEventListener('click', () => {
    hidePopup(popup);
    onStart();
  });
}
