import { cancelCharge, DRILL_REACH, stepPlayer } from "./physics.js";
import { applyRunEffects, collectPickups, createRun, reachedFlag, resetRun, stepMovingPlatforms,
  stepRunEffects } from "./run.js";
import { enemyContact, stepEnemies } from "./enemies.js";
import { getLeaderboard, isValidPlayerName, leaderboardRows, submitScore } from "./leaderboard.js";
import { NoUsableEdgeError } from "./terrain.js";
import { BIOMES, LAYOUTS, createSuggestions, levelIdentity } from "./level.js";
import { drawBiomeEffects, drawEnemies, drawGate, drawHeadwear, drawPhoto, drawPreview,
  drawMovingPlatforms, drawPickups, drawSwimmingPlayer, paintTerrain, paintTerrainShadow } from "./scene.js";

const WORLD_WIDTH = 320;
const WORLD_HEIGHT = 180;
const canvas = document.querySelector("#game-canvas");
const context = canvas.getContext("2d");
const setupScreen = document.querySelector("#setup-screen");
const gameScreen = document.querySelector("#game-screen");
const completePanel = document.querySelector("#complete-panel");
const setupForm = document.querySelector("#setup-form");
const nameInput = document.querySelector("#player-name");
const secondNameInput = document.querySelector("#second-player-name");
const nameMessage = document.querySelector("#name-message");
const secondNameMessage = document.querySelector("#second-name-message");
const setupMessage = document.querySelector("#setup-message");
const startButton = document.querySelector("#start-button");
const uploadInput = document.querySelector("#upload-input");
const cameraInput = document.querySelector("#camera-input");
const photoName = document.querySelector("#photo-name");
const suggestions = document.querySelector("#suggestions");
const choices = document.querySelector("#level-choices");
const timerValue = document.querySelector("#timer");
const scoreMessage = document.querySelector("#score-message");
const feedbackPanel = document.querySelector("#feedback-panel");
const feedbackSeverity = document.querySelector("#feedback-severity");
const keyState = new Set();
const touchState = { left: false, right: false, up: false, down: false, drill: false, jump: false };

const state = {
  image: null,
  photoId: null,
  options: [],
  imageRequest: 0,
  levelId: null,
  playerName: "",
  playerNames: [],
  playerIndex: 0,
  terrain: null,
  player: null,
  originalTerrain: null,
  flag: null,
  startedAt: null,
  elapsedMs: 0,
  effectSeconds: 0,
  running: false,
  jumpPressed: false,
  jumpReleased: false,
  frameHandle: null,
  previousFrame: 0,
  terrainLayer: null,
  effectLayer: null,
  terrainLayerVersion: -1,
};

context.imageSmoothingEnabled = false;
context.setTransform(3, 0, 0, 3, 0, 0);

function setMessage(element, text, isError = false) {
  element.textContent = text;
  element.classList.toggle("error", isError);
}

function updateNameValidity() {
  const validFirst = isValidPlayerName(nameInput.value);
  const validSecond = isValidPlayerName(secondNameInput.value);
  for (const [input, message, valid] of [
    [nameInput, nameMessage, validFirst],
    [secondNameInput, secondNameMessage, validSecond],
  ]) {
    input.setAttribute("aria-invalid", String(!valid && input.value.length > 0));
    message.textContent = valid || input.value.length === 0
      ? "Letters and spaces only."
      : "Use letters and spaces only (maximum 32 characters).";
    message.classList.toggle("invalid", !valid && input.value.length > 0);
  }
  startButton.disabled = !validFirst || !validSecond || !state.image || !state.photoId;
  return validFirst && validSecond;
}

function hashBytes(buffer) {
  if (!globalThis.crypto?.subtle) {
    throw new Error("This browser cannot create a secure level identifier. Use a current browser over localhost or HTTPS.");
  }
  return globalThis.crypto.subtle.digest("SHA-256", buffer).then((digest) => (
    Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
  ));
}

function decodeImage(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("This image could not be opened. Choose another image file."));
    };
    image.src = objectUrl;
  });
}

