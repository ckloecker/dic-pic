import { closeAndFill } from "./morphology.js";

export const TERRAIN_OPACITY = 0.8;

export function strongestTerrainEdges(terrain) {
  const selected = [...terrain.features]
    .sort((first, second) => second.strength - first.strength)
    .slice(0, 12);
  const photoSolid = new Uint8Array(terrain.solid.length);
  const edgeDirections = new Uint8Array(terrain.solid.length);
  for (const feature of selected) for (const { along, across } of feature.points) {
    const x = feature.vertical ? across : along, y = feature.vertical ? along : across;
    edgeDirections[y * terrain.width + x] |= feature.vertical ? 2 : 1;
    for (let offset = 0; offset < 4; offset += 1) {
      const px = x + (feature.vertical ? offset : 0), py = y + (feature.vertical ? 0 : offset);
      if (px < terrain.width && py < terrain.height) photoSolid[py * terrain.width + px] = 1;
    }
  }
  return { ...terrain, photoSolid, solid: photoSolid.slice(), edgeDirections, connectors: [] };
}

function percentile(histogram, count, fraction) {
  let cumulative = 0;
  for (let value = 0; value < histogram.length; value += 1) {
    cumulative += histogram[value];
    if (cumulative > count * fraction) return value;
  }
  return 255;
}

export class NoUsableEdgeError extends Error {
  constructor() {
    super("No usable visible edge was detected. Please choose another photo with a clear boundary.");
    this.name = "NoUsableEdgeError";
  }
}

function traceEdges(strength, width, height, vertical) {
  const traces = [];
  let active = [];
  const alongLimit = vertical ? height : width;
  const acrossLimit = vertical ? width : height;
  const valueAt = (along, across) => strength[vertical ? along * width + across : across * width + along];
  for (let along = 1; along < alongLimit - 1; along += 1) {
    const candidates = [];
    for (let across = 1; across < acrossLimit - 2; across += 1) {
      const value = valueAt(along, across);
      if (value >= 30 && value >= valueAt(along, across - 1) && value > valueAt(along, across + 1)) {
        candidates.push({ along, across, strength: value });
      }
    }
    candidates.sort((a, b) => b.strength - a.strength);
    const next = [];
    const matched = new Set();
    for (const point of candidates) {
      let nearest = null;
      let distance = 3;
      for (const trace of active) {
        if (matched.has(trace)) continue;
        const gap = Math.abs(trace.points[trace.points.length - 1].across - point.across);
        if (gap < distance) {
          nearest = trace;
          distance = gap;
        }
      }
      if (!nearest) {
        nearest = { points: [], strength: 0, vertical };
        traces.push(nearest);
      }
      nearest.points.push(point);
      nearest.strength += point.strength;
      matched.add(nearest);
      next.push(nearest);
    }
    active = next;
  }
  const minimumLength = Math.max(10, Math.floor(alongLimit * 0.03));
  const features = traces.filter((trace) => trace.points.length >= minimumLength)
    .sort((a, b) => b.strength - a.strength);
  // Prefer upper/left outlines of comparable strength over duplicate edges.
  for (let start = 0; start < features.length;) {
    let end = start + 1;
    while (end < features.length && features[end].strength >= features[start].strength * 0.9) end += 1;
    const group = features.slice(start, end).sort((a, b) => a.points[0].across - b.points[0].across);
    features.splice(start, end - start, ...group);
    start = end;
  }
  return features;
}

