import { randomUUID } from "crypto";
import { createClient } from "@supabase/supabase-js";
import {
  COUNTRIES_PER_PARTICIPANT,
  ENTRY_FEE_IDR,
  MAX_PARTICIPANTS,
  type Match,
  type MatchStatus,
  type StandingRow,
  type TeamStatus,
  calculateGroupStandings,
  countries,
  drawBuckets,
  matches,
} from "./worldcup";

export type PaymentStatus = "pending" | "paid" | "expired" | "failed";

export type Participant = {
  id: string;
  name: string;
  email: string;
  countries: string[];
  paidAt: string;
  orderId: string;
};

export type Order = {
  id: string;
  name: string;
  email: string;
  amount: number;
  status: PaymentStatus;
  paymentUrl: string;
  provider: "doku";
  createdAt: string;
  paidAt?: string;
};

export type PublicState = {
  maxParticipants: number;
  countriesPerParticipant: number;
  entryFee: number;
  countriesRevealed: boolean;
  participants: Participant[];
  orders: Order[];
  takenCountries: string[];
  availableCountries: string[];
  countryStatuses: Record<string, TeamStatus>;
  drawBuckets: {
    favorite: number;
    leastFavorite: number;
  };
  matches: Match[];
  groupStandings: Record<string, StandingRow[]>;
  mode: "doku";
  storage: "supabase";
};

type OrderRow = {
  id: string;
  name: string;
  email: string;
  amount: number;
  status: PaymentStatus;
  payment_url: string;
  provider: Order["provider"];
  created_at: string;
  paid_at: string | null;
};

type ParticipantRow = {
  id: string;
  name: string;
  email: string;
  order_id: string;
  paid_at: string;
  arisan_country_assignments?: { country_code: string }[];
};

type MatchResultRow = {
  match_label: string;
  status: MatchStatus;
  home_score: number | null;
  away_score: number | null;
};

function requireSupabase() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase env belum diset. Set SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY di Vercel production.",
    );
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function assertJoinInput(name: string, email: string) {
  if (name.trim().length < 2) {
    throw new Error("Nama minimal 2 karakter.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Email tidak valid.");
  }
}

function initialStatuses() {
  return Object.fromEntries(countries.map((country) => [country.code, country.status]));
}

function formatOrder(row: OrderRow): Order {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    amount: row.amount,
    status: row.status,
    paymentUrl: row.payment_url,
    provider: row.provider,
    createdAt: row.created_at,
    paidAt: row.paid_at ?? undefined,
  };
}

function formatParticipant(row: ParticipantRow): Participant {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    orderId: row.order_id,
    paidAt: row.paid_at,
    countries: (row.arisan_country_assignments ?? []).map((assignment) => assignment.country_code),
  };
}

function mergeMatchResults(rows: MatchResultRow[]): Match[] {
  const resultsByLabel = new Map(rows.map((row) => [row.match_label, row]));
  return matches.map((match) => {
    const row = resultsByLabel.get(match.label);
    if (!row) {
      return match;
    }
    return {
      ...match,
      status: row.status,
      homeScore: row.home_score ?? undefined,
      awayScore: row.away_score ?? undefined,
    };
  });
}

function pickRandom(input: string[]) {
  return input[Math.floor(Math.random() * input.length)];
}

async function insertAssignmentPair(
  client: ReturnType<typeof requireSupabase>,
  participantId: string,
  countryCodes: string[],
) {
  const rowsWithBucket = countryCodes.map((code) => ({
    participant_id: participantId,
    country_code: code,
    draw_bucket: countries.find((country) => country.code === code)?.drawBucket ?? "least_favorite",
  }));

  const withBucket = await client.from("arisan_country_assignments").insert(rowsWithBucket);
  if (!withBucket.error) {
    return;
  }
  if (withBucket.error.code !== "PGRST204" && withBucket.error.code !== "42703") {
    throw new Error(withBucket.error.message);
  }

  const rows = countryCodes.map((code) => ({
    participant_id: participantId,
    country_code: code,
  }));
  const fallback = await client.from("arisan_country_assignments").insert(rows);
  if (fallback.error) throw new Error(fallback.error.message);
}

