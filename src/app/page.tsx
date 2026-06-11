"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ENTRY_FEE_IDR,
  countries,
  countryByCode,
  groupedCountries,
  matches,
} from "@/lib/worldcup";
import type { Participant, PublicState } from "@/lib/store";

const initialState: PublicState = {
  maxParticipants: 24,
  countriesPerParticipant: 2,
  entryFee: ENTRY_FEE_IDR,
  participants: [],
  orders: [],
  takenCountries: [],
  availableCountries: countries.map((country) => country.code),
  mode: "simulated",
};

function formatIdr(value: number) {
  return `Rp${new Intl.NumberFormat("id-ID").format(value)}`;
}

function TeamChip({ code }: { code: string }) {
  const country = countryByCode(code);
  if (!country) {
    return null;
  }

  return (
    <span className={`team-chip ${country.status === "eliminated" ? "is-eliminated" : ""}`}>
      <span className="team-code">{country.code}</span>
      <span>{country.name}</span>
    </span>
  );
}

function ParticipantRow({ participant, index }: { participant: Participant; index: number }) {
  return (
    <article className="participant-row">
      <div className="participant-rank">{String(index + 1).padStart(2, "0")}</div>
      <div className="participant-name">
        <strong>{participant.name}</strong>
        <span>{participant.email}</span>
      </div>
      <div className="team-pair">
        {participant.countries.map((code) => (
          <TeamChip key={code} code={code} />
        ))}
      </div>
    </article>
  );
}

