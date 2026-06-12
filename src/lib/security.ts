import { createHmac, timingSafeEqual } from "crypto";

const DASHBOARD_COOKIE = "awc_dashboard_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function constantTimeEqual(left: string, right: string) {
  if (!left || !right) {
    return false;
  }
  return safeEqual(left, right);
}

export function isBearerTokenAuthorized(request: Request, tokens: Array<string | undefined>) {
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) {
    return false;
  }

  const suppliedToken = authorization.slice("Bearer ".length);
  return tokens.some((token) => Boolean(token) && constantTimeEqual(suppliedToken, token as string));
}

export function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!domain) return "***@***";
  const first = local.at(0) ?? "*";
  return `${first}${"*".repeat(Math.max(local.length - 1, 3))}@${domain}`;
}

function sessionSecret() {
  return process.env.DASHBOARD_SESSION_SECRET ?? process.env.ADMIN_TOKEN ?? process.env.DOKU_SECRET_KEY;
}

function dashboardPassword() {
  return process.env.DASHBOARD_PASSWORD ?? process.env.ADMIN_TOKEN;
}

function signSession(expiresAt: number, secret: string) {
  return createHmac("sha256", secret).update(`dashboard:${expiresAt}`).digest("base64url");
}

function parseCookie(header: string | null, name: string) {
  if (!header) return undefined;
  const match = header
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined;
}

export function createDashboardSessionCookie() {
  const secret = sessionSecret();
  if (!secret) {
    throw new Error("DASHBOARD_SESSION_SECRET atau ADMIN_TOKEN wajib diset.");
  }

  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const token = `${expiresAt}.${signSession(expiresAt, secret)}`;
  return {
    name: DASHBOARD_COOKIE,
    value: token,
    options: {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
    },
  };
}

export function isDashboardPasswordValid(password: string) {
  const expected = dashboardPassword();
  if (!expected) {
    return false;
  }
  return constantTimeEqual(password, expected);
}

export function isDashboardAuthenticated(request: Request) {
  const secret = sessionSecret();
  if (!secret) {
    return false;
  }

  const token = parseCookie(request.headers.get("cookie"), DASHBOARD_COOKIE);
  const [expiresRaw, signature] = token?.split(".") ?? [];
  const expiresAt = Number(expiresRaw);
  if (!expiresAt || !signature || expiresAt < Math.floor(Date.now() / 1000)) {
    return false;
  }

  return constantTimeEqual(signature, signSession(expiresAt, secret));
}

type LimitBucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, LimitBucket>();

export function clientIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, resetAt: now + windowMs };
  }

  bucket.count += 1;
  return { allowed: bucket.count <= limit, resetAt: bucket.resetAt };
}
