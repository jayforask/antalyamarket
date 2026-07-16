from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import get_db
from app.routers import auth, markets, operations, reports
from app.routers import portfolio, routes, shifts


# ─── Startup migrations ───────────────────────────────────────────────────────

async def _run_migrations() -> None:
    """
    Uygulama başlarken idempotent schema migration'larını çalıştır.
    IF NOT EXISTS kullandığı için birden fazla çalıştırılması güvenlidir.
    """
    from sqlalchemy import text
    from app.core.database import AsyncSessionLocal

    migrations = [
        # Shift tablosuna anlık GPS kolon ekle (v1.1)
        """
        ALTER TABLE shifts
            ADD COLUMN IF NOT EXISTS current_lat FLOAT,
            ADD COLUMN IF NOT EXISTS current_lng FLOAT,
            ADD COLUMN IF NOT EXISTS location_updated_at TIMESTAMPTZ
        """,
        # RouteStop tablosuna rollover_count ekle (v1.2)
        """
        ALTER TABLE route_stops
            ADD COLUMN IF NOT EXISTS rollover_count INT DEFAULT 0 NOT NULL
        """,
        # Users tablosuna work_mode ekle (v1.3)
        """
        ALTER TABLE users
            ADD COLUMN IF NOT EXISTS work_mode VARCHAR(32) DEFAULT 'hybrid' NOT NULL
        """,
    ]

    async with AsyncSessionLocal() as session:
        for sql in migrations:
            await session.execute(text(sql))
        await session.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Uygulama başlarken migration'ları çalıştır."""
    try:
        await _run_migrations()
    except Exception as exc:
        # Migration hatası uygulamayı durdurmasın — loglara düşsün
        import logging
        logging.getLogger("startup").warning(f"Migration warning: {exc}")
    yield  # Uygulama çalışıyor


# ─── App ──────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="SFA API — Saha Satış Yönetimi",
    description="Saha temsilcileri için ziyaret, sipariş ve raporlama API'si",
    version="1.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Router'ları ekle
app.include_router(auth.router)
app.include_router(markets.router)
app.include_router(operations.router)
app.include_router(reports.router)
app.include_router(portfolio.router)
app.include_router(routes.router)
app.include_router(shifts.router)


@app.get("/health", tags=["system"])
async def health_check():
    return {"status": "ok", "version": "1.1.0"}
