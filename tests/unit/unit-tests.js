const results = document.querySelector("#results");
const summary = document.querySelector("#summary");
const checks = [];

function test(name, run) {
  checks.push({ name, run });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function flatTerrain(width = 40, height = 32, floor = 24) {
  const solid = new Uint8Array(width * height);
  for (let y = floor; y < height; y += 1) {
    solid.fill(1, y * width, (y + 1) * width);
  }
  return {
    width,
    height,
    solid,
    surfaceY: new Float32Array(width).fill(floor),
  };
}

let terrainApi;
let physicsApi;
let leaderboardApi;
let runApi;
const moduleRevision = `?test=${Date.now()}`;

try {
  terrainApi = await import(`../../src/terrain.js${moduleRevision}`);
} catch (error) {
  test("terrain module is available", () => { throw error; });
}
try {
  physicsApi = await import(`../../src/physics.js${moduleRevision}`);
} catch (error) {
  test("physics module is available", () => { throw error; });
}
try {
  leaderboardApi = await import(`../../src/leaderboard.js${moduleRevision}`);
} catch (error) {
  test("leaderboard module is available", () => { throw error; });
}
try {
  runApi = await import(`../../src/run.js${moduleRevision}`);
} catch (error) {
  test("run lifecycle module is available", () => { throw error; });
}

if (terrainApi) {
  test("REQ-LVL-06: terrain overlay opacity is exactly 80 percent", () => {
    assert(terrainApi.TERRAIN_OPACITY === 0.8, `expected 0.8 opacity, got ${terrainApi.TERRAIN_OPACITY}`);
  });

  test("REQ-LVL-08: separate image edges become aligned platforms at multiple heights", () => {
    const width = 120;
    const height = 100;
    const rgba = new Uint8ClampedArray(width * height * 4);
    const rectangles = [[5, 25, 35, 8], [45, 50, 30, 8], [85, 75, 30, 8]];
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const value = rectangles.some(([left, top, w, h]) => (
          x >= left && x < left + w && y >= top && y < top + h
        )) ? 220 : 30;
        rgba.set([value, value, value, 255], (y * width + x) * 4);
      }
    }
    const terrain = terrainApi.generateTerrain(rgba, width, height);
    for (const [left, top, w] of rectangles) {
      const x = Math.floor(left + w / 2);
      assert([-1, 0, 1, 2].some((offset) => terrain.solid[(top + offset) * width + x]),
        `missing image-aligned platform near (${x}, ${top})`);
    }
    assert(terrain.solid[80 * width + 20] === 0, "space below an upper platform was filled");
    assert(terrain.solid[50 * width + 42] === 0, "unrelated helper platform was added");
    assert(terrainApi.openSpaceRatio(terrain) >= 0.8, "less than 80% of the image is open");
  });

  test("REQ-LVL-08 / REQ-MOV-05: nearby object outlines do not trap a runner between duplicate platforms", () => {
    const width = 100;
    const height = 100;
    const rgba = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const value = y >= 50 && y < 68 ? 220 : 30;
        rgba.set([value, value, value, 255], (y * width + x) * 4);
      }
    }
    const terrain = terrainApi.generateTerrain(rgba, width, height);
    let transitions = 0;
    for (let y = 1; y < height; y += 1) {
      if (terrain.solid[y * width + 30] && !terrain.solid[(y - 1) * width + 30]) transitions += 1;
      assert(terrain.solid[y * width + 50] === 0, "duplicate outline refilled a required platform gap");
    }
    assert(transitions === 1, `near-duplicate object edges created ${transitions} stacked platforms`);
  });

  test("terrain follows a strong horizontal image edge", () => {
    const width = 40;
    const height = 40;
    const rgba = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const value = y < 28 ? 20 : 230;
        const offset = (y * width + x) * 4;
        rgba[offset] = value;
        rgba[offset + 1] = value;
        rgba[offset + 2] = value;
        rgba[offset + 3] = 255;
      }
    }
    const terrain = terrainApi.generateTerrain(rgba, width, height);
    const middle = terrain.surfaceY[Math.floor(width / 2)];
    assert(Math.abs(middle - 28) <= 3, `expected edge near row 28, got ${middle}`);
  });

  test("REQ-LVL-01/09: generated terrain leaves at least 80 percent of the map open", () => {
    const width = 40;
    const height = 40;
    const rgba = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const value = y < 28 ? 20 : 230;
        const offset = (y * width + x) * 4;
        rgba[offset] = value;
        rgba[offset + 1] = value;
        rgba[offset + 2] = value;
        rgba[offset + 3] = 255;
      }
    }
    const terrain = terrainApi.generateTerrain(rgba, width, height);
    assert(terrainApi.openSpaceRatio(terrain) >= 0.8, "open-space ratio was below 0.8");
  });

  test("REQ-LVL-09: long photo platforms have 48-cell sections and 12-cell gaps", () => {
    const width = 200;
    const height = 100;
    const rgba = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const value = y < 60 ? 20 : 230;
        rgba.set([value, value, value, 255], (y * width + x) * 4);
      }
    }
    const terrain = terrainApi.generateTerrain(rgba, width, height);
    const row = terrain.surfaceY[10];
    let run = 0;
    let gaps = 0;
    for (let x = 1; x < width - 1; x += 1) {
      if (terrain.solid[row * width + x]) {
        assert(run <= 0 || run < 48, "platform exceeded 48 cells");
        if (run < 0) {
          assert(run === -12, `gap was ${-run} cells, expected 12`);
          gaps += 1;
        }
        run = Math.max(0, run) + 1;
      } else {
        run = Math.min(0, run) - 1;
      }
    }
    assert(gaps >= 2, "long photo edge has no repeated jump gaps");
  });

  test("REQ-LVL-09: vertical photo edges form walls without unrelated terrain", () => {
    const width = 100;
    const height = 100;
    const rgba = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const value = x < 50 ? 20 : 230;
        rgba.set([value, value, value, 255], (y * width + x) * 4);
      }
    }
    const terrain = terrainApi.generateTerrain(rgba, width, height);
    for (const y of [20, 40, 60, 80]) {
      assert([48, 49, 50, 51].some((x) => terrain.solid[y * width + x]), `missing wall at y=${y}`);
    }
    assert(terrain.solid[40 * width + 20] === 0, "invented unrelated terrain");
    assert(terrainApi.openSpaceRatio(terrain) >= 0.8, "walls exceeded solid budget");
    const wallX = [48, 49, 50, 51].find((x) => terrain.solid[40 * width + x]);
    const player = physicsApi.createPlayer(wallX - 6 - 2, 30);
    physicsApi.stepPlayer(player, { jumpPressed: true, jumpHeld: true }, terrain, 0.05);
    assert(player.charging, "generated wall did not support charging");
    physicsApi.stepPlayer(player, { jumpReleased: true }, terrain, 0.05);
    assert(player.vy < 0 && player.vx === -80, "generated wall did not support an upward/away jump");
  });

  test("REQ-LVL-09: dense photo features respect the 20-percent solid budget", () => {
    const width = 160;
    const height = 160;
    const rgba = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const value = (Math.floor(x / 12) + Math.floor(y / 12)) % 2 ? 230 : 20;
        rgba.set([value, value, value, 255], (y * width + x) * 4);
      }
    }
    const terrain = terrainApi.generateTerrain(rgba, width, height);
    assert(terrain.solid.some((cell) => cell === 1), "all photo features discarded");
    assert(terrainApi.openSpaceRatio(terrain) >= 0.8, "dense features exceed budget");
  });

  test("contrast normalization detects a low-contrast visible edge", () => {
    const width = 40;
    const height = 40;
    const rgba = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const value = y < 24 ? 120 : 130;
        const offset = (y * width + x) * 4;
        rgba[offset] = value;
        rgba[offset + 1] = value;
        rgba[offset + 2] = value;
        rgba[offset + 3] = 255;
      }
    }
    const terrain = terrainApi.generateTerrain(rgba, width, height);
    const middle = terrain.surfaceY[Math.floor(width / 2)];
    assert(Math.abs(middle - 24) <= 3, `normalized edge should be near row 24, got ${middle}`);
  });

  test("uniform images without a usable edge are rejected with guidance", () => {
    const rgba = new Uint8ClampedArray(40 * 40 * 4);
    for (let i = 0; i < 40 * 40; i += 1) {
      rgba[i * 4] = 128;
      rgba[i * 4 + 1] = 128;
      rgba[i * 4 + 2] = 128;
      rgba[i * 4 + 3] = 255;
    }
    let error;
    try {
      terrainApi.generateTerrain(rgba, 40, 40);
    } catch (caught) {
      error = caught;
    }
    assert(error instanceof Error, "uniform image was not rejected");
    assert(error.message.includes("another"), "error did not ask for another image");
  });
}

