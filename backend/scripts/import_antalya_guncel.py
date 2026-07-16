# -*- coding: utf-8 -*-
"""
'antalya güncel.json' dosyasındaki temizlenmiş 3630 market noktasını
sfa_db veritabanına aktaran script.

Önceki geçici/demo market verilerini temizler ve yeni temiz listeyi yazar.

Kullanım:
    cd backend
    python scripts/import_antalya_guncel.py
"""

import asyncio
import json
import os
import sys
from typing import List

from dotenv import load_dotenv
from sqlalchemy import text, delete, select, func
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from geoalchemy2.functions import ST_MakePoint, ST_SetSRID

# Proje kök dizinini ekle
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

from app.models.models import Market, Visit, Order, Shift, RouteStop, DailyRoute, MarketAssignment  # noqa: E402

DATABASE_URL = os.getenv("DATABASE_URL", "")
JSON_PATH = os.path.normpath("C:/Users/vampi/OneDrive/Masaüstü/google places api/antalya güncel.json")


def map_market_type(kategori: str) -> str:
    kategori_lower = kategori.lower()
    if "tekel" in kategori_lower:
        return "tekel"
    if "bakkal" in kategori_lower or "market" in kategori_lower:
        return "bakkal"
    if "büfe" in kategori_lower or "bufe" in kategori_lower:
        return "bakkal"  # büfeler de bakkal gibi küçük esnaf
    return "other"


async def main():
    if not DATABASE_URL:
        print("[HATA] DATABASE_URL bulunamadi. Lutfen .env dosyasini kontrol edin.")
        return

    if not os.path.exists(JSON_PATH):
        print(f"[HATA] '{JSON_PATH}' dosyasi bulunamadi. Lutfen yolu kontrol edin.")
        return

    print("=" * 60)
    # JSON Dosyasını oku
    print(f"JSON dosyasi okunuyor: {JSON_PATH}")
    with open(JSON_PATH, "r", encoding="utf-8") as f:
        items = json.load(f)
    print(f"Dosya okundu. Toplam {len(items):,} adet kayit tespit edildi.")

    # DB Bağlantısı oluştur
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        print("\nESKI VERILER TEMIZLENIYOR...")
        async with db.begin():
            # FK kısıtlamaları sebebiyle ilişkili tabloları sırayla temizle
            # Ziyaretler, siparişler, vardiyalar ve rotaları temizle
            await db.execute(delete(Order))
            await db.execute(delete(Visit))
            await db.execute(delete(Shift))
            await db.execute(delete(RouteStop))
            await db.execute(delete(DailyRoute))
            await db.execute(delete(MarketAssignment))
            # Marketleri temizle
            result = await db.execute(delete(Market))
            print(f"  Eski {result.rowcount:,} adet market/nokta silindi.")

        print("\nYENI VERILER YAZILIYOR...")
        
        batch_size = 200
        count = 0
        
        async with db.begin():
            for i, item in enumerate(items):
                lat = item.get("lat")
                lng = item.get("lng")
                if lat is None or lng is None:
                    continue
                
                # Market türünü eşleştir
                mtype = map_market_type(item.get("kategori", ""))
                
                market = Market(
                    name=item["isim"][:256],
                    type=mtype,
                    address=item["adres"] or "Antalya, Türkiye",
                    phone=item.get("telefon")[:32] if item.get("telefon") else None,
                    location=ST_SetSRID(ST_MakePoint(lng, lat), 4326),
                    source="api",
                    is_verified=True,  # Temizlenmiş liste olduğu için doğrudan onaylı
                    is_corporate=False, # Zaten kurumsal olmayan esnaflar filtrelendi
                )
                db.add(market)
                count += 1
                
                if count % batch_size == 0:
                    await db.flush()
                    print(f"  -> {count}/{len(items)} nokta veritabanina gonderildi...")

        print(f"\nAktarim tamamlandi! Toplam {count:,} adet guncel nokta veritabanina eklendi.")
    
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
