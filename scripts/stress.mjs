const baseUrl = process.env.STRESS_BASE_URL ?? "http://127.0.0.1:3000";
const total = Number(process.env.STRESS_TOTAL ?? 30);

async function request(path, init) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

async function joinAndPay(index) {
  const joined = await request("/api/join", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: `Stress User ${index}`,
      email: `stress-${Date.now()}-${index}@example.com`,
    }),
  });

  if (!joined.response.ok) {
    return { ok: false, stage: "join", status: joined.response.status, payload: joined.payload };
  }

  const orderId = joined.payload.order.id;
  const paid = await request(`/api/payments/${orderId}/simulate`, { method: "POST" });
  return {
    ok: paid.response.ok,
    stage: "pay",
    status: paid.response.status,
    payload: paid.payload,
  };
}

const results = await Promise.all(Array.from({ length: total }, (_, index) => joinAndPay(index)));
const state = await request("/api/state");
const participants = state.payload.participants ?? [];
const emails = participants.map((participant) => participant.email);
const countryCodes = participants.flatMap((participant) => participant.countries);
const duplicateEmails = emails.filter((email, index) => emails.indexOf(email) !== index);
const duplicateCountries = countryCodes.filter((code, index) => countryCodes.indexOf(code) !== index);
const successful = results.filter((result) => result.ok).length;
const rejected = results.filter((result) => !result.ok).length;

console.log(
  JSON.stringify(
    {
      total,
      successful,
      rejected,
      participants: participants.length,
      assignedCountries: countryCodes.length,
      duplicateEmails,
      duplicateCountries,
      fullAt24: participants.length <= 24,
      rejectsAfterFull: rejected >= Math.max(0, total - 21),
    },
    null,
    2,
  ),
);

if (duplicateEmails.length || duplicateCountries.length || participants.length > 24) {
  process.exit(1);
}
