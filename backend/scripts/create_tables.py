"""
Veritabanı tablolarını SQLAlchemy metadata ile oluşturur.
Alembic gerekmez.

Kullanım:
    cd backend
    venv\Scripts\python scripts/create_tables.py
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

from sqlalchemy.ext.asyncio import create_async_engine
from app.core.database import Base
from app.models.models import User, Market, Visit, Shift, Order, PerformanceSummary  # noqa

DATABASE_URL = os.getenv("DATABASE_URL", "")


async def create_all():
    if not DATABASE_URL:
        print("[ERR] DATABASE_URL tanimli degil.")
        sys.exit(1)

    print(f"Baglaniyor: {DATABASE_URL}")
    engine = create_async_engine(DATABASE_URL, echo=False)

    async with engine.begin() as conn:
        print("Tablolar olusturuluyor...")
        await conn.run_sync(Base.metadata.create_all)
        print("[OK] Tum tablolar olusturuldu.")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(create_all())
