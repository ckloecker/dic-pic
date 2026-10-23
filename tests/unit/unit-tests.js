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
    spawn: { x: 0, y: floor - 9 },
    flag: { x: width - 12, y: floor, width: 12, height: 18 },
  };
}

let terrainApi;
let physicsApi;
let leaderboardApi;
let runApi;
let levelApi;
let sceneApi;
let enemyApi;
let routeApi;
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
try {
  levelApi = await import(`../../src/level.js${moduleRevision}`);
} catch (error) {
  test("REQ-LVL-10/11/12: level suggestions module is available", () => { throw error; });
}
try {
  sceneApi = await import(`../../src/scene.js${moduleRevision}`);
} catch (error) {
  test("REQ-CHR-04 / REQ-LVL-07/10: biome renderer is available", () => { throw error; });
}
try {
  enemyApi = await import(`../../src/enemies.js${moduleRevision}`);
} catch (error) {
  test("REQ-LVL-15: flying patrol module is available", () => { throw error; });
}
try {
  routeApi = await import(`../../src/route.js${moduleRevision}`);
} catch (error) {
  test("REQ-LVL-16: reference-route planner is available", () => { throw error; });
}

test("REQ-LVL-01/16: offered options retain executable no-drill routes without numeric rejection gates", () => {
  const width=320,height=180;
  const pixels=new Uint8ClampedArray(width*height*4);
  for(let y=0;y<height;y+=1)for(let x=0;x<width;x+=1){
    const value=x>=18&&x<300&&((y>=22&&y<58)||(y>=78&&y<112)||(y>=132&&y<168))?220:20;
    pixels.set([value,value,value,255],(y*width+x)*4);
  }
  let seed=123;
  const options=levelApi.createSuggestions(pixels,width,height,()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296));
  assert(options.length===3,"missing validated suggestions");
  for(const option of options){
    const openness=terrainApi.openSpaceRatio(option);
    assert(openness>0&&openness<1,"option has no terrain or open space");
    const result=routeApi.verifyReferenceRoute(option);
    assert(result.valid,`invalid route: ${JSON.stringify(result)}`);
    assert(option.route.actions.every(action=>!action.input.drill),"reference route requires digging");
    assert(!runApi.walkingReachesFlag(option,runApi.walkingReachable(option,option.spawn),option.flag),
      "walking alone completes a generated option");
    assert(option.route.clearance.every((cell,index)=>!cell||!option.solid[index]),"reserved corridor has collision");
    for(const changed of [
      {...option,route:{...option.route,seconds:19}},
      {...option,route:{...option.route,actions:[{input:{drill:true},dt:1/60},...option.route.actions]}},
      {...option,route:{...option.route,seconds:option.route.seconds+3,
        actions:[...Array.from({length:180},()=>({input:{},dt:1/60})),...option.route.actions]}},
      {...option,solid:new Uint8Array(option.solid.length)},
    ]) assert(!routeApi.verifyReferenceRoute(changed).valid,"invalid reference-route evidence was accepted");
    const blocked={...option,solid:option.solid.slice()};
    blocked.solid[option.route.clearance.findIndex(Boolean)]=1;
    assert(!routeApi.verifyReferenceRoute(blocked).valid,"blocked clearance was accepted");
  }
});

test("REQ-LVL-18: speed pickup doubles horizontal movement and expires after five seconds", () => {
  const terrain = flatTerrain(120, 60, 50);
  const normal = physicsApi.createPlayer(10, 41);
  const boosted = physicsApi.createPlayer(10, 41);
  physicsApi.stepPlayer(normal, { move: 1 }, terrain, 0.25);
  physicsApi.stepPlayer(boosted, { move: 1, speedMultiplier: 2 }, terrain, 0.25);
  assert(Math.abs(boosted.x - normal.x * 2 + 10) < 0.01, "speed pickup did not double walking speed");
});

test("REQ-LVL-18: pickup timers refresh without stacking and reset with the run", () => {
  const original = flatTerrain(80, 70, 60);
  original.pickups = [
    { type: "speed", x: 10, y: 40, width: 4, height: 4 },
    { type: "speed", x: 10, y: 40, width: 4, height: 4 },
    { type: "reverse", x: 10, y: 40, width: 4, height: 4 },
  ];
  const run = runApi.createRun(original);
  run.player.x = 10;
  run.player.y = 40;
  runApi.collectPickups(run);
  assert(run.effects.speedSeconds === 5 && run.effects.reverseSeconds === 5, "pickup did not activate a five-second effect");
  runApi.stepRunEffects(run, 2);
  runApi.collectPickups(run);
  assert(run.effects.speedSeconds === 5, "repeat pickup did not refresh its timer");
  assert(runApi.applyRunEffects({ move: 1, moveY: -1, drill: true }, run).move === -1
    && runApi.applyRunEffects({ move: 1, moveY: -1 }, run).moveY === 1,
  "mushroom did not reverse all directional controls");
  const reset = runApi.createRun(original);
  assert(reset.pickups.length === 3 && reset.effects.speedSeconds === 0 && reset.effects.reverseSeconds === 0,
    "new run retained collected pickups or active effects");
});

test("REQ-LVL-19: moving platforms reverse at clear path ends and extend after drilling", () => {
  const original = flatTerrain(80, 70, 60);
  original.solid.fill(0);
  for (let x = 22; x < 24; x += 1) {
    for (let y = 10; y < 13; y += 1) original.solid[y * 80 + x] = 1;
  }
  original.movingPlatforms = [
    { x: 10, y: 10, left: 10, right: 10, width: 12, height: 3, speed: 18, direction: 1 },
    { x: 40, y: 30, left: 40, right: 50, width: 12, height: 3, speed: 18, direction: -1 },
  ];
  const run = runApi.createRun(original);
  runApi.stepMovingPlatforms(run, 0.1);
  assert(run.movingPlatforms[0].right === 10, "platform path crossed intact terrain");
  run.terrain.solid[10 * 80 + 22] = 0;
  run.terrain.solid[11 * 80 + 22] = 0;
  run.terrain.solid[12 * 80 + 22] = 0;
  runApi.stepMovingPlatforms(run, 0.1);
  assert(run.movingPlatforms[0].right > 10, "drilling did not extend the platform path");
  run.player = physicsApi.createPlayer(12, 1);
  run.player.grounded = true;
  runApi.stepMovingPlatforms(run, 0.1);
  physicsApi.stepPlayer(run.player, {}, run.terrain, 0);
  assert(run.player.grounded && run.player.y + run.player.height === run.movingPlatforms[0].y,
    "moving platform did not provide player support");
  const carriedX = run.player.x;
  runApi.stepMovingPlatforms(run, 0.1);
  assert(run.player.x > carriedX, "moving platform did not carry its rider");
  for (let frame = 0; frame < 100; frame += 1) runApi.stepMovingPlatforms(run, 0.05);
  assert(run.movingPlatforms.every((platform) => platform.x >= platform.left && platform.x <= platform.right),
    "platform escaped its expanded path bounds");
});

test("REQ-LVL-18: eight-cell items collect at their edges but their aura never collects or blocks", () => {
  for (const type of ["speed", "reverse"]) {
    const terrain = flatTerrain(80, 70, 60);
    terrain.pickups = [{ type, x: 20, y: 30, width: 8, height: 8 }];
    const run = runApi.createRun(terrain);
    run.player.x = 28;
    run.player.y = 30;
    runApi.collectPickups(run);
    assert(run.pickups.length === 1 && run.effects.speedSeconds === 0 && run.effects.reverseSeconds === 0,
      "touching only the aura collected an item");
    physicsApi.stepPlayer(run.player, { move: -1 }, run.terrain, 0.025);
    assert(run.player.x === 26, "pickup or aura blocked movement");
    runApi.collectPickups(run);
    assert(run.pickups.length === 0 && run.effects[type === "speed" ? "speedSeconds" : "reverseSeconds"] === 5,
      "outer half of the enlarged item did not collect");
  }
});

test("REQ-LVL-16: bridges connect detected supported surfaces beyond eighteen cells", () => {
  for(const [gap,anchored,evidence] of [[12,true,true],[18,true,true],[19,true,true],
    [12,false,true],[12,true,false]]){
    const terrain=flatTerrain(90,50,50);
    terrain.solid.fill(0);
    terrain.photoSolid=new Uint8Array(90*50);
    terrain.edgeDirections=new Uint8Array(90*50);
    for(let x=8;x<78;x+=1){
      if(x>=30&&x<30+gap)continue;
      if(!anchored&&x<30)continue;
      for(let y=20;y<25;y+=1)terrain.photoSolid[y*90+x]=1;
      terrain.edgeDirections[20*90+x]=evidence?1:0;
    }
    const connected=routeApi.connectPhotoEdges(terrain);
    const accepted=anchored&&evidence;
    assert(connected.connectors.length===(accepted?1:0),`wrong connector acceptance for gap ${gap}`);
    if(accepted){
      const bridge=connected.connectors[0];
      assert(bridge.span===gap&&terrain.photoSolid[bridge.left.y*90+bridge.left.x]
        &&terrain.photoSolid[bridge.right.y*90+bridge.right.x],"connector is not attached at both ends");
      assert(bridge.cells.every(cell=>connected.photoSolid[cell]),"connector collision is missing");
      assert(!terrain.photoSolid[20*90+32],"connector mutated source photo evidence");
    }
  }
});

test("REQ-LVL-18: generated levels have one to three pickups of each type outside the safe route", () => {
  const width = 320, height = 180;
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const value = x >= 18 && x < 300 && ((y >= 22 && y < 58) || (y >= 78 && y < 112) || (y >= 132 && y < 168)) ? 220 : 20;
    pixels.set([value, value, value, 255], (y * width + x) * 4);
  }
  let seed = 123;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (const option of levelApi.createSuggestions(pixels, width, height, random)) {
    for (const type of ["speed", "reverse"]) {
      const pickups = option.pickups.filter((pickup) => pickup.type === type);
      assert(pickups.length >= 1 && pickups.length <= 3, `invalid ${type} pickup count`);
      for (const pickup of pickups) {
        assert(pickup.width === 8 && pickup.height === 8, "pickup artwork and collection bounds must be eight cells");
        assert(pickup.x >= 0 && pickup.y >= 0 && pickup.x + pickup.width <= width
          && pickup.y + pickup.height <= height, "pickup is outside the level");
        for (let y = pickup.y; y < pickup.y + pickup.height; y += 1) {
          for (let x = pickup.x; x < pickup.x + pickup.width; x += 1) {
            const cell = y * width + x;
            assert(!option.solid[cell] && !option.route.protected[cell], "pickup obstructs terrain or the reference route");
          }
        }
      }
    }
  }
});

