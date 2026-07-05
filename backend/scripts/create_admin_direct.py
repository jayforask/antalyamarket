"""Admin kullanicisi olustur - argümanlarla çalışır."""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.models.models import User
from app.core.security import hash_password
import uuid
from datetime import datetime, timezone

DATABASE_URL = os.getenv("DATABASE_URL", "")


async def create_admin(name, email, password, phone=""):
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        user = User(
            id=uuid.uuid4(),
            name=name,
            email=email,
            hashed_password=hash_password(password),
            role="admin",
            is_active=True,
            created_at=datetime.now(timezone.utc),
        )
        session.add(user)
        await session.commit()
        print(f"[OK] Admin olusturuldu: {email}")

    await engine.dispose()


if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Kullanim: python scripts/create_admin_direct.py <name> <email> <password>")
        sys.exit(1)
    asyncio.run(create_admin(sys.argv[1], sys.argv[2], sys.argv[3]))
