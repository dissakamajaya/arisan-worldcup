import { randomUUID } from "crypto";
import { createClient } from "@supabase/supabase-js";
import {
  COUNTRIES_PER_PARTICIPANT,
  ENTRY_FEE_IDR,
  MAX_PARTICIPANTS,
  type TeamStatus,
  countries,
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
  provider: "simulated" | "doku";
  createdAt: string;
  paidAt?: string;
};

export type PublicState = {
  maxParticipants: number;
  countriesPerParticipant: number;
  entryFee: number;
  participants: Participant[];
  orders: Order[];
  takenCountries: string[];
  availableCountries: string[];
  countryStatuses: Record<string, TeamStatus>;
  mode: "simulated" | "doku";
  storage: "memory" | "supabase";
};

type MutableStore = {
  participants: Participant[];
  orders: Order[];
  countryStatuses: Record<string, TeamStatus>;
};

type GlobalStore = typeof globalThis & {
  __arisanWorldcupStore?: MutableStore;
  __arisanWorldcupLock?: Promise<unknown>;
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

const globalStore = globalThis as GlobalStore;

function initialStatuses() {
  return Object.fromEntries(countries.map((country) => [country.code, country.status]));
}

function initialStore(): MutableStore {
  return {
    participants: [
      {
        id: "seed-1",
        name: "Raka",
        email: "raka@example.com",
        countries: ["MEX", "JPN"],
        paidAt: new Date("2026-06-10T11:00:00.000Z").toISOString(),
        orderId: "seed-order-1",
      },
      {
        id: "seed-2",
        name: "Dina",
        email: "dina@example.com",
        countries: ["BRA", "GHA"],
        paidAt: new Date("2026-06-10T11:12:00.000Z").toISOString(),
        orderId: "seed-order-2",
      },
      {
        id: "seed-3",
        name: "Bimo",
        email: "bimo@example.com",
        countries: ["ARG", "KOR"],
        paidAt: new Date("2026-06-10T11:24:00.000Z").toISOString(),
        orderId: "seed-order-3",
      },
    ],
    orders: [],
    countryStatuses: initialStatuses(),
  };
}

function getMemoryStore() {
  if (!globalStore.__arisanWorldcupStore) {
    globalStore.__arisanWorldcupStore = initialStore();
  }

  return globalStore.__arisanWorldcupStore;
}

function isSupabaseConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function supabase() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Supabase env belum diset.");
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function withMemoryLock<T>(operation: () => Promise<T> | T): Promise<T> {
  const previous = globalStore.__arisanWorldcupLock ?? Promise.resolve();
  let release!: () => void;
  globalStore.__arisanWorldcupLock = new Promise((resolve) => {
    release = () => resolve(undefined);
  });

  await previous.catch(() => undefined);
  try {
    return await operation();
  } finally {
    release();
  }
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

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
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

function publicStateFromRows(input: {
  participants: Participant[];
  orders: Order[];
  countryStatuses: Record<string, TeamStatus>;
  mode: PublicState["mode"];
  storage: PublicState["storage"];
}): PublicState {
  const takenCountries = input.participants.flatMap((participant) => participant.countries);
  const availableCountries = countries
    .map((country) => country.code)
    .filter((code) => !takenCountries.includes(code));

  return {
    maxParticipants: MAX_PARTICIPANTS,
    countriesPerParticipant: COUNTRIES_PER_PARTICIPANT,
    entryFee: ENTRY_FEE_IDR,
    participants: [...input.participants].sort((a, b) => a.paidAt.localeCompare(b.paidAt)),
    orders: [...input.orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    takenCountries,
    availableCountries,
    countryStatuses: input.countryStatuses,
    mode: input.mode,
    storage: input.storage,
  };
}

async function getSupabasePublicState(mode: PublicState["mode"]): Promise<PublicState> {
  const client = supabase();
  const [participantsResult, ordersResult, statusesResult] = await Promise.all([
    client
      .from("arisan_participants")
      .select("id,name,email,order_id,paid_at,arisan_country_assignments(country_code)")
      .order("paid_at", { ascending: true }),
    client
      .from("arisan_orders")
      .select("id,name,email,amount,status,payment_url,provider,created_at,paid_at")
      .order("created_at", { ascending: false }),
    client.from("arisan_country_status").select("country_code,status"),
  ]);

  if (participantsResult.error) throw new Error(participantsResult.error.message);
  if (ordersResult.error) throw new Error(ordersResult.error.message);
  if (statusesResult.error) throw new Error(statusesResult.error.message);

  const countryStatuses = initialStatuses();
  for (const row of statusesResult.data ?? []) {
    countryStatuses[row.country_code] = row.status as TeamStatus;
  }

  return publicStateFromRows({
    participants: ((participantsResult.data ?? []) as ParticipantRow[]).map(formatParticipant),
    orders: ((ordersResult.data ?? []) as OrderRow[]).map(formatOrder),
    countryStatuses,
    mode,
    storage: "supabase",
  });
}

export async function getPublicState(mode: PublicState["mode"] = "simulated"): Promise<PublicState> {
  if (isSupabaseConfigured()) {
    return getSupabasePublicState(mode);
  }

  const store = getMemoryStore();
  return publicStateFromRows({
    participants: store.participants,
    orders: store.orders,
    countryStatuses: store.countryStatuses,
    mode,
    storage: "memory",
  });
}

export async function findOrder(orderId: string): Promise<Order | undefined> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase()
      .from("arisan_orders")
      .select("id,name,email,amount,status,payment_url,provider,created_at,paid_at")
      .eq("id", orderId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? formatOrder(data as OrderRow) : undefined;
  }

  return getMemoryStore().orders.find((order) => order.id === orderId);
}

export async function updateOrderPaymentUrl(orderId: string, paymentUrl: string) {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase()
      .from("arisan_orders")
      .update({ payment_url: paymentUrl })
      .eq("id", orderId)
      .select("id,name,email,amount,status,payment_url,provider,created_at,paid_at")
      .single();
    if (error) throw new Error(error.message);
    return formatOrder(data as OrderRow);
  }

  return withMemoryLock(() => {
    const order = getMemoryStore().orders.find((item) => item.id === orderId);
    if (!order) {
      throw new Error("Order tidak ditemukan.");
    }
    order.paymentUrl = paymentUrl;
    return order;
  });
}

async function createSupabasePendingOrder(input: {
  name: string;
  email: string;
  provider: Order["provider"];
  paymentUrl: string;
}) {
  const client = supabase();
  const existingParticipant = await client
    .from("arisan_participants")
    .select("id")
    .eq("email", input.email)
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
    .eq("email", input.email)
    .eq("status", "pending")
    .maybeSingle();
  if (existingPending.error) throw new Error(existingPending.error.message);
  if (existingPending.data) {
    return formatOrder(existingPending.data as OrderRow);
  }

  const id = `ARISAN-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;
  const inserted = await client
    .from("arisan_orders")
    .insert({
      id,
      name: input.name,
      email: input.email,
      amount: ENTRY_FEE_IDR,
      status: "pending",
      payment_url: input.paymentUrl.replace("__ORDER_ID__", id),
      provider: input.provider,
    })
    .select("id,name,email,amount,status,payment_url,provider,created_at,paid_at")
    .single();

  if (inserted.error) {
    if (inserted.error.code === "23505") {
      const retry = await client
        .from("arisan_orders")
        .select("id,name,email,amount,status,payment_url,provider,created_at,paid_at")
        .eq("email", input.email)
        .eq("status", "pending")
        .single();
      if (retry.error) throw new Error(retry.error.message);
      return formatOrder(retry.data as OrderRow);
    }
    throw new Error(inserted.error.message);
  }

  return formatOrder(inserted.data as OrderRow);
}

export async function createPendingOrder(input: {
  name: string;
  email: string;
  provider: Order["provider"];
  paymentUrl: string;
}) {
  const name = input.name.trim();
  const email = normalizeEmail(input.email);
  assertJoinInput(name, email);

  if (isSupabaseConfigured()) {
    return createSupabasePendingOrder({ ...input, name, email });
  }

  return withMemoryLock(() => {
    const store = getMemoryStore();
    if (store.participants.some((participant) => participant.email === email)) {
      throw new Error("Email ini sudah terdaftar sebagai peserta.");
    }

    if (store.participants.length >= MAX_PARTICIPANTS) {
      throw new Error("Slot peserta sudah penuh.");
    }

    const existingPending = store.orders.find(
      (order) => order.email === email && order.status === "pending",
    );
    if (existingPending) {
      return existingPending;
    }

    const id = `ARISAN-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;
    const order: Order = {
      id,
      name,
      email,
      amount: ENTRY_FEE_IDR,
      status: "pending",
      paymentUrl: input.paymentUrl.replace("__ORDER_ID__", id),
      provider: input.provider,
      createdAt: new Date().toISOString(),
    };
    store.orders.push(order);
    return order;
  });
}

