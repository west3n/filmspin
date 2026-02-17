const I18N = {
  en: {
    docTitle: 'FilmSpin — Privacy Policy',
    back: 'Back to FilmSpin',
    filters: 'Filters',
    kicker: 'Legal',
    title_line_a: 'PRIVACY',
    title_line_b: 'POLICY',
    subtitle: 'This policy explains what data FilmSpin processes, why it is needed, and what control you have over that data.',
    updated: 'Last updated: February 17, 2026',
    h1: '1. Scope',
    p1: 'FilmSpin is a no-account service for random movie discovery. This policy applies to the website and its API endpoints.',
    h2: '2. Data We Process',
    p2: 'We do not collect account profiles or payment data. We may process technical data such as request timestamps, path, HTTP status, user language, and anonymized operational logs.',
    h3: '3. Why We Process It',
    p3: 'Technical data is used for service stability, debugging, abuse prevention, and performance monitoring.',
    h4: '4. Local Storage',
    p4: 'FilmSpin uses browser local storage for interface preferences (for example selected language and filter state). This data stays on your device unless you clear it.',
    h5: '5. Third-Party Data Providers',
    p5: 'Movie metadata and ratings are retrieved from third-party providers. Their services process requests under their own privacy policies. FilmSpin does not sell your personal data.',
    h6: '6. Retention',
    p6: 'Operational logs are kept only for as long as needed to maintain reliability and security. Cached movie data is technical and not tied to personal user accounts.',
    h7: '7. Your Choices',
    p7: 'You can stop using the service at any time, clear your browser storage, and block requests to third-party services through browser tools or network settings.',
    h8: '8. Policy Updates',
    p8: 'This policy may be updated to reflect product, legal, or infrastructure changes. The date at the top shows the latest revision.',
    h9: '9. Contact',
    p9: 'Questions about privacy: <a href="https://t.me/miroshnikov" target="_blank" rel="noopener">t.me/miroshnikov</a>'
  },
  ru: {
    docTitle: 'FilmSpin — Политика конфиденциальности',
    back: 'Назад к FilmSpin',
    filters: 'Фильтры',
    kicker: 'Юридическая информация',
    title_line_a: 'ПОЛИТИКА',
    title_line_b: 'КОНФИДЕНЦИАЛЬНОСТИ',
    subtitle: 'В этой политике описано, какие данные обрабатывает FilmSpin, зачем это нужно и какие у вас есть способы контроля.',
    updated: 'Последнее обновление: 17 февраля 2026',
    h1: '1. Область действия',
    p1: 'FilmSpin - сервис подбора случайных фильмов без учетных записей. Политика применяется к сайту и его API.',
    h2: '2. Какие данные обрабатываются',
    p2: 'Мы не собираем профили аккаунтов и платежные данные. Могут обрабатываться технические данные: время запроса, путь, HTTP-статус, язык интерфейса и обезличенные операционные логи.',
    h3: '3. Зачем это нужно',
    p3: 'Технические данные используются для стабильности сервиса, отладки, защиты от злоупотреблений и мониторинга производительности.',
    h4: '4. Локальное хранилище',
    p4: 'FilmSpin использует local storage браузера для интерфейсных настроек (например язык и состояние фильтров). Эти данные остаются на вашем устройстве, пока вы их не очистите.',
    h5: '5. Сторонние провайдеры данных',
    p5: 'Метаданные фильмов и рейтинги загружаются из сторонних сервисов. Они обрабатывают запросы по своим политикам конфиденциальности. FilmSpin не продает персональные данные.',
    h6: '6. Срок хранения',
    p6: 'Операционные логи хранятся только столько, сколько нужно для надежности и безопасности. Кэш фильмов носит технический характер и не привязан к персональным аккаунтам.',
    h7: '7. Ваш выбор',
    p7: 'Вы можете в любой момент прекратить использование сервиса, очистить данные браузера и ограничить внешние запросы через настройки браузера или сети.',
    h8: '8. Обновления политики',
    p8: 'Политика может обновляться из-за изменений продукта, законодательства или инфраструктуры. Актуальная дата обновления указана вверху страницы.',
    h9: '9. Контакты',
    p9: 'Вопросы по приватности: <a href="https://t.me/miroshnikov" target="_blank" rel="noopener">t.me/miroshnikov</a>'
  }
};

const langSelect = document.getElementById('langSwitch');
const langPicker = window.initLangPicker ? window.initLangPicker(langSelect) : null;
const headerControlSpacer = document.querySelector('.header-control-spacer');
const publicConfig = { ru_enabled: true };
const homeLogoLink = document.querySelector('.site-global-logo[href="/"]');
let isHomeNavigationInFlight = false;

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
})();