async function selectImage(file) {
  if (!file) {
    return;
  }
  const request = ++state.imageRequest;
  state.image = null;
  state.photoId = null;
  state.levelId = null;
  state.originalTerrain = null;
  state.options = [];
  suggestions.hidden = true;
  choices.replaceChildren();
  updateNameValidity();
  setMessage(setupMessage, "");
  if (!file.type.startsWith("image/")) {
    state.image = null;
    state.levelId = null;
    photoName.textContent = "Choose a valid image file.";
    setMessage(setupMessage, "That file is not an image. Choose a photo file.", true);
    updateNameValidity();
    return;
  }

  try {
    const [image, levelId] = await Promise.all([
      decodeImage(file),
      file.arrayBuffer().then(hashBytes),
    ]);
    if (request !== state.imageRequest) return;
    state.image = image;
    state.photoId = levelId;
    state.originalTerrain = null;
    photoName.textContent = `${file.name} · ${image.naturalWidth} × ${image.naturalHeight}`;
    setMessage(setupMessage, "");
  } catch (error) {
    if (request !== state.imageRequest) return;
    state.image = null;
    state.levelId = null;
    photoName.textContent = "No photo selected yet.";
    setMessage(setupMessage, error.message, true);
  }
  updateNameValidity();
}

nameInput.addEventListener("input", updateNameValidity);
secondNameInput.addEventListener("input", updateNameValidity);
uploadInput.addEventListener("change", () => {
  selectImage(uploadInput.files?.[0]);
  uploadInput.value = "";
});
cameraInput.addEventListener("change", () => {
  selectImage(cameraInput.files?.[0]);
  cameraInput.value = "";
});

function makeOptionsFromImage(image) {
  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = WORLD_WIDTH;
  sourceCanvas.height = WORLD_HEIGHT;
  const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
  sourceContext.drawImage(image, 0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  const pixels = sourceContext.getImageData(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  return createSuggestions(pixels.data, WORLD_WIDTH, WORLD_HEIGHT);
}

function setUpGame() {
  const terrain = state.originalTerrain;
  if (!terrain) throw new Error("Choose a level preview before playing.");
  const run = createRun(terrain);
  stopAnimation();
  clearControls();
  state.originalTerrain = terrain;
  Object.assign(state, run);
  state.previousFrame = 0;
  state.effectSeconds = 0;
  state.terrainLayer = document.createElement("canvas");
  state.terrainLayer.width = WORLD_WIDTH;
  state.terrainLayer.height = WORLD_HEIGHT;
  state.effectLayer = document.createElement("canvas");
  state.effectLayer.width = WORLD_WIDTH;
  state.effectLayer.height = WORLD_HEIGHT;
  state.terrainLayerVersion = -1;
  state.running = true;
  setupScreen.hidden = true;
  suggestions.hidden = true;
  completePanel.hidden = true;
  gameScreen.hidden = false;
  document.querySelector("#level-title").textContent = `${BIOMES[terrain.biome].label} finish, ${state.playerName}`;
  timerValue.textContent = "0.00";
  document.querySelector("#contact-message").textContent = "";
  updateChargeIndicator();
  drawScene();
  state.frameHandle = requestAnimationFrame(gameFrame);
}

function stopAnimation() {
  if (state.frameHandle !== null) cancelAnimationFrame(state.frameHandle);
  state.frameHandle = null;
  state.running = false;
}

function updateChargeIndicator() {
  const seconds = state.player?.chargeSeconds || 0;
  const full = seconds >= 3;
  document.querySelector("#charge-meter").value = seconds;
  const label = document.querySelector("#charge-label");
  label.textContent = state.player?.climbing ? "Press jump to drop" : full ? "MAX READY — release to jump" : (
    state.player?.charging ? `CHARGING ${Math.round(seconds / 3 * 100)}%` : "Hold jump to charge · release to jump"
  );
  label.classList.toggle("charge-full", full);
}

function restartRun() {
  try {
    setUpGame();
  } catch (error) {
    goToSetup();
    setMessage(setupMessage, `Unable to restart: ${error.message}`, true);
  }
}

async function chooseOption(option, button) {
  const request = state.imageRequest;
  const photoId = state.photoId;
  choices.querySelectorAll("button").forEach((choice) => { choice.disabled = true; });
  try {
    const levelId = await hashBytes(new TextEncoder().encode(`${photoId}:${levelIdentity(option)}`));
    if (request !== state.imageRequest || !state.options.includes(option)) return;
    state.originalTerrain = option;
    state.levelId = levelId;
    state.playerName = nameInput.value.trim();
    state.playerNames = [nameInput.value.trim(), secondNameInput.value.trim()];
    state.playerIndex = 0;
    if (!updateNameValidity()) throw new Error("Enter a valid runner name before playing.");
    setUpGame();
  } catch (error) {
    setMessage(setupMessage, error.message, true);
  } finally {
    choices.querySelectorAll("button").forEach((choice) => { choice.disabled = false; });
    if (!setupScreen.hidden) button.focus();
  }
}

setupForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!updateNameValidity() || !state.image || !state.photoId) {
    setMessage(setupMessage, "Enter a valid name and select a photo to start.", true);
    return;
  }
  state.playerName = nameInput.value.trim();
  state.options = [];
  suggestions.hidden = true;
  choices.replaceChildren();
  try {
    state.options = makeOptionsFromImage(state.image);
    choices.replaceChildren();
    for (const option of state.options) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "level-choice";
      button.dataset.biome = option.biome;
      button.dataset.layout = option.layout;
      button.dataset.edge = option.edge;
      const preview = document.createElement("canvas");
      preview.width = WORLD_WIDTH;
      preview.height = WORLD_HEIGHT;
      preview.setAttribute("aria-hidden", "true");
      drawPreview(preview.getContext("2d"), state.image, option);
      const label = document.createElement("span");
      label.textContent = `${option.biome} / ${LAYOUTS[option.layout]} - Play`;
      button.append(preview, label);
      button.addEventListener("click", () => chooseOption(option, button));
      choices.append(button);
    }
    suggestions.hidden = false;
    setMessage(setupMessage, "Choose your preferred level below. The timer starts only when you play.");
    choices.querySelector("button").focus();
  } catch (error) {
    setMessage(setupMessage, error.message, true);
    if (error instanceof NoUsableEdgeError) {
      state.image = null;
      state.levelId = null;
      state.photoId = null;
      photoName.textContent = "Photo rejected. Choose another image.";
      updateNameValidity();
    }
  }
});

