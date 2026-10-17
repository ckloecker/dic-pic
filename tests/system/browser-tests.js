const frame = document.querySelector("#app");
if (!frame.contentDocument.querySelector("#setup-form") || frame.contentDocument.readyState !== "complete") {
  await new Promise((resolve) => frame.addEventListener("load", resolve, { once: true }));
}
const app = frame.contentWindow;
const doc = frame.contentDocument;
const find = (selector) => doc.querySelector(selector);
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const errors = [];
app.addEventListener("error", (event) => errors.push(event.message));
const tests = [];
function test(name, run) { tests.push({ name, run }); }
function key(type, value) {
  app.dispatchEvent(new app.KeyboardEvent(type, { key: value, bubbles: true, cancelable: true }));
}
function name(value) {
  find("#player-name").value = value;
  find("#player-name").dispatchEvent(new app.Event("input", { bubbles: true }));
}
async function until(predicate) {
  const deadline = performance.now() + 5000;
  while (!predicate()) {
    if (performance.now() > deadline) throw new Error("Timed out waiting for application state.");
    await delay(20);
  }
}
async function upload(fileName) {
  const response = await fetch(`../fixtures/${fileName}`);
  assert(response.ok, `Could not load fixture: ${fileName}`);
  const transfer = new app.DataTransfer();
  transfer.items.add(new app.File([await response.blob()], fileName, { type: "image/svg+xml" }));
  find("#upload-input").files = transfer.files;
  find("#upload-input").dispatchEvent(new app.Event("change", { bubbles: true }));
  await until(() => !find("#start-button").disabled);
}
function canvasPixels() {
  const canvas = find("#game-canvas");
  return canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
}
function playerTop() {
  const pixels = canvasPixels();
  for (let y = 0; y < 540; y += 1) {
    for (let x = 0; x < 960; x += 1) {
      const index = (y * 960 + x) * 4;
      if (pixels[index] === 36 && pixels[index + 1] === 127 && pixels[index + 2] === 123) return y / 3 - 3;
    }
  }
  throw new Error("Player was not rendered.");
}

test("REQ-CHR-03: favicon loads before setup and depicts the player character", async () => {
  const link = find('link[rel="icon"]');
  assert(link, "game page does not declare a favicon");
  assert(link.type === "image/svg+xml", "favicon does not declare its SVG type");
  const response = await fetch(link.href, { cache: "no-store" });
  assert(response.ok, "declared favicon could not be loaded");
  const image = new app.Image();
  image.src = link.href;
  await image.decode();
  const canvas = doc.createElement("canvas");
  canvas.width = 16;
  canvas.height = 16;
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, 16, 16);
  const pixels = context.getImageData(0, 0, 16, 16).data;
  const palette = new Map([
    ["#23353a", [35, 53, 58]], ["#16262d", [22, 38, 45]],
    ["#e9bd91", [233, 189, 145]], ["#173b42", [23, 59, 66]],
    ["#247f7b", [36, 127, 123]], ["#f5a15f", [245, 161, 95]],
    ["#d6e8c3", [214, 232, 195]], ["#344b52", [52, 75, 82]],
  ]);
  const expected = new Uint8ClampedArray(16 * 16 * 4);
  for (const [color, x, y, width, height] of [
    ["#23353a", 1, 10, 6, 2], ["#16262d", 1, 10, 3, 2],
    ["#e9bd91", 2, 1, 5, 4], ["#173b42", 1, 0, 6, 3],
    ["#173b42", 0, 2, 2, 2], ["#247f7b", 1, 4, 6, 5],
    ["#f5a15f", 1, 5, 7, 2], ["#d6e8c3", 6, 2, 1, 1],
    ["#344b52", 2, 8, 2, 3], ["#344b52", 5, 8, 2, 3],
  ]) {
    for (let row = y + 2; row < y + 2 + height; row += 1) {
      for (let column = x + 4; column < x + 4 + width; column += 1) {
        expected.set([...palette.get(color), 255], (row * 16 + column) * 4);
      }
    }
  }
  assert(pixels.every((value, index) => value === expected[index]), "favicon does not match player artwork");
  assert(!find("#setup-screen").hidden, "favicon check requires game setup");
});

