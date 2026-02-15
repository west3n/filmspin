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
    filtersPreviewEl,
    relaxFiltersBtn,
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
    getExclusionsPayload,
    showStatus,
    clamp,
    toYear,
    valueToColor,
  } = deps;

  const selectedGenres = new Set();
  const selectedCountries = new Set();

  let genreSelectionSeed = new Set();
  let savedFiltersOpen = false;
  let savedAdvancedOpen = false;
  let autoApply = true;

  let pending = false;
  let applyInFlight = false;
  let applyHandler = null;
  let appliedCriteriaHash = '';
  let autoApplyTimer = null;
  let previewTimer = null;
  let previewRequestSeq = 0;

  let previewState = {
    phase: 'idle',
    estimatedTotal: null,
    lowResults: false,
    unavailable: false,
  };
  let runtimeMin = null;
  let runtimeMax = null;
  let activeMood = null;
  const genreIdByName = new Map();

  const moodButtons = {
    easy: moodEasyBtn,
    tense: moodTenseBtn,
    warm: moodWarmBtn,
    mindbender: moodMindbenderBtn,
  };

  const runtimeButtons = Array.from(document.querySelectorAll('.runtime-chip'));
  const MOOD_PROFILES = {
    easy: {
      rating: 6.0,
      yearFrom: 1990,
      yearTo: YEAR_MAX,
      runtimeMin: 80,
      runtimeMax: 130,
      genresEn: ['Comedy', 'Family', 'Romance'],
      genresRu: ['комедия', 'семейный', 'мелодрама'],
    },
    tense: {
      rating: 6.8,
      yearFrom: 1985,
      yearTo: YEAR_MAX,
      runtimeMin: 90,
      runtimeMax: 145,
      genresEn: ['Thriller', 'Action', 'Crime'],
      genresRu: ['триллер', 'боевик', 'криминал'],
    },
    warm: {
      rating: 6.2,
      yearFrom: 1980,
      yearTo: YEAR_MAX,
      runtimeMin: 80,
      runtimeMax: 125,
      genresEn: ['Drama', 'Family', 'Adventure'],
      genresRu: ['драма', 'семейный', 'приключения'],
    },
    mindbender: {
      rating: 7.0,
      yearFrom: 1970,
      yearTo: YEAR_MAX,
      runtimeMin: 95,
      runtimeMax: 170,
      genresEn: ['Science Fiction', 'Mystery', 'Drama'],
      genresRu: ['фантастика', 'детектив', 'драма'],
    },
  };

  function _criteriaSnapshot() {
    const { from, to } = getYearRange();
    return {
      year_from: from,
      year_to: to,
      runtime_min: runtimeMin,
      runtime_max: runtimeMax,
      vote_avg_min: Number.parseFloat(ratingMin.value) || 1,
      genres: Array.from(selectedGenres),
      countries: Array.from(selectedCountries),
    };
  }

  function _criteriaHash() {
    const criteria = _criteriaSnapshot();
    return JSON.stringify({
      ...criteria,
      genres: [...criteria.genres].sort(),
      countries: [...criteria.countries].sort(),
    });
  }

  function _hasActiveCriteria() {
    const criteria = _criteriaSnapshot();
    return (
      criteria.year_from !== YEAR_MIN
      || criteria.year_to !== YEAR_MAX
      || criteria.runtime_min !== null
      || criteria.runtime_max !== null
      || criteria.vote_avg_min > 1.01
      || criteria.genres.length > 0
      || criteria.countries.length > 0
    );
  }

  function _normalizeGenreName(value) {
    return String(value || '').trim().toLowerCase();
  }

  function _runtimeKey(minValue, maxValue) {
    const left = minValue == null ? '' : String(minValue);
    const right = maxValue == null ? '' : String(maxValue);
    return `${left}|${right}`;
  }

  function _clearMoodVisual() {
    activeMood = null;
    Object.values(moodButtons).forEach((btn) => {
      if (btn) btn.classList.remove('is-active');
    });
  }

  function _setActiveMoodVisual(moodKey) {
    _clearMoodVisual();
    activeMood = moodKey;
    const btn = moodButtons[moodKey];
    if (btn) btn.classList.add('is-active');
  }

  function _updateRuntimeVisual() {
    const current = _runtimeKey(runtimeMin, runtimeMax);
    runtimeButtons.forEach((btn) => {
      const key = _runtimeKey(
        btn.dataset.min === '' ? null : Number.parseInt(btn.dataset.min, 10),
        btn.dataset.max === '' ? null : Number.parseInt(btn.dataset.max, 10),
      );
      btn.classList.toggle('is-active', key === current);
    });
  }

  function _setRuntime(minValue, maxValue) {
    runtimeMin = Number.isFinite(minValue) ? minValue : null;
    runtimeMax = Number.isFinite(maxValue) ? maxValue : null;
    if (runtimeMin !== null && runtimeMax !== null && runtimeMin > runtimeMax) {
      runtimeMax = runtimeMin;
    }
    _updateRuntimeVisual();
  }

  function _syncGenreVisualState() {
    const wrap = document.getElementById('genreChips');
    if (!wrap) return;
    wrap.querySelectorAll('.chip--genre').forEach((node) => {
      const id = node.dataset.id;
      node.classList.toggle('is-active', selectedGenres.has(id));
    });
  }

  function _clearPresetHighlights() {
    [presetPopularBtn, presetTopBtn, presetRecentBtn].forEach((btn) => {
      if (btn) btn.classList.remove('is-active');
    });
  }

  function _updateFiltersBodyHeight() {
    if (filtersBody?.classList.contains('is-open')) {
      filtersBody.style.maxHeight = `${filtersBody.scrollHeight}px`;
    }
  }

  function _updateAdvancedBodyHeight() {
    if (advancedBody?.classList.contains('is-open')) {
      advancedBody.style.maxHeight = `${advancedBody.scrollHeight}px`;
    }
    _updateFiltersBodyHeight();
  }

  function _updateToggleTexts() {
    if (filtersToggle) {
      const expanded = filtersToggle.getAttribute('aria-expanded') === 'true';
      filtersToggle.classList.toggle('is-expanded', expanded);
      filtersToggle.setAttribute('aria-label', expanded ? t('filters_collapse') : t('filters_expand'));
      if (filtersHeader) filtersHeader.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    }
    if (advancedToggle) {
      const expanded = advancedToggle.getAttribute('aria-expanded') === 'true';
      advancedToggle.textContent = expanded ? t('filters_hide_advanced') : t('filters_show_advanced');
    }
  }

  function _updateApplyControls() {
    if (autoApplyToggle) {
      autoApplyToggle.setAttribute('aria-pressed', autoApply ? 'true' : 'false');
      autoApplyToggle.textContent = autoApply ? t('filters_auto_apply_on') : t('filters_auto_apply_off');
    }

    if (applyFiltersBtn) {
      applyFiltersBtn.textContent = t('filters_apply');
      applyFiltersBtn.disabled = !pending || applyInFlight;
    }

    if (filtersPendingEl) {
      filtersPendingEl.textContent = t('filters_pending');
      filtersPendingEl.classList.toggle('hidden', !pending);
    }
  }

  function _formatCount(value) {
    const locale = getLang() === 'ru' ? 'ru-RU' : 'en-US';
    const n = Number(value);
    if (!Number.isFinite(n)) return '0';
    if (n >= 1000) {
      return new Intl.NumberFormat(locale, {
        notation: 'compact',
        maximumFractionDigits: 1,
      }).format(n);
    }
    return n.toLocaleString(locale);
  }

  function _renderPreview() {
    if (!filtersPreviewEl) return;

    filtersPreviewEl.classList.remove('is-loading', 'is-low', 'is-unavailable');

    if (previewState.phase === 'loading') {
      filtersPreviewEl.textContent = t('filters_preview_loading_short');
      filtersPreviewEl.classList.add('is-loading');
      if (relaxFiltersBtn) relaxFiltersBtn.classList.add('hidden');
      return;
    }

    if (previewState.unavailable) {
      filtersPreviewEl.textContent = '';
      if (relaxFiltersBtn) relaxFiltersBtn.classList.add('hidden');
      return;
    }

    if (previewState.estimatedTotal === null) {
      filtersPreviewEl.textContent = '';
      if (relaxFiltersBtn) relaxFiltersBtn.classList.add('hidden');
      return;
    }

    const countText = _formatCount(previewState.estimatedTotal);
    const summaryText = t('filters_pool_tmdb').replace('{count}', countText);

    if (previewState.estimatedTotal <= 0) {
      filtersPreviewEl.textContent = t('filters_no_matches');
      filtersPreviewEl.classList.add('is-low');
    } else if (previewState.lowResults) {
      filtersPreviewEl.textContent = `${summaryText} ${t('filters_preview_low_short')}`;
      filtersPreviewEl.classList.add('is-low');
    } else {
      filtersPreviewEl.textContent = summaryText;
    }

    const showRelax = _hasActiveCriteria()
      && (previewState.lowResults || previewState.estimatedTotal <= 0);
    if (relaxFiltersBtn) {
      relaxFiltersBtn.textContent = t('filters_relax');
      relaxFiltersBtn.classList.toggle('hidden', !showRelax);
    }
  }

  function _saveFilters() {
    try {
      localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify({
        ..._criteriaSnapshot(),
        filters_open: filtersBody.classList.contains('is-open'),
        advanced_open: advancedBody.classList.contains('is-open'),
        auto_apply: autoApply,
      }));
    } catch (_) {}
  }

  function _recomputePending() {
    pending = _criteriaHash() !== appliedCriteriaHash;
    _updateApplyControls();
  }

  function _scheduleAutoApply() {
    if (autoApplyTimer) clearTimeout(autoApplyTimer);
    if (!autoApply || !pending || typeof applyHandler !== 'function') return;

    autoApplyTimer = setTimeout(() => {
      void applyNow();
    }, 420);
  }

  function _schedulePreview() {
    if (previewTimer) clearTimeout(previewTimer);
    previewState = {
      phase: 'loading',
      estimatedTotal: null,
      lowResults: false,
      unavailable: false,
    };
    _renderPreview();
    previewTimer = setTimeout(() => {
      void requestPreview();
    }, 260);
  }

  function _handleFilterChange({ clearPresets = true, clearMood = true } = {}) {
    if (clearPresets) _clearPresetHighlights();
    if (clearMood) _clearMoodVisual();
    _recomputePending();
    _saveFilters();
    _schedulePreview();
    _scheduleAutoApply();
  }

  function initDefaults() {
    ratingMin.min = 1.0;
    ratingMin.max = 9.0;
    ratingMin.step = 0.1;
    ratingMin.value = 1.0;

    yrMin.max = String(YEAR_MAX);
    yrMax.max = String(YEAR_MAX);
    yrMin.value = String(YEAR_MIN);
    yrMax.value = String(YEAR_MAX);
    _setRuntime(null, null);
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
    return Array.from(selectedCountries).join('|');
  }

  function snapshotFilters() {
    return {
      ..._criteriaSnapshot(),
      filters_open: filtersBody.classList.contains('is-open'),
      advanced_open: advancedBody.classList.contains('is-open'),
      auto_apply: autoApply,
    };
  }

  function saveFilters() {
    _saveFilters();
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
      const restoredRuntimeMin = Number.parseInt(String(parsed.runtime_min ?? ''), 10);
      const restoredRuntimeMax = Number.parseInt(String(parsed.runtime_max ?? ''), 10);
      _setRuntime(
        Number.isFinite(restoredRuntimeMin) ? clamp(restoredRuntimeMin, 1, 500) : null,
        Number.isFinite(restoredRuntimeMax) ? clamp(restoredRuntimeMax, 1, 500) : null,
      );

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
      savedAdvancedOpen = parsed.advanced_open === true;
      autoApply = parsed.auto_apply !== false;
    } catch (_) {}
  }

  function isSavedFiltersOpen() {
    return savedFiltersOpen;
  }

  function isSavedAdvancedOpen() {
    return savedAdvancedOpen;
  }

  function clearActivePresets() {
    _clearPresetHighlights();
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
    _setRuntime(null, null);
    syncYearRange();
    updateRatingThumb();

    _clearPresetHighlights();
    if (presetKey === 'popular') presetPopularBtn.classList.add('is-active');
    if (presetKey === 'top') presetTopBtn.classList.add('is-active');
    if (presetKey === 'recent') presetRecentBtn.classList.add('is-active');

    _handleFilterChange({ clearPresets: false });
  }

  function openFilters() {
    filtersBody.classList.add('is-open');
    filtersBody.style.maxHeight = '0px';
    requestAnimationFrame(() => {
      filtersBody.style.maxHeight = `${filtersBody.scrollHeight}px`;
    });
    filtersToggle.setAttribute('aria-expanded', 'true');
    _updateToggleTexts();
    _saveFilters();
  }

  function closeFilters() {
    filtersBody.style.maxHeight = '0px';
    filtersBody.classList.remove('is-open');
    filtersToggle.setAttribute('aria-expanded', 'false');
    _updateToggleTexts();
    _saveFilters();
  }

  function openAdvanced() {
    advancedBody.classList.add('is-open');
    advancedBody.style.maxHeight = '0px';
    requestAnimationFrame(() => {
      advancedBody.style.maxHeight = `${advancedBody.scrollHeight}px`;
      _updateFiltersBodyHeight();
    });
    advancedToggle.setAttribute('aria-expanded', 'true');
    _updateToggleTexts();
    _saveFilters();
  }

  function closeAdvanced() {
    advancedBody.style.maxHeight = '0px';
    advancedBody.classList.remove('is-open');
    advancedToggle.setAttribute('aria-expanded', 'false');
    _updateToggleTexts();
    _updateFiltersBodyHeight();
    _saveFilters();
  }

  function toggleAdvanced() {
    const expanded = advancedToggle.getAttribute('aria-expanded') === 'true';
    if (expanded) closeAdvanced();
    else openAdvanced();
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
      _handleFilterChange();
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
      _handleFilterChange();
    });

    update();
    return btn;
  }

  function loadCountries() {
    const wrap = document.getElementById('countryChips');
    if (!wrap) return;
    wrap.innerHTML = '';
    countriesList.forEach((country) => wrap.appendChild(renderCountryChip(country)));
    _updateFiltersBodyHeight();
  }

  async function loadGenres() {
    const isRU = getLang() === 'ru';
    const url = isRU
      ? '/api/genres_ru'
      : `/api/genres?lang=${encodeURIComponent(langMap[getLang()])}`;

    const wrap = document.getElementById('genreChips');
    if (!wrap) return;
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

    genreIdByName.clear();
    list.forEach((genre) => {
      genreIdByName.set(_normalizeGenreName(genre.name), String(genre.id));
    });

    const preferred = new Set(genreSelectionSeed.size ? genreSelectionSeed : selectedGenres);
    selectedGenres.clear();

    list.forEach((g) => {
      const id = String(g.id);
      if (preferred.has(id)) selectedGenres.add(id);
      wrap.appendChild(renderGenreChip(g));
    });

    genreSelectionSeed = new Set(selectedGenres);
    _saveFilters();
    _updateAdvancedBodyHeight();
  }

  function clearSelections() {
    selectedGenres.clear();
    selectedCountries.clear();
    genreSelectionSeed = new Set();
    _clearMoodVisual();
    _recomputePending();
    _saveFilters();
  }

  async function resetFilters() {
    yrMin.value = String(YEAR_MIN);
    yrMax.value = String(YEAR_MAX);
    ratingMin.value = '1.0';
    _setRuntime(null, null);
    selectedGenres.clear();
    selectedCountries.clear();
    genreSelectionSeed = new Set();

    syncYearRange();
    updateRatingThumb();
    _clearPresetHighlights();

    loadCountries();
    await loadGenres();
    _handleFilterChange({ clearPresets: false, clearMood: true });
  }

  function handleYearMinInput() {
    yrMin.value = String(clamp(toYear(yrMin.value, YEAR_MIN), YEAR_MIN, YEAR_MAX));
    if (toYear(yrMin.value, YEAR_MIN) > toYear(yrMax.value, YEAR_MAX)) yrMax.value = yrMin.value;
    syncYearRange();
    _handleFilterChange();
  }

  function handleYearMaxInput() {
    yrMax.value = String(clamp(toYear(yrMax.value, YEAR_MAX), YEAR_MIN, YEAR_MAX));
    if (toYear(yrMax.value, YEAR_MAX) < toYear(yrMin.value, YEAR_MIN)) yrMin.value = yrMax.value;
    syncYearRange();
    _handleFilterChange();
  }

  function handleRatingInput() {
    updateRatingThumb();
    _handleFilterChange();
  }

  function handleRuntimePreset(minValue, maxValue) {
    _setRuntime(minValue, maxValue);
    _handleFilterChange();
  }

  function getRuntimeRange() {
    return { min: runtimeMin, max: runtimeMax };
  }

  function applyMood(moodKey) {
    const profile = MOOD_PROFILES[moodKey];
    if (!profile) return;

    const targets = getLang() === 'ru' ? profile.genresRu : profile.genresEn;
    const moodGenreIds = targets
      .map((name) => genreIdByName.get(_normalizeGenreName(name)))
      .filter(Boolean);

    selectedGenres.clear();
    moodGenreIds.forEach((id) => selectedGenres.add(id));
    genreSelectionSeed = new Set(selectedGenres);
    _syncGenreVisualState();

    yrMin.value = String(Math.max(YEAR_MIN, profile.yearFrom));
    yrMax.value = String(Math.min(YEAR_MAX, profile.yearTo));
    ratingMin.value = String(profile.rating);
    _setRuntime(profile.runtimeMin, profile.runtimeMax);
    syncYearRange();
    updateRatingThumb();

    _clearPresetHighlights();
    _setActiveMoodVisual(moodKey);
    _handleFilterChange({ clearPresets: false, clearMood: false });
  }

  function setAutoApply(nextValue) {
    autoApply = Boolean(nextValue);
    _updateApplyControls();
    _saveFilters();
    if (autoApply && pending) _scheduleAutoApply();
  }

  function toggleAutoApply() {
    setAutoApply(!autoApply);
  }

  function isAutoApplyEnabled() {
    return autoApply;
  }

  function setApplyHandler(handler) {
    applyHandler = typeof handler === 'function' ? handler : null;
    if (autoApply && pending) _scheduleAutoApply();
  }

  async function applyNow() {
    if (!pending || applyInFlight || typeof applyHandler !== 'function') return false;
    applyInFlight = true;
    _updateApplyControls();
    try {
      const ok = await applyHandler();
      if (ok) {
        markApplied();
        return true;
      }
      return false;
    } finally {
      applyInFlight = false;
      _updateApplyControls();
      if (autoApply && pending) _scheduleAutoApply();
    }
  }

  function markApplied() {
    appliedCriteriaHash = _criteriaHash();
    pending = false;
    _updateApplyControls();
    _saveFilters();
  }

  function relaxFilters() {
    const currentRating = Number.parseFloat(ratingMin.value) || 1;
    const { from, to } = getYearRange();

    let changed = false;
    if (runtimeMin !== null || runtimeMax !== null) {
      _setRuntime(null, null);
      changed = true;
    } else if (currentRating > 5.2) {
      ratingMin.value = String(Math.max(1, currentRating - 0.8));
      updateRatingThumb();
      changed = true;
    } else if (selectedGenres.size > 0) {
      selectedGenres.clear();
      genreSelectionSeed = new Set();
      loadGenres();
      changed = true;
    } else if (selectedCountries.size > 0) {
      selectedCountries.clear();
      loadCountries();
      changed = true;
    } else if (from > YEAR_MIN || to < YEAR_MAX) {
      yrMin.value = String(Math.max(YEAR_MIN, from - 12));
      yrMax.value = String(Math.min(YEAR_MAX, to + 12));
      syncYearRange();
      changed = true;
    }

    if (!changed) return;
    _clearPresetHighlights();
    _handleFilterChange({ clearPresets: false, clearMood: true });
  }

  async function requestPreview() {
    const seq = ++previewRequestSeq;
    const params = new URLSearchParams();
    const criteria = _criteriaSnapshot();
    params.set('year_from', String(criteria.year_from));
    params.set('year_to', String(criteria.year_to));
    if (criteria.runtime_min != null) params.set('runtime_min', String(criteria.runtime_min));
    if (criteria.runtime_max != null) params.set('runtime_max', String(criteria.runtime_max));
    params.set('vote_avg_min', String(criteria.vote_avg_min));
    if (criteria.genres.length) params.set('genres', selectedGenresQuery());
    if (criteria.countries.length) params.set('country', selectedCountriesQuery());
    if (typeof getExclusionsPayload === 'function') {
      const exclusions = getExclusionsPayload();
      if (Array.isArray(exclusions?.tmdb) && exclusions.tmdb.length) {
        params.set('exclude_tmdb', exclusions.tmdb.join('|'));
      }
      if (Array.isArray(exclusions?.kp) && exclusions.kp.length) {
        params.set('exclude_kp', exclusions.kp.join('|'));
      }
    }

    const isRU = getLang() === 'ru';
    const url = isRU
      ? `/api/filters_preview_ru?${params.toString()}`
      : `/api/filters_preview?${params.toString()}&lang=${encodeURIComponent(langMap[getLang()])}`;

    try {
      const { ok, data } = await getJson(url, { cache: 'no-store' });
      if (seq !== previewRequestSeq) return;
      if (!ok || !data || data.unavailable) {
        previewState = {
          phase: 'done',
          estimatedTotal: null,
          lowResults: false,
          unavailable: true,
        };
        _renderPreview();
        return;
      }

      const total = Number.parseInt(String(data.estimated_total ?? ''), 10);
      previewState = {
        phase: 'done',
        estimatedTotal: Number.isFinite(total) ? Math.max(0, total) : null,
        lowResults: data.low_results === true || total <= 0,
        unavailable: false,
      };
      _renderPreview();
    } catch (_) {
      if (seq !== previewRequestSeq) return;
      previewState = {
        phase: 'done',
        estimatedTotal: null,
        lowResults: false,
        unavailable: true,
      };
      _renderPreview();
    }
  }

  function refreshAfterLanguageChange() {
    _updateToggleTexts();
    _updateApplyControls();
    _renderPreview();
    _schedulePreview();
  }

  function finalizeInitState() {
    appliedCriteriaHash = _criteriaHash();
    pending = false;
    _updateToggleTexts();
    _updateApplyControls();
    _schedulePreview();
  }

  function applyTranslations() {
    _updateToggleTexts();
    _updateApplyControls();
    _renderPreview();
  }

  return {
    initDefaults,
    syncYearRange,
    getYearRange,
    updateRatingThumb,
    selectedGenresQuery,
    selectedCountriesQuery,
    snapshotFilters,
    saveFilters,
    restoreFilters,
    isSavedFiltersOpen,
    isSavedAdvancedOpen,
    clearActivePresets,
    applyPreset,
    openFilters,
    closeFilters,
    openAdvanced,
    closeAdvanced,
    toggleAdvanced,
    loadCountries,
    loadGenres,
    clearSelections,
    resetFilters,
    handleYearMinInput,
    handleYearMaxInput,
    handleRatingInput,
    handleRuntimePreset,
    getRuntimeRange,
    applyMood,
    setAutoApply,
    toggleAutoApply,
    isAutoApplyEnabled,
    setApplyHandler,
    applyNow,
    markApplied,
    relaxFilters,
    requestPreview,
    refreshAfterLanguageChange,
    finalizeInitState,
    applyTranslations,
  };
}
