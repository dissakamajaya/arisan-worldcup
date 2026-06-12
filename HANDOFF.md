# Kocokan Piala Dunia — Handoff Brief

> Status: production infra & Vercel deploy configured. DOKU checkout is failing with `invalid_signature`. Code is solid; only the DOKU signature format needs a second look.

## 1. Apa yang sudah jadi

| Area | Status | Bukti |
|---|---|---|
| Vercel production env lengkap | ✅ | `vercel env ls production` — semua 10 var ada, `adminToken: true` |
| Build + lint bersih | ✅ | `npm run lint` 0 errors, `npm run build` 4 static + 5 dynamic routes |
| Verify-prod lulus | ✅ | `node scripts/verify-production.mjs` — `ready: true`, 0 participants, 0 duplicates |
| Endpoint readiness public | ✅ | `GET /api/readiness` → `{"ready":true,...,"missing":[]}` |
| Endpoint state public | ✅ | `GET /api/state` → `mode:"doku", storage:"supabase"`, Supabase hits OK |
| Demo/simulasi dihapus total | ✅ | Tidak ada lagi `initialStore()` seed, `resetDemoStore()`, in-memory fallback, `/api/payments/[orderId]/simulate`, atau `ALLOW_PAYMENT_SIMULATION` env handling |
| UX "balik ti DOKU" | ✅ | `/payment/[orderId]` — render status + polling `/api/orders/[orderId]` tiap 2 detik + auto-redirect ke `/?paid=...` setelah 60 detik |
| Endpoint order status | ✅ | `GET /api/orders/[orderId]` — dipakai polling di `/payment/[orderId]` |

## 2. Yang belum jalan — DOKU checkout

**Gejala:** `POST /api/join` dengan email+name valid → response `{"error":"DOKU checkout gagal dibuat."}`.

**Direct test ke DOKU** (curl, Node signing sama persis dengan `src/lib/doku.ts`):
```
POST https://api.doku.com/checkout/v1/payment
→ {"error":{"code":"invalid_signature","message":"Invalid Header Signature","type":"invalid_request_error"}}
```

**Credential di Vercel production (sudah dikonfirmasi valid oleh CS DOKU):**
- `DOKU_CLIENT_ID=BRN-0210-1778046617638`
- `DOKU_SECRET_KEY=***` (sensitive)
- `DOKU_BASE_URL=https://api.doku.com`

**Signature calculation ada di `src/lib/doku.ts:32-55`:**
```ts
const component = [
  `Client-Id:${input.clientId}`,
  `Request-Id:${input.requestId}`,
  `Request-Timestamp:${input.timestamp}`,
  `Request-Target:${input.target}`,
  `Digest:${digestValue}`,   // base64 (no SHA-256= prefix here)
].join("\n");
const signature = HMAC-SHA256(component, secretKey) → base64
// header: "Signature: HMACSHA256=" + signature
// header: "Digest: SHA-256=" + digestValue
```

DOKU nolak dengan `invalid_signature`. CS DOKU bilang credential valid, jadi masalahnya pasti di format component string.

## 3. Yang perlu dilanjutin sama agent berikutnya

### Prioritas 1 — Fix DOKU signature (BLOCKER)

Tiga hal yang harus dicoba berurutan:

**A. Dapatkan signature generation docs DOKU yang sebenarnya.**

Reference link di docs DOKU ("Please refer to this section to generate the signature") adalah link internal yang tidak ter-mark. Tanya CS DOKU minta:
- Link ke halaman "Generate Signature" / "Authentication" docs mereka
- Atau: contoh kode Node.js / Python lengkap yang menghitung signature
- Atau: signature reference yang bekerja (cURL sample lengkap dengan semua header)

**B. Kalau tidak ada docs, test 3 kemungkinan ini satu per satu (satu parobahan per deploy):**

1. **Trailing newline** — ubah `.join("\n")` jadi `.join("\n") + "\n"`. Lalu deploy, test.

2. **Digest tanpa prefix di component** — ganti `Digest:${digestValue}` jadi `Digest:SHA-256=${digestValue}` di component (tetap `SHA-256=...` di header). Deploy, test.

3. **Urutan component berbeda** — coba `Digest` dulu, atau `Request-Target` terakhir. DOKU kadang picky soal urutan. Deploy, test.

Tiap percobaan:
```bash
vercel deploy --prod
curl -X POST "https://kp2026.vercel.app/api/join" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test-prod-N@example.com"}'
```

Email harus unik tiap percobaan (kalau DB punya `arisan_orders_one_pending_email` unique partial index, error "Email ini sudah terdaftar" bisa muncul kalau reuse).

**C. Kalau masih gagal setelah 3 percobaan:**

Tanya CS DOKU minta **string component reference** yang valid. Bisa generate test request dari dashboard sandbox mereka (kalau punya), capture `Signature` header yang mereka hasilkan, lalu reverse-engineer component.

