# Rasukan Ndayak — Setup sekali

Project ini sudah disiapkan agar setelah konfigurasi sekali, alur berikut berjalan otomatis:

GitHub → Vercel → Supabase (produk, booking, stok, kalender) + Cloudinary (foto produk)

## 1. Supabase

1. Buat project di Supabase.
2. Buka **SQL Editor → New query**.
3. Buka `supabase/migrations/001_rasukan_ndayak.sql` dari project ini.
4. Copy semua SQL → paste → **Run**.
5. Pastikan tabel `products`, `customers`, `bookings`, `booking_items`, dan `stock_transactions` muncul.
6. Ambil **Project URL** dan **anon public key** dari **Project Settings → API**.

SQL tersebut sudah mengisi katalog awal dari website, tetapi **semua foto sengaja kosong**.

## 2. Cloudinary

1. Buat akun Cloudinary.
2. Buka **Settings → Upload → Upload presets**.
3. Buat satu **Unsigned upload preset**, misalnya `rasukan_products`.
4. Catat:
   - Cloud name
   - Upload preset
5. Jangan taruh API Secret Cloudinary di frontend.

Saat admin memilih foto produk, website akan:

foto → optimasi → upload Cloudinary → URL Cloudinary → simpan URL ke Supabase.

## 3. VS Code

Buat file `.env.local` di root project:

```env
VITE_SUPABASE_URL=https://PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
VITE_CLOUDINARY_CLOUD_NAME=YOUR_CLOUD_NAME
VITE_CLOUDINARY_UPLOAD_PRESET=YOUR_UNSIGNED_PRESET
```

Jangan commit `.env.local` ke GitHub.

## 4. Admin produk

Setelah Supabase dan Cloudinary aktif:

- Tambah produk → otomatis tersimpan di Supabase.
- Edit produk → otomatis tersimpan di Supabase.
- Hapus produk → otomatis dihapus dari Supabase.
- Upload foto → otomatis masuk Cloudinary dan URL tersimpan di Supabase.
- Foto awal katalog kosong agar admin bisa mengisinya sendiri.
- Produk baru langsung muncul di katalog/booking setelah data dimuat ulang.

## 5. Booking dan stok

Saat pelanggan membuat booking:

1. Website memanggil fungsi database `create_booking`.
2. Supabase mengunci pengecekan stok agar dua booking bersamaan tidak mengambil stok yang sama.
3. Booking masuk ke `bookings` + `booking_items`.
4. Riwayat masuk ke `stock_transactions`.
5. Kalender `/jadwal` membaca booking dari Supabase.
6. Dashboard admin membaca booking yang sama.

`products.stock` adalah stok fisik. Ketersediaan pada tanggal tertentu dihitung dari stok fisik dikurangi booking aktif yang tanggalnya bertabrakan. Ini lebih aman daripada mengurangi stok fisik permanen setiap kali ada booking jauh-jauh hari.

## 6. Vercel

Push project ke GitHub, lalu di Vercel pilih **Import Project → repository GitHub**.

Tambahkan Environment Variables yang sama dengan `.env.local`:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_CLOUDINARY_CLOUD_NAME`
- `VITE_CLOUDINARY_UPLOAD_PRESET`

Lalu deploy.

Setiap `git push` berikutnya akan memicu deploy otomatis di Vercel.

## Catatan keamanan

Versi ini dibuat agar mudah dipasang tanpa backend tambahan. Karena panel admin lama menggunakan password frontend, policy katalog saat ini masih mengizinkan operasi write melalui anon. Untuk production yang benar-benar aman, tahap berikutnya sebaiknya mengganti AdminGate dengan **Supabase Auth + RLS role admin**. Jangan memasukkan Supabase service-role key atau Cloudinary API Secret ke frontend/Vercel `VITE_*`.
