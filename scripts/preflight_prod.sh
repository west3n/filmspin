#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env.prod}"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT_DIR/docker-compose.prod.yml}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[preflight] env file not found: $ENV_FILE"
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "[preflight] docker is not installed"
  exit 1
fi

required_vars=(
  DOMAIN
  ACME_EMAIL
  APP_IMAGE
  TMDB_API_KEY
  OMDB_API_KEY
)

get_effective_var() {
  local key="$1"
  local runtime_value="${!key-}"
  if [[ -n "${runtime_value// }" ]]; then
    printf "%s" "$runtime_value"
    return
  fi

  local file_value
  file_value="$(grep -E "^${key}=" "$ENV_FILE" | tail -n 1 | cut -d'=' -f2- || true)"
  printf "%s" "$file_value"
}

echo "[preflight] checking required env vars in $ENV_FILE"
missing=0
for key in "${required_vars[@]}"; do
  value="$(get_effective_var "$key")"
  if [[ -z "${value// }" ]]; then
    echo "[preflight] missing: $key"
    missing=1
  fi
done

app_image="$(get_effective_var APP_IMAGE)"
if [[ "$app_image" == *"your-user/filmspin"* ]]; then
  echo "[preflight] APP_IMAGE still uses template value: $app_image"
  missing=1
fi

if [[ "$missing" -ne 0 ]]; then
  echo "[preflight] failed. Fix env values and re-run."
  exit 1
fi

echo "[preflight] rendering compose config"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" config >/dev/null

echo "[preflight] ok"
