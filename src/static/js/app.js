import { I18N, langMap } from './modules/i18n.js?v=29';
import { getJson } from './modules/http.js?v=22';
import {
  FILTERS_STORAGE_KEY,
  YEAR_MIN,
  YEAR_MAX,
  RU_ALLOWED_GENRES,
  countriesList,
} from './modules/app/constants.js?v=1';
import { clamp, toYear, valueToColor } from './modules/app/helpers.js?v=1';
import { createStatusController } from './modules/app/status.js?v=1';
import { createSpinButtonController } from './modules/app/spin_button.js?v=1';
import { createFiltersController } from './modules/app/filters.js?v=3';
import { createCardController } from './modules/app/card.js?v=1';

const ratingMin = document.getElementById('ratingMin');
const ratingVal = document.getElementById('ratingVal');
const yrMin = document.getElementById('yrMin');
const yrMax = document.getElementById('yrMax');
const yrFill = document.getElementById('yrFill');
const yrTrack = document.getElementById('yrTrack');
const yrMinBadge = document.getElementById('yrMinBadge');
const yrMaxBadge = document.getElementById('yrMaxBadge');

const spinBtn = document.getElementById('spin');
const retryBtn = document.getElementById('retrySpin');
const statusEl = document.getElementById('requestStatus');
const sloganEl = document.getElementById('slogan');
const discoveryMeterEl = document.getElementById('discoveryMeter');
const resultEl = document.getElementById('result');
const resultSkeletonEl = document.getElementById('resultSkeleton');

const langSelect = document.getElementById('langSwitch');
const filtersHeader = document.getElementById('filtersHeader');
const filtersToggle = document.getElementById('filtersToggle');
const filtersBody = document.getElementById('filtersBody');
const filtersResetBtn = document.getElementById('filtersReset');
const presetPopularBtn = document.getElementById('presetPopular');
const presetTopBtn = document.getElementById('presetTop');
const presetRecentBtn = document.getElementById('presetRecent');
const advancedToggle = document.getElementById('advancedToggle');
const advancedBody = document.getElementById('advancedBody');
const autoApplyToggle = document.getElementById('autoApplyToggle');
const applyFiltersBtn = document.getElementById('applyFilters');
const filtersPendingEl = document.getElementById('filtersPending');
const relaxFiltersBtn = document.getElementById('relaxFilters');

const publicConfig = { ru_enabled: true };

function isRuEnabled() {
  return publicConfig.ru_enabled !== false;
}

function getLang() {
  const preferred = localStorage.getItem('fs_lang') || (navigator.language.startsWith('ru') ? 'ru' : 'en');
  if (preferred === 'ru' && !isRuEnabled()) return 'en';
  return preferred;
}

function setLang(v) {
  localStorage.setItem('fs_lang', v);
}

function t(key) {
  const lang = getLang();
  return (I18N[lang] && I18N[lang][key]) || I18N.en[key] || key;
}

const statusController = createStatusController({ sloganEl, statusEl, t });
const spinButtonController = createSpinButtonController({ spinBtn, t });
const filtersController = createFiltersController({
  elements: {
    ratingMin,
    ratingVal,
    yrMin,
    yrMax,
    yrFill,
    yrTrack,
    yrMinBadge,
    yrMaxBadge,
    filtersHeader,
    filtersBody,
    filtersToggle,
    presetPopularBtn,
    presetTopBtn,
    presetRecentBtn,
    advancedBody,
    advancedToggle,
    autoApplyToggle,
    applyFiltersBtn,
    filtersPendingEl,
    filtersPreviewEl: discoveryMeterEl,
    relaxFiltersBtn,
  },
  constants: {
    YEAR_MIN,
    YEAR_MAX,
    FILTERS_STORAGE_KEY,
    RU_ALLOWED_GENRES,
    countriesList,
  },
  deps: {
    getLang,
    langMap,
    t,
    getJson,
    showStatus: statusController.showStatus,
    clamp,
    toYear,
    valueToColor,
  },
});
const cardController = createCardController({
  elements: { resultEl },
  deps: { getLang, t, getJson, langMap },
});

filtersController.initDefaults();

function showSkeleton(show) {
  if (!resultSkeletonEl) return;
  resultSkeletonEl.classList.toggle('hidden', !show);
}

function normalizeErrorMessage(message) {
  if (!message) return t('status_error_generic');
  if (message.includes('Upstream movie service')) return t('status_upstream');
  return message;
}

async function spin() {
  cardController.hideResultCard();
  cardController.clearCurrentMovie();
  spinButtonController.setSpinLoading(true);
  retryBtn.classList.add('hidden');
  statusController.showStatus('info', t('status_loading'));
  showSkeleton(true);

  try {
    const params = new URLSearchParams();
    const { from, to } = filtersController.getYearRange();
    params.set('year_from', String(from));
    params.set('year_to', String(to));

    const genres = filtersController.selectedGenresQuery();
    const countries = filtersController.selectedCountriesQuery();

    if (genres) params.set('genres', genres);
    if (countries) params.set('country', countries);
    params.set('vote_avg_min', ratingMin.value);

    const isRU = getLang() === 'ru';
    const url = isRU
      ? `/api/random_ru?${params.toString()}`
      : `/api/random?${params.toString()}&lang=${encodeURIComponent(langMap[getLang()])}`;

    const { ok, data } = await getJson(url);
    if (!ok || data?.error) {
      const message = normalizeErrorMessage(data?.error || t('status_error_generic'));
      statusController.showStatus('error', message, { autoclear: true });
      retryBtn.classList.remove('hidden');
      return false;
    }

    cardController.setCurrentMovieFromData(data);
    cardController.renderCard(data);
    statusController.showStatus('success', t('status_ready'), { autoclear: true });
    filtersController.markApplied();
    return true;
  } catch (error) {
    console.error(error);
    statusController.showStatus('error', t('status_error_generic'), { autoclear: true });
    retryBtn.classList.remove('hidden');
    return false;
  } finally {
    spinButtonController.setSpinLoading(false);
    showSkeleton(false);
    filtersController.saveFilters();
  }
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
}

