import { NextResponse } from "next/server";
import { parseDokuNotification } from "@/lib/doku";
import { markOrderPaid } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const notification = await parseDokuNotification(request);
    if (!notification.orderId) {
      return NextResponse.json({ error: "invoice_number tidak ditemukan." }, { status: 400 });
    }

    if (!notification.isPaid) {
      return NextResponse.json({ ok: true, ignored: true, status: notification.status });
    }

    const participant = await markOrderPaid(notification.orderId);
    return NextResponse.json({ ok: true, participant });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Webhook DOKU gagal diproses." },
      { status: 400 },
    );
  }
}
