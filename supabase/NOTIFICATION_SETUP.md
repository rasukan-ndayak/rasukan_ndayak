# Setup Reminder WhatsApp Cloud

Project sebelumnya **belum mempunyai scheduler cloud maupun API WhatsApp otomatis**.
Kode lama hanya membuat link `wa.me`, sehingga tidak mungkin mengirim WhatsApp otomatis ketika admin tidak membuka website.

Versi baru menambahkan:

- `supabase/functions/rental-reminder/index.ts`
- log anti-duplikasi `rental_notification_logs`
- Supabase Cron + pg_net
- pengiriman WhatsApp melalui Fonnte dari sisi server
- notifikasi browser sebagai tambahan ketika panel admin sedang terbuka

Supabase Cron dapat memanggil Edge Function secara berkala melalui `pg_cron` + `pg_net`; kredensial scheduler sebaiknya disimpan di Vault. Lihat dokumentasi Supabase untuk scheduling Edge Functions.

## 1. Jalankan migration

Di Supabase SQL Editor, jalankan:

```sql
-- isi file:
supabase/migrations/002_rasukan_booking_edit_and_notifications.sql
```

## 2. Deploy Edge Function

Dari root project:

```bash
supabase functions deploy rental-reminder --no-verify-jwt
```

Function ini memang dipanggil oleh scheduler server-to-server, bukan oleh browser.

## 3. Isi secret Edge Function

Di Supabase Dashboard → Edge Functions → Secrets, tambahkan:

```text
FONNTE_TOKEN=TOKEN_FONNTE_ANDA
NOTIFICATION_WA_TARGET=628xxxxxxxxxx
CRON_SECRET=buat-secret-random-yang-panjang
```

Jangan masukkan token Fonnte ke `VITE_*`, frontend, GitHub, atau `.env` yang di-commit.

Fonnte menggunakan `Authorization: TOKEN` pada endpoint `https://api.fonnte.com/send`.
Pastikan device WhatsApp Fonnte sudah terhubung.

## 4. Aktifkan scheduler

Aktifkan extension `pg_cron` dan `pg_net` dari Supabase Dashboard jika belum aktif.

Kemudian buat dua secret Vault:

```sql
select vault.create_secret(
  'https://PROJECT-REF.supabase.co',
  'rasukan_project_url'
);

select vault.create_secret(
  'ISI_DENGAN_NILAI_CRON_SECRET_YANG_SAMA_DENGAN_EDGE_FUNCTION',
  'rasukan_cron_secret'
);
```

Ganti `PROJECT-REF` dan nilai secret sesuai project.

Lalu jadwalkan:

```sql
select cron.schedule(
  'rasukan-rental-reminder',
  '*/5 0 * * *',
  $$
    select net.http_post(
      url := (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'rasukan_project_url'
      ) || '/functions/v1/rental-reminder',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'rasukan_cron_secret'
        )
      ),
      body := jsonb_build_object(
        'source', 'pg_cron',
        'run_at', now()
      )
    ) as request_id;
  $$
);
```

`*/5 0 * * *` berarti setiap 5 menit pada jam 00:00–00:59 UTC,
yaitu sekitar 07:00–07:59 WIB.

Function hanya akan mengirim **sekali per booking per tanggal**, sehingga
tidak spam walaupun Cron berjalan berkali-kali.

Untuk melihat job:

```sql
select jobid, jobname, schedule, active
from cron.job
where jobname = 'rasukan-rental-reminder';
```

Untuk melihat hasil eksekusi:

```sql
select *
from cron.job_run_details
order by start_time desc
limit 20;
```

## 5. Tes manual

Setelah deploy dan secret terpasang, function dapat dites dari Supabase Dashboard
dengan request POST memakai header:

```text
x-cron-secret: NILAI_CRON_SECRET
```

Body:

```json
{
  "source": "manual-test"
}
```

Agar pesan dikirim, harus ada booking `confirmed` dengan `start_date` sama
dengan tanggal hari ini menurut zona waktu `Asia/Jakarta`.

## Catatan WhatsApp

Yang otomatis dikirim adalah **reminder ke nomor admin** (`NOTIFICATION_WA_TARGET`)
untuk menyiapkan booking yang keluar hari itu.

Tombol WA di halaman admin tetap dipertahankan untuk menghubungi pelanggan secara manual.

Jika nanti ingin otomatis mengirim reminder langsung ke pelanggan juga,
bisa ditambahkan setelah alur admin ini terbukti stabil.
