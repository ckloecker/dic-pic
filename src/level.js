import { generateTerrain, strongestTerrainEdges } from "./terrain.js";
import { createEnemies, EnemyPlacementError } from "./enemies.js";
import { connectPhotoEdges, planReferenceRoute, RouteGenerationError, verifyReferenceRoute } from "./route.js";

export const BIOMES = {
  jungle: { label: "Jungle", surface: [123, 190, 113], fill: [[139, 91, 64], [105, 69, 54]], element: [60, 115, 56] },
  desert: { label: "Desert", surface: [248, 210, 126], fill: [[202, 149, 84], [177, 116, 65]], element: [76, 135, 90] },
  underwater: { label: "Underwater", surface: [228, 215, 164], fill: [[166, 172, 139], [126, 151, 136]], element: [227, 125, 159] },
};
export const LAYOUTS = { horizontal: "Horizontal", vertical: "Vertical", balanced: "Balanced" };
export { closeAndFill } from "./morphology.js";

function createRandom(seed = 0x6d2b79f5) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function shuffle(values, random) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

function sceneryShape(kind, height) {
  const width = kind === "tree" ? Math.round(height * 0.8)
    : kind === "vine" ? 7 : kind === "kelp" ? 13 : kind === "bones" ? 15
      : kind === "rock" ? height * 2 : Math.round(height * 0.85);
  const cells = [];
  const middle = Math.floor(width / 2);
  const ellipse = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
  const branch = (x, y, ax, ay, bx, by, radius) => {
    const fraction = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay))
      / ((bx - ax) ** 2 + (by - ay) ** 2)));
    return Math.hypot(x - ax - fraction * (bx - ax), y - ay - fraction * (by - ay)) <= radius;
  };
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let part = 0;
      if (kind === "tree") {
        if (y >= height * 0.28 && Math.abs(x - middle) <= (y > height - 5 ? 4 : 2)) part = 3;
        if (part && y % 7 < 3 && x === middle - 1) part = 6;
        const qx = Math.floor(x / 2) * 2;
        const qy = Math.floor(y / 2) * 2;
        if ([[0.5, 0.17, 0.26, 0.18], [0.25, 0.33, 0.25, 0.18],
          [0.74, 0.31, 0.25, 0.18], [0.5, 0.44, 0.33, 0.15]]
          .some(([cx, cy, rx, ry]) => ellipse(qx, qy, width * cx, height * cy, width * rx, height * ry))) {
          part = (Math.floor(x / 3) + Math.floor(y / 3)) % 3 === 0 ? 5 : 4;
        }
      } else if (kind === "rock") {
        const inset = Math.max(1, Math.ceil((height - y) / 3) * 2);
        if (y >= 2 && x >= inset && x < width - inset) part = y % 4 === 2 ? 10 : 1;
      } else if (kind === "bones") {
        if ((y >= height - 3 && y < height - 1 && x > 2 && x < width - 2)
          || ellipse(x, y, 3, height - 3, 2, 2)
          || ellipse(x, y, width - 4, height - 3, 2, 2)
          || (x === middle && y === height - 1)) part = 7;
        if (x === 3 && y === height - 4) part = 0;
      } else if (kind === "cactus") {
        if ((Math.abs(x - middle) <= 2 && y >= 1)
          || (x >= 2 && x <= 4 && y >= height * 0.3 && y <= height * 0.68)
          || (x >= 3 && x < middle && y >= height * 0.58 && y <= height * 0.68)
          || (x >= width - 5 && x <= width - 3 && y >= height * 0.14 && y <= height * 0.5)
          || (x > middle && x < width - 3 && y >= height * 0.4 && y <= height * 0.5)) part = 2;
      } else if (kind === "coral") {
        if ([[middle, height, middle, 3], [middle, height * 0.65, 3, height * 0.25],
          [middle, height * 0.5, width - 4, 2], [4, height * 0.3, 3, 2],
          [middle, height * 0.8, width - 3, height * 0.45]]
          .some(([ax, ay, bx, by]) => branch(x, y, ax, ay, bx, by, 1.5))) part = (x + y) % 5 ? 2 : 9;
      } else {
        const stem = middle + Math.round(Math.sin((kind === "vine" ? y : height - 1 - y) / 3) * 2);
        if (Math.abs(x - stem) <= (kind === "kelp" ? 1 : 0)
          || (y % 5 < 2 && Math.abs(x - stem - (y % 10 < 5 ? -2 : 2)) <= 1)) {
          part = kind === "kelp" ? 8 : 6;
        }
      }
      if (part) cells.push({ x, y, part });
    }
  }
  return { width, height, cells };
}

