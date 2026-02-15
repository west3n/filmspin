export const FILTERS_STORAGE_KEY = 'fs_filters_v2';
export const YEAR_MIN = 1900;
export const YEAR_MAX = Math.max(YEAR_MIN, new Date().getFullYear());

export const RU_ALLOWED_GENRES = new Set([
  'боевик', 'приключения', 'мультфильм', 'комедия', 'криминал',
  'документальный', 'драма', 'семейный', 'фэнтези', 'история',
  'ужасы', 'музыка', 'детектив', 'мелодрама', 'фантастика',
  'триллер', 'военный', 'вестерн'
]);

export const countriesList = [
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
