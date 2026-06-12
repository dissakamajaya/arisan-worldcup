import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function readEnv(key) {
  const env = readFileSync(new URL("../.env", import.meta.url), "utf8");
  const line = env.split(/\r?\n/).find((item) => item.startsWith(`${key}=`));
  if (!line) return "";
  return line.slice(key.length + 1).trim().replace(/^['"]|['"]$/g, "");
}

function parseBuckets() {
  const source = readFileSync(new URL("../src/lib/worldcup.ts", import.meta.url), "utf8");
  const favorite = [
    ...source.matchAll(/code:\s*"([^"]+)"[^}]+drawBucket:\s*"favorite"/g),
  ].map((match) => match[1]);
  const leastFavorite = [
    ...source.matchAll(/code:\s*"([^"]+)"[^}]+drawBucket:\s*"least_favorite"/g),
  ].map((match) => match[1]);
  return { favorite, leastFavorite };
}

function pickRandom(input) {
  return input[Math.floor(Math.random() * input.length)];
}

async function insertAssignmentPair(client, participantId, countryCodes, bucketsByCode) {
  const withBucketRows = countryCodes.map((code) => ({
    participant_id: participantId,
    country_code: code,
    draw_bucket: bucketsByCode.get(code),
  }));
  const withBucket = await client.from("arisan_country_assignments").insert(withBucketRows);
  if (!withBucket.error) return;

  const missingColumn = withBucket.error.code === "PGRST204" || withBucket.error.code === "42703";
  if (!missingColumn) throw new Error(withBucket.error.message);

  const rows = countryCodes.map((code) => ({
    participant_id: participantId,
    country_code: code,
  }));
  const fallback = await client.from("arisan_country_assignments").insert(rows);
  if (fallback.error) throw new Error(fallback.error.message);
}

async function main() {
  const url = readEnv("SUPABASE_URL");
  const serviceRoleKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) throw new Error("SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY missing");

  const { favorite, leastFavorite } = parseBuckets();
  if (favorite.length !== 24 || leastFavorite.length !== 24) {
    throw new Error(`Invalid bucket sizes: favorite=${favorite.length}, least=${leastFavorite.length}`);
  }

  const client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const participantsResult = await client
    .from("arisan_participants")
    .select("id,email,paid_at")
    .order("paid_at", { ascending: true });
  if (participantsResult.error) throw new Error(participantsResult.error.message);

  const participants = participantsResult.data ?? [];
  const dissaIncluded = participants.some((participant) => participant.email === "dissa@houseofexp.com");
  if (!dissaIncluded) throw new Error("dissa@houseofexp.com not found in paid participants");

  const deleted = await client.from("arisan_country_assignments").delete().neq("country_code", "");
  if (deleted.error) throw new Error(deleted.error.message);

  const availableFavorite = [...favorite];
  const availableLeastFavorite = [...leastFavorite];
  const bucketsByCode = new Map([
    ...favorite.map((code) => [code, "favorite"]),
    ...leastFavorite.map((code) => [code, "least_favorite"]),
  ]);

  for (const participant of participants) {
    if (!availableFavorite.length || !availableLeastFavorite.length) {
      throw new Error("Not enough countries left for balanced redraw");
    }

    const favoriteCode = pickRandom(availableFavorite);
    const leastFavoriteCode = pickRandom(availableLeastFavorite);
    availableFavorite.splice(availableFavorite.indexOf(favoriteCode), 1);
    availableLeastFavorite.splice(availableLeastFavorite.indexOf(leastFavoriteCode), 1);

    await insertAssignmentPair(client, participant.id, [favoriteCode, leastFavoriteCode], bucketsByCode);
  }

  const verify = await client
    .from("arisan_country_assignments")
    .select("participant_id,country_code,arisan_participants!inner(email)");
  if (verify.error) throw new Error(verify.error.message);

  const assigned = verify.data ?? [];
  const duplicateCountries = assigned
    .map((assignment) => assignment.country_code)
    .filter((code, index, codes) => codes.indexOf(code) !== index);
  if (duplicateCountries.length) {
    throw new Error(`Duplicate countries after redraw: ${duplicateCountries.join(",")}`);
  }

  const dissaAssignments = assigned.filter(
    (assignment) => assignment.arisan_participants.email === "dissa@houseofexp.com",
  );
  const dissaFavoriteCount = dissaAssignments.filter((assignment) =>
    favorite.includes(assignment.country_code),
  ).length;
  const dissaLeastCount = dissaAssignments.filter((assignment) =>
    leastFavorite.includes(assignment.country_code),
  ).length;

  console.log(
    JSON.stringify(
      {
        ok: true,
        participants: participants.length,
        assignments: assigned.length,
        duplicateCountries: duplicateCountries.length,
        dissaIncluded,
        dissaFavoriteCount,
        dissaLeastCount,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, message: error.message }, null, 2));
  process.exit(1);
});
