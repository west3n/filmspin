import { I18N, langMap } from './modules/i18n.js';
import { getJson } from './modules/http.js';

const FILTERS_STORAGE_KEY = 'fs_filters_v2';
const YEAR_MIN = 1900;
const YEAR_MAX = Math.max(YEAR_MIN, new Date().getFullYear());

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
const resultEl = document.getElementById('result');
const resultSkeletonEl = document.getElementById('resultSkeleton');

const langSelect = document.getElementById('langSwitch');
const filtersToggle = document.getElementById('filtersToggle');
const filtersBody = document.getElementById('filtersBody');
const filtersResetBtn = document.getElementById('filtersReset');
const presetPopularBtn = document.getElementById('presetPopular');
const presetTopBtn = document.getElementById('presetTop');
const presetRecentBtn = document.getElementById('presetRecent');

const publicConfig = { ru_enabled: true };
const selectedGenres = new Set();
const selectedCountries = new Set();
let genreSelectionSeed = new Set();
let currentMovie = null;
let statusTimer = null;
let savedFiltersOpen = false;

const RU_ALLOWED_GENRES = new Set([
  'боевик', 'приключения', 'мультфильм', 'комедия', 'криминал',
  'документальный', 'драма', 'семейный', 'фэнтези', 'история',
  'ужасы', 'музыка', 'детектив', 'мелодрама', 'фантастика',
  'триллер', 'военный', 'вестерн'
]);

const countriesList = [
  { code: 'US', name_en: 'United States', name_ru: 'США' },
  { code: 'GB', name_en: 'United Kingdom', name_ru: 'Великобритания' },
  { code: 'FR', name_en: 'France', name_ru: 'Франция' },
  { code: 'DE', name_en: 'Germany', name_ru: 'Германия' },
  { code: 'IT', name_en: 'Italy', name_ru: 'Италия' },
  { code: 'ES', name_en: 'Spain', name_ru: 'Испания' },
  { code: 'IN', name_en: 'India', name_ru: 'Индия' },
  { code: 'JP', name_en: 'Japan', name_ru: 'Япония' },
  { code: 'KR', name_en: 'South Korea', name_ru: 'Корея Южная' },
  { code: 'RU', name_en: 'Russia', name_ru: 'Россия' },
  { code: 'CN', name_en: 'China', name_ru: 'Китай' },
  { code: 'SU', name_en: 'USSR', name_ru: 'СССР' }
];

ratingMin.min = 1.0;
ratingMin.max = 9.0;
ratingMin.step = 0.1;
ratingMin.value = 1.0;

yrMin.max = String(YEAR_MAX);
yrMax.max = String(YEAR_MAX);
yrMin.value = String(YEAR_MIN);
yrMax.value = String(YEAR_MAX);

function clamp(v, a, b) {
  return Math.min(b, Math.max(a, v));
}

