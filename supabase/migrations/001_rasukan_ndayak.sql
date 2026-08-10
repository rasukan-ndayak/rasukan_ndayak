create extension if not exists pgcrypto;

drop view if exists public.product_availability;
drop table if exists public.stock_transactions cascade;
drop table if exists public.booking_items cascade;
drop table if exists public.bookings cascade;
drop table if exists public.customers cascade;
drop table if exists public.products cascade;
drop type if exists public.product_category cascade;

do $$ begin
  create type public.product_category as enum ('Kostum','Kuluk Lancur','Kuluk Mentok','Klinting','Aksesoris');
exception when duplicate_object then null; end $$;

create table public.products (
  id text primary key,
  name text not null,
  category public.product_category not null,
  unit text not null check (unit in ('pcs','stell')),
  price numeric(14,2) not null default 0 check (price >= 0),
  stock integer not null default 0 check (stock >= 0),
  image_url text,
  description text,
  details jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  customer_id uuid not null references public.customers(id) on delete restrict,
  start_date date not null,
  end_date date not null,
  status text not null default 'confirmed' check (status in ('confirmed','cancelled','returned')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create table public.booking_items (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  product_id text not null references public.products(id) on delete restrict,
  qty integer not null check (qty > 0),
  price_at_booking numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);

create table public.stock_transactions (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products(id) on delete restrict,
  booking_id uuid references public.bookings(id) on delete set null,
  type text not null check (type in ('booking','return','adjustment_in','adjustment_out','cancel')),
  qty integer not null check (qty > 0),
  note text,
  created_at timestamptz not null default now()
);

create index bookings_dates_idx on public.bookings(start_date, end_date) where status <> 'cancelled';
create index booking_items_booking_idx on public.booking_items(booking_id);
create index booking_items_product_idx on public.booking_items(product_id);
create index stock_transactions_product_idx on public.stock_transactions(product_id, created_at desc);

create or replace view public.product_availability as
select p.id, p.name, p.category, p.unit, p.price, p.stock, p.image_url, p.description, p.details, p.created_at, p.updated_at
from public.products p;

create or replace function public.create_booking(
  p_name text,
  p_phone text,
  p_start date,
  p_end date,
  p_items jsonb
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_customer uuid;
  v_booking uuid;
  v_code text;
  item jsonb;
  v_product text;
  v_qty int;
  v_stock int;
  v_reserved int;
  v_price numeric;
  v_items jsonb := '[]'::jsonb;
begin
  if trim(coalesce(p_name,'')) = '' then raise exception 'Nama penyewa wajib diisi'; end if;
  if p_end < p_start then raise exception 'Tanggal masuk tidak boleh sebelum tanggal keluar'; end if;
  if jsonb_array_length(p_items) = 0 then raise exception 'Minimal satu produk harus dipilih'; end if;

  insert into customers(name, phone) values (trim(p_name), nullif(trim(coalesce(p_phone,'')),'')) returning id into v_customer;

  v_code := 'RN-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,5));
  insert into bookings(code, customer_id, start_date, end_date) values (v_code, v_customer, p_start, p_end) returning id into v_booking;

  for item in select * from jsonb_array_elements(p_items) loop
    v_product := item->>'productId';
    v_qty := greatest((item->>'qty')::int, 1);
    select stock, price into v_stock, v_price from products where id = v_product for update;
    if not found then raise exception 'Produk % tidak ditemukan', v_product; end if;

    select coalesce(sum(bi.qty),0) into v_reserved
    from booking_items bi join bookings b on b.id=bi.booking_id
    where bi.product_id=v_product and b.status='confirmed'
      and b.start_date < p_end and b.end_date > p_start;

    if v_reserved + v_qty > v_stock then
      raise exception 'Stok % tidak cukup untuk tanggal % sampai %. Tersedia %, diminta %', v_product, p_start, p_end, greatest(v_stock-v_reserved,0), v_qty;
    end if;

    insert into booking_items(booking_id, product_id, qty, price_at_booking) values (v_booking, v_product, v_qty, v_price) returning jsonb_build_object('id', id, 'productId', product_id, 'qty', qty) into item;
    v_items := v_items || jsonb_build_array(item);
    insert into stock_transactions(product_id, booking_id, type, qty, note) values (v_product, v_booking, 'booking', v_qty, 'Reservasi otomatis');
  end loop;

  return jsonb_build_object('code', v_code, 'bookingId', v_booking, 'items', v_items);
exception when others then
  raise;
end;
$$;

create or replace function public.cancel_booking(p_code text) returns boolean
language plpgsql security definer set search_path=public
as $$
declare b record;
begin
  select id into b from bookings where lower(code)=lower(trim(p_code)) and status='confirmed' for update;
  if not found then return false; end if;
  update bookings set status='cancelled', updated_at=now() where id=b.id;
  insert into stock_transactions(product_id, booking_id, type, qty, note)
    select product_id, booking_id, 'cancel', qty, 'Booking dibatalkan' from booking_items where booking_id=b.id;
  return true;
end;
$$;

-- RLS: katalog boleh dibaca publik; booking boleh dibuat lewat RPC.
-- Untuk kemudahan setup awal, operasi admin katalog juga diizinkan oleh anon.
-- Setelah Supabase Auth admin diaktifkan, kebijakan write ini sebaiknya dibatasi ke authenticated/admin.
alter table public.products enable row level security;
alter table public.customers enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_items enable row level security;
alter table public.stock_transactions enable row level security;

create policy products_public_read on public.products for select using (true);
create policy products_public_insert on public.products for insert with check (true);
create policy products_public_update on public.products for update using (true) with check (true);
create policy products_public_delete on public.products for delete using (true);

create policy customers_public_read on public.customers for select using (true);
create policy customers_public_insert on public.customers for insert with check (true);
create policy customers_public_update on public.customers for update using (true) with check (true);

create policy bookings_public_read on public.bookings for select using (true);
create policy booking_items_public_read on public.booking_items for select using (true);
create policy booking_items_public_update on public.booking_items for update using (true) with check (true);
create policy booking_items_public_delete on public.booking_items for delete using (true);
create policy bookings_public_update on public.bookings for update using (true) with check (true);
create policy bookings_public_delete on public.bookings for delete using (true);
create policy stock_transactions_public_read on public.stock_transactions for select using (true);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.products to anon, authenticated;
grant select, insert, update on public.customers to anon, authenticated;
grant select, update, delete on public.bookings, public.booking_items to anon, authenticated;
grant select on public.stock_transactions to anon, authenticated;
grant execute on function public.create_booking(text,text,date,date,jsonb) to anon, authenticated;
grant execute on function public.cancel_booking(text) to anon, authenticated;

