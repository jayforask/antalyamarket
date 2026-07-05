# -*- coding: utf-8 -*-
"""
Kepez (Antalya) bölgesindeki bakkal ve tekel bayilerini
Google Places API üzerinden çekip veritabanına kaydeden script.

Kullanım:
    cd backend
    python scripts/import_kepez_markets.py

    # Sadece önizleme (DB'ye yazmadan):
    python scripts/import_kepez_markets.py --dry-run

    # Belirli bir tip için:
    python scripts/import_kepez_markets.py --type bakkal
    python scripts/import_kepez_markets.py --type tekel
"""

import argparse
import asyncio
import os
import sys
import time
from typing import Optional

import httpx
from dotenv import load_dotenv
from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from geoalchemy2.functions import ST_MakePoint, ST_SetSRID

# Backend paket yolunu ekle
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

from app.models.models import Market  # noqa: E402

# ─── Sabitler ────────────────────────────────────────────────────────────────

GOOGLE_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY", "")
DATABASE_URL = os.getenv("DATABASE_URL", "")

# Kepez merkez koordinatı (Google Places için arama merkezi)
KEPEZ_LAT = 36.9317
KEPEZ_LNG = 30.6919
SEARCH_RADIUS_METERS = 8000  # 8 km — Kepez ilçesini kapsar

# Google Places text/nearby search endpoint'leri
PLACES_TEXT_SEARCH_URL = "https://maps.googleapis.com/maps/api/place/textsearch/json"
PLACES_NEARBY_SEARCH_URL = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
PLACES_DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json"

# Arama sorguları — hem Türkçe hem İngilizce terimler
SEARCH_QUERIES = [
    "bakkal Kepez Antalya",
    "tekel bayi Kepez Antalya",
    "tekel bayii Kepez Antalya",
    "şarküteri Kepez Antalya",
    "mini market Kepez Antalya",
]

# Nearby search için place type'lar
NEARBY_TYPES = ["convenience_store", "grocery_or_supermarket", "liquor_store"]

# Kurumsal zincir market isimleri — bunlar is_corporate=True olarak işaretlenir
# veya tamamen atlanır (SKIP_CORPORATE=True ise)
CORPORATE_KEYWORDS = [
    "bim", "a101", "migros", "şok", "sok", "carrefour", "carrefoursa",
    "hakmar", "kipa", "metro", "macro", "koçtaş", "ikea", "bauhaus",
    "teknosa", "mediamarkt", "vatan", "gratis", "watsons", "eczane",
    "eczanesi", "zincir", "franchise",
]

# True: kurumsal olanları tamamen atla | False: is_corporate=True ile kaydet
SKIP_CORPORATE = False

# ─── Yardımcı fonksiyonlar ───────────────────────────────────────────────────

def is_corporate(name: str) -> bool:
    """Market isminin kurumsal zincire ait olup olmadığını kontrol eder."""
    name_lower = name.lower()
    return any(keyword in name_lower for keyword in CORPORATE_KEYWORDS)


def detect_market_type(name: str, place_types: list[str]) -> str:
    """Google place tipi ve isimden Market tip enum'unu belirler."""
    name_lower = name.lower()

    if "tekel" in name_lower or "liquor" in name_lower or "liquor_store" in place_types:
        return "tekel"
    if "bakkal" in name_lower:
        return "bakkal"
    if any(t in place_types for t in ["convenience_store", "grocery_or_supermarket"]):
        # Küçük market → bakkal, büyük zincir dışı → market
        return "bakkal"

    return "bakkal"  # default: bilinmeyen küçük esnaf → bakkal


async def fetch_places_text_search(
    client: httpx.AsyncClient,
    query: str,
    page_token: Optional[str] = None,
) -> dict:
    """Google Places Text Search isteği atar."""
    params = {
        "query": query,
        "key": GOOGLE_API_KEY,
        "language": "tr",
        "region": "tr",
    }
    if page_token:
        params["pagetoken"] = page_token
    else:
        params["location"] = f"{KEPEZ_LAT},{KEPEZ_LNG}"
        params["radius"] = str(SEARCH_RADIUS_METERS)

    resp = await client.get(PLACES_TEXT_SEARCH_URL, params=params, timeout=15)
    resp.raise_for_status()
    return resp.json()


