import { NextResponse } from "next/server";
import { syncLiveScoresFromEspn } from "@/lib/store";

export const dynamic = "force-dynamic";

function isAuthorized(request: Request) {
  const adminToken = process.env.ADMIN_TOKEN;
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (adminToken && authorization === `Bearer ${adminToken}`) {
    return true;
  }
  if (cronSecret && authorization === `Bearer ${cronSecret}`) {
    return true;
  }
  return false;
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
