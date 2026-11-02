from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import InterfaceError, OperationalError

from app.core.config import get_settings
from app.core.llm import AIUnavailable
from app.db.session import get_sessionmaker
from app.modules.adaptive_exam.router import router as adaptive_exam_router
from app.modules.assistant.router import router as assistant_router
from app.modules.auth.router import router as auth_router
from app.modules.dashboard.router import router as dashboard_router
from app.modules.documents.router import router as documents_router
from app.modules.exam_guess.router import router as exam_guess_router
from app.modules.flashcards.router import router as flashcards_router
from app.modules.groups.router import router as groups_router
from app.modules.multimodal.router import router as multimodal_router
from app.modules.notifications.router import router as notifications_router
from app.modules.quizzes.router import router as quizzes_router
from app.modules.rag.router import router as rag_router
from app.modules.summaries.router import router as summaries_router
from app.modules.tutor.router import router as tutor_router
from app.modules.workspace.router import router as workspace_router

MODULE_ROUTERS = [
    auth_router,
    documents_router,
    rag_router,
    summaries_router,
    flashcards_router,
    quizzes_router,
    exam_guess_router,
    adaptive_exam_router,
    multimodal_router,
    groups_router,
    workspace_router,
    notifications_router,
    dashboard_router,
    tutor_router,
    assistant_router,
]


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    if get_settings().database_url == "local":
        # Start the local Postgres before the first request instead of during it.
        await run_in_threadpool(get_sessionmaker)
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    if settings.database_url == "local" and settings.environment != "local":
        raise RuntimeError("DATABASE_URL=local is only for ENVIRONMENT=local.")
    app = FastAPI(
        title="IntelliPrep AI API",
        version="0.1.0",
        docs_url=None if settings.is_production else "/docs",
        redoc_url=None,
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type", "X-Dev-User"],
    )

    @app.exception_handler(AIUnavailable)
    async def ai_unavailable(_request: Request, exc: AIUnavailable) -> JSONResponse:
        return JSONResponse(status_code=503, content={"detail": str(exc)})

    # No reachable database yet (e.g. before the Supabase project is connected).
    @app.exception_handler(OSError)
    @app.exception_handler(OperationalError)
    @app.exception_handler(InterfaceError)
    async def database_unavailable(_request: Request, _exc: Exception) -> JSONResponse:
        return JSONResponse(
            status_code=503,
            content={"detail": "The database isn't connected yet.", "code": "database_unavailable"},
        )

    @app.get(f"{settings.api_prefix}/health", tags=["health"])
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    for router in MODULE_ROUTERS:
        app.include_router(router, prefix=settings.api_prefix)

    return app


app = create_app()
