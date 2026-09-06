# Perbaikan Database Rasukan Ndayak

## Penting setelah data produk terhapus

Migration ini **tidak menghapus data**. Namun migration juga tidak dapat mengembalikan baris produk yang sudah terhapus. Pemulihan baris lama harus berasal dari backup/PITR/export Supabase.

Jalankan pengecekan berikut terlebih dahulu:

```sql
select count(*) as jumlah_produk from public.products;
select count(*) as jumlah_booking from public.bookings;
select count(*) as jumlah_pelanggan from public.customers;
```

Jika produk masih kosong, jangan menjalankan `RESET_LAMA_SEKALI.sql` lagi. Cari backup/PITR/export Supabase untuk mengembalikan data produk.

## Setelah database aman

Jalankan file:

`supabase/migrations/004_booking_time_status_notifications.sql`

Migration tersebut menambahkan:

- jam ambil, jam pentas, dan jam kembali;
- format timestamp untuk WIB;
- status operasional admin;
- produk aktif/nonaktif;
- deskripsi pelanggan;
- pengecekan bentrok berdasarkan interval waktu;
- notifikasi perubahan booking;
- RPC perubahan jadwal/status yang aman dan atomik;
- dukungan beberapa transaksi pada tanggal yang sama jika waktunya tidak bertabrakan.

## Format waktu

Semua waktu aplikasi menggunakan WIB dan format 24 jam:

`00:00` sampai `23:59`

Harga tetap dihitung **per hari**, bukan per jam.