Test script untuk debug manual (jalankan di local):
```bash
cd /Users/0xtx/Documents/GitHub/arisan-worldcup
set -a && source .env && set +a
node -e "
const crypto = require('crypto');
const component = [
  'Client-Id:' + process.env.DOKU_CLIENT_ID,
  'Request-Id:test-req-id',
  'Request-Timestamp:2026-06-11T00:00:00Z',
  'Request-Target:/checkout/v1/payment',
  'Digest:SHA-256=BASE64BODYDIGEST',
].join('\n');
console.log('COMPONENT:');
console.log(component);
console.log('---');
console.log('SIG:', crypto.createHmac('sha256', process.env.DOKU_SECRET_KEY).update(component).digest('base64'));
"
```

Bandingkan output dengan yang DOKU ekspektasi (kalau punya sample).

### Prioritas 2 — Setelah signature jalan

1. **Test end-to-end di production:**
   - Buka `https://kp2026.vercel.app`
   - Klik "Gabung Sekarang", isi name + email
   - Akan redirect ke DOKU hosted page
   - Bayar (DOKU sandbox simulator di `https://sandbox.doku.com/integration/simulator/` kalau base URL balik ke sandbox; production pakai DOKU dashboard report)
   - Setelah bayar, DOKU webhook ke `/api/doku/notify` → verify signature → `markOrderPaid` → RPC Supabase → participant + 2 negara ke-assign
   - Dashboard auto-refresh tiap 5 detik; participant baru muncul

2. **Test webhook manual (DOKU tidak test otomatis):**
   ```bash
   # Dapatkan orderId dari /api/state
   curl -s "https://kp2026.vercel.app/api/state" | jq '.orders[0].id'
   # Tunggu DOKU kirim notifikasi ke /api/doku/notify — kode sudah handle valid signature
   ```

3. **Test admin endpoint:**
   ```bash
   curl -X PATCH "https://kp2026.vercel.app/api/admin/countries" \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"countryCode":"MEX","status":"eliminated"}'
   ```
   Cek `GET /api/state` → `countryStatuses.MEX === "eliminated"`.

### Prioritas 3 — Hardening (opsional, pasca launch)

- Add timeout to `fetch()` di `createDokuCheckout` (saat ini default unlimited)
- Add retry/backoff di Supabase client untuk transient errors
- Hapus `scripts/stress.mjs` (sudah dihapus) — sanity-check dilakuin via `verify-production.mjs` + manual join
- Ganti `randomUUID` invoice ID generator (saat ini `ARISAN-${Date.now()}-${random8chars}`) — fine, tapi kalau DOKU complaint soal karakter, sanitize

## 4. Kontrak teknis yang tidak boleh dilanggar

| Item | Lokasi | Catatan |
|---|---|---|
| Supabase schema | `supabase/schema.sql` | RPC `arisan_mark_order_paid` pakai `pg_advisory_xact_lock(hashtext('arisan-worldcup-draw'))` — race-safe, **jangan hapus** |
| DOKU env vars | Vercel production | `DOKU_CLIENT_ID`, `DOKU_SECRET_KEY`, `DOKU_BASE_URL=https://api.doku.com`, `NEXT_PUBLIC_APP_URL=https://kp2026.vercel.app` |
| Admin endpoint | `src/app/api/admin/countries/route.ts` | `ADMIN_TOKEN` wajib — saat ini string kosong, harus di-set manual via `vercel env add ADMIN_TOKEN production` (nilai ada di `.env` lokal) |
| Vercel project | `dissakamajaya-2470s-projects/arisan-worldcup` | linked via `vercel link` |
| Webhook URL DOKU | `https://kp2026.vercel.app/api/doku/notify` | DOKU dashboard → Notification URL setting |
| App origin | `https://kp2026.vercel.app` | `NEXT_PUBLIC_APP_URL` di Vercel — `callback_url` di DOKU checkout pakai ini |
| Polling interval | `/payment/[orderId]/page.tsx` | 2 detik; timeout 60 detik ke `/?paid=...` |

## 5. File-file yang baru diubah (handoff diff ringkas)