function toYear(value, fallback) {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

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

function syncYearRange() {
  let a = toYear(yrMin.value, YEAR_MIN);
  let b = toYear(yrMax.value, YEAR_MAX);

  if (a > b) {
    const mid = Math.round((a + b) / 2);
    a = mid;
    b = mid;
    yrMin.value = String(mid);
    yrMax.value = String(mid);
  }

  const span = Math.max(1, YEAR_MAX - YEAR_MIN);
  const pA = (a - YEAR_MIN) / span;
  const pB = (b - YEAR_MIN) / span;

  yrFill.style.left = `${pA * 100}%`;
  yrFill.style.right = `${(1 - pB) * 100}%`;

  const wrapRect = yrTrack.parentElement.getBoundingClientRect();
  const trackRect = yrTrack.getBoundingClientRect();
  const trackLeft = trackRect.left - wrapRect.left;
  const trackW = trackRect.width;

  const place = (badge, pct, text) => {
    badge.textContent = text;
    const w = badge.offsetWidth || 28;
    const xCenter = trackLeft + trackW * pct;
    const pad = 6;
    const min = w / 2 + pad;
    const max = wrapRect.width - w / 2 - pad;
    const clamped = Math.min(max, Math.max(min, xCenter));
    badge.style.left = `${clamped}px`;
  };

  place(yrMinBadge, pA, a);
  place(yrMaxBadge, pB, b);
}

function getYearRange() {
  return {
    from: toYear(yrMin.value, YEAR_MIN),
    to: toYear(yrMax.value, YEAR_MAX)
  };
}

function valueToColor(val) {
  const min = 1.0;
  const max = 9.0;
  const ratio = Math.min(1, Math.max(0, (val - min) / (max - min)));
  // Warm gradient: dusty rose -> mocha sand.
  const from = [168, 102, 114];
  const to = [211, 160, 127];
  const r = Math.round(from[0] + (to[0] - from[0]) * ratio);
  const g = Math.round(from[1] + (to[1] - from[1]) * ratio);
  const b = Math.round(from[2] + (to[2] - from[2]) * ratio);
  return `rgb(${r},${g},${b})`;
}

function updateRatingThumb() {
  const val = parseFloat(ratingMin.value);
  const min = parseFloat(ratingMin.min);
  const max = parseFloat(ratingMin.max);
  const ratio = (val - min) / (max - min);
  const color = valueToColor(val);

  ratingMin.style.setProperty('--thumb-color', color);
  ratingMin.style.background = `linear-gradient(to right, ${color} ${ratio * 100}%, rgba(93,73,82,0.52) ${ratio * 100}%)`;
  ratingVal.textContent = val.toFixed(1);
}

function selectedGenresQuery() {
  return Array.from(selectedGenres).join('|');
}

function selectedCountriesQuery() {
  return Array.from(selectedCountries).join(',');
}

function showStatus(kind, text, { autoclear = false } = {}) {
  if (!statusEl) return;
  if (statusTimer) {
    clearTimeout(statusTimer);
    statusTimer = null;
  }

  statusEl.classList.remove('hidden', 'status-info', 'status-success', 'status-error');
  statusEl.classList.add(`status-${kind}`);
  statusEl.textContent = text;

  if (autoclear) {
    statusTimer = setTimeout(() => {
      statusEl.classList.add('hidden');
    }, 2600);
  }
}

function hideStatus() {
  if (!statusEl) return;
  if (statusTimer) {
    clearTimeout(statusTimer);
    statusTimer = null;
  }
  statusEl.classList.add('hidden');
}

function showSkeleton(show) {
  if (!resultSkeletonEl) return;
  resultSkeletonEl.classList.toggle('hidden', !show);
}

function setSpinLoading(isLoading) {
  spinBtn.classList.remove('btn-press');
  void spinBtn.offsetWidth;
  spinBtn.classList.add('btn-press');

  if (isLoading) {
    spinBtn.classList.add('reel-mode', 'is-loading');
    spinBtn.innerHTML = `<span class="dice"><img src="/img/endurance.png" alt="Endurance" /></span><span class="label">${t('btn_spin')}</span>`;
    const dice = spinBtn.querySelector('.dice');
    if (dice) {
      const dir = Math.random() < 0.5 ? 'spin-left' : 'spin-right';
      dice.classList.add(dir);
      spinBtn.dataset.spinDir = dir;
    }
    return;
  }

  const dir = spinBtn.dataset.spinDir;
  if (dir) {
    const dice = spinBtn.querySelector('.dice');
    if (dice) dice.classList.remove(dir);
    delete spinBtn.dataset.spinDir;
  }

  spinBtn.classList.remove('is-loading');
  setTimeout(() => {
    spinBtn.classList.remove('reel-mode');
    spinBtn.innerHTML = `<span class="dice"><img src="/img/endurance.png" alt="Endurance" /></span><span class="label">${t('btn_spin')}</span>`;
  }, 100);
}

function normalizeErrorMessage(message) {
  if (!message) return t('status_error_generic');
  if (message.includes('Upstream movie service')) return t('status_upstream');
  return message;
}

function snapshotFilters() {
  const { from, to } = getYearRange();
  return {
    year_from: from,
    year_to: to,
    vote_avg_min: Number.parseFloat(ratingMin.value) || 1,
    genres: Array.from(selectedGenres),
    countries: Array.from(selectedCountries),
    filters_open: filtersBody.classList.contains('is-open')
  };
}

function saveFilters() {
  try {
    localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(snapshotFilters()));
  } catch (_) {}
}

