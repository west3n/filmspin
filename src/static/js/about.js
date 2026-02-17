const I18N = {
  en: {
    docTitle: 'FilmSpin — About',
    back: 'Back to FilmSpin',
    filters: 'Filters',
    kicker: 'About',
    title_line_a: 'ABOUT',
    title_line_b: 'FILMSPIN',
    subtitle: 'FilmSpin started as a tiny one-button side project to solve one daily problem: spending more time choosing a movie than watching it.',
    updated: 'Last updated: February 17, 2026',
    h1: '1. Mission',
    p1: 'Help you decide faster. One clear suggestion, strong filters, and no endless scrolling.',
    h2: '2. How It Works',
    p2: 'FilmSpin combines TMDb metadata, IMDb signals, and lightweight ranking logic to return one solid pick instead of a noisy list.',
    h3: '3. Product Principles',
    p3: 'Speed over clutter, control over randomness, and useful details over decorative noise.',
    h4: '4. Why Endurance',
    p4: 'The Endurance icon is a reminder that discovery can feel like navigation: precise inputs, one trajectory, meaningful destination.',
    h5: '5. Built With',
    p5: 'FastAPI on the backend, vanilla JS on the frontend, and a strong focus on reliability, cache discipline, and clear UI states.',
    h6: '6. What We Optimize',
    p6: 'Response time, recommendation freshness, and confidence that every click visibly does exactly what you expect.',
    h7: '7. What Is Next',
    p7: 'Smarter mood presets, richer watch-provider coverage, and better “why this movie” explanations.',
    h8: '8. Open Project',
    p8: 'FilmSpin evolves through real usage and feedback. If something feels off, it is a candidate for improvement.',
    h9: '9. Contact',
    p9: 'Ideas, bugs, and feature requests: <a href="https://t.me/miroshnikov" target="_blank" rel="noopener">t.me/miroshnikov</a>',
  },
  ru: {
    docTitle: 'FilmSpin — О проекте',
    back: 'Назад к FilmSpin',
    filters: 'Фильтры',
    kicker: 'О проекте',
    title_line_a: 'О ПРОЕКТЕ',
    title_line_b: 'FILMSPIN',
    subtitle: 'FilmSpin начался как маленький сайд-проект с одной кнопкой, чтобы решить ежедневную проблему: тратить меньше времени на выбор фильма и больше на просмотр.',
    updated: 'Последнее обновление: 17 февраля 2026',
    h1: '1. Миссия',
    p1: 'Помогать выбирать быстрее: один точный вариант, сильные фильтры и никакого бесконечного скролла.',
    h2: '2. Как это работает',
    p2: 'FilmSpin объединяет метаданные TMDb, сигналы IMDb и легкую логику ранжирования, чтобы выдавать один уверенный выбор вместо шумного списка.',
    h3: '3. Принципы продукта',
    p3: 'Скорость важнее перегруза, контроль важнее хаоса, полезные детали важнее декоративного шума.',
    h4: '4. Почему Endurance',
    p4: 'Иконка Endurance напоминает, что поиск фильма похож на навигацию: точные параметры, одна траектория, понятная точка назначения.',
    h5: '5. Технологии',
    p5: 'FastAPI на бэкенде, vanilla JS на фронтенде и фокус на надежности, дисциплине кэша и ясных состояниях интерфейса.',
    h6: '6. Что мы оптимизируем',
    p6: 'Время ответа, актуальность рекомендаций и уверенность, что каждый клик делает именно то, что вы ожидаете.',
    h7: '7. Что дальше',
    p7: 'Более умные mood-профили, расширенное покрытие провайдеров и лучшие объяснения “почему именно этот фильм”.',
    h8: '8. Открытый проект',
    p8: 'FilmSpin развивается через реальное использование и обратную связь. Если что-то ощущается не так, это кандидат на улучшение.',
    h9: '9. Контакт',
    p9: 'Идеи, баги и предложения: <a href="https://t.me/miroshnikov" target="_blank" rel="noopener">t.me/miroshnikov</a>',
  }
};

const langSelect = document.getElementById('langSwitch');
const langPicker = window.initLangPicker ? window.initLangPicker(langSelect) : null;
const headerControlSpacer = document.querySelector('.header-control-spacer');
const homeLogoLink = document.querySelector('.site-global-logo[href="/"]');
const easterRailEl = document.getElementById('aboutEasterRail');
const orbitEl = document.getElementById('aboutOrbit');
const poemLineEl = document.getElementById('aboutPoemLine');

const EASTER_CODE = 'endurance';
const POEM_LINES = [
  'Do not go gentle into that good night,',
  'Old age should burn and rave at close of day;',
  'Rage, rage against the dying of the light.',
  'Though wise men at their end know dark is right,',
  'Because their words had forked no lightning they',
  'Do not go gentle into that good night.',
  'Good men, the last wave by, crying how bright',
  'Their frail deeds might have danced in a green bay,',
  'Rage, rage against the dying of the light.',
];

const publicConfig = { ru_enabled: true };
let isHomeNavigationInFlight = false;
let easterProgress = 0;
let poemLineIndex = 0;
let poemTimerId = null;
let poemSwapTimerId = null;

function getLang() {
  const preferred = localStorage.getItem('fs_lang') || (navigator.language.startsWith('ru') ? 'ru' : 'en');
  if (preferred === 'ru' && !isRuEnabled()) return 'en';
  return preferred;
}

