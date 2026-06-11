const baseUrl = process.env.VERIFY_BASE_URL ?? "https://arisan-worldcup.vercel.app";
const requirePublicReady = process.env.REQUIRE_PUBLIC_READY !== "false";

async function getJson(path) {
  const response = await fetch(`${baseUrl}${path}`, { cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

async function postJson(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

function fail(message, detail = {}) {
  console.error(JSON.stringify({ ok: false, message, ...detail }, null, 2));
  process.exit(1);
}

const readiness = await getJson("/api/readiness");
if (!readiness.response.ok) {
  fail("Readiness endpoint failed.", {
    status: readiness.response.status,
    payload: readiness.payload,
  });
}

const state = await getJson("/api/state");
if (!state.response.ok) {
  fail("State endpoint failed.", {
    status: state.response.status,
    payload: state.payload,
  });
}

if (state.payload.storage !== "supabase") {
  fail("State storage is not Supabase.", { storage: state.payload.storage });
}
if (state.payload.mode !== "doku") {
  fail("State payment mode is not DOKU.", { mode: state.payload.mode });
}

const participants = state.payload.participants ?? [];
const countries = participants.flatMap((participant) => participant.countries ?? []);
const duplicateEmails = participants
  .map((participant) => participant.email)
  .filter((email, index, emails) => emails.indexOf(email) !== index);
const duplicateCountries = countries.filter(
  (country, index) => countries.indexOf(country) !== index,
);

if (participants.length > 24) {
  fail("Participant count exceeds 24.", { participants: participants.length });
}

if (participants.length < 24) {
  if (state.payload.countriesRevealed !== false) {
    fail("Country assignments must stay hidden until all 24 participants join.", {
      participants: participants.length,
      countriesRevealed: state.payload.countriesRevealed,
    });
  }

  if (countries.length !== 0 || (state.payload.takenCountries ?? []).length !== 0) {
    fail("Public state leaked country assignments before the draw is full.", {
      participants: participants.length,
      assignedCountries: countries.length,
      takenCountries: state.payload.takenCountries?.length,
    });
  }
}

if (participants.length === 24) {
  if (state.payload.countriesRevealed !== true) {
    fail("Country assignments must be revealed when all 24 participants have joined.", {
      countriesRevealed: state.payload.countriesRevealed,
    });
  }

  if (countries.length !== participants.length * 2) {
    fail("Each participant must have exactly two countries after reveal.", {
      participants: participants.length,
      assignedCountries: countries.length,
    });
  }
}

if (duplicateEmails.length || duplicateCountries.length) {
  fail("Duplicate assignment detected.", { duplicateEmails, duplicateCountries });
}

const missingOrder = await getJson("/api/orders/ARISAN-VERIFY-NOT-EXIST");
if (missingOrder.response.status !== 404) {
  fail("Unknown order should return 404.", {
    status: missingOrder.response.status,
    payload: missingOrder.payload,
  });
}

const badJoin = await postJson("/api/join", { name: "A", email: "not-an-email" });
if (badJoin.response.status !== 400) {
  fail("Invalid email should be rejected with 400.", {
    status: badJoin.response.status,
    payload: badJoin.payload,
  });
}

if (requirePublicReady && !readiness.payload.ready) {
  fail("Production is not public-ready yet.", {
    readiness: readiness.payload,
    hint: "Set Supabase, DOKU, ADMIN_TOKEN, and NEXT_PUBLIC_APP_URL env vars, run schema.sql, then redeploy.",
  });
}

console.log(
  JSON.stringify(
    {
      ok: true,
      baseUrl,
      readiness: readiness.payload,
      participants: participants.length,
      assignedCountries: countries.length,
    },
    null,
    2,
  ),
);
