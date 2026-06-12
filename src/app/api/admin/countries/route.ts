import { NextResponse } from "next/server";
import { isBearerTokenAuthorized } from "@/lib/security";
import { updateCountryStatus } from "@/lib/store";
import type { TeamStatus } from "@/lib/worldcup";

export const dynamic = "force-dynamic";

type UpdateRequest = {
  countryCode?: string;
  status?: TeamStatus;
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
    if (!body.countryCode || !["alive", "eliminated"].includes(body.status ?? "")) {
      return NextResponse.json({ error: "countryCode dan status wajib valid." }, { status: 400 });
    }

    const result = await updateCountryStatus(body.countryCode, body.status as TeamStatus);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal update status negara." },
      { status: 400 },
    );
  }
}
