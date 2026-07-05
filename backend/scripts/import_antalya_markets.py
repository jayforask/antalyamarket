# -*- coding: utf-8 -*-
"""
Antalya'nın Kepez, Muratpaşa ve Konyaaltı ilçelerindeki
bakkal ve tekel bayilerini Google Places API üzerinden çekip
veritabanına kaydeden script.

Kullanım:
    cd backend
    python scripts/import_antalya_markets.py
    python scripts/import_antalya_markets.py --dry-run
    python scripts/import_antalya_markets.py --skip-phones
    python scripts/import_antalya_markets.py --district kepez
"""

import argparse
import asyncio
import os
import sys
import time
from typing import Optional

import httpx
from dotenv import load_dotenv
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from geoalchemy2.functions import ST_MakePoint, ST_SetSRID

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

from app.models.models import Market  # noqa: E402

# ─── Sabitler ────────────────────────────────────────────────────────────────

GOOGLE_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY", "")
DATABASE_URL = os.getenv("DATABASE_URL", "")

# Google Places endpoint'leri
PLACES_TEXT_SEARCH_URL = "https://maps.googleapis.com/maps/api/place/textsearch/json"
PLACES_NEARBY_SEARCH_URL = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
PLACES_DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json"

# Kurumsal zincir — is_corporate=True olarak işaretlenir, import'a dahil edilmez
CORPORATE_KEYWORDS = [
    "bim", "a101", "migros", "şok", "sok", "carrefour", "carrefoursa",
    "hakmar", "kipa", "metro", "macro", "koçtaş", "ikea", "bauhaus",
    "teknosa", "mediamarkt", "vatan", "gratis", "watsons", "eczane",
    "eczanesi", "zincir", "franchise", "spar", "inter", "pazar",
]

# True: kurumsal olanları atla (sadece esnaf kaydet)
SKIP_CORPORATE = True

# İlçe tanımları — merkez koordinat + arama sorguları
DISTRICTS = {
    "kepez": {
        "label": "Kepez",
        "lat": 36.9317,
        "lng": 30.6919,
        "radius": 8000,
        "queries": [
            "bakkal Kepez Antalya",
            "tekel bayi Kepez Antalya",
            "tekel bayii Kepez Antalya",
            "şarküteri Kepez Antalya",
            "mini market Kepez Antalya",
        ],
    },
    "muratpasa": {
        "label": "Muratpaşa",
        "lat": 36.8879,
        "lng": 30.7042,
        "radius": 6000,
        "queries": [
            "bakkal Muratpaşa Antalya",
            "tekel bayi Muratpaşa Antalya",
            "tekel bayii Muratpaşa Antalya",
            "şarküteri Muratpaşa Antalya",
            "mini market Muratpaşa Antalya",
        ],
    },
    "konyaalti": {
        "label": "Konyaaltı",
        "lat": 36.8884,
        "lng": 30.6446,
        "radius": 7000,
        "queries": [
            "bakkal Konyaaltı Antalya",
            "tekel bayi Konyaaltı Antalya",
            "tekel bayii Konyaaltı Antalya",
            "şarküteri Konyaaltı Antalya",
            "mini market Konyaaltı Antalya",
        ],
    },
}

NEARBY_TYPES = ["convenience_store", "liquor_store"]

# ─── Yardımcı fonksiyonlar ───────────────────────────────────────────────────

def is_corporate(name: str) -> bool:
    name_lower = name.lower()
    return any(kw in name_lower for kw in CORPORATE_KEYWORDS)


def detect_market_type(name: str, place_types: list[str]) -> str:
    name_lower = name.lower()
    if "tekel" in name_lower or "liquor_store" in place_types:
        return "tekel"
    if "bakkal" in name_lower:
        return "bakkal"
    if any(t in place_types for t in ["convenience_store", "grocery_or_supermarket"]):
        return "bakkal"
    return "bakkal"


# ─── Google Places API ───────────────────────────────────────────────────────

async def fetch_text_search(
    client: httpx.AsyncClient,
    query: str,
    lat: float,
    lng: float,
    radius: int,
    page_token: Optional[str] = None,
) -> dict:
    params = {
        "query": query,
        "key": GOOGLE_API_KEY,
        "language": "tr",
        "region": "tr",
    }
    if page_token:
        params["pagetoken"] = page_token
    else:
        params["location"] = f"{lat},{lng}"
        params["radius"] = str(radius)

    resp = await client.get(PLACES_TEXT_SEARCH_URL, params=params, timeout=15)
    resp.raise_for_status()
    return resp.json()