async function replaceParticipantAssignments(
  client: ReturnType<typeof requireSupabase>,
  participantId: string,
) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const deleted = await client
      .from("arisan_country_assignments")
      .delete()
      .eq("participant_id", participantId);
    if (deleted.error) throw new Error(deleted.error.message);

    const assigned = await client.from("arisan_country_assignments").select("country_code");
    if (assigned.error) throw new Error(assigned.error.message);

    const assignedCodes = new Set((assigned.data ?? []).map((row) => row.country_code));
    const favoritePool = countries
      .filter((country) => country.drawBucket === "favorite" && !assignedCodes.has(country.code))
      .map((country) => country.code);
    const leastFavoritePool = countries
      .filter(
        (country) => country.drawBucket === "least_favorite" && !assignedCodes.has(country.code),
      )
      .map((country) => country.code);

    if (!favoritePool.length || !leastFavoritePool.length) {
      throw new Error("Negara tersisa tidak cukup untuk bucket favorite/least favorite.");
    }

    try {
      await insertAssignmentPair(client, participantId, [
        pickRandom(favoritePool),
        pickRandom(leastFavoritePool),
      ]);
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("duplicate") || attempt === 2) {
        throw error;
      }
    }
  }
}

function publicStateFromRows(input: {
  participants: Participant[];
  orders: Order[];
  countryStatuses: Record<string, TeamStatus>;
  matches: Match[];
}): PublicState {
  const countriesRevealed = input.participants.length >= MAX_PARTICIPANTS;
  const takenCountries = countriesRevealed
    ? input.participants.flatMap((participant) => participant.countries)
    : [];
  const availableCountries = countries
    .map((country) => country.code)
    .filter((code) => !takenCountries.includes(code));
  const participants = [...input.participants]
    .sort((a, b) => a.paidAt.localeCompare(b.paidAt))
    .map((participant) => ({
      ...participant,
      countries: countriesRevealed ? participant.countries : [],
    }));
  const buckets = drawBuckets();

  return {
    maxParticipants: MAX_PARTICIPANTS,
    countriesPerParticipant: COUNTRIES_PER_PARTICIPANT,
    entryFee: ENTRY_FEE_IDR,
    countriesRevealed,
    participants,
    orders: [...input.orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    takenCountries,
    availableCountries,
    countryStatuses: input.countryStatuses,
    drawBuckets: {
      favorite: buckets.favorite.length,
      leastFavorite: buckets.leastFavorite.length,
    },
    matches: input.matches,
    groupStandings: calculateGroupStandings(input.matches),
    mode: "doku",
    storage: "supabase",
  };
}

export async function getPublicState(): Promise<PublicState> {
  const client = requireSupabase();
  const [participantsResult, ordersResult, statusesResult, matchResultsResult] = await Promise.all([
    client
      .from("arisan_participants")
      .select("id,name,email,order_id,paid_at,arisan_country_assignments(country_code)")
      .order("paid_at", { ascending: true }),
    client
      .from("arisan_orders")
      .select("id,name,email,amount,status,payment_url,provider,created_at,paid_at")
      .order("created_at", { ascending: false }),
    client.from("arisan_country_status").select("country_code,status"),
    client.from("arisan_match_results").select("match_label,status,home_score,away_score"),
  ]);

  if (participantsResult.error) throw new Error(participantsResult.error.message);
  if (ordersResult.error) throw new Error(ordersResult.error.message);
  if (statusesResult.error) throw new Error(statusesResult.error.message);
  const publicMatches = matchResultsResult.error
    ? matches
    : mergeMatchResults((matchResultsResult.data ?? []) as MatchResultRow[]);

  const countryStatuses = initialStatuses();
  for (const row of statusesResult.data ?? []) {
    countryStatuses[row.country_code] = row.status as TeamStatus;
  }

  return publicStateFromRows({
    participants: ((participantsResult.data ?? []) as ParticipantRow[]).map(formatParticipant),
    orders: ((ordersResult.data ?? []) as OrderRow[]).map(formatOrder),
    countryStatuses,
    matches: publicMatches,
  });
}

export async function findOrder(orderId: string): Promise<Order | undefined> {
  const { data, error } = await requireSupabase()
    .from("arisan_orders")
    .select("id,name,email,amount,status,payment_url,provider,created_at,paid_at")
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? formatOrder(data as OrderRow) : undefined;
}

export async function updateOrderPaymentUrl(orderId: string, paymentUrl: string) {
  const { data, error } = await requireSupabase()
    .from("arisan_orders")
    .update({ payment_url: paymentUrl })
    .eq("id", orderId)
    .select("id,name,email,amount,status,payment_url,provider,created_at,paid_at")
    .single();
  if (error) throw new Error(error.message);
  return formatOrder(data as OrderRow);
}

export async function createPendingOrder(input: {
  name: string;
  email: string;
  paymentUrl: string;
}) {
  const name = input.name.trim();
  const email = normalizeEmail(input.email);
  assertJoinInput(name, email);

  const client = requireSupabase();

  const existingParticipant = await client
    .from("arisan_participants")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existingParticipant.error) throw new Error(existingParticipant.error.message);
  if (existingParticipant.data) {
    throw new Error("Email ini sudah terdaftar sebagai peserta.");
  }

  const participantCount = await client
    .from("arisan_participants")
    .select("id", { count: "exact", head: true });
  if (participantCount.error) throw new Error(participantCount.error.message);
  if ((participantCount.count ?? 0) >= MAX_PARTICIPANTS) {
    throw new Error("Slot peserta sudah penuh.");
  }

  const existingPending = await client
    .from("arisan_orders")
    .select("id,name,email,amount,status,payment_url,provider,created_at,paid_at")
    .eq("email", email)
    .eq("status", "pending")
    .maybeSingle();
  if (existingPending.error) throw new Error(existingPending.error.message);
  if (existingPending.data) {
    return { order: formatOrder(existingPending.data as OrderRow), created: false };
  }

  const id = `AWC${Date.now()}${randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase()}`;
  const inserted = await client
    .from("arisan_orders")
    .insert({
      id,
      name,
      email,
      amount: ENTRY_FEE_IDR,
      status: "pending",
      payment_url: input.paymentUrl.replace("__ORDER_ID__", id),
      provider: "doku",
    })
    .select("id,name,email,amount,status,payment_url,provider,created_at,paid_at")
    .single();

  if (inserted.error) {
    if (inserted.error.code === "23505") {
      const retry = await client
        .from("arisan_orders")
        .select("id,name,email,amount,status,payment_url,provider,created_at,paid_at")
        .eq("email", email)
        .eq("status", "pending")
        .single();
      if (retry.error) throw new Error(retry.error.message);
      return { order: formatOrder(retry.data as OrderRow), created: false };
    }
    throw new Error(inserted.error.message);
  }

  return { order: formatOrder(inserted.data as OrderRow), created: true };
}