function setLang(value) {
  localStorage.setItem('fs_lang', value);
}

function t(key) {
  const lang = getLang();
  return (I18N[lang] && I18N[lang][key]) || (I18N.en[key] || key);
}

function isRuEnabled() {
  return publicConfig.ru_enabled !== false;
}

function applyLanguageAvailability() {
  const ruOption = langSelect.querySelector('option[value="ru"]');
  if (ruOption) {
    const allowed = isRuEnabled();
    ruOption.disabled = !allowed;
    ruOption.hidden = !allowed;
  }
  if (!isRuEnabled() && localStorage.getItem('fs_lang') === 'ru') {
    setLang('en');
  }
  if (langPicker) langPicker.refresh();
}

async function loadPublicConfig() {
  try {
    const response = await fetch('/api/config', { cache: 'no-store' });
    if (!response.ok) return;
    const data = await response.json();
    if (typeof data?.ru_enabled === 'boolean') publicConfig.ru_enabled = data.ru_enabled;
  } catch (_) {}
}

function clearPoemTimers() {
  if (poemTimerId) {
    window.clearInterval(poemTimerId);
    poemTimerId = null;
  }
  if (poemSwapTimerId) {
    window.clearTimeout(poemSwapTimerId);
    poemSwapTimerId = null;
  }
}

function renderPoemLine({ animate = false } = {}) {
  if (!poemLineEl) return;
  const line = POEM_LINES[poemLineIndex % POEM_LINES.length];
  poemLineEl.classList.add('is-visible');
  if (!animate || !poemLineEl.textContent) {
    poemLineEl.textContent = line;
    poemLineEl.classList.remove('is-swap-out');
    poemLineEl.classList.remove('is-swap-in');
    return;
  }

  poemLineEl.classList.remove('is-swap-in');
  poemLineEl.classList.add('is-swap-out');
  if (poemSwapTimerId) window.clearTimeout(poemSwapTimerId);
  poemSwapTimerId = window.setTimeout(() => {
    poemLineEl.textContent = line;
    poemLineEl.classList.remove('is-swap-out');
    poemLineEl.classList.add('is-swap-in');
  }, 170);
}

function startPoemCycle() {
  clearPoemTimers();
  poemLineIndex = 0;
  renderPoemLine({ animate: false });
  poemTimerId = window.setInterval(() => {
    poemLineIndex = (poemLineIndex + 1) % POEM_LINES.length;
    renderPoemLine({ animate: true });
  }, 4200);
}

function activateEaster() {
  if (!easterRailEl || !orbitEl || !poemLineEl) return;
  document.body.classList.add('about-easter-on');
  easterRailEl.classList.add('is-visible');
  easterRailEl.setAttribute('aria-hidden', 'false');
  orbitEl.classList.add('is-visible');
  startPoemCycle();
}

function handleEasterInput(event) {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  const target = event.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;
  const key = String(event.key || '').toLowerCase();
  if (!key || key.length !== 1) return;

  if (key === EASTER_CODE[easterProgress]) {
    easterProgress += 1;
    if (easterProgress === EASTER_CODE.length) {
      easterProgress = 0;
      activateEaster();
    }
    return;
  }
  easterProgress = key === EASTER_CODE[0] ? 1 : 0;
}

function applyTranslations() {
  const lang = getLang();
  document.documentElement.setAttribute('lang', lang);
  document.getElementById('docTitle').textContent = t('docTitle');
  if (headerControlSpacer) headerControlSpacer.textContent = t('filters');
  document.querySelectorAll('[data-i18n]').forEach((node) => {
    const key = node.getAttribute('data-i18n');
    node.innerHTML = t(key);
  });
  langSelect.value = lang;
  if (langPicker) langPicker.sync();
}

function clearLegalEnterClass() {
  if (!document.documentElement.classList.contains('legal-nav-enter')) return;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.setTimeout(() => {
    document.documentElement.classList.remove('legal-nav-enter');
  }, reduceMotion ? 0 : 1650);
}

function isModifiedNavigation(event) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
}

function navigateHomeWithAnimation(event) {
  const target = event.currentTarget;
  if (!(target instanceof HTMLAnchorElement)) return;
  if (event.defaultPrevented || isModifiedNavigation(event) || isHomeNavigationInFlight) return;

  event.preventDefault();
  const href = target.getAttribute('href') || '/';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) {
    window.location.href = href;
    return;
  }

  isHomeNavigationInFlight = true;
  document.documentElement.classList.remove('legal-nav-enter');
  document.body.classList.add('is-leaving-home');
  document.documentElement.classList.add('is-leaving-home');
  window.setTimeout(() => {
    window.location.href = href;
  }, 620);
}

(async function init() {
  await loadPublicConfig();
  applyLanguageAvailability();
  langSelect.value = getLang();
  applyTranslations();
  clearLegalEnterClass();
  langSelect.addEventListener('change', () => {
    if (langSelect.value === 'ru' && !isRuEnabled()) {
      langSelect.value = 'en';
      return;
    }
    setLang(langSelect.value);
    applyTranslations();
  });
  if (homeLogoLink) homeLogoLink.addEventListener('click', navigateHomeWithAnimation);
  document.addEventListener('keydown', handleEasterInput);
  window.addEventListener('pagehide', clearPoemTimers);
})();
