from fastapi import APIRouter

from . import chat, health, indexing, search, toc

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(search.router)
api_router.include_router(chat.router)
api_router.include_router(indexing.router)
api_router.include_router(toc.router)

__all__ = ["api_router"]
