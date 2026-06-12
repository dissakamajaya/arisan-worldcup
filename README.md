# Kocokan Piala Dunia

Dashboard arisan World Cup 2026 untuk 24 peserta. Setiap peserta mendaftar dengan nama dan email, membayar lewat DOKU Checkout, lalu mendapat 2 negara unik dari total 48 negara.

## Fitur

- Dashboard peserta dengan dua negara per peserta.
- Maksimal 24 peserta.
- Assignment negara dikunci hanya setelah pembayaran sukses.
- Guard server-side agar email dan negara tidak duplikat.
- Grup A-L World Cup 2026 dan jadwal sampai final.
- State negara gugur sudah didukung lewat kelas `is-eliminated`.
- API webhook DOKU di `/api/doku/notify`.
- Supabase production storage dengan RPC transaksi agar 2 peserta tidak bisa mendapat negara yang sama.
- Admin API terlindungi token untuk update status negara gugur.
- Readiness endpoint di `/api/readiness` untuk membuktikan apakah deploy sudah public-ready.
- Password dashboard diverifikasi server-side dan disimpan sebagai cookie httpOnly.

## Mode Payment

Untuk DOKU live, set env berikut di Vercel:

```bash
DOKU_CLIENT_ID=...
DOKU_SECRET_KEY=...
DOKU_BASE_URL=https://api-sandbox.doku.com
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
DASHBOARD_PASSWORD=...
DASHBOARD_SESSION_SECRET=...
```

Webhook/HTTP Notification DOKU diarahkan ke:

```text
https://your-domain.vercel.app/api/doku/notify
```

Webhook wajib memverifikasi `Client-Id`, `Digest`, `Signature`, dan timestamp DOKU sebelum menandai order sebagai paid. Tanpa env DOKU yang valid, webhook gagal tertutup dan tidak akan membuat peserta paid.

## Production Database

Untuk public launch yang durable, buat database Supabase, jalankan `supabase/schema.sql`, lalu set env server-side:

```bash
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
ADMIN_TOKEN=...
CRON_SECRET=...
```

`SUPABASE_SERVICE_ROLE_KEY` hanya dipakai di server route Vercel. Jangan expose key ini ke browser.

Set env di Vercel:

```bash
vercel env add SUPABASE_URL production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add ADMIN_TOKEN production
vercel env add CRON_SECRET production
vercel env add DOKU_CLIENT_ID production
vercel env add DOKU_SECRET_KEY production
vercel env add DOKU_BASE_URL production
vercel env add NEXT_PUBLIC_APP_URL production
vercel env add DASHBOARD_PASSWORD production
vercel env add DASHBOARD_SESSION_SECRET production
vercel deploy --prod
```

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
REQUIRE_PUBLIC_READY=false npm run verify:prod
```

`npm run verify:prod` tanpa `REQUIRE_PUBLIC_READY=false` wajib gagal jika production masih memakai `Memory demo` atau `QRIS simulasi`. Setelah Supabase dan DOKU env aktif, command itu menjadi gate akhir sebelum link dibagikan publik.

## Production Persistence

Tanpa env Supabase, aplikasi fallback ke in-memory demo store agar preview bisa langsung dibuka. Mode itu tidak cukup untuk uang sungguhan karena serverless runtime bisa cold start. Public launch harus memakai env Supabase di atas.
