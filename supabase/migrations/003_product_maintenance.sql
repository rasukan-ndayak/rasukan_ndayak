-- 003_product_maintenance.sql
-- Menjadwalkan masa perawatan per koleksi agar tidak bisa dibooking pada periode tersebut.

create table if not exists public.product_maintenance (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  note text,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create index if not exists product_maintenance_product_dates_idx
  on public.product_maintenance(product_id, start_date, end_date);

alter table public.product_maintenance enable row level security;

drop policy if exists product_maintenance_public_read on public.product_maintenance;
drop policy if exists product_maintenance_public_insert on public.product_maintenance;
drop policy if exists product_maintenance_public_delete on public.product_maintenance;

create policy product_maintenance_public_read
  on public.product_maintenance for select using (true);
create policy product_maintenance_public_insert
  on public.product_maintenance for insert with check (true);
create policy product_maintenance_public_delete
  on public.product_maintenance for delete using (true);

grant select, insert, delete on public.product_maintenance to anon, authenticated;

create or replace function public.create_product_maintenance(
  p_product_id text,
  p_start date,
  p_end date,
  p_note text default null
) returns public.product_maintenance
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.product_maintenance;
  v_conflict record;
begin
  if p_end < p_start then
    raise exception 'Tanggal akhir perawatan tidak boleh sebelum tanggal mulai';
  end if;

  if not exists (select 1 from public.products where id = p_product_id) then
    raise exception 'Produk % tidak ditemukan', p_product_id;
  end if;

  select b.code, b.start_date, b.end_date
    into v_conflict
  from public.bookings b
  join public.booking_items bi on bi.booking_id = b.id
  where bi.product_id = p_product_id
    and b.status = 'confirmed'
    and b.start_date < p_end
    and b.end_date > p_start
  limit 1;

  if found then
    raise exception 'Tidak bisa memasang perawatan karena ada booking % pada periode yang bertabrakan', v_conflict.code;
  end if;

  insert into public.product_maintenance(product_id, start_date, end_date, note)
  values (p_product_id, p_start, p_end, nullif(trim(coalesce(p_note, '')), ''))
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.create_product_maintenance(text, date, date, text) to anon, authenticated;

-- Ganti fungsi booking agar pengecekan stok juga menghormati masa perawatan.
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

  insert into customers(name, phone)
  values (trim(p_name), nullif(trim(coalesce(p_phone,'')),''))
  returning id into v_customer;

  v_code := 'RN-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,5));
  insert into bookings(code, customer_id, start_date, end_date)
  values (v_code, v_customer, p_start, p_end)
  returning id into v_booking;

  for item in select * from jsonb_array_elements(p_items) loop
    v_product := item->>'productId';
    v_qty := greatest((item->>'qty')::int, 1);

    select stock, price into v_stock, v_price
    from products
    where id = v_product
    for update;

    if not found then raise exception 'Produk % tidak ditemukan', v_product; end if;

    if exists (
      select 1
      from product_maintenance pm
      where pm.product_id = v_product
        and pm.start_date < p_end
        and pm.end_date >= p_start
    ) then
      raise exception 'Koleksi % sedang dalam masa perawatan pada tanggal yang dipilih', v_product;
    end if;

    select coalesce(sum(bi.qty),0) into v_reserved
    from booking_items bi
    join bookings b on b.id=bi.booking_id
    where bi.product_id=v_product
      and b.status='confirmed'
      and b.start_date < p_end
      and b.end_date > p_start;

    if v_reserved + v_qty > v_stock then
      raise exception 'Stok % tidak cukup untuk tanggal % sampai %. Tersedia %, diminta %',
        v_product, p_start, p_end, greatest(v_stock-v_reserved,0), v_qty;
    end if;

    insert into booking_items(booking_id, product_id, qty, price_at_booking)
    values (v_booking, v_product, v_qty, v_price)
    returning jsonb_build_object('id', id, 'productId', product_id, 'qty', qty, 'priceAtBooking', price_at_booking)
    into item;

    v_items := v_items || jsonb_build_array(item);

    insert into stock_transactions(product_id, booking_id, type, qty, note)
    values (v_product, v_booking, 'booking', v_qty, 'Reservasi otomatis');
  end loop;

  return jsonb_build_object('code', v_code, 'bookingId', v_booking, 'items', v_items);
exception when others then
  raise;
end;
$$;

grant execute on function public.create_booking(text,text,date,date,jsonb) to anon, authenticated;
