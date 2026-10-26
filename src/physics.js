const NORMAL_SPEED = 80;
const CLIMB_SPEED = NORMAL_SPEED / 4;
export const GRAVITY = 420;
const JUMP_VELOCITY = -180;
const PLAYER_WIDTH = 6;
const PLAYER_HEIGHT = 9;
const CONTACT_DISTANCE = 3;
const JUMP_BUFFER_SECONDS = 0.15;
const FLOOR_GRACE_DISTANCE = 3;
const WALL_GRACE_DISTANCE = 4;
export const DRILL_REACH = 10;

export function createPlayer(x, y) {
  return {
    x,
    y,
    width: PLAYER_WIDTH,
    height: PLAYER_HEIGHT,
    vx: 0,
    vy: 0,
    grounded: false,
    facing: 1,
    airJumps: 1,
    jumpKind: null,
    jumpWallSide: 0,
    jumpX: x,
    jumpY: y,
    drilling: false,
    excavating: false,
    drillX: 1,
    drillY: 0,
    climbing: false,
    climbPhase: 0,
    upHeld: false,
    dropJumpHeld: false,
    jumpBufferSeconds: -1,
    floorGrace: null,
    wallGrace: null,
  };
}

function withinGrace(player, grace, distance) {
  return Boolean(grace) && Math.hypot(player.x - grace.x, player.y - grace.y) <= distance + 1e-9;
}

// Half a frame of gravity is added so the discrete integration still reaches the normal height.
export function jumpSpeed(dt) {
  return -JUMP_VELOCITY + GRAVITY * dt / 2;
}

export function cancelJumpInput(player) {
  player.jumpBufferSeconds = -1;
}

export function findSpawnY(terrain, x, playerWidth = PLAYER_WIDTH, playerHeight = PLAYER_HEIGHT) {
  const firstColumn = Math.max(0, Math.floor(x));
  const lastColumn = Math.min(terrain.width, Math.ceil(x + playerWidth));
  let highestSurface = terrain.height;
  for (let column = firstColumn; column < lastColumn; column += 1) {
    highestSurface = Math.min(highestSurface, terrain.surfaceY[column]);
  }
  return highestSurface - playerHeight;
}

function isSolid(terrain, x, y) {
  const cellX = Math.floor(x);
  const cellY = Math.floor(y);
  if (cellX < 0 || cellX >= terrain.width || cellY < 0 || cellY >= terrain.height) {
    return false;
  }
  if (terrain.solid[cellY * terrain.width + cellX] === 1) return true;
  return (terrain.movingPlatforms || []).some((platform) => (
    cellX + 1 > platform.x && cellX < platform.x + platform.width
      && cellY + 1 > platform.y && cellY < platform.y + platform.height
  ));
}

function overlapsSolid(player, terrain) {
  const left = Math.floor(player.x);
  const right = Math.ceil(player.x + player.width) - 1;
  const top = Math.floor(player.y);
  const bottom = Math.ceil(player.y + player.height - 1e-9) - 1;
  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      if (isSolid(terrain, x, y)) {
        return true;
      }
    }
  }
  return false;
}

function surfaceContact(player, terrain) {
  let floorDistance = null;
  const bottom = player.y + player.height;
  const left = Math.floor(player.x);
  const right = Math.ceil(player.x + player.width);
  if (player.vy >= 0) {
    for (let y = Math.ceil(bottom - 1e-9); y <= bottom + CONTACT_DISTANCE + 1e-9; y += 1) {
      for (let x = left; x < right; x += 1) {
        if (isSolid(terrain, x + 0.5, y)) {
          floorDistance = Math.max(0, y - bottom);
          break;
        }
      }
      if (floorDistance !== null) break;
    }
    if (floorDistance === null && bottom <= terrain.height && terrain.height - bottom <= CONTACT_DISTANCE) {
      floorDistance = terrain.height - bottom;
    }
  }
  let wall = 0;
  let nearest = Infinity;
  for (const side of [-1, 1]) {
    const edge = side < 0 ? player.x : player.x + player.width;
    const boundaryDistance = side < 0 ? edge : terrain.width - edge;
    if (boundaryDistance >= 0 && boundaryDistance <= CONTACT_DISTANCE && boundaryDistance < nearest) {
      nearest = boundaryDistance;
      wall = side;
    }
    const first = side < 0 ? Math.floor(edge) - 1 : Math.ceil(edge);
    for (let offset = 0; offset <= CONTACT_DISTANCE; offset += 1) {
      const x = first + side * offset;
      const distance = side < 0 ? edge - x - 1 : x - edge;
      if (distance > CONTACT_DISTANCE + 1e-9) break;
      for (let y = Math.ceil(player.y + 1); y < bottom - 1; y += 1) {
        if (distance < nearest && isSolid(terrain, x, y)) {
          nearest = distance;
          wall = side;
        }
      }
    }
  }
  return { floorDistance, wall };
}

