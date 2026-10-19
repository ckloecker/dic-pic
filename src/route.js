import { createPlayer, stepPlayer } from "./physics.js";
import { enemyContact, stepEnemies } from "./enemies.js";
import { reachedFlag, walkingReachable, walkingReachesFlag } from "./run.js";
import { openSpaceRatio } from "./terrain.js";

export class RouteGenerationError extends Error {
  constructor(reason) {
    super(`A safe playable route could not be constructed (${reason}). Please try generating again or choose another photo.`);
    this.name = "RouteGenerationError";
  }
}

export function connectPhotoEdges(terrain) {
  const { width, height, edgeDirections } = terrain;
  const photoSolid = terrain.photoSolid.slice();
  const connectors = [];
  const surface = (x, y) => photoSolid[y * width + x] && !photoSolid[(y - 1) * width + x];
  const evidence = (x, y) => [-1,0,1].some(dy=>Boolean(edgeDirections[(y+dy)*width+x]&1));
  for (let y = 2; y < height - 3; y += 1) {
    for (let x = 7; x < width - 7; x += 1) {
      if (photoSolid[y * width + x] || !surface(x - 1,y) || !evidence(x - 1,y)) continue;
      let end = x;
      while (end < width - 6 && !photoSolid[y * width + end]) end += 1;
      if (!surface(end,y) || !evidence(end,y)) continue;
      if (![1,2,3,4,5,6].every(offset=>surface(x-offset,y)&&surface(end+offset-1,y))) continue;
      const cells = [];
      for (let row=y;row<y+3;row+=1) for(let column=x;column<end;column+=1){
        const cell=row*width+column;
        photoSolid[cell]=1;
        cells.push(cell);
      }
      connectors.push({ x,y,span:end-x,width:end-x,height:3,cells,
        left:{x:x-1,y},right:{x:end,y} });
      x=end;
    }
  }
  return { ...terrain, photoSolid, connectors };
}

function edgeDistances(terrain) {
  const distance = new Uint16Array(terrain.solid.length).fill(65535);
  const directions = terrain.edgeDirections.slice();
  const queue = [];
  for (let cell = 0; cell < distance.length; cell += 1) {
    if (terrain.edgeDirections[cell]) { distance[cell] = 0; queue.push(cell); }
  }
  for (let head = 0; head < queue.length; head += 1) {
    const cell = queue[head], x = cell % terrain.width, y = Math.floor(cell / terrain.width);
    for (const next of [x ? cell - 1 : -1, x < terrain.width - 1 ? cell + 1 : -1,
      y ? cell - terrain.width : -1, y < terrain.height - 1 ? cell + terrain.width : -1]) {
      if (next < 0 || distance[next] <= distance[cell] + 1) continue;
      distance[next] = distance[cell] + 1;
      directions[next] = directions[cell];
      queue.push(next);
    }
  }
  return { distance, directions };
}

function routeGraph(terrain, distance, directions, repair) {
  const nodes = [];
  const byPosition = new Map();
  const anchors = [];
  for (let y = 12; y <= terrain.height - 18; y += 4) {
    for (let x = 4; x <= terrain.width - 10; x += 4) {
      const cell = y * terrain.width + x + 3;
      if (!repair && distance[cell] > 24) continue;
      const node = { x, y, cell, evidence: directions[cell], links: [], id: nodes.length };
      nodes.push(node);
      byPosition.set(`${x},${y}`, node);
      if (distance[cell] <= 12 && terrain.photoSolid[(y + 9) * terrain.width + x + 3]) anchors.push(node);
      else if (repair && x % 24 === 4 && y % 24 === 12) anchors.push(node);
    }
  }
  for (const node of nodes) {
    for (const [dx, dy] of [[4,0],[-4,0],[0,4],[0,-4]]) {
      const next = byPosition.get(`${node.x + dx},${node.y + dy}`);
      if (next) node.links.push(next);
    }
  }
  return { nodes, anchors };
}