function restoreFilters() {
  try {
    const raw = localStorage.getItem(FILTERS_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return;

    yrMin.value = String(clamp(toYear(parsed.year_from, YEAR_MIN), YEAR_MIN, YEAR_MAX));
    yrMax.value = String(clamp(toYear(parsed.year_to, YEAR_MAX), YEAR_MIN, YEAR_MAX));
    if (toYear(yrMin.value, YEAR_MIN) > toYear(yrMax.value, YEAR_MAX)) {
      yrMax.value = yrMin.value;
    }

    const rating = Number.parseFloat(parsed.vote_avg_min);
    ratingMin.value = Number.isFinite(rating) ? String(clamp(rating, 1, 9)) : '1.0';

    selectedCountries.clear();
    if (Array.isArray(parsed.countries)) {
      parsed.countries.forEach((code) => {
        if (typeof code === 'string' && code.trim()) selectedCountries.add(code);
      });
    }

    genreSelectionSeed = new Set();
    if (Array.isArray(parsed.genres)) {
      parsed.genres.forEach((gid) => {
        if (typeof gid === 'string' && gid.trim()) genreSelectionSeed.add(gid);
      });
    }

    savedFiltersOpen = parsed.filters_open === true;
  } catch (_) {}
}

function clearActivePresets() {
  [presetPopularBtn, presetTopBtn, presetRecentBtn].forEach((btn) => btn.classList.remove('is-active'));
}

function applyPreset(presetKey) {
  const now = new Date().getFullYear();
  let from = YEAR_MIN;
  let to = YEAR_MAX;
  let rating = 1.0;

  if (presetKey === 'popular') {
    from = 1980;
    to = YEAR_MAX;
    rating = 5.8;
  } else if (presetKey === 'top') {
    from = 1950;
    to = YEAR_MAX;
    rating = 7.3;
  } else if (presetKey === 'recent') {
    from = Math.max(YEAR_MIN, now - 12);
    to = YEAR_MAX;
    rating = 6.2;
  }

  yrMin.value = String(from);
  yrMax.value = String(to);
  ratingMin.value = String(rating);
  syncYearRange();
  updateRatingThumb();

  clearActivePresets();
  if (presetKey === 'popular') presetPopularBtn.classList.add('is-active');
  if (presetKey === 'top') presetTopBtn.classList.add('is-active');
  if (presetKey === 'recent') presetRecentBtn.classList.add('is-active');

  saveFilters();
}

function openFilters() {
  filtersBody.classList.add('is-open');
  filtersBody.style.maxHeight = '0px';
  requestAnimationFrame(() => {
    filtersBody.style.maxHeight = `${filtersBody.scrollHeight}px`;
  });
  filtersToggle.setAttribute('aria-expanded', 'true');
  filtersToggle.textContent = t('hide');
  saveFilters();
}

function closeFilters() {
  filtersBody.style.maxHeight = '0px';
  filtersBody.classList.remove('is-open');
  filtersToggle.setAttribute('aria-expanded', 'false');
  filtersToggle.textContent = t('show');
  saveFilters();
}

function renderGenreChip(genre) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.dataset.id = String(genre.id);
  btn.className = 'chip chip--genre';

  const displayName = getLang() === 'ru' && genre.name
    ? genre.name.slice(0, 1).toUpperCase() + genre.name.slice(1)
    : genre.name;

  btn.textContent = displayName;

  const update = () => {
    btn.classList.toggle('is-active', selectedGenres.has(btn.dataset.id));
  };

  btn.addEventListener('click', () => {
    const id = btn.dataset.id;
    if (selectedGenres.has(id)) selectedGenres.delete(id);
    else selectedGenres.add(id);
    update();
    clearActivePresets();
    saveFilters();
  });

  update();
  return btn;
}

function renderCountryChip(country) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.dataset.id = country.code;
  btn.className = 'chip chip--country';
  btn.textContent = getLang() === 'ru' ? country.name_ru : country.name_en;

  const update = () => {
    btn.classList.toggle('is-active', selectedCountries.has(country.code));
  };

  btn.addEventListener('click', () => {
    if (selectedCountries.has(country.code)) selectedCountries.delete(country.code);
    else selectedCountries.add(country.code);
    update();
    clearActivePresets();
    saveFilters();
  });

  update();
  return btn;
}

