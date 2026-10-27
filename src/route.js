import { createPlayer, stepPlayer } from "./physics.js";
import { enemyContact, stepEnemies } from "./enemies.js";
import { collectCheckpoints, reachedFlag, walkingReachable, walkingReachesFlag } from "./run.js";
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
      else if (repair && ((x % 24 === 4 && y % 24 === 12)
        || x === 4 || x + 4 > terrain.width - 10
        || y === 12 || y + 4 > terrain.height - 18)) anchors.push(node);
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

function precedesRouteNode(left, right) {
  return left.score < right.score || (left.score === right.score && left.sequence < right.sequence);
}

function pushRouteNode(open, entry) {
  let index = open.length;
  open.push(entry);
  while (index > 0) {
    const parent = Math.floor((index - 1) / 2);
    if (!precedesRouteNode(entry, open[parent])) break;
    open[index] = open[parent];
    index = parent;
  }
  open[index] = entry;
}

function popRouteNode(open) {
  const first = open[0];
  const last = open.pop();
  if (open.length > 0) {
    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      if (left >= open.length) break;
      const child = right < open.length && precedesRouteNode(open[right], open[left]) ? right : left;
      if (!precedesRouteNode(open[child], last)) break;
      open[index] = open[child];
      index = child;
    }
    open[index] = last;
  }
  return first;
}

function pathBetween(start, goal, graph, terrain, used, distance) {
  const cost = new Float64Array(graph.nodes.length).fill(Infinity);
  const previous = new Int32Array(graph.nodes.length).fill(-1);
  const open = [];
  let sequence = 0;
  cost[start.id] = 0;
  const heuristic = (node) => (Math.abs(node.x - goal.x) + Math.abs(node.y - goal.y)) / 4;
  pushRouteNode(open, { id: start.id, cost: 0, score: heuristic(start), sequence: sequence++ });
  while (open.length) {
    const current = popRouteNode(open);
    const id = current.id;
    if (current.cost !== cost[id]) continue;
    if (id === goal.id) {
      const path = [];
      for (let cursor = id; cursor >= 0; cursor = previous[cursor]) path.push(graph.nodes[cursor]);
      return path.reverse();
    }
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
      pushRouteNode(open, { id: next.id, cost: candidate, score: candidate + heuristic(next), sequence: sequence++ });
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
  const firstEdge = Math.floor(random() * 4);
  let best = null;
  let bestEdgeRank = Infinity;
  let bestMeetsQualityTargets = false;
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const edgeRank = Math.floor(attempt / 8);
    const edge = ["left","top","bottom","right"][(firstEdge + edgeRank) % 4];
    const nearFinishEdge = node => edge === "left" ? node.x <= terrain.width * 0.1
      : edge === "right" ? node.x + 9 >= terrain.width * 0.9
      : edge === "top" ? node.y - 9 <= terrain.height * 0.1
      : node.y + 9 >= terrain.height * 0.9;
    const starts = graph.anchors.filter(node => edge === "left" ? node.x + 6 >= terrain.width * 0.9
      : edge === "right" ? node.x <= terrain.width * 0.1
      : edge === "top" ? node.y + 9 >= terrain.height * 0.9
      : node.y <= terrain.height * 0.1);
    if (!starts.length) { reject("no opposing-edge start"); continue; }
    const start = starts[Math.floor(random() * starts.length)];
    const points = [start], used = new Set([start.id]), sections = [];
    let current = start;
    for (let section = 0; section < 5; section += 1) {
      const candidates = graph.anchors.filter((node) => {
        const separation = Math.abs(node.x - current.x) + Math.abs(node.y - current.y);
        return separation >= 80 && (section === 4 || separation <= 180) && !used.has(node.id)
          && (section < 4 || nearFinishEdge(node))
          && points.every((point) => Math.hypot(point.x - node.x, point.y - node.y) >= 16);
      });
      if (!candidates.length) break;
      let path = null;
      const sampledCandidates = [];
      for (let trial = 0; trial < Math.min(4, candidates.length); trial += 1) {
        const index = Math.floor(random() * candidates.length);
        sampledCandidates.push(candidates.splice(index, 1)[0]);
      }
      const estimatedDuration = node => Math.abs(node.x - current.x) + 4 * Math.abs(node.y - current.y);
      sampledCandidates.sort((left, right) => estimatedDuration(right) - estimatedDuration(left));
      for (const candidate of sampledCandidates) {
        path = pathBetween(current, candidate, graph, terrain, used, distance);
        if (path) break;
      }
      if (!path) break;
      for (const node of path.slice(1)) { points.push(node); used.add(node.id); }
      sections.push({ from: { x: current.x, y: current.y },
        to: { x: path.at(-1).x, y: path.at(-1).y } });
      current = path.at(-1);
    }
    if (sections.length < 2) { reject("too few connected sections"); continue; }
    if (!nearFinishEdge(current)) { reject("finish outside opposing edge band"); continue; }
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
    if (simulation.invalid
      || simulation.walking < 0.5 || simulation.climbing < 0.5 || !reachedFlag({ player: simulation.player, flag })) {
      reject(simulation.invalid ? simulation.reason
        : `reference duration ${simulation.seconds.toFixed(1)}s, walking ${simulation.walking.toFixed(1)}s`); continue;
    }
    const planned = { ...candidate, edge, route: { sections, actions: simulation.actions, seconds: simulation.seconds,
      clearance, protected: protect(terrain,clearance), points: points.map(({x,y}) => ({x,y})) },
      platforms,
      connectors: (terrain.connectors || []).filter(connector=>connector.cells.every(cell=>solid[cell])) };
    const meetsQualityTargets = sections.length >= 4 && sections.length <= 6
      && simulation.seconds >= 20 && simulation.seconds <= 40;
    if (!best || edgeRank < bestEdgeRank || (edgeRank === bestEdgeRank
      && ((meetsQualityTargets && !bestMeetsQualityTargets)
        || (meetsQualityTargets === bestMeetsQualityTargets && simulation.seconds > best.route.seconds)))) {
      best = planned;
      bestEdgeRank = edgeRank;
      bestMeetsQualityTargets = meetsQualityTargets;
    }
  }
  if (best) return best;
  if(!repair) return planReferenceRoute(terrain,random,true);
  throw new RouteGenerationError(Object.entries(failures).map(([reason, count]) => `${reason}: ${count}`).join("; "));
}

