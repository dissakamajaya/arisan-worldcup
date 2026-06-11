import { NextResponse } from "next/server";
import { isDokuConfigured } from "@/lib/doku";
import { getPublicState } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getPublicState(isDokuConfigured() ? "doku" : "simulated"));
}