function clearTerrainLayer() {
  if (state.terrainLayerVersion === state.terrain.version) {
    return;
  }
  const layerContext = state.terrainLayer.getContext("2d");
  const { terrain } = state;
  paintTerrain(layerContext, terrain);
  paintTerrainShadow(layerContext, terrain);
  state.terrainLayerVersion = terrain.version;
}

function drawExit() {
  drawGate(context, state.flag);
}

function drawPlayer() {
  if (state.terrain.biome === "underwater") {
    drawSwimmingPlayer(context, state.player, state.effectSeconds);
    return;
  }
  const { x, y, facing } = state.player;
  if (state.player.climbing) {
    const stride = Math.sin(state.player.climbPhase) * 1.5;
    context.fillStyle = "#344b52";
    context.fillRect(x + 1, y + 5 + stride, 1.5, 2.5);
    context.fillRect(x + 3.5, y + 5 - stride, 1.5, 2.5);
    context.fillStyle = "#247f7b";
    context.fillRect(x + 1, y + 3, 4, 4);
    context.fillStyle = "#e9bd91";
    context.fillRect(x, y + 1.5 + stride, 1.5, 2.5);
    context.fillRect(x + 4.5, y + 1.5 - stride, 1.5, 2.5);
    context.fillRect(x + 1.5, y + 1, 3, 2);
    context.fillStyle = "#173b42";
    context.fillRect(x + 1, y, 4, 2);
    drawHeadwear(context, state.player, state.terrain.biome);
    return;
  }
  context.save();
  context.translate(x, y);
  context.scale(state.player.width / 8, state.player.height / 12);
  if (facing < 0) {
    context.translate(8, 0);
    context.scale(-1, 1);
  }
  const px = 0;
  context.fillStyle = "#23353a";
  context.fillRect(px + 1, 10, 6, 2);
  context.fillStyle = "#16262d";
  context.fillRect(px + 1, 10, 3, 2);
  context.fillStyle = "#e9bd91";
  context.fillRect(px + 2, 1, 5, 4);
  context.fillStyle = "#173b42";
  context.fillRect(px + 1, 0, 6, 3);
  context.fillRect(px, 2, 2, 2);
  context.fillStyle = "#247f7b";
  context.fillRect(px + 1, 4, 6, 5);
  context.fillStyle = "#f5a15f";
  context.fillRect(px + 1, 5, 7, 2);
  context.fillStyle = "#d6e8c3";
  context.fillRect(px + 6, 2, 1, 1);
  context.fillStyle = "#344b52";
  context.fillRect(px + 2, 8, 2, 3);
  context.fillRect(px + 5, 8, 2, 3);
  context.restore();
  drawHeadwear(context, state.player, state.terrain.biome);
}

