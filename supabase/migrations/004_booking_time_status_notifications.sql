-- 004_booking_time_status_notifications.sql
-- Penambahan aman: tidak menghapus data lama.
-- Jadwal baru menggunakan timestamp WIB, sementara start_date/end_date tetap dipertahankan untuk kompatibilitas dan harga per hari.

alter table public.products add column if not exists active boolean not null default true;
alter table public.customers add column if not exists description text;
alter table public.bookings add column if not exists pickup_at timestamptz;
alter table public.bookings add column if not exists performance_at timestamptz;
alter table public.bookings add column if not exists return_at timestamptz;

-- Status operasional admin.
alter table public.bookings drop constraint if exists bookings_status_check;
alter table public.bookings add constraint bookings_status_check
  check (status in ('pending','confirmed','picked_up','paid','returned','cancelled'));

create index if not exists bookings_pickup_return_idx on public.bookings(pickup_at, return_at) where status <> 'cancelled';
create index if not exists bookings_performance_idx on public.bookings(performance_at) where status <> 'cancelled';

create table if not exists public.booking_notifications (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  kind text not null,
  title text not null,
  message text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists booking_notifications_booking_idx on public.booking_notifications(booking_id, created_at desc);

alter table public.booking_notifications enable row level security;
drop policy if exists booking_notifications_public_read on public.booking_notifications;
create policy booking_notifications_public_read on public.booking_notifications for select using (true);

grant select on public.booking_notifications to anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'booking_notifications_kind_check') then
    alter table public.booking_notifications add constraint booking_notifications_kind_check
      check (kind in ('created','schedule_changed','status_changed','cancelled','admin_message'));
  end if;
end $$;

create or replace function public.create_booking_v2(
  p_name text,
  p_phone text,
  p_description text,
  p_start date,
  p_end date,
  p_pickup_at timestamptz,
  p_performance_at timestamptz,
  p_return_at timestamptz,
  p_items jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
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
  if p_end < p_start then raise exception 'Tanggal kembali tidak boleh sebelum tanggal ambil'; end if;
  if p_pickup_at >= p_performance_at or p_performance_at >= p_return_at then raise exception 'Urutan waktu harus ambil → pentas → kembali'; end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then raise exception 'Minimal satu produk harus dipilih'; end if;
  if (p_pickup_at::date <> p_start) or (p_return_at::date <> p_end) then raise exception 'Tanggal timestamp tidak sesuai tanggal ambil/kembali'; end if;
  if p_performance_at::date < p_start or p_performance_at::date > p_end then raise exception 'Tanggal pentas harus berada di antara tanggal ambil dan kembali'; end if;

  insert into customers(name, phone, description)
  values (trim(p_name), nullif(trim(coalesce(p_phone,'')),''), nullif(trim(coalesce(p_description,'')),''))
  returning id into v_customer;

  v_code := 'RN-' || to_char(now() at time zone 'Asia/Jakarta', 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,5));
  insert into bookings(code, customer_id, start_date, end_date, pickup_at, performance_at, return_at, status)
  values (v_code, v_customer, p_start, p_end, p_pickup_at, p_performance_at, p_return_at, 'confirmed')
  returning id into v_booking;

  for item in select * from jsonb_array_elements(p_items) loop
    v_product := item->>'productId';
    v_qty := greatest(coalesce((item->>'qty')::int, 1), 1);

    select stock, price into v_stock, v_price from products where id = v_product and active = true for update;
    if not found then raise exception 'Produk % tidak ditemukan atau sedang nonaktif', v_product; end if;

    if exists (
      select 1 from product_maintenance pm
      where pm.product_id = v_product
        and pm.start_date <= p_end
        and pm.end_date >= p_start
    ) then
      raise exception 'Koleksi % sedang dalam masa perawatan pada periode yang dipilih', v_product;
    end if;

    select coalesce(sum(bi.qty),0) into v_reserved
    from booking_items bi
    join bookings b on b.id = bi.booking_id
    where bi.product_id = v_product
      and b.status <> 'cancelled'
      and coalesce(b.pickup_at, (b.start_date::text || ' 00:00:00+07')::timestamptz) < p_return_at
      and coalesce(b.return_at, case when b.end_date = b.start_date then ((b.end_date + 1)::text || ' 00:00:00+07')::timestamptz else (b.end_date::text || ' 00:00:00+07')::timestamptz end) > p_pickup_at;

    if v_reserved + v_qty > v_stock then
      raise exception 'Stok % tidak cukup pada jam yang dipilih. Tersedia %, diminta %', v_product, greatest(v_stock-v_reserved,0), v_qty;
    end if;

    insert into booking_items(booking_id, product_id, qty, price_at_booking)
    values (v_booking, v_product, v_qty, v_price)
    returning jsonb_build_object('id', id, 'productId', product_id, 'qty', qty, 'priceAtBooking', price_at_booking) into item;
    v_items := v_items || jsonb_build_array(item);

    insert into stock_transactions(product_id, booking_id, type, qty, note)
    values (v_product, v_booking, 'booking', v_qty, 'Reservasi otomatis');
  end loop;

  insert into booking_notifications(booking_id, customer_id, kind, title, message)
  values (v_booking, v_customer, 'created', 'Booking tercatat', 'Booking ' || v_code || ' sudah tercatat. Admin akan memproses konfirmasi dan perubahan status.');

  return jsonb_build_object('code', v_code, 'bookingId', v_booking, 'customerId', v_customer, 'status', 'confirmed', 'items', v_items);