if (physicsApi) {
  test("REQ-CHR-02: player collision footprint is 6 by 9 cells", () => {
    const player = physicsApi.createPlayer(4, 4);
    assert(player.width === 6 && player.height === 9, `footprint was ${player.width}x${player.height}`);
    assert(physicsApi.DRILL_RADIUS === 10, "bubble radius changed with player size");
  });

  test("spawn position clears the full width of an uneven starting surface", () => {
    const terrain = flatTerrain();
    for (let x = 8; x < 12; x += 1) {
      terrain.surfaceY[x] = 20;
      for (let y = 20; y < 24; y += 1) {
        terrain.solid[y * terrain.width + x] = 1;
      }
    }
    const spawnY = physicsApi.findSpawnY(terrain, 4, 8, 12);
    assert(spawnY === 8, `expected safe spawn y 8, got ${spawnY}`);
  });

  test("ground contact anywhere under the footprint counts as support", () => {
    const terrain = flatTerrain();
    for (let y = 20; y < 24; y += 1) {
      terrain.solid[y * terrain.width + 10] = 1;
    }
    const player = physicsApi.createPlayer(4.5, 11);
    physicsApi.stepPlayer(player, {}, terrain, 0);
    assert(player.grounded, "support at the footprint edge was missed");
  });

  test("REQ-MOV-03: bubble speed is one quarter of normal speed", () => {
    const regularTerrain = flatTerrain();
    const drillTerrain = flatTerrain();
    const regular = physicsApi.createPlayer(4, 10);
    const drilling = physicsApi.createPlayer(4, 10);
    physicsApi.stepPlayer(regular, { move: 1 }, regularTerrain, 0.05);
    physicsApi.stepPlayer(drilling, { move: 1, drill: true }, drillTerrain, 0.05);
    const regularDistance = regular.x - 4;
    const drillDistance = drilling.x - 4;
    assert(Math.abs(regularDistance - 4) < 0.1, `normal distance was ${regularDistance}`);
    assert(Math.abs(drillDistance - regularDistance / 4) < 0.001, `drill distance was ${drillDistance}`);
  });

  test("REQ-MOV-03: bubble hovers and moves in all directions at a normalized speed", () => {
    const terrain = flatTerrain(100, 100, 90);
    const cases = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]];
    for (const [move, moveY] of cases) {
      const player = physicsApi.createPlayer(40, 40);
      player.vy = 100;
      physicsApi.stepPlayer(player, { drill: true, move, moveY }, terrain, 0.05);
      const distance = Math.hypot(player.x - 40, player.y - 40);
      assert(Math.abs(distance - 80 / 4 * 0.05) < 0.001, `wrong speed for ${move},${moveY}: ${distance}`);
      assert(Math.sign(player.x - 40) === Math.sign(move), "wrong horizontal direction");
      assert(Math.sign(player.y - 40) === Math.sign(moveY), "wrong vertical direction");
    }
    const player = physicsApi.createPlayer(40, 40);
    player.vy = -100;
    physicsApi.stepPlayer(player, { drill: true }, terrain, 0.05);
    assert(player.x === 40 && player.y === 40, "idle bubble did not hover");
  });

  test("REQ-MOV-03: bubble cuts above, below, left and right even while idle", () => {
    const terrain = flatTerrain(60, 60, 10);
    const player = physicsApi.createPlayer(20, 20);
    physicsApi.stepPlayer(player, { drill: true }, terrain, 0.05);
    for (const [x, y] of [[14, 24], [31, 24], [23, 16], [23, 33]]) {
      assert(terrain.solid[y * 60 + x] === 0, `bubble left terrain at ${x},${y}`);
    }
    assert(terrain.solid[10 * 60 + 2] === 1, "bubble removed distant terrain");
    const drilled = terrain.solid.slice();
    physicsApi.stepPlayer(player, {}, terrain, 0);
    assert(drilled.every((cell, index) => cell === terrain.solid[index]), "excavation did not persist");
  });

  test("REQ-MOV-03/05: bubble cancels charge and restores gravity without queued jumps", () => {
    const terrain = flatTerrain(60, 60, 40);
    const player = physicsApi.createPlayer(4, 31);
    player.charging = true;
    player.chargeSeconds = 2;
    physicsApi.stepPlayer(player, { drill: true, jumpHeld: true, moveY: -1 }, terrain, 0.05);
    assert(!player.charging && player.chargeSeconds === 0, "bubble retained jump charge");
    const y = player.y;
    physicsApi.stepPlayer(player, { jumpReleased: true }, terrain, 0.05);
    assert(player.y > y && player.vy > 0, "leaving bubble did not restore gravity, or launched a jump");
  });

  test("REQ-MOV-02/05: jump launches on release on a surface but not in air", () => {
    const terrain = flatTerrain();
    const player = physicsApi.createPlayer(10, 15);
    physicsApi.stepPlayer(player, {}, terrain, 0.016);
    assert(player.grounded, "player should be grounded on the floor");
    physicsApi.stepPlayer(player, { jumpPressed: true, jumpHeld: true }, terrain, 0.016);
    assert(player.vy === 0, "holding jump must not launch");
    physicsApi.stepPlayer(player, { jumpReleased: true }, terrain, 0.016);
    assert(player.vy < 0, "grounded jump should move upward");
    const jumpVelocity = player.vy;
    physicsApi.stepPlayer(player, { jumpPressed: true, jumpReleased: true }, terrain, 0.016);
    assert(player.vy > jumpVelocity, "airborne jump request should not reset jump velocity");
    assert(player.vy < 0, "player should still be rising after the ignored request");
  });

  test("REQ-MOV-05: charge caps at three seconds without automatically launching", () => {
    const terrain = flatTerrain();
    const player = physicsApi.createPlayer(4, 15);
    for (let frame = 0; frame < 100; frame += 1) {
      physicsApi.stepPlayer(player, { jumpPressed: frame === 0, jumpHeld: true }, terrain, 0.05);
    }
    assert(player.chargeSeconds === 3, `charge was ${player.chargeSeconds}`);
    assert(player.y === 15 && player.vy === 0, "maximum charge launched automatically");
  });

  test("REQ-MOV-05: maximum charge rises one full world height in unobstructed space", () => {
    const expectedHeight = 180;
    const speed = physicsApi.jumpSpeedForCharge(3, expectedHeight, 1 / 240);
    let y = 0;
    let vy = -speed;
    let apex = 0;
    for (let frame = 0; frame < 1000 && vy < 0; frame += 1) {
      vy += physicsApi.GRAVITY / 240;
      y += vy / 240;
      apex = Math.min(apex, y);
    }
    assert(Math.abs(-apex - expectedHeight) < 0.1, `rise was ${-apex}, expected ${expectedHeight}`);
    assert(physicsApi.jumpSpeedForCharge(0, 180, 1 / 60) < physicsApi.jumpSpeedForCharge(1.5, 180, 1 / 60),
      "partial charge did not increase jump strength");
  });

  test("REQ-MOV-05: leaving support cancels charge and prevents an air launch", () => {
    const terrain = flatTerrain(60, 60, 40);
    terrain.solid.fill(0);
    for (let x = 0; x < 12; x += 1) terrain.solid[40 * 60 + x] = 1;
    const player = physicsApi.createPlayer(4, 31);
    physicsApi.stepPlayer(player, { jumpPressed: true, jumpHeld: true }, terrain, 0.05);
    for (let frame = 0; frame < 10; frame += 1) {
      physicsApi.stepPlayer(player, { move: 1, jumpHeld: true }, terrain, 0.05);
    }
    assert(!player.charging && player.chargeSeconds === 0, "charge survived leaving support");
    const vy = player.vy;
    physicsApi.stepPlayer(player, { jumpReleased: true }, terrain, 0.01);
    assert(player.vy >= vy, "release in air launched a jump");
  });

  test("REQ-MOV-05: a player landed at a fractional coordinate can charge", () => {
    const terrain = flatTerrain(60, 60, 40);
    const player = physicsApi.createPlayer(4, 20.37);
    for (let frame = 0; frame < 60; frame += 1) {
      physicsApi.stepPlayer(player, {}, terrain, 1 / 60);
    }
    player.y = 30.7;
    player.grounded = true;
    physicsApi.stepPlayer(player, { jumpPressed: true, jumpHeld: true }, terrain, 1 / 60);
    assert(player.charging, `landed player could not charge at y=${player.y}`);
  });

  test("REQ-MOV-06: ceiling blocks upward motion and player falls back down", () => {
    const terrain = flatTerrain(40, 60, 60);
    const player = physicsApi.createPlayer(4, 1);
    player.vy = -100;
    physicsApi.stepPlayer(player, {}, terrain, 0.05);
    assert(player.y >= 0 && player.vy === 0, `ceiling failed: y=${player.y}, vy=${player.vy}`);
    physicsApi.stepPlayer(player, {}, terrain, 0.05);
    assert(player.y > 0 && player.vy > 0, "player did not fall after hitting ceiling");
  });

  test("REQ-MOV-05/06: actual fully charged launch reaches the image ceiling", () => {
    const terrain = flatTerrain(60, 180, 179);
    const player = physicsApi.createPlayer(4, 170);
    physicsApi.stepPlayer(player, { jumpPressed: true, jumpHeld: true }, terrain, 1 / 60);
    for (let frame = 0; frame < 180; frame += 1) {
      physicsApi.stepPlayer(player, { jumpHeld: true }, terrain, 1 / 60);
    }
    physicsApi.stepPlayer(player, { jumpReleased: true }, terrain, 1 / 60);
    let highest = player.y;
    for (let frame = 0; frame < 120; frame += 1) {
      physicsApi.stepPlayer(player, {}, terrain, 1 / 60);
      highest = Math.min(highest, player.y);
    }
    assert(highest === 0, `maximum jump did not reach ceiling: y=${highest}`);
  });

  test("air movement uses normal horizontal speed", () => {
    const terrain = flatTerrain();
    const player = physicsApi.createPlayer(4, 1);
    physicsApi.stepPlayer(player, { move: 1 }, terrain, 0.05);
    assert(Math.abs(player.x - 8) < 0.1, `air movement distance was ${player.x - 4}`);
  });

  test("ground movement can climb small terrain steps", () => {
    const terrain = flatTerrain();
    for (let x = 14; x < terrain.width; x += 1) {
      terrain.surfaceY[x] = 22;
      for (let y = 22; y < 24; y += 1) {
        terrain.solid[y * terrain.width + x] = 1;
      }
    }
    const player = physicsApi.createPlayer(4, 15);
    for (let frame = 0; frame < 5; frame += 1) {
      physicsApi.stepPlayer(player, { move: 1 }, terrain, 0.05);
    }
    assert(player.x > 14, `player was blocked at x=${player.x}`);
    assert(player.y < 15, "player did not rise onto the higher surface");
  });

  test("ground movement follows a gradually rising terrain profile", () => {
    const terrain = flatTerrain(64, 32, 24);
    for (let x = 20; x < terrain.width; x += 1) {
      const surface = 24 - Math.min(x - 20, 10);
      terrain.surfaceY[x] = surface;
      for (let y = surface; y < 24; y += 1) {
        terrain.solid[y * terrain.width + x] = 1;
      }
    }
    const player = physicsApi.createPlayer(4, 15);
    for (let frame = 0; frame < 30; frame += 1) {
      physicsApi.stepPlayer(player, { move: 1 }, terrain, 0.05);
    }
    assert(player.x > 30, `player was blocked at x=${player.x}`);
  });

  test("REQ-MOV-03: bubble carves a character-height tunnel and enables penetration", () => {
    const terrain = flatTerrain();
    for (let y = 0; y < terrain.height; y += 1) {
      for (let x = 12; x < terrain.width; x += 1) {
        terrain.solid[y * terrain.width + x] = 1;
      }
    }
    const player = physicsApi.createPlayer(4, 8);
    physicsApi.stepPlayer(player, { move: 1, drill: true }, terrain, 0.1);
    const tunnelIndex = 12 * terrain.width + 12;
    assert(terrain.solid[tunnelIndex] === 0, "drill did not clear its tunnel");
    assert(terrain.solid[8 * terrain.width + 12] === 0, "tunnel did not clear the player's headroom");
    assert(terrain.solid[19 * terrain.width + 12] === 0, "tunnel did not clear the player's foot space");
    assert(player.x > 4, "player did not penetrate the drilled wall");
    physicsApi.stepPlayer(player, {}, terrain, 0.1);
    assert(terrain.solid[tunnelIndex] === 0, "tunnel did not persist");
  });

  test("REQ-MOV-07: charges work exactly three cells above floor but not beyond", () => {
    const terrain = flatTerrain(80, 80, 60);
    for (const [gap, allowed] of [[0, true], [2.9, true], [3, true], [3.1, false]]) {
      const player = physicsApi.createPlayer(10, 60 - 9 - gap);
      physicsApi.stepPlayer(player, { jumpPressed: true, jumpHeld: true }, terrain, 0);
      assert(player.charging === allowed, `incorrect floor tolerance at gap ${gap}`);
    }
  });

  test("REQ-MOV-07: moving up and down slopes preserves support and charge", () => {
    for (const descending of [false, true]) {
      const terrain = flatTerrain(160, 140, 140);
      for (let x = 0; x < terrain.width; x += 1) {
        const top = descending ? 40 + Math.floor(x / 2) : 120 - Math.floor(x / 2);
        terrain.surfaceY[x] = top;
        for (let y = top; y < terrain.height; y += 1) terrain.solid[y * terrain.width + x] = 1;
      }
      const player = physicsApi.createPlayer(10, physicsApi.findSpawnY(terrain, 10));
      physicsApi.stepPlayer(player, { jumpPressed: true, jumpHeld: true }, terrain, 1 / 60);
      for (let frame = 0; frame < 50; frame += 1) {
        physicsApi.stepPlayer(player, { move: 1, jumpHeld: true }, terrain, 1 / 60);
        assert(player.grounded && player.charging, `${descending ? "descending" : "rising"} lost support at frame ${frame}`);
      }
      assert(player.x > 70, "slope blocked walking");
      physicsApi.stepPlayer(player, { jumpReleased: true }, terrain, 1 / 60);
      assert(player.vy < 0, "slope release did not launch");
    }
  });

  test("REQ-MOV-02/07: both walls support charged jumps away while gravity continues", () => {
    for (const side of [-1, 1]) {
      const terrain = flatTerrain(100, 200, 200);
      const wallX = side < 0 ? 30 : 50;
      for (let y = 1; y < 190; y += 1) terrain.solid[y * 100 + wallX] = 1;
      for (const gap of [0, 2.9, 3, 3.1]) {
        const nearX = side < 0 ? wallX + 1 + gap : wallX - 6 - gap;
        const nearby = physicsApi.createPlayer(nearX, 40);
        physicsApi.stepPlayer(nearby, { jumpPressed: true, jumpHeld: true }, terrain, 0);
        assert(nearby.charging === (gap <= 3), `incorrect wall tolerance on side ${side}, gap ${gap}`);
      }
      const x = side < 0 ? wallX + 1 + 3 : wallX - 6 - 3;
      const player = physicsApi.createPlayer(x, 40);
      physicsApi.stepPlayer(player, { jumpPressed: true, jumpHeld: true }, terrain, 0.05);
      assert(player.charging, `no wall charge on side ${side}`);
      assert(player.y > 40 && player.vy > 0, "wall charging suspended gravity");
      for (let i = 0; i < 5; i += 1) physicsApi.stepPlayer(player, { jumpHeld: true }, terrain, 0.05);
      assert(player.chargeSeconds >= 0.25 - 1e-9, "wall charge did not accumulate");
      physicsApi.stepPlayer(player, { move: side, jumpReleased: true }, terrain, 0.05);
      assert(player.vy < 0 && player.vx === -side * 80, "wall release did not launch upward and away");
      const expectedVy = -physicsApi.jumpSpeedForCharge(0.25, terrain.height, 0.05) + physicsApi.GRAVITY * 0.05;
      assert(Math.abs(player.vy - expectedVy) < 1e-9, "wall jump did not use ground charge strength");
      assert(Math.abs(player.x - x + side * 4) < 0.001, "away launch was overridden by input");
    }
  });

  test("REQ-MOV-07: charge survives 150 ms lost contact but distant release never launches", () => {
    const terrain = flatTerrain(100, 100, 70);
    const player = physicsApi.createPlayer(10, 61);
    physicsApi.stepPlayer(player, { jumpPressed: true, jumpHeld: true }, terrain, 0);
    terrain.solid.fill(0);
    physicsApi.stepPlayer(player, { jumpHeld: true }, terrain, 0.05);
    physicsApi.stepPlayer(player, { jumpHeld: true }, terrain, 0.05);
    assert(player.charging, "charge cancelled before grace elapsed");
    physicsApi.stepPlayer(player, { jumpHeld: true }, terrain, 0.05);
    assert(player.charging, "charge did not survive exactly 150 ms");
    physicsApi.stepPlayer(player, { jumpHeld: true }, terrain, 0.001);
    assert(!player.charging && player.chargeSeconds === 0, "charge survived beyond 150 ms");
    const other = physicsApi.createPlayer(10, 61);
    terrain.solid.fill(1, 70 * 100);
    physicsApi.stepPlayer(other, { jumpPressed: true, jumpHeld: true }, terrain, 0);
    terrain.solid.fill(0);
    physicsApi.stepPlayer(other, { jumpReleased: true }, terrain, 0.01);
    assert(other.vy >= 0 && !other.charging, "distant grace-period release launched");
    terrain.solid.fill(1, 70 * 100);
    physicsApi.stepPlayer(other, {}, terrain, 0.01);
    assert(other.vy >= 0 && !other.charging, "invalid release queued a launch");
  });

  test("REQ-MOV-07: a held press buffers contact for 150 ms, not longer", () => {
    const terrain = flatTerrain(100, 100, 70);
    for (const [wait, expected] of [[0.1, true], [0.15, true], [0.151, false], [0.16, false]]) {
      for (const frameDuration of [0.02, 0.05]) {
        const player = physicsApi.createPlayer(10, 10);
        physicsApi.stepPlayer(player, { jumpPressed: true, jumpHeld: true }, terrain, 0);
        let elapsed = 0;
        while (elapsed < wait - 1e-9) {
          const dt = Math.min(frameDuration, wait - elapsed);
          physicsApi.stepPlayer(player, { jumpHeld: true }, terrain, dt);
          elapsed += dt;
        }
        player.y = 61;
        physicsApi.stepPlayer(player, { jumpHeld: true }, terrain, 0);
        assert(player.charging === expected, `incorrect buffer behavior after ${wait}s`);
      }
    }
  });

  test("REQ-MOV-02/07: rising jumps are not snapped or recharged; boundaries are not walls", () => {
    const terrain = flatTerrain(100, 100, 70);
    const player = physicsApi.createPlayer(10, 61);
    physicsApi.stepPlayer(player, { jumpPressed: true, jumpReleased: true }, terrain, 0.01);
    const y = player.y;
    const vy = player.vy;
    physicsApi.stepPlayer(player, { jumpPressed: true, jumpReleased: true }, terrain, 0.01);
    assert(player.y < y && player.vy > vy && !player.charging, "rising jump snapped or double-jumped");
    for (const x of [0, 94]) {
      const edge = physicsApi.createPlayer(x, 10);
      physicsApi.stepPlayer(edge, { jumpPressed: true, jumpReleased: true }, terrain, 0.01);
      assert(edge.vy >= 0 && !edge.charging, "world boundary granted a wall jump");
    }
  });
}

