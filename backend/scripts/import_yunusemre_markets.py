# -*- coding: utf-8 -*-
"""
Yunusemre temizlenmiş market verilerini (yunusemre_isyerleri_temiz.json)
antalyamarket veritabanına aktaran ve 'ali cesur' kullanıcısına portföy olarak atayan script.
"""

import asyncio
import json
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

from dotenv import load_dotenv
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

from app.models.models import Market, User, MarketAssignment

DATABASE_URL = os.getenv("DATABASE_URL", "")
JSON_PATH = os.path.normpath("C:/Users/vampi/OneDrive/Masaüstü/google places api/yeni taktik yunusemre/yunusemre_isyerleri_temiz.json")


def map_market_type(kategori: str) -> str:
    kategori_lower = (kategori or "").lower()
    if "tekel" in kategori_lower:
        return "tekel"
    if "bakkal" in kategori_lower or "market" in kategori_lower or "büfe" in kategori_lower or "bufe" in kategori_lower:
        return "bakkal"
    return "other"


async def main():
    if not DATABASE_URL:
        print("[HATA] DATABASE_URL bulunamadi.", flush=True)
        return

    if not os.path.exists(JSON_PATH):
        print(f"[HATA] '{JSON_PATH}' dosyasi bulunamadi.", flush=True)
        return

    print("=" * 60, flush=True)
    print(f"Yunusemre Temiz Veriler Oku: {JSON_PATH}", flush=True)
    with open(JSON_PATH, "r", encoding="utf-8") as f:
        items = json.load(f)
    print(f"[+] Toplam {len(items):,} adet temiz isletme kaydi yuklendi.", flush=True)

    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        # Ali Cesur kullanıcısını bul
        print("\n'ali cesur' kullanicisi araniyor...", flush=True)
        stmt = select(User).where(
            or_(
                User.name.ilike("%ali cesur%"),
                User.email.ilike("%acesur423@gmail.com%"),
                User.email.ilike("%alicesur%")
            )
        )
        res = await db.execute(stmt)
        user_ali = res.scalars().first()

        if not user_ali:
            print("[HATA] 'ali cesur' kullanicisi bulunamadi! Islem durduruldu.", flush=True)
            return

        print(f"[+] Kullanici bulundu: {user_ali.name} ({user_ali.email}) - ID: {user_ali.id}", flush=True)

        print("\nYENI YUNUSEMRE MARKETLERI TOPLU OLARAK EKLENIYOR...", flush=True)
        
        markets_to_add = []
        for item in items:
            lat = item.get("lat")
            lng = item.get("lng")
            if lat is None or lng is None or lat == "" or lng == "":
                continue

            try:
                lat_f = float(lat)
                lng_f = float(lng)
            except ValueError:
                continue

            mtype = map_market_type(item.get("kategori", ""))
            name_str = item.get("isim", "Adsız Market")[:256]
            address_str = item.get("adres") or "Yunusemre, Manisa, Türkiye"
            phone_str = item.get("telefon")[:32] if item.get("telefon") else None

            # GeoAlchemy2 WKT String formatı (SRID=4326;POINT(lng lat))
            wkt_location = f"SRID=4326;POINT({lng_f} {lat_f})"

            market = Market(
                name=name_str,
                type=mtype,
                address=address_str,
                phone=phone_str,
                location=wkt_location,
                source="api",
                is_verified=True,
                is_corporate=False,
            )
            markets_to_add.append(market)

        print(f"[+] {len(markets_to_add):,} adet Market nesnesi veritabanina gonderiliyor...", flush=True)
        db.add_all(markets_to_add)
        await db.flush()

        print(f"[+] {len(markets_to_add):,} adet Market kaydina 'ali cesur' portfoy atamasi olusturuluyor...", flush=True)
        assignments_to_add = []
        for m in markets_to_add:
            assignment = MarketAssignment(
                user_id=user_ali.id,
                market_id=m.id,
                assigned_by=user_ali.id
            )
            assignments_to_add.append(assignment)

        db.add_all(assignments_to_add)
        await db.commit()

        print("=" * 60, flush=True)
        print(f"SUCCESS: ISLEM TAMAMLANDI!", flush=True)
        print(f"[+] Eklenen Market Sayisi: {len(markets_to_add):,}", flush=True)
        print(f"[+] 'ali cesur' Portfoyune Atanan Market Sayisi: {len(assignments_to_add):,}", flush=True)
        print("=" * 60, flush=True)

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