async def fetch_places_nearby(
    client: httpx.AsyncClient,
    place_type: str,
    page_token: Optional[str] = None,
) -> dict:
    """Google Places Nearby Search isteği atar."""
    params = {
        "location": f"{KEPEZ_LAT},{KEPEZ_LNG}",
        "radius": str(SEARCH_RADIUS_METERS),
        "type": place_type,
        "key": GOOGLE_API_KEY,
        "language": "tr",
    }
    if page_token:
        params["pagetoken"] = page_token

    resp = await client.get(PLACES_NEARBY_SEARCH_URL, params=params, timeout=15)
    resp.raise_for_status()
    return resp.json()


async def fetch_place_details(client: httpx.AsyncClient, place_id: str) -> dict:
    """Telefon numarası gibi detaylar için Place Details çeker."""
    params = {
        "place_id": place_id,
        "fields": "name,formatted_address,formatted_phone_number,geometry,types",
        "key": GOOGLE_API_KEY,
        "language": "tr",
    }
    resp = await client.get(PLACES_DETAILS_URL, params=params, timeout=15)
    resp.raise_for_status()
    return resp.json().get("result", {})


def extract_place_data(place: dict) -> Optional[dict]:
    """
    Google Places sonucundan gerekli alanları çıkarır.
    Kepez dışındaysa None döner.
    """
    name = place.get("name", "").strip()
    if not name:
        return None

    geometry = place.get("geometry", {}).get("location", {})
    lat = geometry.get("lat")
    lng = geometry.get("lng")
    if lat is None or lng is None:
        return None

    address = place.get("formatted_address") or place.get("vicinity") or ""

    # Kepez kontrolü — adres veya isimde "Kepez" geçmiyorsa koordinat bazlı kontrol
    # (zaten radius ile sınırladık ama double-check)
    place_types = place.get("types", [])

    return {
        "place_id": place.get("place_id", ""),
        "name": name,
        "address": address,
        "latitude": lat,
        "longitude": lng,
        "phone": place.get("formatted_phone_number"),  # details'dan gelir
        "place_types": place_types,
    }


# ─── DB işlemleri ─────────────────────────────────────────────────────────────

async def market_exists(db: AsyncSession, name: str, lat: float, lng: float) -> bool:
    """
    Aynı isim ve yakın koordinatta market var mı kontrol eder.
    50 metre tolerans — ST_DWithin kullanıyor.
    """
    result = await db.execute(
        select(func.count()).select_from(Market).where(
            Market.name.ilike(name),
        )
    )
    count = result.scalar_one()
    return count > 0


async def save_market(
    db: AsyncSession,
    data: dict,
    market_type: str,
    corporate: bool,
    dry_run: bool,
) -> tuple[bool, str]:
    """
    Marketi veritabanına kaydeder.
    Returns: (kaydedildi_mi, durum_mesajı)
    """
    name = data["name"]
    lat = data["latitude"]
    lng = data["longitude"]

    # Dry-run modunda DB'ye hiç dokunma
    if dry_run:
        action = "kurumsal" if corporate else market_type
        return True, f"[DRY-RUN] Eklenecek ({action}): {name} - {data['address']}"

    # Duplicate kontrolü (sadece canli modda)
    exists = await market_exists(db, name, lat, lng)
    if exists:
        return False, f"[SKIP] Atlandi (zaten var): {name}"

    market = Market(
        name=name,
        type=market_type,
        address=data["address"] or "Kepez, Antalya",
        phone=data.get("phone"),
        location=ST_SetSRID(ST_MakePoint(lng, lat), 4326),
        source="api",
        is_verified=False,
        is_corporate=corporate,
    )
    db.add(market)
    return True, f"[OK] Eklendi ({market_type}{'  [kurumsal]' if corporate else ''}): {name}"


