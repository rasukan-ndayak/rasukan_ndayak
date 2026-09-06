-- Repair only the booking RPC. This is safe for existing products and bookings.
-- Run this file in Supabase SQL Editor if create_booking_v2 is missing from the schema cache.

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
  if trim(coalesce(p_name, '')) = '' then
    raise exception 'Nama penyewa wajib diisi';
  end if;
  if p_end < p_start then
    raise exception 'Tanggal kembali tidak boleh sebelum tanggal ambil';
  end if;
  if p_pickup_at >= p_performance_at or p_performance_at >= p_return_at then
    raise exception 'Urutan waktu harus ambil -> pentas -> kembali';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Minimal satu produk harus dipilih';
  end if;
  if p_pickup_at::date <> p_start or p_return_at::date <> p_end then
    raise exception 'Tanggal timestamp tidak sesuai tanggal ambil/kembali';
  end if;
  if p_performance_at::date < p_start or p_performance_at::date > p_end then
    raise exception 'Tanggal pentas harus berada di antara tanggal ambil dan kembali';
  end if;

  insert into public.customers(name, phone, description)
  values (
    trim(p_name),
    nullif(trim(coalesce(p_phone, '')), ''),
    nullif(trim(coalesce(p_description, '')), '')
  )
  returning id into v_customer;

  v_code := 'RN-' || to_char(now() at time zone 'Asia/Jakarta', 'YYMMDD') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 5));

  insert into public.bookings(
    code, customer_id, start_date, end_date,
    pickup_at, performance_at, return_at, status
  )
  values (
    v_code, v_customer, p_start, p_end,
    p_pickup_at, p_performance_at, p_return_at, 'confirmed'
  )
  returning id into v_booking;

  for item in select * from jsonb_array_elements(p_items) loop
    v_product := item->>'productId';
    v_qty := greatest(coalesce((item->>'qty')::int, 1), 1);

    select stock, price
    into v_stock, v_price
    from public.products
    where id = v_product and active = true
    for update;

    if not found then
      raise exception 'Produk % tidak ditemukan atau sedang nonaktif', v_product;
    end if;

    if exists (
      select 1
      from public.product_maintenance pm
      where pm.product_id = v_product
        and pm.start_date <= p_end
        and pm.end_date >= p_start
    ) then
      raise exception 'Koleksi % sedang dalam masa perawatan pada periode yang dipilih', v_product;
    end if;

    select coalesce(sum(bi.qty), 0)
    into v_reserved
    from public.booking_items bi
    join public.bookings b on b.id = bi.booking_id
    where bi.product_id = v_product
      and b.status <> 'cancelled'
      and coalesce(b.pickup_at, (b.start_date::text || ' 00:00:00+07')::timestamptz) < p_return_at
      and coalesce(
        b.return_at,
        case
          when b.end_date = b.start_date then ((b.end_date + 1)::text || ' 00:00:00+07')::timestamptz
          else (b.end_date::text || ' 00:00:00+07')::timestamptz
        end
      ) > p_pickup_at;

    if v_reserved + v_qty > v_stock then
      raise exception 'Stok % tidak cukup pada jam yang dipilih. Tersedia %, diminta %',
        v_product, greatest(v_stock - v_reserved, 0), v_qty;
    end if;

    insert into public.booking_items(booking_id, product_id, qty, price_at_booking)
    values (v_booking, v_product, v_qty, v_price)
    returning jsonb_build_object(
      'id', id,
      'productId', product_id,
      'qty', qty,
      'priceAtBooking', price_at_booking
    ) into item;

    v_items := v_items || jsonb_build_array(item);

    insert into public.stock_transactions(product_id, booking_id, type, qty, note)
    values (v_product, v_booking, 'booking', v_qty, 'Reservasi otomatis');
  end loop;

  insert into public.booking_notifications(booking_id, customer_id, kind, title, message)
  values (
    v_booking,
    v_customer,
    'created',
    'Booking tercatat',
    'Booking ' || v_code || ' sudah tercatat. Admin akan memproses konfirmasi dan perubahan status.'
  );

  return jsonb_build_object(
    'code', v_code,
    'bookingId', v_booking,
    'customerId', v_customer,
    'status', 'confirmed',
    'items', v_items
  );
end;
$$;

grant execute on function public.create_booking_v2(
  text, text, text, date, date, timestamptz, timestamptz, timestamptz, jsonb
) to anon, authenticated;

notify pgrst, 'reload schema';
