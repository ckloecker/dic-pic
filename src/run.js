import { createPlayer, stepPlayer } from "./physics.js";

function walkingSpace(terrain) {
  const { width, height, solid } = terrain;
  const clear = new Uint8Array(width * height);
  for (let y = 0; y <= height - 9; y += 1) {
    let blocked = 0;
    const columns = new Uint8Array(width);
    for (let x = 0; x < width; x += 1) {
      for (let row = y; row < y + 9; row += 1) columns[x] += solid[row * width + x];
      blocked += columns[x];
      if (x >= 6) blocked -= columns[x - 6];
      if (x >= 5 && !blocked) clear[y * width + x - 5] = 1;
    }
  }
  // Clear rows conservatively allow lateral drift during falls and share one graph node.
  const groups = new Int32Array(clear.length).fill(-1);
  for (let y = 0; y < height; y += 1) {
    let group = -1;
    for (let x = 0; x < width; x += 1) {
      const cell = y * width + x;
      if (!clear[cell]) group = -1;
      else {
        if (group < 0) group = cell;
        groups[cell] = group;
      }
    }
  }
  const links = new Map();
  for (let cell = 0; cell < clear.length; cell += 1) {
    if (!clear[cell]) continue;
    const group = groups[cell];
    if (!links.has(group)) links.set(group, new Set());
    const targets = links.get(group);
    if (clear[cell + width]) targets.add(groups[cell + width]);
    const x = cell % width;
    const y = Math.floor(cell / width);
    for (const move of [-1, 1]) {
      const nextX = x + move;
      if (nextX < 0 || nextX > width - 6 || clear[cell + move]) continue;
      const player = createPlayer(x, y);
      stepPlayer(player, { move }, terrain, 1 / 80);
      for (const nextY of [Math.floor(player.y), Math.ceil(player.y)]) {
        const next = nextY * width + Math.round(player.x);
        if (clear[next]) targets.add(groups[next]);
      }
    }
  }
  return { clear, groups, links };
}

export function walkingReachable(terrain, spawn, space = walkingSpace(terrain)) {
  const { width, height } = terrain;
  const { groups, links } = space;
  const start = groups[Math.round(spawn.y) * width + Math.round(spawn.x)];
  if (start === undefined || start < 0) throw new RangeError("Walking validation requires a clear in-bounds spawn.");
  const visited = new Set([start]);
  const queue = [start];
  for (let head = 0; head < queue.length; head += 1) {
    for (const next of links.get(queue[head])) {
      if (visited.has(next)) continue;
      visited.add(next);
      queue.push(next);
    }
  }
  const reachable = new Uint8Array(width * height);
  for (let cell = 0; cell < reachable.length; cell += 1) {
    if (groups[cell] >= 0 && visited.has(groups[cell])) reachable[cell] = 1;
  }
  return reachable;
}

export function walkingReachesFlag(terrain, reachable, flag) {
  for (let y = Math.max(0, flag.y - flag.height - 8); y < flag.y; y += 1) {
    for (let x = Math.max(0, flag.x - 5); x < flag.x + flag.width; x += 1) {
      if (reachable[y * terrain.width + x]) return true;
    }
  }
  return false;
}

function supportedPositions(terrain, width, height) {
  const positions = [];
  for (let x = 0; x <= terrain.width - width; x += 1) {
    for (let floor = height; floor <= terrain.height; floor += 1) {
      let supported = floor === terrain.height;
      let clear = true;
      for (let column = x; column < x + width; column += 1) {
        if (terrain.solid[floor * terrain.width + column]) supported = true;
        for (let row = floor - height; row < floor; row += 1) {
          if (terrain.solid[row * terrain.width + column]) {
            clear = false;
            break;
          }
        }
        if (!clear) break;
      }
      if (supported && clear) positions.push({ x, y: floor - height });
    }
  }
  return positions;
}

export function placeRun(terrain, edge = "right", random = () => 0) {
  const gates = supportedPositions(terrain, 12, 18);
  const starts = supportedPositions(terrain, 6, 9).filter((start) => (
    start.x > 0 && start.y > 0
      && start.x + 6 < terrain.width
      && start.y + 9 < terrain.height
  ));
  if (!gates.length || !starts.length) {
    throw new Error("No safe starting position or finish gate fits. Please choose another photo.");
  }
  const edgeDistance = (gate, side) => {
    if (side === "left") return gate.x;
    if (side === "top") return gate.y;
    if (side === "bottom") return terrain.height - gate.y - 18;
    return terrain.width - gate.x - 12;
  };
  const minimumDistance = Math.hypot(terrain.width, terrain.height) * 0.4;
  const space = walkingSpace(terrain);
  const reachability = new Map();
  const visits = [];
  for (const side of [edge, ...["left", "top", "bottom", "right"].filter((value) => value !== edge)]) {
    gates.sort((a, b) => edgeDistance(a, side) - edgeDistance(b, side));
    const nearest = edgeDistance(gates[0], side);
    const candidates = gates.filter((gate) => edgeDistance(gate, side) <= nearest + 3);
    const offset = Math.floor(random() * candidates.length);
    for (let index = 0; index < candidates.length; index += 1) {
      visits.push({ gate: candidates[(index + offset) % candidates.length], side });
    }
  }
  gates.sort((a, b) => edgeDistance(a, edge) - edgeDistance(b, edge));
  visits.push(...gates.map((gate) => ({ gate, side: edge })));
  const visitedGates = new Set();
  for (const { gate, side } of visits) {
    const gateKey = gate.y * terrain.width + gate.x;
    if (visitedGates.has(gateKey)) continue;
    visitedGates.add(gateKey);
    const flag = { x: gate.x, y: gate.y + 18, width: 12, height: 18 };
    const distance = (start) => Math.hypot(start.x + 3 - gate.x - 6, start.y + 4.5 - gate.y - 9);
    starts.sort((a, b) => distance(b) - distance(a));
    const seenGroups = new Set();
    for (const spawn of starts) {
    if (distance(spawn) < minimumDistance) break;
    const key = space.groups[spawn.y * terrain.width + spawn.x];
    if (seenGroups.has(key)) continue;
    seenGroups.add(key);
    if (!reachability.has(key)) reachability.set(key, walkingReachable(terrain, spawn, space));
    if (!walkingReachesFlag(terrain, reachability.get(key), flag)) {
      return { spawn: { ...spawn }, flag, edge: side };
    }
    }
  }
  throw new Error("No safe non-walking route could be generated: all suitable placements are walk-only or too close. Please choose another photo.");
}

