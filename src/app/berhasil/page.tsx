import Link from "next/link";
import "../payment/[orderId]/payment.css";

export default function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string }>;
}) {
  return (
    <main className="payment-shell">
      <section className="payment-card success-card">
        <div className="success-mark" aria-hidden="true">
          ✓
        </div>
        <div>
          <h1>Kamu sudah terdaftar</h1>
          <p>
            Pembayaran berhasil diproses. Nama kamu sudah masuk ke dashboard dan negara akan
            tampil di daftar peserta.
          </p>
        </div>
        <Link className="primary-button success-home" href="/">
          Kembali ke Home
        </Link>
        <OrderHint searchParams={searchParams} />
      </section>
    </main>
  );
}

async function OrderHint({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string }>;
}) {
  const { orderId } = await searchParams;
  if (!orderId) {
    return null;
  }

  return <p className="fine-print">Order: {orderId}</p>;
}
