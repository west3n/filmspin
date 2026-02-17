const I18N = {
  en: {
    docTitle: 'FilmSpin — Terms of Service',
    back: 'Back to FilmSpin',
    filters: 'Filters',
    kicker: 'Legal',
    title_line_a: 'TERMS',
    title_line_b: 'OF SERVICE',
    subtitle: 'FilmSpin helps you discover a random movie. These terms explain how the service is provided and your responsibilities when using it.',
    updated: 'Last updated: February 15, 2026',
    h1: '1. Service & Availability',
    p1: 'FilmSpin is provided on an "as is" and "as available" basis. Availability, functionality, and performance may change at any time without prior notice.',
    h2: '2. Data Sources & Attribution',
    p2: 'Movie data is retrieved from third-party providers (including TMDb and OMDb). FilmSpin is not affiliated with these services. Titles, images, and metadata belong to their respective owners.',
    h3: '3. Accuracy & External Data',
    p3: 'Ratings and metadata can be incomplete, delayed, or inaccurate. Always verify critical details on source websites before relying on them.',
    h4: '4. Acceptable Use',
    p4: 'You agree not to abuse the service, including scraping at scale, overloading endpoints, bypassing limits, or attempting reverse engineering.',
    h5: '5. Privacy',
    p5: 'FilmSpin does not require user accounts. Minimal operational logs may be processed for reliability and security. Third-party APIs are governed by their own privacy policies.',
    h6: '6. Third-Party Links',
    p6: 'Links to external websites are provided for convenience. FilmSpin is not responsible for external content, uptime, or policy changes.',
    h7: '7. Limitation of Liability',
    p7: 'To the maximum extent permitted by law, FilmSpin and its creator are not liable for damages or losses resulting from the use of this service.',
    h8: '8. Terms Updates',
    p8: 'These terms may be updated. Continued use after changes means you accept the current version.',
    h9: '9. Contact',
    p9: 'Questions or suggestions? Contact: <a href="https://t.me/miroshnikov" target="_blank" rel="noopener">t.me/miroshnikov</a>'
  },
  ru: {
    docTitle: 'FilmSpin — Условия использования',
    back: 'Назад к FilmSpin',
    filters: 'Фильтры',
    kicker: 'Юридическая информация',
    title_line_a: 'УСЛОВИЯ',
    title_line_b: 'ИСПОЛЬЗОВАНИЯ',
    subtitle: 'FilmSpin помогает находить случайные фильмы. Эти условия описывают, как предоставляется сервис и какие правила действуют при использовании.',
    updated: 'Последнее обновление: 15 февраля 2026',
    h1: '1. Сервис и доступность',
    p1: 'FilmSpin предоставляется «как есть» и «по мере доступности». Доступность, функциональность и производительность могут изменяться без предварительного уведомления.',
    h2: '2. Источники данных и атрибуция',
    p2: 'Данные о фильмах получаются из сторонних провайдеров (включая TMDb и OMDb). FilmSpin не аффилирован с этими сервисами. Названия, постеры и метаданные принадлежат соответствующим правообладателям.',
    h3: '3. Точность и внешние данные',
    p3: 'Рейтинги и метаданные могут быть неполными, устаревшими или неточными. Проверяйте важные детали на сайтах первоисточников.',
    h4: '4. Допустимое использование',
    p4: 'Запрещено злоупотреблять сервисом, включая массовый скрейпинг, перегрузку API, обход ограничений или попытки реверс-инжиниринга.',
    h5: '5. Конфиденциальность',
    p5: 'FilmSpin не требует аккаунтов. Для надежности и безопасности могут обрабатываться минимальные технические логи. Сторонние API регулируются их собственными политиками конфиденциальности.',
    h6: '6. Сторонние ссылки',
    p6: 'Ссылки на внешние сайты даны для удобства. FilmSpin не отвечает за их содержимое, доступность и изменения политик.',
    h7: '7. Ограничение ответственности',
    p7: 'В пределах, разрешенных законом, FilmSpin и автор не несут ответственности за убытки или ущерб, возникшие в результате использования сервиса.',
    h8: '8. Обновления условий',
    p8: 'Условия могут обновляться. Продолжение использования после изменений означает согласие с актуальной версией.',
    h9: '9. Контакты',
    p9: 'Вопросы или предложения: <a href="https://t.me/miroshnikov" target="_blank" rel="noopener">t.me/miroshnikov</a>'
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