test("REQ-SYS-05 / REQ-LVL-05: invalid names and edgeless images cannot start", async () => {
  name("Ada 2");
  assert(find("#start-button").disabled, "invalid name was accepted");
  name("Test Runner");
  await upload("uniform-photo.svg");
  find("#start-button").click();
  assert(find("#start-button").disabled, "edgeless image was accepted");
  assert(find("#setup-message").textContent.includes("another photo"), "rejection lacks guidance");
});
test("REQ-LVL-06/08: render photo-aligned separate platforms at 80% opacity", async () => {
  await upload("platform-photo.svg");
  find("#start-button").click();
  assert(!find("#game-screen").hidden, "game did not start");
  await delay(100);
  assert(find("#timer").textContent === "0.00", "idle timer started");
  const image = new app.Image();
  image.src = "../tests/fixtures/platform-photo.svg";
  await image.decode();
  const source = doc.createElement("canvas");
  source.width = 320;
  source.height = 180;
  const sourceContext = source.getContext("2d");
  sourceContext.drawImage(image, 0, 0, 320, 180);
  const pixels = canvasPixels();
  for (const [x, y] of [[40, 145], [135, 95], [235, 45]]) {
    const original = sourceContext.getImageData(x, y, 1, 1).data;
    const offset = (y * 3 * 960 + x * 3) * 4;
    const tile = (Math.floor(x / 5) + Math.floor(y / 4)) % 2 === 0 ? [139, 91, 64] : [105, 69, 54];
    for (let channel = 0; channel < 3; channel += 1) {
      const expected = Math.round(original[channel] * 0.2 + tile[channel] * 0.8);
      assert(Math.abs(pixels[offset + channel] - expected) <= 1, `platform alpha/alignment mismatch at ${x},${y}`);
    }
  }
});
test("REQ-MOV-01/10: W and up climb without drilling, charging or jumping", async () => {
  for (const value of ["w", "ArrowUp"]) {
    find("#reset-button").click();
    const top = playerTop();
    key("keydown", value);
    await until(() => playerTop() < top - 3);
    assert(find("#charge-meter").value === 0, `${value} charged a jump`);
    key("keyup", value);
    await delay(50);
    const heldTop = playerTop();
    await delay(150);
    assert(Math.abs(playerTop() - heldTop) < 1, `${value} did not hold the background`);
  }
  assert(Number(find("#timer").textContent) > 0, "climbing did not start timer");
  find("#reset-button").click();
});
test("REQ-MOV-01/05 / REQ-SYS-04: Space charges, character bar fills, release launches", async () => {
  const top = playerTop();
  const countColor = (red, green, blue) => {
    const pixels = canvasPixels();
    let count = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index] === red && pixels[index + 1] === green && pixels[index + 2] === blue) count += 1;
    }
    return count;
  };
  key("keydown", " ");
  await until(() => find("#charge-meter").value >= 0.5);
  const partial = countColor(159, 228, 193);
  assert(partial > 0, "on-character partial charge bar is missing");
  await until(() => find("#charge-meter").value >= 1.5);
  assert(countColor(159, 228, 193) > partial, "on-character bar did not fill with charge");
  await until(() => find("#charge-meter").value >= 3);
  assert(find("#charge-label").textContent.includes("MAX READY"), "maximum charge was not indicated");
  assert(countColor(255, 209, 102) > 0, "character bar lacks distinct full-charge appearance");
  assert(Number(find("#timer").textContent) >= 3, "charging did not count as race time");
  assert(Math.abs(playerTop() - top) < 1, "jump launched before release");
  key("keyup", " ");
  await until(() => playerTop() < top - 10);
  assert(find("#charge-meter").value === 0, "launch did not clear meter");
  assert(countColor(255, 209, 102) === 0, "launch did not clear character bar");
});
test("REQ-SYS-08: reset restores the scene, clears held input, and records no score", async () => {
  const before = JSON.stringify(app.localStorage);
  key("keydown", "d");
  find("#reset-button").click();
  await delay(100);
  assert(find("#timer").textContent === "0.00", "reset did not clear timer or held input");
  assert(find("#charge-meter").value === 0, "reset did not clear charge");
  assert(find("#level-title").textContent.includes("Test Runner"), "reset lost name");
  assert(JSON.stringify(app.localStorage) === before, "abandoned run wrote a score");
  key("keyup", "d");
});
test("REQ-MOV-05: blur cancels charge without launching", async () => {
  find("#reset-button").click();
  const top = playerTop();
  key("keydown", " ");
  await delay(100);
  app.dispatchEvent(new app.Event("blur"));
  key("keyup", " ");
  await delay(100);
  assert(find("#charge-meter").value === 0, "blur did not clear charge");
  assert(Math.abs(playerTop() - top) < 1, "cancelled charge launched");
  assert(errors.length === 0, `browser errors: ${errors.join(", ")}`);
});
test("REQ-MOV-03/10: background holds after drill release, then jump detaches", async () => {
  find("#reset-button").click();
  const originalTop = playerTop();
  key("keydown", "Enter");
  key("keydown", "w");
  await until(() => playerTop() < originalTop - 5);
  key("keyup", "w");
  key("keyup", "Enter");
  await delay(100);
  const hoverTop = playerTop();
  await delay(200);
  assert(Math.abs(playerTop() - hoverTop) < 1, "releasing drill detached background grip");
  assert(find("#charge-meter").value === 0, "climbing input charged a jump");
  key("keydown", " ");
  await until(() => find("#charge-meter").value > 0);
  key("keyup", " ");
  await until(() => playerTop() < hoverTop - 5);
  await until(() => playerTop() > hoverTop + 2);
  assert(Number(find("#timer").textContent) > 0, "vertical movement did not start timer");
  assert(errors.length === 0, `browser errors: ${errors.join(", ")}`);
});