end;
$$;

grant execute on function public.create_booking_v2(text,text,text,date,date,timestamptz,timestamptz,timestamptz,jsonb) to anon, authenticated;

create or replace function public.update_booking_schedule_v2(
  p_booking_id uuid,
  p_start date,
  p_end date,
  p_pickup_at timestamptz,
  p_performance_at timestamptz,
  p_return_at timestamptz
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_customer uuid;
  v_item record;
  v_reserved int;
begin
  if p_end < p_start then raise exception 'Tanggal kembali tidak boleh sebelum tanggal ambil'; end if;
  if p_pickup_at >= p_performance_at or p_performance_at >= p_return_at then raise exception 'Urutan waktu harus ambil → pentas → kembali'; end if;
  if p_pickup_at::date <> p_start or p_return_at::date <> p_end then raise exception 'Tanggal dan waktu booking tidak sinkron'; end if;
  if p_performance_at::date < p_start or p_performance_at::date > p_end then raise exception 'Tanggal pentas harus berada di antara tanggal ambil dan kembali'; end if;

  select code, customer_id into v_code, v_customer from bookings where id = p_booking_id for update;
  if not found then raise exception 'Booking tidak ditemukan'; end if;

  for v_item in select bi.product_id, bi.qty from booking_items bi where bi.booking_id = p_booking_id loop
    select coalesce(sum(bi2.qty),0) into v_reserved
    from booking_items bi2
    join bookings b2 on b2.id = bi2.booking_id
    where bi2.product_id = v_item.product_id
      and b2.id <> p_booking_id
      and b2.status <> 'cancelled'
      and coalesce(b2.pickup_at, b2.start_date::timestamptz) < p_return_at
      and coalesce(b2.return_at, case when b2.end_date = b2.start_date then (b2.end_date + 1)::timestamptz else b2.end_date::timestamptz end) > p_pickup_at;

    if v_reserved + v_item.qty > (select stock from products where id = v_item.product_id and active = true) then
      raise exception 'Jadwal % bertabrakan dengan stok koleksi %', v_code, v_item.product_id;
    end if;

    if exists (select 1 from product_maintenance pm where pm.product_id = v_item.product_id and pm.start_date <= p_end and pm.end_date >= p_start) then
      raise exception 'Jadwal % bertabrakan dengan masa perawatan koleksi %', v_code, v_item.product_id;
    end if;
  end loop;

  update bookings
  set start_date=p_start, end_date=p_end, pickup_at=p_pickup_at, performance_at=p_performance_at, return_at=p_return_at, updated_at=now()
  where id=p_booking_id;

  insert into booking_notifications(booking_id, customer_id, kind, title, message)
  values (p_booking_id, v_customer, 'schedule_changed', 'Jadwal booking berubah', 'Jadwal booking ' || v_code || ' telah diperbarui oleh admin. Silakan cek kembali tanggal dan jam ambil, pentas, serta kembali.');
  return true;
end;
$$;

grant execute on function public.update_booking_schedule_v2(uuid,date,date,timestamptz,timestamptz,timestamptz) to anon, authenticated;

create or replace function public.update_booking_item_v2(p_item_id uuid, p_qty integer) returns boolean
language plpgsql security definer set search_path=public as $$
declare
  v_booking uuid; v_product text; v_stock int; v_reserved int; v_code text;
begin
  if p_qty < 1 then raise exception 'Jumlah unit minimal 1'; end if;
  select booking_id, product_id into v_booking, v_product from booking_items where id=p_item_id for update;
  if not found then raise exception 'Item booking tidak ditemukan'; end if;
  select code into v_code from bookings where id=v_booking and status <> 'cancelled' for update;
  if not found then raise exception 'Booking sudah dibatalkan'; end if;
  select stock into v_stock from products where id=v_product and active=true for update;
  if not found then raise exception 'Produk tidak ditemukan atau nonaktif'; end if;
  select coalesce(sum(bi.qty),0) into v_reserved from booking_items bi join bookings b on b.id=bi.booking_id where bi.product_id=v_product and bi.booking_id<>v_booking and b.status<>'cancelled' and coalesce(b.pickup_at,(b.start_date::text || ' 00:00:00+07')::timestamptz) < coalesce((select return_at from bookings where id=v_booking), ((select end_date from bookings where id=v_booking)::text || ' 00:00:00+07')::timestamptz) and coalesce(b.return_at,case when b.end_date=b.start_date then ((b.end_date+1)::text || ' 00:00:00+07')::timestamptz else (b.end_date::text || ' 00:00:00+07')::timestamptz end) > coalesce((select pickup_at from bookings where id=v_booking),((select start_date from bookings where id=v_booking)::text || ' 00:00:00+07')::timestamptz);
  if v_reserved + p_qty > v_stock then raise exception 'Stok tidak cukup. Tersedia %', greatest(v_stock-v_reserved,0); end if;
  update booking_items set qty=p_qty where id=p_item_id;
  return true;
end; $$;
grant execute on function public.update_booking_item_v2(uuid,integer) to anon, authenticated;

create or replace function public.add_booking_item_v2(p_booking_id uuid, p_product_id text, p_qty integer) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v_stock int; v_reserved int; v_price numeric; v_pickup timestamptz; v_return timestamptz; v_id uuid;
begin
  if p_qty < 1 then raise exception 'Jumlah unit minimal 1'; end if;
  select coalesce(pickup_at, ((start_date::text || ' 00:00:00+07')::timestamptz)), coalesce(return_at, case when end_date=start_date then ((end_date::text || ' 23:59:59+07')::timestamptz) else ((end_date::text || ' 00:00:00+07')::timestamptz) end) into v_pickup, v_return from bookings where id=p_booking_id and status<>'cancelled' for update;
  if not found then raise exception 'Booking tidak ditemukan atau sudah dibatalkan'; end if;
  select stock, price into v_stock, v_price from products where id=p_product_id and active=true for update;
  if not found then raise exception 'Produk tidak ditemukan atau nonaktif'; end if;
  select coalesce(sum(bi.qty),0) into v_reserved from booking_items bi join bookings b on b.id=bi.booking_id where bi.product_id=p_product_id and b.id<>p_booking_id and b.status<>'cancelled' and coalesce(b.pickup_at,(b.start_date::text || ' 00:00:00+07')::timestamptz)<v_return and coalesce(b.return_at,case when b.end_date=b.start_date then ((b.end_date+1)::text || ' 00:00:00+07')::timestamptz else (b.end_date::text || ' 00:00:00+07')::timestamptz end)>v_pickup;
  if v_reserved+p_qty>v_stock then raise exception 'Stok tidak cukup. Tersedia %', greatest(v_stock-v_reserved,0); end if;
  insert into booking_items(booking_id,product_id,qty,price_at_booking) values(p_booking_id,p_product_id,p_qty,v_price) returning id into v_id;
  insert into stock_transactions(product_id,booking_id,type,qty,note) values(p_product_id,p_booking_id,'booking',p_qty,'Produk ditambahkan ke booking');
  return jsonb_build_object('id',v_id,'productId',p_product_id,'qty',p_qty,'priceAtBooking',v_price);
end; $$;
grant execute on function public.add_booking_item_v2(uuid,text,integer) to anon, authenticated;

create or replace function public.cancel_booking(p_code text) returns boolean
language plpgsql security definer set search_path=public as $$
declare b record;
begin
  select id, customer_id, code into b from bookings where lower(code)=lower(trim(p_code)) and status<>'cancelled' for update;
  if not found then return false; end if;
  update bookings set status='cancelled', updated_at=now() where id=b.id;
  insert into stock_transactions(product_id, booking_id, type, qty, note) select product_id, booking_id, 'cancel', qty, 'Booking dibatalkan' from booking_items where booking_id=b.id;
  insert into booking_notifications(booking_id, customer_id, kind, title, message) values(b.id,b.customer_id,'cancelled','Booking dibatalkan','Booking '||b.code||' telah dibatalkan.');
  return true;
end; $$;
grant execute on function public.cancel_booking(text) to anon, authenticated;

drop function if exists public.update_booking_status_v2(uuid, text, text);

create or replace function public.update_booking_status_v2(p_booking_id uuid, p_status text, p_admin text default 'admin') returns boolean
language plpgsql security definer set search_path=public as $$
declare v_code text; v_customer uuid; v_label text;
begin
  if p_status not in ('confirmed','picked_up','paid','returned','cancelled') then raise exception 'Status booking tidak valid'; end if;
  select code,customer_id into v_code,v_customer from bookings where id=p_booking_id for update;
  if not found then raise exception 'Booking tidak ditemukan'; end if;
  update bookings set status=p_status, updated_at=now() where id=p_booking_id;
  if p_status = 'cancelled' then
    insert into stock_transactions(product_id, booking_id, type, qty, note)
      select product_id, booking_id, 'cancel', qty, 'Booking dibatalkan dari status admin'
      from booking_items where booking_id=p_booking_id;
  end if;
  v_label := case p_status when 'confirmed' then 'Booking dikonfirmasi' when 'picked_up' then 'Sudah diambil' when 'paid' then 'Sudah dibayar' when 'returned' then 'Sudah kembali' when 'cancelled' then 'Dibatalkan' end;
  insert into booking_notifications(booking_id,customer_id,kind,title,message) values(p_booking_id,v_customer,'status_changed','Status booking berubah',v_label||' untuk booking '||v_code||'.');
  return true;
end; $$;
grant execute on function public.update_booking_status_v2(uuid,text,text) to anon, authenticated;

create or replace function public.get_booking_notifications(p_code text) returns table(id uuid, kind text, title text, message text, created_at timestamptz, read_at timestamptz)
language sql security definer set search_path=public as $$
  select n.id,n.kind,n.title,n.message,n.created_at,n.read_at
  from booking_notifications n join bookings b on b.id=n.booking_id
  where lower(b.code)=lower(trim(p_code)) order by n.created_at desc limit 50;
$$;
grant execute on function public.get_booking_notifications(text) to anon, authenticated;

-- View katalog mempertahankan kolom lama dan menambahkan active untuk kebutuhan admin.
create or replace view public.product_availability as
select p.id,p.name,p.category,p.unit,p.price,p.stock,p.image_url,p.description,p.details,p.created_at,p.updated_at,p.active from public.products p;
