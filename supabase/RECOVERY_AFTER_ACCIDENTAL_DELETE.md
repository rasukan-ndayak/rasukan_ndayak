# Pemulihan setelah data produk terhapus

Jika tabel `products` menjadi kosong karena SQL reset/delete, jangan jalankan reset lagi.

1. Periksa jumlah data:

```sql
select count(*) as jumlah_produk from public.products;
select count(*) as jumlah_booking from public.bookings;
select count(*) as jumlah_pelanggan from public.customers;
```

2. Jika data memang sudah terhapus, data tidak dapat direkonstruksi dari source code project karena katalog awal pada project ini tidak menyimpan daftar produk (`baseProducts` kosong).

3. Pemulihan data lama harus dilakukan dari backup/PITR/export Supabase jika tersedia. Setelah data dipulihkan, jalankan migration baru `004_booking_time_status_notifications.sql`.

4. Jangan menggunakan `RESET_LAMA_SEKALI.sql` untuk pemulihan. File tersebut sekarang memiliki pengaman dan secara default akan menolak reset.