function loadCountries() {
  const wrap = document.getElementById('countryChips');
  wrap.innerHTML = '';
  countriesList.forEach((country) => wrap.appendChild(renderCountryChip(country)));
}

async function loadGenres() {
  const isRU = getLang() === 'ru';
  const url = isRU
    ? '/api/genres_ru'
    : `/api/genres?lang=${encodeURIComponent(langMap[getLang()])}`;

  const wrap = document.getElementById('genreChips');
  wrap.innerHTML = '';

  let raw;
  try {
    const { ok, status, data } = await getJson(url, { cache: 'no-store' });
    if (!ok) throw new Error(`Genres HTTP ${status}`);
    raw = data;
  } catch (error) {
    console.error('Failed to load genres:', error);
    showStatus('error', t('status_genres_failed'));
    raw = [];
  }

  const arr = Array.isArray(raw)
    ? raw
    : (Array.isArray(raw?.docs) ? raw.docs : (Array.isArray(raw?.genres) ? raw.genres : []));

  let list = arr.map((g) => {
    if (g && typeof g === 'object' && 'id' in g && 'name' in g) {
      return { id: String(g.id), name: g.name };
    }
    if (g && typeof g === 'object' && 'slug' in g && 'name' in g) {
      return { id: String(g.slug), name: g.name };
    }
    const fallbackName = g?.name ?? String(g);
    return { id: fallbackName, name: fallbackName };
  });

  if (getLang() === 'ru') {
    list = list.filter((g) => RU_ALLOWED_GENRES.has(String(g.name).toLowerCase()));
  }

  const preferred = new Set(genreSelectionSeed.size ? genreSelectionSeed : selectedGenres);
  selectedGenres.clear();

  list.forEach((g) => {
    const id = String(g.id);
    if (preferred.has(id)) selectedGenres.add(id);
    wrap.appendChild(renderGenreChip(g));
  });

  genreSelectionSeed = new Set(selectedGenres);

  if (filtersBody.classList.contains('is-open')) {
    requestAnimationFrame(() => {
      filtersBody.style.maxHeight = `${filtersBody.scrollHeight}px`;
    });
  }

  saveFilters();
}

function renderCard(data) {
  const cardEl = resultEl.querySelector('.result-card');
  resultEl.classList.remove('hidden');

  if (cardEl) {
    cardEl.classList.remove('animate-in');
    void cardEl.offsetWidth;
    cardEl.classList.add('animate-in');
  }

  const title = `${data.title || 'Untitled'} (${data.year || '—'})`;
  document.getElementById('title').textContent = title;

  const metaEl = document.getElementById('meta');
  const metaChunks = [];
  if (Array.isArray(data.genres) && data.genres.length) metaChunks.push(data.genres.join(' · '));
  if (Array.isArray(data.countries) && data.countries.length) metaChunks.push(data.countries.join(', '));
  metaEl.textContent = metaChunks.join('   •   ');

  document.getElementById('overview').textContent = data.overview || '—';

  const posterEl = document.getElementById('poster');
  posterEl.src = data.poster || '';
  posterEl.alt = data.title ? `${data.title} poster` : 'Movie poster';

  const kpEl = document.getElementById('kpRating');
  const imdbEl = document.getElementById('imdbRating');

  const fmt1 = (x) => {
    const n = Number.parseFloat(x);
    return Number.isFinite(n) ? n.toFixed(1) : '–';
  };

  if (getLang() === 'ru' && data.kp_rating) {
    const votesNum = Number.parseInt(String(data.kp_votes || '').replace(/[, ]/g, ''), 10);
    const votesTxt = Number.isFinite(votesNum) ? ` (${votesNum.toLocaleString('ru-RU')})` : '';
    const kpLabel = data.kp_url
      ? `<a href="${data.kp_url}" target="_blank" rel="noopener" class="underline hover:no-underline">Кинопоиск</a>`
      : '<span>Кинопоиск</span>';
    kpEl.innerHTML = `<span class="text-orange-400" aria-hidden="true">★</span> ${kpLabel}: <b>${fmt1(data.kp_rating)}</b>${votesTxt}`;
    kpEl.classList.remove('hidden');
  } else {
    kpEl.classList.add('hidden');
    kpEl.innerHTML = '';
  }

  if (data.imdb_url && data.imdb_rating) {
    const votesNum = Number.parseInt(String(data.imdb_votes || '').replace(/[, ]/g, ''), 10);
    const votesTxt = Number.isFinite(votesNum) ? ` (${votesNum.toLocaleString('en-US')})` : '';
    imdbEl.innerHTML = `<span class="text-yellow-400" aria-hidden="true">★</span> <a href="${data.imdb_url}" target="_blank" rel="noopener" class="underline hover:no-underline">IMDb</a>: <b>${fmt1(data.imdb_rating)}</b>${votesTxt}`;
    imdbEl.classList.remove('hidden');
  } else {
    imdbEl.classList.add('hidden');
    imdbEl.innerHTML = '';
  }

  const ratingsRow = document.querySelector('#ratings .flex');
  if (ratingsRow) {
    ratingsRow.querySelectorAll('.sep-dot').forEach((n) => n.remove());
    const visible = [kpEl, imdbEl].filter((el) => el && !el.classList.contains('hidden'));
    for (let i = 1; i < visible.length; i += 1) {
      const dot = document.createElement('span');
      dot.className = 'sep-dot opacity-50 select-none text-xs';
      dot.textContent = '•';
      visible[i - 1].after(dot);
    }
  }
}

