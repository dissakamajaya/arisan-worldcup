# Kocokan Piala Dunia

Dashboard arisan World Cup 2026 untuk 24 peserta. Setiap peserta mendaftar dengan nama dan email, membayar lewat DOKU Checkout atau QRIS simulasi, lalu mendapat 2 negara unik dari total 48 negara.

## Fitur

- Dashboard peserta dengan dua negara per peserta.
- Maksimal 24 peserta.
- Assignment negara dikunci hanya setelah pembayaran sukses.
- Guard server-side agar email dan negara tidak duplikat.
- Grup A-L World Cup 2026 dan jadwal sampai final.
- State negara gugur sudah didukung lewat kelas `is-eliminated`.
- API webhook DOKU di `/api/doku/notify`.
- Mode simulasi pembayaran untuk preview tanpa credential merchant.
- Supabase production storage dengan RPC transaksi agar 2 peserta tidak bisa mendapat negara yang sama.
- Admin API terlindungi token untuk update status negara gugur.

## Mode Payment

Tanpa env DOKU, aplikasi memakai mode `simulated` dan tombol bayar membuka `/payment/[orderId]`.

Untuk DOKU live, set env berikut di Vercel:

```bash
DOKU_CLIENT_ID=...
DOKU_SECRET_KEY=...
DOKU_BASE_URL=https://api-sandbox.doku.com
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
```

Webhook/HTTP Notification DOKU diarahkan ke:

```text
https://your-domain.vercel.app/api/doku/notify
```

Saat DOKU env aktif, webhook memverifikasi `Digest` dan `Signature` DOKU sebelum menandai order sebagai paid.

## Production Database

Untuk public launch yang durable, buat database Supabase, jalankan `supabase/schema.sql`, lalu set env server-side:

```bash
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
ADMIN_TOKEN=...
```

`SUPABASE_SERVICE_ROLE_KEY` hanya dipakai di server route Vercel. Jangan expose key ini ke browser.

Update negara gugur:

```bash
curl -X PATCH https://your-domain.vercel.app/api/admin/countries \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"countryCode":"MEX","status":"eliminated"}'
```

## Development

```bash
npm install
npm run dev
```

## Verification

```bash
npm run lint
npm run build
STRESS_BASE_URL=http://127.0.0.1:3000 npm run stress
```

## Production Persistence

Tanpa env Supabase, aplikasi fallback ke in-memory demo store agar preview bisa langsung dibuka. Mode itu tidak cukup untuk uang sungguhan karena serverless runtime bisa cold start. Public launch harus memakai env Supabase di atas.