function addElements(terrain, random) {
  const { width, height, solid, biome } = terrain;
  const anchors = [];
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 2; x < width - 2; x += 1) {
      const cell = y * width + x;
      if (!solid[cell]) continue;
      if (!solid[cell - width]) anchors.push({ x, y, hanging: false, cell });
      if (!solid[cell + width]) anchors.push({ x, y: y + 1, hanging: true, cell });
    }
  }
  const elements = [];
  const details = new Uint8Array(solid.length);
  const kinds = biome === "jungle" ? ["tree", "vine", "tree", "vine", "rock", "vine", "rock"]
    : biome === "desert" ? ["cactus", "bones", "rock", "cactus", "rock", "bones"]
      : ["coral", "kelp", "rock", "coral", "kelp", "rock"];
  for (const kind of kinds) {
    const desiredHeight = kind === "tree" ? 27 + Math.floor(random() * 19)
      : kind === "rock" ? 8 + Math.floor(random() * 6)
        : kind === "bones" ? 6 : 15 + Math.floor(random() * 12);
    const heights = kind === "tree" ? [desiredHeight, 27] : [desiredHeight];
    for (const size of heights) {
      const shape = sceneryShape(kind, size);
      const candidates = [];
      for (const anchor of anchors) {
        if (anchor.hanging !== (kind === "vine")) continue;
        const x = anchor.x - Math.floor(shape.width / 2);
        const y = anchor.hanging ? anchor.y : anchor.y - shape.height;
        if (x < 1 || y < 1 || x + shape.width >= width || y + shape.height >= height) continue;
        if (elements.some((element) => Math.hypot(anchor.x - element.anchorX, anchor.y - element.anchorY) < 12)) continue;
        if (shape.cells.some((cell) => {
          const index = (y + cell.y) * width + x + cell.x;
          return solid[index] || terrain.route.protected[index];
        })) continue;
        candidates.push({ x, y, anchor });
      }
      if (!candidates.length) continue;
      const { x, y, anchor } = candidates[Math.floor(random() * candidates.length)];
      const cells = shape.cells.map((cell) => {
        const index = (y + cell.y) * width + x + cell.x;
        solid[index] = 1;
        details[index] = cell.part;
        return index;
      });
      elements.push({ x, y, width: shape.width, height: shape.height, kind, cells,
        anchorX: anchor.x, anchorY: anchor.y, anchor: anchor.cell });
      break;
    }
  }
  terrain.elements = elements;
  terrain.details = details;
  terrain.accents = shuffle(anchors.filter((anchor) => !anchor.hanging), random)
    .filter((anchor, index) => index % 7 === 0)
    .slice(0, 80)
    .map(({ x, y, cell }) => ({ x, y, anchor: cell }));
}

function addPickups(terrain, random) {
  const { width, height, solid } = terrain;
  const size = 8;
  const pickups = [];
  for (const type of ["speed", "reverse"]) {
    const candidates = [];
    for (let y = 1; y <= height - size - 1; y += 1) {
      for (let x = 1; x <= width - size - 1; x += 1) {
        let clear = true;
        for (let row = y; row < y + size && clear; row += 1) {
          for (let column = x; column < x + size; column += 1) {
            const cell = row * width + column;
            if (solid[cell] || terrain.route.protected[cell]) {
              clear = false;
              break;
            }
          }
        }
        if (!clear || pickups.some((pickup) => (
          x < pickup.x + pickup.width && x + size > pickup.x
            && y < pickup.y + pickup.height && y + size > pickup.y
        ))) continue;
        candidates.push({ x, y, width: size, height: size, type });
      }
    }
    if (!candidates.length) {
      throw new RouteGenerationError(`no room for a ${type} pickup outside the required route`);
    }
    const count = Math.min(candidates.length, 1 + Math.floor(random() * 3));
    for (let index = 0; index < count; index += 1) {
      const candidateIndex = Math.floor(random() * candidates.length);
      pickups.push(candidates.splice(candidateIndex, 1)[0]);
    }
  }
  terrain.pickups = pickups;
}