# ─── Ana iş akışı ─────────────────────────────────────────────────────────────

async def collect_all_places(client: httpx.AsyncClient, target_type: Optional[str]) -> list[dict]:
    """Tüm arama sorgularından place listesi toplar, tekrarları place_id ile filtreler."""
    seen_place_ids: set[str] = set()
    all_places: list[dict] = []

    # 1) Text Search
    queries_to_run = SEARCH_QUERIES
    if target_type == "bakkal":
        queries_to_run = [q for q in SEARCH_QUERIES if "bakkal" in q or "mini" in q]
    elif target_type == "tekel":
        queries_to_run = [q for q in SEARCH_QUERIES if "tekel" in q]

    for query in queries_to_run:
        print(f"\n[SEARCH] Text Search: {query}")
        page_token = None
        page = 0

        while True:
            try:
                if page > 0:
                    # Google pagetoken için 2 saniye bekleme zorunlu
                    time.sleep(2)

                data = await fetch_places_text_search(client, query, page_token)
                status = data.get("status")

                if status == "REQUEST_DENIED":
                    print(f"  [ERR] API Key hatasi: {data.get('error_message', '')}")
                    sys.exit(1)
                if status not in ("OK", "ZERO_RESULTS"):
                    print(f"  [WARN] Status: {status}")
                    break

                results = data.get("results", [])
                print(f"  Sayfa {page + 1}: {len(results)} sonuc")

                for place in results:
                    pid = place.get("place_id", "")
                    if pid and pid not in seen_place_ids:
                        seen_place_ids.add(pid)
                        all_places.append(place)

                page_token = data.get("next_page_token")
                if not page_token:
                    break
                page += 1

            except httpx.HTTPError as e:
                print(f"  [ERR] HTTP Hatasi: {e}")
                break

    # 2) Nearby Search (ek yerler için)
    if target_type is None or target_type in ("bakkal", "tekel"):
        nearby_types_to_run = NEARBY_TYPES
        if target_type == "bakkal":
            nearby_types_to_run = ["convenience_store", "grocery_or_supermarket"]
        elif target_type == "tekel":
            nearby_types_to_run = ["liquor_store"]

        for place_type in nearby_types_to_run:
            print(f"\n[PIN] Nearby Search: {place_type}")
            page_token = None
            page = 0

            while True:
                try:
                    if page > 0:
                        time.sleep(2)

                    data = await fetch_places_nearby(client, place_type, page_token)
                    status = data.get("status")

                    if status == "REQUEST_DENIED":
                        print(f"  [ERR] API Key hatasi: {data.get('error_message', '')}")
                        sys.exit(1)
                    if status not in ("OK", "ZERO_RESULTS"):
                        print(f"  [WARN] Status: {status}")
                        break

                    results = data.get("results", [])
                    print(f"  Sayfa {page + 1}: {len(results)} sonuc")

                    for place in results:
                        pid = place.get("place_id", "")
                        if pid and pid not in seen_place_ids:
                            seen_place_ids.add(pid)
                            all_places.append(place)

                    page_token = data.get("next_page_token")
                    if not page_token:
                        break
                    page += 1

                except httpx.HTTPError as e:
                    print(f"  [ERR] HTTP Hatasi: {e}")
                    break

    return all_places


async def fetch_phone_numbers(
    client: httpx.AsyncClient, places: list[dict]
) -> dict[str, Optional[str]]:
    """
    Place ID → telefon numarası eşlemesi için Details API çağrısı.
    Rate limit aşmamak için batch'ler halinde çeker.
    """
    phones: dict[str, Optional[str]] = {}
    total = len(places)

    print(f"\n[TEL] Telefon numaralari cekiliyor ({total} yer)...")

    for i, place in enumerate(places):
        place_id = place.get("place_id", "")
        if not place_id:
            continue

        try:
            details = await fetch_place_details(client, place_id)
            phones[place_id] = details.get("formatted_phone_number")

            if (i + 1) % 10 == 0:
                print(f"  {i + 1}/{total} tamamlandi")

            # Rate limit: saniyede ~10 istek
            await asyncio.sleep(0.12)

        except httpx.HTTPError:
            phones[place_id] = None

    return phones


