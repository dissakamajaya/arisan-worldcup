"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ENTRY_FEE_IDR,
  calculateGroupStandings,
  countries,
  countryByCode,
  groupedCountries,
  matches,
  splitMatchLabel,
  type Match,
} from "@/lib/worldcup";
import type { Participant, PublicState } from "@/lib/store";

const initialState: PublicState = {
  maxParticipants: 24,
  countriesPerParticipant: 2,
  entryFee: ENTRY_FEE_IDR,
  countriesRevealed: false,
  participants: [],
  orders: [],
  takenCountries: [],
  availableCountries: countries.map((country) => country.code),
  countryStatuses: Object.fromEntries(countries.map((country) => [country.code, country.status])),
  drawBuckets: {
    favorite: 24,
    leastFavorite: 24,
  },
  matches,
  groupStandings: calculateGroupStandings(matches),
  mode: "doku",
  storage: "supabase",
};

function formatIdr(value: number) {
  return `Rp${new Intl.NumberFormat("id-ID").format(value)}`;
}

function splitMatch(label: string) {
  return splitMatchLabel(label);
}

function censorEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***@***";
  const masked = local.length > 1 ? local[0] + "*".repeat(Math.max(local.length - 1, 2)) : "*".repeat(3);
  return `${masked}@${domain}`;
}

function formatScore(match: { homeScore?: number; awayScore?: number; status?: string }) {
  if (
    (match.status === "finished" || match.status === "live") &&
    typeof match.homeScore === "number" &&
    typeof match.awayScore === "number"
  ) {
    return `${match.homeScore} - ${match.awayScore}`;
  }
  return "VS";
}

function TeamChip({ code, status }: { code: string; status: "alive" | "eliminated" }) {
  const country = countryByCode(code);
  if (!country) {
    return null;
  }

  return (
    <span className={`team-chip ${status === "eliminated" ? "is-eliminated" : ""}`}>
      <span className="team-code">{country.code}</span>
      <span>{country.name}</span>
    </span>
  );
}

function LockedChip() {
  return (
    <span className="team-chip locked-chip">
      <span className="team-code">?</span>
      <span>Negara dikunci</span>
    </span>
  );
}

