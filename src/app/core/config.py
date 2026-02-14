from ..settings import get_settings

_settings = get_settings()

TMDB_API_KEY = _settings.tmdb_api_key
OMDB_API_KEY = _settings.omdb_api_key
KINOPOISK_API_KEY = _settings.kinopoisk_api_key

TMDB_BASE = _settings.tmdb_base
OMDB_BASE = _settings.omdb_base
KINO_BASE = _settings.kino_base

REDIS_URL = _settings.redis_url
CORS_ALLOW_ORIGINS = _settings.cors_origins_list

HTTP_CONNECT_TIMEOUT = _settings.http_connect_timeout
HTTP_READ_TIMEOUT = _settings.http_read_timeout
HTTP_WRITE_TIMEOUT = _settings.http_write_timeout
HTTP_POOL_TIMEOUT = _settings.http_pool_timeout
HTTP_MAX_CONNECTIONS = _settings.http_max_connections
HTTP_MAX_KEEPALIVE_CONNECTIONS = _settings.http_max_keepalive_connections

TTL_GENRES = _settings.ttl_genres
TTL_MOVIE_DETAIL = _settings.ttl_movie_detail
TTL_RECENT = _settings.ttl_recent
RECENT_LIMIT = _settings.recent_limit

RU_ENABLED = _settings.ru_enabled
