from fastapi import APIRouter

from ..core.config import RU_ENABLED
from ..observability import metrics
from ..schemas import MetricsOut, PublicConfigOut

router = APIRouter(prefix="/api", tags=["config"])


@router.get("/config", response_model=PublicConfigOut)
async def public_config():
    return PublicConfigOut(ru_enabled=RU_ENABLED)


@router.get("/metrics", response_model=MetricsOut)
async def public_metrics():
    return metrics.snapshot()
