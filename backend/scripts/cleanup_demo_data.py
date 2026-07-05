"""
Canlıya geçiş öncesi demo/örnek verileri temizler.

Bu script şunları siler:
  - markets tablosundaki TÜM kayıtlar
  - visits tablosundaki TÜM kayıtlar
  - orders tablosundaki TÜM kayıtlar
  - shifts tablosundaki TÜM kayıtlar
  - performance_summary tablosundaki TÜM kayıtlar
  - users tablosundaki admin DIŞI tüm kullanıcılar

Admin kullanıcıları KORUNUR (role='admin').

Kullanım:
    cd backend
    python scripts/cleanup_demo_data.py

    # Önce ne silineceğini görmek için:
    python scripts/cleanup_demo_data.py --dry-run
"""

import argparse
import asyncio
import os
import sys

from dotenv import load_dotenv
from sqlalchemy import text, delete, select, func
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

from app.models.models import Market, Visit, Order, Shift, PerformanceSummary, User  # noqa: E402

DATABASE_URL = os.getenv("DATABASE_URL", "")


async def count_rows(db: AsyncSession):
    """Tablolardaki mevcut kayıt sayılarını döner."""
    counts = {}

    for model, label in [
        (Market, "markets"),
        (Visit, "visits"),
        (Order, "orders"),
        (Shift, "shifts"),
        (PerformanceSummary, "performance_summary"),
    ]:
        result = await db.execute(select(func.count()).select_from(model))
        counts[label] = result.scalar_one()

    # Kullanıcılar: admin olmayanlar
    result = await db.execute(
        select(func.count()).select_from(User).where(User.role != "admin")
    )
    counts["users (non-admin)"] = result.scalar_one()

    result = await db.execute(
        select(func.count()).select_from(User).where(User.role == "admin")
    )
    counts["users (admin - KORUNACAK)"] = result.scalar_one()

    return counts


async def run(dry_run: bool = False):
    if not DATABASE_URL:
        print("❌ DATABASE_URL tanımlı değil. backend/.env dosyasını kontrol edin.")
        sys.exit(1)

    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    print("=" * 60)
    print("🧹  Demo Veri Temizleme Scripti")
    print("=" * 60)
    print(f"Mod: {'DRY-RUN (hiçbir şey silinmeyecek)' if dry_run else '⚠️  CANLI — veriler kalıcı silinecek!'}")
    print()

    async with async_session() as db:
        # Mevcut durumu göster
        print("📊 Mevcut kayıt sayıları:")
        counts = await count_rows(db)
        for table, count in counts.items():
            print(f"  {table:35s}: {count:,}")
        print()

        if dry_run:
            print("DRY-RUN modunda çalışıyor — hiçbir şey silinmedi.")
            await engine.dispose()
            return

        # Onay al
        total_to_delete = sum(
            v for k, v in counts.items() if "KORUNACAK" not in k
        )
        if total_to_delete == 0:
            print("✅ Silinecek veri yok, tablolar zaten boş.")
            await engine.dispose()
            return

        confirm = input(
            f"\n⚠️  Toplam {total_to_delete:,} kayıt silinecek. Devam etmek istiyor musunuz? [evet/hayır]: "
        ).strip().lower()

        if confirm not in ("evet", "e", "yes", "y"):
            print("İptal edildi.")
            await engine.dispose()
            return

        print("\n🗑  Siliniyor...")

        async with db.begin():
            # FK kısıtlamaları nedeniyle sıralı sil: önce çocuk tablolar
            result = await db.execute(delete(Order))
            print(f"  ✅ orders:              {result.rowcount:,} kayıt silindi")

            result = await db.execute(delete(PerformanceSummary))
            print(f"  ✅ performance_summary: {result.rowcount:,} kayıt silindi")

            result = await db.execute(delete(Visit))
            print(f"  ✅ visits:              {result.rowcount:,} kayıt silindi")

            result = await db.execute(delete(Shift))
            print(f"  ✅ shifts:              {result.rowcount:,} kayıt silindi")

            result = await db.execute(delete(Market))
            print(f"  ✅ markets:             {result.rowcount:,} kayıt silindi")

            result = await db.execute(
                delete(User).where(User.role != "admin")
            )
            print(f"  ✅ users (non-admin):   {result.rowcount:,} kayıt silindi")

        print()
        print("=" * 60)
        print("✅ Temizlik tamamlandı. Admin kullanıcılar korundu.")
        print("=" * 60)

    await engine.dispose()


def main():
    parser = argparse.ArgumentParser(
        description="Canlıya geçiş öncesi demo verilerini temizle"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Silmeden önce ne silineceğini göster",
    )
    args = parser.parse_args()
    asyncio.run(run(dry_run=args.dry_run))


if __name__ == "__main__":
    main()