function pathBetween(start, goal, graph, terrain, used, distance) {
  const cost = new Float64Array(graph.nodes.length).fill(Infinity);
  const previous = new Int32Array(graph.nodes.length).fill(-1);
  const open = new Set([start.id]);
  cost[start.id] = 0;
  while (open.size) {
    let id = -1, best = Infinity;
    for (const candidate of open) {
      const node = graph.nodes[candidate];
      const score = cost[candidate] + (Math.abs(node.x - goal.x) + Math.abs(node.y - goal.y)) / 4;
      if (score < best) { best = score; id = candidate; }
    }
    if (id === goal.id) {
      const path = [];
      for (let cursor = id; cursor >= 0; cursor = previous[cursor]) path.push(graph.nodes[cursor]);
      return path.reverse();
    }
    open.delete(id);
    const node = graph.nodes[id];
    for (const next of node.links) {
      if (used.has(next.id) && next.id !== start.id) continue;
      const horizontal = node.y === next.y;
      const preferred = terrain.layout === "balanced" || (terrain.layout === "horizontal"
        ? horizontal && Boolean(next.evidence & 1) : !horizontal && Boolean(next.evidence & 2));
      const filled = terrain.photoSolid[(next.y + 4) * terrain.width + next.x + 3];
      const candidate = cost[id] + 1 + (preferred ? 0 : 0.4) + (filled ? 2 : 0)
        + Math.min(2, distance[next.cell] / 24);
      if (candidate >= cost[next.id]) continue;
      cost[next.id] = candidate;
      previous[next.id] = id;
      open.add(next.id);
    }
  }
  return null;
}

function reserve(terrain, path) {
  const clearance = new Uint8Array(terrain.solid.length);
  for (const { x, y } of path) {
    for (let row = Math.max(0, y - 9); row < Math.min(terrain.height, y + 9); row += 1) {
      for (let column = Math.max(0, x - 3); column < Math.min(terrain.width, x + 9); column += 1) {
        clearance[row * terrain.width + column] = 1;
      }

    }
  }
  return clearance;
}

function protect(terrain, clearance) {
  const result = clearance.slice();
  for (let cell = 0; cell < clearance.length; cell += 1) {
    if (!clearance[cell]) continue;
    const x = cell % terrain.width, y = Math.floor(cell / terrain.width);
    for (let dy = -3; dy <= 3; dy += 1) for (let dx = -3; dx <= 3; dx += 1) {
      if (x + dx >= 0 && x + dx < terrain.width && y + dy >= 0 && y + dy < terrain.height) {
        result[(y + dy) * terrain.width + x + dx] = 1;
      }
    }
  }
  return result;
}

function simulatePath(terrain, points) {
  const player = createPlayer(points[0].x, points[0].y);
  const actions = [];
  let seconds = 0, walking = 0, climbing = 0;
  let finished = false;
  const step = (input, dt) => {
    stepPlayer(player, input, terrain, dt);
    actions.push({ input, dt });
    seconds += dt;
    if (player.climbing) climbing += dt;
    else if (input.move) walking += dt;
    finished = reachedFlag({ player, flag: terrain.flag });
  };
  for (const point of points.slice(1)) {
    if (finished) break;
    let frames = 0;
    while (!finished && Math.hypot(player.x - point.x, player.y - point.y) > 0.15) {
      if (++frames > 120 || seconds > 90) return { invalid: true, seconds, reason: "route blocked by collision or traversal budget" };
      const dx = point.x - player.x, dy = point.y - player.y;
      if (!player.climbing && (Math.abs(dy) > 0.2 || !player.grounded)) {
        if (player.upHeld) step({}, 1 / 60);
        step({ moveY: -1 }, 1 / 600);
      }
      const move = Math.abs(dx) > 0.1 ? Math.sign(dx) : 0;
      const moveY = Math.abs(dy) > 0.1 ? Math.sign(dy) : 0;
      const remaining = Math.max(Math.abs(point.x - player.x), Math.abs(point.y - player.y));
      step({ move, moveY }, Math.min(1 / 60, remaining / 80));
    }
  }
  return { actions, seconds, walking, climbing, player };
}

