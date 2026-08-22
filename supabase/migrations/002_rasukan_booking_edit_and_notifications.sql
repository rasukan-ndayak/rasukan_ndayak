-- 002_rasukan_booking_edit_and_notifications.sql
-- Aman dijalankan setelah 001_rasukan_ndayak.sql.
-- Memperbaiki penyimpanan edit booking dan menyiapkan log reminder cloud.

create table if not exists public.rental_notification_logs (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  notification_date date not null,
  kind text not null default 'rental_preparation',
  status text not null default 'sending'
    check (status in ('sending', 'sent', 'failed')),
  attempts integer not null default 0,
  sent_at timestamptz,
  last_error text,
  provider_response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (booking_id, notification_date, kind)
);

create index if not exists rental_notification_logs_date_idx
  on public.rental_notification_logs(notification_date, status);

alter table public.rental_notification_logs enable row level security;

-- Tidak ada policy anon/authenticated. Log reminder hanya diakses Edge Function
-- menggunakan service role/secret key.

create or replace function public.claim_rental_reminder(
  p_booking_id uuid,
  p_notification_date date,
  p_kind text default 'rental_preparation'
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.rental_notification_logs (
    booking_id,
    notification_date,
    kind,
    status,
    attempts,
    updated_at
  )
  values (
    p_booking_id,
    p_notification_date,
    p_kind,
    'sending',
    1,
    now()
  )
  on conflict (booking_id, notification_date, kind)
  do update set
    status = 'sending',
    attempts = rental_notification_logs.attempts + 1,
    last_error = null,
    provider_response = null,
    updated_at = now()
  where rental_notification_logs.status = 'failed'
     or (
       rental_notification_logs.status = 'sending'
       and rental_notification_logs.updated_at < now() - interval '15 minutes'
     )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.claim_rental_reminder(uuid, date, text)
  to service_role;
