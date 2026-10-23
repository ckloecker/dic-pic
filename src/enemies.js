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
  const clearCell = (x, y) => {
    const cell = y * width + x;
    return !solid[cell] && !level.route?.clearance[cell]
      && !protectedAreas.some(area => overlaps({ x, y, width: 1, height: 1 }, area, 12))
      && !(level.movingPlatforms || []).some(platform => overlaps({ x, y, width: 1, height: 1 },
        { x: platform.left, y: platform.y,
          width: platform.right - platform.left + platform.width, height: platform.height }));
  };
  for (let y = 2; y <= height - enemyHeight - 2; y += 4) {
    let left = -1;
    for (let x = 2; x <= width - 2; x += 1) {
      let clear = x < width - 2;
      for (let row = 0; clear && row < enemyHeight; row += 1) {
        if (!clearCell(x, y + row)) clear = false;
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
    while (swept.height < 18 && swept.y + swept.height < height - 2) {
      let clear = true;
      for (let x = swept.x; clear && x < swept.x + swept.width; x += 1) {
        clear = clearCell(x, swept.y + swept.height);
      }
      if (!clear) break;
      swept.height += 1;
    }
    if (swept.height < enemyHeight + 4) continue;
    if (enemies.some((enemy) => overlaps(swept,
      { x: enemy.left, y: enemy.top, width: enemy.right - enemy.left + enemy.width,
        height: enemy.bottom - enemy.top + enemy.height }, 12))) continue;
    const top = swept.y;
    const bottom = top + swept.height - enemyHeight;
    const span = right - corridor.x;
    const path = [
      { x: corridor.x, y: top + random() * (bottom - top) },
      { x: corridor.x + span * (0.2 + random() * 0.2), y: top },
      { x: right, y: bottom },
      { x: corridor.x + span * (0.5 + random() * 0.2), y: top + random() * (bottom - top) },
    ];
    enemies.push({ ...path[0], left: corridor.x, right, top, bottom, path,
      width: enemyWidth, height: enemyHeight, speed: 18, phase: 0 });
  }
  if (enemies.length !== 2) {
    throw new EnemyPlacementError("Two safe flying patrol corridors could not fit. Please choose another photo.");
  }
  return enemies;
}

export function stepEnemies(enemies, dt) {
  if (!Number.isFinite(dt) || dt < 0) throw new RangeError("Enemy frame duration must be non-negative.");
  for (const enemy of enemies) {
    if (enemy.path) {
      stepFlyingPath(enemy, dt);
      continue;
    }
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

function stepFlyingPath(enemy, dt) {
  const segments = enemy.path.map((from, index) => {
    const to = enemy.path[(index + 1) % enemy.path.length];
    return { from, to, length: Math.hypot(to.x - from.x, to.y - from.y) };
  });
  const length = segments.reduce((sum, segment) => sum + segment.length, 0);
  if (!Number.isFinite(length) || length <= 0 || segments.some(segment => segment.length <= 0)) {
    throw new RangeError("Enemy flight paths must contain distinct consecutive waypoints.");
  }
  const distance = enemy.speed * dt;
  let offset = enemy.phase % length;
  let index = 0;
  while (offset >= segments[index].length) {
    offset -= segments[index].length;
    index += 1;
  }
  let traveled = 0;
  enemy.sweeps = [];
  while (traveled < distance) {
    const segment = segments[index];
    const remaining = segment.length - offset;
    const step = Math.min(distance - traveled, remaining);
    const x = segment.from.x + (segment.to.x - segment.from.x) * offset / segment.length;
    const y = segment.from.y + (segment.to.y - segment.from.y) * offset / segment.length;
    enemy.x = segment.from.x + (segment.to.x - segment.from.x) * (offset + step) / segment.length;
    enemy.y = segment.from.y + (segment.to.y - segment.from.y) * (offset + step) / segment.length;
    enemy.sweeps.push({ from: x, to: enemy.x, fromY: y, toY: enemy.y,
      start: traveled / distance, end: (traveled + step) / distance });
    traveled += step;
    if (step === remaining) {
      index = (index + 1) % segments.length;
      offset = 0;
    } else {
      offset += step;
    }
  }
  enemy.phase = (enemy.phase + distance) % length;
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
  const fromY = sweep.fromY ?? enemy.y;
  const toY = sweep.toY ?? enemy.y;
  const startY = previous.y + (player.y - previous.y) * sweep.start - fromY;
  const dx = (player.x - previous.x) * (sweep.end - sweep.start) - sweep.to + sweep.from;
  const dy = (player.y - previous.y) * (sweep.end - sweep.start) - toY + fromY;
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