export function planReferenceRoute(terrain, random = Math.random, repair = false) {
  const { distance, directions } = edgeDistances(terrain);
  const graph = routeGraph(terrain, distance, directions, repair);
  if (graph.anchors.length < 6) {
    if(!repair)return planReferenceRoute(terrain,random,true);
    throw new RouteGenerationError("not enough route anchors");
  }
  const failures = {};
  const reject = (reason) => { failures[reason] = (failures[reason] || 0) + 1; };
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const edge = ["left","top","bottom","right"][Math.floor(random()*4)];
    const edgeDistance = node => edge === "left" ? node.x : edge === "right" ? terrain.width-node.x
      : edge === "top" ? node.y : terrain.height-node.y;
    const start = graph.anchors[Math.floor(random() * graph.anchors.length)];
    const points = [start], used = new Set([start.id]), sections = [];
    let current = start;
    for (let section = 0; section < 5; section += 1) {
      const candidates = graph.anchors.filter((node) => {
        const separation = Math.abs(node.x - current.x) + Math.abs(node.y - current.y);
        return separation >= 80 && separation <= 160 && !used.has(node.id)
          && (section < 4 || Math.hypot(node.x - start.x, node.y - start.y) >= Math.hypot(terrain.width,terrain.height)*0.4+12)
          && points.every((point) => Math.hypot(point.x - node.x, point.y - node.y) >= 16);
      });
      if(section===4 && candidates.length){
        const nearest=Math.min(...candidates.map(edgeDistance));
        for(let index=candidates.length-1;index>=0;index-=1){
          if(edgeDistance(candidates[index])>nearest+4)candidates.splice(index,1);
        }
      }
      if (!candidates.length) break;
      let path = null;
      for (let trial = 0; trial < Math.min(8, candidates.length); trial += 1) {
        const index = Math.floor(random() * candidates.length);
        const candidate = candidates.splice(index, 1)[0];
        path = pathBetween(current, candidate, graph, terrain, used, distance);
        if (path) break;
      }
      if (!path) break;
      for (const node of path.slice(1)) { points.push(node); used.add(node.id); }
      sections.push({ from: { x: current.x, y: current.y },
        to: { x: path.at(-1).x, y: path.at(-1).y } });
      current = path.at(-1);
    }
    if (sections.length < (attempt<8 ? 4 : 2)) { reject("too few connected sections"); continue; }
    const clearance = reserve(terrain, points);
    const solid = terrain.photoSolid.map((cell, index) => clearance[index] ? 0 : cell);
    for(const connector of terrain.connectors || []){
      if(!connector.cells.every(cell=>solid[cell])) for(const cell of connector.cells) solid[cell]=0;
    }
    let count = solid.reduce((sum, cell) => sum + cell, 0);
    // Remove deepest optional filling first; never add material to satisfy an occupancy target.
    const removable = [];
    const supportCells = new Set();
    for(const point of [start,current])for(let x=point.x-3;x<point.x+9;x+=1){
      supportCells.add((point.y+9)*terrain.width+x);
    }
    for (let cell = 0; cell < solid.length; cell += 1) {
      if (solid[cell] && distance[cell] > 3 && !supportCells.has(cell)) removable.push(cell);
    }
    removable.sort((a, b) => distance[b] - distance[a]);
    for (const cell of removable) {
      if (count <= solid.length * 0.35) break;
      solid[cell] = 0;
      count -= 1;
    }
    for(const connector of terrain.connectors || []){
      if(!connector.cells.every(cell=>solid[cell])
        || !solid[connector.left.y*terrain.width+connector.left.x]
        || !solid[connector.right.y*terrain.width+connector.right.x]){
        for(const cell of connector.cells)solid[cell]=0;
      }
    }
    const platforms = [];
    if (repair) {
      const supports = [start, current, ...sections.map(section => section.to)];
      for (let index = 0; index < points.length - 1; index += 1) {
        if (points[index].y === points[index + 1].y) supports.push(points[index]);
      }
      for (const point of supports) {
        const x = Math.max(1, point.x - 6), y = point.y + 9;
        const right = Math.min(terrain.width - 1, point.x + 18);
        const cells = [];
        for (let row = y; row < Math.min(terrain.height, y + 3); row += 1) {
          for (let column = x; column < right; column += 1) {
            const cell = row * terrain.width + column;
            if (!clearance[cell] && !solid[cell]) {
              solid[cell] = 1;
              cells.push(cell);
            }
          }
        }
        if (cells.length) platforms.push({ x, y, width: right - x, height: 3, cells });
      }
    }
    const spawn = { x: start.x, y: start.y };
    const flag = { x: Math.max(0, Math.min(terrain.width - 12, current.x - 3)),
      y: current.y + 9, width: 12, height: 18 };
    const candidate = { ...terrain, solid, spawn, flag };
    if(![start,current].every(point=>Array.from({length:6},(_,offset)=>
      solid[(point.y+9)*terrain.width+point.x+offset]).some(Boolean))){
      reject("route removes start or finish support");continue;
    }
    if (points.slice(0,-8).some(point=>reachedFlag({player:{...point,width:6,height:9},flag}))) {
      reject("route crosses finish before its last section"); continue;
    }
    if (Math.hypot(spawn.x - flag.x, spawn.y - flag.y) < Math.hypot(terrain.width, terrain.height) * 0.4) {
      reject("start and finish too close"); continue;
    }
    if (walkingReachesFlag(candidate, walkingReachable(candidate, spawn), flag)) { reject("walking-only finish"); continue; }
    const simulation = simulatePath(candidate, points);
    if (simulation.invalid || (attempt<8 && (simulation.seconds < 20 || simulation.seconds > 40))
      || simulation.walking < 0.5 || simulation.climbing < 0.5 || !reachedFlag({ player: simulation.player, flag })) {
      reject(simulation.invalid ? simulation.reason
        : `reference duration ${simulation.seconds.toFixed(1)}s, walking ${simulation.walking.toFixed(1)}s`); continue;
    }
    return { ...candidate, edge, route: { sections, actions: simulation.actions, seconds: simulation.seconds,
      clearance, protected: protect(terrain,clearance), points: points.map(({x,y}) => ({x,y})) },
      platforms,
      connectors: (terrain.connectors || []).filter(connector=>connector.cells.every(cell=>solid[cell])) };
  }
  if(!repair) return planReferenceRoute(terrain,random,true);
  throw new RouteGenerationError(Object.entries(failures).map(([reason, count]) => `${reason}: ${count}`).join("; "));
}