function snapToFloor(player, terrain) {
  const { floorDistance } = surfaceContact(player, terrain);
  if (floorDistance === null) return false;
  player.y += floorDistance;
  player.vy = 0;
  return true;
}

function moveAxis(player, distance, axis, terrain) {
  const steps = Math.max(1, Math.ceil(Math.abs(distance) / 0.5));
  const step = distance / steps;
  for (let index = 0; index < steps; index += 1) {
    player[axis] += step;
    // Gravity must collide with a horizontal tunnel's floor, not excavate it.
    if (player.drilling && (axis === "x" || Math.abs(player.drillY) > 1e-9)) drillTunnel(player, terrain);
    if (overlapsSolid(player, terrain)) {
      player[axis] -= step;
      if (axis === "x" && player.grounded) {
        const previousY = player.y;
        let climbed = false;
        for (let lift = 1; lift <= 3; lift += 1) {
          player.y = previousY - lift;
          player.x += step;
          if (!overlapsSolid(player, terrain)) {
            climbed = true;
            break;
          }
          player.x -= step;
        }
        if (climbed) {
          snapToFloor(player, terrain);
          continue;
        }
        player.y = previousY;
      }
      return false;
    }
    if (axis === "x" && player.grounded && player.vy >= 0) {
      player.grounded = snapToFloor(player, terrain);
    }
  }
  return true;
}

function drillTunnel(player, terrain, lookAhead = 0, probe = false) {
  const centerX = player.x + player.width / 2 + lookAhead * player.drillX;
  const centerY = player.y + player.height / 2;
  const halfWidth = (Math.abs(player.drillY) * player.width + Math.abs(player.drillX) * player.height) / 2 + 0.5;
  const extent = DRILL_REACH + halfWidth;
  let changed = false;
  for (let y = Math.max(0, Math.floor(centerY - extent)); y < Math.min(terrain.height, Math.ceil(centerY + extent)); y += 1) {
    for (let x = Math.max(0, Math.floor(centerX - extent)); x < Math.min(terrain.width, Math.ceil(centerX + extent)); x += 1) {
      const dx = x + 0.5 - centerX;
      const dy = y + 0.5 - centerY;
      const along = dx * player.drillX + dy * player.drillY;
      const across = -dx * player.drillY + dy * player.drillX;
      if (Math.abs(player.drillY) < 1e-9 && y >= Math.ceil(player.y + player.height - 1e-9)) continue;
      if (along < 0 || along > DRILL_REACH || Math.abs(across) > halfWidth) continue;
      if (x >= 0 && x < terrain.width && y >= 0 && y < terrain.height) {
        const index = y * terrain.width + x;
        if (terrain.solid[index] === 1) {
          if (probe) return true;
          if (terrain.undrillable?.[index]) continue;
          terrain.solid[index] = 0;
          changed = true;
        }
      }
    }
  }
  if (changed) {
    terrain.version = (terrain.version || 0) + 1;
  }
  return changed;
}

