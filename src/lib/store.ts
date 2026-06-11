import { randomUUID } from "crypto";
import {
  COUNTRIES_PER_PARTICIPANT,
  ENTRY_FEE_IDR,
  MAX_PARTICIPANTS,
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
  mode: "simulated" | "doku";
};

type MutableStore = {
  participants: Participant[];
  orders: Order[];
};

type GlobalStore = typeof globalThis & {
  __arisanWorldcupStore?: MutableStore;
  __arisanWorldcupLock?: Promise<unknown>;
};

const globalStore = globalThis as GlobalStore;

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
  };
}

function getStore() {
  if (!globalStore.__arisanWorldcupStore) {
    globalStore.__arisanWorldcupStore = initialStore();
  }

  return globalStore.__arisanWorldcupStore;
}

async function withLock<T>(operation: () => Promise<T> | T): Promise<T> {
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

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

export function getPublicState(mode: PublicState["mode"] = "simulated"): PublicState {
  const store = getStore();
  const takenCountries = store.participants.flatMap((participant) => participant.countries);
  const availableCountries = countries
    .map((country) => country.code)
    .filter((code) => !takenCountries.includes(code));

  return {
    maxParticipants: MAX_PARTICIPANTS,
    countriesPerParticipant: COUNTRIES_PER_PARTICIPANT,
    entryFee: ENTRY_FEE_IDR,
    participants: [...store.participants].sort((a, b) => a.paidAt.localeCompare(b.paidAt)),
    orders: [...store.orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    takenCountries,
    availableCountries,
    mode,
  };
}

export function findOrder(orderId: string) {
  return getStore().orders.find((order) => order.id === orderId);
}

export async function updateOrderPaymentUrl(orderId: string, paymentUrl: string) {
  return withLock(() => {
    const order = findOrder(orderId);
    if (!order) {
      throw new Error("Order tidak ditemukan.");
    }
    order.paymentUrl = paymentUrl;
    return order;
  });
}

export async function createPendingOrder(input: {
  name: string;
  email: string;
  provider: Order["provider"];
  paymentUrl: string;
}) {
  const name = input.name.trim();
  const email = normalizeEmail(input.email);
  if (name.length < 2) {
    throw new Error("Nama minimal 2 karakter.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Email tidak valid.");
  }

  return withLock(() => {
    const store = getStore();
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

export async function markOrderPaid(orderId: string) {
  return withLock(() => {
    const store = getStore();
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

export async function resetDemoStore() {
  return withLock(() => {
    globalStore.__arisanWorldcupStore = initialStore();
    return getPublicState();
  });
}
