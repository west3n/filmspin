import { I18N, langMap } from './modules/i18n.js?v=39';
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
import { createSpinButtonController } from './modules/app/spin_button.js?v=8';
import { createFiltersController } from './modules/app/filters.js?v=7';
import { createCardController } from './modules/app/card.js?v=9';

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
const resultSpinBtn = document.getElementById('resultSpin');
const statusEl = document.getElementById('requestStatus');
const sloganEl = document.getElementById('slogan');
const discoveryMeterEl = document.getElementById('discoveryMeter');
const resultEl = document.getElementById('result');
const resultSkeletonEl = document.getElementById('resultSkeleton');
const resultStageEl = document.querySelector('.home-result-stage');
const resultSpinTextEl = document.getElementById('resultSpinText');
const searchLoaderTextEl = document.getElementById('searchLoaderText');
const searchLoaderSubtextEl = document.getElementById('searchLoaderSubtext');

const langSelect = document.getElementById('langSwitch');
const langPicker = window.initLangPicker ? window.initLangPicker(langSelect) : null;
const siteTitleEl = document.getElementById('siteTitle');
const heroFiltersBtn = document.getElementById('heroFiltersBtn');
const filtersSection = document.getElementById('filters');
const homeShellEl = document.querySelector('.home-shell');
const globalHeaderEl = document.querySelector('.site-global-header');
const globalHeaderLogoEl = document.querySelector('.site-global-logo');
const globalHeaderControlsEl = document.querySelector('.site-global-controls');
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
const footerTermsLink = document.getElementById('footerTerms');
const footerPrivacyLink = document.getElementById('footerPrivacy');
const footerAboutLink = document.getElementById('footerAbout');

const publicConfig = { ru_enabled: true };
let isLegalNavigationInFlight = false;
const LEGAL_TRANSITION_KEY = 'fs_legal_enter';

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

function mergeSiteTitle() {
  if (!siteTitleEl) return;
  siteTitleEl.classList.add('is-merged');
  syncHomeTitleMetrics();
  requestAnimationFrame(syncHomeTitleMetrics);
}

function syncHomeTitleMetrics() {
  if (!siteTitleEl || !homeShellEl) return;
  const titleWords = siteTitleEl.querySelectorAll('.site-title-word');
  let top = Number.POSITIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  titleWords.forEach((node) => {
    const rect = node.getBoundingClientRect();
    if (rect.height <= 0) return;
    top = Math.min(top, rect.top);
    bottom = Math.max(bottom, rect.bottom);
  });
  const fallbackHeight = siteTitleEl.getBoundingClientRect().height;
  const measuredHeight = Number.isFinite(top) && Number.isFinite(bottom) && bottom > top
    ? (bottom - top)
    : fallbackHeight;
  const computedStyle = window.getComputedStyle(siteTitleEl);
  const fontSize = Number.parseFloat(computedStyle.fontSize) || 0;
  const fontFamily = computedStyle.fontFamily || 'sans-serif';
  const fontWeight = computedStyle.fontWeight || '600';
  const fontStyle = computedStyle.fontStyle || 'normal';
  const fontVariant = computedStyle.fontVariant || 'normal';
  const spinOffsetRaw = computedStyle.getPropertyValue('--spin-start-y').trim();

  const parseCssLengthToPx = (value) => {
    if (!value) return 0;
    if (value.endsWith('px')) return Number.parseFloat(value) || 0;
    if (value.endsWith('em')) return (Number.parseFloat(value) || 0) * fontSize;
    if (value.endsWith('rem')) {
      const rootFontSize = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
      return (Number.parseFloat(value) || 0) * rootFontSize;
    }
    return Number.parseFloat(value) || 0;
  };

  let inkHeight = 0;
  if (fontSize > 0) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.font = `${fontStyle} ${fontVariant} ${fontWeight} ${fontSize}px ${fontFamily}`;
      const filmMetrics = ctx.measureText('FILM');
      const spinMetrics = ctx.measureText('SPIN');
      const filmInk = (filmMetrics.actualBoundingBoxAscent || 0) + (filmMetrics.actualBoundingBoxDescent || 0);
      const spinInk = (spinMetrics.actualBoundingBoxAscent || 0) + (spinMetrics.actualBoundingBoxDescent || 0);
      const wordInk = Math.max(filmInk, spinInk);
      const spinOffsetPx = Math.max(0, parseCssLengthToPx(spinOffsetRaw));
      inkHeight = Math.max(0, wordInk + spinOffsetPx);
    }
  }

  const titleHeight = Math.max(0, inkHeight || measuredHeight);
  if (!titleHeight) return;
  homeShellEl.style.setProperty('--home-title-height', `${titleHeight.toFixed(3)}px`);
}

