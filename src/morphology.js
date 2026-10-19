export function closeAndFill(mask, width, height) {
  const result = mask.slice();
  const dilated = new Uint8Array(mask.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!mask[y * width + x]) continue;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (x + dx >= 0 && x + dx < width && y + dy >= 0 && y + dy < height) {
            dilated[(y + dy) * width + x + dx] = 1;
          }
        }
      }
    }
  }
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      let closed = true;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (!dilated[(y + dy) * width + x + dx]) closed = false;
        }
      }
      const index = y * width + x;
      if (closed && !result[index]) {
        result[index] = 1;
      }
    }
  }
  const visited = new Uint8Array(mask.length);
  for (let index = 0; index < result.length; index += 1) {
    if (result[index] || visited[index]) continue;
    const region = [index];
    visited[index] = 1;
    let exterior = false;
    for (let cursor = 0; cursor < region.length; cursor += 1) {
      const cell = region[cursor];
      const x = cell % width;
      const y = Math.floor(cell / width);
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) exterior = true;
      for (const neighbor of [
        x > 0 ? cell - 1 : -1, x < width - 1 ? cell + 1 : -1,
        y > 0 ? cell - width : -1, y < height - 1 ? cell + width : -1,
      ]) {
        if (neighbor >= 0 && !result[neighbor] && !visited[neighbor]) {
          visited[neighbor] = 1;
          region.push(neighbor);
        }
      }
    }
    if (!exterior) {
      for (const cell of region) result[cell] = 1;
    }
  }
  return result;
}