function ParticipantRow({
  participant,
  index,
  countryStatuses,
  countriesRevealed,
}: {
  participant: Participant;
  index: number;
  countryStatuses: PublicState["countryStatuses"];
  countriesRevealed: boolean;
}) {
  const initials = participant.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

  return (
    <article className="participant-card">
      <div className="participant-rank">{String(index + 1).padStart(2, "0")}</div>
      <div className="avatar-ring" aria-hidden="true">
        {initials || "KP"}
      </div>
      <div className="participant-name">
        <strong>{participant.name}</strong>
        <span>{censorEmail(participant.email)}</span>
      </div>
      <div className="team-pair">
        {countriesRevealed
          ? participant.countries.map((code) => (
              <TeamChip key={code} code={code} status={countryStatuses[code] ?? "alive"} />
            ))
          : Array.from({ length: 2 }).map((_, chipIndex) => <LockedChip key={chipIndex} />)}
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
            <p>Isi data, lanjut ke pembayaran DOKU Checkout.</p>
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
              <strong>DOKU Checkout</strong>
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

function PhonePreview({
  participantCount,
  maxParticipants,
  lockedCountries,
  slotsLeft,
  countriesRevealed,
  previewMatches,
}: {
  participantCount: number;
  maxParticipants: number;
  lockedCountries: number;
  slotsLeft: number;
  countriesRevealed: boolean;
  previewMatches: PublicState["matches"];
}) {
  const progress = Math.min(100, (participantCount / maxParticipants) * 100);

  return (
    <div className="phone-preview" aria-label="Status undian">
      <div className="phone-top">
        <span>9:41</span>
        <span className="phone-camera" />
        <span>LIVE</span>
      </div>
      <div className="live-card">
        <span className="live-dot">Live Draw</span>
        <h2>Kocokan Piala Dunia</h2>
        <div className="score-board">
          <div>
            <strong>{participantCount}</strong>
            <span>Peserta</span>
          </div>
          <span className="versus">/</span>
          <div>
            <strong>{maxParticipants}</strong>
            <span>Target</span>
          </div>
        </div>
      </div>
      <div className="phone-stat-grid">
        <div>
          <span>Slot tersisa</span>
          <strong>{slotsLeft}</strong>
        </div>
        <div>
          <span>{countriesRevealed ? "Negara terbuka" : "Negara terkunci"}</span>
          <strong>{lockedCountries}</strong>
        </div>
      </div>
      <div className="draw-progress" aria-label={`${participantCount} dari ${maxParticipants} peserta`}>
        {Array.from({ length: 24 }).map((_, index) => (
          <span key={index} className={index < participantCount ? "is-filled" : ""} />
        ))}
      </div>
      <div className="phone-match-list">
        {previewMatches.slice(0, 3).map((match) => {
          const teams = splitMatch(match.label);
          return (
            <article key={`${match.date}-${match.label}`}>
              <span>{match.date}</span>
              <strong>{teams.home}</strong>
              <small className={match.status === "finished" ? "score-pill is-final" : ""}>
                {formatScore(match)}
              </small>
              <strong>{teams.away}</strong>
            </article>
          );
        })}
      </div>
      <span className="progress-fill" style={{ width: `${progress}%` }} />
    </div>
  );
}

export default function Home() {
  const [state, setState] = useState(initialState);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");

  async function refresh() {
    const response = await fetch("/api/state", { cache: "no-store" });
    if (response.ok) {
      setState((await response.json()) as PublicState);
    }
  }

  async function checkPassword(event: FormEvent) {
    event.preventDefault();
    setAuthSubmitting(true);
    setPasswordError("");

    const response = await fetch("/api/auth/dashboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: passwordInput }),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    setAuthSubmitting(false);

    if (response.ok) {
      setAuthenticated(true);
      setPasswordError("");
      setPasswordInput("");
      await refresh();
    } else {
      setPasswordError(payload.error ?? "Password salah.");
    }
  }

  useEffect(() => {
    fetch("/api/auth/dashboard", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : { authenticated: false }))
      .then((payload: { authenticated?: boolean }) => {
        setAuthenticated(Boolean(payload.authenticated));
      })
      .catch(() => setAuthenticated(false))
      .finally(() => setAuthChecking(false));
    window.setTimeout(refresh, 0);
    const timer = window.setInterval(refresh, 5000);
    return () => window.clearInterval(timer);
  }, []);

  const slotsLeft = state.maxParticipants - state.participants.length;
  const lockedCountries = state.participants.length * state.countriesPerParticipant;
  const progress = Math.min(100, (state.participants.length / state.maxParticipants) * 100);
  const groups = useMemo(() => groupedCountries(), []);
  const headlineMatches = state.matches.slice(0, 2);

  // Group all matches by date for pagination
  const matchesByDate = useMemo(() => {
    const map = new Map<string, Match[]>();
    for (const m of state.matches) {
      if (!map.has(m.date)) map.set(m.date, []);
      map.get(m.date)!.push(m);
    }
    return map;
  }, [state.matches]);
  const dateKeys = useMemo(() => Array.from(matchesByDate.keys()), [matchesByDate]);
  const [datePage, setDatePage] = useState(0);
  const currentDateKey = dateKeys[datePage] ?? "";
  const currentDateMatches = matchesByDate.get(currentDateKey) ?? [];

  return (
    <main className="app-shell" id="beranda">
      {!authenticated ? (
        <section className="login-section">
          <div className="login-box">
            <div className="brand-mark login-brand">KP</div>
            <h2>Masukan password</h2>
            <form onSubmit={checkPassword} className="login-form">
              <input
                type="password"
                placeholder="Password"
                value={passwordInput}
                onChange={(e) => { setPasswordInput(e.target.value); setPasswordError(""); }}
                required
                autoFocus
                disabled={authChecking || authSubmitting}
              />
              {passwordError ? <p className="form-error">{passwordError}</p> : null}
              <button className="primary-button wide" type="submit" disabled={authChecking || authSubmitting}>
                {authChecking ? "Memeriksa..." : authSubmitting ? "Masuk..." : "Masuk"}
              </button>
            </form>
          </div>
        </section>
      ) : (
      <>
      <header className="topbar">
        <a href="#beranda" className="brand" aria-label="Kocokan Piala Dunia">
          <span className="brand-mark">KP</span>
          <span>Kocokan Piala Dunia</span>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#peserta">Peserta</a>
          <a href="#grup">Grup</a>
          <a href="#jadwal">Jadwal</a>
        </nav>
        <button className="primary-button" onClick={() => setDialogOpen(true)} type="button">
          Ikut Arisan
        </button>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <div className="hero-kicker">
            <span className="status-light" />
            DOKU live payment
          </div>
          <h1>Undian negara Piala Dunia 2026.</h1>
          <p>
            Satu peserta dapat satu negara favorit dan satu negara least favorite berdasarkan odds
            juara. Assignment disimpan setelah pembayaran, tapi negara tetap terkunci sampai semua
            24 peserta resmi join.
          </p>
          <div className="hero-actions">
            <button className="primary-button" onClick={() => setDialogOpen(true)} type="button">
              Gabung Sekarang
            </button>
            <a className="secondary-button" href="#jadwal">
              Lihat Jadwal
            </a>
          </div>
          <div className="match-ticker" aria-label="Pertandingan pembuka">
            {headlineMatches.map((match) => {
              const teams = splitMatch(match.label);
              return (
                <article key={`${match.date}-${match.label}`}>
                  <span>{match.date}</span>
                  <strong>{teams.home}</strong>
                  <small className={match.status === "finished" ? "score-pill is-final" : ""}>
                    {formatScore(match)}
                  </small>
                  <strong>{teams.away}</strong>
                </article>
              );
            })}
          </div>
        </div>

        <PhonePreview
          participantCount={state.participants.length}
          maxParticipants={state.maxParticipants}
          lockedCountries={state.countriesRevealed ? state.takenCountries.length : lockedCountries}
          slotsLeft={slotsLeft}
          countriesRevealed={state.countriesRevealed}
          previewMatches={state.matches}
        />
      </section>

      <section className="summary-strip" aria-label="Ringkasan kocokan">
        <div>
          <span>Peserta</span>
          <strong>{state.participants.length}/{state.maxParticipants}</strong>
        </div>
        <div>
          <span>{state.countriesRevealed ? "Negara terambil" : "Negara terkunci"}</span>
          <strong>{state.countriesRevealed ? state.takenCountries.length : lockedCountries}/48</strong>
        </div>
        <div>
          <span>Bucket draw</span>
          <strong>{state.drawBuckets.favorite}+{state.drawBuckets.leastFavorite}</strong>
        </div>
        <div>
          <span>Biaya join</span>
          <strong>{formatIdr(state.entryFee)}</strong>
        </div>
      </section>

      <section className="section-block" id="peserta">
        <div className="section-heading">
          <div>
            <span className="section-icon">01</span>
            <h2>Daftar Peserta</h2>
          </div>
          <p>
            Pembayaran sukses langsung masuk dashboard. Negara tiap peserta dibuka hanya saat 24
            slot sudah penuh. Setiap peserta dapat 1 favorite + 1 least favorite.
          </p>
        </div>
        <div className="participants-list">
          {state.participants.map((participant, index) => (
            <ParticipantRow
              key={participant.id}
              participant={participant}
              index={index}
              countryStatuses={state.countryStatuses}
              countriesRevealed={state.countriesRevealed}
            />
          ))}
          {Array.from({ length: Math.max(0, Math.min(5, slotsLeft)) }).map((_, index) => (
            <article className="participant-card empty-row" key={`slot-${index}`}>
              <div className="participant-rank">--</div>
              <div className="avatar-ring muted-avatar" aria-hidden="true">
                +
              </div>
              <div className="participant-name">
                <strong>Slot tersedia</strong>
                <span>Menunggu pembayaran peserta berikutnya</span>
              </div>
              <div className="team-pair muted">Belum dikocok</div>
            </article>
          ))}
        </div>
        <div className="fill-panel">
          <div>
            <span>Progress undian</span>
            <strong>{Math.round(progress)}%</strong>
          </div>
          <div className="progress-track">
            <span style={{ width: `${progress}%` }} />
          </div>
        </div>
      </section>

      <section className="section-block" id="grup">
        <div className="section-heading">
          <div>
            <span className="section-icon">02</span>
            <h2>Table Grup World Cup</h2>
          </div>
          <p>Ketika turnamen berjalan, negara gugur akan dicoret di peserta dan table grup.</p>
        </div>
        <div className="groups-grid">
          {groups.map((group) => (
            <article className="group-card" key={group.group}>
              <header>
                <strong>Group {group.group}</strong>
                <span>PTS</span>
              </header>
              {(state.groupStandings[group.group] ?? []).map((standing, index) => {
                const country = countryByCode(standing.code);
                if (!country) {
                  return null;
                }
                return (
                <div
                  className={`group-team ${
                    state.countryStatuses[country.code] === "eliminated" ? "is-eliminated" : ""
                  }`}
                  key={country.code}
                >
                  <span>{index + 1}</span>
                  <em>{country.code}</em>
                  <strong>{country.name}</strong>
                  <small>{standing.points}</small>
                </div>
                );
              })}
            </article>
          ))}
        </div>
      </section>

      <section className="section-block schedule-section" id="jadwal">
        <div className="section-heading">
          <div>
            <span className="section-icon">03</span>
            <h2>Jadwal Sampai Final</h2>
          </div>
          <p>Fase grup tampil per hari. Gunakan navigasi untuk pindah tanggal.</p>
        </div>
        <div className="schedule-layout">
          <div className="schedule-column">
            {currentDateMatches.map((match) => {
              const teams = splitMatch(match.label);
              return (
                <article className="match-row" key={`${match.date}-${match.label}`}>
                  <span className="match-date">{match.date}</span>
                  <div className="match-teams">
                    <strong>{teams.home}</strong>
                    <small className={match.status === "finished" ? "score-pill is-final" : ""}>
                      {formatScore(match)}
                    </small>
                    <strong>{teams.away}</strong>
                  </div>
                  <span className="match-stage">
                    {match.status === "finished" ? "Final" : match.stage}
                  </span>
                  <small className="match-venue">{match.venue}</small>
                </article>
              );
            })}
          </div>
        </div>
        <div className="schedule-pager">
          <button
            className="secondary-button"
            disabled={datePage === 0}
            onClick={() => setDatePage((p) => Math.max(0, p - 1))}
            type="button"
          >
            ← Sebelumnya
          </button>
          <span className="pager-label">
            {currentDateKey} ({datePage + 1}/{dateKeys.length})
          </span>
          <button
            className="secondary-button"
            disabled={datePage >= dateKeys.length - 1}
            onClick={() => setDatePage((p) => Math.min(dateKeys.length - 1, p + 1))}
            type="button"
          >
            Selanjutnya →
          </button>
        </div>
      </section>

      <nav className="bottom-nav" aria-label="Mobile navigation">
        <a href="#beranda">Home</a>
        <a href="#peserta">Peserta</a>
        <a href="#grup">Grup</a>
        <a href="#jadwal">Jadwal</a>
      </nav>

      <JoinDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onJoined={refresh} />
        </>
      )}
    </main>
  );
}
