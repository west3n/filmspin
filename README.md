# FilmSpin

Random movie picker on FastAPI with TMDB/OMDb integrations, Redis cache, and Docker-based production deployment.

## Stack

- Python 3.13
- FastAPI + Uvicorn
- Redis
- Docker / Docker Compose
- Caddy (HTTPS + reverse proxy)
- uv (`pyproject.toml` + `uv.lock`)

## Local run

1. Configure environment:
   - `cp .env.prod.example .env.local` (or create `.env` manually)
2. Start app + redis:
   - `docker compose up -d --build`
3. Open:
   - `http://localhost:8000`

## Production

Deployment files:
- `docker-compose.prod.yml`
- `deploy/Caddyfile`
- `scripts/bootstrap_prod.sh`
- `scripts/deploy.sh`
- `.github/workflows/deploy.yml`

Detailed guide:
- `DEPLOY.md`

## CI/CD flow

Push to `main`:
1. Build Docker image
2. Push image to GHCR
3. SSH to VPS and run `make deploy-prod`

## Useful make commands

- `make bootstrap-prod`
- `make deploy-prod`
- `make ps-prod`
- `make logs-prod SERVICE=app`
- `make logs-prod SERVICE=caddy`
