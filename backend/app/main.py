import time
import uuid
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import init_db
from app.api.routes import router

class RequestIdFilter(logging.Filter):
    def filter(self, record):
        if not hasattr(record, "request_id"):
            record.request_id = "system"
        return True

# Configure root handler with RequestIdFilter
_stream_handler = logging.StreamHandler()
_stream_handler.addFilter(RequestIdFilter())
_stream_handler.setFormatter(
    logging.Formatter("%(asctime)s [%(levelname)s] [req_id=%(request_id)s] %(message)s")
)
logging.root.handlers = [_stream_handler]
logging.root.setLevel(logging.INFO)
logger = logging.getLogger("mandateguard")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database tables on startup
    await init_db()
    logger.info(f"MandateGuard Backend initialized (Chain ID: {settings.CHAIN_ID}, Environment: {settings.ENVIRONMENT})", extra={"request_id": "startup"})
    yield
    logger.info("MandateGuard Backend shutting down gracefully", extra={"request_id": "shutdown"})

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="MandateGuard — AI Agent Payment Authorization & Smart Account Security Service",
    lifespan=lifespan,
)

# 1. Request Correlation ID & Logging Middleware
@app.middleware("http")
async def correlation_id_and_logging_middleware(request: Request, call_next):
    req_id = request.headers.get("X-Request-ID") or f"req_{uuid.uuid4().hex[:16]}"
    request.state.request_id = req_id

    # Content length limit (2MB max)
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > 2 * 1024 * 1024:
        return JSONResponse(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            content={"detail": "Payload exceeds 2MB limit", "request_id": req_id}
        )

    start_time = time.time()
    try:
        response = await call_next(request)
        duration_ms = round((time.time() - start_time) * 1000, 2)
        response.headers["X-Request-ID"] = req_id
        logger.info(
            f"{request.method} {request.url.path} -> {response.status_code} ({duration_ms}ms)",
            extra={"request_id": req_id}
        )
        return response
    except Exception as exc:
        duration_ms = round((time.time() - start_time) * 1000, 2)
        logger.error(
            f"Unhandled exception on {request.method} {request.url.path}: {str(exc)} ({duration_ms}ms)",
            extra={"request_id": req_id},
            exc_info=True
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "Internal server error", "request_id": req_id}
        )

# 2. CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix=settings.API_V1_STR)
app.include_router(router) # Also expose /health at root level
