import { createHash, createHmac, randomUUID } from "crypto";
import { readFileSync } from "fs";

// Load .env manually
const envContent = readFileSync(".env", "utf-8");
for (const line of envContent.split("\n")) {
  const match = line.match(/^([A-Z_]+)=(.*)$/);
  if (match) {
    let value = match[2];
    // Remove surrounding quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
}

const CHECKOUT_TARGET = "/checkout/v1/payment";

function digest(body) {
  return createHash("sha256").update(body).digest("base64");
}

function createDokuSignature(input) {
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

const clientId = process.env.DOKU_CLIENT_ID;
const secretKey = process.env.DOKU_SECRET_KEY;
const baseUrl = process.env.DOKU_BASE_URL || "https://api.doku.com";

console.log("Client ID:", clientId);
console.log("Base URL:", baseUrl);
console.log("Secret Key length:", secretKey?.length);

const body = JSON.stringify({
  order: {
    amount: 100000,
    invoice_number: `TEST-NODE-${Date.now()}`,
    currency: "IDR",
    callback_url: "https://arisan-worldcup.vercel.app/berhasil?orderId=TEST",
    callback_url_cancel: "https://arisan-worldcup.vercel.app",
    callback_url_result: "https://arisan-worldcup.vercel.app/berhasil?orderId=TEST",
    language: "ID",
  },
  payment: {
    payment_due_date: 60,
  },
  customer: {
    id: "test-node@example.com",
    name: "Test Node",
    email: "test-node@example.com",
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

console.log("\nRequest headers:");
console.log("  Client-Id:", clientId);
console.log("  Request-Id:", requestId);
console.log("  Request-Timestamp:", timestamp);
console.log("  Request-Target:", CHECKOUT_TARGET);
console.log("  Digest:", signature.digest);
console.log("  Signature:", signature.signature);

const url = `${baseUrl}${CHECKOUT_TARGET}`;
console.log("\nCalling:", url);

const response = await fetch(url, {
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

console.log("\nResponse status:", response.status, response.statusText);
const payload = await response.json();
console.log("Response body:", JSON.stringify(payload, null, 2));
