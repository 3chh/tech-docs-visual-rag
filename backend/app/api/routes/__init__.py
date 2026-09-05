from fastapi import APIRouter

from . import chat, health, indexing, search, settings, toc

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(search.router)
api_router.include_router(chat.router)
api_router.include_router(indexing.router)
api_router.include_router(toc.router)
api_router.include_router(settings.router)

__all__ = ["api_router"]