export function stepPlayer(player, input, terrain, dt) {
  if (!Number.isFinite(dt) || dt < 0) {
    throw new RangeError("Frame duration must be a non-negative number.");
  }
  const elapsed = Math.min(dt, 0.05);
  const speedMultiplier = Number.isFinite(input.speedMultiplier) ? Math.max(1, input.speedMultiplier) : 1;
  const direction = Math.sign(input.move || 0);
  const vertical = Math.sign(input.moveY || 0);
  player.jumpKind = null;
  player.jumpWallSide = 0;
  if (direction) player.facing = direction;
  if (vertical < 0 && !player.upHeld) {
    player.climbing = true;
    player.vy = 0;
    cancelJumpInput(player);
  }
  player.upHeld = vertical < 0;
  if (player.climbing && input.jumpPressed) {
    player.climbing = false;
    player.vy = 0;
    player.dropJumpHeld = true;
    cancelJumpInput(player);
  }
  const dropJump = player.dropJumpHeld;
  if (!input.jumpHeld) player.dropJumpHeld = false;
  player.drilling = Boolean(input.drill);
  const drillMagnitude = Math.hypot(direction, vertical);
  player.drillX = drillMagnitude ? direction / drillMagnitude : player.facing;
  player.drillY = drillMagnitude ? vertical / drillMagnitude : 0;
  player.excavating = player.drilling && (drillTunnel(player, terrain, 0, true)
    || drillTunnel(player, terrain, NORMAL_SPEED * elapsed + 1, true));
  if (player.drilling) drillTunnel(player, terrain);
  const contact = surfaceContact(player, terrain);
  if (player.climbing && vertical >= 0 && contact.floorDistance === 0) {
    player.climbing = false;
  }
  const nearSurface = !player.climbing && (contact.floorDistance !== null || contact.wall !== 0);
  player.grounded = !player.climbing && contact.floorDistance !== null;
  if (player.grounded) snapToFloor(player, terrain);
  if (player.climbing) {
    player.floorGrace = null;
    player.wallGrace = null;
  } else if (player.grounded) {
    player.floorGrace = { x: player.x, y: player.y };
    player.wallGrace = null;
  } else if (contact.wall) {
    player.wallGrace = { x: player.x, y: player.y, side: contact.wall };
  }
  if (player.climbing || player.grounded || contact.wall) player.airJumps = 1;
  const floorGrace = !nearSurface && withinGrace(player, player.floorGrace, FLOOR_GRACE_DISTANCE);
  const wallGrace = !nearSurface && !floorGrace && withinGrace(player, player.wallGrace, WALL_GRACE_DISTANCE);
  const freshPress = Boolean(input.jumpPressed) && !dropJump;
  player.jumpBufferSeconds = freshPress
    ? JUMP_BUFFER_SECONDS
    : Math.max(-1, player.jumpBufferSeconds - elapsed);
  let wallLaunch = 0;
  if (!dropJump && player.jumpBufferSeconds >= -1e-9
    && (nearSurface || floorGrace || wallGrace) && (input.jumpHeld || input.jumpPressed)) {
    if (wallGrace) wallLaunch = -player.wallGrace.side;
    else if (!player.grounded && !floorGrace) wallLaunch = -contact.wall;
    player.jumpKind = wallLaunch ? "wall" : "floor";
  } else if (freshPress && player.airJumps > 0) {
    player.airJumps = 0;
    player.jumpKind = "air";
  }
  if (player.jumpKind) {
    player.jumpWallSide = -wallLaunch;
    player.jumpX = wallLaunch > 0 ? player.x : wallLaunch < 0 ? player.x + player.width : player.x + player.width / 2;
    player.jumpY = player.y + player.height / 2;
    player.floorGrace = null;
    player.wallGrace = null;
    player.vy = -jumpSpeed(elapsed);
    player.grounded = false;
    player.jumpBufferSeconds = -1;
  }
  if (input.jumpReleased || !input.jumpHeld) cancelJumpInput(player);

  if (player.climbing) {
    const magnitude = Math.max(1, Math.hypot(direction, vertical));
    player.vx = direction * CLIMB_SPEED * speedMultiplier / magnitude;
    player.vy = vertical * CLIMB_SPEED * speedMultiplier / magnitude;
    const beforeX = player.x;
    const beforeY = player.y;
    if (!moveAxis(player, player.vx * elapsed, "x", terrain)) player.vx = 0;
    if (!moveAxis(player, player.vy * elapsed, "y", terrain)) {
      if (vertical > 0) {
        player.climbing = false;
        player.grounded = true;
      }
      player.vy = 0;
    }
    player.x = Math.max(0, Math.min(terrain.width - player.width, player.x));
    player.y = Math.max(0, Math.min(terrain.height - player.height, player.y));
    if ((player.x === 0 && player.vx < 0) || (player.x === terrain.width - player.width && player.vx > 0)) {
      player.vx = 0;
    }
    if ((player.y === 0 && player.vy < 0) || (player.y === terrain.height - player.height && player.vy > 0)) {
      player.vy = 0;
    }
    if (vertical > 0 && snapToFloor(player, terrain)) {
      player.climbing = false;
      player.grounded = true;
    }
    player.climbPhase += Math.hypot(player.x - beforeX, player.y - beforeY) / 3;
    player.airJumps = 1;
    return;
  }

  if (direction !== 0) {
    player.facing = direction;
  }

  const speed = (player.excavating ? CLIMB_SPEED : NORMAL_SPEED) * speedMultiplier;
  const horizontalDistance = (wallLaunch || direction) * speed * elapsed;
  player.vx = (wallLaunch || direction) * speed;
  if (wallLaunch) player.facing = wallLaunch;
  if (!moveAxis(player, horizontalDistance, "x", terrain)) {
    player.vx = 0;
  }

  player.x = Math.max(0, Math.min(terrain.width - player.width, player.x));
  player.vy += GRAVITY * elapsed;
  const verticalDistance = player.vy * elapsed;
  const previousY = player.y;
  if (!moveAxis(player, verticalDistance, "y", terrain)) {
    if (verticalDistance > 0) {
      player.grounded = true;
      player.vy = 0;
    } else {
      player.vy = 0;
    }
  } else {
    player.grounded = false;
  }

  if (player.grounded && verticalDistance > 0 && overlapsSolid(player, terrain)) {
    player.y = previousY;
  }
  if (player.vy >= 0) {
    player.grounded = snapToFloor(player, terrain);
  }
  if (player.y < 0) {
    player.y = 0;
    player.vy = 0;
  }
  if (player.y + player.height > terrain.height || (player.y + player.height === terrain.height && player.vy >= 0)) {
    player.y = terrain.height - player.height;
    player.vy = 0;
    player.grounded = true;
  }
  if (player.grounded) player.airJumps = 1;
}
