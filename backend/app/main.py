from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routers import auth, markets, operations, reports
from app.routers import portfolio, routes, shifts

app = FastAPI(
    title="SFA API — Saha Satış Yönetimi",
    description="Saha temsilcileri için ziyaret, sipariş ve raporlama API'si",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
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
    return {"status": "ok", "version": "1.0.0"}