function isFiltersDrawerMode() {
  return Boolean(filtersSection?.classList.contains('filters-drawer'));
}

function syncFiltersDrawerMetrics() {
  if (!isFiltersDrawerMode() || !filtersSection || !homeShellEl || !globalHeaderEl) return;
  const shellRect = homeShellEl.getBoundingClientRect();
  const headerRect = globalHeaderEl.getBoundingClientRect();
  const logoRect = globalHeaderLogoEl?.getBoundingClientRect() || null;
  const controlsRect = globalHeaderControlsEl?.getBoundingClientRect() || null;
  const toPx = (value) => `${Math.max(0, value).toFixed(3)}px`;
  const visualLeft = logoRect ? logoRect.left : headerRect.left;
  const visualRight = controlsRect ? controlsRect.right : headerRect.right;
  const topOffset = Math.max(0, headerRect.bottom - shellRect.top + 6);
  const leftOffset = visualLeft - shellRect.left;
  const rightOffset = shellRect.right - visualRight;
  const rawShift = Math.max(0, Math.round(filtersSection.scrollHeight * 0.34));
  const viewportCap = Math.max(0, Math.round(window.innerHeight * 0.18));
  const hardCap = window.matchMedia('(max-width: 1023px)').matches ? 108 : 148;
  const maxShift = Math.min(hardCap, viewportCap || hardCap);
  const shift = Math.max(0, Math.min(rawShift, maxShift));
  filtersSection.style.setProperty('--filters-left', toPx(leftOffset));
  filtersSection.style.setProperty('--filters-right', toPx(rightOffset));
  filtersSection.style.setProperty('--filters-top', toPx(topOffset));
  document.body.style.setProperty('--filters-shift', `${shift}px`);
}

function syncFiltersDrawerHeight({ animate = false } = {}) {
  if (!isFiltersDrawerMode() || !filtersSection?.classList.contains('is-visible')) return;
  const apply = () => {
    if (!filtersSection.classList.contains('is-visible')) return;
    syncFiltersDrawerMetrics();
    filtersSection.style.height = `${filtersSection.scrollHeight}px`;
  };
  if (animate) requestAnimationFrame(apply);
  else apply();
}

function openFiltersDrawer() {
  if (!isFiltersDrawerMode()) return;
  const isClosing = filtersSection.classList.contains('is-closing');
  if (filtersSection.classList.contains('is-visible') && !isClosing) return;
  syncFiltersDrawerMetrics();
  filtersSection.classList.remove('is-closing');
  filtersSection.style.height = 'auto';
  const targetHeight = `${filtersSection.scrollHeight}px`;
  filtersSection.style.height = '0px';
  document.body.classList.add('has-filters-space');
  filtersSection.classList.add('is-visible');
  filtersSection.setAttribute('aria-hidden', 'false');
  if (heroFiltersBtn) {
    heroFiltersBtn.classList.add('is-active');
    heroFiltersBtn.setAttribute('aria-expanded', 'true');
  }
  void filtersSection.offsetHeight;
  requestAnimationFrame(() => {
    filtersSection.style.height = targetHeight;
  });
}

function closeFiltersDrawer() {
  if (!isFiltersDrawerMode()) return;
  if (!filtersSection.classList.contains('is-visible')) return;
  if (filtersSection.classList.contains('is-closing')) return;
  syncFiltersDrawerMetrics();
  if (filtersSection.style.height === 'auto' || !filtersSection.style.height) {
    filtersSection.style.height = `${filtersSection.scrollHeight}px`;
  }
  filtersSection.classList.add('is-closing');
  document.body.classList.remove('has-filters-space');
  filtersSection.style.height = `${filtersSection.scrollHeight}px`;
  void filtersSection.offsetHeight;
  requestAnimationFrame(() => {
    filtersSection.style.height = '0px';
  });
  if (heroFiltersBtn) {
    heroFiltersBtn.classList.remove('is-active');
    heroFiltersBtn.setAttribute('aria-expanded', 'false');
  }
}

function toggleFiltersDrawer() {
  if (!isFiltersDrawerMode()) return;
  if (filtersSection.classList.contains('is-visible')) closeFiltersDrawer();
  else openFiltersDrawer();
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
  resultSkeletonEl.classList.add('hidden');
}

