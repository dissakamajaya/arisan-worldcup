import Link from "next/link";
import { getDokuOrderStatus, isPaidDokuStatus } from "@/lib/doku";
import { markOrderPaid } from "@/lib/store";
import "../payment/[orderId]/payment.css";

export const dynamic = "force-dynamic";

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string }>;
}) {
  const { orderId } = await searchParams;
  const status = await reconcileOrder(orderId);
  const isRegistered = status === "paid" || !orderId;

  return (
    <main className="payment-shell">
      <section className="payment-card success-card">
        <div className="success-mark" aria-hidden="true">
          ✓
        </div>
        <div>
          <h1>{isRegistered ? "Kamu sudah terdaftar" : "Pembayaran sedang diverifikasi"}</h1>
          <p>
            {isRegistered
              ? "Pembayaran berhasil diproses. Nama kamu sudah masuk ke dashboard dan negara akan tampil di daftar peserta."
              : "DOKU belum mengirim status sukses untuk order ini. Kembali ke home untuk cek dashboard beberapa saat lagi."}
          </p>
        </div>
        <Link className="primary-button success-home" href="/">
          Kembali ke Home
        </Link>
        <OrderHint orderId={orderId} />
      </section>
    </main>
  );
}

async function reconcileOrder(orderId?: string) {
  if (!orderId) {
    return "paid";
  }

  try {
    const status = await getDokuOrderStatus(orderId);
    if (isPaidDokuStatus(status.transactionStatus)) {
      await markOrderPaid(orderId);
      return "paid";
    }
  } catch (error) {
    console.error("DOKU success page reconciliation failed", {
      orderId,
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }

  return "pending";
}

function OrderHint({ orderId }: { orderId?: string }) {
  if (!orderId) {
    return null;
  }

  return <p className="fine-print">Order: {orderId}</p>;
}