export function generateTerrain(rgba, width, height, { layout = "balanced" } = {}) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new RangeError("Image dimensions must be positive integers.");
  }
  if (!rgba || rgba.length !== width * height * 4) {
    throw new RangeError("Image pixels must contain four channels for every image cell.");
  }

  const count = width * height;
  const luminance = new Float32Array(count);
  const histogram = new Uint32Array(256);
  for (let index = 0; index < count; index += 1) {
    const offset = index * 4;
    const value = Math.round(
      rgba[offset] * 0.2126 + rgba[offset + 1] * 0.7152 + rgba[offset + 2] * 0.0722,
    );
    luminance[index] = value;
    histogram[value] += 1;
  }
  let low = percentile(histogram, count, 0.05);
  let high = percentile(histogram, count, 0.95);
  if (high <= low) {
    low = histogram.findIndex(value=>value>0);
    high = histogram.findLastIndex(value=>value>0);
  }
  if (high <= low) throw new NoUsableEdgeError();
  for (let index = 0; index < count; index += 1) {
    luminance[index] = Math.max(0, Math.min(255, (luminance[index] - low) * 255 / (high - low)));
  }

  const strength = new Float32Array(count);
  const verticalStrength = new Float32Array(count);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x;
      const gy = Math.abs(
        luminance[i + width - 1] + 2 * luminance[i + width] + luminance[i + width + 1]
        - luminance[i - width - 1] - 2 * luminance[i - width] - luminance[i - width + 1],
      ) / 4;
      const gx = Math.abs(
        luminance[i - width + 1] + 2 * luminance[i + 1] + luminance[i + width + 1]
        - luminance[i - width - 1] - 2 * luminance[i - 1] - luminance[i + width - 1],
      ) / 4;
      if (gy >= 30 && gy >= gx * 0.6) strength[i] = gy;
      if (gx >= 30 && gx >= gy * 0.6) verticalStrength[i] = gx;
    }
  }

  const platforms = [
    ...traceEdges(strength, width, height, false),
    ...traceEdges(verticalStrength, width, height, true),
  ];
  if (!platforms.length) throw new NoUsableEdgeError();
  const contours = new Uint8Array(count);
  const edgeDirections = new Uint8Array(count);
  for (const platform of platforms) {
    for (const { along, across } of platform.points) {
      const cell = platform.vertical ? along * width + across : across * width + along;
      contours[cell] = 1;
      edgeDirections[cell] |= platform.vertical ? 2 : 1;
    }
  }
  const filled = closeAndFill(contours, width, height);
  const visited = new Uint8Array(count);
  const shapes = [];
  for (let index = 0; index < count; index += 1) {
    if (!filled[index] || visited[index]) continue;
    const cells = [index];
    visited[index] = 1;
    let left = width, right = 0, top = height, bottom = 0, horizontalEvidence = 0, verticalEvidence = 0;
    for (let cursor = 0; cursor < cells.length; cursor += 1) {
      const cell = cells[cursor];
      const x = cell % width, y = Math.floor(cell / width);
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
      if (edgeDirections[cell] & 1) horizontalEvidence += 1;
      if (edgeDirections[cell] & 2) verticalEvidence += 1;
      for (const next of [x > 0 ? cell - 1 : -1, x < width - 1 ? cell + 1 : -1,
        y > 0 ? cell - width : -1, y < height - 1 ? cell + width : -1,
        x > 0 && y > 0 ? cell - width - 1 : -1, x < width - 1 && y > 0 ? cell - width + 1 : -1,
        x > 0 && y < height - 1 ? cell + width - 1 : -1,
        x < width - 1 && y < height - 1 ? cell + width + 1 : -1]) {
        if (next >= 0 && filled[next] && !visited[next]) {
          visited[next] = 1;
          cells.push(next);
        }
      }
    }
    const spanX = right - left + 1, spanY = bottom - top + 1;
    if (Math.max(spanX, spanY) < 12 || cells.length < 12) continue;
    const orientation = horizontalEvidence > verticalEvidence * 1.5 ? "horizontal"
      : verticalEvidence > horizontalEvidence * 1.5 ? "vertical" : "balanced";
    shapes.push({ cells, left, right, top, bottom, orientation });
  }
  if (!shapes.length) throw new NoUsableEdgeError();
  const hasPreferred = shapes.some((shape) => shape.orientation === layout);
  const solid = new Uint8Array(count);
  const photoSolid = new Uint8Array(count);
  for (const shape of shapes) for (const cell of shape.cells) photoSolid[cell] = 1;
  const surfaceY = new Float32Array(width).fill(height);
  for (const shape of shapes) {
    if (layout !== "balanced" && hasPreferred && shape.orientation !== layout && shape.orientation !== "balanced") continue;
    if (shape.orientation === "horizontal" && shape.bottom - shape.top < 3
      && shapes.some((other) => other !== shape && other.orientation === "horizontal"
        && other.bottom - other.top < 3 && other.top < shape.top && shape.top - other.top <= 20
        && other.left <= shape.right && other.right >= shape.left)) continue;
    for (const cell of shape.cells) {
      const x = cell % width, y = Math.floor(cell / width);
      const horizontal = shape.orientation !== "vertical";
      // Open contours need thickness; filled regions already carry their full silhouette.
      const thickness = shape.cells.length < Math.max(shape.right - shape.left, shape.bottom - shape.top) * 3;
      for (let offset = 0; offset < (thickness ? 4 : 1); offset += 1) {
        const px = x + (horizontal ? 0 : offset);
        const py = y + (horizontal ? offset : 0);
        if (px >= width || py >= height) continue;
        solid[py * width + px] = 1;
        surfaceY[px] = Math.min(surfaceY[px], py);
      }
    }
  }
  return { width, height, surfaceY, solid, version: 0, edgeDirections,
    photoSolid, features: platforms };
}

export function openSpaceRatio(terrain) {
  if (!terrain || !(terrain.solid instanceof Uint8Array) || terrain.solid.length === 0) {
    throw new TypeError("A non-empty terrain mask is required.");
  }
  let open = 0;
  for (const cell of terrain.solid) if (cell === 0) open += 1;
  return open / terrain.solid.length;
}