function syncResultStageState() {
  if (!resultStageEl || !resultEl) return;
  const hasResult = !resultEl.classList.contains('hidden');
  const hasSkeleton = Boolean(resultSkeletonEl && !resultSkeletonEl.classList.contains('hidden'));
  resultStageEl.classList.toggle('is-active', hasResult || hasSkeleton);
  resultStageEl.classList.toggle('is-searching', hasSkeleton);
}

function normalizeErrorMessage(message) {
  if (!message) return t('status_error_generic');
  if (message.includes('Upstream movie service')) return t('status_upstream');
  return message;
}

function isModifiedNavigation(event) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
}

function navigateToLegalPage(event) {
  const target = event.currentTarget;
  if (!(target instanceof HTMLAnchorElement)) return;
  if (event.defaultPrevented || isModifiedNavigation(event)) return;
  const href = target.getAttribute('href');
  if (!href || isLegalNavigationInFlight) return;

  event.preventDefault();
  try {
    sessionStorage.setItem(LEGAL_TRANSITION_KEY, '1');
  } catch (_) {}

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) {
    window.location.href = href;
    return;
  }

  isLegalNavigationInFlight = true;
  document.body.classList.add('is-leaving');
  window.setTimeout(() => {
    window.location.href = href;
  }, 560);
}

async function spin({ preserveCard = false } = {}) {
  mergeSiteTitle();
  const hasVisibleCard = Boolean(resultEl && !resultEl.classList.contains('hidden'));
  const keepCurrentCardVisible = preserveCard && hasVisibleCard;
  if (keepCurrentCardVisible) {
    cardController.setRefreshing(true);
    showSkeleton(false);
  } else {
    cardController.hideResultCard();
    showSkeleton(false);
  }
  syncResultStageState();
  spinButtonController.setSpinLoading(true);
  if (resultSpinBtn) {
    resultSpinBtn.disabled = true;
    resultSpinBtn.classList.add('is-loading');
    resultSpinBtn.setAttribute('aria-busy', 'true');
  }
  retryBtn.classList.add('hidden');
  statusController.showStatus('info', t('status_loading'));

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
    spinButtonController.retireSpinButton();
    showSkeleton(false);
    syncResultStageState();
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
    if (resultSpinBtn) {
      resultSpinBtn.disabled = false;
      resultSpinBtn.classList.remove('is-loading');
      resultSpinBtn.removeAttribute('aria-busy');
    }
    cardController.setRefreshing(false);
    showSkeleton(false);
    syncResultStageState();
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
  if (langPicker) langPicker.refresh();
}

