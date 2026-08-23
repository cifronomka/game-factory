// @ts-check

import { createI18n } from '../../app/i18n.js';

const STYLE_ID = 'inferno-presentation-styles';
const MAX_SCORE = 2_147_483_647;

/** @param {HTMLElement} element @param {string} value */
function setText(element, value) { if (element.textContent !== value) element.textContent = value; }

/** @param {HTMLElement} element @param {boolean} hidden */
function setHidden(element, hidden) { if (element.hidden !== hidden) element.hidden = hidden; }

const CSS = `
.inferno-presentation{position:relative;width:100%;height:100%;height:var(--app-visible-height,100%);min-height:420px;overflow:hidden;background-color:#050407;background-image:radial-gradient(ellipse at center,#29110e 0,#10090b 38%,#050407 75%);color:#fff3df;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;touch-action:manipulation;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent;overscroll-behavior:none}
.inferno-presentation canvas{position:absolute;top:0;right:0;bottom:0;left:0;inset:0;width:100%;height:100%;display:block;touch-action:none;-webkit-touch-callout:none}
.inferno-hud{position:absolute;top:0;right:0;bottom:0;left:0;inset:0;width:100%;height:100%;pointer-events:none;padding:16px;padding-top:max(16px,env(safe-area-inset-top));padding-right:max(16px,env(safe-area-inset-right));padding-bottom:max(16px,env(safe-area-inset-bottom));padding-left:max(16px,env(safe-area-inset-left));display:flex;flex-direction:column;justify-content:space-between;gap:12px;text-shadow:0 2px 5px #000}
@supports(display:grid){.inferno-hud{display:grid;grid-template-rows:auto 1fr auto;justify-content:stretch}}
.inferno-hud__top{align-self:center;width:88vw;max-width:520px;width:min(520px,88vw);text-align:center;background:rgba(20,14,18,.91);background:linear-gradient(#241a20e8,#100d11e8);border:1px solid #70442f;border-radius:14px;padding:8px 14px;box-shadow:0 0 18px #000}
.inferno-hud__stage{font-size:20px;font-size:clamp(16px,2.6vh,26px);letter-spacing:.08em;text-transform:uppercase}
.inferno-hud__score{display:flex;justify-content:center;gap:4px 16px;flex-wrap:wrap;font-variant-numeric:tabular-nums;font-size:18px;font-size:clamp(17px,2.2vh,22px)}
.inferno-hud__progress{height:8px;margin-top:7px;background:#09080b;border-radius:99px;overflow:hidden}.inferno-hud__progress>i{display:block;height:100%;background:linear-gradient(90deg,#9d3122,#ffd370)}
.inferno-hud__signals{align-self:center;display:flex;flex-direction:column;gap:7px;align-items:center;min-height:0;margin-top:2px;color:#ffe3b3;font-size:16px;font-size:clamp(15px,2.1vh,20px)}
.inferno-hud__badge{background:#130f14e8;border:1px solid #80513f;border-radius:99px;padding:7px 15px;min-width:96px;text-align:center}.inferno-hud__badge[hidden]{display:none}.inferno-hud__badge--boost{border-color:#d6ae52;color:#fff0a6}
.inferno-hud__debuffs{display:flex;flex-direction:column;gap:7px;width:100%;max-width:340px;width:min(340px,100%);min-width:0}.inferno-hud__debuff{display:grid;grid-template-columns:30px minmax(0,1fr) auto;align-items:center;gap:2px 7px;min-width:0;background:rgba(19,15,20,.93);background:#130f14ed;border:1px solid #8d503d;border-radius:12px;padding:8px 9px;box-shadow:0 3px 14px rgba(0,0,0,.53);box-shadow:0 3px 14px #0008}.inferno-hud__debuff-icon{grid-column:1;grid-row:1/4;width:28px;height:28px;display:grid;place-items:center;border-radius:50%;background:#3a201b;color:#ffd3a1}.inferno-hud__debuff-source{grid-column:2;grid-row:1;font-size:12px;color:#e7bda4;min-width:0}.inferno-hud__debuff-name{grid-column:2;grid-row:2;font-weight:700;min-width:0}.inferno-hud__debuff-time{grid-column:3;grid-row:1/4;font-variant-numeric:tabular-nums;white-space:nowrap}.inferno-hud__debuff-effect{grid-column:2;grid-row:3;font-size:12px;color:#ffd7b3;min-width:0}.inferno-hud__debuff--demoness{border-color:#5297a2}.inferno-hud__debuff--demoness .inferno-hud__debuff-icon{background:#17333a;color:#bceff2}.inferno-hud__debuff-total{align-self:center;font-size:12px;color:#efcfb2;text-align:center}
.inferno-hud__bottom{align-self:center;display:flex;flex-direction:column;align-items:center;gap:8px;width:100%;max-width:720px;pointer-events:none}
  .inferno-hud__reward{pointer-events:auto;width:calc(100vw - 32px);max-width:560px;width:min(560px,calc(100vw - 32px));min-height:48px;border:1px solid #d18c42;border-radius:14px;background:rgba(45,25,24,.95);background:linear-gradient(110deg,#44231ef2,#1c1518f2);color:#ffe8bd;padding:9px 16px;font:inherit;font-weight:700;box-shadow:0 7px 24px rgba(0,0,0,.67);box-shadow:0 7px 24px #000a;cursor:pointer}.inferno-hud__reward[hidden]{display:none}.inferno-hud__reward:disabled{opacity:.72;cursor:default}
  .app-shell[data-toast-active="true"] .inferno-hud__reward{visibility:hidden;pointer-events:none}
.inferno-hud__controls{display:flex;pointer-events:auto;justify-content:center;align-items:flex-end;gap:8px;flex-wrap:wrap}
.inferno-hud__control{min-width:48px;min-height:48px;border:1px solid #80513f;border-radius:12px;background:#211921ed;color:#fff3df;padding:8px 13px;font:inherit;cursor:pointer}.inferno-hud button:focus-visible{outline:3px solid #ffd370;outline-offset:2px}.inferno-hud button:disabled{cursor:not-allowed}
.inferno-hud__tap-hint{position:absolute;left:50%;top:64%;transform:translate(-50%,-50%);min-width:96px;min-height:96px;border:1px dashed #e17c4688;border-radius:50%;display:grid;place-items:center;color:#ffd4a288;pointer-events:none}.inferno-hud__tap-hint[hidden]{display:none}
@media (max-width:899px) and (orientation:portrait){.inferno-hud__signals{justify-self:end;margin:0 0 8px}.inferno-hud__debuffs{width:92vw;max-width:330px;width:min(330px,92vw)}.inferno-hud__control{padding:7px 10px;font-size:14px}}
@media (min-width:900px) and (orientation:landscape){.inferno-hud{grid-template-columns:minmax(230px,1fr) minmax(360px,760px) minmax(230px,1fr);grid-template-rows:1fr}.inferno-hud__top{grid-column:1;align-self:start;width:auto}.inferno-hud__signals{grid-column:3;align-self:center;width:100%;min-width:0}.inferno-hud__debuffs{width:100%}.inferno-hud__bottom{grid-column:1;align-self:end}.inferno-hud__reward{width:100%;max-width:320px;width:min(320px,100%)}.inferno-hud__tap-hint{bottom:12%}}
@media (orientation:landscape) and (max-height:520px){.inferno-presentation{min-height:0}.inferno-hud{padding:6px;gap:3px}.inferno-hud__top{padding:3px 8px}.inferno-hud__stage{font-size:13px}.inferno-hud__score{font-size:13px}.inferno-hud__progress{height:4px}.inferno-hud__signals{font-size:12px}.inferno-hud__debuff{padding:3px 6px}.inferno-hud__bottom{gap:3px}.inferno-hud__reward{min-height:48px;padding:3px 8px;font-size:12px}.inferno-hud__controls{gap:3px}.inferno-hud__control{min-height:48px;min-width:48px;padding:3px 7px;font-size:12px}}
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
  /** @param {HTMLElement} root @param {import('../types.js').PresentationCallbacks} callbacks @param {import('../../app/i18n.js').I18n} [i18n] */
  constructor(root, callbacks, i18n = createI18n('ru')) {
    ensureStyles(root.ownerDocument);
    this.root = root;
    this.callbacks = callbacks;
    this.i18n = i18n;
    const document = root.ownerDocument;
    this.element = document.createElement('section');
    this.element.className = 'inferno-hud';
    this.element.setAttribute('aria-label', i18n.t('aria.hud'));
    this.element.innerHTML = `<header class="inferno-hud__top"><div class="inferno-hud__stage"></div><div class="inferno-hud__score"><span data-score></span><span data-multiplier></span></div><div class="inferno-hud__progress" role="progressbar" aria-valuemin="0" aria-valuemax="100"><i></i></div></header><div class="inferno-hud__signals" aria-live="polite"><span class="inferno-hud__badge" data-encounter hidden></span><div class="inferno-hud__debuffs" data-debuffs></div><span class="inferno-hud__badge inferno-hud__badge--boost" data-boost hidden></span></div><div class="inferno-hud__bottom"><button type="button" class="inferno-hud__reward" data-action="reward" hidden></button><nav class="inferno-hud__controls"><button type="button" class="inferno-hud__control" data-action="pause"></button><button type="button" class="inferno-hud__control" data-action="goals"></button><button type="button" class="inferno-hud__control" data-action="mute"></button><button type="button" class="inferno-hud__control" data-action="motion"></button></nav></div><div class="inferno-hud__tap-hint" aria-hidden="true"></div>`;
    root.append(this.element);
    /** @type {HTMLElement} */ this.stage = this.require('.inferno-hud__stage');
    /** @type {HTMLElement} */ this.score = this.require('[data-score]');
    /** @type {HTMLElement} */ this.multiplier = this.require('[data-multiplier]');
    /** @type {HTMLElement} */ this.progress = this.require('.inferno-hud__progress');
    /** @type {HTMLElement} */ this.progressFill = this.require('.inferno-hud__progress i');
    /** @type {HTMLElement} */ this.encounter = this.require('[data-encounter]');
    /** @type {HTMLElement} */ this.debuffs = this.require('[data-debuffs]');
    /** @type {HTMLElement} */ this.boost = this.require('[data-boost]');
    /** @type {HTMLButtonElement} */ this.pauseButton = /** @type {any} */ (this.require('[data-action=pause]'));
    /** @type {HTMLButtonElement} */ this.goalsButton = /** @type {any} */ (this.require('[data-action=goals]'));
    /** @type {HTMLButtonElement} */ this.muteButton = /** @type {any} */ (this.require('[data-action=mute]'));
    /** @type {HTMLButtonElement} */ this.motionButton = /** @type {any} */ (this.require('[data-action=motion]'));
    /** @type {HTMLButtonElement} */ this.rewardButton = /** @type {any} */ (this.require('[data-action=reward]'));
    /** @type {HTMLElement} */ this.tapHint = this.require('.inferno-hud__tap-hint');
    this.progress.setAttribute('aria-label', i18n.t('aria.stageProgress'));
    this.element.querySelector('.inferno-hud__controls')?.setAttribute('aria-label', i18n.t('aria.settings'));
    setText(this.goalsButton, i18n.t('pause.goals'));
    setText(this.tapHint, i18n.t('hud.tap'));
    this.listeners = [
      [this.pauseButton, callbacks.onPauseToggle],
      [this.goalsButton, callbacks.onGoalsRequest],
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

  /** @param {number} value */
  formatScore(value) { return value >= MAX_SCORE ? 'MAX' : this.i18n.number(value); }

  /** @param {import('../types.js').PresentationViewModel} viewModel @param {any} visual */
  render(viewModel, visual) {
    const { t } = this.i18n;
    setText(this.stage, `${visual.stage}. ${visual.stageName}`);
    setText(this.score, t('hud.heat', { value: Math.round(viewModel.heat) }));
    setText(this.multiplier, t('hud.score', {
      score: this.formatScore(viewModel.score),
      best: this.formatScore(viewModel.bestScore),
      multiplier: this.i18n.decimal(viewModel.multiplier),
    }));
    const progress = Math.round(visual.stageProgress * 100);
    if (this.progress.getAttribute('aria-valuenow') !== String(progress)) this.progress.setAttribute('aria-valuenow', String(progress));
    if (this.progressFill.style.width !== `${progress}%`) this.progressFill.style.width = `${progress}%`;
    const telegraphs = (viewModel.encounters ?? []).filter((item) => item.phase === 'telegraph');
    if (telegraphs.length > 0) {
      const labels = telegraphs.map((item) => item.kind === 'servant'
        ? t('encounter.servantTelegraph')
        : item.kind === 'demoness' ? t('encounter.wardenTelegraph') : t('encounter.heatWindowTelegraph'));
      setText(this.encounter, labels.join(' · '));
      setHidden(this.encounter, false);
    } else setHidden(this.encounter, true);
    this.renderDebuffs(viewModel.debuffs ?? [], viewModel.combinedDecayFactor ?? 1);
    if (viewModel.boost?.active) {
      setText(this.boost, t('hud.boost', { seconds: Math.ceil(viewModel.boost.remainingMs / 1_000) }));
      setHidden(this.boost, false);
    } else setHidden(this.boost, true);
    setText(this.pauseButton, viewModel.paused ? t('hud.continue') : t('hud.pause'));
    setText(this.muteButton, viewModel.muted ? t('hud.soundOn') : t('hud.soundOff'));
    setText(this.motionButton, viewModel.reducedMotion ? t('hud.motionMore') : t('hud.motionLess'));
    const coolingDown = viewModel.rewardOffer.cooldownRemainingMs > 0;
    setText(this.rewardButton, coolingDown
      ? t('hud.rewardCooldown', { seconds: Math.ceil(viewModel.rewardOffer.cooldownRemainingMs / 1_000) })
      : t('hud.rewardOffer'));
    setHidden(this.rewardButton, !viewModel.rewardOffer.visible);
    const rewardDisabled = !viewModel.rewardOffer.available;
    if (this.rewardButton.disabled !== rewardDisabled) this.rewardButton.disabled = rewardDisabled;
    this.rewardButton.setAttribute('aria-disabled', String(rewardDisabled));
    setHidden(this.tapHint, !viewModel.showTapHint);
  }

  /** @param {readonly any[]} debuffs @param {number} combined */
  renderDebuffs(debuffs, combined) {
    const document = this.root.ownerDocument;
    const fragment = document.createDocumentFragment();
    for (const debuff of debuffs) {
      const row = document.createElement('div');
      row.className = `inferno-hud__debuff inferno-hud__debuff--${debuff.kind}`;
      const icon = document.createElement('span'); icon.className = 'inferno-hud__debuff-icon'; icon.textContent = this.i18n.t(debuff.kind === 'servant' ? 'debuff.servant.icon' : 'debuff.warden.icon');
      const source = document.createElement('span'); source.className = 'inferno-hud__debuff-source'; source.textContent = this.i18n.t(debuff.sourceKey);
      const name = document.createElement('span'); name.className = 'inferno-hud__debuff-name'; name.textContent = this.i18n.t(debuff.effectKey);
      const effect = document.createElement('span'); effect.className = 'inferno-hud__debuff-effect'; effect.textContent = this.i18n.t('debuff.decay', { value: this.i18n.decimal(debuff.decayFactor) });
      const time = document.createElement('span'); time.className = 'inferno-hud__debuff-time'; time.textContent = `${this.i18n.seconds(debuff.remainingMs)}${this.i18n.locale === 'ru' ? 'с' : 's'}`;
      row.append(icon, source, name, effect, time);
      fragment.append(row);
    }
    if (debuffs.length > 1) {
      const total = document.createElement('span');
      total.className = 'inferno-hud__debuff-total';
      total.textContent = this.i18n.t('debuff.total', { value: this.i18n.decimal(combined) });
      fragment.append(total);
    }
    this.debuffs.replaceChildren(fragment);
  }

  destroy() {
    for (const [button, listener] of this.listeners) button.removeEventListener('click', listener);
    this.element.remove();
  }
}