async function getSupabaseParticipant(participantId: string) {
  const { data, error } = await supabase()
    .from("arisan_participants")
    .select("id,name,email,order_id,paid_at,arisan_country_assignments(country_code)")
    .eq("id", participantId)
    .single();
  if (error) throw new Error(error.message);
  return formatParticipant(data as ParticipantRow);
}

export async function markOrderPaid(orderId: string) {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase().rpc("arisan_mark_order_paid", {
      p_order_id: orderId,
    });
    if (error) throw new Error(error.message);
    const participantId = Array.isArray(data) ? data[0]?.participant_id : data?.participant_id;
    if (!participantId) {
      throw new Error("Pembayaran diproses tetapi peserta tidak ditemukan.");
    }
    return getSupabaseParticipant(participantId);
  }

  return withMemoryLock(() => {
    const store = getMemoryStore();
    const order = store.orders.find((item) => item.id === orderId);
    if (!order) {
      throw new Error("Order tidak ditemukan.");
    }

    const existingParticipant = store.participants.find(
      (participant) => participant.email === order.email,
    );
    if (existingParticipant) {
      order.status = "paid";
      order.paidAt = existingParticipant.paidAt;
      return existingParticipant;
    }

    if (store.participants.length >= MAX_PARTICIPANTS) {
      throw new Error("Slot peserta sudah penuh.");
    }

    const taken = new Set(store.participants.flatMap((participant) => participant.countries));
    const available = countries.map((country) => country.code).filter((code) => !taken.has(code));
    if (available.length < COUNTRIES_PER_PARTICIPANT) {
      throw new Error("Negara tersisa tidak cukup.");
    }

    const assignedCountries = shuffle(available).slice(0, COUNTRIES_PER_PARTICIPANT);
    const paidAt = new Date().toISOString();
    const participant: Participant = {
      id: randomUUID(),
      name: order.name,
      email: order.email,
      countries: assignedCountries,
      paidAt,
      orderId,
    };

    order.status = "paid";
    order.paidAt = paidAt;
    store.participants.push(participant);
    return participant;
  });
}

export async function updateCountryStatus(countryCode: string, status: TeamStatus) {
  if (!countries.some((country) => country.code === countryCode)) {
    throw new Error("Kode negara tidak dikenal.");
  }

  if (isSupabaseConfigured()) {
    const { error } = await supabase().from("arisan_country_status").upsert({
      country_code: countryCode,
      status,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { countryCode, status };
  }

  return withMemoryLock(() => {
    getMemoryStore().countryStatuses[countryCode] = status;
    return { countryCode, status };
  });
}

export async function resetDemoStore() {
  return withMemoryLock(async () => {
    globalStore.__arisanWorldcupStore = initialStore();
    return getPublicState();
  });
}
