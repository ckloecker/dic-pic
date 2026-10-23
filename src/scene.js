import { BIOMES } from "./level.js";
import { TERRAIN_OPACITY } from "./terrain.js";

export function drawPhoto(context, image, width, height) {
  context.save();
  context.filter = "saturate(35%) brightness(55%)";
  context.drawImage(image, 0, 0, width, height);
  context.restore();
}

export function paintTerrainShadow(context, terrain) {
  const { width, height, solid } = terrain;
  context.save();
  context.fillStyle = "rgba(9,17,24,0.9)";
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const cell = y * width + x;
    if (!solid[cell] && ((x > 0 && solid[cell - 1]) || (x < width - 1 && solid[cell + 1])
      || (y > 0 && solid[cell - width]) || (y < height - 1 && solid[cell + width]))) {
      context.fillRect(x, y, 1, 1);
    }
  }
  context.restore();
}

export function drawEnemies(context, enemies, biome) {
  context.save();
  for (const enemy of enemies) {
    const x = Math.round(enemy.x);
    const y = Math.round(enemy.y);
    context.fillStyle = "#190f26";
    context.fillRect(x + 2, y, 6, 6);
    context.fillRect(x, y + 1, 10, 3);
    if (biome === "underwater") {
      context.fillStyle = "#ef8edb";
      context.fillRect(x + 2, y + 1, 6, 3);
      context.fillRect(x + 1, y + 2, 8, 1);
      context.fillRect(x + 2, y + 4, 1, 2);
      context.fillRect(x + 5, y + 4, 1, 2);
      context.fillRect(x + 7, y + 4, 1, 2);
    } else {
      context.fillStyle = "#d7f2ff";
      context.fillRect(x, y + 1, 3, 2);
      context.fillRect(x + 7, y + 1, 3, 2);
      context.fillStyle = biome === "jungle" ? "#ffd45c" : "#f58255";
      context.fillRect(x + 3, y + 1, 4, 4);
      context.fillStyle = biome === "jungle" ? "#302239" : "#9c343d";
      context.fillRect(x + 4, y + 2, biome === "jungle" ? 2 : 1, 3);
    }
    context.fillStyle = "#ffffff";
    context.fillRect(x + 3, y + 2, 1, 1);
    context.fillRect(x + 6, y + 2, 1, 1);
  }
  context.restore();
}

export function drawPickups(context, pickups, seconds = 0) {
  for (const pickup of pickups) {
    const { x, y } = pickup;
    if (pickup.type === "speed") {
      context.fillStyle = "#38251f";
      context.fillRect(x, y + 1, 4, 2);
      context.fillStyle = "#ffd166";
      context.fillRect(x + 1, y, 2, 1);
      context.fillRect(x + 1, y + 1, 1, 1);
      context.fillRect(x + 2, y + 2, 1, 1);
      context.fillRect(x + 1, y + 3, 2, 1);
    } else if (pickup.type === "reverse") {
      context.fillStyle = "#56374f";
      context.fillRect(x, y, 4, 2);
      context.fillStyle = "#d983c1";
      context.fillRect(x + 1, y, 2, 2);
      context.fillStyle = "#f0cfb2";
      context.fillRect(x + 1, y + 2, 2, 2);
      context.fillStyle = "#ffffff";
      context.fillRect(x + 1, y, 1, 1);
      context.fillRect(x + 3, y + 1, 1, 1);
    }
  }
}

export function drawBiomeEffects(context, width, height, biome, seconds = 0, reducedMotion = false) {
  const time = reducedMotion ? 0 : seconds;
  context.save();
  if (biome === "desert") {
    const sunX = width * 0.16;
    const sunY = height * 0.13;
    const glow = context.createRadialGradient(sunX, sunY, 2, sunX, sunY, 32);
    glow.addColorStop(0, "rgba(255,238,167,0.45)");
    glow.addColorStop(1, "rgba(255,213,110,0)");
    context.fillStyle = glow;
    context.fillRect(0, 0, width, height);
    context.fillStyle = "rgba(255,238,167,0.4)";
    context.fillRect(sunX - 5, sunY - 5, 10, 10);
    for (let index = 0; index < 6; index += 1) {
      const drift = Math.sin(time * 0.4 + index) * 4;
      context.fillStyle = `rgba(255,220,136,${0.04 + (Math.sin(time * 0.6 + index) + 1) * 0.025})`;
      context.beginPath();
      context.moveTo(sunX + index * 10, 0);
      context.lineTo(sunX + index * 10 + 5, 0);
      context.lineTo(width * 0.25 + index * 35 + drift, height);
      context.lineTo(width * 0.17 + index * 35 + drift, height);
      context.fill();
    }
  } else {
    const underwater = biome === "underwater";
    const wash = context.createLinearGradient(0, 0, 0, height);
    wash.addColorStop(0, underwater ? "rgba(91,195,218,0.08)" : "rgba(42,102,57,0.03)");
    wash.addColorStop(1, underwater ? "rgba(14,85,131,0.12)" : "rgba(22,66,42,0.08)");
    context.fillStyle = wash;
    context.fillRect(0, 0, width, height);
    for (let index = 0; index < 4; index += 1) {
      const x = index * width / 3 + Math.sin(time * 0.2 + index) * 5;
      context.fillStyle = underwater ? "rgba(178,238,242,0.07)" : "rgba(238,230,151,0.08)";
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x + 7, 0);
      context.lineTo(x - 10, height);
      context.lineTo(x - 45, height);
      context.fill();
    }
    for (let index = 0; index < 18; index += 1) {
      const x = ((index * 47 + 13) % width) + Math.sin(time * 0.5 + index) * 2;
      const y = underwater
        ? height - (index * 23 + time * (4 + index % 3)) % (height + 8)
        : (index * 31 + time * 3) % height;
      if (underwater) {
        context.strokeStyle = "rgba(199,246,255,0.4)";
        context.lineWidth = 0.5;
        context.beginPath();
        context.arc(x, y, 1 + index % 3, 0, Math.PI * 2);
        context.stroke();
      } else {
        context.fillStyle = index % 2 ? "rgba(174,209,104,0.4)" : "rgba(242,222,144,0.3)";
        context.fillRect(Math.round(x), Math.round(y), 1, 2);
      }
    }
  }
  context.restore();
}

