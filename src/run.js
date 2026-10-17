import { createPlayer, findSpawnY } from "./physics.js";

function platformSpawn(terrain, fromRight) {
  const player = createPlayer(0, 0);
  const lastX = terrain.width - player.width;
  for (let offset = 1; offset < lastX; offset += 1) {
    const x = fromRight ? lastX - offset : offset;
    for (let y = player.height + 1; y < terrain.height; y += 1) {
      let supported = true;
      let clear = true;
      for (let column = x; column < x + player.width; column += 1) {
        if (!terrain.solid[y * terrain.width + column]) supported = false;
        for (let row = y - player.height; row < y; row += 1) {
          if (terrain.solid[row * terrain.width + column]) clear = false;
        }
      }
      if (supported && clear) return { x, y: y - player.height };
    }
  }
  // Sloping traces can support the footprint without a perfectly flat top.
  for (let offset = 1; offset < lastX; offset += 1) {
    const x = fromRight ? lastX - offset : offset;
    const surfaces = Array.from(terrain.surfaceY.slice(x, x + player.width));
    if (surfaces.every((value) => value < terrain.height)) {
      return { x, y: findSpawnY(terrain, x, player.width, player.height) };
    }
  }
  throw new Error("No safe starting platform was found. Please choose another photo.");
}

export function createRun(original) {
  const terrain = {
    ...original,
    solid: original.solid.slice(),
    surfaceY: original.surfaceY.slice(),
    version: 0,
  };
  const spawn = platformSpawn(terrain, false);
  const goal = platformSpawn(terrain, true);
  const player = createPlayer(spawn.x, spawn.y);
  const flag = { x: goal.x + 2, y: goal.y + player.height, width: 5, height: 25 };
  while (!terrain.solid[flag.y * terrain.width + flag.x + 1] && flag.y < terrain.height - 1) {
    flag.y += 1;
  }
  const run = {
    terrain,
    spawn,
    flag,
    player,
    startedAt: null,
    elapsedMs: 0,
  };
  return run;
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
