import { NextResponse } from "next/server";
import { isBearerTokenAuthorized } from "@/lib/security";
import { updateMatchResult } from "@/lib/store";
import type { MatchStatus } from "@/lib/worldcup";

export const dynamic = "force-dynamic";

type UpdateRequest = {
  matchLabel?: string;
  status?: MatchStatus;
  homeScore?: number;
  awayScore?: number;
};

function isAuthorized(request: Request) {
  return isBearerTokenAuthorized(request, [process.env.ADMIN_TOKEN]);
}

export async function PATCH(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as UpdateRequest;
    if (!body.matchLabel || !body.status) {
      return NextResponse.json({ error: "matchLabel dan status wajib diisi." }, { status: 400 });
    }

    const result = await updateMatchResult({
      matchLabel: body.matchLabel,
      status: body.status,
      homeScore: body.homeScore,
      awayScore: body.awayScore,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal update hasil match." },
      { status: 400 },
    );
  }
}
