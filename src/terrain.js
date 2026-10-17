export const TERRAIN_OPACITY = 0.8;

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
  for (let along = vertical ? 14 : 1; along < alongLimit - 1; along += 1) {
    const candidates = [];
    for (let across = vertical ? 1 : 14; across < acrossLimit - 2; across += 1) {
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

export function generateTerrain(rgba, width, height) {
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
  const low = percentile(histogram, count, 0.05);
  const high = percentile(histogram, count, 0.95);
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
  const solid = new Uint8Array(count);
  const outlines = new Uint8Array(count);
  const surfaceY = new Float32Array(width).fill(height);
  let occupied = 0;
  let accepted = 0;
  for (const platform of platforms) {
    const additions = new Set();
    const fullOutline = [];
    const { vertical } = platform;
    const minimumLength = Math.max(10, Math.floor((vertical ? height : width) * 0.03));
    for (const { along, across } of platform.points) {
      let nearby = false;
      for (let offset = -20; offset <= 20; offset += 1) {
        const other = across + offset;
        if (other >= 0 && other < (vertical ? width : height)
          && outlines[vertical ? along * width + other : other * width + along]) nearby = true;
      }
      if (nearby) continue;
      const gap = !vertical && (along - platform.points[0].along) % 60 >= 48;
      for (let thickness = 0; thickness < 4 && across + thickness < (vertical ? width : height); thickness += 1) {
        const index = vertical ? along * width + across + thickness : (across + thickness) * width + along;
        fullOutline.push(index);
        if (!gap && !solid[index]) additions.add(index);
      }
    }
    if (additions.size < minimumLength * 4 || occupied + additions.size > Math.floor(count * 0.2)) continue;
    for (const index of additions) {
      solid[index] = 1;
      const x = index % width;
      surfaceY[x] = Math.min(surfaceY[x], Math.floor(index / width));
    }
    for (const index of fullOutline) outlines[index] = 1;
    occupied += additions.size;
    accepted += 1;
  }
  if (accepted === 0) throw new NoUsableEdgeError();

  return { width, height, surfaceY, solid, version: 0 };
}

export function openSpaceRatio(terrain) {
  if (!terrain || !(terrain.solid instanceof Uint8Array) || terrain.solid.length === 0) {
    throw new TypeError("A non-empty terrain mask is required.");
  }
  let open = 0;
  for (const cell of terrain.solid) if (cell === 0) open += 1;
  return open / terrain.solid.length;
}