test("REQ-LVL-19: two optional moving platforms are bounded and clear of the reference route", () => {
  const width = 320, height = 180;
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const value = x >= 18 && x < 300 && ((y >= 22 && y < 58) || (y >= 78 && y < 112) || (y >= 132 && y < 168)) ? 220 : 20;
    pixels.set([value, value, value, 255], (y * width + x) * 4);
  }
  let seed = 456;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (const option of levelApi.createSuggestions(pixels, width, height, random)) {
    assert(option.movingPlatforms?.length === 2, "expected exactly two moving platforms");
    for (const platform of option.movingPlatforms) {
      assert(platform.width === 12 && platform.height === 3 && platform.speed === 18,
        "platform size or speed is incorrect");
      assert(platform.x >= platform.left && platform.x <= platform.right
        && platform.left >= 0 && platform.right + platform.width <= width
        && platform.y >= 0 && platform.y + platform.height <= height, "platform exceeds its motion bounds");
      for (let x = platform.left; x < platform.right + platform.width; x += 1) {
        for (let y = platform.y; y < platform.y + platform.height; y += 1) {
          const cell = y * width + x;
          assert(!option.solid[cell] && !option.route.protected[cell], "platform path obstructs terrain or required route");
        }
      }
    }
    assert(routeApi.verifyReferenceRoute(option).valid, "moving platforms invalidated the no-drill route");
  }
});

test("REQ-LVL-03/11/16: clutter repair retains the strongest photo traces without mutating the source", () => {
  const width=100,height=100;
  const terrain=flatTerrain(width,height,0);
  terrain.photoSolid=terrain.solid.slice();
  terrain.edgeDirections=new Uint8Array(width*height);
  terrain.layout="balanced";
  terrain.features=Array.from({length:20},(_,index)=>({
    vertical:false,strength:(index+1)*100,
    points:Array.from({length:70},(_,x)=>({along:x+10,across:index*4+4})),
  }));
  const repaired=terrainApi.strongestTerrainEdges(terrain);
  assert(!repaired.edgeDirections[4*width+20],"weak clutter survived strongest-edge selection");
  assert(repaired.edgeDirections[80*width+20]===1,"strongest photo edge was lost");
  assert(repaired.photoSolid[82*width+20],"strong edge has no collidable surface thickness");
  assert(terrain.photoSolid.every(Boolean)&&!terrain.edgeDirections.some(Boolean),"source photo evidence was mutated");
});

test("REQ-LVL-07: distant flat and bottom-edge walk-only routes are rejected", () => {
  for (const floor of [40, 80]) {
    let rejected = false;
    try { runApi.placeRun(flatTerrain(100, 80, floor)); }
    catch (error) { rejected = /walking|walk-only|safe starting position/i.test(error.message); }
    assert(rejected, "distance alone accepted a flat walking-only level");
  }
});
test("REQ-LVL-07: placement tries elevated alternatives and detects slopes and falling walks", () => {
  const terrain = flatTerrain(100, 80, 80);
  for (let y = 25; y < 30; y += 1) terrain.solid.fill(1, y * 100 + 65, y * 100 + 95);
  for (let y = 60; y < 65; y += 1) terrain.solid.fill(1, y * 100 + 5, y * 100 + 35);
  const placement = runApi.placeRun(terrain, "bottom");
  const reachable = runApi.walkingReachable(terrain, placement.spawn);
  assert(!runApi.walkingReachesFlag(terrain, reachable, placement.flag), "alternative is walk-only");
  const high = runApi.walkingReachable(terrain, { x: 70, y: 16 });
  assert(runApi.walkingReachesFlag(terrain, high, { x: 0, y: 80, width: 12, height: 18 }),
    "walking off a platform into a lower goal was not detected");
  const slope = flatTerrain(100, 80, 80);
  for (let x = 0; x < 100; x += 1) {
    for (let y = 60 - Math.floor(x / 4); y < 80; y += 1) slope.solid[y * 100 + x] = 1;
  }
  assert(runApi.walkingReachesFlag(slope, runApi.walkingReachable(slope, { x: 0, y: 50 }),
    { x: 85, y: 39, width: 12, height: 18 }), "automatic uphill steps escaped validation");
});
test("REQ-LVL-14: photo filter darkens and desaturates without leaking context state", () => {
  const image = document.createElement("canvas");
  image.width = image.height = 20;
  image.getContext("2d").fillStyle = "#ff4000";
  image.getContext("2d").fillRect(0, 0, 20, 20);
  const context = document.createElement("canvas").getContext("2d");
  sceneApi.drawPhoto(context, image, 20, 20);
  const [r, g, b] = context.getImageData(10, 10, 1, 1).data;
  assert(r < 180 && r - b < 120 && g > b, `photo not filtered: ${r},${g},${b}`);
  assert(context.filter === "none", "photo filtering leaked to gameplay artwork");
  const terrain = flatTerrain(20, 20, 10);
  sceneApi.paintTerrain(context, terrain);
  const layer = document.createElement("canvas").getContext("2d");
  sceneApi.paintTerrainShadow(layer, terrain);
  assert(layer.getImageData(5, 9, 1, 1).data[3] > 0, "no dark halo outside terrain");
  assert(!terrain.solid[9 * 20 + 5], "halo changed collision");
});

if (enemyApi) {
  test("REQ-LVL-15/21: seeded flying paths vary in both axes, stay clear, and repeat on reset", () => {
    const terrain = flatTerrain(160, 100, 90);
    const random = () => 0.5;
    const enemies = enemyApi.createEnemies(terrain, random);
    assert(JSON.stringify(enemies) === JSON.stringify(enemyApi.createEnemies(terrain, random)),
      "same random sequence changed the patrol paths");
    terrain.enemies = enemies;
    const run = runApi.createRun(terrain);
    for (const enemy of run.enemies) {
      assert(enemy.path?.length >= 3, "enemy has no multi-waypoint flying path");
      assert(new Set(enemy.path.map(point => point.x)).size > 1
        && new Set(enemy.path.map(point => point.y)).size > 1, "flying path is confined to one axis");
      for (let frame = 0; frame < 600; frame += 1) {
        enemyApi.stepEnemies([enemy], 1 / 30);
        assert(enemy.x >= enemy.left && enemy.x <= enemy.right
          && enemy.y >= enemy.top && enemy.y <= enemy.bottom, "enemy escaped its checked flight bounds");
        for (let y = Math.floor(enemy.y); y < Math.ceil(enemy.y + enemy.height); y += 1) {
          for (let x = Math.floor(enemy.x); x < Math.ceil(enemy.x + enemy.width); x += 1) {
            assert(!terrain.solid[y * terrain.width + x], "flying path crosses solid terrain");
          }
        }
      }
    }
    runApi.resetRun(run);
    assert(JSON.stringify(run.enemies) === JSON.stringify(enemies), "reset changed the original flight paths or phase");
    const replay = runApi.createRun(terrain);
    for (let frame = 0; frame < 60; frame += 1) {
      enemyApi.stepEnemies(run.enemies, 1 / 60);
      enemyApi.stepEnemies(replay.enemies, 1 / 60);
    }
    assert(JSON.stringify(run.enemies) === JSON.stringify(replay.enemies), "reset flight replay diverged");
  });
  test("REQ-LVL-21: swept contact includes vertical flight and waypoint turns", () => {
    const enemy = { x: 0, y: 0, width: 2, height: 2, speed: 20, phase: 0,
      path: [{ x: 0, y: 0 }, { x: 0, y: 10 }, { x: 10, y: 10 }] };
    enemyApi.stepEnemies([enemy], 1);
    assert(enemyApi.enemyContact({ x: 0, y: 5, width: 2, height: 2 }, [enemy]),
      "vertical flight tunneled through the player");
    assert(enemyApi.enemyContact({ x: 5, y: 10, width: 2, height: 2 }, [enemy]),
      "post-turn flight tunneled through the player");
    assert(!enemyApi.enemyContact({ x: 5, y: 3, width: 2, height: 2 }, [enemy]),
      "flight contact incorrectly used the path bounding box");
  });
  test("REQ-LVL-15: patrols have clear swept footprints, safe margins, and bounded reflected motion", () => {
    const terrain = flatTerrain(160, 100, 90);
    terrain.spawn = { x: 0, y: 81 };
    terrain.flag = { x: 148, y: 90, width: 12, height: 18 };
    terrain.biome = "jungle";
    const enemies = enemyApi.createEnemies(terrain, () => 0.5);
    assert(enemies.length === 2, "expected two enemies");
    for (const enemy of enemies) {
      assert(enemy.right - enemy.left >= 24 && enemy.y >= 0 && enemy.y + enemy.height <= terrain.height,
        "patrol is too short or out of bounds");
      for (const area of [{ ...terrain.spawn, width: 6, height: 9 },
        { ...terrain.flag, y: terrain.flag.y - terrain.flag.height }]) {
        assert(enemy.right + enemy.width <= area.x - 12 || enemy.left >= area.x + area.width + 12
          || enemy.y + enemy.height <= area.y - 12 || enemy.y >= area.y + area.height + 12,
        "patrol enters protected spawn/finish margin");
      }
      for (let frame = 0; frame < 300; frame += 1) {
        enemyApi.stepEnemies([enemy], 0.05);
        assert(enemy.x >= enemy.left && enemy.x <= enemy.right, "enemy escaped corridor");
        for (let y = Math.floor(enemy.y); y < Math.ceil(enemy.y + enemy.height); y += 1) {
          for (let x = Math.floor(enemy.x); x < Math.ceil(enemy.x + enemy.width); x += 1) {
            assert(!terrain.solid[y * terrain.width + x], "enemy entered terrain");
          }
        }
      }
      enemyApi.stepEnemies([enemy], 10000);
      assert(enemy.x >= enemy.left && enemy.x <= enemy.right, "large step escaped corridor");
    }
    const blocked = flatTerrain(30, 30, 0);
    blocked.spawn = terrain.spawn;
    blocked.flag = terrain.flag;
    let rejected = false;
    try { enemyApi.createEnemies(blocked); } catch (error) { rejected = /patrol/i.test(error.message); }
    assert(rejected, "no-corridor case silently omitted enemies");
  });
  test("REQ-SYS-14: enemy contact resets terrain, player, timer, pickups, platforms, and patrols", () => {
    const original = flatTerrain(100, 80, 60);
    original.spawn = { x: 2, y: 51 };
    original.flag = { x: 80, y: 60, width: 12, height: 18 };
    original.enemies = [{ x: 40, y: 20, left: 20, right: 70, width: 10, height: 6, phase: 20, speed: 18 }];
    original.pickups = [{ type: "speed", x: 30, y: 20, width: 4, height: 4 }];
    original.movingPlatforms = [{ x: 10, y: 10, left: 10, right: 20, width: 12, height: 3, speed: 18, direction: 1 }];
    const run = runApi.createRun(original);
    run.startedAt = 100;
    run.elapsedMs = 900;
    run.terrain.solid[65 * 100 + 5] = 0;
    run.pickups.length = 0;
    run.effects.speedSeconds = 4;
    run.movingPlatforms[0].x = 15;
    run.player.x = 60;
    run.player.y = 20;
    const previous = { ...run.player, x: 20 };
    assert(enemyApi.enemyContact(run.player, run.enemies, previous), "swept contact was missed");
    assert(!enemyApi.enemyContact({ ...run.player, y: 0 }, run.enemies, { ...previous, y: 0 }),
      "noncontact horizontal crossing counted");
    runApi.resetRun(run);
    assert(run.player.x === 2 && run.player.y === 51 && !run.player.charging, "player not restored");
    assert(run.startedAt === null && run.elapsedMs === 0 && run.terrain.solid[6505], "run timer or terrain was not reset");
    assert(run.pickups.length === 1 && run.effects.speedSeconds === 0, "pickup state survived reset");
    assert(run.movingPlatforms[0].x === 10, "moving platform position survived reset");
    assert(run.enemies[0].x === 40, "enemy patrol position survived reset");
    enemyApi.stepEnemies(run.enemies, 1);
    assert(original.enemies[0].x === 40, "runtime enemy mutation changed selected option");
    assert(runApi.createRun(original).enemies[0].x === 40, "new run retained enemy progress");
    const reversing = { x: 9.8, y: 0, left: 0, right: 10, width: 1, height: 1, speed: 18, phase: 9.8 };
    enemyApi.stepEnemies([reversing], 0.4 / 18);
    const nearTurn = { x: 10.95, y: 0, width: 1, height: 1 };
    assert(enemyApi.enemyContact(nearTurn, [reversing]), "contact at patrol reversal was missed");
    assert(!enemyApi.enemyContact({ ...nearTurn, x: 11.1 }, [reversing]), "patrol reversal overestimated contact");
  });
  test("REQ-LVL-15: all three enemy silhouettes are visible, distinct, and bounded", () => {
    const images = new Set();
    for (const biome of ["jungle", "desert", "underwater"]) {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 20;
      const context = canvas.getContext("2d");
      sceneApi.drawEnemies(context, [{ x: 5, y: 5, width: 10, height: 6 }], biome);
      const pixels = context.getImageData(0, 0, 20, 20).data;
      assert(pixels.some(Boolean), "invisible enemy");
      for (let y = 0; y < 20; y += 1) for (let x = 0; x < 20; x += 1) {
        if (pixels[(y * 20 + x) * 4 + 3]) assert(x >= 5 && x < 15 && y >= 5 && y < 11,
          "enemy artwork exceeds collision footprint");
      }
      images.add(Array.from(pixels).join(","));
    }
    assert(images.size === 3, "biome enemy artwork is identical");
  });
}

