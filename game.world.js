// 星环回声 · game.world.js — 地形/相机/场景渲染/矿脉与传送带·分拣器绘制与吸附
// （由 game.js 拆分于 2026-09-22，加载顺序：core → world → sim → ui → tools → main）

function activeCareer() {
  return careerCatalog[state.career] || careerCatalog.logistics;
}

function activeCareerEffect(effect) {
  return Boolean(state.career) && activeCareer().effect === effect;
}

function careerLabel() {
  return state.career ? activeCareer().label : '选择职业';
}

let saveFailureNotified = false;
function saveGame() {
  if (qaDemoMode || qaPlaythroughMode || qaNormalMode) return;
  try {
  snapshotCurrentPlanet();
  localStorage.setItem(SAVE_KEY, JSON.stringify({
    buildings: state.buildings,
    belts: state.belts,
    inventory: state.inventory,
    kits: state.kits,
    nodes: state.nodes,
    time: state.time,
    tech: state.tech,
    research: state.research,
    interstellar: state.interstellar,
    stellarProject: state.stellarProject,
    activePlanet: state.activePlanet,
    planetSnapshots: state.planetSnapshots,
    career: state.career || 'logistics',
    careerChosen: state.careerChosen,
    items: state.items.map(item => ({ id: item.id, beltId: item.beltId, sourceId: item.sourceId, resource: item.resource, progress: item.progress }))
  }));
  } catch (error) {
    if (!saveFailureNotified) {
      saveFailureNotified = true;
      showToast('存档写入失败 · 请清理浏览器存储空间后重试', 'warning');
    }
    console.error('saveGame 写入失败，本次进度未保存:', error);
  }
}

function resize() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  state.viewport = { width: rect.width, height: rect.height };
}

function worldToScreen(x, y) {
  return {
    x: state.viewport.width / 2 + (x - state.camera.x) * TILE * state.zoom,
    y: state.viewport.height / 2 + (y - state.camera.y) * TILE * state.zoom
  };
}

function screenToCell(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const x = (clientX - rect.left - state.viewport.width / 2) / (TILE * state.zoom) + state.camera.x;
  const y = (clientY - rect.top - state.viewport.height / 2) / (TILE * state.zoom) + state.camera.y;
  return { x: Math.floor(x), y: Math.floor(y) };
}