if (runApi) {
  test("REQ-LVL-07: flag initially touches a sloping image platform", () => {
    const terrain = flatTerrain(60, 100, 90);
    terrain.solid.fill(0);
    for (let x = 0; x < 60; x += 1) {
      terrain.surfaceY[x] = x + 20;
      terrain.solid[(x + 20) * 60 + x] = 1;
    }
    const run = runApi.createRun(terrain);
    const anchor = run.flag.x + 1;
    assert(run.terrain.solid[run.flag.y * 60 + anchor] === 1, "flag initially floated over a slope");
  });

  test("REQ-LVL-07: flag stays fixed after all supporting terrain is drilled", () => {
    const run = runApi.createRun(flatTerrain(60, 60, 30));
    const originalFlag = { ...run.flag };
    const player = physicsApi.createPlayer(run.flag.x - 2, run.flag.y - 6);
    for (let frame = 0; frame < 60; frame += 1) {
      physicsApi.stepPlayer(player, { drill: true, moveY: 1 }, run.terrain, 0.05);
    }
    for (let y = originalFlag.y; y < 60; y += 1) {
      for (let x = originalFlag.x; x < originalFlag.x + originalFlag.width; x += 1) {
        assert(run.terrain.solid[y * 60 + x] === 0, "undrillable support remained");
      }
    }
    assert(JSON.stringify(run.flag) === JSON.stringify(originalFlag), "drilling moved the flag");
  });
  test("REQ-SYS-08/09: fresh runs restore terrain; respawn preserves tunnels and timer", () => {
    const original = flatTerrain(60, 60, 30);
    const run = runApi.createRun(original);
    run.terrain.solid[35 * 60 + 10] = 0;
    run.startedAt = 123;
    run.elapsedMs = 500;
    run.player.x = 40;
    run.player.chargeSeconds = 2;
    runApi.respawnPlayer(run);
    assert(run.player.x === run.spawn.x && run.player.chargeSeconds === 0, "respawn did not restore player");
    assert(run.startedAt === 123 && run.elapsedMs === 500, "respawn reset timer");
    assert(run.terrain.solid[35 * 60 + 10] === 0, "respawn restored drilled terrain");
    const fresh = runApi.createRun(original);
    assert(original.solid[35 * 60 + 10] === 1 && fresh.terrain.solid[35 * 60 + 10] === 1, "reset failed to restore terrain");
    assert(fresh.startedAt === null && fresh.elapsedMs === 0, "fresh run timer was not reset");
  });
  test("REQ-SYS-04: passing over the flag at another height does not complete", () => {
    const run = runApi.createRun(flatTerrain(60, 60, 40));
    run.player.x = run.flag.x;
    run.player.y = 0;
    assert(!runApi.reachedFlag(run), "horizontal crossing completed without touching flag");
    run.player.y = run.flag.y - run.player.height;
    assert(runApi.reachedFlag(run), "touching flag did not complete");
  });
  test("REQ-MOV-03 / REQ-SYS-04: bubble can traverse solid terrain to the fixed flag", () => {
    const run = runApi.createRun(flatTerrain(100, 80, 30));
    let frames = 0;
    while (!runApi.reachedFlag(run) && frames < 1000) {
      physicsApi.stepPlayer(run.player, { drill: true, move: 1 }, run.terrain, 1 / 60);
      frames += 1;
    }
    assert(runApi.reachedFlag(run), "hovering runner never reached the flag");
    const distance = run.flag.x - run.spawn.x - run.player.width;
    assert(frames / 60 >= distance / 20, "bubble reached flag faster than quarter speed permits");
  });
}

