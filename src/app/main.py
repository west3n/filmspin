import logging
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from .core.config import CORS_ALLOW_ORIGINS
from .dependencies import close_clients
from .observability import metrics
from .routers import genres, random, movie, config


@asynccontextmanager
async def lifespan(_: FastAPI):
    try:
        yield
    finally:
        await close_clients()


def create_app() -> FastAPI:
    app = FastAPI(title="FilmSpin API", lifespan=lifespan)
    logger = logging.getLogger("uvicorn.error")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=CORS_ALLOW_ORIGINS,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def request_context_middleware(request: Request, call_next):
        started = time.perf_counter()
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        try:
            response = await call_next(request)
        except Exception:
            duration_ms = (time.perf_counter() - started) * 1000
            metrics.observe(request.url.path, 500, duration_ms)
            raise
        duration_ms = (time.perf_counter() - started) * 1000
        metrics.observe(request.url.path, response.status_code, duration_ms)
        response.headers["X-Request-ID"] = request_id
        return response

    @app.exception_handler(httpx.HTTPError)
    async def handle_upstream_http_error(
        request: Request, exc: httpx.HTTPError
    ) -> JSONResponse:
        upstream_status = None
        upstream_url = None
        if isinstance(exc, httpx.HTTPStatusError):
            upstream_status = exc.response.status_code
            upstream_url = _sanitize_url(exc.request.url)
        elif isinstance(exc, httpx.RequestError) and exc.request is not None:
            upstream_url = _sanitize_url(exc.request.url)

        logger.warning(
            "[FilmSpin] upstream request failed: path=%s status=%s url=%s error=%s",
            request.url.path,
            upstream_status,
            upstream_url,
            exc.__class__.__name__,
        )
        return JSONResponse(
            status_code=502,
            content={"error": "Upstream movie service is temporarily unavailable."},
        )

    @app.exception_handler(ValueError)
    async def handle_value_error(request: Request, exc: ValueError) -> JSONResponse:
        logger.info(
            "[FilmSpin] bad request: path=%s error=%s", request.url.path, str(exc)
        )
        return JSONResponse(status_code=400, content={"error": str(exc)})

    app.include_router(genres.router)
    app.include_router(random.router)
    app.include_router(movie.router)
    app.include_router(config.router)
    static_dir = Path(__file__).resolve().parents[1] / "static"
    if not static_dir.exists():
        logger.warning(
            f"[FilmSpin] static dir not found: {static_dir}"
        )
    app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="static")
    return app


def _sanitize_url(url: httpx.URL) -> str:
    parts = urlsplit(str(url))
    # Never log query params to avoid leaking API keys/tokens in server logs.
    return urlunsplit((parts.scheme, parts.netloc, parts.path, "", ""))


app = create_app()
