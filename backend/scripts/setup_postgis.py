"""PostGIS extension'ı kur ve tabloları oluştur."""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

import asyncpg
from sqlalchemy.ext.asyncio import create_async_engine
from app.core.database import Base
from app.models.models import User, Market, Visit, Shift, Order, PerformanceSummary  # noqa

DATABASE_URL = os.getenv("DATABASE_URL", "")
# asyncpg için sync URL
PG_URL = DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")


async def setup():
    print("PostGIS kuruluyor...")
    conn = await asyncpg.connect(PG_URL)
    await conn.execute("CREATE EXTENSION IF NOT EXISTS postgis;")
    await conn.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto;")
    print("[OK] PostGIS hazir.")
    await conn.close()

    print("Tablolar olusturuluyor...")
    engine = create_async_engine(DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await engine.dispose()
    print("[OK] Tum tablolar olusturuldu.")


if __name__ == "__main__":
    asyncio.run(setup())
