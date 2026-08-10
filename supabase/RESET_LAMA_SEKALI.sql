-- JALANKAN SEKALI SAJA jika Anda memang ingin memulai katalog dari nol.
-- PERINGATAN: ini menghapus seluruh booking, item booking, transaksi stok, pelanggan, dan produk lama.
-- Jangan jalankan jika histori booking lama masih dibutuhkan.

truncate table public.stock_transactions, public.booking_items, public.bookings, public.customers, public.products restart identity cascade;