export async function deletePendingOrder(orderId: string) {
  const { error } = await requireSupabase()
    .from("arisan_orders")
    .delete()
    .eq("id", orderId)
    .eq("status", "pending");
  if (error) throw new Error(error.message);
}

export async function markOrderPaid(orderId: string) {
  const client = requireSupabase();
  const { data, error } = await client.rpc("arisan_mark_order_paid", {
    p_order_id: orderId,
  });
  if (error) throw new Error(error.message);
  const participantId = Array.isArray(data) ? data[0]?.participant_id : data?.participant_id;
  if (!participantId) {
    throw new Error("Pembayaran diproses tetapi peserta tidak ditemukan.");
  }
  await replaceParticipantAssignments(client, participantId);
  return getParticipantById(participantId);
}

async function getParticipantById(participantId: string) {
  const { data, error } = await requireSupabase()
    .from("arisan_participants")
    .select("id,name,email,order_id,paid_at,arisan_country_assignments(country_code)")
    .eq("id", participantId)
    .single();
  if (error) throw new Error(error.message);
  return formatParticipant(data as ParticipantRow);
}

export async function updateCountryStatus(countryCode: string, status: TeamStatus) {
  if (!countries.some((country) => country.code === countryCode)) {
    throw new Error("Kode negara tidak dikenal.");
  }

  const { error } = await requireSupabase().from("arisan_country_status").upsert({
    country_code: countryCode,
    status,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
  return { countryCode, status };
}

export async function updateMatchResult(input: {
  matchLabel: string;
  status: MatchStatus;
  homeScore?: number;
  awayScore?: number;
}) {
  if (!matches.some((match) => match.label === input.matchLabel)) {
    throw new Error("Match tidak dikenal.");
  }

  if (!["scheduled", "live", "finished"].includes(input.status)) {
    throw new Error("Status match tidak valid.");
  }

  const hasScores = typeof input.homeScore === "number" && typeof input.awayScore === "number";
  if (input.status === "scheduled" && hasScores) {
    throw new Error("Match scheduled tidak boleh punya skor.");
  }
  if (input.status !== "scheduled" && !hasScores) {
    throw new Error("Match live/finished wajib punya skor.");
  }

  const { error } = await requireSupabase().from("arisan_match_results").upsert({
    match_label: input.matchLabel,
    status: input.status,
    home_score: input.status === "scheduled" ? null : input.homeScore,
    away_score: input.status === "scheduled" ? null : input.awayScore,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
  return input;
}
