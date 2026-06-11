import Link from "next/link";
import { findOrder } from "@/lib/store";
import "./payment.css";

export const dynamic = "force-dynamic";

export default async function PaymentPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const order = findOrder(orderId);

  return (
    <main className="payment-shell">
      <section className="payment-card">
        <div>
          <Link href="/" className="back-link">
            Back to dashboard
          </Link>
          <h1>Scan QRIS untuk menyelesaikan pembayaran</h1>
          <p>
            Order <strong>{orderId}</strong>
          </p>
        </div>

        {order ? (
          <>
            <div className="payment-grid">
              <div className="qr-box" aria-label="Simulated QRIS code">
                <span />
              </div>
              <div className="payment-detail">
                <span>Status</span>
                <strong>{order.status.toUpperCase()}</strong>
                <span>Nama</span>
                <strong>{order.name}</strong>
                <span>Email</span>
                <strong>{order.email}</strong>
                <span>Total</span>
                <strong>
                  Rp{new Intl.NumberFormat("id-ID").format(order.amount)}
                </strong>
              </div>
            </div>
            <form action={`/api/payments/${order.id}/simulate`} method="post">
              <button className="primary-button" type="submit">
                Saya sudah bayar
              </button>
            </form>
            <p className="fine-print">
              Mode ini mensimulasikan layar QRIS DOKU untuk preview publik. Saat env DOKU aktif,
              tombol gabung akan membuka Checkout DOKU asli dan konfirmasi final diproses lewat
              webhook.
            </p>
          </>
        ) : (
          <p>Order tidak ditemukan atau server sudah cold start. Kembali ke dashboard dan daftar ulang.</p>
        )}
      </section>
    </main>
  );
}
