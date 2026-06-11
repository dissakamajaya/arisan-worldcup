import { createHash, createHmac, randomUUID, timingSafeEqual } from "crypto";
import { ENTRY_FEE_IDR } from "./worldcup";

const CHECKOUT_TARGET = "/checkout/v1/payment";
const PAID_STATUSES = ["SUCCESS", "PAID", "SETTLEMENT", "CAPTURE"];

export function isDokuConfigured() {
  return Boolean(process.env.DOKU_CLIENT_ID && process.env.DOKU_SECRET_KEY);
}

function baseUrl() {
  return process.env.DOKU_BASE_URL ?? "https://api-sandbox.doku.com";
}

function appUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) {
    // Ensure we only return origin (protocol + host), strip any path
    try {
      const url = new URL(configured);
      return url.origin;
    } catch {
      return configured.replace(/\/$/, "");
    }
  }
  const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercelUrl) {
    return vercelUrl.startsWith("http") ? vercelUrl.replace(/\/$/, "") : `https://${vercelUrl}`.replace(/\/$/, "");
  }
  return "http://localhost:3000";
}

function digest(body: string) {
  return createHash("sha256").update(body).digest("base64");
}

function requestTimestamp() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function customerName(name: string) {
  return name.replace(/[^a-zA-Z\s]/g, " ").replace(/\s+/g, " ").trim() || "Peserta Arisan";
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

function createDokuGetSignature(input: {
  clientId: string;
  requestId: string;
  timestamp: string;
  target: string;
  secretKey: string;
}) {
  const component = [
    `Client-Id:${input.clientId}`,
    `Request-Id:${input.requestId}`,
    `Request-Timestamp:${input.timestamp}`,
    `Request-Target:${input.target}`,
  ].join("\n");

  return `HMACSHA256=${createHmac("sha256", input.secretKey).update(component).digest("base64")}`;
}

export function isPaidDokuStatus(status: string) {
  return PAID_STATUSES.includes(status.toUpperCase());
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
      auto_redirect: true,
      line_items: [
        {
          id: "ARISANPIALADUNIA",
          name: "Arisan Piala Dunia",
          price: ENTRY_FEE_IDR,
          quantity: 1,
        },
      ],
    },
    payment: {
      payment_due_date: 60,
      payment_method_types: ["QRIS"],
    },
    customer: {
      name: customerName(input.name),
      email: input.email,
    },
  });

  const requestId = randomUUID();
  const timestamp = requestTimestamp();
  const signature = createDokuSignature({
    clientId,
    requestId,
    timestamp,
    target: CHECKOUT_TARGET,
    body,
    secretKey,
  });

  const fetchUrl = `${baseUrl()}${CHECKOUT_TARGET}`;

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

  const responseText = await response.text();

  let payload: {
    response?: { payment?: { url?: string } };
    message?: string[];
    error?: { message?: string };
  } = {};
  try {
    payload = JSON.parse(responseText || "{}");
  } catch {
    // non-JSON response
  }

  if (!response.ok || !payload.response?.payment?.url) {
    const message =
      payload.error?.message ?? payload.message?.join(", ") ?? "DOKU checkout gagal dibuat.";
    console.error("DOKU checkout failed", {
      status: response.status,
      requestId,
      message,
      responseBody: responseText.slice(0, 500),
    });
    throw new Error(`${message} (HTTP ${response.status}, request ${requestId})`);
  }

  return payload.response.payment.url;
}

export async function getDokuOrderStatus(orderId: string) {
  const clientId = process.env.DOKU_CLIENT_ID;
  const secretKey = process.env.DOKU_SECRET_KEY;
  if (!clientId || !secretKey) {
    throw new Error("DOKU env belum diset.");
  }

  const target = `/orders/v1/status/${encodeURIComponent(orderId)}`;
  const requestId = randomUUID();
  const timestamp = requestTimestamp();
  const signature = createDokuGetSignature({
    clientId,
    requestId,
    timestamp,
    target,
    secretKey,
  });

  const response = await fetch(`${baseUrl()}${target}`, {
    headers: {
      "Client-Id": clientId,
      "Request-Id": requestId,
      "Request-Timestamp": timestamp,
      Signature: signature,
    },
    cache: "no-store",
  });
  const responseText = await response.text();

  let payload: {
    order?: { status?: string };
    transaction?: { status?: string };
    channel?: { id?: string };
    acquirer?: { id?: string };
    message?: string[];
    error?: { message?: string };
  } = {};
  try {
    payload = JSON.parse(responseText || "{}");
  } catch {
    // non-JSON response
  }

  if (!response.ok) {
    const message =
      payload.error?.message ?? payload.message?.join(", ") ?? "Status order DOKU gagal dicek.";
    throw new Error(`${message} (HTTP ${response.status}, request ${requestId})`);
  }

  return {
    orderStatus: payload.order?.status ?? "",
    transactionStatus: payload.transaction?.status ?? "",
    channel: payload.channel?.id ?? "",
    acquirer: payload.acquirer?.id ?? "",
  };
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
  const isPaid = isPaidDokuStatus(transactionStatus);

  return {
    body,
    orderId: payload.order?.invoice_number,
    isPaid,
    status: transactionStatus,
  };
}
