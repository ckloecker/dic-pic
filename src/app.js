import { cancelCharge, DRILL_RADIUS, stepPlayer } from "./physics.js";
import { createRun, reachedFlag, respawnPlayer } from "./run.js";
import { getLeaderboard, isValidPlayerName, submitScore } from "./leaderboard.js";
import {
  generateTerrain,
  NoUsableEdgeError,
  openSpaceRatio,
  TERRAIN_OPACITY,
} from "./terrain.js";

const WORLD_WIDTH = 320;
const WORLD_HEIGHT = 180;
const canvas = document.querySelector("#game-canvas");
const context = canvas.getContext("2d");
const setupScreen = document.querySelector("#setup-screen");
const gameScreen = document.querySelector("#game-screen");
const completePanel = document.querySelector("#complete-panel");
const setupForm = document.querySelector("#setup-form");
const nameInput = document.querySelector("#player-name");
const nameMessage = document.querySelector("#name-message");
const setupMessage = document.querySelector("#setup-message");
const startButton = document.querySelector("#start-button");
const uploadInput = document.querySelector("#upload-input");
const cameraInput = document.querySelector("#camera-input");
const photoName = document.querySelector("#photo-name");
const timerValue = document.querySelector("#timer");
const scoreMessage = document.querySelector("#score-message");
const keyState = new Set();
const touchState = { left: false, right: false, up: false, down: false, drill: false, jump: false };

const state = {
  image: null,
  levelId: null,
  playerName: "",
  terrain: null,
  player: null,
  originalTerrain: null,
  flag: null,
  startedAt: null,
  elapsedMs: 0,
  running: false,
  jumpPressed: false,
  jumpReleased: false,
  frameHandle: null,
  previousFrame: 0,
  terrainLayer: null,
  terrainLayerVersion: -1,
};

context.imageSmoothingEnabled = false;
context.setTransform(3, 0, 0, 3, 0, 0);

function setMessage(element, text, isError = false) {
  element.textContent = text;
  element.classList.toggle("error", isError);
}

function updateNameValidity() {
  const valid = isValidPlayerName(nameInput.value);
  nameInput.setAttribute("aria-invalid", String(!valid && nameInput.value.length > 0));
  nameMessage.textContent = valid || nameInput.value.length === 0
    ? "Letters and spaces only."
    : "Use letters and spaces only (maximum 32 characters).";
  nameMessage.classList.toggle("invalid", !valid && nameInput.value.length > 0);
  startButton.disabled = !valid || !state.image || !state.levelId;
  return valid;
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
    state.image = image;
    state.levelId = levelId;
    state.originalTerrain = null;
    photoName.textContent = `${file.name} · ${image.naturalWidth} × ${image.naturalHeight}`;
    setMessage(setupMessage, "");
  } catch (error) {
    state.image = null;
    state.levelId = null;
    photoName.textContent = "No photo selected yet.";
    setMessage(setupMessage, error.message, true);
  }
  updateNameValidity();
}

nameInput.addEventListener("input", updateNameValidity);
uploadInput.addEventListener("change", () => {
  selectImage(uploadInput.files?.[0]);
  uploadInput.value = "";
});
cameraInput.addEventListener("change", () => {
  selectImage(cameraInput.files?.[0]);
  cameraInput.value = "";
});