async def fetch_nearby(
    client: httpx.AsyncClient,
    place_type: str,
    lat: float,
    lng: float,
    radius: int,
    page_token: Optional[str] = None,
) -> dict:
    params = {
        "location": f"{lat},{lng}",
        "radius": str(radius),
        "type": place_type,
        "key": GOOGLE_API_KEY,
        "language": "tr",
    }
    if page_token:
        params["pagetoken"] = page_token

    resp = await client.get(PLACES_NEARBY_SEARCH_URL, params=params, timeout=15)
    resp.raise_for_status()
    return resp.json()


async def fetch_details(client: httpx.AsyncClient, place_id: str) -> dict:
    params = {
        "place_id": place_id,
        "fields": "name,formatted_address,formatted_phone_number,geometry,types",
        "key": GOOGLE_API_KEY,
        "language": "tr",
    }
    resp = await client.get(PLACES_DETAILS_URL, params=params, timeout=15)
    resp.raise_for_status()
    return resp.json().get("result", {})


def extract_place(place: dict) -> Optional[dict]:
    name = place.get("name", "").strip()
    if not name:
        return None
    geo = place.get("geometry", {}).get("location", {})
    lat, lng = geo.get("lat"), geo.get("lng")
    if lat is None or lng is None:
        return None
    return {
        "place_id": place.get("place_id", ""),
        "name": name,
        "address": place.get("formatted_address") or place.get("vicinity") or "",
        "latitude": lat,
        "longitude": lng,
        "phone": place.get("formatted_phone_number"),
        "place_types": place.get("types", []),
    }


# ─── Toplama ─────────────────────────────────────────────────────────────────

async def collect_district(
    client: httpx.AsyncClient,
    district_key: str,
    seen: set[str],
) -> list[dict]:
    cfg = DISTRICTS[district_key]
    lat, lng, radius = cfg["lat"], cfg["lng"], cfg["radius"]
    places: list[dict] = []

    # Text Search
    for query in cfg["queries"]:
        print(f"  [TEXT] {query}")
        page_token = None
        page = 0
        while True:
            try:
                if page > 0:
                    time.sleep(2)
                data = await fetch_text_search(client, query, lat, lng, radius, page_token)
                status = data.get("status")
                if status == "REQUEST_DENIED":
                    print(f"  [ERR] API Key hatasi: {data.get('error_message', '')}")
                    sys.exit(1)
                if status not in ("OK", "ZERO_RESULTS"):
                    print(f"  [WARN] {status}")
                    break
                results = data.get("results", [])
                print(f"    Sayfa {page+1}: {len(results)} sonuc")
                for p in results:
                    pid = p.get("place_id", "")
                    if pid and pid not in seen:
                        seen.add(pid)
                        places.append(p)
                page_token = data.get("next_page_token")
                if not page_token:
                    break
                page += 1
            except httpx.HTTPError as e:
                print(f"  [ERR] {e}")
                break

    # Nearby Search
    for ptype in NEARBY_TYPES:
        print(f"  [NEAR] {ptype} @ {cfg['label']}")
        page_token = None
        page = 0
        while True:
            try:
                if page > 0:
                    time.sleep(2)
                data = await fetch_nearby(client, ptype, lat, lng, radius, page_token)
                status = data.get("status")
                if status == "REQUEST_DENIED":
                    print(f"  [ERR] API Key hatasi: {data.get('error_message', '')}")
                    sys.exit(1)
                if status not in ("OK", "ZERO_RESULTS"):
                    print(f"  [WARN] {status}")
                    break
                results = data.get("results", [])
                print(f"    Sayfa {page+1}: {len(results)} sonuc")
                for p in results:
                    pid = p.get("place_id", "")
                    if pid and pid not in seen:
                        seen.add(pid)
                        places.append(p)
                page_token = data.get("next_page_token")
                if not page_token:
                    break
                page += 1
            except httpx.HTTPError as e:
                print(f"  [ERR] {e}")
                break

    return places


# ─── DB ──────────────────────────────────────────────────────────────────────

async def market_exists(db: AsyncSession, name: str) -> bool:
    result = await db.execute(
        select(func.count()).select_from(Market).where(Market.name.ilike(name))
    )
    return result.scalar_one() > 0