function drawPlayerCharge() {
  const player = state.player;
  if (!player.charging) return;
  const x = Math.max(0, Math.min(WORLD_WIDTH - 12, player.x + player.width / 2 - 6));
  const y = Math.max(0, player.y - 5);
  context.fillStyle = "#16262d";
  context.fillRect(x, y, 12, 3);
  context.fillStyle = player.chargeSeconds >= 3 ? "#ffd166" : "#9fe4c1";
  context.fillRect(x + 1, y + 1, 10 * player.chargeSeconds / 3, 1);
}

function drawDrill() {
  const player = state.player;
  if (!player.drilling) return;
  context.save();
  context.translate(player.x + player.width / 2, player.y + player.height / 2);
  context.rotate(Math.atan2(player.drillY, player.drillX));
  context.fillStyle = "#344b52";
  context.fillRect(2, -2, 3, 4);
  context.beginPath();
  context.moveTo(5, -2.5);
  context.lineTo(DRILL_REACH, 0);
  context.lineTo(5, 2.5);
  context.closePath();
  context.fillStyle = "#d6e8c3";
  context.fill();
  context.restore();
}

function drawScene() {
  context.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  drawPhoto(context, state.image, WORLD_WIDTH, WORLD_HEIGHT);
  const effectContext = state.effectLayer.getContext("2d");
  effectContext.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  drawBiomeEffects(effectContext, WORLD_WIDTH, WORLD_HEIGHT, state.terrain.biome, state.effectSeconds,
    window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  context.drawImage(state.effectLayer, 0, 0);
  clearTerrainLayer();
  context.drawImage(state.terrainLayer, 0, 0);
  drawMovingPlatforms(context, state.movingPlatforms);
  drawEnemies(context, state.enemies, state.terrain.biome);
  drawPickups(context, state.pickups, state.effectSeconds);
  drawExit();
  drawPlayer();
  drawDrill();
  drawPlayerCharge();
}

function getInput() {
  const keyboardMove = Number(keyState.has("ArrowRight") || keyState.has("d") || keyState.has("D"))
    - Number(keyState.has("ArrowLeft") || keyState.has("a") || keyState.has("A"));
  const move = keyboardMove || Number(touchState.right) - Number(touchState.left);
  const moveY = Number(keyState.has("ArrowDown") || keyState.has("s") || keyState.has("S") || touchState.down)
    - Number(keyState.has("ArrowUp") || keyState.has("w") || keyState.has("W") || touchState.up);
  return {
    move,
    moveY,
    jumpPressed: state.jumpPressed,
    jumpReleased: state.jumpReleased,
    jumpHeld: jumpIsHeld(),
    drill: keyState.has("Enter") || touchState.drill,
  };
}

function elapsedLabel(milliseconds) {
  return (milliseconds / 1000).toFixed(2);
}

function showLeaderboard(scores, current) {
  const list = document.querySelector("#leaderboard-list");
  list.replaceChildren();
  if (scores.length === 0 && !current) {
    const empty = document.createElement("li");
    empty.className = "empty-leaderboard";
    empty.textContent = "No saved runs for this photo yet.";
    list.append(empty);
    return;
  }
  leaderboardRows(scores, current).forEach((score) => {
    const row = document.createElement("li");
    const rank = document.createElement("span");
    const name = document.createElement("span");
    const time = document.createElement("span");
    rank.className = "leaderboard-rank";
    name.className = "leaderboard-name";
    time.className = "leaderboard-time";
    rank.textContent = score.rank === null ? "" : String(score.rank).padStart(2, "0");
    name.textContent = score.name;
    if (score.current) {
      row.classList.add("current-run");
      row.setAttribute("aria-current", "true");
      const label = document.createElement("strong");
      label.className = "current-run-label";
      label.textContent = "Your run";
      name.append(" · ", label);
    }
    time.textContent = `${elapsedLabel(score.timeMs)}s`;
    row.append(rank, name, time);
    list.append(row);
  });
}

function finishLevel() {
  if (!state.running) {
    return;
  }
  stopAnimation();
  clearControls();
  timerValue.textContent = elapsedLabel(state.elapsedMs);
  document.querySelector("#winner-name").textContent = state.playerName;
  document.querySelector("#final-time").textContent = `${elapsedLabel(state.elapsedMs)} seconds`;
  const nextPlayer = document.querySelector("#next-player");
  nextPlayer.replaceChildren(...state.playerNames.map((name, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = name;
    return option;
  }));
  nextPlayer.value = String((state.playerIndex + 1) % state.playerNames.length);
  gameScreen.hidden = true;
  completePanel.hidden = false;
  const current = { id: crypto.randomUUID(), name: state.playerName, timeMs: state.elapsedMs };
  try {
    const scores = submitScore(state.levelId, current);
    showLeaderboard(scores, current);
    setMessage(scoreMessage, "Saved in this browser.");
  } catch (error) {
    setMessage(scoreMessage, `Your time is shown, but it could not be saved: ${error.message}`, true);
    try {
      showLeaderboard(getLeaderboard(state.levelId), current);
    } catch (readError) {
      showLeaderboard([], current);
      setMessage(scoreMessage, `Leaderboard unavailable: ${readError.message}`, true);
    }
  }
}

function gameFrame(timestamp) {
  if (!state.running) {
    return;
  }
  const frameDelta = state.previousFrame === 0 ? 1 / 60 : (timestamp - state.previousFrame) / 1000;
  const dt = Math.max(0, Math.min(frameDelta, 0.05));
  state.previousFrame = timestamp;
  state.effectSeconds += dt;
  stepRunEffects(state, dt);
  const beforeX = state.player.x;
  const beforeY = state.player.y;
  const previousPlayer = { ...state.player };
  const wasClimbing = state.player.climbing;
  const input = applyRunEffects(getInput(), state);
  if (state.startedAt === null && input.jumpPressed && state.player.grounded) {
    state.startedAt = timestamp;
  }
  stepPlayer(state.player, input, state.terrain, dt);
  collectPickups(state);
  state.jumpPressed = false;
  state.jumpReleased = false;

  const movedByPlayer = (input.move !== 0 && state.player.x !== beforeX)
    || (input.jumpReleased && state.player.y !== beforeY)
    || state.player.charging
    || (wasClimbing && input.jumpPressed)
    || (input.moveY !== 0 && state.player.y !== beforeY);
  if (state.startedAt === null && movedByPlayer) {
    state.startedAt = timestamp;
  }
  if (state.startedAt !== null) {
    state.elapsedMs = timestamp - state.startedAt;
    timerValue.textContent = elapsedLabel(state.elapsedMs);
    stepEnemies(state.enemies, dt);
    stepMovingPlatforms(state, dt);
  }

  const hitEnemy = enemyContact(state.player, state.enemies, previousPlayer);
  const hitBottom = state.player.y + state.player.height >= WORLD_HEIGHT - 1e-9;
  if (hitEnemy || hitBottom) {
    resetRun(state);
    clearControls();
    state.effectSeconds = 0;
    state.terrainLayerVersion = -1;
    document.querySelector("#contact-message").textContent = hitEnemy
      ? "Enemy contact — run reset."
      : "Bottom contact — run reset.";
    timerValue.textContent = "0.00";
  }
  updateChargeIndicator();
  drawScene();
  if (!hitEnemy && !hitBottom && reachedFlag(state)) {
    finishLevel();
    return;
  }
  state.frameHandle = requestAnimationFrame(gameFrame);
}

function clearControls() {
  keyState.clear();
  touchState.left = false;
  touchState.right = false;
  touchState.drill = false;
  touchState.up = false;
  touchState.down = false;
  touchState.jump = false;
  state.jumpPressed = false;
  state.jumpReleased = false;
  if (state.player) {
    cancelCharge(state.player);
    state.player.upHeld = false;
    state.player.dropJumpHeld = false;
  }
  document.querySelectorAll(".control-button.pressed").forEach((button) => button.classList.remove("pressed"));
}

function goToSetup() {
  stopAnimation();
  clearControls();
  gameScreen.hidden = true;
  completePanel.hidden = true;
  setupScreen.hidden = false;
  suggestions.hidden = state.options.length !== 3;
  setMessage(setupMessage, "");
  updateNameValidity();
}

document.querySelector("#new-photo-button").addEventListener("click", goToSetup);
document.querySelector("#again-button").addEventListener("click", goToSetup);
document.querySelector("#next-round-button").addEventListener("click", () => {
  state.playerIndex = Number(document.querySelector("#next-player").value);
  state.playerName = state.playerNames[state.playerIndex];
  restartRun();
});
document.querySelector("#reset-button").addEventListener("click", restartRun);
document.querySelector("#replay-button").addEventListener("click", restartRun);

const buildBranch = document.querySelector('meta[name="build-branch"]').content || "Not injected";
const buildCommit = document.querySelector('meta[name="build-commit"]').content || "Not injected";
document.querySelector("#feedback-version").textContent = `Branch: ${buildBranch}; commit: ${buildCommit}.`;

function updateFeedbackLinks() {
  feedbackPanel.querySelectorAll("[data-feedback-category]").forEach((link) => {
    const url = new URL(link.href);
    url.searchParams.set("severity", feedbackSeverity.value);
    url.searchParams.set("branch", buildBranch);
    url.searchParams.set("commit", buildCommit);
    link.href = url.href;
  });
}
updateFeedbackLinks();
feedbackSeverity.addEventListener("change", updateFeedbackLinks);
feedbackPanel.addEventListener("focusin", clearControls);

function jumpIsHeld() {
  return touchState.jump || keyState.has(" ");
}

window.addEventListener("keydown", (event) => {
  if (gameScreen.hidden || (event.target instanceof Element && feedbackPanel.contains(event.target))) {
    return;
  }
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " ", "Enter"].includes(event.key)) {
    event.preventDefault();
  }
  const heldBefore = jumpIsHeld();
  keyState.add(event.key);
  if (!heldBefore && jumpIsHeld()) state.jumpPressed = true;
});

