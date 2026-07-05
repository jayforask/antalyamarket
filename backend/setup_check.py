"""
Kurulum doğrulama scripti — sistemi çalıştırmadan önce çalıştır.
Tüm bağımlılıkların ve ortam değişkenlerinin doğru kurulduğunu kontrol eder.

Kullanım:
    cd backend
    venv\Scripts\activate
    python setup_check.py
"""
import sys
import os


def check(label: str, ok: bool, fix: str = "") -> bool:
    if ok:
        print(f"  ✅ {label}")
    else:
        print(f"  ❌ {label}")
        if fix:
            print(f"     → {fix}")
    return ok


def main():
    print("\n========================================")
    print("  SFA Backend — Kurulum Doğrulama")
    print("========================================\n")

    all_ok = True

    # 1. Python versiyonu
    py_ok = sys.version_info >= (3, 10)
    all_ok &= check(
        f"Python >= 3.10  (mevcut: {sys.version.split()[0]})",
        py_ok,
        "Python 3.10+ yükleyin: https://python.org"
    )

    # 2. .env dosyası
    env_ok = os.path.exists(".env")
    all_ok &= check(
        ".env dosyası mevcut",
        env_ok,
        "copy .env.example .env  →  sonra içini düzenleyin"
    )

    # 3. Kritik paketler
    packages = [
        ("fastapi", "fastapi"),
        ("uvicorn", "uvicorn"),
        ("sqlalchemy", "sqlalchemy"),
        ("alembic", "alembic"),
        ("geoalchemy2", "geoalchemy2"),
        ("pydantic", "pydantic"),
        ("passlib", "passlib"),
        ("jose", "python-jose"),
        ("celery", "celery"),
        ("boto3", "boto3"),
        ("asyncpg", "asyncpg"),
    ]
    for import_name, pkg_name in packages:
        try:
            __import__(import_name)
            all_ok &= check(f"Paket: {pkg_name}", True)
        except ImportError:
            all_ok &= check(f"Paket: {pkg_name}", False, f"pip install {pkg_name}")

    # 4. PostgreSQL bağlantısı
    try:
        import psycopg2
        from app.core.config import settings
        sync_url = settings.DATABASE_URL.replace("+asyncpg", "")
        # asyncpg → psycopg2 formatına çevir
        sync_url = sync_url.replace("postgresql+asyncpg", "postgresql")
        conn = psycopg2.connect(sync_url, connect_timeout=3)
        conn.close()
        all_ok &= check("PostgreSQL bağlantısı", True)
    except Exception as e:
        all_ok &= check(
            "PostgreSQL bağlantısı",
            False,
            f"PostgreSQL çalışıyor mu? Hata: {e}"
        )

    # 5. PostGIS extension
    try:
        import psycopg2
        from app.core.config import settings
        sync_url = settings.DATABASE_URL.replace("+asyncpg", "").replace("postgresql+asyncpg", "postgresql")
        conn = psycopg2.connect(sync_url, connect_timeout=3)
        cur = conn.cursor()
        cur.execute("SELECT extname FROM pg_extension WHERE extname = 'postgis';")
        postgis_ok = cur.fetchone() is not None
        conn.close()
        all_ok &= check(
            "PostGIS extension",
            postgis_ok,
            "psql -d sfa_db -c 'CREATE EXTENSION postgis;'"
        )
    except Exception:
        all_ok &= check("PostGIS extension", False, "PostgreSQL bağlantısı kurulamadı")

    # 6. Redis bağlantısı
    try:
        import redis
        from app.core.config import settings
        r = redis.from_url(settings.REDIS_URL, socket_connect_timeout=2)
        r.ping()
        all_ok &= check("Redis bağlantısı", True)
    except Exception as e:
        all_ok &= check(
            "Redis bağlantısı",
            False,
            f"Redis çalışıyor mu? Memurai veya Redis Server başlatın. Hata: {e}"
        )

    # 7. Ortam değişkenleri
    try:
        from app.core.config import settings
        secret_ok = len(settings.SECRET_KEY) >= 16
        all_ok &= check(
            "SECRET_KEY yeterince uzun",
            secret_ok,
            ".env dosyasında SECRET_KEY'i güncelleyin (en az 16 karakter)"
        )
    except Exception:
        all_ok &= check("Ortam değişkenleri yüklendi", False, ".env dosyasını kontrol edin")

    print()
    if all_ok:
        print("✅ Tüm kontroller geçti! Sistemi başlatabilirsiniz:")
        print()
        print("   alembic revision --autogenerate -m 'initial'")
        print("   alembic upgrade head")
        print("   python create_admin.py")
        print("   uvicorn app.main:app --reload --port 8000")
    else:
        print("❌ Bazı kontroller başarısız. Yukarıdaki önerileri uygulayın.")

    print()


if __name__ == "__main__":
    main()
