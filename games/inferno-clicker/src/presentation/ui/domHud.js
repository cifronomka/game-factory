// @ts-check

const STYLE_ID = 'inferno-presentation-styles';
const MAX_SCORE = 2_147_483_647;
const SCORE_FORMAT = new Intl.NumberFormat('ru-RU');
const MULTIPLIER_FORMAT = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });

/** @param {number} value */
function formatScore(value) {
  return value >= MAX_SCORE ? 'MAX' : SCORE_FORMAT.format(Math.floor(value));
}

/** @param {number} value */
function formatMultiplier(value) {
  return MULTIPLIER_FORMAT.format(value);
}

/** @param {HTMLElement} element @param {string} value */
function setText(element, value) { if (element.textContent !== value) element.textContent = value; }

/** @param {HTMLElement} element @param {boolean} hidden */
function setHidden(element, hidden) { if (element.hidden !== hidden) element.hidden = hidden; }
const CSS = `
.inferno-presentation{position:relative;width:100%;height:100%;min-height:420px;overflow:hidden;background:#050407;color:#fff3df;font-family:system-ui,-apple-system,sans-serif;touch-action:manipulation;user-select:none}
.inferno-presentation canvas{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none}
.inferno-hud{position:absolute;inset:0;pointer-events:none;padding:max(16px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) max(16px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left));display:grid;grid-template-rows:auto 1fr auto;gap:12px;text-shadow:0 2px 5px #000}
.inferno-hud__top{justify-self:center;width:min(520px,88vw);text-align:center;background:linear-gradient(#241a20c9,#100d11c9);border:1px solid #70442f;border-radius:14px;padding:8px 14px;box-shadow:0 0 18px #000}
.inferno-hud__stage{font-size:clamp(16px,2.6vh,26px);letter-spacing:.08em;text-transform:uppercase}
.inferno-hud__score{display:flex;justify-content:center;gap:4px 16px;flex-wrap:wrap;font-variant-numeric:tabular-nums;font-size:clamp(20px,2.2vh,22px)}
.inferno-hud__progress{height:8px;margin-top:7px;background:#09080b;border-radius:99px;overflow:hidden}.inferno-hud__progress>i{display:block;height:100%;background:linear-gradient(90deg,#9d3122,#ffd370)}
.inferno-hud__signals{align-self:start;justify-self:center;display:grid;gap:7px;place-items:center;min-height:0;margin-top:2px;color:#ffe3b3;font-size:clamp(15px,2.1vh,20px)}
.inferno-hud__badge{background:#130f14dd;border:1px solid #80513f;border-radius:99px;padding:7px 15px;min-width:96px;text-align:center}
.inferno-hud__badge[hidden]{display:none}.inferno-hud__badge--boost{border-color:#d6ae52;color:#e5c7ff}
.inferno-hud__badge--seal{border-color:#a777d4;color:#ead2ff}
.inferno-hud__controls{display:flex;pointer-events:auto;justify-content:center;align-items:end;gap:8px;flex-wrap:wrap}
.inferno-hud button{min-width:48px;min-height:48px;border:1px solid #80513f;border-radius:12px;background:#211921e8;color:#fff3df;padding:8px 13px;font:inherit;cursor:pointer}.inferno-hud button:focus-visible{outline:3px solid #ffd370;outline-offset:2px}.inferno-hud button:disabled{opacity:.45;cursor:not-allowed}
.inferno-hud__tap-hint{position:absolute;left:50%;top:64%;transform:translate(-50%,-50%);min-width:96px;min-height:96px;border:1px dashed #e17c4688;border-radius:50%;display:grid;place-items:center;color:#ffd4a288;pointer-events:none}
.inferno-hud__tap-hint[hidden]{display:none}
@media (min-width:900px) and (orientation:landscape){.inferno-hud{grid-template-columns:minmax(230px,1fr) minmax(360px,760px) minmax(230px,1fr);grid-template-rows:1fr}.inferno-hud__top{grid-column:1;align-self:start;width:auto}.inferno-hud__signals{grid-column:3;align-self:center}.inferno-hud__controls{grid-column:1;align-self:end}.inferno-hud__tap-hint{bottom:12%}}
@media (orientation:landscape) and (max-height:419px){.inferno-presentation{min-height:0}.inferno-hud{padding:10px}.inferno-hud__top{padding:5px 12px}.inferno-hud__stage{font-size:16px}.inferno-hud__score{font-size:16px}.inferno-hud__controls{gap:6px}.inferno-hud button{padding:6px 10px}}
`;

/** @param {Document} document */
function ensureStyles(document) {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.append(style);
}