async function reloadCurrentInNewLang() {
  if (!currentMovie) return;

  try {
    if (getLang() === 'ru') {
      if (currentMovie.kp_id) {
        const { data } = await getJson(`/api/movie_ru?id=${encodeURIComponent(currentMovie.kp_id)}`);
        if (!data?.error) {
          renderCard(data);
          return;
        }
      }

      let mapUrl = null;
      if (currentMovie.tmdb_id) mapUrl = `/api/movie_ru_by_external?tmdb_id=${encodeURIComponent(currentMovie.tmdb_id)}`;
      else if (currentMovie.imdb_id) mapUrl = `/api/movie_ru_by_external?imdb_id=${encodeURIComponent(currentMovie.imdb_id)}`;

      if (mapUrl) {
        const { data } = await getJson(mapUrl);
        if (!data?.error) {
          if (data.kp_id) currentMovie.kp_id = data.kp_id;
          renderCard(data);
        }
      }
      return;
    }

    if (currentMovie.tmdb_id) {
      const { data } = await getJson(`/api/movie?tmdb_id=${encodeURIComponent(currentMovie.tmdb_id)}&lang=${encodeURIComponent(langMap[getLang()])}`);
      if (!data?.error) renderCard(data);
    }
  } catch (error) {
    console.warn('re-render in new lang failed', error);
  }
}