function makeTerrainFromImage(image) {
  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = WORLD_WIDTH;
  sourceCanvas.height = WORLD_HEIGHT;
  const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
  sourceContext.drawImage(image, 0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  const pixels = sourceContext.getImageData(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  return generateTerrain(pixels.data, WORLD_WIDTH, WORLD_HEIGHT);
}

function setUpGame() {
  const terrain = state.originalTerrain || makeTerrainFromImage(state.image);
  if (openSpaceRatio(terrain) < 0.8) {
    throw new Error("This photo did not produce enough open space. Choose a different image.");
  }
  const run = createRun(terrain);
  stopAnimation();
  clearControls();
  state.originalTerrain = terrain;
  Object.assign(state, run);
  state.previousFrame = 0;
  state.terrainLayer = document.createElement("canvas");
  state.terrainLayer.width = WORLD_WIDTH;
  state.terrainLayer.height = WORLD_HEIGHT;
  state.terrainLayerVersion = -1;
  state.running = true;
  setupScreen.hidden = true;
  completePanel.hidden = true;
  gameScreen.hidden = false;
  document.querySelector("#level-title").textContent = `Find the exit, ${state.playerName}`;
  timerValue.textContent = "0.00";
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
  label.textContent = full ? "MAX READY — release to jump" : (
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

setupForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!updateNameValidity() || !state.image || !state.levelId) {
    setMessage(setupMessage, "Enter a valid name and select a photo to start.", true);
    return;
  }
  state.playerName = nameInput.value.trim();
  try {
    setUpGame();
  } catch (error) {
    setMessage(setupMessage, error.message, true);
    if (error instanceof NoUsableEdgeError) {
      state.image = null;
      state.levelId = null;
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
  const pixels = layerContext.createImageData(WORLD_WIDTH, WORLD_HEIGHT);
  const { terrain } = state;
  for (let y = 0; y < WORLD_HEIGHT; y += 1) {
    for (let x = 0; x < WORLD_WIDTH; x += 1) {
      const cellIndex = y * WORLD_WIDTH + x;
      if (terrain.solid[cellIndex] === 0) {
        continue;
      }
      const colorOffset = cellIndex * 4;
      const hasOpenTop = y === 0 || terrain.solid[(y - 1) * WORLD_WIDTH + x] === 0;
      if (hasOpenTop) {
        pixels.data[colorOffset] = 123;
        pixels.data[colorOffset + 1] = 190;
        pixels.data[colorOffset + 2] = 113;
      } else if ((Math.floor(x / 5) + Math.floor(y / 4)) % 2 === 0) {
        pixels.data[colorOffset] = 139;
        pixels.data[colorOffset + 1] = 91;
        pixels.data[colorOffset + 2] = 64;
      } else {
        pixels.data[colorOffset] = 105;
        pixels.data[colorOffset + 1] = 69;
        pixels.data[colorOffset + 2] = 54;
      }
      pixels.data[colorOffset + 3] = Math.round(TERRAIN_OPACITY * 255);
    }
  }
  layerContext.putImageData(pixels, 0, 0);
  state.terrainLayerVersion = terrain.version;
}

function drawExit() {
  const x = state.flag.x;
  const floorY = state.flag.y;
  context.fillStyle = "#e9ead5";
  context.fillRect(x + 1, floorY - 25, 2, 25);
  context.fillStyle = "#ff9a65";
  context.fillRect(x + 3, floorY - 24, 10, 6);
  context.fillStyle = "#f4f2e9";
  context.fillRect(x + 3, floorY - 18, 7, 3);
  context.fillStyle = "#32473e";
  context.fillRect(x, floorY - 2, state.flag.width, 2);
}

function drawPlayer() {
  const { x, y, facing } = state.player;
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

function drawDrillBubble() {
  const { x, y } = state.player;
  if (state.player.drilling) {
    context.beginPath();
    context.arc(x + state.player.width / 2, y + state.player.height / 2, DRILL_RADIUS, 0, Math.PI * 2);
    context.fillStyle = "rgba(159, 228, 193, 0.15)";
    context.fill();
    context.strokeStyle = "#9fe4c1";
    context.lineWidth = 1;
    context.stroke();
  }
}

function drawScene() {
  context.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  context.drawImage(state.image, 0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  clearTerrainLayer();
  context.drawImage(state.terrainLayer, 0, 0);
  drawExit();
  drawDrillBubble();
  drawPlayer();
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

function showLeaderboard(scores) {
  const list = document.querySelector("#leaderboard-list");
  list.replaceChildren();
  if (scores.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty-leaderboard";
    empty.textContent = "No saved runs for this photo yet.";
    list.append(empty);
    return;
  }
  scores.forEach((score, index) => {
    const row = document.createElement("li");
    const rank = document.createElement("span");
    const name = document.createElement("span");
    const time = document.createElement("span");
    rank.className = "leaderboard-rank";
    name.className = "leaderboard-name";
    time.className = "leaderboard-time";
    rank.textContent = String(index + 1).padStart(2, "0");
    name.textContent = score.name;
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
  state.elapsedMs = state.startedAt === null ? 0 : performance.now() - state.startedAt;
  timerValue.textContent = elapsedLabel(state.elapsedMs);
  document.querySelector("#winner-name").textContent = state.playerName;
  document.querySelector("#final-time").textContent = `${elapsedLabel(state.elapsedMs)} seconds`;
  gameScreen.hidden = true;
  completePanel.hidden = false;
  try {
    const scores = submitScore(state.levelId, {
      name: state.playerName,
      timeMs: state.elapsedMs,
    });
    showLeaderboard(scores);
    setMessage(scoreMessage, "Saved in this browser.");
  } catch (error) {
    setMessage(scoreMessage, `Your time is shown, but it could not be saved: ${error.message}`, true);
    try {
      showLeaderboard(getLeaderboard(state.levelId));
    } catch (readError) {
      showLeaderboard([]);
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
  const beforeX = state.player.x;
  const beforeY = state.player.y;
  const input = getInput();
  if (state.startedAt === null && input.jumpPressed && state.player.grounded) {
    state.startedAt = timestamp;
  }
  stepPlayer(state.player, input, state.terrain, dt);
  state.jumpPressed = false;
  state.jumpReleased = false;

  const movedByPlayer = (input.move !== 0 && state.player.x !== beforeX)
    || (input.jumpReleased && state.player.y !== beforeY)
    || state.player.charging
    || (input.drill && input.moveY !== 0 && state.player.y !== beforeY);
  if (state.startedAt === null && movedByPlayer) {
    state.startedAt = timestamp;
  }
  if (state.startedAt !== null) {
    state.elapsedMs = timestamp - state.startedAt;
    timerValue.textContent = elapsedLabel(state.elapsedMs);
  }

  if (state.player.y >= WORLD_HEIGHT) respawnPlayer(state);
  updateChargeIndicator();
  drawScene();
  if (reachedFlag(state)) {
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
  if (state.player) cancelCharge(state.player);
  document.querySelectorAll(".control-button.pressed").forEach((button) => button.classList.remove("pressed"));
}

function goToSetup() {
  stopAnimation();
  clearControls();
  gameScreen.hidden = true;
  completePanel.hidden = true;
  setupScreen.hidden = false;
  setMessage(setupMessage, "");
  updateNameValidity();
}

document.querySelector("#new-photo-button").addEventListener("click", goToSetup);
document.querySelector("#again-button").addEventListener("click", goToSetup);
document.querySelector("#reset-button").addEventListener("click", restartRun);
document.querySelector("#replay-button").addEventListener("click", restartRun);

function jumpIsHeld() {
  return touchState.jump || keyState.has(" ");
}

window.addEventListener("keydown", (event) => {
  if (gameScreen.hidden) {
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
