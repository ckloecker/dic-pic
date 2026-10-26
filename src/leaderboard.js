const KEY_PREFIX = "dic-pic:leaderboard:";
const MAX_ENTRIES = 10;

function cookieKey(key) {
  if (typeof key !== "string" || key.length === 0) {
    throw new TypeError("A leaderboard cookie key is required.");
  }
  return key.replace(/[^A-Za-z0-9_-]/g, "_");
}

export function createCookieStorage(document = globalThis.document) {
  if (!document || typeof document.cookie !== "string") {
    throw new TypeError("Cookie storage is unavailable in this browser.");
  }
  return {
    getItem(key) {
      const name = cookieKey(key);
      for (const item of document.cookie.split(";")) {
        const separator = item.indexOf("=");
        if (separator < 0 || item.slice(0, separator).trim() !== name) continue;
        try {
          return decodeURIComponent(item.slice(separator + 1).trim());
        } catch (error) {
          throw new Error(`Saved leaderboard cookie could not be decoded: ${error.message}`);
        }
      }
      return null;
    },
    setItem(key, value) {
      if (typeof value !== "string") throw new TypeError("Leaderboard cookie values must be strings.");
      const name = cookieKey(key);
      document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; SameSite=Lax; Max-Age=31536000`;
      if (this.getItem(key) !== value) {
        throw new Error("The browser could not persist leaderboard data in a cookie.");
      }
    },
    removeItem(key) {
      const name = cookieKey(key);
      document.cookie = `${name}=; Path=/; SameSite=Lax; Max-Age=0`;
      if (this.getItem(key) !== null) {
        throw new Error("The browser could not remove the leaderboard cookie.");
      }
    },
  };
}

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
    || (score.id !== undefined && (typeof score.id !== "string" || !score.id))
  ))) {
    throw new Error("Saved leaderboard data has an invalid format.");
  }
  return scores;
}

export function getLeaderboard(levelId, storage = createCookieStorage()) {
  return readScores(levelId, storage)
    .sort((first, second) => first.timeMs - second.timeMs)
    .slice(0, MAX_ENTRIES);
}

export function submitScore(levelId, entry, storage = createCookieStorage()) {
  const name = typeof entry?.name === "string" ? entry.name.trim() : "";
  const timeMs = entry?.timeMs;
  if (!isValidPlayerName(name)) {
    throw new TypeError("Player name must contain only letters and spaces (maximum 32 characters).");
  }
  if (!Number.isFinite(timeMs)) {
    throw new TypeError("Score time must be a finite number.");
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

export function completionFeedback(rank, entryCount = MAX_ENTRIES, random = Math.random) {
  if (rank !== null && (!Number.isInteger(rank) || rank < 1 || rank > entryCount)) {
    throw new RangeError("Leaderboard placement must be a valid rank or null.");
  }
  if (typeof random !== "function") throw new TypeError("A feedback selector is required.");
  const phrases = rank === 1
    ? ["Top of the board. The pixels are legally required to respect you.",
      "First place. Your photo is now nervous."]
    : rank !== null && rank <= 3
      ? ["Podium secured. Your pixels are making tiny victory noises.",
        "Top three. The gate would like an autograph."]
      : rank !== null
        ? [`Number ${rank}. The mushrooms have requested a rematch.`,
          `Rank ${rank}: suspiciously competent for a person made of pixels.`]
        : ["Unranked, but the gate has no idea how leaderboards work.",
          "No leaderboard slot. The pixels still saw what you did."];
  const selection = random();
  if (!Number.isFinite(selection) || selection < 0 || selection >= 1) {
    throw new RangeError("Feedback selector must return a value from zero up to one.");
  }
  return phrases[Math.floor(selection * phrases.length)];
}
