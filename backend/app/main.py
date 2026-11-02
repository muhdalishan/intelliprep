from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import get_settings
from app.core.llm import AIUnavailable
from app.modules.adaptive_exam.router import router as adaptive_exam_router
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
]


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="IntelliPrep AI API",
        version="0.1.0",
        docs_url=None if settings.is_production else "/docs",
        redoc_url=None,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
    )

    @app.exception_handler(AIUnavailable)
    async def ai_unavailable(_request: Request, exc: AIUnavailable) -> JSONResponse:
        return JSONResponse(status_code=503, content={"detail": str(exc)})

    @app.get(f"{settings.api_prefix}/health", tags=["health"])
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    for router in MODULE_ROUTERS:
        app.include_router(router, prefix=settings.api_prefix)

    return app


app = create_app()
