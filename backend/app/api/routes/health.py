"""Health check."""

from fastapi import APIRouter

from ...schemas import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    from ... import __version__

    return HealthResponse(status="healthy", service="cosmo-chatpdf-backend", version=__version__)