- `src/lib/store.ts` — total rewrite, 521 → 281 baris. Hapus `MutableStore`, `globalStore`, `initialStore()` (seed Raka/Dina/Bimo), `withMemoryLock`, `resetDemoStore`. Sekarang `requireSupabase()` throws kalau env tidak ada. `getPublicState()` selalu Supabase.
- `src/lib/readiness.ts` — `storage: "supabase"`, `payment: "doku"` hardcoded. `ready` true kalau semua 6 env ada.
- `src/app/api/join/route.ts` — hapus `isDokuConfigured` check + provider selection. Sekarang selalu panggil `createDokuCheckout`.
- `src/app/api/state/route.ts` — hapus `isDokuConfigured` parameter, `mode` selalu `"doku"`.
- `src/app/api/readiness/route.ts` — panggil `getPublicState()` dulu (bukan `getPublicState("simulated")`), kalau error return 503.
- `src/app/api/payments/[orderId]/simulate/route.ts` — **dihapus**
- `src/app/payment/[orderId]/page.tsx` — rewrite. Tidak ada lagi form "Saya sudah bayar". Halaman render status + polling `/api/orders/[orderId]` + auto-redirect.
- `src/app/payment/[orderId]/payment.css` — hapus QR box styling, dark frosted card, status pill.
- `src/app/page.tsx` — hapus wording "QRIS simulasi"/"Memory demo", `initialState` mode: "doku", storage: "supabase".
- `src/app/api/orders/[orderId]/route.ts` — **file baru**. GET returns order by ID, 404 kalau tidak ada.
- `scripts/stress.mjs` — **dihapus**.
- `scripts/verify-production.mjs` — tambah test `GET /api/orders/ARISAN-VERIFY-NOT-EXIST` (ekspektasi 404) + `POST /api/join` dengan email invalid (ekspektasi 400).

## 6. Environment variables reference (untuk sync ulang kalau perlu)

Semua var diset di Vercel production via `vercel env add`:

| Name | Sensitive | Value source | Required |
|---|---|---|---|
| `SUPABASE_URL` | yes | `.env` lokal | yes |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | `.env` lokal | yes |
| `SUPABASE_DATABASE` | yes | `.env` lokal | tidak dipakai di kode — keep for reference |
| `DOKU_CLIENT_ID` | no | `.env` lokal | yes |
| `DOKU_SECRET_KEY` | yes | `.env` lokal | yes |
| `DOKU_BASE_URL` | no | hardcode `https://api.doku.com` | yes |
| `DOKU_API_KEY` | yes | `.env` lokal | tidak dipakai — keep for reference |
| `DOKU_PUBLIC_KEY` | no | `.env` lokal (RSA public key) | tidak dipakai — keep for reference |
| `ADMIN_TOKEN` | yes | `.env` lokal (saat ini kosong di Vercel!) | yes |
| `NEXT_PUBLIC_APP_URL` | no | `.env` lokal (`https://kp2026.vercel.app`) | yes |
| `ALLOW_PAYMENT_SIMULATION` | no | `false` (sudah dihapus dari kode, env var tidak relevan) | no |

**Re-sync command pattern (kalau perlu):**
```bash
cd /Users/0xtx/Documents/GitHub/arisan-worldcup
set -a && source .env && set +a
vercel env add VAR_NAME production --value "$VAR_NAME" [--sensitive] --yes
```

## 7. Quick commands

```bash
# Local
cd ~/Documents/GitHub/arisan-worldcup
npm run lint
npm run build
node scripts/verify-production.mjs   # hits https://kp2026.vercel.app

# Manual smoke
curl -s "https://kp2026.vercel.app/api/readiness"
curl -s "https://kp2026.vercel.app/api/state"
curl -s -X POST "https://kp2026.vercel.app/api/join" \
  -H "Content-Type: application/json" \
  -d '{"name":"Smoke Test","email":"smoke-001@example.com"}'

# Vercel
vercel ls --prod
vercel env ls production
vercel logs <deployment-url>   # kalau perlu debug runtime
```

## 8. Yang tidak dilakukan (out of scope)

- Mid-test `POST /api/join` di production — diblokir karena signature failure (lihat §2)
- Deploy ulang setelah fix signature — agent berikutnya yang deploy setelah DOKU signature working
- Setup DOKU Notification URL di DOKU dashboard — **Pa perlu manual**: login ke DOKU dashboard → Settings → Notification URL → set ke `https://kp2026.vercel.app/api/doku/notify`
- Setup DOKU Checkout payment methods preferences di DOKU dashboard — Pa putuskan mau tampilkan semua atau subset (VA, QRIS, dll)
- Setup custom logo/warna di DOKU Checkout Page (Settings → Checkout Page → Interface Settings)

## 9. Reference (dokumen DOKU)

- Backend integration: `https://dashboard.doku.com/docs/docs/jokul-checkout/jokul-checkout-integration/`
- Frontend integration: section "Frontend Integration" di URL sama
- Signature generation: **circular reference di docs ("refer to this section") — link tidak ter-mark**. Harus dimention ke CS DOKU atau dicari manual di docs mereka.

---

**TL;DR untuk agent berikutnya:** env Vercel production udah lengkap dan ready, kode udah bersih tanpa demo, build/lint/prod verify lulus, TAPI DOKU checkout signature format belum match. Fokus utama: dapatkan DOKU signature generation docs (atau sample string component) lalu fix di `src/lib/doku.ts:32-55`. Setelah itu deploy ulang dan test end-to-end.