export function verifyReferenceRoute(level) {
  const start = {...level.spawn,width:6,height:9};
  const finish = {...level.flag,y:level.flag.y-level.flag.height};
  for(const rectangle of [start,finish]){
    if(rectangle.x<0 || rectangle.y<0 || rectangle.x+rectangle.width>level.width
      || rectangle.y+rectangle.height>level.height){
      return {valid:false,seconds:0,reason:"unsafe endpoint bounds"};
    }
    for(let y=Math.floor(rectangle.y);y<rectangle.y+rectangle.height;y+=1){
      for(let x=Math.floor(rectangle.x);x<rectangle.x+rectangle.width;x+=1){
        if(level.solid[y*level.width+x])return {valid:false,seconds:0,reason:"blocked endpoint"};
      }
    }
  }
  if (level.route.clearance.some((cell,index)=>cell && level.solid[index])) {
    return { valid: false, seconds: 0, reason: "blocked clearance" };
  }
  if ((level.connectors || []).some(connector=>!connector.cells.every(cell=>level.solid[cell])
    || !level.solid[connector.left.y*level.width+connector.left.x]
    || !level.solid[connector.right.y*level.width+connector.right.x])) {
    return { valid: false, seconds: 0, reason: "unsupported connector" };
  }
  if((level.platforms || []).some(platform=>platform.height>3
    || !platform.cells.every(cell=>level.solid[cell] && !level.route.clearance[cell]))){
    return {valid:false,seconds:0,reason:"invalid supplemental platform"};
  }
  const player = createPlayer(level.spawn.x, level.spawn.y);
  const enemies = (level.enemies || []).map((enemy) => ({ ...enemy }));
  const terrain = { ...level, solid: level.solid.slice() };
  let seconds = 0, section = 0, walking = 0, climbing = 0;
  for (let index = 0; index < level.route.actions.length; index += 1) {
    const action = level.route.actions[index];
    if (action.input.drill) return { valid: false, seconds, reason: "drilling" };
    if (!Number.isFinite(action.dt) || action.dt <= 0 || action.dt > 1/30) {
      return { valid: false, seconds, reason: "invalid timestep" };
    }
    const previous = { ...player };
    stepPlayer(player, action.input, terrain, action.dt);
    const releasingUp = previous.upHeld && !action.input.moveY
      && level.route.actions[index + 1]?.input.moveY < 0;
    if (Math.hypot(player.x - previous.x, player.y - previous.y) < 1e-9
      && !player.charging && !releasingUp) {
      return { valid: false, seconds, reason: "idle padding" };
    }
    stepEnemies(enemies, action.dt);
    seconds += action.dt;
    if (player.climbing) climbing += action.dt;
    else if (action.input.move) walking += action.dt;
    const destination=level.route.sections[section]?.to;
    if(destination && Math.hypot(player.x-destination.x,player.y-destination.y)<1.5) section+=1;
    if (enemyContact(player, enemies, previous)) return { valid: false, seconds, reason: "enemy contact" };
    if (reachedFlag({ player, flag: level.flag }) && seconds < level.route.seconds - 0.1) {
      return { valid: false, seconds, reason: "premature finish" };
    }
  }
  const openness = openSpaceRatio(level);
  return { valid: seconds > 0 && Math.abs(seconds-level.route.seconds)<1e-8
    && walking>=0.5 && climbing>=0.5 && section>=level.route.sections.length-1 && level.route.sections.length >= 2
    && reachedFlag({ player, flag: level.flag })
    && !walkingReachesFlag(level,walkingReachable(level,level.spawn),level.flag), seconds, openness };
}