function roundedRect(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

function drawTerrainTile(terrain, point, size, parity, gridX, gridY, target = ctx) {
  const base = terrain.kind === 'rock'
    ? (parity ? 'rgba(61,79,91,.58)' : 'rgba(54,71,84,.58)')
    : terrain.kind === 'water'
      ? (parity ? 'rgba(18,73,101,.7)' : 'rgba(15,63,91,.7)')
      : terrain.kind === 'void'
        ? 'rgba(4,12,21,.86)'
        : (parity ? 'rgba(18,42,54,.45)' : 'rgba(14,35,47,.45)');
  target.fillStyle = base;
  target.fillRect(point.x, point.y, size + 1, size + 1);

  const terrainTile = terrain.kind === 'water' ? assets.waterTile : terrain.kind === 'rock' ? assets.rockTile : assets.groundTile;
  if (terrain.kind !== 'void' && hasImage(terrainTile)) {
    target.save();
    target.globalAlpha = terrain.kind === 'water' ? .86 : terrain.kind === 'rock' ? .48 : .18;
    target.beginPath();
    target.rect(point.x, point.y, size + 1, size + 1);
    target.clip();
    const sourceSize = 48;
    const sourceX = ((gridX * sourceSize) % terrainTile.width + terrainTile.width) % terrainTile.width;
    const sourceY = ((gridY * sourceSize) % terrainTile.height + terrainTile.height) % terrainTile.height;
    target.drawImage(terrainTile, sourceX, sourceY, sourceSize, sourceSize, point.x, point.y, size, size);
    target.restore();
  }

  if (terrain.kind === 'water') {
    target.save();
      target.strokeStyle = 'rgba(142,236,235,.28)';
    target.lineWidth = Math.max(1, state.zoom * .8);
    [.28, .56, .78].forEach((offset, index) => {
      const waveY = point.y + size * offset;
      target.beginPath();
      target.moveTo(point.x + size * (.12 + (index % 2) * .08), waveY);
      target.quadraticCurveTo(point.x + size * .34, waveY - size * .06, point.x + size * .5, waveY);
      target.quadraticCurveTo(point.x + size * .66, waveY + size * .06, point.x + size * .88, waveY);
      target.stroke();
    });
    target.restore();
  } else if (terrain.kind === 'rock') {
    target.save();
    target.strokeStyle = 'rgba(183,204,207,.34)';
    target.fillStyle = 'rgba(183,204,207,.13)';
    target.lineWidth = Math.max(1, state.zoom * .8);
    target.beginPath();
    target.moveTo(point.x + size * .18, point.y + size * .7);
    target.lineTo(point.x + size * .34, point.y + size * .36);
    target.lineTo(point.x + size * .55, point.y + size * .54);
    target.lineTo(point.x + size * .77, point.y + size * .24);
    target.lineTo(point.x + size * .86, point.y + size * .76);
    target.closePath();
    target.fill();
    target.stroke();
    target.restore();
  } else if (terrain.kind === 'plain') {
    target.save();
    target.strokeStyle = 'rgba(105,216,218,.08)';
    target.lineWidth = 1;
    target.strokeRect(point.x + size * .16, point.y + size * .16, size * .68, size * .68);
    target.restore();
  }
}

let terrainLayerCache = null;
let terrainLayerSignature = '';
function drawGround() {
  const { width, height } = state.viewport;
  const tileSize = TILE * state.zoom;
  const signature = `${state.activePlanet}|${width}|${height}|${state.camera.x}|${state.camera.y}|${state.zoom}|${state.tool === 'belt'}`;
  if (signature !== terrainLayerSignature) {
    terrainLayerSignature = signature;
    if (!terrainLayerCache || terrainLayerCache.width !== width || terrainLayerCache.height !== height) {
      terrainLayerCache = document.createElement('canvas');
      terrainLayerCache.width = width;
      terrainLayerCache.height = height;
    }
    const layer = terrainLayerCache.getContext('2d');
    layer.setTransform(1, 0, 0, 1, 0, 0);
    layer.clearRect(0, 0, width, height);
    layer.fillStyle = '#081522';
    layer.fillRect(0, 0, width, height);
    if (hasImage(assets.groundTile)) {
      const groundPattern = layer.createPattern(assets.groundTile, 'repeat');
      if (groundPattern) {
        layer.save();
        layer.globalAlpha = .16;
        layer.fillStyle = groundPattern;
        layer.fillRect(0, 0, width, height);
        layer.restore();
      }
    }
    const minX = Math.floor(state.camera.x - width / (2 * tileSize)) - 2;
    const maxX = Math.ceil(state.camera.x + width / (2 * tileSize)) + 2;
    const minY = Math.floor(state.camera.y - height / (2 * tileSize)) - 2;
    const maxY = Math.ceil(state.camera.y + height / (2 * tileSize)) + 2;
    for (let x = minX; x <= maxX; x += 1) {
      for (let y = minY; y <= maxY; y += 1) {
        const point = worldToScreen(x, y);
        drawTerrainTile(terrainAt({ x, y }), point, tileSize, Math.abs(x + y) % 2, x, y, layer);
      }
    }
    layer.strokeStyle = state.tool === 'belt' ? 'rgba(105,216,218,.28)' : 'rgba(165,204,200,.1)';
    layer.lineWidth = 1;
    for (let x = minX; x <= maxX + 1; x += 1) {
      const point = worldToScreen(x, minY);
      layer.beginPath(); layer.moveTo(point.x, point.y); layer.lineTo(point.x, worldToScreen(x, maxY + 1).y); layer.stroke();
    }
    for (let y = minY; y <= maxY + 1; y += 1) {
      const point = worldToScreen(minX, y);
      layer.beginPath(); layer.moveTo(point.x, point.y); layer.lineTo(worldToScreen(maxX + 1, y).x, point.y); layer.stroke();
    }
  }
  if (terrainLayerCache) ctx.drawImage(terrainLayerCache, 0, 0);
  for (let index = 0; index < 90; index += 1) {
    const x = ((index * 83) % Math.max(width, 1));
    const y = ((index * 47 + 31) % Math.max(height, 1));
    const radius = index % 7 === 0 ? 1.4 : .7;
    const twinkle = .7 + Math.sin(state.animTime * 1.7 + index * 2.4) * .3;
    ctx.fillStyle = index % 4 === 0 ? `rgba(105,216,218,${.32 * twinkle})` : `rgba(225,241,230,${.28 * twinkle})`;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawDysonConstruction() {
  const progress = state.stellarProject?.progress || 0;
  if (progress <= 0) return;
  const projectCenter = worldToScreen(.5, .5);
  const radius = TILE * state.zoom * 2.8;
  const builtSegments = Math.ceil(progress / 12.5);
  ctx.save();
  ctx.translate(projectCenter.x, projectCenter.y);
  ctx.rotate(state.animTime * .05);
  for (let index = 0; index < 8; index += 1) {
    const angle = index * Math.PI / 4;
    const start = angle + .08;
    const end = angle + Math.PI / 4 - .08;
    ctx.strokeStyle = index < builtSegments ? '#c7d94cbb' : '#69d8da25';
    ctx.lineWidth = Math.max(1, state.zoom * 1.3);
    ctx.beginPath(); ctx.arc(0, 0, radius + Math.sin(state.animTime * 1.2 + index) * 2, start, end); ctx.stroke();
    if (index < builtSegments) {
      const nodeAngle = (start + end) / 2;
      ctx.fillStyle = '#f7f5bb'; ctx.shadowColor = '#c7d94c'; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(Math.cos(nodeAngle) * radius, Math.sin(nodeAngle) * radius, Math.max(1.5, state.zoom * 2), 0, Math.PI * 2); ctx.fill();
    }
  }
  const componentCounts = { sail: 0, rocket: 0, node: 0 };
  (state.stellarProject?.components || []).forEach(component => { componentCounts[component.type] = (componentCounts[component.type] || 0) + 1; });
  const orbitRadius = radius * 1.22;
  [['sail', '#f7f0ae'], ['rocket', '#ffb879']].forEach(([type, color], lane) => {
    const count = componentCounts[type] || 0;
    if (!count) return;
    ctx.strokeStyle = `${color}85`;
    ctx.lineWidth = Math.max(1, state.zoom * .8);
    ctx.setLineDash([3, 5]);
    ctx.beginPath();
    ctx.arc(0, 0, orbitRadius + lane * TILE * state.zoom * .16, state.animTime * .08 + lane, state.animTime * .08 + lane + Math.min(Math.PI * 1.8, count / 12 * Math.PI * 2));
    ctx.stroke();
    ctx.setLineDash([]);
  });
  ctx.restore();
}

function drawResourceNode(node) {
  const point = worldToScreen(node.x + .5, node.y + .5);
  const size = clamp(92 * state.zoom, 45, 120);
  const meta = resources[node.resource];
  ctx.save();
  ctx.globalAlpha = .96;
  ctx.fillStyle = `${meta.color}18`;
  ctx.beginPath(); ctx.arc(point.x, point.y + size * .22, size * .46, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = `${meta.color}55`;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(point.x, point.y + size * .22, size * .46, 0, Math.PI * 2); ctx.stroke();
  const nodeAsset = rasterizedAsset(meta.image);
  if (nodeAsset) {
    const pulse = 1 + Math.sin(state.animTime * 1.8 + node.x * .7 + node.y) * .035;
    const imageSize = size * pulse;
    ctx.drawImage(nodeAsset, point.x - imageSize / 2, point.y - imageSize / 2, imageSize, imageSize);
  } else {
    drawResourceGlyph(node.resource, point.x, point.y, size * .72, .92);
  }
  if (state.zoom >= .62) {
    ctx.fillStyle = 'rgba(4,13,22,.82)';
    roundedRect(ctx, point.x - 39, point.y + size * .44, 78, 18, 3); ctx.fill();
    ctx.fillStyle = meta.color;
    ctx.font = '700 9px Bahnschrift, sans-serif'; ctx.textAlign = 'center';
    const cachedLabel = nodeLabelCache.get(node);
    const labelText = cachedLabel && cachedLabel.amount === node.amount && cachedLabel.label === meta.label
      ? cachedLabel.text
      : `${meta.label}矿脉  ${formatNumber(node.amount)}`;
    if (!cachedLabel || cachedLabel.amount !== node.amount || cachedLabel.label !== meta.label) {
      nodeLabelCache.set(node, { amount: node.amount, label: meta.label, text: labelText });
    }
    ctx.fillText(labelText, point.x, point.y + size * .44 + 12);
  }
  ctx.restore();
}

function drawResourceNodeCore(node) {
  const point = worldToScreen(node.x, node.y);
  const size = TILE * state.zoom;
  const meta = resources[node.resource];
  ctx.save();
  ctx.globalAlpha = .84;
  ctx.fillStyle = `${meta.color}10`;
  ctx.fillRect(point.x + 2, point.y + 2, size - 4, size - 4);
  ctx.strokeStyle = `${meta.color}b8`;
  ctx.lineWidth = Math.max(1, state.zoom * 1.4);
  ctx.setLineDash([4, 3]);
  ctx.strokeRect(point.x + 2, point.y + 2, size - 4, size - 4);
  ctx.setLineDash([]);
  ctx.strokeStyle = `${meta.color}dd`;
  ctx.lineWidth = Math.max(1, state.zoom);
  ctx.beginPath();
  ctx.moveTo(point.x + size * .32, point.y + size * .5);
  ctx.lineTo(point.x + size * .68, point.y + size * .5);
  ctx.moveTo(point.x + size * .5, point.y + size * .32);
  ctx.lineTo(point.x + size * .5, point.y + size * .68);
  ctx.stroke();
  ctx.restore();
}

function drawResourceGlyph(resource, centerX, centerY, size, alpha = 1) {
  const meta = resources[resource] || { color: '#c7d94c' };
  const color = meta.color;
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.fillStyle = `${color}55`;
  ctx.lineWidth = Math.max(1, size * .035);
  if (resource.endsWith('Cube')) {
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-size * .25, -size * .25, size * .5, size * .5);
    ctx.strokeRect(-size * .25, -size * .25, size * .5, size * .5);
    ctx.globalAlpha *= .8;
    ctx.strokeRect(-size * .14, -size * .14, size * .28, size * .28);
    ctx.rotate(-Math.PI / 4);
    ctx.beginPath(); ctx.arc(0, 0, size * .42, 0, Math.PI * 2); ctx.stroke();
    if (resource === 'energyCube') {
      ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, -size * .3); ctx.lineTo(size * .09, -size * .03); ctx.lineTo(-size * .06, -size * .03); ctx.lineTo(size * .02, size * .3); ctx.lineTo(-size * .12, size * .04); ctx.lineTo(size * .03, size * .04); ctx.closePath(); ctx.fill();
    } else if (resource === 'informationCube') {
      ctx.strokeStyle = color; ctx.lineWidth = Math.max(1, size * .022);
      [-.16, 0, .16].forEach(offset => { ctx.beginPath(); ctx.moveTo(-size * .23, size * offset); ctx.lineTo(size * .23, size * offset); ctx.stroke(); });
    } else if (resource === 'structureCube') {
      ctx.strokeStyle = '#fff1ffaa'; ctx.lineWidth = Math.max(1, size * .024);
      ctx.beginPath(); ctx.moveTo(-size * .2, 0); ctx.lineTo(0, -size * .2); ctx.lineTo(size * .2, 0); ctx.lineTo(0, size * .2); ctx.closePath(); ctx.stroke();
    }
  } else {
    ctx.beginPath(); ctx.moveTo(0, -size * .42); ctx.lineTo(size * .34, size * .12); ctx.lineTo(0, size * .42); ctx.lineTo(-size * .34, size * .12); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff6d688'; ctx.beginPath(); ctx.arc(-size * .08, -size * .1, size * .055, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function getBeltEnd(belt) {
  return { x: belt.x + belt.dx * (belt.length - 1), y: belt.y + belt.dy * (belt.length - 1) };
}

function beltCells(belt) {
  return Array.from({ length: belt.length }, (_, index) => ({ x: belt.x + belt.dx * index, y: belt.y + belt.dy * index }));
}

function beltEndsAt(cell) {
  return state.belts.some(belt => {
    const end = getBeltEnd(belt);
    return end.x === cell.x && end.y === cell.y;
  });
}

function trimBeltExtension(start, segments) {
  if (!start || !beltEndsAt(start) || !segments.length) return segments;
  const first = segments[0];
  if (first.x !== start.x || first.y !== start.y || first.length <= 1 || (first.dx === 0 && first.dy === 0)) return segments;
  return [{ ...first, x: first.x + first.dx, y: first.y + first.dy, length: first.length - 1 }, ...segments.slice(1)];
}

function freeBeltSegments(segments, start) {
  const free = [];
  segments.forEach(segment => {
    let run = null;
    const flush = () => {
      if (run) free.push(run);
      run = null;
    };
    beltCells(segment).forEach((cell, index) => {
      const isSharedStart = segment === segments[0] && index === 0 && start
        && cell.x === start.x && cell.y === start.y;
      if (beltAt(cell) && !isSharedStart) { flush(); return; }
      if (!run) run = { x: cell.x, y: cell.y, dx: segment.dx, dy: segment.dy, length: 0 };
      run.length += 1;
    });
    flush();
  });
  return free;
}

function beltSegmentsBetween(start, end) {
  return beltSegmentsBetweenOrder(start, end, false);
}

function beltSegmentsBetweenOrder(start, end, verticalFirst = false) {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  // A one-cell belt is a valid port bridge between two adjacent buildings.
  if (deltaX === 0 && deltaY === 0) return [{ x: start.x, y: start.y, dx: 0, dy: 0, length: 1 }];
  if (deltaX === 0) return [{ x: start.x, y: start.y, dx: 0, dy: Math.sign(deltaY), length: Math.abs(deltaY) + 1 }];
  if (deltaY === 0) return [{ x: start.x, y: start.y, dx: Math.sign(deltaX), dy: 0, length: Math.abs(deltaX) + 1 }];

  if (verticalFirst) {
    return [
      { x: start.x, y: start.y, dx: 0, dy: Math.sign(deltaY), length: Math.abs(deltaY) },
      { x: start.x, y: end.y, dx: Math.sign(deltaX), dy: 0, length: Math.abs(deltaX) + 1 }
    ];
  }

  if (deltaY === 0) {
    return [{ x: start.x, y: start.y, dx: Math.sign(deltaX), dy: 0, length: Math.abs(deltaX) + 1 }];
  }

  return [
    { x: start.x, y: start.y, dx: Math.sign(deltaX), dy: 0, length: Math.abs(deltaX) },
    { x: end.x, y: start.y, dx: 0, dy: Math.sign(deltaY), length: Math.abs(deltaY) + 1 }
  ];
}

function beltPathToSegments(path) {
  if (!path || path.length < 2) return [];
  const segments = [];
  let segmentStart = 0;
  let dx = path[1].x - path[0].x;
  let dy = path[1].y - path[0].y;
  for (let index = 1; index < path.length; index += 1) {
    const nextDx = index < path.length - 1 ? path[index + 1].x - path[index].x : dx;
    const nextDy = index < path.length - 1 ? path[index + 1].y - path[index].y : dy;
    if (index === path.length - 1) {
      segments.push({ x: path[segmentStart].x, y: path[segmentStart].y, dx, dy, length: index - segmentStart + 1 });
    } else if (nextDx !== dx || nextDy !== dy) {
      // Put a corner cell on the following segment, matching the straight-L
      // route representation used by the rest of the belt system.
      segments.push({ x: path[segmentStart].x, y: path[segmentStart].y, dx, dy, length: index - segmentStart });
      segmentStart = index;
      dx = nextDx;
      dy = nextDy;
    }
  }
  return segments;
}

function findBeltPath(start, end) {
  if (!start || !end || (start.x === end.x && start.y === end.y)) return [];
  const queue = [{ cell: start, path: [start], direction: null }];
  const visited = new Set([`${start.x},${start.y},none`]);
  const directions = [
    { dx: Math.sign(end.x - start.x), dy: 0 },
    { dx: 0, dy: Math.sign(end.y - start.y) },
    { dx: Math.sign(start.x - end.x), dy: 0 },
    { dx: 0, dy: Math.sign(start.y - end.y) }
  ].filter(direction => direction.dx !== 0 || direction.dy !== 0);
  const isOpen = cell => {
    if (!isInsideWorld(cell) || isTerrainBlocked(cell)) return false;
    if ((cell.x !== start.x || cell.y !== start.y) && (cell.x !== end.x || cell.y !== end.y) && beltAt(cell)) return false;
    return !overlapsBuilding(cell.x, cell.y, 1);
  };
  while (queue.length) {
    const current = queue.shift();
    if (current.cell.x === end.x && current.cell.y === end.y) return beltPathToSegments(current.path);
    directions.forEach(direction => {
      const next = { x: current.cell.x + direction.dx, y: current.cell.y + direction.dy };
      if (!isOpen(next)) return;
      const key = `${next.x},${next.y},${direction.dx},${direction.dy}`;
      if (visited.has(key)) return;
      visited.add(key);
      queue.push({ cell: next, path: [...current.path, next], direction });
    });
  }
  return [];
}

function drawBelt(belt, preview = false) {
  const selected = state.selectedBeltId === belt.id;
  const color = preview ? '#69d8da' : selected ? '#c7d94c' : '#4db7c2';
  beltCells(belt).forEach((cell, index) => {
    const point = worldToScreen(cell.x, cell.y);
    const size = TILE * state.zoom;
    const horizontal = belt.dx !== 0;
    ctx.save();
    ctx.globalAlpha = preview ? .55 : selected ? .98 : .88;
    ctx.fillStyle = preview ? 'rgba(105,216,218,.22)' : 'rgba(16,49,63,.94)';
    const bridge = belt.dx === 0 && belt.dy === 0;
    const beltX = bridge ? point.x + size * .2 : horizontal ? point.x + 4 : point.x + size * .33;
    const beltY = bridge ? point.y + size * .2 : horizontal ? point.y + size * .33 : point.y + 4;
    const beltWidth = bridge ? size * .6 : horizontal ? size - 8 : size * .34;
    const beltHeight = bridge ? size * .6 : horizontal ? size * .34 : size - 8;
    roundedRect(ctx, beltX, beltY, beltWidth, beltHeight, 4); ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, state.zoom * (selected ? 2.4 : 1.5));
    ctx.stroke();
    if (selected) {
      ctx.save();
      ctx.strokeStyle = 'rgba(199,217,76,.5)';
      ctx.lineWidth = Math.max(1, state.zoom * 4.2);
      ctx.globalAlpha = .34;
      ctx.stroke();
      ctx.restore();
    }
    const arrowX = point.x + size / 2 + belt.dx * size * .17;
    const arrowY = point.y + size / 2 + belt.dy * size * .17;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    if (!bridge) {
      ctx.beginPath();
      ctx.moveTo(arrowX - belt.dx * 4 - belt.dy * 3, arrowY - belt.dy * 4 + belt.dx * 3);
      ctx.lineTo(arrowX, arrowY);
      ctx.lineTo(arrowX - belt.dx * 4 + belt.dy * 3, arrowY - belt.dy * 4 - belt.dx * 3);
      ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(arrowX, arrowY, Math.max(2, state.zoom * 2.3), 0, Math.PI * 2); ctx.stroke();
    }
    if (!preview) {
      const flow = (state.animTime * 1.8 + index * .21) % 1;
      const flowPoint = {
        x: point.x + size / 2 + belt.dx * (flow - .5) * size * .58,
        y: point.y + size / 2 + belt.dy * (flow - .5) * size * .58
      };
      ctx.fillStyle = '#b9ffff';
      ctx.globalAlpha = .42;
      ctx.beginPath(); ctx.arc(flowPoint.x, flowPoint.y, Math.max(1.2, state.zoom * 1.4), 0, Math.PI * 2); ctx.fill();
    }
    if (index === belt.length - 1 && !preview) {
      ctx.fillStyle = '#b9ffff'; ctx.beginPath(); ctx.arc(point.x + size / 2, point.y + size / 2, 2.4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  });
}

function isBuildingActive(building) {
  if (!isBuildingOperational(building)) return false;
  if (state.paused) return false;
  if (isPowerTowerType(building)) return getGridPowerState(building).powered;
  if (building.type === 'wind') return getGridPowerState(building).powered;
  if (building.type === 'thermal') return getGridPowerState(building).powered && (building.input.coal || 0) > 0;
  if (['miner', 'oilExtractor', 'waterPump', 'gasExtractor'].includes(building.type)) return building.timer > .15 || Object.values(building.output).some(amount => amount > 0);
  return building.process > .05 || Object.values(building.input).some(amount => amount > 0);
}

function drawMachineAnimation(building, size) {
  const meta = buildings[building.type];
  const active = isBuildingActive(building);
  const time = state.animTime;
  const color = meta.color;
  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  if (building.type === 'miner') {
    ctx.rotate(time * (active ? 3.4 : .35));
    ctx.strokeStyle = `${color}${active ? 'bb' : '45'}`;
    ctx.lineWidth = Math.max(1, size * .018);
    for (let index = 0; index < 3; index += 1) {
      ctx.rotate(Math.PI * 2 / 3);
      ctx.beginPath(); ctx.moveTo(0, -size * .08); ctx.lineTo(size * .28, -size * .05); ctx.stroke();
    }
    ctx.fillStyle = `${color}${active ? 'dd' : '55'}`;
    ctx.beginPath(); ctx.arc(0, 0, size * .055, 0, Math.PI * 2); ctx.fill();
  } else if (building.type === 'smelter' || building.type === 'thermal') {
    const flicker = .82 + Math.sin(time * 9 + building.x) * .12;
    ctx.fillStyle = `${building.type === 'thermal' ? '#ffb15b' : '#ffd06a'}${active ? 'bb' : '28'}`;
    ctx.beginPath(); ctx.moveTo(-size * .13, size * .25); ctx.quadraticCurveTo(-size * .2, size * (.04 - flicker * .08), 0, -size * (.2 + flicker * .06)); ctx.quadraticCurveTo(size * .18, size * .02, size * .12, size * .25); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff1b0'; ctx.globalAlpha = active ? .78 : .12;
    ctx.beginPath(); ctx.arc(0, size * .08, size * .04, 0, Math.PI * 2); ctx.fill();
  } else if (building.type === 'assembler' || building.type === 'workbench') {
    ctx.rotate(Math.sin(time * (active ? 3.2 : .45) + building.y) * .4);
    ctx.strokeStyle = `${color}${active ? 'c0' : '3d'}`;
    ctx.lineWidth = Math.max(1, size * .02);
    ctx.beginPath(); ctx.moveTo(-size * .28, -size * .2); ctx.lineTo(size * .12, -size * .06); ctx.lineTo(size * .25, size * .18); ctx.stroke();
    ctx.fillStyle = `${color}${active ? 'dd' : '45'}`;
    ctx.beginPath(); ctx.arc(-size * .28, -size * .2, size * .045, 0, Math.PI * 2); ctx.arc(size * .25, size * .18, size * .065, 0, Math.PI * 2); ctx.fill();
  } else if (building.type === 'researchLab') {
    ctx.rotate(time * (active ? .8 : .12));
    ctx.strokeStyle = `${color}${active ? 'c8' : '38'}`;
    ctx.lineWidth = Math.max(1, size * .014);
    ctx.beginPath(); ctx.arc(0, 0, size * .29, -.6, Math.PI * 1.15); ctx.stroke();
    ctx.strokeStyle = '#c7d94c66';
    ctx.beginPath(); ctx.arc(0, 0, size * .22, Math.PI * .4, Math.PI * 1.65); ctx.stroke();
    if (active) { ctx.fillStyle = '#eafecf'; ctx.beginPath(); ctx.arc(Math.cos(time * 2) * size * .29, Math.sin(time * 2) * size * .29, size * .035, 0, Math.PI * 2); ctx.fill(); }
  } else if (building.type === 'wind') {
    ctx.rotate(time * .9);
    ctx.strokeStyle = `${color}aa`; ctx.lineWidth = Math.max(1, size * .018);
    for (let index = 0; index < 4; index += 1) { ctx.rotate(Math.PI / 2); ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(size * .12, -size * .16, size * .3, -size * .27); ctx.stroke(); }
    ctx.fillStyle = '#effff8'; ctx.beginPath(); ctx.arc(0, 0, size * .045, 0, Math.PI * 2); ctx.fill();
  } else if (building.type === 'oilExtractor') {
    const lift = Math.sin(time * 2.7) * size * .12;
    ctx.strokeStyle = `${color}aa`; ctx.lineWidth = Math.max(1, size * .022);
    ctx.beginPath(); ctx.moveTo(0, -size * .18); ctx.lineTo(0, size * .2 + lift); ctx.stroke();
    ctx.fillStyle = `${color}bb`; ctx.beginPath(); ctx.arc(0, size * .2 + lift, size * .07, 0, Math.PI * 2); ctx.fill();
  } else if (building.type === 'waterPump') {
    const lift = Math.sin(time * 2.7) * size * .08;
    ctx.strokeStyle = `${color}aa`; ctx.lineWidth = Math.max(1, size * .022);
    ctx.beginPath(); ctx.moveTo(-size * .2, size * .18); ctx.lineTo(0, -size * .18 + lift); ctx.lineTo(size * .2, size * .18); ctx.stroke();
    ctx.fillStyle = `${color}bb`; ctx.beginPath(); ctx.arc(0, -size * .18 + lift, size * .07, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawBuildingFallback(building, size) {
  const color = buildings[building.type].color;
  ctx.save();
  ctx.lineWidth = Math.max(1, size * .018);
  ctx.strokeStyle = color;
  ctx.fillStyle = `${color}2c`;
  if (building.type === 'researchLab') {
    ctx.fillStyle = '#0b3449';
    ctx.beginPath(); ctx.moveTo(size * .17, size * .7); ctx.lineTo(size * .28, size * .26); ctx.lineTo(size * .72, size * .26); ctx.lineTo(size * .83, size * .7); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = `${color}88`; ctx.beginPath(); ctx.arc(size / 2, size * .4, size * .16, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#d8ffffaa'; ctx.beginPath(); ctx.moveTo(size * .23, size * .74); ctx.lineTo(size * .77, size * .74); ctx.stroke();
  } else if (building.type === 'sorter') {
    ctx.fillStyle = '#123b4a'; ctx.fillRect(size * .2, size * .3, size * .6, size * .4); ctx.strokeRect(size * .2, size * .3, size * .6, size * .4);
    ctx.beginPath(); ctx.moveTo(size * .48, size * .48); ctx.lineTo(size * .78, size * .18); ctx.moveTo(size * .52, size * .52); ctx.lineTo(size * .8, size * .82); ctx.stroke();
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(size * .48, size * .5, size * .07, 0, Math.PI * 2); ctx.fill();
  } else if (building.type === 'wind') {
    ctx.fillStyle = '#183d4a'; ctx.fillRect(size * .42, size * .45, size * .16, size * .32); ctx.strokeRect(size * .42, size * .45, size * .16, size * .32);
    ctx.beginPath(); ctx.moveTo(size * .5, size * .5); ctx.lineTo(size * .18, size * .25); ctx.moveTo(size * .5, size * .5); ctx.lineTo(size * .78, size * .24); ctx.moveTo(size * .5, size * .5); ctx.lineTo(size * .82, size * .72); ctx.stroke();
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(size * .5, size * .5, size * .07, 0, Math.PI * 2); ctx.fill();
  } else if (isPowerTowerType(building)) {
    ctx.strokeStyle = `${color}aa`;
    ctx.lineWidth = Math.max(1, size * .025);
    ctx.beginPath(); ctx.moveTo(size * .5, size * .16); ctx.lineTo(size * .5, size * .84); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(size * .28, size * .82); ctx.lineTo(size * .5, size * .16); ctx.lineTo(size * .72, size * .82); ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(size * .5, size * .16, size * .08, 0, Math.PI * 2); ctx.fill();
    if (building.gridEnabled === false) {
      ctx.strokeStyle = '#ee6a65';
      ctx.beginPath(); ctx.moveTo(size * .27, size * .27); ctx.lineTo(size * .73, size * .73); ctx.stroke();
    }
  } else if (building.type === 'thermal') {
    ctx.fillStyle = '#351f27'; ctx.fillRect(size * .2, size * .36, size * .6, size * .38); ctx.strokeRect(size * .2, size * .36, size * .6, size * .38);
    ctx.fillStyle = '#ffb15b'; ctx.beginPath(); ctx.arc(size * .5, size * .55, size * .13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1e2835'; ctx.fillRect(size * .55, size * .12, size * .16, size * .28); ctx.strokeRect(size * .55, size * .12, size * .16, size * .28);
  } else if (building.type === 'oilExtractor') {
    ctx.fillStyle = '#382b2a'; ctx.fillRect(size * .18, size * .64, size * .64, size * .1); ctx.strokeRect(size * .18, size * .64, size * .64, size * .1);
    ctx.beginPath(); ctx.moveTo(size * .28, size * .64); ctx.lineTo(size * .4, size * .2); ctx.lineTo(size * .6, size * .2); ctx.lineTo(size * .73, size * .64); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(size * .3, size * .24); ctx.lineTo(size * .73, size * .4); ctx.stroke();
  } else if (building.type === 'workbench') {
    ctx.fillStyle = '#3d2a2b'; ctx.fillRect(size * .16, size * .46, size * .68, size * .22); ctx.strokeRect(size * .16, size * .46, size * .68, size * .22);
    ctx.beginPath(); ctx.moveTo(size * .26, size * .68); ctx.lineTo(size * .22, size * .82); ctx.moveTo(size * .72, size * .68); ctx.lineTo(size * .77, size * .82); ctx.stroke();
    ctx.fillStyle = color; ctx.fillRect(size * .42, size * .25, size * .18, size * .2); ctx.strokeRect(size * .42, size * .25, size * .18, size * .2);
  } else if (building.type === 'waterPump') {
    ctx.fillStyle = '#123849'; ctx.fillRect(size * .18, size * .58, size * .64, size * .12); ctx.strokeRect(size * .18, size * .58, size * .64, size * .12);
    ctx.beginPath(); ctx.moveTo(size * .28, size * .58); ctx.lineTo(size * .5, size * .2); ctx.lineTo(size * .72, size * .58); ctx.stroke();
    ctx.fillStyle = '#78e1ff'; ctx.beginPath(); ctx.arc(size * .5, size * .22, size * .07, 0, Math.PI * 2); ctx.fill();
  } else if (building.type === 'gasExtractor') {
    ctx.fillStyle = '#203b3c'; ctx.fillRect(size * .18, size * .58, size * .64, size * .12); ctx.strokeRect(size * .18, size * .58, size * .64, size * .12);
    ctx.beginPath(); ctx.moveTo(size * .3, size * .58); ctx.lineTo(size * .5, size * .18); ctx.lineTo(size * .7, size * .58); ctx.stroke();
    ctx.strokeStyle = '#b6e7ba'; ctx.beginPath(); ctx.arc(size * .5, size * .3, size * .1, 0, Math.PI * 2); ctx.stroke();
  } else if (isStorageType(building)) {
    ctx.fillStyle = building.type === 'logisticsStation' ? '#302447' : '#20344e';
    roundedRect(ctx, size * .15, size * .2, size * .7, size * .54, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = `${color}99`;
    for (let index = 0; index < (building.type === 'logisticsStation' ? 3 : 2); index += 1) {
      ctx.fillRect(size * (.25 + index * .2), size * .31, size * .12, size * .28);
    }
    ctx.strokeStyle = '#e5f5ff88';
    ctx.beginPath(); ctx.moveTo(size * .2, size * .8); ctx.lineTo(size * .8, size * .8); ctx.stroke();
  } else {
    ctx.fillStyle = `${color}25`;
    roundedRect(ctx, size * .18, size * .18, size * .64, size * .46, 4); ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 1.3;
    roundedRect(ctx, size * .18, size * .18, size * .64, size * .46, 4); ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(size / 2, size * .41, size * .1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(225,241,230,.56)';
    ctx.fillRect(size * .22, size * .76, size * .12, 3); ctx.fillRect(size * .44, size * .76, size * .12, 3); ctx.fillRect(size * .66, size * .76, size * .12, 3);
  }
  ctx.restore();
}

function drawBuilding(building) {
  const meta = buildings[building.type];
  const point = worldToScreen(building.x, building.y);
  const size = meta.size * TILE * state.zoom;
  const selected = state.selectedId === building.id;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,.34)';
  roundedRect(ctx, point.x + 4, point.y + 7, size - 8, size - 7, 5); ctx.fill();
  ctx.translate(point.x + size / 2, point.y + size / 2);
  ctx.rotate((building.rotation * Math.PI) / 180);
  ctx.translate(-size / 2, -size / 2);
  ctx.fillStyle = 'rgba(14,29,42,.96)';
  roundedRect(ctx, 2, 2, size - 4, size - 6, 5); ctx.fill();
  ctx.strokeStyle = meta.color;
  ctx.lineWidth = selected ? 2.4 : 1.2;
  ctx.stroke();

  if (hasImage(assets[meta.image])) {
    const active = isBuildingActive(building);
    const imageScale = active ? 1 + Math.sin(state.animTime * 4 + building.x) * .014 : 1;
    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.scale(imageScale, imageScale);
    const buildingSprite = rasterizedAsset(meta.image) || assets[meta.image];
    ctx.drawImage(buildingSprite, -size * .48, -size * .48, size * .96, size * .96);
    if (active) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `${meta.color}66`;
      ctx.lineWidth = Math.max(1, state.zoom * 1.7);
      ctx.beginPath(); ctx.arc(0, 0, size * (.34 + Math.sin(state.animTime * 3) * .012), state.animTime * .7, state.animTime * .7 + Math.PI * 1.35); ctx.stroke();
    }
    ctx.restore();
  } else {
    drawBuildingFallback(building, size);
  }
  drawMachineAnimation(building, size);
  ctx.restore();

  if (selected) {
    ctx.save();
    ctx.strokeStyle = `${meta.color}cc`; ctx.setLineDash([5, 4]); ctx.lineWidth = 1;
    ctx.strokeRect(point.x - 3, point.y - 3, size + 6, size + 2); ctx.setLineDash([]);
    ctx.fillStyle = meta.color; ctx.beginPath(); ctx.arc(point.x + size / 2, point.y - 8, 3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  const level = getBuildingLevel(building.type);
  if (level > 1) {
    ctx.save();
    const badge = `MK-${Math.min(level, 3)}`;
    const badgeWidth = 30 * state.zoom;
    const badgeHeight = 12 * state.zoom;
    ctx.fillStyle = 'rgba(6, 16, 27, .9)';
    ctx.strokeStyle = '#c7d94c';
    ctx.lineWidth = 1;
    roundedRect(ctx, point.x + size - badgeWidth - 2, point.y - badgeHeight - 3, badgeWidth, badgeHeight, 3);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#c7d94c';
    ctx.font = `${Math.max(7, 8 * state.zoom)}px Bahnschrift, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(badge, point.x + size - badgeWidth / 2 - 2, point.y - badgeHeight / 2 - 3);
    ctx.restore();
  }

  const status = buildingStatus(building);
  if (['科技锁定', '电力不足', '电网瘫痪', '电网高负载', '输出堵塞', '缺少输入', '等待矩阵组件', '缺煤', '缺气', '缺太阳帆', '缺结构火箭', '未接入水源', '未接入电网'].includes(status)) {
    const pulse = 1 + Math.sin(state.animTime * 4.2 + building.x * .7 + building.y) * .08;
    ctx.save();
    ctx.strokeStyle = status === '输出堵塞' ? '#ff9b3d' : '#ee6a65';
    ctx.globalAlpha = .48;
    ctx.lineWidth = Math.max(1, state.zoom * 1.2);
    ctx.beginPath();
    ctx.arc(point.x + size / 2, point.y + size / 2, size * .53 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function buildingPortCells(building) {
  const size = buildings[building.type].size;
  const ports = [];
  for (let index = 0; index < size; index += 1) {
    ports.push({ x: building.x + index, y: building.y - 1 });
    ports.push({ x: building.x + index, y: building.y + size });
    ports.push({ x: building.x - 1, y: building.y + index });
    ports.push({ x: building.x + size, y: building.y + index });
  }
  return ports.filter((port, index, allPorts) => allPorts.findIndex(item => item.x === port.x && item.y === port.y) === index);
}

function isSorterTargetBuilding(building) {
  return Boolean(building && building.type !== 'sorter' && !isPowerTowerType(building) && buildings[building.type]);
}

function sorterBeltEndpointAt(cell, preferred = 'end') {
  if (!cell) return null;
  const matches = [];
  state.belts.forEach(belt => {
    const start = { x: belt.x, y: belt.y };
    const end = getBeltEnd(belt);
    const sameStart = start.x === cell.x && start.y === cell.y;
    const sameEnd = end.x === cell.x && end.y === cell.y;
    if (sameStart && sameEnd) matches.push({ belt, endpoint: preferred });
    else if (sameStart) matches.push({ belt, endpoint: 'start' });
    else if (sameEnd) matches.push({ belt, endpoint: 'end' });
  });
  return matches.sort((left, right) => (left.endpoint === preferred ? -1 : 1) - (right.endpoint === preferred ? -1 : 1) || left.belt.id.localeCompare(right.belt.id))[0] || null;
}

function sorterPlacementCandidates(building, belt, mode) {
  if (!isSorterTargetBuilding(building) || !belt) return [];
  const endpoint = mode === 'output' ? { x: belt.x, y: belt.y } : getBeltEnd(belt);
  const center = buildingCenter(building);
  const seen = new Set();
  return buildingPortCells(building)
    .filter(cell => {
      const key = `${cell.x},${cell.y}`;
      if (seen.has(key)) return false;
      seen.add(key);
      const candidate = { type: 'sorter', x: cell.x, y: cell.y };
      return isInsideWorld(cell)
        && !isTerrainBlocked(cell)
        && !resourceNodeAt(cell)
        && !overlapsBuilding(cell.x, cell.y, 1)
        && !beltAt(cell)
        && isAdjacentToBuilding(endpoint, candidate);
    })
    .map(cell => ({
      cell,
      score: Math.abs(cell.x - endpoint.x) + Math.abs(cell.y - endpoint.y) * 1.2
        + Math.abs(cell.x - center.x) * .2 + Math.abs(cell.y - center.y) * .2
    }))
    .sort((left, right) => left.score - right.score || left.cell.y - right.cell.y || left.cell.x - right.cell.x);
}

function findSorterPlacement(building, belt, mode) {
  return sorterPlacementCandidates(building, belt, mode)[0] || null;
}

function sorterPlacementPreview() {
  const anchor = state.pointer.sorterAnchor;
  if (!anchor) return null;
  if (anchor.kind === 'building') {
    const building = state.buildings.find(entry => entry.id === anchor.id);
    const endpoint = sorterBeltEndpointAt(state.pointer.cell, 'start');
    if (!isSorterTargetBuilding(building)) return { valid: false, building, mode: 'output', reason: '分拣器不能作为物料接口' };
    if (!endpoint) return { valid: false, building, mode: 'output', reason: '请拖到传送带起点' };
    if (endpoint.endpoint !== 'start') return { valid: false, building, belt: endpoint.belt, mode: 'output', endpointCell: getBeltEnd(endpoint.belt), reason: '建筑出料必须接入传送带起点' };
    const placement = findSorterPlacement(building, endpoint.belt, 'output');
    return { valid: Boolean(placement), building, belt: endpoint.belt, mode: 'output', endpointCell: { x: endpoint.belt.x, y: endpoint.belt.y }, placement, reason: placement ? '' : '建筑接口和传送带起点之间没有空位' };
  }
  const belt = state.belts.find(entry => entry.id === anchor.id);
  const building = findBuildingAt(state.pointer.cell);
  if (anchor.endpoint !== 'end') return { valid: false, building, belt, mode: 'input', reason: '建筑进料必须从传送带末端开始' };
  if (!isSorterTargetBuilding(building)) return { valid: false, building, belt, mode: 'input', reason: '请拖到需要物料的建筑接口' };
  const placement = findSorterPlacement(building, belt, 'input');
  return { valid: Boolean(placement), building, belt, mode: 'input', endpointCell: belt ? getBeltEnd(belt) : null, placement, reason: placement ? '' : '建筑接口和传送带末端之间没有空位' };
}

function placeSorterBetween(building, belt, mode) {
  const placement = findSorterPlacement(building, belt, mode);
  if (!placement) { showToast('分拣器需要同时贴近建筑接口和传送带端点', 'warning'); return false; }
  if (!canUseKit('sorter')) { showToast('没有分拣器库存 · 请打开制造面板', 'warning'); return false; }
  const sorter = makeBuilding('sorter', placement.cell.x, placement.cell.y);
  sorter.sorterMode = mode;
  sorter.rotation = mode === 'output' ? 0 : 180;
  consumeBuildKit('sorter');
  state.buildings.push(sorter);
  rebuildPowerGrids();
  state.selectedId = sorter.id;
  state.sorterRoutingSignature = '';
  saveGame();
  showToast(mode === 'output' ? '分拣器已安装 · 建筑 → 传送带' : '分拣器已安装 · 传送带 → 建筑');
  return true;
}

function drawSorterPortMarker(cell, color, active = false, occupied = false) {
  const point = worldToScreen(cell.x + .5, cell.y + .5);
  const pulse = active ? 1 + Math.sin(state.animTime * 5) * .16 : 1;
  ctx.save();
  ctx.globalAlpha = occupied ? .22 : active ? .94 : .58;
  ctx.strokeStyle = color;
  ctx.fillStyle = `${color}${occupied ? '10' : '22'}`;
  ctx.lineWidth = active ? 2 : 1;
  ctx.beginPath();
  ctx.arc(point.x, point.y, (occupied ? 4 : 5) * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawSorterPortHints() {
  const anchor = state.pointer.sorterAnchor;
  const preview = sorterPlacementPreview();
  state.buildings.filter(isSorterTargetBuilding).forEach(building => {
    buildingPortCells(building).forEach(port => {
      const selected = anchor?.kind === 'building' && anchor.id === building.id;
      drawSorterPortMarker(port, selected ? '#c7d94c' : '#69d8da', selected);
    });
  });
  state.belts.forEach(belt => {
    const start = { x: belt.x, y: belt.y };
    const end = getBeltEnd(belt);
    drawSorterPortMarker(start, '#c7d94c', anchor?.kind === 'belt' && anchor.id === belt.id && anchor.endpoint === 'start', true);
    if (end.x !== start.x || end.y !== start.y) drawSorterPortMarker(end, '#f7c35e', anchor?.kind === 'belt' && anchor.id === belt.id && anchor.endpoint === 'end', true);
  });
  if (preview?.endpointCell) drawSorterPortMarker(preview.endpointCell, preview.valid ? '#62d69a' : '#ee6a65', true);
}

function drawSorterPreview() {
  const anchor = state.pointer.sorterAnchor;
  if (!anchor) return;
  const preview = sorterPlacementPreview();
  if (!preview) return;
  const valid = preview.valid;
  const color = valid ? '#62d69a' : '#ee6a65';
  if (preview.building && preview.endpointCell) {
    const from = buildingCenter(preview.building);
    const to = { x: preview.endpointCell.x + .5, y: preview.endpointCell.y + .5 };
    const ghost = preview.placement?.cell;
    const ghostPoint = ghost ? worldToScreen(ghost.x, ghost.y) : null;
    ctx.save();
    ctx.strokeStyle = `${color}bb`;
    ctx.lineWidth = Math.max(1.5, state.zoom * 1.5);
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(worldToScreen(from.x, from.y).x, worldToScreen(from.x, from.y).y);
    ctx.lineTo(ghostPoint ? ghostPoint.x + TILE * state.zoom / 2 : worldToScreen(to.x, to.y).x, ghostPoint ? ghostPoint.y + TILE * state.zoom / 2 : worldToScreen(to.x, to.y).y);
    ctx.lineTo(worldToScreen(to.x, to.y).x, worldToScreen(to.x, to.y).y);
    ctx.stroke();
    ctx.restore();
    if (ghostPoint) {
      const size = TILE * state.zoom;
      ctx.save();
      ctx.globalAlpha = .64;
      ctx.fillStyle = `${color}28`;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.fillRect(ghostPoint.x + 2, ghostPoint.y + 2, size - 4, size - 4);
      ctx.strokeRect(ghostPoint.x + 2, ghostPoint.y + 2, size - 4, size - 4);
      if (hasImage(assets.sorter)) {
        ctx.globalAlpha = .26;
        const ghostSprite = rasterizedAsset('sorter') || assets.sorter;
        ctx.drawImage(ghostSprite, ghostPoint.x + size * .06, ghostPoint.y + size * .06, size * .88, size * .88);
      }
      ctx.restore();
    }
  }
}

function drawBeltPortHints() {
  if (state.tool === 'sorter') {
    drawSorterPortHints();
    return;
  }
  if (state.tool !== 'belt') return;
  const hoverBuilding = findBuildingAt(state.pointer.cell);
  state.buildings.forEach(building => {
    buildingPortCells(building).forEach(port => {
      const occupied = Boolean(beltAt(port));
      const selectedPort = state.pointer.startBuildingId === building.id && state.pointer.startCell?.x === port.x && state.pointer.startCell?.y === port.y;
      const targetPort = hoverBuilding?.id === building.id && !selectedPort;
      const point = worldToScreen(port.x + .5, port.y + .5);
      const pulse = selectedPort || targetPort ? 1 + Math.sin(state.animTime * 5) * .16 : 1;
      ctx.save();
      ctx.globalAlpha = occupied ? .24 : selectedPort || targetPort ? .9 : .5;
      ctx.strokeStyle = selectedPort ? '#c7d94c' : targetPort ? '#f7c35e' : '#69d8da';
      ctx.fillStyle = occupied ? 'rgba(105,216,218,.08)' : 'rgba(105,216,218,.16)';
      ctx.lineWidth = selectedPort || targetPort ? 2 : 1;
      ctx.beginPath();
      ctx.arc(point.x, point.y, (occupied ? 4 : 5) * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    });
  });
}

function isAdjacentToBuilding(cell, building) {
  const size = buildings[building.type].size;
  const horizontal = (cell.x === building.x - 1 || cell.x === building.x + size) && cell.y >= building.y - 1 && cell.y <= building.y + size;
  const vertical = (cell.y === building.y - 1 || cell.y === building.y + size) && cell.x >= building.x - 1 && cell.x <= building.x + size;
  return horizontal || vertical;
}

function findBuildingAt(cell) {
  if (!cell) return null;
  return [...state.buildings].reverse().find(building => {
    const size = buildings[building.type].size;
    return cell.x >= building.x && cell.x < building.x + size && cell.y >= building.y && cell.y < building.y + size;
  });
}

function buildingPortToward(building, targetCell) {
  const size = buildings[building.type].size;
  const center = { x: building.x + (size - 1) / 2, y: building.y + (size - 1) / 2 };
  const delta = { x: (targetCell?.x ?? center.x + 1) - center.x, y: (targetCell?.y ?? center.y) - center.y };
  if (Math.abs(delta.x) >= Math.abs(delta.y)) {
    return {
      x: delta.x < 0 ? building.x - 1 : building.x + size,
      y: clamp(Math.round(targetCell?.y ?? center.y), building.y, building.y + size - 1)
    };
  }
  return {
    x: clamp(Math.round(targetCell?.x ?? center.x), building.x, building.x + size - 1),
    y: delta.y < 0 ? building.y - 1 : building.y + size
  };
}

function buildingCenter(building) {
  const size = buildings[building.type].size;
  return { x: building.x + (size - 1) / 2, y: building.y + (size - 1) / 2 };
}

function beltPortsBetweenBuildings(source, target) {
  const candidates = [];
  buildingPortCells(source).forEach(start => {
    buildingPortCells(target).forEach(end => {
      [false, true].forEach(verticalFirst => {
        const segments = beltSegmentsBetweenOrder(start, end, verticalFirst);
        const cells = segments.flatMap(beltCells);
        const invalid = cells.some(cell => isTerrainBlocked(cell) || overlapsBuilding(cell.x, cell.y, 1) || beltAt(cell));
        if (invalid) return;
        const length = cells.length;
        const turns = segments.length - 1;
        const distance = Math.abs(end.x - start.x) + Math.abs(end.y - start.y);
        candidates.push({ start, end, segments, score: length * 10 + turns * 2 + distance });
      });
    });
  });
  let route = candidates.sort((left, right) => left.score - right.score)[0];
  if (!route) {
    buildingPortCells(source).forEach(start => {
      buildingPortCells(target).forEach(end => {
        const segments = findBeltPath(start, end);
        if (!segments.length) return;
        const cells = segments.flatMap(beltCells);
        const length = cells.length;
        const turns = segments.length - 1;
        candidates.push({ start, end, segments, score: length * 10 + turns * 2 });
      });
    });
    route = candidates.sort((left, right) => left.score - right.score)[0];
  }
  if (route) return { start: route.start, end: route.end, segments: route.segments };
  return {
    start: buildingPortToward(source, buildingCenter(target)),
    end: buildingPortToward(target, buildingCenter(source)),
    segments: null
  };
}

function beltPreviewEnd(cell) {
  const building = findBuildingAt(cell);
  if (!building || building.id === state.pointer.startBuildingId) return cell;
  return buildingPortToward(building, state.pointer.startCell || cell);
}

function findNodeForBuilding(building) {
  return state.nodes.find(node => node.x >= building.x - 1 && node.x < building.x + buildings[building.type].size + 1 && node.y >= building.y - 1 && node.y < building.y + buildings[building.type].size + 1);
}

function resourceNodeAt(cell) {
  return state.nodes.find(node => node.x === cell.x && node.y === cell.y) || null;
}

function resourceNodeCollisionAt(cell, size) {
  const blockedCell = footprintCells(cell, size).find(entry => resourceNodeAt(entry));
  return blockedCell ? { cell: blockedCell, node: resourceNodeAt(blockedCell) } : null;
}

function buildingCollisionAt(cell, size, ignoreId = null) {
  const cells = footprintCells(cell, size);
  return state.buildings.find(building => building.id !== ignoreId && cells.some(entry => {
    const buildingSize = buildings[building.type].size;
    return entry.x >= building.x && entry.x < building.x + buildingSize && entry.y >= building.y && entry.y < building.y + buildingSize;
  })) || null;
}

function footprintBeltAt(cell, size) {
  return footprintCells(cell, size).find(entry => beltAt(entry)) || null;
}

function overlapsBuilding(x, y, size) {
  return Boolean(buildingCollisionAt({ x, y }, size));
}
