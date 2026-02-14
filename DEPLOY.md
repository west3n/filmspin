# Production Deployment

## 1. Server bootstrap (one-time)

1. Run bootstrap on VPS:
   - `make bootstrap-prod`
2. Point DNS records:
   - `A @ -> <server-ip>`
   - `A www -> <server-ip>`
3. Open inbound ports `80` and `443` in firewall/security group.
4. Clone this repo on server, for example to `/opt/filmspin`.

Notes:
- `make bootstrap-prod` expects Ubuntu/Debian and may ask for `sudo` password.
- Script configures Docker + Compose plugin and UFW rules for `22`, `80`, `443`.

## 2. Production env file

1. On server:
   - `cp .env.prod.example .env.prod`
2. Edit `.env.prod` and set:
   - `DOMAIN`
   - `ACME_EMAIL`
   - API keys (`TMDB_API_KEY`, `OMDB_API_KEY`)
   - `APP_IMAGE` (defaults to GHCR image path)

## 3. First deploy on server

Run:

```bash
make bootstrap-prod
cp .env.prod.example .env.prod
make deploy-prod
```

This starts:
- `caddy` (TLS + reverse proxy)
- `app` (FastAPI)
- `redis`

## 4. Auto deploy from IDE push

Push to `main` triggers `.github/workflows/deploy.yml`:
1. Build image
2. Push image to GHCR
3. SSH to server and run `make deploy-prod`

Configure these GitHub repository secrets:
- `VPS_HOST`
- `VPS_USER`
- `VPS_SSH_KEY`
- `VPS_PORT`
- `VPS_PATH` (example: `/opt/filmspin`)
- `GHCR_USER` (optional if image is public)
- `GHCR_TOKEN` (optional if image is public; token with `read:packages`)

## 5. Release flow

1. Commit changes in IDE.
2. `git push origin main`.
3. Watch Actions run (`Deploy` workflow).

## 6. Useful commands on server

```bash
make ps-prod
make logs-prod SERVICE=app
make logs-prod SERVICE=caddy
make restart-prod
make down-prod
```
