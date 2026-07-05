-- ============================================================
-- Migration: tekel tipi + is_corporate kolonu
-- Tarih: 2026-07-04
-- 
-- Çalıştırma:
--   psql -U postgres -d sfa_db -f scripts/migrate_add_tekel_corporate.sql
-- ============================================================

BEGIN;

-- 1) market_type enum'una 'tekel' değeri ekle
--    PostgreSQL'de enum'a yeni değer eklemek için ALTER TYPE kullanılır.
--    IF NOT EXISTS PostgreSQL 14+ ile desteklenir.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'tekel'
          AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'market_type')
    ) THEN
        ALTER TYPE market_type ADD VALUE 'tekel' BEFORE 'other';
    END IF;
END
$$;

-- 2) markets tablosuna is_corporate kolonu ekle
ALTER TABLE markets
    ADD COLUMN IF NOT EXISTS is_corporate BOOLEAN NOT NULL DEFAULT FALSE;

-- 3) Mevcut büyük zincir marketleri kurumsal olarak işaretle
--    (import öncesi elle eklenmişse diye)
UPDATE markets
SET is_corporate = TRUE
WHERE LOWER(name) ~ '(bim|a101|migros|şok|sok\y|carrefour|carrefoursa|hakmar|kipa|metro\y|macro)';

COMMIT;

-- Doğrulama
SELECT
    (SELECT COUNT(*) FROM markets) AS toplam_market,
    (SELECT COUNT(*) FROM markets WHERE is_corporate = TRUE) AS kurumsal,
    (SELECT COUNT(*) FROM markets WHERE is_corporate = FALSE) AS esnaf,
    (SELECT COUNT(*) FROM markets WHERE type = 'tekel') AS tekel_sayisi;