export function verifyReferenceRoute(level) {
  const start = {...level.spawn,width:6,height:9};
  const finish = {...level.flag,y:level.flag.y-level.flag.height};
  const checkpoints = level.checkpoints || [];
  if (checkpoints.length < 1 || checkpoints.length > 2) {
    return { valid: false, seconds: 0, reason: "mandatory checkpoint count" };
  }
  const opposed = level.edge === "left" ? finish.x <= level.width * 0.1
      && start.x + start.width >= level.width * 0.9
    : level.edge === "right" ? finish.x + finish.width >= level.width * 0.9 && start.x <= level.width * 0.1
    : level.edge === "top" ? finish.y <= level.height * 0.1
      && start.y + start.height >= level.height * 0.9
    : level.edge === "bottom" && finish.y + finish.height >= level.height * 0.9 && start.y <= level.height * 0.1;
  if (!opposed) return { valid: false, seconds: 0, reason: "endpoints outside opposing edge bands" };
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
  const checkpointRun = { player, flag: level.flag,
    checkpoints: checkpoints.map(checkpoint => ({ ...checkpoint, reached: false })) };
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
    collectCheckpoints(checkpointRun);
    const releasingUp = previous.upHeld && !action.input.moveY
      && level.route.actions[index + 1]?.input.moveY < 0;
    if (Math.hypot(player.x - previous.x, player.y - previous.y) < 1e-9
      && !releasingUp) {
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
    && reachedFlag(checkpointRun)
    && !walkingReachesFlag(level,walkingReachable(level,level.spawn),level.flag), seconds, openness };
}