async function spin() {
  const hasRenderedCard = !resultEl.classList.contains('hidden');
  setSpinLoading(true);
  retryBtn.classList.add('hidden');
  showStatus('info', t('status_loading'));
  showSkeleton(!hasRenderedCard);

  try {
    const params = new URLSearchParams();
    const { from, to } = getYearRange();
    params.set('year_from', String(from));
    params.set('year_to', String(to));

    const genres = selectedGenresQuery();
    const countries = selectedCountriesQuery();

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
      showStatus('error', message);
      retryBtn.classList.remove('hidden');
      return;
    }

    currentMovie = {
      tmdb_id: data.tmdb_id || null,
      kp_id: data.kp_id || null,
      imdb_id: data.imdb_id || null
    };

    renderCard(data);
    showStatus('success', t('status_ready'), { autoclear: true });
  } catch (error) {
    console.error(error);
    showStatus('error', t('status_error_generic'));
    retryBtn.classList.remove('hidden');
  } finally {
    setSpinLoading(false);
    showSkeleton(false);
    saveFilters();
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
  document.getElementById('slogan').textContent = t('slogan');
  document.getElementById('filtersTitle').textContent = t('filters');
  document.getElementById('yearRangeLabel').textContent = t('year_range');
  document.getElementById('countriesLabel').textContent = t('countries');
  document.getElementById('genresLabel').textContent = t('genres');
  document.getElementById('minRatingLabel').textContent = t('min_rating');
  document.getElementById('countriesHint').textContent = t('multi_select_hint');
  document.getElementById('genresHint').textContent = t('multi_select_hint');

  const expanded = filtersToggle.getAttribute('aria-expanded') === 'true';
  filtersToggle.textContent = expanded ? t('hide') : t('show');

  filtersResetBtn.textContent = t('filters_reset');
  presetPopularBtn.textContent = t('preset_popular');
  presetTopBtn.textContent = t('preset_top');
  presetRecentBtn.textContent = t('preset_recent');
  retryBtn.textContent = t('retry');

  if (spinBtn.classList.contains('is-loading')) {
    const label = spinBtn.querySelector('.label');
    if (label) label.textContent = t('btn_spin');
  } else {
    spinBtn.innerHTML = `<span class="dice"><img src="/img/endurance.png" alt="Endurance" /></span><span class="label">${t('btn_spin')}</span>`;
  }

  const footerData = document.getElementById('footerData');
  if (footerData) footerData.textContent = t('data_source');

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

  yrMin.addEventListener('input', () => {
    yrMin.value = String(clamp(toYear(yrMin.value, YEAR_MIN), YEAR_MIN, YEAR_MAX));
    if (toYear(yrMin.value, YEAR_MIN) > toYear(yrMax.value, YEAR_MAX)) yrMax.value = yrMin.value;
    clearActivePresets();
    syncYearRange();
    saveFilters();
  });

  yrMax.addEventListener('input', () => {
    yrMax.value = String(clamp(toYear(yrMax.value, YEAR_MAX), YEAR_MIN, YEAR_MAX));
    if (toYear(yrMax.value, YEAR_MAX) < toYear(yrMin.value, YEAR_MIN)) yrMin.value = yrMax.value;
    clearActivePresets();
    syncYearRange();
    saveFilters();
  });

  ratingMin.addEventListener('input', () => {
    clearActivePresets();
    updateRatingThumb();
    saveFilters();
  });

  window.addEventListener('resize', syncYearRange);

  filtersToggle.addEventListener('click', () => {
    const expanded = filtersToggle.getAttribute('aria-expanded') === 'true';
    if (expanded) closeFilters();
    else openFilters();
  });

  filtersResetBtn.addEventListener('click', async () => {
    yrMin.value = String(YEAR_MIN);
    yrMax.value = String(YEAR_MAX);
    ratingMin.value = '1.0';
    selectedGenres.clear();
    selectedCountries.clear();
    genreSelectionSeed = new Set();

    syncYearRange();
    updateRatingThumb();
    clearActivePresets();

    loadCountries();
    await loadGenres();

    saveFilters();
    hideStatus();
  });

  presetPopularBtn.addEventListener('click', () => applyPreset('popular'));
  presetTopBtn.addEventListener('click', () => applyPreset('top'));
  presetRecentBtn.addEventListener('click', () => applyPreset('recent'));

  langSelect.addEventListener('change', async () => {
    if (langSelect.value === 'ru' && !isRuEnabled()) {
      langSelect.value = 'en';
      return;
    }

    setLang(langSelect.value);
    applyStaticTranslations();

    selectedGenres.clear();
    genreSelectionSeed = new Set();

    loadCountries();
    await loadGenres();
    await reloadCurrentInNewLang();

    saveFilters();
  });

  const ro = new ResizeObserver(() => {
    if (filtersBody.classList.contains('is-open')) {
      filtersBody.style.maxHeight = `${filtersBody.scrollHeight}px`;
    }
  });
  ro.observe(filtersBody);
}

async function initApp() {
  await loadPublicConfig();
  applyLanguageAvailability();

  const curLang = getLang();
  langSelect.value = curLang;

  restoreFilters();
  applyStaticTranslations();

  syncYearRange();
  updateRatingThumb();

  loadCountries();

  if (savedFiltersOpen) openFilters();
  else closeFilters();

  await loadGenres();
  attachEventHandlers();
}

initApp();
