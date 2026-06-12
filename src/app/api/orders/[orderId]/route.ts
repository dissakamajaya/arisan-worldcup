import { NextResponse } from "next/server";
import { findOrder } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await context.params;
  const order = await findOrder(orderId);
  if (!order) {
    return NextResponse.json({ error: "Order tidak ditemukan." }, { status: 404 });
  }
  return NextResponse.json({
    order: {
      id: order.id,
      status: order.status,
      paidAt: order.paidAt,
    },
  });
}