function applyStaticTranslations() {
  statusController.setSloganIdle({ animate: false });
  if (heroFiltersBtn) {
    heroFiltersBtn.textContent = t('filters');
    heroFiltersBtn.setAttribute('aria-label', t('filters'));
  }
  document.getElementById('yearRangeLabel').textContent = t('year_range');
  document.getElementById('countriesLabel').textContent = `${t('countries')} (multiple choice)`;
  document.getElementById('genresLabel').textContent = `${t('genres')} (multiple choice)`;
  document.getElementById('directorLabel').textContent = `${t('people_director')}:`;
  document.getElementById('castLabel').textContent = `${t('people_cast')}:`;
  document.getElementById('watchLabel').textContent = t('watch_label');
  document.getElementById('watchOpenAll').textContent = t('watch_open_all');
  document.getElementById('minRatingLabel').textContent = t('min_rating');
  moodLabelEl.textContent = t('mood_label');
  moodEasyBtn.textContent = t('mood_easy');
  moodTenseBtn.textContent = t('mood_tense');
  moodWarmBtn.textContent = t('mood_warm');
  moodMindbenderBtn.textContent = t('mood_mindbender');
  filtersResetBtn.textContent = t('filters_reset');
  presetPopularBtn.textContent = t('preset_popular');
  presetTopBtn.textContent = t('preset_top');
  presetRecentBtn.textContent = t('preset_recent');
  retryBtn.textContent = t('retry');
  if (resultSpinBtn) {
    resultSpinBtn.setAttribute('aria-label', t('btn_spin_more'));
    resultSpinBtn.setAttribute('title', t('btn_spin_more'));
  }
  if (resultSpinTextEl) resultSpinTextEl.textContent = t('btn_spin_more_label');
  if (searchLoaderTextEl) searchLoaderTextEl.textContent = t('card_loading');
  if (searchLoaderSubtextEl) searchLoaderSubtextEl.textContent = t('card_loading_sub');
  spinButtonController.syncSpinLabel();
  filtersController.applyTranslations();

  const footerTerms = document.getElementById('footerTerms');
  if (footerTerms) footerTerms.textContent = t('terms');
  const footerPrivacy = document.getElementById('footerPrivacy');
  if (footerPrivacy) footerPrivacy.textContent = t('privacy');
  const footerAbout = document.getElementById('footerAbout');
  if (footerAbout) footerAbout.textContent = t('about');
  if (langPicker) langPicker.sync();
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
  if (resultSpinBtn) {
    resultSpinBtn.addEventListener('click', () => spin({ preserveCard: true }));
  }

  yrMin.addEventListener('input', filtersController.handleYearMinInput);
  yrMax.addEventListener('input', filtersController.handleYearMaxInput);
  ratingMin.addEventListener('input', filtersController.handleRatingInput);

  window.addEventListener('resize', () => {
    filtersController.syncYearRange();
    syncHomeTitleMetrics();
    syncFiltersDrawerMetrics();
    syncFiltersDrawerHeight();
  });

  const toggleFilters = () => {
    const expanded = filtersToggle.getAttribute('aria-expanded') === 'true';
    if (expanded) filtersController.closeFilters();
    else filtersController.openFilters();
  };

  if (heroFiltersBtn) {
    heroFiltersBtn.addEventListener('click', () => {
      if (isFiltersDrawerMode()) {
        toggleFiltersDrawer();
        return;
      }
      filtersController.openFilters();
      filtersHeader.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  if (!isFiltersDrawerMode()) {
    filtersHeader.addEventListener('click', toggleFilters);
    filtersHeader.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      toggleFilters();
    });
  }

  if (isFiltersDrawerMode()) {
    filtersSection.addEventListener('transitionend', (event) => {
      if (event.target !== filtersSection || event.propertyName !== 'height') return;
      if (filtersSection.classList.contains('is-closing')) {
        filtersSection.classList.remove('is-closing', 'is-visible');
        filtersSection.setAttribute('aria-hidden', 'true');
        filtersSection.style.height = '0px';
        return;
      }
      if (filtersSection.classList.contains('is-visible')) {
        syncFiltersDrawerMetrics();
        filtersSection.style.height = 'auto';
      }
    });
  }

  if (advancedToggle) {
    advancedToggle.addEventListener('click', () => {
      filtersController.toggleAdvanced();
    });
  }

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
    if (advancedBody?.classList.contains('is-open')) {
      advancedBody.style.maxHeight = `${advancedBody.scrollHeight}px`;
    }
    syncFiltersDrawerMetrics();
    syncFiltersDrawerHeight();
  });
  ro.observe(filtersBody);
  if (advancedBody) ro.observe(advancedBody);

  filtersController.setApplyHandler(async () => spin({ preserveCard: true }));

  if (footerTermsLink) footerTermsLink.addEventListener('click', navigateToLegalPage);
  if (footerPrivacyLink) footerPrivacyLink.addEventListener('click', navigateToLegalPage);
  if (footerAboutLink) footerAboutLink.addEventListener('click', navigateToLegalPage);
}

async function initApp() {
  await loadPublicConfig();
  applyLanguageAvailability();
  if (statusEl) statusEl.classList.add('hidden');
  langSelect.value = getLang();
  syncResultStageState();
  syncHomeTitleMetrics();
  syncFiltersDrawerMetrics();

  filtersController.restoreFilters();
  applyStaticTranslations();

  filtersController.syncYearRange();
  filtersController.updateRatingThumb();
  filtersController.loadCountries();

  if (isFiltersDrawerMode()) {
    filtersController.openFilters();
    closeFiltersDrawer();
  } else if (filtersController.isSavedFiltersOpen()) {
    filtersController.openFilters();
  } else {
    filtersController.closeFilters();
  }

  if (advancedToggle && advancedBody) {
    if (filtersController.isSavedAdvancedOpen()) filtersController.openAdvanced();
    else filtersController.closeAdvanced();
  }

  await filtersController.loadGenres();
  filtersController.finalizeInitState();
  attachEventHandlers();

  if (document.fonts?.ready) {
    document.fonts.ready.then(() => {
      syncHomeTitleMetrics();
      syncFiltersDrawerMetrics();
      syncFiltersDrawerHeight();
    });
  }
}

initApp();