function addMovingPlatforms(terrain, random) {
  const { width, height, solid } = terrain;
  const platforms = [];
  const drillableColumn = (x, y) => {
    if (x < 0 || x >= width) return false;
    let blocked = false;
    for (let row = 0; row < 3; row += 1) {
      const cell = (y + row) * width + x;
      if (terrain.route.protected[cell]) return false;
      blocked = blocked || Boolean(solid[cell]);
    }
    return blocked;
  };
  for (let index = 0; index < 2; index += 1) {
    const candidates = [];
    for (let y = 1; y <= height - 4; y += 1) {
      for (let left = 1; left <= width - 36; left += 1) {
        const overlapsPlatform = platforms.some((platform) => (
          left < platform.right + platform.width && left + 36 > platform.left
            && y < platform.y + platform.height && y + 3 > platform.y
        ));
        const overlapsPickup = terrain.pickups.some((pickup) => (
          left < pickup.x + pickup.width && left + 36 > pickup.x
            && y < pickup.y + pickup.height && y + 3 > pickup.y
        ));
        if (overlapsPlatform || overlapsPickup) continue;
        let clear = true;
        for (let row = y; row < y + 3 && clear; row += 1) {
          for (let column = left; column < left + 36; column += 1) {
            const cell = row * width + column;
            if (solid[cell] || terrain.route.protected[cell]) {
              clear = false;
              break;
            }
          }
        }
        if (clear) candidates.push({ left, right: left + 24, y });
      }
    }
    if (!candidates.length) {
      throw new RouteGenerationError("no room for two optional moving platforms outside the required route");
    }
    const { left, right, y } = candidates[Math.floor(random() * candidates.length)];
    platforms.push({
      x: left + Math.floor(random() * (right - left + 1)),
      y,
      left,
      right,
      width: 12,
      height: 3,
      speed: 18,
      direction: random() < 0.5 ? -1 : 1,
      expandLeft: drillableColumn(left - 1, y),
      expandRight: drillableColumn(left + 36, y),
    });
  }
  terrain.movingPlatforms = platforms;
}

function addUndrillableTerrain(terrain, random) {
  const { width, height, solid, photoSolid, route } = terrain;
  const size = { width: 4, height: 2 };
  const candidates = [];
  for (let y = 1; y <= height - size.height - 1; y += 1) {
    for (let x = 1; x <= width - size.width - 1; x += 1) {
      let clear = true;
      for (let row = y; row < y + size.height && clear; row += 1) {
        for (let column = x; column < x + size.width; column += 1) {
          const cell = row * width + column;
          if (!solid[cell] || !photoSolid[cell] || route.clearance[cell]) {
            clear = false;
            break;
          }
        }
      }
      if (clear) candidates.push({ x, y, ...size });
    }
  }
  if (!candidates.length) {
    throw new RouteGenerationError("no safe stretch of photo terrain can be marked non-drillable");
  }

  const undrillable = new Uint8Array(solid.length);
  const requested = Math.min(candidates.length, 1 + Math.floor(random() * 3));
  const placed = [];
  for (const candidate of shuffle(candidates, random)) {
    if (placed.length >= requested) break;
    if (placed.some((other) => candidate.x < other.x + other.width
      && candidate.x + candidate.width > other.x
      && candidate.y < other.y + other.height
      && candidate.y + candidate.height > other.y)) continue;
    for (let row = candidate.y; row < candidate.y + candidate.height; row += 1) {
      undrillable.fill(1, row * width + candidate.x, row * width + candidate.x + candidate.width);
    }
    placed.push(candidate);
  }
  terrain.undrillable = undrillable;
}

export function createSuggestions(rgba, width, height, random = createRandom()) {
  const biomes = shuffle(Object.keys(BIOMES), random);
  const layouts = shuffle(Object.keys(LAYOUTS), random);
  return biomes.map((biome, index) => {
    const layout = layouts[index];
    const photo = generateTerrain(rgba, width, height, { layout });
    let terrain;
    let verification;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        const source = connectPhotoEdges(attempt ? strongestTerrainEdges({ ...photo, layout }) : photo);
        terrain = planReferenceRoute({ ...source, biome, layout }, random, attempt > 0);
        addElements(terrain, random);
        addPickups(terrain, random);
        addMovingPlatforms(terrain, random);
        addUndrillableTerrain(terrain, random);
        if (!terrain.elements.length) {
          throw new RouteGenerationError("no room for collidable biome scenery outside the main corridor");
        }
        terrain.enemies = createEnemies(terrain, random);
        verification = verifyReferenceRoute(terrain);
        if (verification.valid) break;
        terrain = null;
      } catch (error) {
        if (!(error instanceof RouteGenerationError) && !(error instanceof EnemyPlacementError)) throw error;
        terrain = null;
        if (attempt === 3) throw error;
      }
    }
    if (!terrain) throw new RouteGenerationError(`final route validation: ${JSON.stringify(verification)}`);
    terrain.surfaceY = new Float32Array(width).fill(height);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (terrain.solid[y * width + x]) terrain.surfaceY[x] = Math.min(y, terrain.surfaceY[x]);
      }
    }
    return terrain;
  });
}

export function levelIdentity(level) {
  return JSON.stringify({
    revision: 9, width: level.width, height: level.height,
    biome: level.biome, layout: level.layout, spawn: level.spawn, flag: level.flag,
    solid: Array.from(level.solid), undrillable: Array.from(level.undrillable || []),
    details: Array.from(level.details), accents: level.accents,
    pickups: level.pickups,
    movingPlatforms: level.movingPlatforms,
    enemies: level.enemies,
    connectors: level.connectors,
    platforms: level.platforms,
  });
}