export function paintTerrain(context, terrain) {
  const { width, height, solid } = terrain;
  const biome = BIOMES[terrain.biome || "jungle"];
  const pixels = context.createImageData(width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const cell = y * width + x;
      if (!solid[cell]) continue;
      const top = y === 0 || !solid[cell - width];
      const exposed = top || y === height - 1 || !solid[cell + width]
        || x === 0 || !solid[cell - 1] || x === width - 1 || !solid[cell + 1];
      let color = exposed ? biome.surface : biome.fill[0];
      const part = terrain.details?.[cell];
      if (part === 1) color = [101 + (x % 3) * 12, 112 + y % 3 * 9, 107];
      if (part === 2) color = x % 3 === 0 ? biome.surface : biome.element;
      if (part === 3) color = x % 3 === 0 ? [155, 104, 59] : [102, 65, 42];
      if (part === 4) color = (x + y) % 4 ? [42, 103, 57] : [56, 130, 62];
      if (part === 5) color = (x + y) % 3 ? [87, 157, 65] : [132, 185, 79];
      if (part === 6) color = y % 4 ? [68, 126, 53] : [155, 184, 78];
      if (part === 7) color = [237, 220, 172];
      if (part === 8) color = x % 2 ? [47, 139, 111] : [100, 182, 133];
      if (part === 9) color = [252, 182, 163];
      if (part === 10) color = terrain.biome === "desert" ? [198, 147, 104] : [168, 184, 165];
      pixels.data.set([...color, exposed ? 255 : Math.round(TERRAIN_OPACITY * 255)], cell * 4);
    }
  }
  context.putImageData(pixels, 0, 0);
  context.save();
  context.globalAlpha = 1;
  context.fillStyle = terrain.biome === "desert" ? "#c8ad70" : terrain.biome === "underwater" ? "#509e8a" : "#76ad51";
  for (const { x, y, anchor } of terrain.accents || []) {
    if (!solid[anchor]) continue;
    context.fillRect(x - 1, y - 2, 1, 2);
    context.fillRect(x + 1, y - 3, 1, 3);
    context.fillRect(x + 3, y - 1, 1, 1);
  }
  context.restore();
}

export function drawGate(context, flag) {
  const { x, y, width, height } = flag;
  const top = y - height;
  context.fillStyle = "#14212b";
  context.fillRect(x, top, width, 8);
  context.fillRect(x, top, 3, height);
  context.fillRect(x + width - 3, top, 3, height);
  context.fillStyle = "#ffe18c";
  context.fillRect(x + 1, top, 1, height);
  context.fillRect(x + width - 2, top, 1, height);
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < width / 2; column += 1) {
      context.fillStyle = (row + column) % 2 ? "#14212b" : "#ffffff";
      context.fillRect(x + column * 2, top + 1 + row * 2, 2, 2);
    }
  }
}

export function drawHeadwear(context, player, biome) {
  const { x, y, width } = player;
  if (biome === "underwater") {
    context.fillStyle = "#cda14e";
    context.fillRect(x + 1, y, width - 2, 4);
    context.fillRect(x, y + 3, width, 1);
    context.fillStyle = "#8de0ec";
    context.fillRect(x + 2, y + 1, width - 4, 2);
  } else {
    context.fillStyle = biome === "desert" ? "#ae7549" : "#d0c28a";
    context.fillRect(x + 1, y, width - 2, 2);
    context.fillRect(x, y + 2, width, 1);
    context.fillStyle = "#59452e";
    context.fillRect(x + 1, y + 1, width - 2, 1);
  }
}

export function drawPreview(context, image, option) {
  drawPhoto(context, image, option.width, option.height);
  const layer = document.createElement("canvas");
  layer.width = option.width;
  layer.height = option.height;
  const layerContext = layer.getContext("2d");
  drawBiomeEffects(layerContext, option.width, option.height, option.biome);
  context.drawImage(layer, 0, 0);
  paintTerrain(layerContext, option);
  paintTerrainShadow(layerContext, option);
  context.drawImage(layer, 0, 0);
  drawEnemies(context, option.enemies || [], option.biome);
  drawPickups(context, option.pickups || []);
  drawGate(context, option.flag);
  const player = { ...option.spawn, width: 6 };
  context.fillStyle = "#247f7b";
  context.fillRect(player.x + 1, player.y + 3, 4, 4);
  context.fillStyle = "#344b52";
  context.fillRect(player.x + 1, player.y + 7, 2, 2);
  context.fillRect(player.x + 4, player.y + 7, 1, 2);
  drawHeadwear(context, player, option.biome);
}
