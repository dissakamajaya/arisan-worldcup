import { NextResponse } from "next/server";
import { createDokuCheckout, isDokuConfigured } from "@/lib/doku";
import { createPendingOrder, updateOrderPaymentUrl } from "@/lib/store";

export const dynamic = "force-dynamic";

type JoinRequest = {
  name?: string;
  email?: string;
};

function appOrigin(request: Request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) {
    return configured;
  }
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as JoinRequest;
    const provider = isDokuConfigured() ? "doku" : "simulated";
    const fallbackPaymentUrl = `${appOrigin(request)}/payment/__ORDER_ID__`;

    const order = await createPendingOrder({
      name: body.name ?? "",
      email: body.email ?? "",
      provider,
      paymentUrl: fallbackPaymentUrl,
    });

    if (provider === "doku" && order.paymentUrl.includes("/payment/")) {
      const dokuPaymentUrl = await createDokuCheckout({
        orderId: order.id,
        name: order.name,
        email: order.email,
      });
      await updateOrderPaymentUrl(order.id, dokuPaymentUrl);
      order.paymentUrl = dokuPaymentUrl;
    }

    return NextResponse.json({ order });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal membuat order." },
      { status: 400 },
    );
  }
}
