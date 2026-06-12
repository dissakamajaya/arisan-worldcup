import { NextResponse } from "next/server";
import { isBearerTokenAuthorized } from "@/lib/security";
import { syncLiveScoresFromEspn } from "@/lib/store";

export const dynamic = "force-dynamic";

function isAuthorized(request: Request) {
  return isBearerTokenAuthorized(request, [process.env.ADMIN_TOKEN, process.env.CRON_SECRET]);
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const result = await syncLiveScoresFromEspn();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal sync live score." },
      { status: 500 },
    );
  }
}
