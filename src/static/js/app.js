import { I18N, langMap } from './modules/i18n.js';
import { getJson } from './modules/http.js';

const ratingMin = document.getElementById('ratingMin');
const ratingVal = document.getElementById('ratingVal');

ratingMin.min = 1.0;
ratingMin.max = 9.0;
ratingMin.step = 0.1;
ratingMin.value = 1.0;


const YEAR_MIN = 1900;
const YEAR_MAX = Math.max(YEAR_MIN, new Date().getFullYear());
const yrMin = document.getElementById('yrMin');
const yrMax = document.getElementById('yrMax');
const yrFill = document.getElementById('yrFill');
const yrTrack = document.getElementById('yrTrack');
const yrMinBadge = document.getElementById('yrMinBadge');
const yrMaxBadge = document.getElementById('yrMaxBadge');

function clamp(v, a, b){ return Math.min(b, Math.max(a, v)); }
function toYear(value, fallback){
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

yrMin.max = String(YEAR_MAX);
yrMax.max = String(YEAR_MAX);
yrMin.value = String(clamp(toYear(yrMin.value, YEAR_MIN), YEAR_MIN, YEAR_MAX));
yrMax.value = String(clamp(toYear(yrMax.value, YEAR_MAX), YEAR_MIN, YEAR_MAX));
if (toYear(yrMax.value, YEAR_MAX) < toYear(yrMin.value, YEAR_MIN)) {
  yrMax.value = yrMin.value;
}

function syncYearRange(){
  let a = toYear(yrMin.value, YEAR_MIN);
  let b = toYear(yrMax.value, YEAR_MAX);

  if (a > b){
    const mid = Math.round((a + b) / 2);
    a = b = mid;
    yrMin.value = a;
    yrMax.value = b;
  }

  const span = Math.max(1, YEAR_MAX - YEAR_MIN);
  const pA = (a - YEAR_MIN) / span;
  const pB = (b - YEAR_MIN) / span;

  yrFill.style.left  = (pA * 100) + '%';
  yrFill.style.right = ((1 - pB) * 100) + '%';

  const wrapRect  = yrTrack.parentElement.getBoundingClientRect();
  const trackRect = yrTrack.getBoundingClientRect();
  const trackLeft = trackRect.left - wrapRect.left;
  const trackW    = trackRect.width;

  const place = (badge, pct, text) => {
    badge.textContent = text;
    const w = badge.offsetWidth || 28;
    const xCenter = trackLeft + trackW * pct;
    const pad = 6;
    const min = w / 2 + pad;
    const max = wrapRect.width - w / 2 - pad;
    const clamped = Math.min(max, Math.max(min, xCenter));
    badge.style.left = clamped + 'px';
  };
  place(yrMinBadge, pA, a);
  place(yrMaxBadge, pB, b);
}

yrMin.addEventListener('input',()=>{ yrMin.value=clamp(toYear(yrMin.value,YEAR_MIN),YEAR_MIN,YEAR_MAX); if(toYear(yrMin.value,YEAR_MIN)>toYear(yrMax.value,YEAR_MAX)) yrMax.value=yrMin.value; syncYearRange(); });
yrMax.addEventListener('input',()=>{ yrMax.value=clamp(toYear(yrMax.value,YEAR_MAX),YEAR_MIN,YEAR_MAX); if(toYear(yrMax.value,YEAR_MAX)<toYear(yrMin.value,YEAR_MIN)) yrMin.value=yrMax.value; syncYearRange(); });
window.addEventListener('resize',syncYearRange);
syncYearRange();
function getYearRange(){ return { from: toYear(yrMin.value, YEAR_MIN), to: toYear(yrMax.value, YEAR_MAX) }; }

const selected=new Set();
const RU_ALLOWED_GENRES = new Set([
  'боевик','приключения','мультфильм','комедия','криминал',
  'документальный','драма','семейный','фэнтези','история',
  'ужасы','музыка','детектив','мелодрама','фантастика',
  'триллер','военный','вестерн'
]);
function renderGenreChip(genre){
  const btn=document.createElement('button');
  btn.type='button'; btn.dataset.id=genre.id;
  const base='px-3 py-1.5 rounded-full border border-zinc-700 bg-zinc-800/60 hover:bg-zinc-700/60 transition text-sm';
  function update(){ btn.className=selected.has(String(genre.id))?base+' bg-sky-400 text-black border-sky-400':base; }
  const disp = (getLang()==='ru' && genre.name)
    ? genre.name.slice(0,1).toUpperCase() + genre.name.slice(1)
    : genre.name;
  btn.textContent = disp;
  btn.addEventListener('click',()=>{const id=String(genre.id);selected.has(id)?selected.delete(id):selected.add(id);update();});
  update(); return btn;
}

async function loadGenres(){
  const isRU = getLang() === 'ru';
  const url = isRU
    ? '/api/genres_ru'
    : `/api/genres?lang=${encodeURIComponent(langMap[getLang()])}`;

  let raw;
  try {
    const { ok, status, data } = await getJson(url, { cache: 'no-store' });
    if (!ok) throw new Error(`Genres HTTP ${status}`);
    raw = data;
  } catch (e) {
    console.error('Failed to load genres:', e);
    raw = [];
  }

  const arr = Array.isArray(raw)
    ? raw
    : (Array.isArray(raw?.docs) ? raw.docs
       : (Array.isArray(raw?.genres) ? raw.genres : []));

  let list = arr.map(g => {
      if ('id' in g && 'name' in g)  return { id: String(g.id),   name: g.name };
      if ('slug' in g && 'name' in g) return { id: String(g.slug), name: g.name };
      const name = g?.name ?? String(g);
      return { id: name, name };
    });

    if (getLang() === 'ru') {
      list = list.filter(g => RU_ALLOWED_GENRES.has(String(g.name).toLowerCase()));
    }


  const wrap = document.getElementById('genreChips');
  wrap.innerHTML = '';
  selected.clear();

  list.forEach(g => wrap.appendChild(renderGenreChip(g)));

  if (filtersBody.classList.contains('is-open')) {
    requestAnimationFrame(() => {
      filtersBody.style.maxHeight = filtersBody.scrollHeight + 'px';
    });
  }
}

function selectedGenres(){ return Array.from(selected).join('|'); }

let currentMovie = null; // {tmdb_id?, kp_id?, imdb_id?}

function renderCard(data){
  const resultEl = document.getElementById('result');
  const cardEl   = resultEl.querySelector('.result-card');
  resultEl.classList.remove('hidden');
  if (cardEl) { cardEl.classList.remove('animate-in'); void cardEl.offsetWidth; cardEl.classList.add('animate-in'); }

  document.getElementById('title').textContent = `${data.title} (${data.year || '—'})`;

  const metaEl = document.getElementById('meta');
  metaEl.innerHTML = '';
  if (Array.isArray(data.genres) && data.genres.length) {
    const genresEl = document.createElement('div');
    genresEl.textContent = data.genres.join(' · ');
    metaEl.appendChild(genresEl);
  }
  if (Array.isArray(data.countries) && data.countries.length) {
    const countriesEl = document.createElement('div');
    countriesEl.textContent = data.countries.join(', ');
    countriesEl.className = 'opacity-60 text-sm';
    metaEl.appendChild(countriesEl);
  }

  document.getElementById('overview').textContent = data.overview || '—';
  document.getElementById('poster').src = data.poster || '';

  const kpEl   = document.getElementById('kpRating');
  const imdbEl = document.getElementById('imdbRating');
  const tmdbEl = document.getElementById('tmdbRating');
  const fmt1 = (x) => { const n = Number.parseFloat(x); return Number.isFinite(n) ? n.toFixed(1) : '–'; };

  if (kpEl) {
    if (getLang() === 'ru' && data.kp_rating) {
      const votesNum = Number.parseInt(String(data.kp_votes || '').replace(/[, ]/g,''), 10);
      const votesTxt = Number.isFinite(votesNum) ? ` (${votesNum.toLocaleString('ru-RU')})` : '';
      const kpLabel = data.kp_url
        ? `<a href="${data.kp_url}" target="_blank" rel="noopener" class="underline hover:no-underline">Кинопоиск</a>`
        : `<span>Кинопоиск</span>`;
      kpEl.innerHTML = `<span class="text-orange-400" aria-hidden="true">★</span> ${kpLabel}: <b>${fmt1(data.kp_rating)}</b>${votesTxt}`;
      kpEl.classList.remove('hidden');
    } else { kpEl.classList.add('hidden'); kpEl.innerHTML = ''; }
  }

  if (imdbEl) {
    if (data.imdb_url && data.imdb_rating) {
      const votesNum = Number.parseInt(String(data.imdb_votes || '').replace(/[, ]/g,''), 10);
      const votesTxt = Number.isFinite(votesNum) ? ` (${votesNum.toLocaleString('en-US')})` : '';
      imdbEl.innerHTML =
        `<span class="text-yellow-400" aria-hidden="true">★</span>
         <a href="${data.imdb_url}" target="_blank" rel="noopener" class="underline hover:no-underline">IMDb</a>:
         <b>${fmt1(data.imdb_rating)}</b>${votesTxt}`;
      imdbEl.classList.remove('hidden');
    } else { imdbEl.classList.add('hidden'); imdbEl.innerHTML = ''; }
  }

  if (tmdbEl) {
    if (data.tmdb_url) {
      tmdbEl.innerHTML =
        `<a href="${data.tmdb_url}" target="_blank" rel="noopener" class="underline hover:no-underline">TMDb</a>:
         ${fmt1(data.tmdb_vote)}`;
      tmdbEl.classList.remove('hidden');
    } else { tmdbEl.classList.add('hidden'); tmdbEl.innerHTML = ''; }
  }

  const ratingsRow = document.querySelector('#ratings .flex');
  if (ratingsRow) {
    ratingsRow.querySelectorAll('.sep-dot').forEach(n => n.remove());
    const visible = [kpEl, imdbEl, tmdbEl].filter(el => el && !el.classList.contains('hidden'));
    for (let i = 1; i < visible.length; i++) {
      const dot = document.createElement('span');
      dot.className = 'sep-dot opacity-50 mx-0.5 select-none text-xs';
      dot.textContent = '•';
      visible[i - 1].after(dot);
    }
  }
}

async function reloadCurrentInNewLang(){
  if (!currentMovie) return;
  const lang = getLang();

  try {
    if (lang === 'ru') {
      if (currentMovie.kp_id) {
        const { data } = await getJson(`/api/movie_ru?id=${encodeURIComponent(currentMovie.kp_id)}`);
        if (!data.error) { renderCard(data); return; }
      }

      let mapUrl = null;
      if (currentMovie.tmdb_id) {
        mapUrl = `/api/movie_ru_by_external?tmdb_id=${encodeURIComponent(currentMovie.tmdb_id)}`;
      } else if (currentMovie.imdb_id) {
        mapUrl = `/api/movie_ru_by_external?imdb_id=${encodeURIComponent(currentMovie.imdb_id)}`;
      }

      if (mapUrl) {
        const { data } = await getJson(mapUrl);
        if (!data.error) {
          if (data.kp_id) currentMovie.kp_id = data.kp_id;
          renderCard(data);
          return;
        }
      }
      return;
    } else {
      if (currentMovie.tmdb_id) {
        const { data } = await getJson(`/api/movie?tmdb_id=${encodeURIComponent(currentMovie.tmdb_id)}&lang=${encodeURIComponent(langMap[lang])}`);
        if (!data.error) { renderCard(data); return; }
      }
    }
  } catch (e) {
    console.warn('re-render in new lang failed', e);
  }
}

async function spin(){
  const btn = document.getElementById('spin');

  btn.classList.remove('btn-press'); void btn.offsetWidth;
  btn.classList.add('btn-press','reel-mode','is-loading');
  btn.innerHTML = `<span class="dice"><img src="/img/endurance.png" alt="Endurance" /></span> <span class="label">${t('btn_spin')}</span>`;
  const dice = btn.querySelector('.dice');
  if (dice){ const dir = Math.random()<0.5?'spin-left':'spin-right'; dice.classList.add(dir); btn.dataset.spinDir=dir; }

  try {
    const params = new URLSearchParams();
    const { from, to } = getYearRange();
    params.set('year_from', from);
    params.set('year_to', to);
    const g = selectedGenres(); if (g) params.set('genres', g);
    const c = selectedCountriesQuery(); if (c) params.set('country', c);
    params.set('vote_avg_min', ratingMin.value);

    const isRU = (getLang()==='ru');
    const url = isRU
      ? `/api/random_ru?${params.toString()}`
      : `/api/random?${params.toString()}&lang=${encodeURIComponent(langMap[getLang()])}`;

    const { ok, data } = await getJson(url);
    if (!ok || data?.error){ alert(data?.error || 'Something went wrong. Try again.'); return; }

    currentMovie = {
      tmdb_id: data.tmdb_id || null,
      kp_id:   data.kp_id   || null,
      imdb_id: data.imdb_id || null
    };

    renderCard(data);
  } catch (e) {
    console.error(e); alert('Something went wrong. Try again.');
  } finally {
    const dir = btn.dataset.spinDir;
    if (dir){ const d = btn.querySelector('.dice'); if (d) d.classList.remove(dir); delete btn.dataset.spinDir; }
    btn.classList.remove('is-loading');
    setTimeout(() => {
      btn.classList.remove('reel-mode');
      btn.innerHTML = `<span class="dice"><img src="/img/endurance.png" alt="Endurance" /></span> <span class="label">${t('btn_spin')}</span>`;
    }, 100);
  }
}

document.getElementById('spin').addEventListener('click',spin);
const langSelect = document.getElementById('langSwitch');
const filtersToggle = document.getElementById('filtersToggle');
const filtersBody   = document.getElementById('filtersBody');
const publicConfig = { ru_enabled: true };

function isRuEnabled() {
  return publicConfig.ru_enabled !== false;
}

async function loadPublicConfig() {
  try {
    const { ok, data: cfg } = await getJson('/api/config', { cache: 'no-store' });
    if (!ok) return;
    if (typeof cfg?.ru_enabled === 'boolean') {
      publicConfig.ru_enabled = cfg.ru_enabled;
    }
  } catch (_) {}
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

function getLang(){
  const preferred = localStorage.getItem('fs_lang')
      || (navigator.language.startsWith('ru') ? 'ru' : 'en');
  if (preferred === 'ru' && !isRuEnabled()) return 'en';
  return preferred;
}
function setLang(v){ localStorage.setItem('fs_lang', v); }
function t(key){
  const L = getLang();
  return (I18N[L] && I18N[L][key]) || (I18N.en[key] || key);
}

function applyStaticTranslations(){
    document.getElementById('slogan').textContent = t('slogan');
    document.getElementById('filtersTitle').textContent = t('filters');
    document.getElementById('yearRangeLabel').textContent = t('year_range');
    document.getElementById('countriesLabel').textContent = t('countries');
    document.getElementById('genresLabel').textContent = t('genres');
    document.getElementById('minRatingLabel').textContent = t('min_rating');
    const btn = document.getElementById('spin');
    if (btn.classList.contains('is-loading')) {
      const label = btn.querySelector('.label');
      if (label) label.textContent = t('btn_spin');
    } else {
      btn.innerHTML = `<span class="dice"><img src="/img/endurance.png" alt="Endurance" /></span> <span class="label">${t('btn_spin')}</span>`;
    }
    const expanded = filtersToggle.getAttribute('aria-expanded') === 'true';
    filtersToggle.textContent = expanded ? t('hide') : t('show');
    const footerData = document.getElementById('footerData');
    if (footerData) footerData.textContent = t('data_source');

    const footerBy = document.getElementById('footerBy');
    if (footerBy) {
    footerBy.innerHTML = `${t('by')} <a href="https://t.me/miroshnikov" class="underline hover:no-underline">Sergey Miroshnikov</a>`;
    }

    const footerTerms = document.getElementById('footerTerms');
    if (footerTerms) footerTerms.textContent = t('terms');
}

function openFilters(){
  filtersBody.classList.add('is-open');
  filtersBody.style.maxHeight = '0px';
  requestAnimationFrame(() => {
    filtersBody.style.maxHeight = filtersBody.scrollHeight + 'px';
  });
  filtersToggle.setAttribute('aria-expanded','true');
  filtersToggle.textContent = t('hide');
}

function closeFilters(){
  filtersBody.style.maxHeight = '0px';
  filtersBody.classList.remove('is-open');
  filtersToggle.setAttribute('aria-expanded','false');
  filtersToggle.textContent = t('show');
}

const countriesList = [
  { code: "US", name_en: "United States",  name_ru: "США" },
  { code: "GB", name_en: "United Kingdom", name_ru: "Великобритания" },
  { code: "FR", name_en: "France",         name_ru: "Франция" },
  { code: "DE", name_en: "Germany",        name_ru: "Германия" },
  { code: "IT", name_en: "Italy",          name_ru: "Италия" },
  { code: "ES", name_en: "Spain",          name_ru: "Испания" },
  { code: "IN", name_en: "India",          name_ru: "Индия" },
  { code: "JP", name_en: "Japan",          name_ru: "Япония" },
  { code: "KR", name_en: "South Korea",    name_ru: "Корея Южная" },
  { code: "RU", name_en: "Russia",         name_ru: "Россия" },
  { code: "CN", name_en: "China",          name_ru: "Китай" },
  { code: "SU", name_en: "USSR",           name_ru: "СССР" }
];

const selectedCountries = new Set();

function renderCountryChip(country) {
  const btn = document.createElement('button');
  btn.type = 'button';

  const id = country.code;
  btn.dataset.id = id;
  const label = (getLang()==='ru') ? country.name_ru : country.name_en;

  const base = 'px-3 py-1.5 rounded-full border border-zinc-700 bg-zinc-800/60 hover:bg-zinc-700/60 transition text-sm';
  function update() {
    btn.className = selectedCountries.has(id)
      ? base + ' bg-emerald-400 text-black border-emerald-400'
      : base;
  }
  btn.textContent = label;
  btn.addEventListener('click', () => {
    if (selectedCountries.has(id)) selectedCountries.delete(id);
    else selectedCountries.add(id);
    update();
  });
  update();
  return btn;
}

function loadCountries() {
  const wrap = document.getElementById('countryChips');
  wrap.innerHTML = '';
  countriesList.forEach(c => wrap.appendChild(renderCountryChip(c)));
}

function selectedCountriesQuery() {
  return Array.from(selectedCountries).join(',');
}

function valueToColor(val) {
  const min = 1.0, max = 9.0;
  const ratio = (val - min) / (max - min);
  let r, g;

  if (ratio < 0.68) {
    r = 239;
    g = Math.round(68 + (180 - 68) * (ratio / 0.68));
  } else {
    r = Math.round(250 - (250 - 16) * ((ratio - 0.68) / 0.22472));
    g = Math.round(200 + (239 - 200) * ((ratio - 0.68) / 0.22472));
  }
  return `rgb(${r},${g},64)`;
}

function updateRatingThumb() {
  const val = parseFloat(ratingMin.value);
  const min = parseFloat(ratingMin.min);
  const max = parseFloat(ratingMin.max);
  const ratio = (val - min) / (max - min);

  const color = valueToColor(val);

  ratingMin.style.setProperty('--thumb-color', color);
  ratingMin.style.background = `linear-gradient(to right, ${color} ${ratio*100}%, #3f3f46 ${ratio*100}%)`;

  ratingVal.textContent = val.toFixed(1);
}

ratingMin.addEventListener('input', updateRatingThumb);
updateRatingThumb();

filtersToggle.addEventListener('click', () => {
  const expanded = filtersToggle.getAttribute('aria-expanded') === 'true';
  if (expanded) closeFilters(); else openFilters();
});

const ro = new ResizeObserver(() => {
  if (filtersBody.classList.contains('is-open')) {
    filtersBody.style.maxHeight = filtersBody.scrollHeight + 'px';
  }
});
ro.observe(filtersBody);

(async function initApp(){
  await loadPublicConfig();
  applyLanguageAvailability();

  const cur = getLang();
  langSelect.value = cur;
  applyStaticTranslations();

  langSelect.addEventListener('change', async () => {
    if (langSelect.value === 'ru' && !isRuEnabled()) {
      langSelect.value = 'en';
    }
    setLang(langSelect.value);
    applyStaticTranslations();
    selected.clear();
    selectedCountries.clear();
    loadCountries();
    await loadGenres();
    await reloadCurrentInNewLang();
  });

  loadCountries();
  closeFilters();
  await loadGenres();
})();
