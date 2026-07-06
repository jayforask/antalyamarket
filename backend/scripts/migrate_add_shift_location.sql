-- Migration: Shift tablosuna anlık GPS kolon ekle
-- Çalıştır: psql $DATABASE_URL -f migrate_add_shift_location.sql

ALTER TABLE shifts
  ADD COLUMN IF NOT EXISTS current_lat FLOAT,
  ADD COLUMN IF NOT EXISTS current_lng FLOAT,
  ADD COLUMN IF NOT EXISTS location_updated_at TIMESTAMPTZ;
