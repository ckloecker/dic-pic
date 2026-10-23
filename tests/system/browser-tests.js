const frame = document.querySelector("#app");
if (!frame.contentDocument.querySelector("#setup-form") || frame.contentDocument.readyState !== "complete") {
  await new Promise((resolve) => frame.addEventListener("load", resolve, { once: true }));
}
const app = frame.contentWindow;
const doc = frame.contentDocument;
const nativeRandom = app.Math.random;
const nativeMatchMedia = app.matchMedia.bind(app);
app.matchMedia = (query) => query === "(prefers-reduced-motion: reduce)"
  ? { matches: true } : nativeMatchMedia(query);
const sceneApi = await import(`../../src/scene.js?test=${Date.now()}`);
const levelApi = await import(`../../src/level.js?test=${Date.now()}`);
const routeApi = await import(`../../src/route.js?test=${Date.now()}`);
let fixtureOptions;
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
  const secondName = find("#second-player-name");
  if (secondName) {
    secondName.value = "Second Runner";
    secondName.dispatchEvent(new app.Event("input", { bubbles: true }));
  }
}
async function until(predicate, timeoutMs = 5000) {
  const deadline = performance.now() + timeoutMs;
  while (!predicate()) {
    if (performance.now() > deadline) throw new Error("Timed out waiting for application state.");
    await delay(20);
  }
}
async function upload(fileName) {
  let seed=123;
  app.Math.random = () => ((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
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

test("REQ-SYS-11: the project root serves the game with project-relative assets", async () => {
  const rootUrl = new URL("../../", location.href);
  const response = await fetch(rootUrl, { cache: "no-store" });
  assert(response.ok, "project root did not load");
  const rootDoc = new DOMParser().parseFromString(await response.text(), "text/html");
  assert(rootDoc.querySelector("#setup-form"), "project root does not serve the game");
  assert(rootDoc.querySelector('script[type="module"]').getAttribute("src") === "./src/app.js",
    "root entry point does not load the app through a project-relative URL");
  assert(rootDoc.querySelector('link[rel="stylesheet"]').getAttribute("href") === "./src/styles.css",
    "root entry point does not load styles through a project-relative URL");
  assert(new URL(app.location.href).pathname === rootUrl.pathname, "system runner does not exercise the root entry point");
  assert(app.getComputedStyle(find(".app-shell")).display === "flex", "root page stylesheet did not load");
});

test("REQ-SYS-16: controls are prominently presented during play", async () => {
  const setupGuide = find(".setup-controls");
  const setupTitle = find("#setup-controls-title");
  assert(setupGuide && setupTitle && setupTitle.textContent.trim() === "Controls",
    "setup screen does not explain the controls");
  const setupStyle = app.getComputedStyle(setupGuide);
  const setupTitleStyle = app.getComputedStyle(setupTitle);
  assert(setupStyle.backgroundColor !== "rgba(0, 0, 0, 0)"
    && parseFloat(setupStyle.paddingTop) >= 16
    && parseFloat(setupTitleStyle.fontSize) >= 14, "setup controls are not prominent");
  const panel = find(".controls-panel");
  const title = find(".control-title");
  assert(panel && title, "controls panel or title is missing");
  const panelStyle = app.getComputedStyle(panel);
  const titleStyle = app.getComputedStyle(title);
  assert(panelStyle.backgroundColor !== "rgba(0, 0, 0, 0)"
    && parseFloat(panelStyle.paddingTop) >= 16, "controls panel lacks a prominent background or spacing");
  assert(parseFloat(titleStyle.fontSize) >= 14 && Number(titleStyle.fontWeight) >= 700,
    "controls heading is not visually prominent");
});

test("REQ-SYS-12: every category and severity opens a private-data-free GitHub form", async () => {
  const panel = find("#feedback-panel");
  const severity = find("#feedback-severity");
  assert(panel && severity, "feedback panel or severity selector is missing");
  const links = [...panel.querySelectorAll("a[data-feedback-category]")];
  const categories = ["Bug report", "Feature request", "General feedback"];
  assert(JSON.stringify(links.map(link => link.textContent.trim())) === JSON.stringify(categories),
    "feedback category buttons do not match the approved categories");
  assert(severity.value === "Medium", "feedback severity does not initially select Medium");
  assert(JSON.stringify([...severity.options].map(option => option.value))
    === JSON.stringify(["Low", "Medium", "High", "Critical"]), "feedback severity options are incorrect");
  assert(panel.textContent.includes("GitHub") && panel.textContent.includes("public"),
    "feedback does not explain its GitHub destination and visibility");
  for (const value of ["Low", "Medium", "High", "Critical"]) {
    severity.value = value;
    severity.dispatchEvent(new app.Event("change", { bubbles: true }));
    for (const link of links) {
      const url = new URL(link.href);
      assert(url.origin === "https://github.com" && url.pathname === "/ckloecker/dic-pic/issues/new",
        "feedback link targets the wrong repository");
      assert(url.searchParams.get("template") === "feedback.yml", "feedback does not select the issue form");
      assert(url.searchParams.get("category") === link.textContent.trim(), "feedback category was not prefilled");
      assert(url.searchParams.get("severity") === value, "selected severity was not prefilled");
      const branch = find('meta[name="build-branch"]').content || "Not injected";
      const commit = find('meta[name="build-commit"]').content || "Not injected";
      assert(url.searchParams.get("branch") === branch && url.searchParams.get("commit") === commit,
        "feedback does not identify its deployed branch and commit");
      assert(find("#feedback-version").textContent.includes(branch)
        && find("#feedback-version").textContent.includes(commit), "feedback version is not visible");
      assert(JSON.stringify([...url.searchParams.keys()].sort()) === JSON.stringify(["branch", "category", "commit", "severity", "template"]),
        "feedback includes unexpected data");
      assert(link.target === "_blank" && link.relList.contains("noopener") && link.relList.contains("noreferrer"),
        "feedback does not open a separate protected tab");
    }
  }
  severity.value = "Medium";
  severity.dispatchEvent(new app.Event("change", { bubbles: true }));
  const response = await fetch("../../.github/ISSUE_TEMPLATE/feedback.yml", { cache: "no-store" });
  assert(response.ok, "GitHub feedback issue form is missing");
  const form = await response.text();
  for (const id of ["category", "severity", "branch", "commit", "feedback", "reproduction"]) {
    assert(form.includes(`id: ${id}`), `GitHub form is missing ${id}`);
  }
  assert((form.match(/type: input/g) || []).length === 4, "prefilled fields must be GitHub text inputs");
  assert((form.match(/required: true/g) || []).length === 3, "category, severity, and feedback must be required");
});

test("REQ-SYS-12/13: injected metadata survives every feedback category and severity", async () => {
  const rootUrl = new URL("../../", location.href);
  const response = await fetch(rootUrl, { cache: "no-store" });
  const branch = 'feature/a&b"<tag>';
  const commit = "0123456789abcdef0123456789abcdef01234567";
  const html = (await response.text())
    .replace(/<meta name="build-branch" content="[^"]*">/, '<meta name="build-branch" content="feature/a&amp;b&quot;&lt;tag&gt;">')
    .replace(/<meta name="build-commit" content="[^"]*">/, `<meta name="build-commit" content="${commit}">`)
    .replace("<head>", `<head><base href="${rootUrl.href}">`);
  const preview = document.createElement("iframe");
  preview.title = "Injected build metadata test";
  try {
    const loaded = new Promise(resolve => preview.addEventListener("load", resolve, { once: true }));
    preview.srcdoc = html;
    document.body.append(preview);
    await loaded;
    const previewDoc = preview.contentDocument;
    const version = previewDoc.querySelector("#feedback-version");
    assert(version && version.textContent.includes(branch) && version.textContent.includes(commit),
      "injected version was not displayed exactly");
    const severity = previewDoc.querySelector("#feedback-severity");
    for (const value of ["Low", "Medium", "High", "Critical"]) {
      severity.value = value;
      severity.dispatchEvent(new preview.contentWindow.Event("change", { bubbles: true }));
      for (const link of previewDoc.querySelectorAll("[data-feedback-category]")) {
        const url = new URL(link.href);
        assert(url.searchParams.get("branch") === branch && url.searchParams.get("commit") === commit,
          "feedback lost or corrupted injected build metadata");
        assert(url.searchParams.get("severity") === value
          && url.searchParams.get("category") === link.dataset.feedbackCategory,
          "version injection changed category or severity");
      }
    }
  } finally {
    preview.remove();
  }
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
test("REQ-LVL-01/05/12/16: sparse photos offer three repaired playable previews", async () => {
  await upload("platform-photo.svg");
  find("#start-button").click();
  const choices=[...doc.querySelectorAll(".level-choice")];
  assert(choices.length===3&&!find("#suggestions").hidden,
    `sparse photo rejected: ${find("#setup-message").textContent}`);
  choices[0].click();
  await until(()=>!find("#game-screen").hidden);
  const before=canvasPixels().slice();
  find("#reset-button").click();
  assert(canvasPixels().every((cell,index)=>cell===before[index]),"reset changed repaired preview geometry");
  assert(find("#timer").textContent==="0.00","repair or reset started the timer");
  find("#new-photo-button").click();
});
test("REQ-LVL-06/08: render photo-aligned platform interiors at 80% opacity", async () => {
  await upload("route-photo.svg");
  find("#start-button").click();
  assert(!find("#suggestions").hidden && find("#game-screen").hidden, "play started before choosing");
  const choices = [...doc.querySelectorAll(".level-choice")];
  assert(choices.length === 3, "three thumbnail choices were not shown");
  assert(new Set(choices.map((choice) => choice.dataset.biome + choice.dataset.layout)).size === 3, "duplicate variants");
  for (const choice of choices) {
    assert(choice.querySelector("canvas").width === 320, "thumbnail missing");
    assert(choice.textContent.includes(choice.dataset.biome), "biome label missing");
  }
  const jungle=choices.find(choice=>choice.dataset.biome==="jungle");
  jungle.click();
  await until(() => !find("#game-screen").hidden);
  assert(!find("#game-screen").hidden, "game did not start");
  await delay(100);
  assert(find("#timer").textContent === "0.00", `idle timer started: ${find("#timer").textContent}`);
  const image = new app.Image();
  image.src = new URL("../fixtures/route-photo.svg", location.href).href;
  await image.decode();
  const source = doc.createElement("canvas");
  source.width = 320;
  source.height = 180;
  const sourceContext = source.getContext("2d");
  sourceContext.drawImage(image,0,0,320,180);
  fixtureOptions=levelApi.createSuggestions(sourceContext.getImageData(0,0,320,180).data,320,180);
  sceneApi.drawPhoto(sourceContext, image, 320, 180);
  sceneApi.drawBiomeEffects(sourceContext, 320, 180, "jungle", 0, true);
  const pixels = canvasPixels();
  const option=fixtureOptions.find(option=>option.biome==="jungle");
  const terrainLayer=doc.createElement("canvas");
  terrainLayer.width=320;terrainLayer.height=180;
  const layerContext=terrainLayer.getContext("2d");
  sceneApi.paintTerrain(layerContext,option);
  const layerPixels=layerContext.getImageData(0,0,320,180).data;
  const samples=[];
  for(let y=4;y<176;y+=1)for(let x=4;x<316;x+=1){
    if(layerPixels[(y*320+x)*4+3]===204&&!option.details[y*320+x]
      &&!samples.some(point=>Math.hypot(point[0]-x,point[1]-y)<30))samples.push([x,y]);
  }
  assert(samples.length>=3,"not enough substantial interiors to sample");
  for (const [x, y] of samples.slice(0,3)) {
    const original = sourceContext.getImageData(x, y, 1, 1).data;
    const offset = (y * 3 * 960 + x * 3) * 4;
    const tile = [139, 91, 64];
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
test("REQ-MOV-01/05 / REQ-SYS-04: Space launches immediately and hold boosts the jump", async () => {
  find("#new-photo-button").click();
  find('.level-choice[data-biome="desert"]').click();
  await delay(50);
  const top = playerTop();
  const countColor = (red, green, blue) => {
    const pixels = canvasPixels();
    let count = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index] === red && pixels[index + 1] === green && pixels[index + 2] === blue) count += 1;
    }
    return count;
  };
  const yellowBeforeCharge = countColor(255, 209, 102);
  key("keydown", " ");
  await until(() => find("#charge-meter").value >= 0.05);
  const partial = countColor(159, 228, 193);
  assert(partial > 0, "on-character partial charge bar is missing");
  assert(playerTop() < top, "press did not launch before release");
  await until(() => find("#charge-meter").value >= 0.25);
  assert(find("#charge-label").textContent.includes("MAX JUMP"), "maximum boost was not indicated");
  assert(countColor(255, 209, 102) > yellowBeforeCharge, "character bar lacks distinct full-charge appearance");
  assert(Number(find("#timer").textContent) > 0, "jump did not start race time");
  key("keyup", " ");
  await until(() => find("#charge-meter").value === 0);
  assert(playerTop() < top - 10, "jump did not retain its upward movement");
  assert(find("#charge-meter").value === 0, "launch did not clear meter");
  assert(countColor(255, 209, 102) === yellowBeforeCharge, "launch did not clear character bar");
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
test("REQ-MOV-05: blur cancels additional jump assistance", async () => {
  find("#reset-button").click();
  const top = playerTop();
  key("keydown", " ");
  await delay(100);
  app.dispatchEvent(new app.Event("blur"));
  key("keyup", " ");
  await delay(100);
  assert(find("#charge-meter").value === 0, "blur did not clear charge");
  assert(playerTop() < top, "blur incorrectly undid the initial jump");
  assert(errors.length === 0, `browser errors: ${errors.join(", ")}`);
});
test("REQ-MOV-03/10: background holds after drill release, then jump press drops", async () => {
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
  await until(() => playerTop() > hoverTop + 2);
  assert(find("#charge-meter").value === 0, "drop charged a jump");
  key("keyup", " ");
  await delay(50);
  assert(playerTop() >= hoverTop, "drop release launched upward");
  assert(Number(find("#timer").textContent) > 0, "vertical movement did not start timer");
  assert(errors.length === 0, `browser errors: ${errors.join(", ")}`);
});

test("REQ-SYS-14: falling onto the image bottom fully resets the run", async () => {
  find("#reset-button").click();
  const initialTop = playerTop();
  key("keydown", "ArrowUp");
  key("keydown", "Enter");
  await until(() => playerTop() < initialTop - 15);
  key("keyup", "ArrowUp");
  const beforeDown = Number(find("#timer").textContent);
  assert(beforeDown > 0, "test failed to start the run before bottom fall");
  key("keydown", "ArrowDown");
  await until(() => find("#contact-message").textContent.toLowerCase().includes("bottom"), 10000);
  key("keyup", "ArrowDown");
  key("keyup", "Enter");
  await until(() => find("#timer").textContent === "0.00");
  assert(Math.abs(playerTop() - initialTop) < 1, "bottom contact did not restore the starting position");
  assert(Number(find("#timer").textContent) === 0, "bottom contact did not reset the timer");
  key("keydown", " ");
  await until(() => find("#charge-meter").value > 0);
  key("keyup", " ");
  await until(() => playerTop() < initialTop - 5);
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
        if (!matches(pixels[i], pixels[i + 1], pixels[i + 2], y, x)) continue;
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
    return bounds((r, g, b, y) => y >= top && y < top + 27 && spriteColors.has(`${r},${g},${b}`));
  };
  const bar = () => {
    const body = sprite();
    return bounds((r, g, b, y, x) => y < body.top && y >= body.top - 18
      && x >= body.left - 20 && x <= body.right + 20
      && ((r === 159 && g === 228 && b === 193) || (r === 255 && g === 209 && b === 102)));
  };
  key("keydown", " ");
  await until(() => find("#charge-meter").value >= 0.05);
  const before = sprite();
  const beforeBar = bar();
  assert(before.right - before.left < 18 && before.bottom - before.top < 27,
    "rendered sprite exceeds 6-by-9 world cells");
  assert(beforeBar.bottom < before.top && before.top - beforeBar.bottom < 18, "bar is not immediately above player");
  const direction=before.left>480?"a":"d";
  key("keydown", "Enter");
  key("keydown", direction);
  await until(() => Math.abs(sprite().left-before.left)>=18);
  key("keyup", direction);
  key("keyup", "Enter");
  await delay(30);
  const after = sprite();
  const afterBar = bar();
  for (const [body, meter] of [[before, beforeBar], [after, afterBar]]) {
    assert(Math.abs(meter.left - (Math.max(0, body.left - 11) + 3)) <= 2,
      "charge bar did not follow the character within the image-edge clamp");
  }
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

test("REQ-MOV-03 / REQ-SYS-08: repeated resets retain exactly one native animation loop", async () => {
  const nativeRequest=app.requestAnimationFrame,nativeCancel=app.cancelAnimationFrame;
  const pending=new Set(),timestamps=new Set();
  let duplicate=false;
  app.requestAnimationFrame=callback=>{
    const handle=nativeRequest(timestamp=>{
      pending.delete(handle);
      if(timestamps.has(timestamp))duplicate=true;
      timestamps.add(timestamp);
      callback(timestamp);
    });
    pending.add(handle);
    return handle;
  };
  app.cancelAnimationFrame=handle=>{pending.delete(handle);nativeCancel(handle);};
  try{
    for(let reset=0;reset<5;reset+=1){
      find("#reset-button").click();
      assert(pending.size===1,"reset scheduled parallel animation loops");
      await delay(70);
      assert(pending.size===1&&!duplicate,"native frames advanced parallel game loops");
    }
    assert(timestamps.size>=5,"native animation did not run");
  }finally{
    app.requestAnimationFrame=nativeRequest;
    app.cancelAnimationFrame=nativeCancel;
  }
});

test("REQ-LVL-10/12 / REQ-CHR-04: all previews match play and reset retains each biome", async () => {
  const checksum = (pixels) => pixels.reduce((sum, value, index) => (sum + value * (index % 97)) >>> 0, 0);
  for (const biome of ["jungle", "desert", "underwater"]) {
    find("#new-photo-button").click();
    find("#start-button").click();
    const choice = find(`.level-choice[data-biome="${biome}"]`);
    assert(choice, `missing ${biome} choice`);
    const preview = choice.querySelector("canvas").getContext("2d").getImageData(0, 0, 320, 180).data;
    choice.click();
    await until(() => !find("#game-screen").hidden);
    await delay(50);
    assert(find("#level-title").textContent.toLowerCase().includes(biome), "selected biome changed");
    assert(find(".canvas-caption").getBoundingClientRect().top >= find("#game-canvas").getBoundingClientRect().bottom,
      "HUD caption can obscure an edge finish gate");
    const live = canvasPixels();
    let different = 0;
    for (let y = 0; y < 180; y += 1) {
      for (let x = 0; x < 320; x += 1) {
        const a = (y * 320 + x) * 4;
        const b = (y * 3 * 960 + x * 3) * 4;
        if ([0, 1, 2].some((channel) => preview[a + channel] !== live[b + channel])) different += 1;
      }
    }
    assert(different <= 54, `preview/live geometry mismatch: ${different} cells`);
    find("#reset-button").click();
    const original = checksum(canvasPixels());
    key("keydown", "Enter");
    key("keydown", "ArrowDown");
    await delay(150);
    key("keyup", "Enter");
    key("keyup", "ArrowDown");
    find("#reset-button").click();
    assert(checksum(canvasPixels()) === original, `reset failed to restore the initial ${biome} scene`);
    await delay(50);
    assert(find("#timer").textContent === "0.00", "reset retained held input or race time");
  }
  assert(errors.length === 0, `browser errors: ${errors.join(", ")}`);
});

test("REQ-LVL-13: live bubbles animate without starting race time and reduced motion freezes them", async () => {
  const checksum = () => canvasPixels().reduce((sum, value, index) => (sum + value * (index % 97)) >>> 0, 0);
  app.matchMedia = (query) => query === "(prefers-reduced-motion: reduce)"
    ? { matches: false } : nativeMatchMedia(query);
  find("#reset-button").click();
  const before = checksum();
  await delay(250);
  assert(checksum() !== before, "live background effect did not animate");
  assert(find("#timer").textContent === "0.00", "cosmetic animation started race time");
  app.matchMedia = (query) => query === "(prefers-reduced-motion: reduce)"
    ? { matches: true } : nativeMatchMedia(query);
  find("#reset-button").click();
  const frozen = checksum();
  await delay(250);
  assert(checksum() === frozen, "reduced-motion effect did not stay static");
});

test("REQ-LVL-06/11/12: validated photo previews expose all three layout choices", async () => {
  find("#new-photo-button").click();
  await upload("route-photo.svg");
  find("#start-button").click();
  const options = [...doc.querySelectorAll(".level-choice")];
  assert(options.length === 3, "mixed fixture did not generate three options");
  assert(new Set(options.map((option) => option.dataset.layout)).size === 3, "missing layout choice");
  for (const choice of options) {
    choice.click();
    await until(() => !find("#game-screen").hidden);
    assert(find("#timer").textContent === "0.00", "generation started the timer");
    find("#new-photo-button").click();
  }
  assert(errors.length === 0, `browser errors: ${errors.join(", ")}`);
});

test("REQ-SYS-14: enemy contact fully resets the run and manual reset restores all", async () => {
  const nativeRequest = app.requestAnimationFrame;
  const nativeCancel = app.cancelAnimationFrame;
  let pending;
  let timestamp = performance.now();
  app.requestAnimationFrame = (callback) => { pending = callback; return 1; };
  app.cancelAnimationFrame = () => { pending = null; };
  const tick = () => {
    const callback = pending;
    pending = null;
    assert(callback, "game loop did not schedule a frame");
    timestamp += 1000 / 60;
    callback(timestamp);
  };
  // Exclude swimming animation and browser-dependent filtered-photo rasterization.
  const gameplayColors = new Set(["228,215,164", "25,15,38", "239,142,219", "255,255,255",
    "21,43,52", "131,216,194", "79,140,131", "212,242,220", "20,33,43", "255,225,140",
    "56,37,31", "255,209,102", "86,55,79", "217,131,193", "240,207,178"]);
  const gameplayChecksum = () => {
    const option = fixtureOptions.find(option => option.biome === "underwater");
    const pixels = canvasPixels();
    let sum = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      const x = index / 4 % 960 / 3;
      const y = Math.floor(index / 4 / 960) / 3;
      if (x >= option.spawn.x - 1 && x < option.spawn.x + 7
        && y >= option.spawn.y - 1 && y < option.spawn.y + 10) continue;
      if (gameplayColors.has(`${pixels[index]},${pixels[index + 1]},${pixels[index + 2]}`)) {
        sum = (sum + (pixels[index] + pixels[index + 1] * 3 + pixels[index + 2] * 7) * (index % 97)) >>> 0;
      }
    }
    return sum;
  };
  const savedScores = JSON.stringify(app.localStorage);
  try {
    find('.level-choice[data-biome="underwater"]').click();
    await until(() => !find("#game-screen").hidden
      && find("#level-title").textContent.startsWith("Underwater"));
    find("#reset-button").click();
    const idleScene = gameplayChecksum();
    const initialTop = playerTop();
    for (let i = 0; i < 20; i += 1) tick();
    assert(gameplayChecksum() === idleScene && find("#timer").textContent === "0.00", "idle enemies moved or started time");
    const option=fixtureOptions.find(option=>option.biome==="underwater");
    const enemy=option.enemies[0];
    const sampleX=Math.round(option.spawn.x+3);
    let sampleY=Math.round(option.spawn.y+10);
    while(sampleY<179&&!option.solid[sampleY*320+sampleX])sampleY+=1;
    assert(sampleY<179,"spawn has no underlying ground to excavate");
    const tunnelSample = () => {
      const pixels = canvasPixels();
      const offset = (sampleY * 3 * 960 + sampleX * 3) * 4;
      return Array.from(pixels.slice(offset, offset + 3)).join(",");
    };
    const undrilled=tunnelSample();
    key("keydown","Enter");
    key("keydown","ArrowDown");
    for(let i=0;i<240&&tunnelSample()===undrilled;i+=1)tick();
    key("keyup","ArrowDown");
    const drilled=tunnelSample();
    assert(drilled!==undrilled,"test did not excavate a real terrain cell");
    key("keydown", "ArrowUp");
    tick();
    key("keyup", "ArrowUp");
    key("keydown", "Enter");
    const playerLeft = () => {
      const pixels=canvasPixels();
      let left=960;
      for(let i=0;i<pixels.length;i+=4){
        if(pixels[i]===36&&pixels[i+1]===127&&pixels[i+2]===123)left=Math.min(left,(i/4)%960);
      }
      return left/3-1;
    };
    const aimX=(enemy.left+enemy.right)/2+2;
    const aimY=enemy.y-5;
    for(let i=0;i<2000&&!find("#contact-message").textContent;i+=1){
      const dx=aimX-playerLeft(),dy=aimY-playerTop();
      for(const [value,held] of [["ArrowLeft",dx<-0.5],["ArrowRight",dx>0.5],
        ["ArrowUp",dy<-0.5],["ArrowDown",dy>0.5]]){
        key(held?"keydown":"keyup",value);
      }
      tick();
    }
    for(const value of ["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"])key("keyup",value);
    assert(find("#contact-message").textContent.includes("Enemy contact — run reset"),
      `enemy contact did not respawn at ${playerLeft()},${playerTop()} toward ${aimX},${aimY}`);
    assert(find("#complete-panel").hidden, "enemy contact completed or saved a run");
    assert(JSON.stringify(app.localStorage) === savedScores, "enemy contact wrote a score");
    assert(Number(find("#timer").textContent) === 0, "contact did not reset the timer");
    assert(tunnelSample() === undrilled, "contact did not restore excavated terrain");
    const returnedTop = playerTop();
    assert(Math.abs(returnedTop - initialTop) < 1, `contact did not return to selected spawn: ${returnedTop}`);
    const returnedLeft = playerLeft();
    for (let i = 0; i < 10; i += 1) tick();
    assert(Math.abs(playerLeft() - returnedLeft) < 1 && find("#charge-meter").value === 0,
      "held movement/drill controls survived contact");
    assert(Number(find("#timer").textContent) === 0, "held input started the reset run");
    find("#reset-button").click();
    assert(gameplayChecksum() === idleScene, "manual reset did not restore terrain and enemies");
    assert(Math.abs(playerTop() - initialTop) < 1, "manual reset changed the selected spawn");
    assert(find("#timer").textContent === "0.00" && !find("#contact-message").textContent, "manual reset retained contact state");
    assert(tunnelSample() !== drilled, "test did not excavate a real terrain cell");
    find("#new-photo-button").click();
  } finally {
    if (!find("#game-screen").hidden) find("#new-photo-button").click();
    app.requestAnimationFrame = nativeRequest;
    app.cancelAnimationFrame = nativeCancel;
    key("keyup", "ArrowLeft");
    key("keyup", "Enter");
  }
});

test("REQ-SYS-12: keyboard feedback controls do not trigger gameplay", async () => {
  find('.level-choice[data-biome="jungle"]').click();
  await until(() => !find("#game-screen").hidden);
  const severity = find("#feedback-severity");
  const panel = find("#feedback-panel");
  assert(severity && panel, "feedback controls are missing during play");
  const nativeRequest = app.requestAnimationFrame;
  const nativeCancel = app.cancelAnimationFrame;
  let pending;
  let timestamp = performance.now();
  const tick = () => {
    const callback = pending;
    pending = null;
    assert(callback, "feedback interaction lost the game loop");
    timestamp += 1000 / 60;
    callback(timestamp);
  };
  try {
    app.cancelAnimationFrame = () => { pending = null; };
    app.requestAnimationFrame = callback => { pending = callback; return 1; };
    find("#reset-button").click();
    tick();
    key("keydown", "ArrowRight");
    severity.focus();
    assert(doc.activeElement === severity, "severity selector is not focusable during play");
    const initial = canvasPixels().slice();
    for (const value of ["ArrowDown", "ArrowUp", " ", "Enter", "d"]) {
      const event = new app.KeyboardEvent("keydown", { key: value, bubbles: true, cancelable: true });
      severity.dispatchEvent(event);
      assert(!event.defaultPrevented, `feedback consumed native ${value} interaction`);
    }
    for (let index = 0; index < 5; index += 1) tick();
    assert(find("#timer").textContent === "0.00", "feedback keyboard input started the race");
    assert(find("#charge-meter").value === 0, "feedback keyboard input charged a jump");
    assert(canvasPixels().every((value, index) => value === initial[index]),
      "feedback focus did not clear held movement or feedback keys affected gameplay");
    assert(!panel.hidden && app.getComputedStyle(panel).display !== "none", "feedback is hidden during play");
  } finally {
    key("keyup", "ArrowRight");
    severity.blur();
    find("#new-photo-button").click();
    app.requestAnimationFrame = nativeRequest;
    app.cancelAnimationFrame = nativeCancel;
  }
});

test("REQ-LVL-16 / REQ-SYS-06: no-drill replay finishes and outlines the exact ranked or unranked attempt", async () => {
  const option=fixtureOptions.find(option=>option.biome==="jungle");
  assert(routeApi.verifyReferenceRoute(option).valid,"fixture reference replay is not valid");
  const bytes=await(await fetch("../fixtures/route-photo.svg")).arrayBuffer();
  const hash=async buffer=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",buffer)),
    byte=>byte.toString(16).padStart(2,"0")).join("");
  const photoId=await hash(bytes);
  const levelId=await hash(new TextEncoder().encode(`${photoId}:${levelApi.levelIdentity(option)}`));
  const storageKey=`dic-pic:leaderboard:${levelId}`;
  const original=app.localStorage.getItem(storageKey);
  const nativeRequest=app.requestAnimationFrame,nativeCancel=app.cancelAnimationFrame;
  const nativeSet=app.Storage.prototype.setItem;
  let pending,timestamp=performance.now();
  app.requestAnimationFrame=callback=>{pending=callback;return 1;};
  app.cancelAnimationFrame=()=>{pending=null;};
  const tick=dt=>{
    const callback=pending;pending=null;
    assert(callback,"replay lost its animation frame");
    timestamp+=dt*1000;callback(timestamp);
  };
  const replay=()=>{
    timestamp=100000;
    tick(1/60);
    let previous={};
    for(const action of option.route.actions){
      for(const [value,held] of [["ArrowLeft",action.input.move<0],["ArrowRight",action.input.move>0],
        ["ArrowUp",action.input.moveY<0],["ArrowDown",action.input.moveY>0]]){
        if(Boolean(previous[value])!==held)key(held?"keydown":"keyup",value);
        previous[value]=held;
      }
      tick(action.dt);
      if(!find("#complete-panel").hidden)break;
    }
    for(const value of ["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"])key("keyup",value);
    assert(!find("#complete-panel").hidden,"actual application did not finish the reference route");
    assert(find("#feedback-panel") && app.getComputedStyle(find("#feedback-panel")).display !== "none",
      "feedback is unavailable after completion");
    assert(!find("#contact-message").textContent,"reference route touched an enemy");
    const rows=[...doc.querySelectorAll("#leaderboard-list li")];
    const marked=rows.filter(row=>row.classList.contains("current-run"));
    assert(marked.length===1&&marked[0].getAttribute("aria-current")==="true"
      &&marked[0].textContent.includes("Your run"),"exact attempt was not marked accessibly");
    const style=app.getComputedStyle(marked[0]);
    assert(style.outlineStyle==="solid"&&parseFloat(style.outlineWidth)>=2,"current run lacks a clear outline");
    return {rows,current:marked[0]};
  };
  try{
    app.localStorage.removeItem(storageKey);
    find('.level-choice[data-biome="jungle"]').click();
    await until(()=>!find("#game-screen").hidden);
    const initialScene=canvasPixels();
    const ranked=replay();
    assert(ranked.current.querySelector(".leaderboard-rank").textContent==="01","ranked attempt has no place");
    const saved=JSON.parse(app.localStorage.getItem(storageKey));
    assert(saved.length===1&&saved[0].id,"ranked attempt was not persisted with an identity");
    app.localStorage.setItem(storageKey,JSON.stringify(saved));
    const secondPlayer=[...find("#next-player").options].find(option=>option.textContent==="Second Runner");
    assert(secondPlayer,"next-round selector omitted the second player");
    find("#next-player").value=secondPlayer.value;
    find("#next-round-button").click();
    await until(()=>!find("#game-screen").hidden);
    assert(find("#level-title").textContent.includes("Second Runner"),"next round did not select the second player");
    assert(find("#timer").textContent==="0.00"&&canvasPixels().every((value,index)=>value===initialScene[index]),
      "second player did not receive the same reset course");
    replay();
    const secondSaved=JSON.parse(app.localStorage.getItem(storageKey));
    assert(secondSaved.length===2&&secondSaved[1].name==="Second Runner",
      "second player's completed round was not attributed to their name");
    find("#replay-button").click();
    const tied=replay();
    assert(tied.rows.length===3&&tied.current===tied.rows[2],"equal name/time highlighted the older attempt");
    assert(JSON.parse(app.localStorage.getItem(storageKey))[0].id===saved[0].id,"ties lost their stable order");
    const fast=Array.from({length:10},(_,index)=>({id:`browser-fast-${index}`,name:"Test Runner",timeMs:index+1}));
    app.localStorage.setItem(storageKey,JSON.stringify(fast));
    find("#replay-button").click();
    const slow=replay();
    assert(slow.rows.length===11&&slow.current===slow.rows[10]
      &&slow.current.querySelector(".leaderboard-rank").textContent==="","unranked attempt lacks its placeless footer");
    assert(app.localStorage.getItem(storageKey)===JSON.stringify(fast),"unranked footer persisted an eleventh entry");
    app.Storage.prototype.setItem=function(key,value){
      if(key===storageKey)throw new app.DOMException("Test storage unavailable","QuotaExceededError");
      return nativeSet.call(this,key,value);
    };
    find("#replay-button").click();
    replay();
    assert(find("#score-message").textContent.includes("could not be saved"),"storage failure was hidden");
  }finally{
    find("#new-photo-button").click();
    app.requestAnimationFrame=nativeRequest;app.cancelAnimationFrame=nativeCancel;
    app.Storage.prototype.setItem=nativeSet;
    if(original===null)app.localStorage.removeItem(storageKey);
    else app.localStorage.setItem(storageKey,original);
  }
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
app.Math.random = nativeRandom;
app.matchMedia = nativeMatchMedia;
if (!find("#game-screen").hidden) find("#new-photo-button").click();
