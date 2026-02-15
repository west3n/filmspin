const I18N = {
  en: {
    docTitle: 'FilmSpin — 404',
    title: 'You drifted off route.',
    subtitle: 'The page you are looking for does not exist, but your next movie still does.',
    homeBtn: 'Back Home',
    termsBtn: 'Terms',
    pickKicker: 'Lost & Found Pick',
    pickTitle: 'If you are already in deep space, try this one:',
    pickLink: 'Open movie page'
  },
  ru: {
    docTitle: 'FilmSpin — 404',
    title: 'Ты сбился с курса.',
    subtitle: 'Страница не найдена, но твой следующий фильм всё ещё ждёт тебя.',
    homeBtn: 'На главную',
    termsBtn: 'Условия',
    pickKicker: 'Фильм на спасение',
    pickTitle: 'Раз уж ты потерялся в космосе, попробуй этот фильм:',
    pickLink: 'Открыть страницу фильма'
  }
};

const LOST_MOVIES = [
  {
    en_title: 'Interstellar',
    ru_title: 'Интерстеллар',
    year: 2014,
    en_why: 'A mission beyond known coordinates, impossible decisions, and a race against time.',
    ru_why: 'Миссия за пределами известных координат, невозможный выбор и гонка со временем.',
    link: 'https://www.imdb.com/title/tt0816692/'
  },
  {
    en_title: 'The Martian',
    ru_title: 'Марсианин',
    year: 2015,
    en_why: 'One man is stranded on Mars and has to outsmart an entire planet to survive.',
    ru_why: 'Один человек остаётся на Марсе и вынужден переиграть целую планету, чтобы выжить.',
    link: 'https://www.imdb.com/title/tt3659388/'
  },
  {
    en_title: 'Gravity',
    ru_title: 'Гравитация',
    year: 2013,
    en_why: 'A single mistake in orbit turns into a brutal survival drift through space.',
    ru_why: 'Одна ошибка на орбите превращается в жестокую борьбу за выживание в открытом космосе.',
    link: 'https://www.imdb.com/title/tt1454468/'
  },
  {
    en_title: 'Cast Away',
    ru_title: 'Изгой',
    year: 2000,
    en_why: 'Isolation, time, and endurance become the only compass for the hero.',
    ru_why: 'Одиночество, время и выносливость становятся единственным компасом для героя.',
    link: 'https://www.imdb.com/title/tt0162222/'
  },
  {
    en_title: '127 Hours',
    ru_title: '127 часов',
    year: 2010,
    en_why: 'A real survival story where being lost means choosing life at any cost.',
    ru_why: 'Реальная история выживания, где потеряться — значит выбрать жизнь любой ценой.',
    link: 'https://www.imdb.com/title/tt1542344/'
  },
  {
    en_title: 'All Is Lost',
    ru_title: 'Не угаснет надежда',
    year: 2013,
    en_why: 'No map, no crew, no backup. Just one person and the open ocean.',
    ru_why: 'Без карты, без команды, без помощи. Только один человек и открытый океан.',
    link: 'https://www.imdb.com/title/tt2017038/'
  },
  {
    en_title: 'Life of Pi',
    ru_title: 'Жизнь Пи',
    year: 2012,
    en_why: 'Lost at sea, the hero survives through imagination, faith, and will.',
    ru_why: 'Потерявшись в океане, герой выживает благодаря воображению, вере и силе воли.',
    link: 'https://www.imdb.com/title/tt0454876/'
  },
  {
    en_title: 'The Revenant',
    ru_title: 'Выживший',
    year: 2015,
    en_why: 'A man abandoned in the wilderness fights through impossible terrain.',
    ru_why: 'Брошенный в дикой природе человек пробивается через невозможные условия.',
    link: 'https://www.imdb.com/title/tt1663202/'
  }
];

const langSelect = document.getElementById('langSwitch');
let selectedMovie = null;

function getLang() {
  return localStorage.getItem('fs_lang') || (navigator.language.startsWith('ru') ? 'ru' : 'en');
}

function setLang(value) {
  localStorage.setItem('fs_lang', value);
}

function t(key) {
  const lang = getLang();
  return (I18N[lang] && I18N[lang][key]) || (I18N.en[key] || key);
}

function applyTranslations() {
  const lang = getLang();
  document.documentElement.setAttribute('lang', lang);
  document.getElementById('docTitle').textContent = t('docTitle');
  document.getElementById('title').textContent = t('title');
  document.getElementById('subtitle').textContent = t('subtitle');
  document.getElementById('homeBtn').textContent = t('homeBtn');
  document.getElementById('termsBtn').textContent = t('termsBtn');
  document.getElementById('pickKicker').textContent = t('pickKicker');
  document.getElementById('pickTitle').textContent = t('pickTitle');
  document.getElementById('pickLink').textContent = t('pickLink');
  langSelect.value = lang;

  if (selectedMovie) {
    document.getElementById('pickMovieName').textContent =
      lang === 'ru' ? selectedMovie.ru_title : selectedMovie.en_title;
    document.getElementById('pickMeta').textContent = String(selectedMovie.year);
    document.getElementById('pickWhy').textContent =
      lang === 'ru' ? selectedMovie.ru_why : selectedMovie.en_why;
    document.getElementById('pickLink').href = selectedMovie.link;
  }
}

function pickRandomMovie() {
  if (!LOST_MOVIES.length) return null;
  const idx = Math.floor(Math.random() * LOST_MOVIES.length);
  return LOST_MOVIES[idx];
}

(function init() {
  selectedMovie = pickRandomMovie();
  langSelect.value = getLang();
  applyTranslations();
  langSelect.addEventListener('change', () => {
    setLang(langSelect.value);
    applyTranslations();
  });
})();