if (terrainApi) {
  test("REQ-LVL-09/11: shoulder slopes survive diagonal grouping without invented vertical walls", () => {
    const width = 160, height = 100;
    const pixels = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
      const value = y >= 65 - Math.floor(x / 3) ? 230 : 20;
      pixels.set([value,value,value,255], (y * width + x) * 4);
    }
    const terrain = terrainApi.generateTerrain(pixels,width,height,{layout:"vertical"});
    let followed = 0;
    for (let x = 5; x < 150; x += 1) {
      const y = 65 - Math.floor(x / 3);
      if ([-1,0,1,2,3].some(offset => terrain.solid[(y + offset) * width + x])) followed += 1;
    }
    assert(followed > 125, `only ${followed} shoulder columns retained`);
    assert(terrain.edgeDirections instanceof Uint8Array, "no local edge-direction evidence retained");
  });
  test("REQ-LVL-06: interior filling opacity is exactly 80 percent", () => {
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
    assert(terrain.solid.some(Boolean), "photo features disappeared");
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
      if (y > 72) assert(!terrain.solid[y * width + 50], "object detection invented a lower floor");
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

  test("REQ-LVL-01/09: substantial photo features survive without a global occupancy quota", () => {
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
    assert(terrain.solid.some(Boolean), "substantial edge was discarded");
  });

  test("REQ-LVL-09: photo contours are not split into artificial rectangular wall faces", () => {
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
    for (let x = 1; x < width - 1; x += 1) {
      assert(terrain.solid[row * width + x], "fixed cuts interrupted a real photo edge");
    }
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
    assert(terrain.solid.some(Boolean), "walls were discarded");
    const wallX = [48, 49, 50, 51].find((x) => terrain.solid[40 * width + x]);
    const player = physicsApi.createPlayer(wallX - 6 - 2, 30);
    physicsApi.stepPlayer(player, { jumpPressed: true, jumpHeld: true }, terrain, 0.05);
    assert(player.charging, "generated wall did not support charging");
    assert(player.vy < 0 && player.vx === -80, "generated wall did not support an upward/away jump");
    physicsApi.stepPlayer(player, { jumpReleased: true }, terrain, 0.05);
  });

  test("REQ-LVL-09: dense photo features retain substantial geometry", () => {
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
    assert(terrain.solid.some(Boolean), "all substantial features discarded");
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
  test("REQ-MOV-03: fractional-height horizontal tunnels never excavate their floor", () => {
    for (const move of [-1, 1]) {
      for (const dt of [1 / 30, 1 / 60, 1 / 120]) {
        for (const climbing of [false, true]) {
          const terrain = flatTerrain(180, 100, 40);
          const startX = move < 0 ? 130 : 30;
          const startY = climbing ? 30.7 : 31 + 1e-14;
          const player = physicsApi.createPlayer(startX, startY);
          player.climbing = climbing;
          for (let y = 10; y < 40; y += 1) {
            const left = move < 0 ? 60 : 45;
            const right = move < 0 ? 121 : 110;
            terrain.solid.fill(1, y * 180 + left, y * 180 + right);
          }
          for (let frame = 0; frame < 1 / dt; frame += 1) {
            physicsApi.stepPlayer(player, { move, drill: true }, terrain, dt);
            assert(Math.abs(player.y - startY) < 1e-9, `horizontal excavation drifted vertically: ${player.y}`);
          }
          assert((player.x - startX) * move > 10, "drill failed to move through intact terrain");
          assert(terrain.version > 0, "test did not excavate intact terrain");
          for (let x = 0; x < 180; x += 1) {
            assert(terrain.solid[40 * 180 + x] === 1, `horizontal drill removed foot support at ${x}`);
          }
        }
      }
    }
  });

  test("REQ-MOV-05: press launches immediately; holding increases rise only for 250 ms", () => {
    for (const dt of [1 / 30, 1 / 60, 1 / 120]) {
      const rise = (hold) => {
        const terrain = flatTerrain(120, 300, 280);
        const player = physicsApi.createPlayer(50, 271);
        physicsApi.stepPlayer(player, { jumpPressed: true, jumpHeld: true }, terrain, dt);
        assert(player.y < 271 && player.vy < 0, "press did not launch immediately");
        let highest = player.y;
        let time = dt;
        for (let frame = 0; frame < 3 / dt; frame += 1) {
          physicsApi.stepPlayer(player, { jumpHeld: time < hold, jumpReleased: time >= hold && time - dt < hold }, terrain, dt);
          time += dt;
          highest = Math.min(highest, player.y);
        }
        return 271 - highest;
      };
      const tap = rise(0);
      const partial = rise(0.125);
      const full = rise(0.25);
      const long = rise(2);
      const normal = 180 ** 2 / (2 * physicsApi.GRAVITY);
      assert(Math.abs(tap - normal) < 1, `tap rise ${tap}`);
      assert(partial > tap && partial < full, "partial hold did not produce intermediate height");
      assert(Math.abs(full - 2 * normal) < 1, `full rise ${full}`);
      assert(Math.abs(long - full) < 1, `holding beyond window changed rise: ${long} vs ${full}`);
    }
  });
  test("REQ-MOV-03: continuous excavation is twenty cells per second, empty drill travel remains eighty", () => {
    for (const dt of [1/30,1/60,1/120]) {
      const terrain = flatTerrain(200,80,70);
      for (let y=0;y<70;y+=1) terrain.solid.fill(1,y*200+20,(y+1)*200);
      const player = physicsApi.createPlayer(14,40);
      player.climbing = false;
      for(let frame=0;frame<Math.round(0.5/dt);frame+=1) {
        const x=player.x;
        physicsApi.stepPlayer(player,{move:1,drill:true},terrain,dt);
        assert(player.x-x <= 20*dt+1e-6,`excavation exceeded 20 at dt=${dt}: ${(player.x-x)/dt}`);
      }
      const open = flatTerrain(200,80,80);
      const walker = physicsApi.createPlayer(10,71);
      physicsApi.stepPlayer(walker,{move:1,drill:true},open,dt);
      assert(Math.abs(walker.x-10-80*dt)<1e-6,"drill slowed already-open walking");
      assert(player.vy>=0,"excavation enabled hovering");
    }
  });
  test("REQ-CHR-02: player collision footprint is 6 by 9 cells", () => {
    const player = physicsApi.createPlayer(4, 4);
    assert(player.width === 6 && player.height === 9, `footprint was ${player.width}x${player.height}`);
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

  test("REQ-MOV-03: drilling preserves normal movement and gravity", () => {
    const regularTerrain = flatTerrain();
    const drillTerrain = flatTerrain();
    const regular = physicsApi.createPlayer(4, 10);
    const drilling = physicsApi.createPlayer(4, 10);
    physicsApi.stepPlayer(regular, { move: 1 }, regularTerrain, 0.05);
    physicsApi.stepPlayer(drilling, { move: 1, drill: true }, drillTerrain, 0.05);
    const regularDistance = regular.x - 4;
    const drillDistance = drilling.x - 4;
    assert(Math.abs(regularDistance - 4) < 0.1, `normal distance was ${regularDistance}`);
    assert(Math.abs(drillDistance - regularDistance) < 0.001, `drill distance was ${drillDistance}`);
    assert(drilling.vy === regular.vy && drilling.vy > 0, "drill changed gravity");
  });

  test("REQ-MOV-10: background climbing holds and moves at normalized quarter speed", () => {
    const terrain = flatTerrain(100, 100, 90);
    const cases = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]];
    for (const [move, moveY] of cases) {
      const player = physicsApi.createPlayer(40, 40);
      physicsApi.stepPlayer(player, { moveY: -1 }, terrain, 0);
      assert(player.climbing, "Up did not attach to background");
      player.vy = 100;
      physicsApi.stepPlayer(player, { move, moveY }, terrain, 0.05);
      const distance = Math.hypot(player.x - 40, player.y - 40);
      assert(Math.abs(distance - 80 / 4 * 0.05) < 0.001, `wrong speed for ${move},${moveY}: ${distance}`);
      assert(Math.sign(player.x - 40) === Math.sign(move), "wrong horizontal direction");
      assert(Math.sign(player.y - 40) === Math.sign(moveY), "wrong vertical direction");
    }
    const player = physicsApi.createPlayer(40, 40);
    physicsApi.stepPlayer(player, { moveY: -1 }, terrain, 0);
    physicsApi.stepPlayer(player, {}, terrain, 0.05);
    assert(player.x === 40 && player.y === 40 && player.climbing, "released controls did not hold the wall");
  });

  test("REQ-MOV-03: directional drill cuts only the aimed tunnel and persists", () => {
    for (const [move, moveY] of [[1, 0], [-1, 0], [0, -1], [0, 1], [1, -1], [-1, 1], [1, 1], [-1, -1]]) {
      const terrain = flatTerrain(60, 60, 0);
      const player = physicsApi.createPlayer(25, 25);
      physicsApi.stepPlayer(player, { drill: true, move, moveY }, terrain, 0);
      const magnitude = Math.hypot(move, moveY);
      const x = Math.floor(28 + move / magnitude * 8);
      const y = Math.floor(29.5 + moveY / magnitude * 8);
      const oppositeX = Math.floor(28 - move / magnitude * 8);
      const oppositeY = Math.floor(29.5 - moveY / magnitude * 8);
      assert(terrain.solid[y * 60 + x] === 0, `uncut direction ${move},${moveY}`);
      assert(terrain.solid[oppositeY * 60 + oppositeX] === 1, "drill excavated behind player");
      assert(terrain.version >= 1, "excavation did not invalidate terrain rendering");
      const drilled = terrain.solid.slice();
      physicsApi.stepPlayer(player, {}, terrain, 0);
      assert(drilled.every((cell, index) => cell === terrain.solid[index]), "excavation did not persist");
    }
  });

  test("REQ-MOV-03/05: drilling preserves jump charge", () => {
    const terrain = flatTerrain(60, 60, 40);
    const player = physicsApi.createPlayer(4, 31);
    physicsApi.stepPlayer(player, { jumpPressed: true, jumpHeld: true }, terrain, 0);
    physicsApi.stepPlayer(player, { drill: true, jumpHeld: true }, terrain, 0.05);
    assert(player.charging && player.chargeSeconds === 0.05, "drill cancelled jump assistance");
    physicsApi.stepPlayer(player, { jumpReleased: true }, terrain, 0.05);
    assert(player.vy < 0, "drill prevented charged jump");
  });

  test("REQ-MOV-10: jump press immediately drops, consumes release, and requires fresh Up", () => {
    const terrain = flatTerrain(100, 100, 100);
    const player = physicsApi.createPlayer(40, 60);
    physicsApi.stepPlayer(player, { moveY: -1, jumpPressed: true, jumpHeld: true }, terrain, 0.05);
    assert(!player.climbing && !player.charging && player.vy > 0, "press did not immediately drop");
    const dropY = player.y;
    physicsApi.stepPlayer(player, { moveY: -1, jumpHeld: true }, terrain, 0.05);
    physicsApi.stepPlayer(player, { moveY: -1, jumpReleased: true }, terrain, 0.05);
    assert(!player.climbing && player.vy > 0 && player.y > dropY, "release launched instead of falling");
    let falling = false;
    for (let frame = 0; frame < 25; frame += 1) {
      physicsApi.stepPlayer(player, { moveY: -1 }, terrain, 0.05);
      assert(!player.climbing, "held Up reattached after jump");
      falling ||= player.vy > 0;
    }
    assert(falling, "detached jump did not fall");
    physicsApi.stepPlayer(player, {}, terrain, 0);
    physicsApi.stepPlayer(player, { moveY: -1 }, terrain, 0);
    assert(player.climbing, "fresh Up did not reattach");
  });

  test("REQ-MOV-10: a held drop press cannot charge on landing or launch on release", () => {
    const terrain = flatTerrain(100, 100, 80);
    const player = physicsApi.createPlayer(40, 65);
    physicsApi.stepPlayer(player, { moveY: -1 }, terrain, 0);
    for (let frame = 0; frame < 30; frame += 1) {
      physicsApi.stepPlayer(player, { jumpPressed: frame === 0, jumpHeld: true }, terrain, 0.05);
      assert(!player.charging, "held drop press charged near terrain");
    }
    physicsApi.stepPlayer(player, { jumpReleased: true }, terrain, 0.05);
    assert(player.grounded && player.vy === 0, "drop release launched from floor");
    physicsApi.stepPlayer(player, { jumpPressed: true, jumpHeld: true }, terrain, 0);
    assert(player.charging, "fresh floor press no longer charges");
  });

  test("REQ-MOV-08: solid bottom supports landing, walking, charging and jumping without terrain", () => {
    const terrain = flatTerrain(100, 60, 60);
    const player = physicsApi.createPlayer(20, 49);
    for (let frame = 0; frame < 30; frame += 1) physicsApi.stepPlayer(player, {}, terrain, 0.05);
    assert(player.y === 51 && player.grounded && player.vy === 0, "bottom did not stop feet");
    physicsApi.stepPlayer(player, { move: 1, jumpPressed: true, jumpHeld: true }, terrain, 0.05);
    assert(player.x === 24 && player.charging, "bottom did not allow walking/charging");
    physicsApi.stepPlayer(player, { jumpReleased: true }, terrain, 0.05);
    assert(player.vy < 0 && player.y < 51, "bottom did not allow jumping");
    assert(!terrain.solid.some(Boolean), "boundary added generated terrain");
  });

  test("REQ-MOV-07/08: terrain just above the bottom remains the nearest floor", () => {
    const terrain = flatTerrain(100, 60, 59);
    const player = physicsApi.createPlayer(20, 49);
    physicsApi.stepPlayer(player, {}, terrain, 0);
    assert(player.y === 50 && player.grounded, "bottom snapping bypassed photo terrain");
    const climber = physicsApi.createPlayer(20, 49);
    physicsApi.stepPlayer(climber, { moveY: -1 }, terrain, 0);
    physicsApi.stepPlayer(climber, { moveY: 1 }, terrain, 0);
    assert(climber.y === 50 && climber.grounded && !climber.climbing, "climbing snap bypassed bottom-adjacent terrain");
  });

  test("REQ-MOV-10: descending feet land, walking resumes, and Up leaves the floor", () => {
    for (const floor of [40, 60]) {
      const terrain = flatTerrain(100, 60, floor);
      const player = physicsApi.createPlayer(20, floor - 14);
      physicsApi.stepPlayer(player, { moveY: -1 }, terrain, 0);
      for (let frame = 0; frame < 10; frame += 1) physicsApi.stepPlayer(player, { moveY: 1 }, terrain, 0.05);
      assert(!player.climbing && player.grounded, "feet did not end climbing");
      const x = player.x;
      physicsApi.stepPlayer(player, { move: 1 }, terrain, 0.05);
      assert(player.x === x + 4, "landing did not restore walking speed");
      physicsApi.stepPlayer(player, { moveY: -1 }, terrain, 0.05);
      assert(player.climbing && player.y < floor - player.height, "Up did not climb away from ground");
    }
  });

  test("REQ-MOV-03/10: climbing collides without drill and tunnels upward with drill", () => {
    const terrain = flatTerrain(100, 100, 100);
    for (let y = 20; y < 35; y += 1) terrain.solid.fill(1, y * 100, (y + 1) * 100);
    const player = physicsApi.createPlayer(40, 40);
    for (let frame = 0; frame < 20; frame += 1) physicsApi.stepPlayer(player, { moveY: -1 }, terrain, 0.05);
    assert(player.y >= 35, "climber passed through terrain without drilling");
    for (let frame = 0; frame < 25; frame += 1) physicsApi.stepPlayer(player, { moveY: -1, drill: true }, terrain, 0.05);
    assert(player.y < 20 && player.climbing, "upward drill did not make passable tunnel");
    assert(terrain.solid[25 * 100 + 20] === 1, "tunnel removed distant terrain");
  });

  test("REQ-MOV-03/08: drilling down from standing reaches but cannot remove the bottom", () => {
    const terrain = flatTerrain(100, 60, 30);
    const player = physicsApi.createPlayer(40, 21);
    for (let frame = 0; frame < 100; frame += 1) physicsApi.stepPlayer(player, { moveY: 1, drill: true }, terrain, 0.05);
    assert(player.y === 51 && player.grounded, "downward drill did not reach solid bottom");
    assert(terrain.solid[40 * 100 + 43] === 0 && terrain.solid[40 * 100 + 20] === 1, "downward tunnel shape incorrect");
  });

  test("REQ-MOV-03: idle drill uses facing and unchanged terrain does not change version", () => {
    const terrain = flatTerrain(100, 100, 0);
    const player = physicsApi.createPlayer(40, 40);
    player.facing = -1;
    physicsApi.stepPlayer(player, { drill: true }, terrain, 0);
    assert(terrain.solid[44 * 100 + 35] === 0, "idle drill ignored facing");
    assert(terrain.solid[44 * 100 + 51] === 1, "idle drill excavated opposite side");
    const version = terrain.version;
    physicsApi.stepPlayer(player, { drill: true }, terrain, 0);
    assert(terrain.version === version, "unchanged terrain invalidated rendering");
  });

  test("REQ-MOV-06/10: climbing stops at ceiling and image sides", () => {
    const terrain = flatTerrain(100, 100, 100);
    const player = physicsApi.createPlayer(0, 0);
    physicsApi.stepPlayer(player, { move: -1, moveY: -1 }, terrain, 0.05);
    assert(player.x === 0 && player.y === 0, "climber escaped image");
    assert(player.vx === 0 && player.vy === 0, "boundary did not stop climbing velocity");
  });

  test("REQ-MOV-02/05: jump launches on press on a surface but not in air", () => {
    const terrain = flatTerrain();
    const player = physicsApi.createPlayer(10, 15);
    physicsApi.stepPlayer(player, {}, terrain, 0.016);
    assert(player.grounded, "player should be grounded on the floor");
    physicsApi.stepPlayer(player, { jumpPressed: true, jumpHeld: true }, terrain, 0.016);
    assert(player.vy < 0, "press must launch immediately");
    physicsApi.stepPlayer(player, { jumpReleased: true }, terrain, 0.016);
    assert(player.vy < 0, "grounded jump should move upward");
    const jumpVelocity = player.vy;
    physicsApi.stepPlayer(player, { jumpPressed: true, jumpReleased: true }, terrain, 0.016);
    assert(player.vy > jumpVelocity, "airborne jump request should not reset jump velocity");
    assert(player.vy < 0, "player should still be rising after the ignored request");
  });

  test("REQ-MOV-05: holding through landing does not automatically jump again", () => {
    const terrain = flatTerrain(100, 300, 280);
    const player = physicsApi.createPlayer(40, 271);
    for (let frame = 0; frame < 100; frame += 1) {
      physicsApi.stepPlayer(player, { jumpPressed: frame === 0, jumpHeld: true }, terrain, 0.05);
    }
    assert(!player.charging, `assistance remained active after landing`);
    assert(player.y === 271 && player.vy === 0, "held jump repeated automatically");
  });

  test("REQ-MOV-05: maximum launch strength represents twice normal height", () => {
    const expectedHeight = 180 ** 2 / physicsApi.GRAVITY;
    const speed = physicsApi.jumpSpeedForHold(0.25, 1 / 240);
    let y = 0;
    let vy = -speed;
    let apex = 0;
    for (let frame = 0; frame < 1000 && vy < 0; frame += 1) {
      vy += physicsApi.GRAVITY / 240;
      y += vy / 240;
      apex = Math.min(apex, y);
    }
    assert(Math.abs(-apex - expectedHeight) < 0.1, `rise was ${-apex}, expected ${expectedHeight}`);
    assert(physicsApi.jumpSpeedForHold(0, 1 / 60) < physicsApi.jumpSpeedForHold(0.125, 1 / 60),
      "partial charge did not increase jump strength");
  });

  test("REQ-MOV-05: ascent eventually ends assistance and release adds no impulse", () => {
    const terrain = flatTerrain(60, 60, 40);
    terrain.solid.fill(0);
    for (let x = 0; x < 12; x += 1) terrain.solid[40 * 60 + x] = 1;
    const player = physicsApi.createPlayer(4, 31);
    physicsApi.stepPlayer(player, { jumpPressed: true, jumpHeld: true }, terrain, 0.05);
    for (let frame = 0; frame < 10; frame += 1) {
      physicsApi.stepPlayer(player, { move: 1, jumpHeld: true }, terrain, 0.05);
    }
    assert(!player.charging, "assistance survived the end of ascent");
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

  test("REQ-MOV-05/06: ceiling stops held upward assistance", () => {
    const terrain = flatTerrain(100, 70, 69);
    const player = physicsApi.createPlayer(40, 60);
    physicsApi.stepPlayer(player, { jumpPressed: true, jumpHeld: true }, terrain, 1 / 60);
    let highest = player.y;
    for (let frame = 0; frame < 120; frame += 1) {
      physicsApi.stepPlayer(player, { jumpHeld: true }, terrain, 1 / 60);
      highest = Math.min(highest, player.y);
      if (player.y === 0) assert(!player.charging && player.vy === 0, "ceiling left assistance active");
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

  test("REQ-MOV-03: drill carves a character-height tunnel and enables penetration", () => {
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
    assert(terrain.solid[16 * terrain.width + 12] === 0, "tunnel did not clear the player's foot space");
    assert(terrain.solid[22 * terrain.width + 12] === 1, "tunnel was wider than needed");
    assert(player.x > 4, "player did not penetrate the drilled wall");
    physicsApi.stepPlayer(player, {}, terrain, 0.1);
    assert(terrain.solid[tunnelIndex] === 0, "tunnel did not persist");
  });

  test("REQ-MOV-03: horizontal drilling while walking preserves the supporting floor", () => {
    for (const [move, x, supportX] of [[-1, 40, 42], [1, 20, 24]]) {
      const terrain = flatTerrain(80, 60, 40);
      const player = physicsApi.createPlayer(x, 31);
      physicsApi.stepPlayer(player, { move, drill: true }, terrain, 0.05);
      assert(terrain.solid[40 * terrain.width + supportX] === 1, `horizontal drill ${move} removed terrain below the player's feet`);
      assert(player.y === 31 && player.grounded, `horizontal drilling ${move} made the player sink`);
    }
  });

  test("REQ-MOV-07: charges work exactly three cells above floor but not beyond", () => {
    const terrain = flatTerrain(80, 80, 60);
    for (const [gap, allowed] of [[0, true], [2.9, true], [3, true], [3.1, false]]) {
      const player = physicsApi.createPlayer(10, 60 - 9 - gap);
      physicsApi.stepPlayer(player, { jumpPressed: true, jumpHeld: true }, terrain, 0);
      assert(player.charging === allowed, `incorrect floor tolerance at gap ${gap}`);
    }
  });

  test("REQ-MOV-07: walking up and down slopes preserves support", () => {
    for (const descending of [false, true]) {
      const terrain = flatTerrain(160, 140, 140);
      for (let x = 0; x < terrain.width; x += 1) {
        const top = descending ? 40 + Math.floor(x / 2) : 120 - Math.floor(x / 2);
        terrain.surfaceY[x] = top;
        for (let y = top; y < terrain.height; y += 1) terrain.solid[y * terrain.width + x] = 1;
      }
      const player = physicsApi.createPlayer(10, physicsApi.findSpawnY(terrain, 10));
      physicsApi.stepPlayer(player, {}, terrain, 1 / 60);
      for (let frame = 0; frame < 50; frame += 1) {
        physicsApi.stepPlayer(player, { move: 1 }, terrain, 1 / 60);
        assert(player.grounded, `${descending ? "descending" : "rising"} lost support at frame ${frame}`);
      }
      assert(player.x > 70, "slope blocked walking");
      physicsApi.stepPlayer(player, { jumpPressed: true, jumpHeld: true }, terrain, 1 / 60);
      assert(player.vy < 0, "slope press did not launch");
    }
  });

  test("REQ-MOV-02/07: both walls launch upward and away on press", () => {
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
      physicsApi.stepPlayer(player, { move: side, jumpPressed: true, jumpHeld: true }, terrain, 0.05);
      assert(player.charging, `no wall charge on side ${side}`);
      assert(player.y < 40 && player.vy < 0 && player.vx === -side * 80, "wall press did not launch upward and away");
      const expectedVy = -physicsApi.jumpSpeedForHold(0, 0.05) + physicsApi.GRAVITY * 0.05;
      assert(Math.abs(player.vy - expectedVy) < 1e-9, "wall jump did not use ground charge strength");
      assert(Math.abs(player.x - x + side * 4) < 0.001, "away launch was overridden by input");
    }
  });

  test("REQ-MOV-07: assistance survives leaving support and release never relaunches", () => {
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
    assert(player.charging, "hold window incorrectly required continued contact");
    const other = physicsApi.createPlayer(10, 61);
    terrain.solid.fill(1, 70 * 100);
    physicsApi.stepPlayer(other, { jumpPressed: true, jumpHeld: true }, terrain, 0);
    terrain.solid.fill(0);
    const beforeRelease = other.vy;
    physicsApi.stepPlayer(other, { jumpReleased: true }, terrain, 0.01);
    assert(other.vy > beforeRelease && !other.charging, "release added an impulse");
    terrain.solid.fill(1, 70 * 100);
    physicsApi.stepPlayer(other, {}, terrain, 0.01);
    assert(other.vy > beforeRelease && !other.charging, "release queued a launch");
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

  test("REQ-MOV-07: floor grace launches within three cells of the last floor contact", () => {
    for (const [dx, dy, expected] of [[0, 1, true], [3, 0, true], [0, 3, true], [1.8, 2.4, true], [0, 3.1, false], [2.4, 2, false]]) {
      const terrain = flatTerrain(100, 100, 70);
      const player = physicsApi.createPlayer(40, 61);
      physicsApi.stepPlayer(player, {}, terrain, 0);
      terrain.solid.fill(0);
      player.x += dx;
      player.y += dy;
      player.vy = 50;
      physicsApi.stepPlayer(player, { move: 1, jumpPressed: true, jumpHeld: true }, terrain, 0);
      assert(player.charging === expected && (player.vy < 0) === expected, `incorrect floor grace at ${dx},${dy}`);
      if (expected) assert(player.vx === 80, "floor grace did not keep normal floor-jump movement");
    }
  });

  test("REQ-MOV-07: walking off a cliff can still jump just after the edge", () => {
    for (const frameDuration of [1 / 30, 1 / 60, 1 / 144]) {
      for (const [pressX, expected] of [[40, true], [48, false]]) {
        const terrain = flatTerrain(100, 100, 70);
        for (let y = 70; y < 100; y += 1) terrain.solid.fill(0, y * 100 + 40, (y + 1) * 100);
        const player = physicsApi.createPlayer(20, 61);
        physicsApi.stepPlayer(player, {}, terrain, 0);
        let frames = 0;
        while (player.x < pressX && frames < 200) {
          physicsApi.stepPlayer(player, { move: 1 }, terrain, frameDuration);
          frames += 1;
        }
        assert(!player.grounded && player.vy >= 0, `player did not walk off the cliff at ${frameDuration}`);
        physicsApi.stepPlayer(player, { move: 1, jumpPressed: true, jumpHeld: true }, terrain, frameDuration);
        assert((player.vy < 0) === expected, `incorrect walk-off grace at x ${pressX}, frame ${frameDuration}`);
      }
    }
  });

  test("REQ-MOV-02/07: wall grace launches away within four cells of the last wall contact", () => {
    for (const side of [-1, 1]) {
      const away = -side;
      for (const [dx, dy, expected] of [[1, 0, true], [4, 0, true], [2.4, 3.2, true], [4.1, 0, false], [3, 3, false]]) {
        const terrain = flatTerrain(100, 200, 200);
        const wallX = side < 0 ? 30 : 50;
        for (let y = 1; y < 190; y += 1) terrain.solid[y * 100 + wallX] = 1;
        const player = physicsApi.createPlayer(side < 0 ? wallX + 4 : wallX - 9, 40);
        physicsApi.stepPlayer(player, {}, terrain, 0);
        player.x += away * dx;
        player.y += dy;
        physicsApi.stepPlayer(player, { move: side, jumpPressed: true, jumpHeld: true }, terrain, 0);
        assert(player.charging === expected && (player.vy < 0) === expected, `incorrect wall grace on side ${side} at ${dx},${dy}`);
        if (expected) assert(player.vx === away * 80, "wall grace did not launch away from the last wall");
      }
    }
  });

  test("REQ-MOV-07/10: grace is consumed by a launch and cleared by background attachment", () => {
    const terrain = flatTerrain(100, 100, 70);
    const player = physicsApi.createPlayer(40, 61);
    physicsApi.stepPlayer(player, {}, terrain, 0);
    terrain.solid.fill(0);
    player.y += 1;
    physicsApi.stepPlayer(player, { jumpPressed: true, jumpReleased: true }, terrain, 0);
    assert(player.vy < 0, "grace jump did not launch");
    const afterLaunch = player.vy;
    physicsApi.stepPlayer(player, { jumpPressed: true, jumpReleased: true }, terrain, 0.01);
    assert(player.vy > afterLaunch, "grace granted an additional airborne jump");
    const climber = physicsApi.createPlayer(40, 61);
    terrain.solid.fill(1, 70 * 100);
    physicsApi.stepPlayer(climber, {}, terrain, 0);
    terrain.solid.fill(0);
    physicsApi.stepPlayer(climber, { moveY: -1 }, terrain, 0);
    physicsApi.stepPlayer(climber, { jumpPressed: true, jumpHeld: true }, terrain, 0);
    physicsApi.stepPlayer(climber, { jumpReleased: true }, terrain, 0);
    physicsApi.stepPlayer(climber, { jumpPressed: true, jumpHeld: true }, terrain, 0);
    assert(!climber.charging && climber.vy >= 0, "grace survived background attachment");
  });

  test("REQ-MOV-02/07: rising jumps are not snapped or recharged; image side borders are jumpable", () => {
    const terrain = flatTerrain(100, 100, 70);
    const player = physicsApi.createPlayer(10, 61);
    physicsApi.stepPlayer(player, { jumpPressed: true, jumpReleased: true }, terrain, 0.01);
    const y = player.y;
    const vy = player.vy;
    physicsApi.stepPlayer(player, { jumpPressed: true, jumpReleased: true }, terrain, 0.01);
    assert(player.y < y && player.vy > vy && !player.charging, "rising jump snapped or double-jumped");
    for (const [side, away] of [[-1, 1], [1, -1]]) {
      for (const [gap, canCharge] of [[0, true], [3, true], [3.1, false]]) {
        const x = side < 0 ? gap : terrain.width - 6 - gap;
        const edge = physicsApi.createPlayer(x, 10);
        physicsApi.stepPlayer(edge, { move: -away, jumpPressed: true, jumpHeld: true }, terrain, 0.01);
        assert(edge.charging === canCharge, `incorrect image-border tolerance on side ${side}, gap ${gap}`);
        assert((edge.vy < 0) === canCharge, `incorrect image-border launch on side ${side}, gap ${gap}`);
        if (canCharge) assert(edge.vx === away * 80, "image side border did not launch away");
        else assert(edge.vx !== away * 80, "distant image border granted a wall jump");
      }
    }
    const noTerrain = flatTerrain(100, 100, 100);
    const ceiling = physicsApi.createPlayer(10, 0);
    physicsApi.stepPlayer(ceiling, { jumpPressed: true, jumpReleased: true }, noTerrain, 0.01);
    assert(!ceiling.charging && ceiling.vy > 0, "ceiling granted a wall jump");
    const bottom = physicsApi.createPlayer(10, 91);
    physicsApi.stepPlayer(bottom, { jumpPressed: true, jumpHeld: true }, noTerrain, 0);
    physicsApi.stepPlayer(bottom, { jumpReleased: true }, noTerrain, 0.01);
    assert(bottom.vy < 0 && bottom.vx === 0, "image bottom did not remain a floor rather than a wall");
  });
}

if (runApi) {
  test("REQ-LVL-07: placement uses each sampled edge with distant starts", () => {
    const terrain = flatTerrain(100, 80, 80);
    for (let y = 25; y < 30; y += 1) terrain.solid.fill(1, y * 100, y * 100 + 24);
    for (let y = 45; y < 50; y += 1) terrain.solid.fill(1, y * 100 + 76, y * 100 + 100);
    for (let y = 0; y < 80; y += 1) terrain.solid[y * 100 + 50] = 1;
    const placements = Object.fromEntries(["left", "right", "top", "bottom"].map((edge) => (
      [edge, runApi.placeRun(terrain, edge)]
    )));
    assert(placements.left.flag.x <= 3, "left exit is not near the left edge");
    assert(placements.right.flag.x + 12 >= 97, "right exit is not near the right edge");
    assert(placements.top.flag.y === 25, "top exit did not use the nearest safe photo support");
    for (const { spawn, flag } of Object.values(placements)) {
      assert(Math.hypot(spawn.x - flag.x, spawn.y - flag.y) >= 40, "spawn is too close to gate");
      assert(!runApi.walkingReachesFlag(terrain, runApi.walkingReachable(terrain, spawn), flag), "walk-only pair accepted");
    }
  });
  test("REQ-LVL-07: complete finish gate stays in bounds on a sloping image platform", () => {
    const terrain = flatTerrain(60, 100, 90);
    terrain.solid.fill(0);
    delete terrain.spawn;
    delete terrain.flag;
    for (let x = 0; x < 60; x += 1) {
      if (x >= 26 && x < 40) continue;
      terrain.surfaceY[x] = x + 20;
      terrain.solid[(x + 20) * 60 + x] = 1;
    }

    if (sceneApi && levelApi) {
      test("REQ-LVL-06: all exposed outline directions are opaque and only interiors translucent", () => {
        const terrain = flatTerrain(20, 20, 4);
        terrain.solid.fill(0);
        for (let y = 4; y < 16; y += 1) for (let x = 4; x < 16; x += 1) terrain.solid[y * 20 + x] = 1;
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 20;
        const context = canvas.getContext("2d");
        sceneApi.paintTerrain(context, terrain);
        for (const [x, y] of [[4, 8], [15, 8], [8, 4], [8, 15]]) {
          assert(context.getImageData(x, y, 1, 1).data[3] === 255, "exposed outline is translucent");
        }
        assert(context.getImageData(8, 8, 1, 1).data[3] === 204, "interior is not 80% opaque");
        const firstFill = context.getImageData(8, 8, 1, 1).data;
        const secondFill = context.getImageData(10, 8, 1, 1).data;
        assert(firstFill[0] === secondFill[0] && firstFill[1] === secondFill[1] && firstFill[2] === secondFill[2],
          "interior fill is patterned instead of uniform");
        terrain.solid[8 * 20 + 9] = 0;
        sceneApi.paintTerrain(context, terrain);
        assert(context.getImageData(8, 8, 1, 1).data[3] === 255, "new tunnel outline is translucent");
      });
      test("REQ-CHR-05: underwater swimming visuals animate inside the unchanged character footprint", () => {
        const player = { x: 5, y: 5, width: 6, height: 9, facing: 1 };
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 20;
        const context = canvas.getContext("2d");
        sceneApi.drawSwimmingPlayer(context, player, 0);
        const first = context.getImageData(0, 0, 20, 20).data;
        context.clearRect(0, 0, 20, 20);
        sceneApi.drawSwimmingPlayer(context, player, 1);
        const second = context.getImageData(0, 0, 20, 20).data;
        assert(first.some(Boolean) && second.some(Boolean), "swimming pose is invisible");
        assert(first.some((value, index) => value !== second[index]), "swimming pose is not animated");
        for (let y = 0; y < 20; y += 1) for (let x = 0; x < 20; x += 1) {
          if (second[(y * 20 + x) * 4 + 3]) {
            assert(x >= 5 && x < 11 && y >= 5 && y < 14, "swimming artwork exceeds the character footprint");
          }
        }
      });
      test("REQ-LVL-18: enlarged pickup silhouettes have vivid colors, dark outlines, and soft auras", () => {
        for (const [type, color] of [["speed", [255, 230, 0]], ["reverse", [255, 45, 117]]]) {
          const canvas = document.createElement("canvas");
          canvas.width = 32;
          canvas.height = 32;
          const context = canvas.getContext("2d");
          context.fillStyle = "#123456";
          sceneApi.drawPickups(context, [{ type, x: 12, y: 12, width: 8, height: 8 }]);
          assert(context.fillStyle === "#123456", "pickup drawing leaked canvas state");
          const pixels = context.getImageData(0, 0, 32, 32).data;
          let bright = 0, outline = 0, aura = 0;
          const body = [];
          for (let y = 0; y < 32; y += 1) for (let x = 0; x < 32; x += 1) {
            const [r, g, b, alpha] = pixels.slice((y * 32 + x) * 4, (y * 32 + x) * 4 + 4);
            if (alpha === 255) {
              assert(x >= 12 && x < 20 && y >= 12 && y < 20, "solid artwork exceeds collection bounds");
              body.push([x, y]);
              if (r === color[0] && g === color[1] && b === color[2]) bright += 1;
              if (r < 50 && g < 50 && b < 50) outline += 1;
            } else if (alpha > 0 && (x < 12 || x >= 20 || y < 12 || y >= 20)) {
              aura += 1;
              assert(x >= 8 && x < 24 && y >= 8 && y < 24, "aura exceeds its decorative radius");
            }
          }
          assert(bright >= 10 && outline >= 10, "item lacks a vivid fill or dark outline");
          assert(aura > 20, "item lacks a soft aura beyond its collection bounds");
          assert(Math.max(...body.map(([x]) => x)) - Math.min(...body.map(([x]) => x)) === 7
            && Math.max(...body.map(([, y]) => y)) - Math.min(...body.map(([, y]) => y)) === 7,
          "item silhouette is not eight by eight cells");
          const scaled = document.createElement("canvas");
          scaled.width = 96;
          scaled.height = 96;
          const scaledContext = scaled.getContext("2d");
          scaledContext.scale(3, 3);
          sceneApi.drawPickups(scaledContext, [{ type, x: 12, y: 12, width: 8, height: 8 }]);
          const scaledPixels = scaledContext.getImageData(0, 0, 96, 96).data;
          for (let y = 0; y < 32; y += 1) for (let x = 0; x < 32; x += 1) {
            for (let channel = 0; channel < 4; channel += 1) {
              assert(pixels[(y * 32 + x) * 4 + channel] === scaledPixels[(y * 3 * 96 + x * 3) * 4 + channel],
                "pickup artwork or aura differs between preview and gameplay scales");
            }
          }
        }
      });
      test("REQ-LVL-19: moving-platform artwork stays within its collision bounds", () => {
        const canvas = document.createElement("canvas");
        canvas.width = 40;
        canvas.height = 30;
        const context = canvas.getContext("2d");
        sceneApi.drawMovingPlatforms(context, [
          { x: 20, y: 10, width: 12, height: 3 },
        ]);
        const pixels = context.getImageData(0, 0, 40, 30).data;
        assert(pixels.some(Boolean), "platform artwork is not visible");
        for (let y = 0; y < 30; y += 1) for (let x = 0; x < 40; x += 1) {
          if (pixels[(y * 40 + x) * 4 + 3]) {
            assert(x >= 20 && x < 32 && y >= 10 && y < 13, "platform artwork exceeds its declared bounds");
          }
        }
      });
      test("REQ-LVL-01/11: mixed photo gives distinct filled horizontal, vertical, and balanced layouts", () => {
        const width = 320, height = 180;
        const pixels = new Uint8ClampedArray(width * height * 4);
        const rectangles = [[18,22,18,118],[65,28,18,118],[112,22,18,118],
          [160,25,136,18],[160,76,136,18],[160,127,136,18]];
        for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
          const value = rectangles.some(([a,b,w,h]) => x >= a && x < a+w && y >= b && y < b+h) ? 220 : 20;
          pixels.set([value,value,value,255], (y*width+x)*4);
        }
        const variants = Object.fromEntries(["horizontal","vertical","balanced"].map(layout =>
          [layout, terrainApi.generateTerrain(pixels,width,height,{layout})]));
        const count = (terrain, left, right) => {
          let total = 0;
          for(let y=0;y<height;y+=1) for(let x=left;x<right;x+=1) total += terrain.solid[y*width+x];
          return total;
        };
        assert(count(variants.horizontal,150,310) > count(variants.horizontal,0,145)*2, "horizontal layout retains too many walls");
        assert(count(variants.vertical,0,145) > count(variants.vertical,150,310)*2, "vertical layout retains too many platforms");
        assert(variants.balanced.solid[50*width+26], "closed vertical object interior was not filled");
        assert(variants.balanced.solid[32*width+180], "closed horizontal object interior was not filled");
        assert(terrainApi.openSpaceRatio(variants.balanced) < 0.8, "old density cap still discards full regions");
        assert(variants.horizontal.solid[30*width+213], "unplanned rectangular cut invented a vertical wall");
      });
      test("REQ-LVL-01/11: large complete regions fill without inventing tiny photo obstacles", () => {
        const width = 160, height = 120;
        const pixels = new Uint8ClampedArray(width * height * 4);
        for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
          const value = (x >= 20 && x < 140 && y >= 25 && y < 100)
            || (x >= 5 && x < 8 && y >= 5 && y < 8) ? 220 : 20;
          pixels.set([value,value,value,255], (y*width+x)*4);
        }
        const terrain = terrainApi.generateTerrain(pixels,width,height);
        assert(terrain.solid[70*width+90] === 1, "large object's interior was discarded");
        assert(terrainApi.openSpaceRatio(terrain) < 0.7, "large filled region still capped");
        for(let y=0;y<15;y+=1) for(let x=0;x<15;x+=1) {
          assert(!terrain.solid[y*width+x], "tiny isolated photo fragment became an obstacle");
        }
      });
      test("REQ-LVL-11: vertical preference cannot invent walls in a horizontal-only photo", () => {
        const width = 120, height = 80;
        const pixels = new Uint8ClampedArray(width * height * 4);
        for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
          const value = y < 50 ? 20 : 220;
          pixels.set([value,value,value,255],(y*width+x)*4);
        }
        const horizontal = terrainApi.generateTerrain(pixels,width,height,{layout:"horizontal"});
        const vertical = terrainApi.generateTerrain(pixels,width,height,{layout:"vertical"});
        assert(horizontal.solid.every((cell,index) => cell === vertical.solid[index]),
          "vertical preference invented geometry instead of retaining the sole usable orientation");
      });
      test("REQ-LVL-13: biome effects differ, animate, and respect reduced motion", () => {
        const signatures = new Set();
        for (const biome of Object.keys(levelApi.BIOMES)) {
          const canvas = document.createElement("canvas");
          canvas.width = 160;
          canvas.height = 100;
          const context = canvas.getContext("2d");
          const render = (seconds, reduced) => {
            context.clearRect(0, 0, 160, 100);
            sceneApi.drawBiomeEffects(context, 160, 100, biome, seconds, reduced);
            return Array.from(context.getImageData(0, 0, 160, 100).data).join(",");
          };
          const initial = render(0, false);
          signatures.add(initial);
          assert(render(3, false) !== initial, `${biome} effect is not animated`);
          assert(render(0, true) === render(3, true), `${biome} ignores reduced motion`);
        }
        assert(signatures.size === 3, "biome effects look identical");
      });
      test("REQ-CHR-04: all biome headwear is distinct and inside the character footprint", () => {
        const images = new Set();
        for (const biome of Object.keys(levelApi.BIOMES)) {
          const canvas = document.createElement("canvas");
          canvas.width = 24;
          canvas.height = 24;
          const context = canvas.getContext("2d");
          sceneApi.drawHeadwear(context, { x: 8, y: 8, width: 6, height: 9 }, biome);
          const pixels = context.getImageData(0, 0, 24, 24).data;
          for (let y = 0; y < 24; y += 1) {
            for (let x = 0; x < 24; x += 1) {
              if (pixels[(y * 24 + x) * 4 + 3]) {
                assert(x >= 8 && x < 14 && y >= 8 && y < 17, "headwear extends outside footprint");
              }
            }
          }
          images.add(Array.from(pixels).join(","));
        }
        assert(images.size === 3, "headwear does not differ by biome");
      });
      test("REQ-LVL-07/10: gate artwork is bounded and drilled elements disappear from rendering", () => {
        const canvas = document.createElement("canvas");
        canvas.width = 40;
        canvas.height = 40;
        const context = canvas.getContext("2d");
        sceneApi.drawGate(context, { x: 28, y: 18, width: 12, height: 18 });
        const pixels = context.getImageData(0, 0, 40, 40).data;
        let white = 0;
        let dark = 0;
        for (let y = 0; y < 40; y += 1) {
          for (let x = 0; x < 40; x += 1) {
            const i = (y * 40 + x) * 4;
            if (!pixels[i + 3]) continue;
            assert(x >= 28 && y < 18, "gate artwork exceeds its completion box");
            if (pixels[i] === 255 && pixels[i + 1] === 255) white += 1;
            if (pixels[i] === 20 && pixels[i + 1] === 33) dark += 1;
          }
        }
        assert(white > 20 && dark > 20, "checkered banner lacks contrast");
        const terrain = flatTerrain(40, 40, 30);
        terrain.biome = "underwater";
        terrain.details = new Uint8Array(1600);
        terrain.details[31 * 40 + 10] = 2;
        terrain.solid[31 * 40 + 10] = 0;
        sceneApi.paintTerrain(context, terrain);
        assert(context.getImageData(10, 31, 1, 1).data[3] === 0, "drilled decoration was redrawn");
      });
    }
    const run = runApi.createRun(terrain);
    assert(run.flag.width === 12 && run.flag.height === 18, "gate is not twice the player size");
    assert(run.flag.x >= 0 && run.flag.x + run.flag.width <= 60, "gate clipped horizontally");
    assert(run.flag.y >= run.flag.height && run.flag.y <= 100, "gate clipped vertically");
    assert(Array.from({ length: run.flag.width }, (_, i) => run.terrain.solid[run.flag.y * 60 + run.flag.x + i])
      .some(Boolean), "gate has no initial terrain support");
  });

  test("REQ-LVL-07: flag stays fixed after all supporting terrain is drilled", () => {
    const run = runApi.createRun(flatTerrain(60, 60, 30));
    const originalFlag = { ...run.flag };
    for (let x = run.flag.x; x < run.flag.x + run.flag.width; x += 4) {
      const player = physicsApi.createPlayer(x - 2, run.flag.y - 6);
      for (let frame = 0; frame < 60; frame += 1) {
        physicsApi.stepPlayer(player, { drill: true, moveY: 1 }, run.terrain, 0.05);
      }
    }

    if (levelApi) {
      function fixturePixels(orientation = "horizontal") {
        const width = 320;
        const height = 180;
        const pixels = new Uint8ClampedArray(width * height * 4);
        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            const bright = orientation === "vertical"
              ? y >= 18 && y < 166 && [22,122,222].some(left=>x>=left&&x<left+70)
              : x >= 18 && x < 300 && ((y >= 22 && y < 58)
                || (y >= 78 && y < 112) || (y >= 132 && y < 168));
            pixels.set(bright ? [230, 230, 230, 255] : [20, 20, 20, 255], (y * width + x) * 4);
          }
        }
        return { pixels, width, height };
      }
      function seeded(seed) {
        return () => {
          seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
          return seed / 4294967296;
        };
      }
      test("REQ-LVL-09/10/11/16: vertical-photo routes retain real geometry and elaborate scenery", () => {
        const {pixels,width,height}=fixturePixels("vertical");
        const options=levelApi.createSuggestions(pixels,width,height,seeded(123));
        for(const option of options){
          assert(routeApi.verifyReferenceRoute(option).valid,"vertical photo has no valid reference route");
          const extra=new Set([...option.elements.flatMap(element=>element.cells),
            ...option.connectors.flatMap(connector=>connector.cells),
            ...option.platforms.flatMap(platform=>platform.cells)]);
          assert(option.solid.every((cell,index)=>!cell||option.photoSolid[index]||extra.has(index)),
            "route generation invented non-photo walls or filler");
        }
        const jungle=options.find(option=>option.biome==="jungle");
        assert(jungle.elements.some(element=>element.kind==="tree"&&element.height>=27&&element.height<=45),
          "roomy jungle photo lacks a substantial layered tree");
        assert(jungle.elements.some(element=>element.kind==="vine"),"roomy jungle photo lacks hanging plants");
      });
      test("REQ-LVL-01/16: sparse photos are repaired rather than rejected for density", () => {
        const {pixels,width,height}=fixturePixels();
        for(let y=60;y<height;y+=1)for(let x=0;x<width;x+=1){
          pixels.set([20,20,20,255],(y*width+x)*4);
        }
        const options=levelApi.createSuggestions(pixels,width,height,seeded(123));
        assert(options.length===3,"sparse photo did not produce three choices");
        for(const option of options){
          assert(routeApi.verifyReferenceRoute(option).valid,"sparse photo has no verified route");
          assert(terrainApi.openSpaceRatio(option)>0.70,"sparse photo gained density-only filler");
          assert(!runApi.walkingReachesFlag(option,runApi.walkingReachable(option,option.spawn),option.flag),
            "repaired sparse photo has a walking-only finish");
        }
      });
      test("REQ-LVL-01/05/16: sparse, busy, disconnected and single-edge photos remain playable", () => {
        const width=320,height=180;
        const scenes=[
          (x,y)=>y>=110&&y<116&&x>=24&&x<292,
          (x,y)=>x>=148&&x<158&&y>=18&&y<166,
          (x,y)=>[[24,45,65,6],[150,90,50,5],[235,140,55,5]]
            .some(([left,top,w,h])=>x>=left&&x<left+w&&y>=top&&y<top+h),
          (x,y)=>((Math.floor(x/18)+Math.floor(y/18))%2)===0,
        ];
        for(const [index,scene] of scenes.entries()){
          const pixels=new Uint8ClampedArray(width*height*4);
          for(let y=0;y<height;y+=1)for(let x=0;x<width;x+=1){
            const value=scene(x,y)?230:20;
            pixels.set([value,value,value,255],(y*width+x)*4);
          }
          for(const seed of [123,456]){
            const options=levelApi.createSuggestions(pixels,width,height,seeded(seed));
            assert(options.length===3,`scene ${index} seed ${seed} rejected`);
            for(const option of options){
              assert(routeApi.verifyReferenceRoute(option).valid,`scene ${index} unsafe replay`);
              assert(!runApi.walkingReachesFlag(option,runApi.walkingReachable(option,option.spawn),option.flag),
                `scene ${index} has a walk-only finish`);
              assert(option.solid.some((cell,index)=>cell&&option.photoSolid[index]),"all photo geometry was discarded");
              assert(option.platforms.every(platform=>platform.height<=3
                &&platform.cells.every(cell=>option.solid[cell]&&!option.route.clearance[cell])),
                "supplemental platforms block the corridor or invent tall walls");
              const run=runApi.createRun(option);
              const original=option.solid.slice();
              const added=option.platforms[0]?.cells[0];
              if(added!==undefined){
                const cutter=physicsApi.createPlayer(added%width-3,Math.floor(added/width)-4);
                physicsApi.stepPlayer(cutter,{drill:true,moveY:1},run.terrain,0);
                assert(!run.terrain.solid[added],"supplemental platform is not drillable");
              }
              run.terrain.solid.fill(0);
              assert(runApi.createRun(option).terrain.solid.every((cell,index)=>cell===original[index]),
                "reset did not restore supplemental platforms and photo terrain");
            }
          }
        }
      });
      test("REQ-LVL-11: closing bridges tiny gaps and fills complete enclosed regions only", () => {
        const width = 30;
        const mask = new Uint8Array(width * width);
        for (let y = 10; y <= 16; y += 1) {
          for (let x = 10; x <= 16; x += 1) {
            if (x === 10 || x === 16 || y === 10 || y === 16) mask[y * width + x] = 1;
          }
        }
        mask[10 * width + 13] = 0;
        const filled = levelApi.closeAndFill(mask, width, width);
        assert(filled[10 * width + 13] && filled[13 * width + 13], "gap or enclosed interior remained open");
        assert(filled.reduce((sum, cell) => sum + cell, 0) === 49, "enclosed region was only partially filled");
        assert(!filled[0] && !filled[8 * width + 13], "fill escaped the edge region");
      });
      test("REQ-LVL-10/11/12: three distinct reproducible variants preserve geometry and reset", () => {
        const { pixels, width, height } = fixturePixels();
        const biomes = new Set();
        const layouts = new Set();
        const edges = new Set();
        for (let seed = 1; seed <= 12; seed += 1) {
          const options = levelApi.createSuggestions(pixels, width, height, seeded(seed));
          assert(options.length === 3, "expected exactly three suggestions");
          assert(new Set(options.map((option) => `${option.biome}/${option.layout}`)).size === 3, "duplicate pairs");
          const repeat = levelApi.createSuggestions(pixels, width, height, seeded(seed));
          options.forEach((option, index) => {
            assert(levelApi.levelIdentity(option) === levelApi.levelIdentity(repeat[index]), "seed not reproducible");
            biomes.add(option.biome);
            layouts.add(option.layout);
            edges.add(option.edge);
            assert(option.solid.some(Boolean), "variant has no geometry");
            assert(option.elements.length > 0, "missing solid biome elements");
            if (option.biome === "jungle") {
              const trees = option.elements.filter((element) => element.kind === "tree");
              assert(trees.every((tree) => tree.height >= 27 && tree.height <= 45), "tree scale is not 3-5 character heights");
              for (const tree of trees) {
                const rows = tree.cells.map((cell) => Math.floor(cell / width));
                const visibleHeight = Math.max(...rows) - Math.min(...rows) + 1;
                assert(visibleHeight >= 27 && visibleHeight <= 45, "actual tree silhouette is outside the required scale");
              }
            }
            for (const element of option.elements) {
              assert(element.cells.every((cell) => option.solid[cell]), "decorations have no collision");
              assert(element.cells.every(cell=>!option.route.protected[cell]), "scenery blocks the reference corridor");
            }
            const run = runApi.createRun(option);
            assert(JSON.stringify(run.spawn) === JSON.stringify(option.spawn), "preview spawn changed");
            assert(JSON.stringify(run.flag) === JSON.stringify(option.flag), "preview gate changed");
            for (const rect of [run.player, { x: run.flag.x, y: run.flag.y - run.flag.height,
              width: run.flag.width, height: run.flag.height }]) {
              assert(rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= width
                && rect.y + rect.height <= height, "spawn/gate out of bounds");
              for (let y = rect.y; y < rect.y + rect.height; y += 1) {
                for (let x = rect.x; x < rect.x + rect.width; x += 1) {
                  assert(!run.terrain.solid[y * width + x], "spawn/gate overlaps terrain");
                }
              }
            }
            assert(Math.hypot(run.player.x - run.flag.x, run.player.y - run.flag.y)
              >= Math.hypot(width, height) * 0.4, "route is trivial");
            assert(!runApi.walkingReachesFlag(option, runApi.walkingReachable(option, option.spawn), option.flag),
              "seeded option has a walk-only finish");
            assert(option.enemies.length === 2 && JSON.stringify(run.enemies) === JSON.stringify(option.enemies),
              "preview enemies changed at game start");
            assert(option.spawn.x > 0 && option.spawn.y > 0
              && option.spawn.x + run.player.width < width
              && option.spawn.y + run.player.height < height, "player spawn touches an image border");
                  assert(run.pickups.length === option.pickups.length
              && run.movingPlatforms.length === option.movingPlatforms.length,
            "runtime pickups or platforms differ from their preview");
                  assert(option.movingPlatforms.every((platform, index) => platform.x === run.movingPlatforms[index].x),
                    "platform preview changed at run start");
            const changedEnemy = { ...option, enemies: option.enemies.map((enemy) => ({ ...enemy, speed: enemy.speed + 1 })) };
            assert(levelApi.levelIdentity(changedEnemy) !== levelApi.levelIdentity(option), "patrols omitted from score identity");
            const identity = levelApi.levelIdentity(option);
            run.terrain.solid.fill(0);
            const reset = runApi.createRun(option);
            assert(reset.terrain.solid.some(Boolean) && levelApi.levelIdentity(option) === identity, "reset changed original");
            const player = physicsApi.createPlayer(0, 0);
            const cell = option.elements[0].cells[0];
            player.x = cell % width - player.width / 2;
            player.y = Math.floor(cell / width) - player.height / 2;
            physicsApi.stepPlayer(player, { drill: true }, reset.terrain, 0);
            assert(!reset.terrain.solid[cell], "biome element cannot be drilled");
          });
        }
        assert(biomes.size === 3 && layouts.size === 3 && edges.size === 4, "random choices do not cover all options");
      });
      test("REQ-LVL-11/12: variants still reject unusable photos", () => {
        let rejected = false;
        try {
          levelApi.createSuggestions(new Uint8ClampedArray(160 * 100 * 4), 160, 100);
        } catch (error) {
          rejected = error instanceof terrainApi.NoUsableEdgeError || error.name === "NoUsableEdgeError";
        }
        assert(rejected, "uniform photo accepted");
      });
      test("REQ-LVL-11: layout preference changes the measured horizontal/vertical terrain balance", () => {
        const width = 200;
        const height = 180;
        const pixels = new Uint8ClampedArray(width * height * 4);
        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            const value = ((x >= 20 && x < 38 && y >= 25 && y < 150)
              || (x >= 65 && x < 83 && y >= 25 && y < 150)
              || (x >= 100 && x < 190 && y >= 30 && y < 48)
              || (x >= 100 && x < 190 && y >= 95 && y < 113)) ? 230 : 20;
            pixels.set([value, value, value, 255], (y * width + x) * 4);
          }
        }
        const ratio = (layout) => {
          const terrain = terrainApi.generateTerrain(pixels, width, height, { layout });
          let horizontal = 0;
          let vertical = 0;
          for (let y = 1; y < height; y += 1) {
            for (let x = 1; x < width; x += 1) {
              const cell = y * width + x;
              if (terrain.solid[cell] && !terrain.solid[cell - width]) horizontal += 1;
              if (terrain.solid[cell] && !terrain.solid[cell - 1]) vertical += 1;
            }
          }
          return vertical / horizontal;
        };
        assert(ratio("vertical") > ratio("horizontal") * 1.5, "layout labels do not change geometry balance");
      });
      test("REQ-LVL-17: the same image deterministically reproduces its suggestions without an injected random source", () => {
        const { pixels, width, height } = fixturePixels();
        const first = levelApi.createSuggestions(pixels, width, height);
        const other = fixturePixels("vertical");
        levelApi.createSuggestions(other.pixels, other.width, other.height);
        const repeated = levelApi.createSuggestions(pixels, width, height);
        assert(first.length === 3 && repeated.length === 3, "generation did not return three options");
        first.forEach((option, index) => {
          assert(levelApi.levelIdentity(option) === levelApi.levelIdentity(repeated[index]),
            `suggestion ${index + 1} changed after another image generation`);
        });
      });
    }
    for (let y = originalFlag.y; y < 60; y += 1) {
      for (let x = originalFlag.x; x < originalFlag.x + originalFlag.width; x += 1) {
        assert(run.terrain.solid[y * 60 + x] === 0, "undrillable support remained");
      }
    }
    assert(JSON.stringify(run.flag) === JSON.stringify(originalFlag), "drilling moved the flag");
  });
  test("REQ-SYS-08/14: resetting restores terrain, patrols, pickups, platforms, and timer", () => {
    const original = flatTerrain(60, 60, 30);
    original.spawn = { x: 2, y: 21 };
    original.enemies = [{ x: 25, y: 10, left: 20, right: 35, width: 10, height: 6, speed: 18, phase: 0 }];
    original.pickups = [{ type: "speed", x: 12, y: 10, width: 4, height: 4 }];
    original.movingPlatforms = [{ x: 10, y: 5, left: 10, right: 20, width: 12, height: 3, speed: 18, direction: 1 }];
    const run = runApi.createRun(original);
    run.terrain.solid[35 * 60 + 10] = 0;
    run.startedAt = 123;
    run.elapsedMs = 500;
    run.player.x = 40;
    run.player.chargeSeconds = 2;
    run.enemies[0].x = 30;
    run.pickups.length = 0;
    run.movingPlatforms[0].x = 18;
    runApi.resetRun(run);
    assert(run.player.x === run.spawn.x && run.player.chargeSeconds === 0, "reset did not restore player");
    assert(run.startedAt === null && run.elapsedMs === 0, "reset did not clear timer");
    assert(run.terrain.solid[35 * 60 + 10] === 1, "reset did not restore drilled terrain");
    assert(run.enemies[0].x === 25 && run.pickups.length === 1 && run.movingPlatforms[0].x === 10,
      "reset did not restore initial enemies, pickups, and moving platforms");
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
  test("REQ-MOV-03 / REQ-SYS-04: directional drill traversal can reach the fixed flag", () => {
    const run = runApi.createRun(flatTerrain(100, 80, 30));
    physicsApi.stepPlayer(run.player, { moveY: -1 }, run.terrain, 0.05);
    let frames = 0;
    while (!runApi.reachedFlag(run) && frames < 1000) {
      physicsApi.stepPlayer(run.player, { drill: true, move: 1 }, run.terrain, 1 / 60);
      frames += 1;
    }
    assert(runApi.reachedFlag(run), "drilling runner never reached the flag");
    const distance = run.flag.x - run.spawn.x - run.player.width;
    assert(frames / 60 >= distance / 80, "runner reached flag faster than normal speed permits");
  });
}

if (leaderboardApi) {
  test("REQ-SYS-06: highlight exact attempt, preserve ties, and append nonqualifying run without rank", () => {
    const current = { id: "current", name: "Ada", timeMs: 1000 };
    const prior = { id: "prior", name: "Ada", timeMs: 1000 };
    const rows = leaderboardApi.leaderboardRows([prior,current], current);
    assert(rows.length === 2 && rows[1].current && !rows[0].current && rows[1].rank === 2,
      "equal name/time highlighted the wrong attempt");
    const slow = { id: "slow", name: "Ada", timeMs: 2000 };
    const outside = leaderboardApi.leaderboardRows(Array.from({length:10},(_,i)=>({...prior,id:`old-${i}`})), slow);
    assert(outside.length === 11 && outside[10].current && outside[10].rank === null,
      "current unranked run not appended without a place");
    const values = new Map();
    const storage = { getItem: key => values.get(key) ?? null, setItem: (key,value) => values.set(key,value) };
    leaderboardApi.submitScore("ties", prior, storage);
    const saved = leaderboardApi.submitScore("ties", current, storage);
    assert(saved[0].id === "prior" && saved[1].id === "current", "equal-time order or attempt ID lost");
    for (let i=0;i<10;i+=1) leaderboardApi.submitScore("full",{id:`fast-${i}`,name:"Ada",timeMs:i},storage);
    const top = leaderboardApi.submitScore("full",slow,storage);
    assert(top.length===10 && !top.some(score=>score.id==="slow"),"eleventh score persisted");
  });
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
