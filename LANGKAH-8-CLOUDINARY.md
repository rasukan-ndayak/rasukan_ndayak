# Langkah 8 — Upload Foto Produk Otomatis ke Cloudinary

Project ini sudah disiapkan agar admin tidak perlu membuka Cloudinary untuk mengunggah foto produk.

## Alur

Admin → Produk → Unggah Foto → Cloudinary → URL secure_url → Supabase `products.image_url` → foto tampil di website.

## Environment variable

Buat `.env.local` di folder utama project:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_CLOUDINARY_CLOUD_NAME=
VITE_CLOUDINARY_UPLOAD_PRESET=
```

Isi `VITE_CLOUDINARY_CLOUD_NAME` dengan Cloud Name Cloudinary Anda dan `VITE_CLOUDINARY_UPLOAD_PRESET` dengan preset unsigned yang sudah dibuat.

## Catatan

- Foto katalog awal boleh kosong.
- Produk tanpa foto tidak lagi menghasilkan `<img src="">`.
- Foto dioptimalkan di browser sebelum upload.
- Upload memakai unsigned upload preset; API Secret Cloudinary tidak diperlukan di frontend.
- Folder upload default: `rasukan-ndayak/products`.
- Data produk langsung disimpan ke Supabase setelah tombol Tambah Produk / Simpan Perubahan dijalankan.
- Tombol Save palsu/penyimpanan lokal untuk perubahan produk sudah dihilangkan; operasi produk menggunakan Supabase secara langsung.
