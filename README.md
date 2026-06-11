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

Preview ini menyertakan in-memory store agar langsung deployable tanpa resource baru. Untuk publik yang durable, pakai database managed. Schema awal Supabase tersedia di `supabase/schema.sql`; setelah credentials database dipilih, storage adapter bisa diarahkan ke tabel itu.
