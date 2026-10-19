export class EnemyPlacementError extends Error {}

function overlaps(a, b, margin = 0) {
  return a.x < b.x + b.width + margin && a.x + a.width > b.x - margin
    && a.y < b.y + b.height + margin && a.y + a.height > b.y - margin;
}

export function createEnemies(level, random = Math.random) {
  const { width, height, solid, spawn, flag } = level;
  const protectedAreas = [
    { ...spawn, width: 6, height: 9 },
    { ...flag, y: flag.y - flag.height },
  ];
  const candidates = [];
  const enemyWidth = 10;
  const enemyHeight = 6;
  for (let y = 2; y <= height - enemyHeight - 2; y += 4) {
    let left = -1;
    for (let x = 2; x <= width - 2; x += 1) {
      let clear = x < width - 2
        && !protectedAreas.some((area) => overlaps({ x, y, width: 1, height: enemyHeight }, area, 12));
      for (let row = 0; clear && row < enemyHeight; row += 1) {
        const cell = (y + row) * width + x;
        if (solid[cell] || level.route?.clearance[cell]) clear = false;
      }
      if (clear && left < 0) left = x;
      if (!clear && left >= 0) {
        if (x - left >= 24 + enemyWidth) {
          candidates.push({ x: left, y, width: x - left, height: enemyHeight });
        }
        left = -1;
      }
    }
  }
  const enemies = [];
  while (enemies.length < 2 && candidates.length) {
    const index = Math.floor(random() * candidates.length);
    const corridor = candidates.splice(index, 1)[0];
    const right = corridor.x + Math.min(corridor.width, 58) - enemyWidth;
    const swept = { ...corridor, width: right - corridor.x + enemyWidth };
    if (enemies.some((enemy) => overlaps(swept,
      { x: enemy.left, y: enemy.y, width: enemy.right - enemy.left + enemy.width, height: enemy.height }, 12))) continue;
    const phase = random() * (right - corridor.x);
    enemies.push({ x: corridor.x + phase, y: corridor.y, left: corridor.x, right,
      width: enemyWidth, height: enemyHeight, speed: 18, phase });
  }
  if (enemies.length !== 2) {
    throw new EnemyPlacementError("Two safe flying patrol corridors could not fit. Please choose another photo.");
  }
  return enemies;
}

export function stepEnemies(enemies, dt) {
  if (!Number.isFinite(dt) || dt < 0) throw new RangeError("Enemy frame duration must be non-negative.");
  for (const enemy of enemies) {
    const span = enemy.right - enemy.left;
    const distance = enemy.speed * dt;
    enemy.sweeps = [];
    let traveled = 0;
    let phase = enemy.phase;
    while (traveled < distance) {
      const forward = phase < span;
      const remaining = forward ? span - phase : span * 2 - phase;
      const step = Math.min(distance - traveled, remaining);
      const from = enemy.left + (forward ? phase : span * 2 - phase);
      enemy.sweeps.push({ from, to: from + (forward ? step : -step),
        start: traveled / distance, end: (traveled + step) / distance });
      traveled += step;
      phase = step === remaining ? (forward ? span : 0) : phase + step;
    }
    enemy.phase = (enemy.phase + enemy.speed * dt) % (span * 2);
    enemy.x = enemy.left + (enemy.phase <= span ? enemy.phase : span * 2 - enemy.phase);
  }
}

export function enemyContact(player, enemies, previous = player) {
  return enemies.some((enemy) => {
    const sweeps = enemy.sweeps?.length ? enemy.sweeps
      : [{ from: enemy.x, to: enemy.x, start: 0, end: 1 }];
    return sweeps.some((sweep) => sweptContact(player, previous, enemy, sweep));
  });
}

function sweptContact(player, previous, enemy, sweep) {
  const startX = previous.x + (player.x - previous.x) * sweep.start - sweep.from;
  const startY = previous.y + (player.y - previous.y) * sweep.start - enemy.y;
  const dx = (player.x - previous.x) * (sweep.end - sweep.start) - sweep.to + sweep.from;
  const dy = (player.y - previous.y) * (sweep.end - sweep.start);
  let enter = 0;
  let leave = 1;
  for (const [start, delta, minimum, maximum] of [
    [startX, dx, -player.width, enemy.width],
    [startY, dy, -player.height, enemy.height],
  ]) {
    if (delta === 0) {
      if (start <= minimum || start >= maximum) return false;
    } else {
      const a = (minimum - start) / delta;
      const b = (maximum - start) / delta;
      enter = Math.max(enter, Math.min(a, b));
      leave = Math.min(leave, Math.max(a, b));
      if (enter >= leave) return false;
    }
  }
  return enter < leave;
}