function JoinDialog({
  open,
  onClose,
  onJoined,
}: {
  open: boolean;
  onClose: () => void;
  onJoined: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!open) {
    return null;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    const response = await fetch("/api/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email }),
    });
    const payload = (await response.json()) as { order?: { paymentUrl: string }; error?: string };

    setSubmitting(false);
    if (!response.ok || !payload.order) {
      setError(payload.error ?? "Gagal membuat pembayaran.");
      return;
    }

    onJoined();
    window.location.href = payload.order.paymentUrl;
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="join-title">
        <div className="dialog-head">
          <div>
            <h2 id="join-title">Gabung Kocokan</h2>
            <p>Isi data, lanjut ke DOKU Checkout atau QRIS simulasi.</p>
          </div>
          <button className="icon-button" onClick={onClose} type="button" aria-label="Close">
            x
          </button>
        </div>
        <form onSubmit={submit} className="join-form">
          <label>
            Nama
            <input value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <div className="payment-preview">
            <div className="mini-qr" />
            <div>
              <strong>DOKU Checkout / QRIS</strong>
              <span>{formatIdr(ENTRY_FEE_IDR)} per peserta</span>
            </div>
          </div>
          {error ? <p className="form-error">{error}</p> : null}
          <button className="primary-button wide" disabled={submitting} type="submit">
            {submitting ? "Membuat pembayaran..." : "Lanjut Bayar"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function Home() {
  const [state, setState] = useState(initialState);
  const [dialogOpen, setDialogOpen] = useState(false);

  async function refresh() {
    const response = await fetch("/api/state", { cache: "no-store" });
    if (response.ok) {
      setState((await response.json()) as PublicState);
    }
  }

  useEffect(() => {
    window.setTimeout(refresh, 0);
    const timer = window.setInterval(refresh, 5000);
    return () => window.clearInterval(timer);
  }, []);

  const slotsLeft = state.maxParticipants - state.participants.length;
  const groups = useMemo(() => groupedCountries(), []);
  const nextMatches = matches.slice(0, 14);
  const laterMatches = matches.slice(14);

  return (
    <main className="app-shell">
      <header className="topbar">
        <a href="#" className="brand" aria-label="Kocokan Piala Dunia">
          <span className="brand-mark">KP</span>
          <span>Kocokan Piala Dunia</span>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#peserta">Peserta</a>
          <a href="#grup">Grup</a>
          <a href="#jadwal">Jadwal</a>
        </nav>
        <button className="primary-button" onClick={() => setDialogOpen(true)} type="button">
          Gabung Sekarang
        </button>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <h1>Kocokan Piala Dunia</h1>
          <p>
            Dashboard arisan teman-teman untuk 24 peserta. Setiap peserta dapat 2 negara,
            assignment terkunci setelah pembayaran, dan negara tidak pernah duplikat.
          </p>
          <div className="hero-actions">
            <button className="primary-button" onClick={() => setDialogOpen(true)} type="button">
              Gabung Sekarang
            </button>
            <a className="secondary-button" href="#jadwal">
              Lihat Jadwal
            </a>
          </div>
        </div>

        <div className="status-panel" aria-label="Tournament draw status">
          <div className="mode-line">
            <span>Payment mode</span>
            <strong>{state.mode === "doku" ? "DOKU live" : "QRIS simulasi"}</strong>
          </div>
          <div className="stats-grid">
            <div>
              <strong>{state.participants.length}/{state.maxParticipants}</strong>
              <span>peserta join</span>
            </div>
            <div>
              <strong>{state.takenCountries.length}/48</strong>
              <span>negara terambil</span>
            </div>
            <div>
              <strong>{slotsLeft}</strong>
              <span>slot tersisa</span>
            </div>
            <div>
              <strong>{formatIdr(state.entryFee)}</strong>
              <span>biaya join</span>
            </div>
          </div>
          <div className="progress-track">
            <span
              style={{
                width: `${Math.min(100, (state.participants.length / state.maxParticipants) * 100)}%`,
              }}
            />
          </div>
        </div>
      </section>

      <section className="section-grid" id="peserta">
        <div className="section-heading">
          <h2>Peserta dan Negara</h2>
          <p>Pembayaran sukses langsung muncul di dashboard dengan dua negara unik.</p>
        </div>
        <div className="participants-list">
          {state.participants.map((participant, index) => (
            <ParticipantRow key={participant.id} participant={participant} index={index} />
          ))}
          {Array.from({ length: Math.max(0, Math.min(4, slotsLeft)) }).map((_, index) => (
            <article className="participant-row empty-row" key={`slot-${index}`}>
              <div className="participant-rank">--</div>
              <div className="participant-name">
                <strong>Slot tersedia</strong>
                <span>Menunggu pembayaran peserta berikutnya</span>
              </div>
              <div className="team-pair muted">Belum dikocok</div>
            </article>
          ))}
        </div>
      </section>

      <section className="section-grid" id="grup">
        <div className="section-heading">
          <h2>Table Grup World Cup 2026</h2>
          <p>Negara yang gugur akan tampil dicoret pada chip peserta dan table grup.</p>
        </div>
        <div className="groups-grid">
          {groups.map((group) => (
            <article className="group-card" key={group.group}>
              <header>Group {group.group}</header>
              {group.countries.map((country) => (
                <div
                  className={`group-team ${
                    country.status === "eliminated" ? "is-eliminated" : ""
                  }`}
                  key={country.code}
                >
                  <span>{country.code}</span>
                  <strong>{country.name}</strong>
                </div>
              ))}
            </article>
          ))}
        </div>
      </section>

      <section className="section-grid schedule-section" id="jadwal">
        <div className="section-heading">
          <h2>Jadwal Lengkap Sampai Final</h2>
          <p>Fase grup ditampilkan per pertandingan, knockout memakai placeholder resmi tahap.</p>
        </div>
        <div className="schedule-layout">
          <div className="schedule-column">
            {nextMatches.map((match) => (
              <article className="match-row" key={`${match.date}-${match.label}`}>
                <span>{match.date}</span>
                <strong>{match.label}</strong>
                <small>{match.venue}</small>
              </article>
            ))}
          </div>
          <div className="schedule-column compact">
            {laterMatches.map((match) => (
              <article className="match-row" key={`${match.date}-${match.label}`}>
                <span>{match.date}</span>
                <strong>{match.label}</strong>
                <small>{match.stage} - {match.venue}</small>
              </article>
            ))}
          </div>
        </div>
      </section>

      <JoinDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onJoined={refresh} />
    </main>
  );
}