async def save_market(
    db: AsyncSession,
    data: dict,
    market_type: str,
    corporate: bool,
    dry_run: bool,
) -> tuple[bool, str]:
    name = data["name"]

    if dry_run:
        tag = "kurumsal" if corporate else market_type
        return True, f"[DRY] ({tag}): {name}"

    if await market_exists(db, name):
        return False, f"[SKIP] Zaten var: {name}"

    market = Market(
        name=name,
        type=market_type,
        address=data["address"] or "Antalya",
        phone=data.get("phone"),
        location=ST_SetSRID(ST_MakePoint(data["longitude"], data["latitude"]), 4326),
        source="api",
        is_verified=False,
        is_corporate=corporate,
    )
    db.add(market)
    return True, f"[OK] ({market_type}): {name}"


# ─── Ana fonksiyon ───────────────────────────────────────────────────────────

async def run(
    dry_run: bool = False,
    district: Optional[str] = None,
    skip_phones: bool = False,
):
    if not GOOGLE_API_KEY:
        print("[ERR] GOOGLE_MAPS_API_KEY tanimli degil. backend/.env dosyasini guncelle.")
        sys.exit(1)
    if not DATABASE_URL:
        print("[ERR] DATABASE_URL tanimli degil.")
        sys.exit(1)

    districts_to_run = [district] if district else list(DISTRICTS.keys())

    print("=" * 60)
    print("Antalya Market Import — Kepez + Muratpasa + Konyaalti")
    print("=" * 60)
    print(f"Mod: {'DRY-RUN' if dry_run else 'CANLI'}")
    print(f"Ilceler: {', '.join(d.upper() for d in districts_to_run)}")
    print(f"Kurumsal: {'ATLANACAK' if SKIP_CORPORATE else 'is_corporate=True ile kaydedilecek'}")
    print()

    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    seen: set[str] = set()
    all_places: list[dict] = []

    async with httpx.AsyncClient() as client:
        for dk in districts_to_run:
            label = DISTRICTS[dk]["label"]
            print(f"\n{'-'*40}")
            print(f"[DISTRICT] {label}")
            print(f"{'-'*40}")
            places = await collect_district(client, dk, seen)
            print(f"  -> {len(places)} yeni benzersiz yer")
            all_places.extend(places)

        print(f"\n[TOTAL] Toplam benzersiz yer: {len(all_places)}")

        # Telefon numaraları (opsiyonel)
        phones: dict[str, Optional[str]] = {}
        if not skip_phones and not dry_run:
            print(f"\n[TEL] {len(all_places)} yer icin telefon cekiliyor...")
            for i, place in enumerate(all_places):
                pid = place.get("place_id", "")
                if not pid:
                    continue
                try:
                    details = await fetch_details(client, pid)
                    phones[pid] = details.get("formatted_phone_number")
                    if (i + 1) % 20 == 0:
                        print(f"  {i+1}/{len(all_places)}")
                    await asyncio.sleep(0.12)
                except httpx.HTTPError:
                    phones[pid] = None

        # DB kayıt
        print(f"\n[DB] Kaydediliyor...")
        added = skipped = corp_skipped = 0

        async with async_session() as db:
            async with db.begin():
                for place in all_places:
                    extracted = extract_place(place)
                    if not extracted:
                        continue

                    extracted["phone"] = phones.get(place.get("place_id", ""))
                    name = extracted["name"]
                    corporate = is_corporate(name)

                    if SKIP_CORPORATE and corporate:
                        corp_skipped += 1
                        continue

                    place_types = extracted.pop("place_types", [])
                    mtype = detect_market_type(name, place_types)

                    saved, msg = await save_market(db, extracted, mtype, corporate, dry_run)
                    print(msg)

                    if saved:
                        added += 1
                    else:
                        skipped += 1

    print()
    print("=" * 60)
    print(f"[OK]   Eklenen esnaf:    {added}")
    print(f"[SKIP] Zaten var:        {skipped}")
    print(f"[CORP] Kurumsal atlandi: {corp_skipped}")
    print("=" * 60)

    await engine.dispose()


# ─── CLI ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Antalya (Kepez+Muratpasa+Konyaalti) bakkal/tekel import"
    )
    parser.add_argument("--dry-run", action="store_true", help="DB'ye yazmadan onizle")
    parser.add_argument(
        "--district",
        choices=["kepez", "muratpasa", "konyaalti"],
        default=None,
        help="Tek ilce cek (varsayilan: hepsi)",
    )
    parser.add_argument("--skip-phones", action="store_true", help="Telefon adimini atla")
    args = parser.parse_args()

    asyncio.run(run(
        dry_run=args.dry_run,
        district=args.district,
        skip_phones=args.skip_phones,
    ))


if __name__ == "__main__":
    main()
