// @ts-check

/** @typedef {'ru'|'en'} Locale */

const MESSAGES = Object.freeze({
  ru: Object.freeze({
    'app.title': 'Зажги',
    'app.description': 'Поддерживайте живое пламя, преодолевайте помехи и улучшайте личный рекорд.',
    'boot.loading': 'Разжигаем пламя…',
    'boot.assetError': 'Не удалось загрузить основные изображения.',
    'boot.retry': 'Повторить',
    'boot.fallback': 'Включён упрощённый фон',
    'fatal.title': 'Пламя не зажглось',
    'fatal.body': 'Обновите страницу. Сохранённые на устройстве рекорды не пропадут.',
    'aria.game': 'Игровое поле Зажги. Нажимайте или касайтесь огня, чтобы поддерживать жар.',
    'aria.hud': 'Интерфейс игры Зажги',
    'aria.stageProgress': 'Прогресс текущей стадии',
    'aria.settings': 'Настройки и добровольное усиление',
    'hud.heat': 'Жар {value}',
    'hud.score': 'Счёт {score} · Рекорд {best} · ×{multiplier}',
    'hud.tap': 'ЖМИ',
    'hud.pause': 'Пауза',
    'hud.continue': 'Продолжить',
    'hud.soundOff': 'Выключить звук',
    'hud.soundOn': 'Включить звук',
    'hud.motionLess': 'Меньше эффектов',
    'hud.motionMore': 'Больше эффектов',
    'hud.rewardOffer': 'Посмотреть рекламу — ×2 к силе жара на 60 секунд',
    'hud.rewardCooldown': 'Новое усиление через {seconds} с',
    'hud.boost': 'Сила жара ×2 · {seconds} с',
    'encounter.servantTelegraph': 'Пепельный слуга готовит выдох',
    'encounter.wardenTelegraph': 'Хранительница угасания собирает холод',
    'encounter.heatWindowTelegraph': 'Готовится окно жара',
    'debuff.servant.source': 'Пепельный слуга',
    'debuff.servant.icon': 'П',
    'debuff.servant.effect': 'Пепельный выдох',
    'debuff.warden.source': 'Хранительница угасания',
    'debuff.warden.icon': 'Х',
    'debuff.warden.effect': 'Холодное угасание',
    'debuff.decay': 'Остывание ×{value}',
    'debuff.total': 'Общее остывание ×{value}',
    'stage.1': 'Тьма',
    'stage.2': 'Искра',
    'stage.3': 'Пепельный слуга',
    'stage.4': 'Алый порог',
    'stage.5': 'Хранительница угасания',
    'stage.6': 'Огненное кольцо',
    'stage.7': 'Инферно',
    'pause.title': 'Пауза',
    'pause.body': 'Жар и все активные таймеры остановлены.',
    'pause.howTo': 'Как играть',
    'pause.goals': 'Цели',
    'pause.abandon': 'Завершить попытку',
    'how.title': 'Как играть',
    'how.body': 'Нажимайте мышью или касайтесь центрального огня, чтобы поднимать жар. Пламя постоянно остывает; Пепельный слуга и Хранительница угасания временно ускоряют охлаждение. Пройдите семь стадий, удерживайте Инферно и улучшайте рекорд. С момента достижения 3-й стадии можно добровольно посмотреть rewarded-рекламу и получить ×2 к силе жара на 60 активных секунд. Все стадии доступны без рекламы.',
    'common.back': 'Назад',
    'common.notNow': 'Не сейчас',
    'abandon.title': 'Завершить попытку?',
    'abandon.body': 'Текущий результат сохранится, а попытка будет отмечена как завершённая.',
    'abandon.confirm': 'Завершить',
    'reward.title': 'Сила жара ×2',
    'reward.body': 'Посмотреть короткую рекламу и получить ×2 к силе жара на 60 секунд активной игры? Таймер не идёт на паузе, во время рекламы или в фоне.',
    'reward.confirm': 'Посмотреть рекламу',
    'reward.success': 'Сила жара ×2 активна 60 секунд',
    'reward.closed': 'Видео закрыто — награда не выдана',
    'reward.unavailable': 'Видео сейчас недоступно. Можно продолжать без усиления.',
    'reward.error': 'Не удалось показать видео. Попробуйте позже.',
    'results.title': 'Пламя угасло',
    'results.abandoned': 'Попытка завершена.',
    'results.finished': 'Жар иссяк, но след огня сохранился.',
    'results.score': 'Счёт',
    'results.best': 'Рекорд',
    'results.stage': 'Стадия',
    'results.inferno': 'Инферно',
    'results.nextGoal': 'Ближайшая цель: {goal}',
    'results.allGoals': 'Все цели выполнены!',
    'results.leaderboard': 'Таблица лидеров',
    'results.restart': 'Ещё попытка',
    'leaderboard.title': 'Лучший счёт',
    'leaderboard.localBest': 'Личный рекорд',
    'leaderboard.empty': 'Пока нет результатов',
    'leaderboard.unavailable': 'Таблица сейчас недоступна — локальный рекорд сохранён',
    'goals.title': 'Цели',
    'goals.progress': '{current} / {target}',
    'goals.completed': 'Выполнено',
    'goals.stage3': 'Достичь стадии 3',
    'goals.stage5': 'Достичь стадии 5',
    'goals.stage7': 'Достичь стадии 7',
    'goals.runs3': 'Завершить 3 попытки',
    'goals.runs10': 'Завершить 10 попыток',
    'goals.inferno30': 'Удерживать Инферно 30 секунд',
    'goals.inferno60': 'Удерживать Инферно 60 секунд',
    'goals.score250000': 'Набрать 250 000 очков',
    'toast.saveError': 'Не удалось синхронизировать рекорд — игра продолжится',
    'toast.inferno': 'ИНФЕРНО — удерживайте пламя!',
  }),
  en: Object.freeze({
    'app.title': 'Ignite',
    'app.description': 'Keep the living flame alight, withstand disruptions, and improve your personal best.',
    'boot.loading': 'Kindling the flame…',
    'boot.assetError': 'Core images could not be loaded.',
    'boot.retry': 'Try again',
    'boot.fallback': 'Simplified background enabled',
    'fatal.title': 'The flame did not ignite',
    'fatal.body': 'Reload the page. Records saved on this device will remain.',
    'aria.game': 'Ignite game field. Click or tap the fire to keep the heat up.',
    'aria.hud': 'Ignite game interface',
    'aria.stageProgress': 'Current stage progress',
    'aria.settings': 'Settings and optional boost',
    'hud.heat': 'Heat {value}',
    'hud.score': 'Score {score} · Best {best} · ×{multiplier}',
    'hud.tap': 'TAP',
    'hud.pause': 'Pause',
    'hud.continue': 'Continue',
    'hud.soundOff': 'Mute',
    'hud.soundOn': 'Turn sound on',
    'hud.motionLess': 'Fewer effects',
    'hud.motionMore': 'More effects',
    'hud.rewardOffer': 'Watch an ad — ×2 heat power for 60 seconds',
    'hud.rewardCooldown': 'Next boost in {seconds}s',
    'hud.boost': 'Heat power ×2 · {seconds}s',
    'encounter.servantTelegraph': 'Ash Servant is preparing a breath',
    'encounter.wardenTelegraph': 'Ember Warden is gathering cold',
    'encounter.heatWindowTelegraph': 'Heat window incoming',
    'debuff.servant.source': 'Ash Servant',
    'debuff.servant.icon': 'A',
    'debuff.servant.effect': 'Ash Breath',
    'debuff.warden.source': 'Ember Warden',
    'debuff.warden.icon': 'W',
    'debuff.warden.effect': 'Cold Fade',
    'debuff.decay': 'Cooling ×{value}',
    'debuff.total': 'Total cooling ×{value}',
    'stage.1': 'Darkness',
    'stage.2': 'Spark',
    'stage.3': 'Ash Servant',
    'stage.4': 'Crimson Threshold',
    'stage.5': 'Ember Warden',
    'stage.6': 'Fire Ring',
    'stage.7': 'Inferno',
    'pause.title': 'Paused',
    'pause.body': 'Heat and all active timers are stopped.',
    'pause.howTo': 'How to play',
    'pause.goals': 'Goals',
    'pause.abandon': 'End run',
    'how.title': 'How to play',
    'how.body': 'Click or tap the central fire to raise its heat. The flame constantly cools; Ash Servant and Ember Warden temporarily speed up cooling. Clear seven stages, hold Inferno, and improve your best score. From stage 3, you may voluntarily watch a rewarded ad for ×2 heat power during 60 active seconds. Every stage is available without ads.',
    'common.back': 'Back',
    'common.notNow': 'Not now',
    'abandon.title': 'End this run?',
    'abandon.body': 'Your current result will be saved and the run will be marked as finished.',
    'abandon.confirm': 'End run',
    'reward.title': '×2 heat power',
    'reward.body': 'Watch a short ad and receive ×2 heat power for 60 seconds of active play? The timer stops while paused, during ads, and in the background.',
    'reward.confirm': 'Watch ad',
    'reward.success': '×2 heat power is active for 60 seconds',
    'reward.closed': 'Video closed — no reward granted',
    'reward.unavailable': 'Video is unavailable. You can keep playing without the boost.',
    'reward.error': 'The video could not be shown. Try again later.',
    'results.title': 'The flame faded',
    'results.abandoned': 'Run ended.',
    'results.finished': 'The heat ran out, but its trace remains.',
    'results.score': 'Score',
    'results.best': 'Best',
    'results.stage': 'Stage',
    'results.inferno': 'Inferno',
    'results.nextGoal': 'Next goal: {goal}',
    'results.allGoals': 'All goals complete!',
    'results.leaderboard': 'Leaderboard',
    'results.restart': 'Try again',
    'leaderboard.title': 'Best score',
    'leaderboard.localBest': 'Local best',
    'leaderboard.empty': 'No results yet',
    'leaderboard.unavailable': 'Leaderboard unavailable — your local best is saved',
    'goals.title': 'Goals',
    'goals.progress': '{current} / {target}',
    'goals.completed': 'Complete',
    'goals.stage3': 'Reach stage 3',
    'goals.stage5': 'Reach stage 5',
    'goals.stage7': 'Reach stage 7',
    'goals.runs3': 'Finish 3 runs',
    'goals.runs10': 'Finish 10 runs',
    'goals.inferno30': 'Hold Inferno for 30 seconds',
    'goals.inferno60': 'Hold Inferno for 60 seconds',
    'goals.score250000': 'Score 250,000 points',
    'toast.saveError': 'Record sync failed — play can continue',
    'toast.inferno': 'INFERNO — keep the flame alive!',
  }),
});

