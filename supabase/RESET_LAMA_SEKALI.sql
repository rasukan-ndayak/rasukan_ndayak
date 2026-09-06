-- RESET LAMA (DILINDUNGI)
-- File ini bersifat destruktif dan TIDAK BOLEH dijalankan tanpa sengaja.
-- Untuk reset total, ubah nilai v_confirm menjadi YES secara sadar.

do $$
declare
  v_confirm text := 'NO';
begin
  if v_confirm <> 'YES' then
    raise exception 'RESET DIBATALKAN. File ini menghapus produk, booking, pelanggan, dan transaksi. Jika benar-benar ingin reset total, ubah v_confirm menjadi YES terlebih dahulu.';
  end if;

  truncate table public.stock_transactions, public.booking_items, public.bookings, public.customers, public.products restart identity cascade;
end $$;