function applyStaticTranslations() {
  statusController.setSloganIdle({ animate: false });
  document.getElementById('filtersTitle').textContent = t('filters');
  document.getElementById('yearRangeLabel').textContent = t('year_range');
  document.getElementById('countriesLabel').textContent = t('countries');
  document.getElementById('genresLabel').textContent = t('genres');
  document.getElementById('directorLabel').textContent = `${t('people_director')}:`;
  document.getElementById('castLabel').textContent = `${t('people_cast')}:`;
  document.getElementById('minRatingLabel').textContent = t('min_rating');
  document.getElementById('countriesHint').textContent = t('multi_select_hint');
  document.getElementById('genresHint').textContent = t('multi_select_hint');

  filtersResetBtn.textContent = t('filters_reset');
  presetPopularBtn.textContent = t('preset_popular');
  presetTopBtn.textContent = t('preset_top');
  presetRecentBtn.textContent = t('preset_recent');
  retryBtn.textContent = t('retry');
  spinButtonController.syncSpinLabel();
  filtersController.applyTranslations();

  const footerData = document.getElementById('footerData');
  if (footerData) footerData.innerHTML = t('data_source');

  const footerBy = document.getElementById('footerBy');
  if (footerBy) {
    footerBy.innerHTML = `${t('by')} <a href="https://t.me/miroshnikov" class="underline hover:no-underline">Sergey Miroshnikov</a>`;
  }

  const footerTerms = document.getElementById('footerTerms');
  if (footerTerms) footerTerms.textContent = t('terms');
}

async function loadPublicConfig() {
  try {
    const { ok, data } = await getJson('/api/config', { cache: 'no-store' });
    if (!ok) return;
    if (typeof data?.ru_enabled === 'boolean') publicConfig.ru_enabled = data.ru_enabled;
  } catch (_) {}
}

function attachEventHandlers() {
  spinBtn.addEventListener('click', spin);
  retryBtn.addEventListener('click', spin);

  yrMin.addEventListener('input', filtersController.handleYearMinInput);
  yrMax.addEventListener('input', filtersController.handleYearMaxInput);
  ratingMin.addEventListener('input', filtersController.handleRatingInput);

  window.addEventListener('resize', filtersController.syncYearRange);

  const toggleFilters = () => {
    const expanded = filtersToggle.getAttribute('aria-expanded') === 'true';
    if (expanded) filtersController.closeFilters();
    else filtersController.openFilters();
  };

  filtersHeader.addEventListener('click', toggleFilters);
  filtersHeader.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    toggleFilters();
  });

  advancedToggle.addEventListener('click', () => {
    filtersController.toggleAdvanced();
  });

  filtersResetBtn.addEventListener('click', async () => {
    await filtersController.resetFilters();
    statusController.hideStatus();
  });

  presetPopularBtn.addEventListener('click', () => filtersController.applyPreset('popular'));
  presetTopBtn.addEventListener('click', () => filtersController.applyPreset('top'));
  presetRecentBtn.addEventListener('click', () => filtersController.applyPreset('recent'));
  autoApplyToggle.addEventListener('click', () => filtersController.toggleAutoApply());
  applyFiltersBtn.addEventListener('click', () => { void filtersController.applyNow(); });
  relaxFiltersBtn.addEventListener('click', () => filtersController.relaxFilters());

  langSelect.addEventListener('change', async () => {
    if (langSelect.value === 'ru' && !isRuEnabled()) {
      langSelect.value = 'en';
      return;
    }

    setLang(langSelect.value);
    applyStaticTranslations();

    filtersController.clearSelections();
    filtersController.loadCountries();
    await filtersController.loadGenres();
    await cardController.reloadCurrentInNewLang();
    filtersController.refreshAfterLanguageChange();
    filtersController.saveFilters();
  });

  const ro = new ResizeObserver(() => {
    if (filtersBody.classList.contains('is-open')) {
      filtersBody.style.maxHeight = `${filtersBody.scrollHeight}px`;
    }
    if (advancedBody.classList.contains('is-open')) {
      advancedBody.style.maxHeight = `${advancedBody.scrollHeight}px`;
    }
  });
  ro.observe(filtersBody);
  ro.observe(advancedBody);

  filtersController.setApplyHandler(async () => spin());
}

async function initApp() {
  await loadPublicConfig();
  applyLanguageAvailability();
  if (statusEl) statusEl.classList.add('hidden');

  langSelect.value = getLang();

  filtersController.restoreFilters();
  applyStaticTranslations();

  filtersController.syncYearRange();
  filtersController.updateRatingThumb();
  filtersController.loadCountries();

  if (filtersController.isSavedFiltersOpen()) filtersController.openFilters();
  else filtersController.closeFilters();

  if (filtersController.isSavedAdvancedOpen()) filtersController.openAdvanced();
  else filtersController.closeAdvanced();

  await filtersController.loadGenres();
  filtersController.finalizeInitState();
  attachEventHandlers();
}

initApp();