/** @param {unknown} value @returns {Locale} */
export function normalizeLocale(value) { return value === 'ru' ? 'ru' : 'en'; }

/** @param {Locale} locale @param {number} maximumFractionDigits */
function fallbackNumberFormat(locale, maximumFractionDigits) {
  return {
    /** @param {number} raw */
    format(raw) {
      const value = Number.isFinite(Number(raw)) ? Number(raw) : 0;
      const fixed = value.toFixed(maximumFractionDigits);
      const parts = fixed.split('.');
      const integer = parts[0].replace(/\B(?=(\d{3})+(?!\d))/gu, locale === 'ru' ? '\u00a0' : ',');
      const fraction = (parts[1] ?? '').replace(/0+$/u, '');
      return fraction ? `${integer}${locale === 'ru' ? ',' : '.'}${fraction}` : integer;
    },
  };
}

/** @param {Locale} locale @param {number} maximumFractionDigits */
function numberFormatter(locale, maximumFractionDigits) {
  try {
    if (typeof globalThis.Intl?.NumberFormat === 'function') {
      return new globalThis.Intl.NumberFormat(locale === 'ru' ? 'ru-RU' : 'en-US', { maximumFractionDigits });
    }
  } catch { /* old engines may expose a partial Intl implementation */ }
  return fallbackNumberFormat(locale, maximumFractionDigits);
}

/** @param {Locale} locale */
export function createI18n(locale) {
  const selected = normalizeLocale(locale);
  const number = numberFormatter(selected, 0);
  const decimal = numberFormatter(selected, 2);
  return Object.freeze({
    locale: selected,
    /** @param {string} key @param {Record<string,string|number>} [params] */
    t(key, params = {}) {
      const template = MESSAGES[selected][key] ?? MESSAGES.en[key] ?? key;
      return template.replace(/\{([a-zA-Z0-9]+)\}/gu, (_, name) => String(params[name] ?? `{${name}}`));
    },
    /** @param {number} value */
    number(value) { return number.format(Math.floor(value)); },
    /** @param {number} value */
    decimal(value) { return decimal.format(value); },
    /** @param {number} milliseconds */
    seconds(milliseconds) { return decimal.format(Math.max(0, milliseconds) / 1_000); },
  });
}

/** @typedef {ReturnType<typeof createI18n>} I18n */