export class DomHud {
  /** @param {HTMLElement} root @param {import('../types.js').PresentationCallbacks} callbacks */
  constructor(root, callbacks) {
    ensureStyles(root.ownerDocument);
    this.root = root;
    this.callbacks = callbacks;
    const document = root.ownerDocument;
    this.element = document.createElement('section');
    this.element.className = 'inferno-hud';
    this.element.setAttribute('aria-label', 'Интерфейс игры Зажги');
    this.element.innerHTML = `<header class="inferno-hud__top"><div class="inferno-hud__stage"></div><div class="inferno-hud__score"><span data-score></span><span data-multiplier></span></div><div class="inferno-hud__progress" role="progressbar" aria-label="Прогресс стадии"><i></i></div></header><div class="inferno-hud__signals" aria-live="polite"><span class="inferno-hud__badge" data-encounter hidden></span><span class="inferno-hud__badge inferno-hud__badge--seal" data-seal hidden></span><span class="inferno-hud__badge inferno-hud__badge--boost" data-boost hidden></span></div><nav class="inferno-hud__controls" aria-label="Настройки"><button type="button" data-action="pause">Пауза</button><button type="button" data-action="mute">Звук</button><button type="button" data-action="motion">Эффекты</button><button type="button" data-action="reward">Печать ×2</button></nav><div class="inferno-hud__tap-hint" aria-hidden="true">ЖМИ</div>`;
    root.append(this.element);
    /** @type {HTMLElement} */ this.stage = this.require('.inferno-hud__stage');
    /** @type {HTMLElement} */ this.score = this.require('[data-score]');
    /** @type {HTMLElement} */ this.multiplier = this.require('[data-multiplier]');
    /** @type {HTMLElement} */ this.progress = this.require('.inferno-hud__progress');
    /** @type {HTMLElement} */ this.progressFill = this.require('.inferno-hud__progress i');
    /** @type {HTMLElement} */ this.encounter = this.require('[data-encounter]');
    /** @type {HTMLElement} */ this.seal = this.require('[data-seal]');
    /** @type {HTMLElement} */ this.boost = this.require('[data-boost]');
    /** @type {HTMLButtonElement} */ this.pauseButton = /** @type {any} */ (this.require('[data-action=pause]'));
    /** @type {HTMLButtonElement} */ this.muteButton = /** @type {any} */ (this.require('[data-action=mute]'));
    /** @type {HTMLButtonElement} */ this.motionButton = /** @type {any} */ (this.require('[data-action=motion]'));
    /** @type {HTMLButtonElement} */ this.rewardButton = /** @type {any} */ (this.require('[data-action=reward]'));
    /** @type {HTMLElement} */ this.tapHint = this.require('.inferno-hud__tap-hint');
    this.listeners = [
      [this.pauseButton, callbacks.onPauseToggle],
      [this.muteButton, callbacks.onMuteToggle],
      [this.motionButton, callbacks.onReducedMotionToggle],
      [this.rewardButton, callbacks.onRewardRequest],
    ];
    for (const [button, listener] of this.listeners) button.addEventListener('click', listener);
  }

  /** @param {string} selector */
  require(selector) {
    const node = this.element.querySelector(selector);
    if (!(node instanceof this.root.ownerDocument.defaultView.HTMLElement)) throw new Error(`Missing HUD node: ${selector}`);
    return node;
  }

  /** @param {import('../types.js').PresentationViewModel} viewModel @param {any} visual */
  render(viewModel, visual) {
    setText(this.stage, `${visual.stage}. ${visual.stageName}`);
    setText(this.score, `Жар ${Math.round(viewModel.heat)}`);
    setText(this.multiplier, `Счёт ${formatScore(viewModel.score)} · Рекорд ${formatScore(viewModel.bestScore)} · ×${formatMultiplier(viewModel.multiplier)}`);
    const progress = Math.round(visual.stageProgress * 100);
    if (this.progress.getAttribute('aria-valuenow') !== String(progress)) this.progress.setAttribute('aria-valuenow', String(progress));
    if (this.progressFill.style.width !== `${progress}%`) this.progressFill.style.width = `${progress}%`;
    if (viewModel.encounter) {
      const label = viewModel.encounter.kind === 'servant' ? 'Пепельный порыв' : viewModel.encounter.kind === 'demoness' ? 'Холодное клеймо' : 'Окно жара';
      const phase = viewModel.encounter.phase === 'telegraph' ? 'готовится' : 'действует';
      setText(this.encounter, `${label} · ${phase}`);
      setHidden(this.encounter, false);
    } else setHidden(this.encounter, true);
    if (viewModel.boost?.active) {
      setText(this.boost, `Печать ×2 · ${Math.ceil(viewModel.boost.remainingMs / 1000)}с`);
      setHidden(this.boost, false);
    } else setHidden(this.boost, true);
    if (viewModel.sealLockedAtCap) {
      setText(this.seal, 'Печать удерживает предел');
      setHidden(this.seal, false);
    } else if (viewModel.sealBroken) {
      setText(this.seal, 'Печать разрушена · доступно ×2');
      setHidden(this.seal, false);
    } else setHidden(this.seal, true);
    setText(this.pauseButton, viewModel.paused ? 'Продолжить' : 'Пауза');
    setText(this.muteButton, viewModel.muted ? 'Включить звук' : 'Выключить звук');
    setText(this.motionButton, viewModel.reducedMotion ? 'Больше эффектов' : 'Меньше эффектов');
    setText(this.rewardButton, viewModel.rewardedProvider === 'test' ? 'Получить ×2 (тест)' : 'Печать ×2');
    setHidden(this.rewardButton, !viewModel.rewardedSupported || !viewModel.rewardedAvailable || Boolean(viewModel.boost?.active));
    const rewardDisabled = !viewModel.rewardedAvailable || Boolean(viewModel.boost?.active);
    if (this.rewardButton.disabled !== rewardDisabled) this.rewardButton.disabled = rewardDisabled;
    if (this.rewardButton.getAttribute('aria-disabled') !== String(rewardDisabled)) this.rewardButton.setAttribute('aria-disabled', String(rewardDisabled));
    setHidden(this.tapHint, !viewModel.showTapHint);
  }

  destroy() {
    for (const [button, listener] of this.listeners) button.removeEventListener('click', listener);
    this.element.remove();
  }
}
