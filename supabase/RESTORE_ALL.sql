-- Restore the complete schema in migration order.
-- Run from the repository root with Supabase CLI/psql, not as a pasted SQL Editor query:
--   supabase db reset
-- or:
--   psql "$SUPABASE_DB_URL" -f supabase/RESTORE_ALL.sql
--
-- The migration files remain the source of truth. Migration 001 intentionally
-- recreates the schema, then 002-004 add notifications, maintenance, and time fields.

\set ON_ERROR_STOP on
\ir migrations/001_rasukan_ndayak.sql
\ir migrations/002_rasukan_booking_edit_and_notifications.sql
\ir migrations/003_product_maintenance.sql
\ir migrations/004_booking_time_status_notifications.sql
\ir migrations/005_product_fullset.sql

-- Verify the objects needed by the catalog and booking screens.
select to_regclass('public.products') as products_table,
       to_regclass('public.bookings') as bookings_table,
       to_regclass('public.product_maintenance') as maintenance_table;

select count(*) as product_count from public.products;
-- If product_count is 0, add the catalog rows from the admin page.
-- This repository currently has no product seed data; its baseProducts array is empty.
