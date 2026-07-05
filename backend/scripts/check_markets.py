import asyncio
import asyncpg
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

async def run():
    url = os.getenv("DATABASE_URL", "").replace("postgresql+asyncpg://", "postgresql://")
    conn = await asyncpg.connect(url)
    r = await conn.fetchrow("SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE is_corporate=true) as corporate, COUNT(*) FILTER (WHERE is_corporate=false) as other FROM markets")
    print(f"Toplam: {r['total']}, Kurumsal: {r['corporate']}, Diger: {r['other']}")
    # İlk 3 marketi göster
    rows = await conn.fetch("SELECT name, type, source, is_corporate FROM markets LIMIT 3")
    for row in rows:
        print(dict(row))
    await conn.close()

asyncio.run(run())