export function createRun(original) {
  const terrain = {
    ...original,
    solid: original.solid.slice(),
    surfaceY: original.surfaceY.slice(),
    version: 0,
  };
  const placement = original.spawn && original.flag ? original : placeRun(terrain);
  const spawn = { ...placement.spawn };
  const flag = { ...placement.flag };
  const run = {
    originalTerrain: original,
    terrain,
    spawn,
    flag,
    player: createPlayer(spawn.x, spawn.y),
    enemies: (original.enemies || []).map((enemy) => ({ ...enemy })),
    pickups: (original.pickups || []).map((pickup) => ({ ...pickup })),
    movingPlatforms: (original.movingPlatforms || []).map((platform) => ({ ...platform })),
    effects: { speedSeconds: 0, reverseSeconds: 0 },
    startedAt: null,
    elapsedMs: 0,
  };
  terrain.pickups = run.pickups;
  terrain.movingPlatforms = run.movingPlatforms;
  return run;
}

export function resetRun(run) {
  const fresh = createRun(run.originalTerrain);
  Object.assign(run, fresh);
  return run;
}

export function collectPickups(run) {
  let collected = false;
  const collectedTypes = new Set();
  const remaining = [];
  for (const pickup of run.pickups) {
    const overlaps = run.player.x < pickup.x + pickup.width
      && run.player.x + run.player.width > pickup.x
      && run.player.y < pickup.y + pickup.height
      && run.player.y + run.player.height > pickup.y;
    if (!overlaps || collectedTypes.has(pickup.type)) {
      remaining.push(pickup);
      continue;
    }
    const effect = pickup.type === "speed" ? "speedSeconds"
      : pickup.type === "reverse" ? "reverseSeconds" : null;
    if (!effect) {
      remaining.push(pickup);
      continue;
    }
    run.effects[effect] = 5;
    collectedTypes.add(pickup.type);
    collected = true;
  }
  if (collected) {
    run.pickups = remaining;
    run.terrain.pickups = remaining;
  }
  return collected;
}

export function stepRunEffects(run, dt) {
  if (!Number.isFinite(dt) || dt < 0) {
    throw new RangeError("Effect duration must be a non-negative number.");
  }
  run.effects.speedSeconds = Math.max(0, run.effects.speedSeconds - dt);
  run.effects.reverseSeconds = Math.max(0, run.effects.reverseSeconds - dt);
}

export function applyRunEffects(input, run) {
  const adjusted = { ...input };
  if (run.effects.reverseSeconds > 0) {
    adjusted.move = -Math.sign(adjusted.move || 0);
    adjusted.moveY = -Math.sign(adjusted.moveY || 0);
  }
  if (run.effects.speedSeconds > 0) adjusted.speedMultiplier = 2;
  return adjusted;
}

function clearPlatformPath(run, platform, x) {
  const { terrain } = run;
  if (x < 0 || x + platform.width > terrain.width) return false;
  for (let y = platform.y; y < platform.y + platform.height; y += 1) {
    for (let column = x; column < x + platform.width; column += 1) {
      const cell = y * terrain.width + column;
      if (terrain.solid[cell] || terrain.route?.protected[cell]) return false;
    }
  }
  return true;
}

export function stepMovingPlatforms(run, dt) {
  if (!Number.isFinite(dt) || dt < 0) {
    throw new RangeError("Platform frame duration must be a non-negative number.");
  }
  const player = run.player;
  for (const platform of run.movingPlatforms) {
    const previousX = platform.x;
    const supported = player.grounded
      && Math.abs(player.y + player.height - platform.y) < 1e-6
      && player.x + player.width > previousX
      && player.x < previousX + platform.width;
    if (platform.direction > 0 && platform.expandRight !== false
      && clearPlatformPath(run, platform, platform.right + 1)) {
      platform.right += 1;
    } else if (platform.direction < 0 && platform.expandLeft !== false
      && clearPlatformPath(run, platform, platform.left - 1)) {
      platform.left -= 1;
    }
    let remaining = platform.speed * dt;
    while (remaining > 1e-9 && platform.right > platform.left) {
      const boundary = platform.direction > 0 ? platform.right : platform.left;
      const distance = Math.abs(boundary - platform.x);
      if (distance <= 1e-9) {
        platform.direction *= -1;
        continue;
      }
      const travel = Math.min(remaining, distance);
      platform.x += platform.direction * travel;
      remaining -= travel;
      if (travel >= distance - 1e-9) platform.direction *= -1;
    }
    if (supported) player.x += platform.x - previousX;
  }
}

export function respawnPlayer(run) {
  run.player = createPlayer(run.spawn.x, run.spawn.y);
}

export function reachedFlag({ player, flag }) {
  return player.x + player.width > flag.x
    && player.x < flag.x + flag.width
    && player.y + player.height > flag.y - flag.height
    && player.y < flag.y;
}
