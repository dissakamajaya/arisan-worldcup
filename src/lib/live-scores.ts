import { type Match, type MatchStatus, countries, matches } from "./worldcup";

const ESPN_SCOREBOARD_URL =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard";

type EspnCompetitor = {
  homeAway?: "home" | "away";
  score?: string;
  team?: {
    abbreviation?: string;
    displayName?: string;
  };
};

type EspnEvent = {
  competitions?: Array<{
    competitors?: EspnCompetitor[];
    status?: {
      type?: {
        state?: string;
        completed?: boolean;
      };
    };
  }>;
  status?: {
    type?: {
      state?: string;
      completed?: boolean;
    };
  };
};

type EspnScoreboard = {
  events?: EspnEvent[];
};

export type LiveScoreUpdate = {
  matchLabel: string;
  status: MatchStatus;
  homeScore?: number;
  awayScore?: number;
  source: "espn";
};

const codeToCountryName = new Map(countries.map((country) => [country.code, country.name]));
let cachedUpdates: { expiresAt: number; updates: LiveScoreUpdate[] } | undefined;

function normalizeEspnCode(code: string) {
  if (code === "RSA") return "RSA";
  if (code === "BIH") return "BIH";
  return code;
}

function matchLabelFromCodes(homeCode: string, awayCode: string) {
  const home = codeToCountryName.get(normalizeEspnCode(homeCode));
  const away = codeToCountryName.get(normalizeEspnCode(awayCode));
  if (!home || !away) {
    return null;
  }
  return `${home} vs ${away}`;
}

function statusFromEspn(event: EspnEvent): MatchStatus {
  const type = event.competitions?.[0]?.status?.type ?? event.status?.type;
  if (type?.completed || type?.state === "post") {
    return "finished";
  }
  if (type?.state === "in") {
    return "live";
  }
  return "scheduled";
}

function scoreFromCompetitor(competitor?: EspnCompetitor) {
  if (!competitor || competitor.score === undefined) {
    return undefined;
  }
  const score = Number(competitor.score);
  return Number.isFinite(score) ? score : undefined;
}

function updateFromEvent(event: EspnEvent): LiveScoreUpdate | null {
  const competitors = event.competitions?.[0]?.competitors ?? [];
  const home = competitors.find((competitor) => competitor.homeAway === "home");
  const away = competitors.find((competitor) => competitor.homeAway === "away");
  const homeCode = home?.team?.abbreviation;
  const awayCode = away?.team?.abbreviation;
  if (!homeCode || !awayCode) {
    return null;
  }

  const matchLabel = matchLabelFromCodes(homeCode, awayCode);
  if (!matchLabel || !matches.some((match) => match.label === matchLabel)) {
    return null;
  }

  const status = statusFromEspn(event);
  if (status === "scheduled") {
    return { matchLabel, status, source: "espn" };
  }

  const homeScore = scoreFromCompetitor(home);
  const awayScore = scoreFromCompetitor(away);
  if (homeScore === undefined || awayScore === undefined) {
    return null;
  }

  return { matchLabel, status, homeScore, awayScore, source: "espn" };
}

function compactDates(inputMatches: Match[]) {
  return Array.from(
    new Set(
      inputMatches
        .filter((match) => match.stage === "Group")
        .map((match) => {
          const [, month, day] = match.date.match(/^(Jun|Jul) (\d+)/) ?? [];
          if (!month || !day) {
            return null;
          }
          const monthNumber = month === "Jun" ? "06" : "07";
          return `2026${monthNumber}${day.padStart(2, "0")}`;
        })
        .filter(Boolean) as string[],
    ),
  );
}

function datesUntilTomorrow() {
  const allDates = compactDates(matches);
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const maxDate = Number(
    `${tomorrow.getUTCFullYear()}${String(tomorrow.getUTCMonth() + 1).padStart(2, "0")}${String(
      tomorrow.getUTCDate(),
    ).padStart(2, "0")}`,
  );
  return allDates.filter((date) => Number(date) <= maxDate);
}

export async function fetchEspnScoreUpdates(options?: {
  dates?: string[];
  fetchImpl?: typeof fetch;
}) {
  const fetcher = options?.fetchImpl ?? fetch;
  const dates = options?.dates ?? compactDates(matches);
  const updates = new Map<string, LiveScoreUpdate>();

  for (const date of dates) {
    const response = await fetcher(`${ESPN_SCOREBOARD_URL}?dates=${date}`, {
      headers: { "user-agent": "Mozilla/5.0" },
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`ESPN scoreboard failed for ${date}: ${response.status}`);
    }
    const scoreboard = (await response.json()) as EspnScoreboard;
    for (const event of scoreboard.events ?? []) {
      const update = updateFromEvent(event);
      if (update) {
        updates.set(update.matchLabel, update);
      }
    }
  }

  return Array.from(updates.values());
}

export async function getCachedEspnScoreUpdates() {
  const now = Date.now();
  if (cachedUpdates && cachedUpdates.expiresAt > now) {
    return cachedUpdates.updates;
  }
  const updates = await fetchEspnScoreUpdates({ dates: datesUntilTomorrow() });
  cachedUpdates = {
    expiresAt: now + 60_000,
    updates,
  };
  return updates;
}

export function mergeLiveScoreUpdates(inputMatches: Match[], updates: LiveScoreUpdate[]) {
  const updatesByLabel = new Map(updates.map((update) => [update.matchLabel, update]));
  return inputMatches.map((match) => {
    const update = updatesByLabel.get(match.label);
    if (!update) {
      return match;
    }
    return {
      ...match,
      status: update.status,
      homeScore: update.homeScore,
      awayScore: update.awayScore,
    };
  });
}