window.addEventListener("keyup", (event) => {
  const heldBefore = jumpIsHeld();
  keyState.delete(event.key);
  if (heldBefore && !jumpIsHeld() && state.running) state.jumpReleased = true;
});

window.addEventListener("blur", clearControls);

function bindHoldButton(button, onPress, onRelease, onCancel = onRelease) {
  const release = (event) => {
    event.preventDefault();
    onRelease();
    button.classList.remove("pressed");
  };
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    onPress();
    button.classList.add("pressed");
  });
  button.addEventListener("pointerup", release);
  const cancel = () => {
    if (!button.classList.contains("pressed")) return;
    onCancel();
    button.classList.remove("pressed");
  };
  button.addEventListener("pointercancel", cancel);
  button.addEventListener("lostpointercapture", cancel);
}

document.querySelectorAll("[data-move]").forEach((button) => {
  const direction = Number(button.dataset.move);
  const property = direction < 0 ? "left" : "right";
  bindHoldButton(button, () => { touchState[property] = true; }, () => { touchState[property] = false; });
});
document.querySelectorAll("[data-move-y]").forEach((button) => {
  const property = Number(button.dataset.moveY) < 0 ? "up" : "down";
  bindHoldButton(button, () => { touchState[property] = true; }, () => { touchState[property] = false; });
});

bindHoldButton(
  document.querySelector("#jump-button"),
  () => {
    const heldBefore = jumpIsHeld();
    touchState.jump = true;
    if (!heldBefore) state.jumpPressed = true;
  },
  () => {
    const heldBefore = jumpIsHeld();
    touchState.jump = false;
    if (heldBefore && !jumpIsHeld()) state.jumpReleased = true;
  },
  () => {
    touchState.jump = false;
    state.jumpPressed = false;
    state.jumpReleased = false;
    if (state.player) cancelCharge(state.player);
  },
);
bindHoldButton(
  document.querySelector("#drill-button"),
  () => { touchState.drill = true; },
  () => { touchState.drill = false; },
);

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    clearControls();
    state.previousFrame = 0;
  }
});

updateNameValidity();
