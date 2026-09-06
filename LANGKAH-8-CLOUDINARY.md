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

# Hanya untuk server / Vercel, jangan gunakan prefix VITE_
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_PRODUCT_FOLDER=rasukan-ndayak/products
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

## Mengakses kembali folder produk

Di Admin → Produk → tambah/edit produk, gunakan tombol **Folder Cloudinary**.
Galeri tersebut membaca folder melalui Server Function dan Cloudinary Admin API,
lalu memasukkan `secure_url` gambar yang dipilih ke produk.

Tambahkan `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, dan
`CLOUDINARY_PRODUCT_FOLDER` sebagai environment variable server di Vercel atau
environment deployment Anda. API Secret tidak boleh diletakkan di `.env.local`
dengan prefix `VITE_` atau dikirim ke browser.
