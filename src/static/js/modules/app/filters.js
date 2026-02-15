export function createFiltersController({ elements, constants, deps }) {
  const {
    ratingMin,
    ratingVal,
    yrMin,
    yrMax,
    yrFill,
    yrTrack,
    yrMinBadge,
    yrMaxBadge,
    filtersBody,
    filtersToggle,
    presetPopularBtn,
    presetTopBtn,
    presetRecentBtn,
  } = elements;

  const {
    YEAR_MIN,
    YEAR_MAX,
    FILTERS_STORAGE_KEY,
    RU_ALLOWED_GENRES,
    countriesList,
  } = constants;

  const {
    getLang,
    langMap,
    t,
    getJson,
    showStatus,
    clamp,
    toYear,
    valueToColor,
  } = deps;

  const selectedGenres = new Set();
  const selectedCountries = new Set();
  let genreSelectionSeed = new Set();
  let savedFiltersOpen = false;

  function initDefaults() {
    ratingMin.min = 1.0;
    ratingMin.max = 9.0;
    ratingMin.step = 0.1;
    ratingMin.value = 1.0;

    yrMin.max = String(YEAR_MAX);
    yrMax.max = String(YEAR_MAX);
    yrMin.value = String(YEAR_MIN);
    yrMax.value = String(YEAR_MAX);
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
      to: toYear(yrMax.value, YEAR_MAX),
    };
  }

  function updateRatingThumb() {
    const val = parseFloat(ratingMin.value);
    const min = parseFloat(ratingMin.min);
    const max = parseFloat(ratingMin.max);
    const ratio = (val - min) / (max - min);
    const color = valueToColor(val);
    const trackColor = 'rgba(6, 14, 31, 0.68)';

    ratingMin.style.setProperty('--thumb-color', color);
    ratingMin.style.background = `linear-gradient(to right, ${color} ${ratio * 100}%, ${trackColor} ${ratio * 100}%)`;
    ratingVal.textContent = val.toFixed(1);
  }

  function selectedGenresQuery() {
    return Array.from(selectedGenres).join('|');
  }

  function selectedCountriesQuery() {
    return Array.from(selectedCountries).join(',');
  }

  function snapshotFilters() {
    const { from, to } = getYearRange();
    return {
      year_from: from,
      year_to: to,
      vote_avg_min: Number.parseFloat(ratingMin.value) || 1,
      genres: Array.from(selectedGenres),
      countries: Array.from(selectedCountries),
      filters_open: filtersBody.classList.contains('is-open'),
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

  function isSavedFiltersOpen() {
    return savedFiltersOpen;
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
      showStatus('error', t('status_genres_failed'), { autoclear: true });
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

  function clearSelections() {
    selectedGenres.clear();
    selectedCountries.clear();
    genreSelectionSeed = new Set();
  }

  async function resetFilters() {
    yrMin.value = String(YEAR_MIN);
    yrMax.value = String(YEAR_MAX);
    ratingMin.value = '1.0';
    clearSelections();

    syncYearRange();
    updateRatingThumb();
    clearActivePresets();

    loadCountries();
    await loadGenres();

    saveFilters();
  }

  function handleYearMinInput() {
    yrMin.value = String(clamp(toYear(yrMin.value, YEAR_MIN), YEAR_MIN, YEAR_MAX));
    if (toYear(yrMin.value, YEAR_MIN) > toYear(yrMax.value, YEAR_MAX)) yrMax.value = yrMin.value;
    clearActivePresets();
    syncYearRange();
    saveFilters();
  }

  function handleYearMaxInput() {
    yrMax.value = String(clamp(toYear(yrMax.value, YEAR_MAX), YEAR_MIN, YEAR_MAX));
    if (toYear(yrMax.value, YEAR_MAX) < toYear(yrMin.value, YEAR_MIN)) yrMin.value = yrMax.value;
    clearActivePresets();
    syncYearRange();
    saveFilters();
  }

  function handleRatingInput() {
    clearActivePresets();
    updateRatingThumb();
    saveFilters();
  }

  return {
    initDefaults,
    syncYearRange,
    getYearRange,
    updateRatingThumb,
    selectedGenresQuery,
    selectedCountriesQuery,
    saveFilters,
    restoreFilters,
    isSavedFiltersOpen,
    clearActivePresets,
    applyPreset,
    openFilters,
    closeFilters,
    loadCountries,
    loadGenres,
    clearSelections,
    resetFilters,
    handleYearMinInput,
    handleYearMaxInput,
    handleRatingInput,
  };
}
