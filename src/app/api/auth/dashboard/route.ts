import { NextResponse } from "next/server";
import {
  clientIp,
  createDashboardSessionCookie,
  isDashboardAuthenticated,
  isDashboardPasswordValid,
  rateLimit,
} from "@/lib/security";

export const dynamic = "force-dynamic";

type LoginRequest = {
  password?: string;
};

export async function GET(request: Request) {
  return NextResponse.json({ authenticated: isDashboardAuthenticated(request) });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LoginRequest;

    // Correct password always succeeds — rate limit only burns on failures so
    // legit users sharing a NAT/CGNAT IP are never locked out by others' typos.
    if (!isDashboardPasswordValid(body.password ?? "")) {
      const limit = rateLimit(`dashboard-login:${clientIp(request)}`, 10, 10 * 60 * 1000);
      if (!limit.allowed) {
        return NextResponse.json({ error: "Terlalu banyak percobaan login." }, { status: 429 });
      }
      return NextResponse.json({ error: "Password salah." }, { status: 401 });
    }

    const cookie = createDashboardSessionCookie();
    const response = NextResponse.json({ authenticated: true });
    response.cookies.set(cookie.name, cookie.value, cookie.options);
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Login gagal." },
      { status: 400 },
    );
  }
}
