import { I18N, langMap } from './modules/i18n.js?v=30';
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
import { createFiltersController } from './modules/app/filters.js?v=4';
import { createCardController } from './modules/app/card.js?v=2';

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
const moodLabelEl = document.getElementById('moodLabel');
const moodEasyBtn = document.getElementById('moodEasy');
const moodTenseBtn = document.getElementById('moodTense');
const moodWarmBtn = document.getElementById('moodWarm');
const moodMindbenderBtn = document.getElementById('moodMindbender');
const advancedToggle = document.getElementById('advancedToggle');
const advancedBody = document.getElementById('advancedBody');
const autoApplyToggle = document.getElementById('autoApplyToggle');
const applyFiltersBtn = document.getElementById('applyFilters');
const filtersPendingEl = document.getElementById('filtersPending');
const relaxFiltersBtn = document.getElementById('relaxFilters');
const runtimeLabelEl = document.getElementById('runtimeLabel');
const runtimeAnyBtn = document.getElementById('runtimeAny');
const runtimeShortBtn = document.getElementById('runtimeShort');
const runtimeStandardBtn = document.getElementById('runtimeStandard');
const runtimeLongBtn = document.getElementById('runtimeLong');

const publicConfig = { ru_enabled: true };
const EXCLUDED_TMDB_KEY = 'fs_excluded_tmdb_v1';
const EXCLUDED_KP_KEY = 'fs_excluded_kp_v1';

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

function readIdSet(storageKey) {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(
      parsed
        .map((value) => Number.parseInt(String(value), 10))
        .filter((value) => Number.isFinite(value)),
    );
  } catch (_) {
    return new Set();
  }
}

function writeIdSet(storageKey, setValue) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(Array.from(setValue).slice(-500)));
  } catch (_) {}
}

const excludedTmdbIds = readIdSet(EXCLUDED_TMDB_KEY);
const excludedKpIds = readIdSet(EXCLUDED_KP_KEY);

function getExclusionsPayload() {
  return {
    tmdb: Array.from(excludedTmdbIds).slice(-150),
    kp: Array.from(excludedKpIds).slice(-150),
  };
}

function markMovieExcluded(moviePayload, { watched = false } = {}) {
  const tmdbId = Number.parseInt(String(moviePayload?.tmdb_id ?? ''), 10);
  const kpId = Number.parseInt(String(moviePayload?.kp_id ?? ''), 10);
  if (Number.isFinite(tmdbId)) excludedTmdbIds.add(tmdbId);
  if (Number.isFinite(kpId)) excludedKpIds.add(kpId);
  writeIdSet(EXCLUDED_TMDB_KEY, excludedTmdbIds);
  writeIdSet(EXCLUDED_KP_KEY, excludedKpIds);
  statusController.showStatus(
    'success',
    watched ? t('status_marked_watched') : t('status_hidden_movie'),
    { autoclear: true },
  );
  void filtersController.requestPreview();
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
    moodEasyBtn,
    moodTenseBtn,
    moodWarmBtn,
    moodMindbenderBtn,
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
    getExclusionsPayload,
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

cardController.setActionHandlers({
  watched: (payload) => {
    markMovieExcluded(payload, { watched: true });
  },
  hide: (payload) => {
    markMovieExcluded(payload, { watched: false });
  },
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
    const runtime = filtersController.getRuntimeRange();
    if (runtime.min != null) params.set('runtime_min', String(runtime.min));
    if (runtime.max != null) params.set('runtime_max', String(runtime.max));

    const genres = filtersController.selectedGenresQuery();
    const countries = filtersController.selectedCountriesQuery();

    if (genres) params.set('genres', genres);
    if (countries) params.set('country', countries);
    params.set('vote_avg_min', ratingMin.value);
    const exclusions = getExclusionsPayload();
    if (exclusions.tmdb.length) params.set('exclude_tmdb', exclusions.tmdb.join('|'));
    if (exclusions.kp.length) params.set('exclude_kp', exclusions.kp.join('|'));

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
  moodLabelEl.textContent = t('mood_label');
  moodEasyBtn.textContent = t('mood_easy');
  moodTenseBtn.textContent = t('mood_tense');
  moodWarmBtn.textContent = t('mood_warm');
  moodMindbenderBtn.textContent = t('mood_mindbender');
  runtimeLabelEl.textContent = t('runtime_label');
  runtimeAnyBtn.textContent = t('runtime_any');
  runtimeShortBtn.textContent = t('runtime_short');
  runtimeStandardBtn.textContent = t('runtime_standard');
  runtimeLongBtn.textContent = t('runtime_long');
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
  moodEasyBtn.addEventListener('click', () => filtersController.applyMood('easy'));
  moodTenseBtn.addEventListener('click', () => filtersController.applyMood('tense'));
  moodWarmBtn.addEventListener('click', () => filtersController.applyMood('warm'));
  moodMindbenderBtn.addEventListener('click', () => filtersController.applyMood('mindbender'));
  [runtimeAnyBtn, runtimeShortBtn, runtimeStandardBtn, runtimeLongBtn].forEach((btn) => {
    btn.addEventListener('click', () => {
      const min = btn.dataset.min === '' ? null : Number.parseInt(btn.dataset.min, 10);
      const max = btn.dataset.max === '' ? null : Number.parseInt(btn.dataset.max, 10);
      filtersController.handleRuntimePreset(min, max);
    });
  });
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
