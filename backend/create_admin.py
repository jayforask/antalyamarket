"""
İlk admin kullanıcısını oluşturma scripti.

Kullanım:
    cd backend
    venv\Scripts\activate        (Windows)
    source venv/bin/activate     (Linux/Mac)
    python create_admin.py
"""
import asyncio
import getpass
import sys

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy import select

# Proje modülleri
from app.core.config import settings
from app.core.security import hash_password
from app.models.models import User


async def create_admin():
    print("\n=== SFA Admin Kullanıcısı Oluştur ===\n")

    name = input("Ad Soyad: ").strip()
    email = input("E-posta: ").strip().lower()
    password = getpass.getpass("Şifre (gizli): ")
    confirm = getpass.getpass("Şifre (tekrar): ")

    if not name or not email or not password:
        print("\n❌ Tüm alanlar zorunludur.")
        sys.exit(1)

    if password != confirm:
        print("\n❌ Şifreler eşleşmiyor.")
        sys.exit(1)

    if len(password) < 8:
        print("\n❌ Şifre en az 8 karakter olmalıdır.")
        sys.exit(1)

    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with SessionLocal() as db:
        # E-posta zaten var mı?
        existing = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
        if existing:
            print(f"\n❌ '{email}' adresiyle zaten bir kullanıcı var.")
            await engine.dispose()
            sys.exit(1)

        user = User(
            name=name,
            email=email,
            hashed_password=hash_password(password),
            role="admin",
            is_active=True,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

        print(f"\n✅ Admin kullanıcısı oluşturuldu!")
        print(f"   ID   : {user.id}")
        print(f"   Ad   : {user.name}")
        print(f"   Email: {user.email}")
        print(f"   Rol  : {user.role}\n")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(create_admin())