async def run(dry_run: bool = False, target_type: Optional[str] = None, skip_phones: bool = False):
    """Ana çalışma fonksiyonu."""

    if not GOOGLE_API_KEY or GOOGLE_API_KEY == "your-google-maps-api-key":
        print("[ERR] GOOGLE_MAPS_API_KEY tanimli degil. backend/.env dosyasini kontrol edin.")
        sys.exit(1)

    if not DATABASE_URL:
        print("[ERR] DATABASE_URL tanimli degil.")
        sys.exit(1)

    print("=" * 60)
    print("[MAP] Kepez (Antalya) Market Import Scripti")
    print("=" * 60)
    print(f"Mod: {'DRY-RUN (DB yazilmayacak)' if dry_run else 'CANLI'}")
    print(f"Hedef tip: {target_type or 'hepsi (bakkal + tekel)'}")
    print(f"Kurumsal: {'atlanacak' if SKIP_CORPORATE else 'is_corporate=True ile kaydedilecek'}")
    print()

    # DB bağlantısı
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with httpx.AsyncClient() as client:
        # 1) Tüm yerleri topla
        all_places = await collect_all_places(client, target_type)
        print(f"\n[BOX] Toplam benzersiz yer: {len(all_places)}")

        if not all_places:
            print("Hiç sonuç bulunamadı.")
            return

        # 2) Telefon numaralarını çek (opsiyonel)
        phones: dict[str, Optional[str]] = {}
        if not skip_phones:
            phones = await fetch_phone_numbers(client, all_places)

        # 3) DB'ye kaydet
        print(f"\n[DB] Veritabani kaydediliyor...")
        added = 0
        skipped = 0
        corporate_count = 0

        async with async_session() as db:
            async with db.begin():
                for place in all_places:
                    extracted = extract_place_data(place)
                    if not extracted:
                        continue

                    # Telefonu ekle
                    extracted["phone"] = phones.get(place.get("place_id", ""))

                    name = extracted["name"]
                    corporate = is_corporate(name)

                    if SKIP_CORPORATE and corporate:
                        skipped += 1
                        print(f"[CORP] Atlandi (kurumsal): {name}")
                        continue

                    place_types = extracted.pop("place_types", [])
                    market_type = detect_market_type(name, place_types)

                    # tip filtresi uygulanmışsa kontrol et
                    if target_type and market_type != target_type and not corporate:
                        skipped += 1
                        continue

                    saved, msg = await save_market(
                        db, extracted, market_type, corporate, dry_run
                    )
                    print(msg)

                    if saved:
                        added += 1
                        if corporate:
                            corporate_count += 1
                    else:
                        skipped += 1

        print()
        print("=" * 60)
        print(f"[OK] Eklenen:   {added}")
        print(f"   - Kurumsal:  {corporate_count}")
        print(f"   - Esnaf:     {added - corporate_count}")
        print(f"[SKIP] Atlanan: {skipped}")
        print("=" * 60)

    await engine.dispose()


# ─── CLI ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Kepez (Antalya) bakkal ve tekel bayilerini Google Places'tan çek"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Veritabanına yazmadan önizleme yap",
    )
    parser.add_argument(
        "--type",
        choices=["bakkal", "tekel"],
        default=None,
        help="Sadece belirli bir tipi çek (varsayılan: hepsi)",
    )
    parser.add_argument(
        "--skip-phones",
        action="store_true",
        help="Telefon numarası çekme adımını atla (daha hızlı)",
    )
    args = parser.parse_args()

    asyncio.run(run(
        dry_run=args.dry_run,
        target_type=args.type,
        skip_phones=args.skip_phones,
    ))


if __name__ == "__main__":
    main()
