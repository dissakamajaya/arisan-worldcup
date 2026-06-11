import { createHash, createHmac, randomUUID, timingSafeEqual } from "crypto";
import { ENTRY_FEE_IDR } from "./worldcup";

const CHECKOUT_TARGET = "/checkout/v1/payment";

export function isDokuConfigured() {
  return Boolean(process.env.DOKU_CLIENT_ID && process.env.DOKU_SECRET_KEY);
}

function baseUrl() {
  return process.env.DOKU_BASE_URL ?? "https://api-sandbox.doku.com";
}

function appUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.replace(/^/, "https://") ??
    "http://localhost:3000"
  );
}

function digest(body: string) {
  return createHash("sha256").update(body).digest("base64");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function createDokuSignature(input: {
  clientId: string;
  requestId: string;
  timestamp: string;
  target: string;
  body: string;
  secretKey: string;
}) {
  const digestValue = digest(input.body);
  const component = [
    `Client-Id:${input.clientId}`,
    `Request-Id:${input.requestId}`,
    `Request-Timestamp:${input.timestamp}`,
    `Request-Target:${input.target}`,
    `Digest:${digestValue}`,
  ].join("\n");

  return {
    digest: `SHA-256=${digestValue}`,
    signature: `HMACSHA256=${createHmac("sha256", input.secretKey)
      .update(component)
      .digest("base64")}`,
  };
}

export async function createDokuCheckout(input: {
  orderId: string;
  name: string;
  email: string;
}) {
  const clientId = process.env.DOKU_CLIENT_ID;
  const secretKey = process.env.DOKU_SECRET_KEY;
  if (!clientId || !secretKey) {
    throw new Error("DOKU env belum diset.");
  }

  const origin = appUrl();
  const body = JSON.stringify({
    order: {
      amount: ENTRY_FEE_IDR,
      invoice_number: input.orderId,
      currency: "IDR",
      callback_url: `${origin}/berhasil?orderId=${input.orderId}`,
      callback_url_cancel: origin,
      callback_url_result: `${origin}/berhasil?orderId=${input.orderId}`,
      language: "ID",
    },
    payment: {
      payment_due_date: 60,
    },
    customer: {
      id: input.email,
      name: input.name,
      email: input.email,
    },
    additional_info: {
      origin: "kocokan-piala-dunia",
      notes: "Arisan teman teman kocokan Piala Dunia 2026",
    },
  });

  const requestId = randomUUID();
  const timestamp = new Date().toISOString();
  const signature = createDokuSignature({
    clientId,
    requestId,
    timestamp,
    target: CHECKOUT_TARGET,
    body,
    secretKey,
  });

  const fetchUrl = `${baseUrl()}${CHECKOUT_TARGET}`;
  console.error("DOKU request:", {
    url: fetchUrl,
    clientId: clientId?.substring(0, 8) + "...",
    secretKeyLen: secretKey?.length,
    baseUrl: baseUrl(),
    hasEnvBaseUrl: !!process.env.DOKU_BASE_URL,
  });

  const response = await fetch(fetchUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Client-Id": clientId,
      "Request-Id": requestId,
      "Request-Timestamp": timestamp,
      "Request-Target": CHECKOUT_TARGET,
      Digest: signature.digest,
      Signature: signature.signature,
    },
    body,
  });

  const payload = (await response.json().catch(() => ({}))) as {
    response?: { payment?: { url?: string } };
    message?: string[];
    error?: { message?: string };
  };

  if (!response.ok || !payload.response?.payment?.url) {
    console.error("DOKU API Error:", {
      status: response.status,
      statusText: response.statusText,
      payload: JSON.stringify(payload),
      headers: Object.fromEntries(response.headers.entries()),
    });
    const message =
      payload.error?.message ?? payload.message?.join(", ") ?? "DOKU checkout gagal dibuat.";
    throw new Error(message);
  }

  return payload.response.payment.url;
}

export async function parseDokuNotification(request: Request) {
  const body = await request.text();
  const clientId = process.env.DOKU_CLIENT_ID;
  const secretKey = process.env.DOKU_SECRET_KEY;

  if (clientId && secretKey) {
    const url = new URL(request.url);
    const requestId = request.headers.get("Request-Id") ?? "";
    const timestamp = request.headers.get("Request-Timestamp") ?? "";
    const signatureHeader = request.headers.get("Signature") ?? "";
    const digestHeader = request.headers.get("Digest") ?? "";
    const signature = createDokuSignature({
      clientId,
      requestId,
      timestamp,
      target: url.pathname,
      body,
      secretKey,
    });

    if (
      !requestId ||
      !timestamp ||
      !safeEqual(signature.digest, digestHeader) ||
      !safeEqual(signature.signature, signatureHeader)
    ) {
      throw new Error("Signature DOKU tidak valid.");
    }
  }

  const payload = JSON.parse(body) as {
    order?: { invoice_number?: string };
    transaction?: { status?: string };
    service?: { id?: string };
    payment?: { status?: string };
  };

  const transactionStatus =
    payload.transaction?.status ?? payload.payment?.status ?? payload.service?.id ?? "";
  const isPaid = ["SUCCESS", "PAID", "SETTLEMENT", "CAPTURE"].includes(
    transactionStatus.toUpperCase(),
  );

  return {
    body,
    orderId: payload.order?.invoice_number,
    isPaid,
    status: transactionStatus,
  };
}
