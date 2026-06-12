import { NextResponse } from "next/server";
import { createDokuCheckout } from "@/lib/doku";
import { clientIp, rateLimit } from "@/lib/security";
import { createPendingOrder, deletePendingOrder, updateOrderPaymentUrl } from "@/lib/store";

export const dynamic = "force-dynamic";

type JoinRequest = {
  name?: string;
  email?: string;
};

function appOrigin(request: Request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      return configured.replace(/\/$/, "");
    }
  }
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export async function POST(request: Request) {
  const limit = rateLimit(`join:${clientIp(request)}`, 8, 10 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Terlalu banyak percobaan daftar." }, { status: 429 });
  }

  try {
    const body = (await request.json()) as JoinRequest;
    const fallbackPaymentUrl = `${appOrigin(request)}/payment/__ORDER_ID__`;

    const pending = await createPendingOrder({
      name: body.name ?? "",
      email: body.email ?? "",
      paymentUrl: fallbackPaymentUrl,
    });
    const { order } = pending;

    try {
      const dokuPaymentUrl = await createDokuCheckout({
        orderId: order.id,
        name: order.name,
        email: order.email,
      });
      await updateOrderPaymentUrl(order.id, dokuPaymentUrl);
      order.paymentUrl = dokuPaymentUrl;
    } catch (error) {
      if (pending.created) {
        await deletePendingOrder(order.id);
      }
      throw error;
    }

    return NextResponse.json({
      order: {
        id: order.id,
        amount: order.amount,
        status: order.status,
        paymentUrl: order.paymentUrl,
        provider: order.provider,
        createdAt: order.createdAt,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal membuat order." },
      { status: 400 },
    );
  }
}
