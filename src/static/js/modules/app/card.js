import { toNamesList } from './helpers.js?v=1';

export function createCardController({ elements, deps }) {
  const { resultEl } = elements;
  const { getLang, t, getJson, langMap } = deps;

  let currentMovie = null;
  let actionHandlers = { watched: null, hide: null };

  function hideResultCard() {
    if (!resultEl) return;
    resultEl.classList.add('hidden');
    const cardEl = resultEl.querySelector('.result-card');
    if (cardEl) cardEl.classList.remove('animate-in');
  }

  function setCurrentMovieFromData(data) {
    currentMovie = {
      tmdb_id: data.tmdb_id || null,
      kp_id: data.kp_id || null,
      imdb_id: data.imdb_id || null,
      title: data.title || null,
    };
  }

  function clearCurrentMovie() {
    currentMovie = null;
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
    if (Number.isFinite(Number(data.runtime_minutes))) metaChunks.push(`${Number(data.runtime_minutes)} min`);
    metaEl.textContent = metaChunks.join('   •   ');

    const reasonRowEl = document.getElementById('reasonRow');
    reasonRowEl.textContent = data.recommendation_reason || t('card_reason_fallback');
    reasonRowEl.classList.remove('hidden');

    const peopleEl = document.getElementById('people');
    const directorRowEl = document.getElementById('directorRow');
    const castRowEl = document.getElementById('castRow');
    const directorLabelEl = document.getElementById('directorLabel');
    const castLabelEl = document.getElementById('castLabel');
    const directorValueEl = document.getElementById('directorValue');
    const castValueEl = document.getElementById('castValue');

    const directors = toNamesList(data.directors);
    const cast = toNamesList(data.cast);

    directorLabelEl.textContent = `${t('people_director')}:`;
    castLabelEl.textContent = `${t('people_cast')}:`;

    if (directors.length) {
      directorValueEl.textContent = directors.join(', ');
      directorRowEl.classList.remove('hidden');
    } else {
      directorValueEl.textContent = '';
      directorRowEl.classList.add('hidden');
    }

    if (cast.length) {
      castValueEl.textContent = cast.join(', ');
      castRowEl.classList.remove('hidden');
    } else {
      castValueEl.textContent = '';
      castRowEl.classList.add('hidden');
    }

    peopleEl.classList.toggle('hidden', directors.length === 0 && cast.length === 0);

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
      ratingsRow.querySelectorAll('.sep-dot').forEach((node) => node.remove());
      const visible = [kpEl, imdbEl].filter((el) => el && !el.classList.contains('hidden'));
      for (let i = 1; i < visible.length; i += 1) {
        const dot = document.createElement('span');
        dot.className = 'sep-dot opacity-50 select-none text-xs';
        dot.textContent = '•';
        visible[i - 1].after(dot);
      }
    }

    const watchRowEl = document.getElementById('watchRow');
    const providers = Array.isArray(data.watch_providers) ? data.watch_providers.filter(Boolean) : [];
    if (providers.length) {
      const label = t('watch_label');
      const providersText = providers.join(', ');
      if (data.watch_url) {
        watchRowEl.innerHTML = `${label}: ${providersText} · <a href="${data.watch_url}" target="_blank" rel="noopener" class="underline hover:no-underline">${t('watch_open')}</a>`;
      } else {
        watchRowEl.textContent = `${label}: ${providersText}`;
      }
      watchRowEl.classList.remove('hidden');
    } else {
      watchRowEl.classList.add('hidden');
      watchRowEl.textContent = '';
      watchRowEl.innerHTML = '';
    }

    const actionWatchedBtn = document.getElementById('actionWatched');
    const actionHideBtn = document.getElementById('actionHideMovie');
    actionWatchedBtn.textContent = t('action_watched');
    actionHideBtn.textContent = t('action_hide_movie');

    const payload = {
      tmdb_id: data.tmdb_id || null,
      kp_id: data.kp_id || null,
      imdb_id: data.imdb_id || null,
      title: data.title || null,
    };

    actionWatchedBtn.onclick = () => {
      if (typeof actionHandlers.watched === 'function') actionHandlers.watched(payload);
    };
    actionHideBtn.onclick = () => {
      if (typeof actionHandlers.hide === 'function') actionHandlers.hide(payload);
    };
  }

  function setActionHandlers(handlers = {}) {
    actionHandlers = {
      watched: typeof handlers.watched === 'function' ? handlers.watched : null,
      hide: typeof handlers.hide === 'function' ? handlers.hide : null,
    };
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

  return {
    hideResultCard,
    renderCard,
    setCurrentMovieFromData,
    clearCurrentMovie,
    setActionHandlers,
    reloadCurrentInNewLang,
  };
}
