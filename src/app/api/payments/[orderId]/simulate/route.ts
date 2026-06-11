import { NextResponse } from "next/server";
import { isDokuConfigured } from "@/lib/doku";
import { markOrderPaid } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  if (isDokuConfigured() && process.env.ALLOW_PAYMENT_SIMULATION !== "true") {
    return NextResponse.json({ error: "Simulasi pembayaran dimatikan." }, { status: 403 });
  }

  try {
    const { orderId } = await context.params;
    const participant = await markOrderPaid(orderId);
    if (request.headers.get("accept")?.includes("text/html")) {
      return NextResponse.redirect(new URL(`/berhasil?orderId=${orderId}`, request.url), 303);
    }
    return NextResponse.json({ participant });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Pembayaran gagal diproses." },
      { status: 400 },
    );
  }
}
