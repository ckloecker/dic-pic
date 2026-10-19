const KEY_PREFIX = "dic-pic:leaderboard:";
const MAX_ENTRIES = 10;

export function isValidPlayerName(name) {
  return typeof name === "string"
    && name.length >= 1
    && name.length <= 32
    && /^(?=.*\p{L})[\p{L} ]+$/u.test(name);
}

function keyForLevel(levelId) {
  if (typeof levelId !== "string" || levelId.length === 0) {
    throw new TypeError("A level identifier is required.");
  }
  return `${KEY_PREFIX}${levelId}`;
}

function readScores(levelId, storage) {
  const serialized = storage.getItem(keyForLevel(levelId));
  if (serialized === null) {
    return [];
  }

  let scores;
  try {
    scores = JSON.parse(serialized);
  } catch (error) {
    throw new Error(`Saved leaderboard data is invalid: ${error.message}`);
  }
  if (!Array.isArray(scores) || scores.some((score) => (
    !score
    || !isValidPlayerName(score.name)
    || !Number.isFinite(score.timeMs)
    || score.timeMs < 0
    || (score.id !== undefined && (typeof score.id !== "string" || !score.id))
  ))) {
    throw new Error("Saved leaderboard data has an invalid format.");
  }
  return scores;
}

export function getLeaderboard(levelId, storage = globalThis.localStorage) {
  return readScores(levelId, storage)
    .sort((first, second) => first.timeMs - second.timeMs)
    .slice(0, MAX_ENTRIES);
}

export function submitScore(levelId, entry, storage = globalThis.localStorage) {
  const name = typeof entry?.name === "string" ? entry.name.trim() : "";
  const timeMs = entry?.timeMs;
  if (!isValidPlayerName(name)) {
    throw new TypeError("Player name must contain only letters and spaces (maximum 32 characters).");
  }
  if (!Number.isFinite(timeMs) || timeMs < 0) {
    throw new TypeError("Score time must be a non-negative number.");
  }

  const scores = readScores(levelId, storage);
  const id = entry.id ?? globalThis.crypto.randomUUID();
  if (typeof id !== "string" || !id) throw new TypeError("A valid attempt identifier is required.");
  if (scores.some((score) => score.id === id)) throw new Error("This attempt has already been saved.");
  scores.push({ id, name, timeMs });
  scores.sort((first, second) => first.timeMs - second.timeMs);
  const topScores = scores.slice(0, MAX_ENTRIES);
  storage.setItem(keyForLevel(levelId), JSON.stringify(topScores));
  return topScores;
}

export function leaderboardRows(scores, current) {
  const rows = scores.map((score, index) => ({
    ...score, rank: index + 1, current: Boolean(current?.id && score.id === current.id),
  }));
  if (current && !rows.some((row) => row.current)) rows.push({ ...current, rank: null, current: true });
  return rows;
}