if (leaderboardApi) {
  test("player names allow letters and spaces up to 32 characters only", () => {
    assert(leaderboardApi.isValidPlayerName("Ada Lovelace"), "valid name was rejected");
    assert(leaderboardApi.isValidPlayerName("Élodie"), "Unicode letters were rejected");
    assert(!leaderboardApi.isValidPlayerName("Ada 2"), "digits should be rejected");
    assert(!leaderboardApi.isValidPlayerName("Ada!"), "punctuation should be rejected");
    assert(!leaderboardApi.isValidPlayerName("A".repeat(33)), "33-character name should be rejected");
  });

  test("leaderboard stores only the ten fastest scores per level", () => {
    const values = new Map();
    const storage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    };
    for (let timeMs = 11000; timeMs >= 1000; timeMs -= 1000) {
      leaderboardApi.submitScore("level-a", { name: "Player", timeMs }, storage);
    }
    const scores = leaderboardApi.getLeaderboard("level-a", storage);
    assert(scores.length === 10, `expected 10 entries, got ${scores.length}`);
    assert(scores[0].timeMs === 1000, "fastest time was not first");
    assert(scores[9].timeMs === 10000, "slowest retained time was incorrect");
    assert(leaderboardApi.getLeaderboard("level-b", storage).length === 0, "scores leaked across levels");
  });
}

let passed = 0;
for (const check of checks) {
  const item = document.createElement("li");
  try {
    check.run();
    item.className = "pass";
    item.textContent = `PASS: ${check.name}`;
    passed += 1;
  } catch (error) {
    item.className = "fail";
    item.textContent = `FAIL: ${check.name} — ${error.message}`;
  }
  results.append(item);
}
summary.textContent = `${passed}/${checks.length} tests passed`;
summary.className = passed === checks.length ? "pass" : "fail";