test("REQ-MOV-03/08: drill down lands at solid bottom without respawn", async () => {
  find("#reset-button").click();
  key("keydown", "ArrowDown");
  key("keydown", "Enter");
  await until(() => playerTop() >= 170);
  key("keyup", "ArrowDown");
  key("keyup", "Enter");
  const top = playerTop();
  await delay(200);
  assert(top >= 170 && Math.abs(playerTop() - top) < 1, "bottom contact respawned or fell out");
  assert(Number(find("#timer").textContent) > 0, "drilling down did not start timer");
  key("keydown", " ");
  await until(() => find("#charge-meter").value > 0);
  key("keyup", " ");
  await until(() => playerTop() < top - 5);
  assert(errors.length === 0, `browser errors: ${errors.join(", ")}`);
});

test("REQ-MOV-10: climbing animates alternating hands and feet", async () => {
  find("#reset-button").click();
  const limbPose = () => {
    const pixels = canvasPixels();
    const skin = [];
    let left = 960;
    let top = 540;
    for (let y = 0; y < 540; y += 1) {
      for (let x = 0; x < 960; x += 1) {
        const i = (y * 960 + x) * 4;
        if (pixels[i] === 233 && pixels[i + 1] === 189 && pixels[i + 2] === 145) {
          skin.push([x, y]);
          left = Math.min(left, x);
          top = Math.min(top, y);
        }
      }
    }
    assert(skin.length > 0, "climbing hands are not rendered");
    return skin.map(([x, y]) => `${x - left},${y - top}`).join(";");
  };
  key("keydown", "ArrowUp");
  await delay(100);
  key("keyup", "ArrowUp");
  await delay(50);
  const pose = limbPose();
  key("keydown", "ArrowUp");
  await delay(350);
  key("keyup", "ArrowUp");
  await delay(50);
  assert(limbPose() !== pose, "climbing did not animate hand positions");
  find("#reset-button").click();
});

test("REQ-CHR-02 / REQ-MOV-05: smaller sprite and charge bar move together", async () => {
  find("#reset-button").click();
  const spriteColors = new Set(["35,53,58", "22,38,45", "233,189,145", "23,59,66",
    "36,127,123", "245,161,95", "214,232,195", "52,75,82"]);
  const bounds = (matches) => {
    const pixels = canvasPixels();
    let left = 960;
    let right = -1;
    let top = 540;
    let bottom = -1;
    for (let y = 0; y < 540; y += 1) {
      for (let x = 0; x < 960; x += 1) {
        const i = (y * 960 + x) * 4;
        if (!matches(pixels[i], pixels[i + 1], pixels[i + 2], y)) continue;
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
    assert(right >= left, "expected player/bar pixels were not drawn");
    return { left, right, top, bottom };
  };
  const sprite = () => {
    const top = Math.floor(playerTop() * 3);
    return bounds((r, g, b, y) => y >= top && spriteColors.has(`${r},${g},${b}`));
  };
  const bar = () => bounds((r, g, b) => r === 159 && g === 228 && b === 193);
  key("keydown", " ");
  await until(() => find("#charge-meter").value >= 0.4);
  const before = sprite();
  const beforeBar = bar();
  assert(before.right - before.left < 18 && before.bottom - before.top < 27,
    "rendered sprite exceeds 6-by-9 world cells");
  assert(beforeBar.bottom < before.top && before.top - beforeBar.bottom < 18, "bar is not immediately above player");
  key("keydown", "d");
  await until(() => sprite().left >= before.left + 18);
  key("keyup", "d");
  const after = sprite();
  const afterBar = bar();
  assert(Math.abs((afterBar.left - beforeBar.left) - (after.left - before.left)) <= 2,
    "charge bar did not follow the character");
  app.dispatchEvent(new app.Event("blur"));
  key("keyup", " ");
  await delay(100);
  assert(find("#charge-meter").value === 0, "cancellation did not clear HUD charge");
  const pixels = canvasPixels();
  let remains = false;
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i] === 159 && pixels[i + 1] === 228 && pixels[i + 2] === 193) remains = true;
  }
  assert(!remains, "cancellation left the character bar visible");
});

let passed = 0;
for (const check of tests) {
  const item = document.createElement("li");
  try {
    await check.run();
    passed += 1;
    item.className = "pass";
    item.textContent = `PASS: ${check.name}`;
  } catch (error) {
    item.className = "fail";
    item.textContent = `FAIL: ${check.name} - ${error.message}`;
  }
  document.querySelector("#results").append(item);
}
document.querySelector("#summary").textContent = `${passed}/${tests.length} tests passed`;
