const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const tintCanvas = document.createElement('canvas');
const tintCtx = tintCanvas.getContext('2d');
const shopEl = document.getElementById('shop');
const inventoryEl = document.getElementById('inventory');
const commandDeckEl = document.querySelector('.command-deck');
const battlefieldEl = document.querySelector('.battlefield');
const deckCollapseBtn = document.getElementById('deckCollapseBtn');
const deckExpandBtn = document.getElementById('deckExpandBtn');
const messageEl = document.getElementById('message');
const hudEl = document.getElementById('hud');
const goldBadgeEl = document.getElementById('goldBadge');
const helpBtn = document.getElementById('helpBtn');
const helpDialog = document.getElementById('helpDialog');
const startWaveBtn = document.getElementById('startWaveBtn');
const restartBtn = document.getElementById('restartBtn');
const rerollBtn = document.getElementById('rerollBtn');
const expandBtn = document.getElementById('expandBtn');
const sellBtn = document.getElementById('sellBtn');
const levelSelectEl = document.getElementById('levelSelect');
const levelSelectPanelEl = document.getElementById('levelSelectPanel');
const goldHudEl = document.getElementById('goldHud');
const towerActionMenuEl = document.getElementById('towerActionMenu');
const titleRunnerEl = document.getElementById('titleRunner');
const fullscreenBtn = document.getElementById('fullscreenBtn');

let titleRunnerTimer = null;
let titleRunnerMoveRaf = null;
let titleRunnerFrameTimer = null;
let titleRunnerPlaying = false;

let cfg;
let towersCfg;
let enemiesCfg;
let waveCfg;
let mapsCfg;
let activeMap;
let activeMapId;
let levelIndex = 0;
let levelSelectMode = 'normal';
let mapImage;
let roadMaskImage;
let roadMaskCanvas;
let roadMaskCtx;
let towerImages = {};
let enemyImages = {};
let effectImages = {};
let gemIdleImages = {};
let projectileImages = {};
let spriteSheetImages = {};
let uiPanelImages = {};
let game;
let lastTime = 0;
let hoveredSlotId = null;
let dragging = null;
let dragStartedInCommandDeck = false;
let commandDeckDragHasLeft = false;
let lastCanvasPointer = { x: canvas.width / 2, y: canvas.height / 2 };
let placementPreview = null;
let dragTooltip = null;
let transparentDragImage = null;
let dragTooltipEl = null;
let inventoryDragPreviewIndex = null;
let lastInventoryDragTarget = null;
let dragGhostEl = null;
let commandDeckCollapsed = false;
let pendingBuild = null;
let shopDragging = null;
let suppressNextCanvasClick = false;
let goldHudClickCount = 0;
let goldHudFirstClickTime = 0;

const CONFIG_FILES = [
  './config/game.json',
  './config/towers.json',
  './config/enemies.json',
  './config/waves.json',
  './config/maps.json'
];

const ASSET_VERSION = '20260529-fullscreen-v1';

const EFFECT_SEQUENCES = {
  lightBeam: {
    frames: Array.from({ length: 8 }, (_, i) => `./assets/effects/golden_laser/frame_${String(i + 1).padStart(2, '0')}.png`),
    duration: 0.26,
    beamThickness: 13,
    maxHeight: 70
  },
  thunderBeam: {
    frames: Array.from({ length: 7 }, (_, i) => `./assets/effects/purple_lightning/frame_${String(i + 1).padStart(2, '0')}.png`),
    duration: 0.30,
    beamThickness: 25,
    maxHeight: 112
  }
};

const GEM_IDLE_EFFECTS = {
  light: { image: './assets/effects/gem_idle/light_gem_idle_sheet.png', frameCols: 4, frameRows: 4, frames: 16, fps: 14, size: 42, offsetY: -2 },
  thunder: { image: './assets/effects/gem_idle/thunder_gem_idle_sheet.png', frameCols: 4, frameRows: 4, frames: 16, fps: 16, size: 46, offsetY: -2 },
  ice: { image: './assets/effects/gem_idle/ice_gem_idle_sheet.png', frameCols: 4, frameRows: 4, frames: 16, fps: 14, size: 44, offsetY: -2 }
};

const PROJECTILE_ASSETS = {
  ice: { image: './assets/effects/ice_projectile.png', maxWidth: 34, maxHeight: 14, speed: 520 }
};

const SPRITE_SHEET_EFFECTS = {
  lightHit: { image: './assets/effects/hit/light_hit_sheet.png', frameCols: 3, frameRows: 3, frames: 9, duration: 0.36, width: 88, height: 88, composite: 'screen' },
  thunderHit: { image: './assets/effects/hit/thunder_hit_sheet.png', frameCols: 3, frameRows: 3, frames: 9, duration: 0.38, width: 96, height: 96, composite: 'screen' },
  snowBossTowerHit: { image: './assets/effects/hit/snow_boss_tower_hit_sheet.png', frameCols: 4, frameRows: 4, frames: 16, duration: 0.72, width: 203, height: 203, composite: 'screen' },
  towerUpgrade: { image: './assets/effects/upgrade/tower_upgrade_sheet.png', frameCols: 4, frameRows: 2, frames: 8, duration: 0.82, width: 95, height: 158, composite: 'screen' },
  monsterExitPortal: { image: './assets/effects/portal/monster_exit_portal_sheet.png', frameCols: 4, frameRows: 4, frames: 16, duration: 2.625, width: 138, height: 245, composite: 'screen', loop: true }
};

const UI_PANEL_ASSETS = {
  topCenter: './assets/ui/panels/top_center_badge.png',
  hpBar: './assets/ui/panels/top_hp_bar.png',
  spawnBar: './assets/ui/panels/top_spawn_bar.png',
  coin: './assets/ui/panels/coin_icon.png',
  defeatPanel: './assets/ui/panels/defeat_panel.png'
};

const MIN_SPAWN_GAP = 46;
const SPAWN_RETRY_DELAY = 0.16;
const PORTAL_DEBUG = false;
const portalDebugTune = { x: 8, y: 26, scale: 1.15, scaleX: 0.8, scaleY: 0.72, rotation: 0.42 };
const level02PortalDebugTune = { x: 20, y: 14, scale: 1.06, scaleX: 0.84, scaleY: 0.72, rotation: 0.36 };

function versionedSrc(src) {
  if (!src || src.startsWith('data:') || src.startsWith('blob:')) return src;
  const sep = src.includes('?') ? '&' : '?';
  return `${src}${sep}v=${ASSET_VERSION}`;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = versionedSrc(src);
  });
}

async function loadActiveMap(mapId) {
  const order = mapsCfg.levelOrder?.length ? mapsCfg.levelOrder : Object.keys(mapsCfg.maps || {});
  activeMapId = mapId || mapsCfg.activeMap || order[0];
  levelIndex = Math.max(0, order.indexOf(activeMapId));
  activeMap = mapsCfg.maps[activeMapId];
  if (!activeMap) throw new Error(`地图配置不存在：${activeMapId}`);
  document.body.dataset.map = activeMapId;
  mapImage = await loadImage(activeMap.background);
  roadMaskImage = await loadImage(activeMap.roadMask);
  roadMaskCanvas = document.createElement('canvas');
  roadMaskCanvas.width = canvas.width;
  roadMaskCanvas.height = canvas.height;
  roadMaskCtx = roadMaskCanvas.getContext('2d', { willReadFrequently: true });
  roadMaskCtx.drawImage(roadMaskImage, 0, 0, canvas.width, canvas.height);
  cfg.game.path = activeMap.enemyPath;
}

async function loadConfig() {
  const [gameData, towerData, enemyData, wavesData, mapsData] = await Promise.all(
    CONFIG_FILES.map(path => fetch(path).then(res => res.json()))
  );
  cfg = gameData;
  towersCfg = towerData.towers;
  enemiesCfg = enemyData.enemies;
  waveCfg = wavesData;
  mapsCfg = mapsData;
  await loadActiveMap();
  populateLevelSelect();
  towerImages = {};
  enemyImages = {};
  effectImages = {};
  gemIdleImages = {};
  projectileImages = {};
  spriteSheetImages = {};
  uiPanelImages = {};
  await Promise.all(Object.entries(towersCfg).flatMap(([type, def]) => {
    const spriteLevels = def.sprite?.levels || [];
    return spriteLevels.map(async (sprite, index) => {
      if (!sprite.image) return;
      towerImages[`${type}:${index + 1}`] = await loadImage(sprite.image);
    });
  }));
  await Promise.all(Object.entries(mapsCfg.maps || {}).flatMap(([mapId, mapDef]) => {
    const towerSprites = mapDef.towerSprites || {};
    return Object.entries(towerSprites).flatMap(([type, override]) => {
      const levels = override.levels || [];
      return levels.map(async (sprite, index) => {
        if (!sprite.image) return;
        towerImages[`${mapId}:${type}:${index + 1}`] = await loadImage(sprite.image);
      });
    });
  }));
  await Promise.all(Object.entries(enemiesCfg).flatMap(([type, def]) => {
    const jobs = [];
    if (def.sprite?.image) jobs.push(loadImage(def.sprite.image).then(image => { enemyImages[type] = image; }));
    if (def.attackSprite?.image) jobs.push(loadImage(def.attackSprite.image).then(image => { enemyImages[`${type}:attack`] = image; }));
    return jobs;
  }));
  await Promise.all(Object.entries(EFFECT_SEQUENCES).map(async ([key, def]) => {
    effectImages[key] = await Promise.all(def.frames.map(src => loadImage(src)));
  }));
  await Promise.all(Object.entries(GEM_IDLE_EFFECTS).map(async ([key, def]) => {
    gemIdleImages[key] = await loadImage(def.image);
  }));
  await Promise.all(Object.entries(PROJECTILE_ASSETS).map(async ([key, def]) => {
    projectileImages[key] = await loadImage(def.image);
  }));
  await Promise.all(Object.entries(SPRITE_SHEET_EFFECTS).map(async ([key, def]) => {
    spriteSheetImages[key] = await loadImage(def.image);
  }));
  await Promise.all(Object.entries(UI_PANEL_ASSETS).map(async ([key, src]) => {
    uiPanelImages[key] = await loadImage(src);
  }));
}

function syncLevelSelect() {
  if (!levelSelectEl || !mapsCfg) return;
  levelSelectEl.value = levelSelectMode === 'boss' ? `${activeMapId}__boss` : (activeMapId || '');
}

function populateLevelSelect() {
  if (!levelSelectEl || !mapsCfg) return;
  const order = mapsCfg.levelOrder?.length ? mapsCfg.levelOrder : Object.keys(mapsCfg.maps || {});
  levelSelectEl.innerHTML = '';
  order.forEach((mapId, index) => {
    const option = document.createElement('option');
    option.value = mapId;
    option.textContent = `第${index + 1}关`;
    levelSelectEl.appendChild(option);
  });
  order.forEach((mapId, index) => {
    const option = document.createElement('option');
    option.value = `${mapId}__boss`;
    option.textContent = `第${index + 1}关Boss`;
    levelSelectEl.appendChild(option);
  });
  syncLevelSelect();
}

function parseLevelSelectValue(value) {
  const raw = String(value || '');
  if (raw.endsWith('__boss')) return { mapId: raw.replace('__boss', ''), boss: true };
  return { mapId: raw, boss: false };
}

async function chooseLevel(value) {
  const { mapId, boss } = parseLevelSelectValue(value);
  if (!mapId || !mapsCfg.maps[mapId]) return;
  if (mapId !== activeMapId) await loadActiveMap(mapId);
  if (boss) startBossTestMode();
  else {
    levelSelectMode = 'normal';
    newGame();
    setMessage(`测试选关：已切换到 ${activeMap.name || activeMapId}。`);
  }
  dragging = null;
  placementPreview = null;
  hoveredSlotId = null;
  clearDragVisuals();
  syncLevelSelect();
  renderSide();
}

function startBossTestMode() {
  levelSelectMode = 'boss';
  newGame({ bossTest: true });
  game.bossTest = true;
  game.gold = Infinity;
  game.waveIndex = waveCfg.waves.length;
  game.bossDefeated = false;
  game.bossSpawned = false;
  setMessage(`Boss 测试：${activeMap.name || activeMapId}，金币无限。先部署塔，点击“开始”进入 Boss 战。`);
}

async function advanceToNextMap() {
  const order = mapsCfg.levelOrder?.length ? mapsCfg.levelOrder : Object.keys(mapsCfg.maps || {});
  const nextId = order[levelIndex + 1];
  if (!nextId) return false;
  await loadActiveMap(nextId);
  const preservedScore = game.score;
  const preservedHp = game.hp;
  newGame();
  game.score = preservedScore;
  game.hp = preservedHp;
  setMessage(`进入第二关：${activeMap.name || activeMapId}。道路已切换，现在可以重新部署防线。`);
  syncLevelSelect();
  renderSide();
  return true;
}

function newGame(options = {}) {
  const g = cfg.game;
  game = {
    phase: 'prep',
    hasStartedOnce: false,
    hp: g.baseHp,
    gold: g.startGold,
    score: 0,
    waveIndex: 0,
    inventoryRows: g.inventory.rows,
    inventory: Array(g.inventory.cols * g.inventory.rows).fill(null),
    pendingBuild: null,
    deployed: {},
    customTowerSlots: [],
    selected: null,
    shop: [],
    enemies: [],
    projectiles: [],
    floating: [],
    spawnQueue: [],
    spawnTimer: 0,
    currentWaveTotal: 0,
    currentWaveSpawned: 0,
    bossActive: false,
    bossSpawned: false,
    bossDefeated: false,
    waveAlive: false,
    result: null,
    bossTest: !!options.bossTest,
    portalTime: 0,
    screenShake: { time: 0, duration: 0, intensity: 0 }
  };
  if (!options.bossTest) levelSelectMode = 'normal';
  rollShop(false);
  syncLevelSelect();
  pendingBuild = null;
  hideTowerActionMenu();
  setMessage('准备阶段：从底部道具栏拖拽防御塔到地图空地建造；不能重叠、不能压到道路。');
  renderSide();
}

function allTowerSlots() {
  return game.customTowerSlots;
}

function distancePointToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  const x = ax + t * dx;
  const y = ay + t * dy;
  return Math.hypot(px - x, py - y);
}

function isRoadPixel(x, y) {
  if (!roadMaskCtx) return false;
  const px = Math.max(0, Math.min(canvas.width - 1, Math.round(x)));
  const py = Math.max(0, Math.min(canvas.height - 1, Math.round(y)));
  const [r, g, b, a] = roadMaskCtx.getImageData(px, py, 1, 1).data;
  if (a < 20) return false;
  const whiteRoad = r >= 150 && g >= 150 && b >= 150;
  const redCenterline = r >= 120 && r > g * 1.35 && r > b * 1.35;
  const blueStart = b >= 120 && b > r * 1.25 && b > g * 1.25;
  const yellowEnd = r >= 150 && g >= 130 && b <= 130;
  return whiteRoad || redCenterline || blueStart || yellowEnd;
}

function roadOverlapRatio(x, y, radius) {
  const samples = [
    [0, 0], [radius, 0], [-radius, 0], [0, radius], [0, -radius],
    [radius * 0.7, radius * 0.7], [-radius * 0.7, radius * 0.7],
    [radius * 0.7, -radius * 0.7], [-radius * 0.7, -radius * 0.7]
  ];
  let hits = 0;
  for (const [dx, dy] of samples) {
    if (isRoadPixel(x + dx, y + dy)) hits += 1;
  }
  return hits / samples.length;
}

function canCreateTowerSlot(x, y, ignoreSlotId = null) {
  if (x < 55 || x > canvas.width - 55 || y < 55 || y > canvas.height - 55) {
    return { ok: false, reason: '太靠近地图边缘，放不下炮台。' };
  }
  for (const slot of allTowerSlots()) {
    if (slot.id === ignoreSlotId) continue;
    if (Math.hypot(slot.x - x, slot.y - y) < 72) {
      return { ok: false, reason: '离已有炮台太近，不能重叠放置。' };
    }
  }
  if (roadOverlapRatio(x, y, 30) > 0) {
    return { ok: false, reason: '不能放在道路 mask 上。' };
  }
  return { ok: true };
}

function findTowerSlot(slotId) {
  return allTowerSlots().find(slot => slot.id === slotId) || null;
}

function createCustomTowerSlot(x, y) {
  const id = `tower-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  game.customTowerSlots.push({ id, x, y, custom: true });
  game.deployed[id] = null;
  return id;
}

function cleanupEmptyTowerSlots() {
  game.customTowerSlots = game.customTowerSlots.filter(slot => game.deployed[slot.id]);
  for (const slotId of Object.keys(game.deployed)) {
    if (!game.customTowerSlots.some(slot => slot.id === slotId)) delete game.deployed[slotId];
  }
}

function setMessage(text) {
  if (messageEl) messageEl.textContent = text;
}

function weightedPick(weights) {
  const total = weights.reduce((sum, item) => sum + item.weight, 0);
  let r = Math.random() * total;
  for (const item of weights) {
    r -= item.weight;
    if (r <= 0) return item.tower;
  }
  return weights[0].tower;
}

function hasInfiniteGold() {
  return game?.bossTest || game?.gold === Infinity;
}

function goldText() {
  return hasInfiniteGold() ? '∞' : String(game.gold);
}

function canAfford(cost) {
  return hasInfiniteGold() || game.gold >= cost;
}

function spendGold(cost) {
  if (hasInfiniteGold()) return true;
  if (game.gold < cost) return false;
  game.gold -= cost;
  return true;
}

function rollShop(pay = true) {
  const shop = waveCfg.shop;
  if (pay) {
    if (game.phase !== 'prep') return setMessage('战斗中不能刷新商店。');
    if (!canAfford(shop.rerollCost)) return setMessage('金币不足，无法刷新商店。');
    spendGold(shop.rerollCost);
  }
  const offers = [];
  let guard = 0;
  while (offers.length < shop.offerCount && guard < 30) {
    offers.push(weightedPick(shop.weights));
    guard += 1;
    if (offers.length === shop.offerCount && new Set(offers).size < Math.min(2, shop.offerCount)) {
      offers.length = 0;
    }
  }
  if (new Set(offers).size < Math.min(2, shop.offerCount)) {
    const fallback = shop.weights.map(item => item.tower).filter(type => type !== offers[0]);
    offers[1] = fallback[Math.floor(Math.random() * fallback.length)] || offers[0];
  }
  game.shop = Object.keys(towersCfg || {});
  renderSide();
}

function makeTower(type, level = 1) {
  return { id: crypto.randomUUID(), type, level, cd: 0 };
}

function emptyInventoryIndex() {
  return game.inventory.findIndex(item => !item);
}

function buyTower(type) {
  if (game.phase !== 'prep') return setMessage('战斗中不能购买，请等本波结束。');
  const def = towersCfg[type];
  if (!canAfford(def.cost)) return setMessage(`金币不足：${def.name} 需要 ${def.cost} 金币。`);
  pendingBuild = { type, item: makeTower(type) };
  game.selected = null;
  const p = lastCanvasPointer || { x: canvas.width / 2, y: canvas.height / 2 };
  updatePendingBuildPreview(p.x, p.y);
  setMessage(`已选择 ${def.name}：拖到地图空地松手建造，右键取消。`);
  renderSide();
}

function selectedItem() {
  if (!game.selected) return null;
  if (game.selected.area === 'inventory') return game.inventory[game.selected.index];
  if (game.selected.area === 'deployed') return game.deployed[game.selected.slotId];
  return null;
}

function canMerge(a, b) {
  return a && b && a.type === b.type && a.level === b.level && a.level < 3;
}

function mergeGoldCost(type, fromLevel) {
  const baseCost = towersCfg[type]?.cost || 0;
  return fromLevel === 2 ? baseCost * 4 : baseCost * 2;
}

function mergeRequirementText(type, level) {
  const name = towersCfg[type]?.name || '同类塔';
  const cost = mergeGoldCost(type, level);
  return level === 2
    ? `2 个 ${name} Lv2 合成 Lv3，额外消耗 ${cost} 金币。`
    : `2 个 ${name} Lv1 合成 Lv2，额外消耗 ${cost} 金币。`;
}

function getItemAt(ref) {
  if (!ref) return null;
  if (ref.area === 'inventory') return game.inventory[ref.index];
  if (ref.area === 'deployed') return game.deployed[ref.slotId];
  return null;
}

function setItemAt(ref, item) {
  if (ref.area === 'inventory') game.inventory[ref.index] = item;
  if (ref.area === 'deployed') {
    game.deployed[ref.slotId] = item;
    if (!item) cleanupEmptyTowerSlots();
  }
}

function sameRef(a, b) {
  if (!a || !b || a.area !== b.area) return false;
  if (a.area === 'inventory') return a.index === b.index;
  return a.slotId === b.slotId;
}

function getDragTooltipEl() {
  if (dragTooltipEl) return dragTooltipEl;
  dragTooltipEl = document.createElement('div');
  dragTooltipEl.className = 'drag-tooltip';
  document.body.appendChild(dragTooltipEl);
  return dragTooltipEl;
}

function setDragTooltip(text, clientX, clientY, ok = true) {
  dragTooltip = { text, clientX, clientY, ok };
  const el = getDragTooltipEl();
  el.textContent = text;
  el.classList.toggle('is-bad', !ok);
  el.style.left = `${clientX + 14}px`;
  el.style.top = `${clientY + 14}px`;
  el.style.opacity = '1';
  el.style.visibility = 'visible';
}

function hideDragTooltip() {
  dragTooltip = null;
  if (!dragTooltipEl) return;
  dragTooltipEl.style.opacity = '0';
  dragTooltipEl.style.visibility = 'hidden';
}

function mergePreviewForRef(target) {
  if (!dragging) return null;
  const source = dragging.source;
  if (sameRef(source, target)) return null;
  const moving = getItemAt(source);
  const targetItem = getItemAt(target);
  if (!moving || !targetItem || !canMerge(moving, targetItem)) return null;
  const cost = mergeGoldCost(moving.type, moving.level);
  const ok = canAfford(cost);
  const name = towersCfg[moving.type]?.name || '塔';
  return {
    ok,
    cost,
    text: ok
      ? `合成 ${name} Lv${moving.level + 1}：消耗 ${cost} 金币 / 右键取消`
      : `金币不足：合成需 ${cost}，还差 ${cost - game.gold} / 右键取消`
  };
}

function inventoryRefFromPoint(clientX, clientY) {
  const slots = Array.from(inventoryEl?.querySelectorAll?.('.slot') || []);
  for (const el of slots) {
    const rect = el.getBoundingClientRect();
    if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
      const index = Number(el.dataset.index);
      if (Number.isInteger(index)) return { area: 'inventory', index };
    }
  }
  const el = document.elementFromPoint(clientX, clientY)?.closest?.('.slot');
  if (!el || !inventoryEl?.contains(el)) return null;
  const index = Number(el.dataset.index);
  if (!Number.isInteger(index)) return null;
  return { area: 'inventory', index };
}

function updateDragGhost(event) {
  if (!dragging?.started) return;
  const overInventory = !!inventoryRefFromPoint(event.clientX, event.clientY);
  if (dragging.source?.area !== 'inventory' || !overInventory) {
    removeDragGhost();
    return;
  }
  const item = getItemAt(dragging.source);
  if (!item) return;
  if (!dragGhostEl) {
    const def = towersCfg[item.type];
    dragGhostEl = document.createElement('div');
    dragGhostEl.className = 'drag-ghost tower-icon inventory-icon';
    dragGhostEl.style.setProperty('--tower-color', def.color);
    dragGhostEl.innerHTML = `<img src="${towerIconImage(item.type, item.level)}" alt="${def.name} Lv${item.level}"><span class="level">Lv${item.level}</span>`;
    document.body.appendChild(dragGhostEl);
  }
  dragGhostEl.style.left = `${event.clientX}px`;
  dragGhostEl.style.top = `${event.clientY}px`;
}

function removeDragGhost() {
  dragGhostEl?.remove();
  dragGhostEl = null;
}

function emptyInventoryRef() {
  const index = emptyInventoryIndex();
  return index >= 0 ? { area: 'inventory', index } : null;
}

function commandDeckBottomHot(clientX, clientY) {
  if (!commandDeckEl) return false;
  const rect = commandDeckEl.getBoundingClientRect();
  const insideX = clientX >= rect.left && clientX <= rect.right;
  return insideX && clientY >= rect.bottom - 42 && clientY <= rect.bottom + 24;
}

function updateInventoryDragPreview(target = null) {
  const nextIndex = target?.area === 'inventory' ? target.index : null;
  lastInventoryDragTarget = target?.area === 'inventory' ? { area: 'inventory', index: target.index } : null;
  if (inventoryDragPreviewIndex === nextIndex) return;
  inventoryDragPreviewIndex = nextIndex;
  document.querySelectorAll('.slot.drag-return-preview').forEach(el => el.classList.remove('drag-return-preview'));
  if (nextIndex !== null) {
    const slotEl = inventoryEl?.querySelector?.(`.slot[data-index="${nextIndex}"]`);
    slotEl?.classList.add('drag-return-preview');
  }
}

function updateDragTooltipForInventory(event) {
  if (!dragging || game.phase !== 'prep') return;
  const target = inventoryRefFromPoint(event.clientX, event.clientY);
  if (target) {
    updateInventoryDragPreview(target);
    const preview = mergePreviewForRef(target);
    if (preview) return setDragTooltip(preview.text, event.clientX, event.clientY, preview.ok);
    const targetItem = getItemAt(target);
    if (!targetItem && dragging.source.area === 'deployed') {
      return setDragTooltip('放回背包 / 右键取消', event.clientX, event.clientY, true);
    }
    if (targetItem && !sameRef(dragging.source, target)) {
      return setDragTooltip('放入背包并交换位置 / 右键取消', event.clientX, event.clientY, true);
    }
  }
  if (dragging.source.area === 'deployed' && commandDeckBottomHot(event.clientX, event.clientY)) {
    updateInventoryDragPreview(emptyInventoryRef());
    return setDragTooltip('松手可放回背包 / 右键取消', event.clientX, event.clientY, true);
  }
  updateInventoryDragPreview(null);
  hideDragTooltip();
}

function clearDragVisuals(options = {}) {
  const keepSelection = !!options.keepSelection;
  document.body.classList.remove('dragging');
  commandDeckEl?.classList.remove('is-drag-hidden');
  syncCommandDeckCollapse();
  canvas.classList.remove('drag-over');
  document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
  document.querySelectorAll('.drag-return-preview').forEach(el => el.classList.remove('drag-return-preview'));
  const active = document.activeElement;
  if (active && (active.classList?.contains('slot') || active === canvas)) active.blur();
  hoveredSlotId = null;
  placementPreview = pendingBuild ? placementPreview : null;
  dragging = null;
  dragStartedInCommandDeck = false;
  commandDeckDragHasLeft = false;
  inventoryDragPreviewIndex = null;
  lastInventoryDragTarget = null;
  if (!keepSelection) game.selected = null;
  removeDragGhost();
  hideDragTooltip();
}

function transparentDragGhost() {
  if (transparentDragImage) return transparentDragImage;
  transparentDragImage = document.createElement('canvas');
  transparentDragImage.width = 1;
  transparentDragImage.height = 1;
  return transparentDragImage;
}

function beginDrag(event, source) {
  const item = getItemAt(source);
  if (!item) return;
  if (game.phase !== 'prep') {
    setMessage('战斗已经开始：部署和背包已锁定，本波结束后才能调整。');
    event.preventDefault();
    return;
  }
  // 用 Pointer 拖拽统一处理地图塔、背包塔、背包内合成；只有按住并移动超过阈值后才真正进入拖拽。
  dragging = {
    source,
    itemId: item.id,
    pointerMode: true,
    started: false,
    startX: event.clientX,
    startY: event.clientY,
    startClientX: event.clientX,
    startClientY: event.clientY,
    htmlDrag: false
  };
  dragStartedInCommandDeck = !!commandDeckEl?.contains(event.currentTarget);
  commandDeckDragHasLeft = false;
  game.selected = source;
  capturePointer(event);
  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setDragImage(transparentDragGhost(), 0, 0);
    event.dataTransfer.setData('text/plain', JSON.stringify(source));
    const def = towersCfg[item.type];
    event.dataTransfer.setData('text/html', `${def.name} Lv${item.level}`);
  }
}

function updateCommandDeckDragVisibility(event) {
  if (!dragging || !commandDeckEl) return;
  const canAutoHideDeck = false;
  if (!canAutoHideDeck) return;
  if ((event.buttons & 2) === 2) {
    cancelActiveDrag();
    return;
  }
  const rect = commandDeckEl.getBoundingClientRect();
  const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
  const nearBottomHandle = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.bottom - 42 && event.clientY <= rect.bottom + 24;
  if (nearBottomHandle) commandDeckDragHasLeft = false;
  if (!inside && !nearBottomHandle) commandDeckDragHasLeft = true;

  if (!commandDeckDragHasLeft) {
    commandDeckEl.classList.remove('is-drag-hidden');
    return;
  }

  commandDeckEl.classList.add('is-drag-hidden');
}

function cancelActiveDrag() {
  if (!dragging) return;
  setMessage('已取消放置。');
  clearDragVisuals();
  renderSide();
}

function dropToRef(target, event = null) {
  if (!dragging) return false;
  if (game.phase !== 'prep') {
    setMessage('战斗中不能调整部署。');
    return false;
  }
  const source = dragging.source;
  if (sameRef(source, target)) return false;

  const moving = getItemAt(source);
  if (!moving || moving.id !== dragging.itemId) return false;
  const targetItem = getItemAt(target);
  const mergePreview = mergePreviewForRef(target);
  if (mergePreview && !mergePreview.ok) {
    setMessage(mergePreview.text.replace(' / 右键取消', ''));
    return false;
  }

  if (!targetItem) {
    setItemAt(source, null);
    setItemAt(target, moving);
    game.selected = target;
    setMessage(target.area === 'deployed' ? `已部署 ${towerName(moving)}。` : `已移动 ${towerName(moving)}。`);
  } else if (canMerge(moving, targetItem)) {
    const fromLevel = targetItem.level;
    const nextLevel = fromLevel + 1;
    const goldCost = mergeGoldCost(moving.type, fromLevel);
    if (!canAfford(goldCost)) {
      setMessage(`${mergeRequirementText(moving.type, fromLevel)} 当前金币不足，还差 ${goldCost - game.gold}。`);
      return false;
    }
    spendGold(goldCost);
    targetItem.level = nextLevel;
    targetItem.cd = 0;
    setItemAt(source, null);
    game.selected = target;
    spawnUpgradeEffectAt(target, event);
    setMessage(`合成成功：${towerName(targetItem)}，消耗 ${goldCost} 金币。`);
  } else {
    setItemAt(source, targetItem);
    setItemAt(target, moving);
    game.selected = target;
    setMessage(`已交换 ${towerName(moving)} 与 ${towerName(targetItem)}。`);
  }
  cleanupEmptyTowerSlots();
  const finalSelection = target;
  clearDragVisuals({ keepSelection: true });
  game.selected = finalSelection;
  renderSide();
  return true;
}

function spawnUpgradeEffectAt(ref, event = null) {
  const item = getItemAt(ref);
  if (!item) return;
  let x = canvas.width / 2;
  let y = canvas.height / 2;
  let anchorSlotId = null;
  let width = SPRITE_SHEET_EFFECTS.towerUpgrade.width;
  let height = SPRITE_SHEET_EFFECTS.towerUpgrade.height;
  if (ref.area === 'deployed') {
    const slot = findTowerSlot(ref.slotId);
    if (slot) {
      const rect = towerSpriteRect(slot, item);
      x = slot.x;
      y = rect.y + rect.height * 0.48 - 21;
      anchorSlotId = ref.slotId;
    }
  } else if (ref.area === 'inventory') {
    width = 46;
    height = 64;
    if (event?.clientX != null && event?.clientY != null) {
      const p = canvasPoint(event);
      x = p.x;
      y = p.y;
    } else {
      x = 210 + (ref.index % 4) * 42;
      y = canvas.height - 150 - Math.floor(ref.index / 4) * 36;
    }
  }
  game.projectiles.push({
    type: 'spriteEffect',
    effect: 'towerUpgrade',
    x,
    y,
    width,
    height,
    anchorSlotId,
    age: 0,
    duration: SPRITE_SHEET_EFFECTS.towerUpgrade.duration
  });
  floatText(x, y - 41, '升级!', '#fde68a');
}

function pointerPrimaryDown(event) {
  if (event.pointerType === 'touch' || event.pointerType === 'pen') return true;
  if (typeof event.buttons === 'number') return (event.buttons & 1) === 1;
  return event.button === 0;
}

function pointerStillDown(event) {
  if (event.pointerType === 'touch' || event.pointerType === 'pen') return true;
  if (typeof event.buttons === 'number') return (event.buttons & 1) === 1;
  return true;
}

function capturePointer(event, element = event.currentTarget) {
  if (!element?.setPointerCapture || event.pointerId === undefined) return;
  try { element.setPointerCapture(event.pointerId); } catch (_) {}
}

function releasePointer(event, element = event.currentTarget) {
  if (!element?.releasePointerCapture || event.pointerId === undefined) return;
  try { element.releasePointerCapture(event.pointerId); } catch (_) {}
}

function beginShopDrag(event, type) {
  if (!pointerPrimaryDown(event)) return;
  if (game.phase !== 'prep') return setMessage('战斗中不能购买，请等本波结束。');
  const def = towersCfg[type];
  if (!canAfford(def.cost)) return setMessage(`金币不足：${def.name} 需要 ${def.cost} 金币。`);
  pendingBuild = { type, item: makeTower(type) };
  shopDragging = { type, started: false, pointerId: event.pointerId ?? null, startClientX: event.clientX, startClientY: event.clientY };
  game.selected = null;
  hideTowerActionMenu();
  updatePendingBuildPreview(lastCanvasPointer.x, lastCanvasPointer.y);
  capturePointer(event);
  event.preventDefault();
}

function updateShopDrag(event) {
  if (!shopDragging || !pendingBuild) return;
  if (!pointerStillDown(event)) {
    finishShopDrag(event);
    return;
  }
  const moved = Math.hypot(event.clientX - shopDragging.startClientX, event.clientY - shopDragging.startClientY);
  if (!shopDragging.started && moved < 8) return;
  shopDragging.started = true;
  const p = canvasPoint(event);
  updatePendingBuildPreview(p.x, p.y);
  document.body.classList.add('dragging');
}

function finishShopDrag(event) {
  if (!shopDragging) return;
  releasePointer(event, document.body);
  const wasStarted = shopDragging.started;
  shopDragging = null;
  document.body.classList.remove('dragging');
  if (!pendingBuild) return;
  if (!wasStarted) {
    pendingBuild = null;
    placementPreview = null;
    renderSide();
    return;
  }
  placePendingBuild(event);
}

function cancelPendingBuild() {
  if (!pendingBuild && !shopDragging) return false;
  pendingBuild = null;
  shopDragging = null;
  placementPreview = null;
  document.body.classList.remove('dragging');
  setMessage('已取消建造。');
  renderSide();
  return true;
}

function updatePlacementPreview(x, y, targetSlot = null) {
  if (!dragging && !pendingBuild) {
    placementPreview = null;
    return;
  }
  const item = pendingBuild?.item || getItemAt(dragging.source);
  if (!item) {
    placementPreview = null;
    return;
  }
  const targetRef = targetSlot ? { area: 'deployed', slotId: targetSlot.id } : null;
  const mergePreview = dragging && targetRef ? mergePreviewForRef(targetRef) : null;
  const ignoreSlotId = dragging?.source?.area === 'deployed' ? dragging.source.slotId : null;
  const placement = mergePreview ? { ok: mergePreview.ok, reason: mergePreview.text } : canCreateTowerSlot(x, y, ignoreSlotId);
  placementPreview = {
    x,
    y,
    ok: placement.ok,
    reason: mergePreview ? mergePreview.text : (placement.reason || ''),
    mergePreview,
    item,
    targetSlotId: targetSlot?.id || null
  };
}

function updatePendingBuildPreview(x, y) {
  if (!pendingBuild?.item || game.phase !== 'prep') {
    placementPreview = null;
    return;
  }
  const placement = canCreateTowerSlot(x, y, null);
  placementPreview = {
    x,
    y,
    ok: placement.ok,
    reason: placement.reason || '',
    mergePreview: null,
    item: pendingBuild.item,
    targetSlotId: null
  };
}

function placePendingBuild(event) {
  if (!pendingBuild?.item) return false;
  if (game.phase !== 'prep') {
    pendingBuild = null;
    placementPreview = null;
    setMessage('战斗中不能购买，请等本波结束。');
    renderSide();
    return true;
  }
  const { x, y } = canvasPoint(event);
  const def = towersCfg[pendingBuild.type];
  const placement = canCreateTowerSlot(x, y, null);
  if (!placement.ok) {
    updatePendingBuildPreview(x, y);
    pendingBuild = null;
    shopDragging = null;
    placementPreview = null;
    document.body.classList.remove('dragging');
    setMessage(`${placement.reason}，建造失败，请重新从商店拖拽。`);
    renderSide();
    return true;
  }
  if (!canAfford(def.cost)) {
    pendingBuild = null;
    placementPreview = null;
    setMessage(`金币不足：${def.name} 需要 ${def.cost} 金币。`);
    renderSide();
    return true;
  }
  spendGold(def.cost);
  const slotId = createCustomTowerSlot(x, y);
  game.deployed[slotId] = pendingBuild.item;
  game.selected = { area: 'deployed', slotId };
  setMessage(`已建造 ${towerName(pendingBuild.item)}。`);
  pendingBuild = null;
  shopDragging = null;
  placementPreview = null;
  document.body.classList.remove('dragging');
  renderSide();
  return true;
}

function beginPointerDragFromCanvas(event, slotId) {
  const item = game.deployed[slotId];
  if (!item) return;
  if (game.phase !== 'prep') {
    setMessage('战斗已经开始：部署已锁定，本波结束后才能调整。');
    return;
  }
  capturePointer(event, canvas);
  event.preventDefault();
  const start = canvasPoint(event);
  dragging = {
    source: { area: 'deployed', slotId },
    itemId: item.id,
    pointerMode: true,
    started: false,
    startX: start.x,
    startY: start.y,
    startClientX: event.clientX,
    startClientY: event.clientY
  };
  game.selected = { area: 'deployed', slotId };
  hoveredSlotId = slotId;
  renderSide();
}

function moveDraggedToInventory(target = null, event = null) {
  if (!dragging || game.phase !== 'prep') return false;
  const source = dragging.source;
  if (source.area !== 'deployed') return false;
  const moving = getItemAt(source);
  if (!moving || moving.id !== dragging.itemId) return false;
  const destination = target || emptyInventoryRef();
  if (!destination) {
    setMessage('背包满了，无法放回背包。');
    return false;
  }
  return dropToRef(destination, event);
}

function deployDraggedToMap(x, y, targetSlot = null, event = null) {
  if (!dragging) return false;
  if (game.phase !== 'prep') {
    setMessage('战斗中不能调整部署。');
    return false;
  }
  const source = dragging.source;
  const moving = getItemAt(source);
  if (!moving || moving.id !== dragging.itemId) return false;

  if (targetSlot && !sameRef(source, { area: 'deployed', slotId: targetSlot.id })) {
    return dropToRef({ area: 'deployed', slotId: targetSlot.id }, event);
  }

  const movingExistingSlotId = source.area === 'deployed' ? source.slotId : null;
  const placement = canCreateTowerSlot(x, y, movingExistingSlotId);
  if (!placement.ok) {
    setMessage(placement.reason);
    return false;
  }

  if (source.area === 'deployed') {
    const slot = game.customTowerSlots.find(item => item.id === source.slotId);
    if (!slot) return false;
    slot.x = x;
    slot.y = y;
    game.selected = source;
    setMessage(`已调整 ${towerName(moving)} 的位置。`);
  } else {
    const slotId = createCustomTowerSlot(x, y);
    setItemAt(source, null);
    game.deployed[slotId] = moving;
    game.selected = { area: 'deployed', slotId };
    setMessage(`已自由放置 ${towerName(moving)}。`);
  }
  const finalSelection = game.selected;
  clearDragVisuals({ keepSelection: true });
  game.selected = finalSelection;
  renderSide();
  return true;
}

function towerSpriteOverride(type, level = 1) {
  return activeMap?.towerSprites?.[type]?.levels?.[level - 1] || null;
}

function towerImageKey(type, level = 1) {
  const overrideKey = `${activeMapId}:${type}:${level}`;
  return towerImages[overrideKey] ? overrideKey : `${type}:${level}`;
}

function towerIconImage(type, level = 1) {
  const def = towersCfg[type];
  const sprite = def?.sprite;
  const override = towerSpriteOverride(type, level);
  return versionedSrc(override?.image || sprite?.levels?.[level - 1]?.image || sprite?.levels?.[0]?.image || sprite?.image || '');
}

function towerName(item) {
  return `${towersCfg[item.type].name} Lv${item.level}`;
}

function clickInventory(index) {
  const item = game.inventory[index];
  game.selected = item ? { area: 'inventory', index } : null;
  renderSide();
}

function clickDeployed(slotId) {
  const item = game.deployed[slotId];
  game.selected = item ? { area: 'deployed', slotId } : null;
  renderSide();
}

function selectedSellValue() {
  const item = selectedItem();
  if (!item) return 0;
  return Math.ceil(towersCfg[item.type].cost * (0.55 + (item.level - 1) * 0.45));
}

function towerSellValue(item) {
  if (!item) return 0;
  return Math.ceil(towersCfg[item.type].cost * (0.55 + (item.level - 1) * 0.45));
}

function upgradeDirectCost(item) {
  if (!item || item.level >= 3) return 0;
  return mergeGoldCost(item.type, item.level);
}

function hideTowerActionMenu() {
  if (!towerActionMenuEl) return;
  towerActionMenuEl.hidden = true;
  towerActionMenuEl.innerHTML = '';
  towerActionMenuEl.dataset.slotId = '';
}

function showTowerActionMenu(slotId, event = null) {
  if (!towerActionMenuEl || game.phase !== 'prep') return;
  const slot = findTowerSlot(slotId);
  const item = game.deployed[slotId];
  if (!slot || !item) return;
  if (!event && !towerActionMenuEl.hidden && towerActionMenuEl.dataset.slotId === slotId) return;
  const sellValue = towerSellValue(item);
  const upgradeCost = upgradeDirectCost(item);
  const canUpgrade = item.level < 3;
  towerActionMenuEl.dataset.slotId = slotId;
  towerActionMenuEl.innerHTML = `
    <button class="tower-menu-btn sell" type="button" data-action="sell">出售 <span class="mini-coin" aria-hidden="true"></span>${sellValue}</button>
    <button class="tower-menu-btn upgrade" type="button" data-action="upgrade" ${canUpgrade ? '' : 'disabled'}>升级 <span class="mini-coin" aria-hidden="true"></span>${canUpgrade ? upgradeCost : 'MAX'}</button>
  `;
  const rect = battlefieldEl.getBoundingClientRect();
  const pos = event ? canvasPoint(event) : { x: slot.x, y: slot.y };
  const menuWidth = 118;
  const menuHeight = 139;
  const towerRect = towerSpriteRect(slot, item);
  const towerPxWidth = towerRect.width * (rect.width / canvas.width);
  const menuGap = 4;
  const desiredLeft = (pos.x / canvas.width) * rect.width + towerPxWidth / 2 + menuGap;
  const fallbackLeft = (pos.x / canvas.width) * rect.width - towerPxWidth / 2 - menuGap - menuWidth;
  const left = desiredLeft + menuWidth <= rect.width - 8 ? desiredLeft : Math.max(8, fallbackLeft);
  towerActionMenuEl.style.left = `${Math.min(rect.width - menuWidth - 8, Math.max(8, left))}px`;
  towerActionMenuEl.style.top = `${Math.min(rect.height - menuHeight - 8, Math.max(8, (pos.y / canvas.height) * rect.height - menuHeight / 2 - menuHeight * 0.2))}px`;
  towerActionMenuEl.hidden = false;
}

function sellTowerBySlot(slotId) {
  const item = game.deployed[slotId];
  if (!item || game.phase !== 'prep') return;
  const value = towerSellValue(item);
  game.deployed[slotId] = null;
  cleanupEmptyTowerSlots();
  game.gold += value;
  game.selected = null;
  hideTowerActionMenu();
  setMessage(`出售 ${towerName(item)}，获得 ${value} 金币。`);
  renderSide();
}

function upgradeTowerBySlot(slotId) {
  const item = game.deployed[slotId];
  if (!item || game.phase !== 'prep') return;
  if (item.level >= 3) return setMessage('该建筑已经满级。');
  const cost = upgradeDirectCost(item);
  if (!canAfford(cost)) return setMessage(`金币不足：升级需要 ${cost} 金币，还差 ${cost - game.gold}。`);
  spendGold(cost);
  item.level += 1;
  item.cd = 0;
  game.selected = { area: 'deployed', slotId };
  spawnUpgradeEffectAt(game.selected);
  hideTowerActionMenu();
  setMessage(`升级成功：${towerName(item)}，消耗 ${cost} 金币。`);
  renderSide();
}

function sellSelected() {
  const item = selectedItem();
  if (!item || game.phase !== 'prep') return setMessage('准备阶段选择一个塔后才能出售。');
  const value = selectedSellValue();
  setItemAt(game.selected, null);
  game.gold += value;
  game.selected = null;
  setMessage(`出售成功，获得 ${value} 金币。`);
  renderSide();
  cleanupEmptyTowerSlots();
}
function expandInventory() {
  const inv = cfg.game.inventory;
  if (game.phase !== 'prep') return setMessage('战斗中不能扩容。');
  if (game.inventoryRows >= inv.maxRows) return setMessage('背包已经扩到最大。');
  if (!canAfford(inv.expandCost)) return setMessage(`金币不足，扩容需要 ${inv.expandCost}。`);
  spendGold(inv.expandCost);
  game.inventoryRows += 1;
  game.inventory.push(...Array(inv.cols).fill(null));
  setMessage('背包扩容成功，多了一整行格子。');
  renderSide();
}

function createWaveRetrySnapshot() {
  const snapshot = JSON.parse(JSON.stringify({ ...game, retrySnapshot: null }));
  snapshot.phase = 'prep';
  snapshot.result = null;
  snapshot.enemies = [];
  snapshot.projectiles = [];
  snapshot.floating = [];
  snapshot.spawnQueue = [];
  snapshot.spawnTimer = 0;
  snapshot.currentWaveSpawned = 0;
  snapshot.currentWaveTotal = 0;
  snapshot.waveAlive = false;
  snapshot.bossActive = false;
  snapshot.screenShake = { time: 0, duration: 0, intensity: 0 };
  return snapshot;
}

function restoreWaveRetrySnapshot() {
  const snapshot = game?.retrySnapshot;
  if (!snapshot) {
    newGame();
    setMessage('未找到本关开始数据，已重新开始。');
    return;
  }
  const restored = JSON.parse(JSON.stringify(snapshot));
  restored.retrySnapshot = JSON.parse(JSON.stringify(snapshot));
  game = restored;
  dragging = null;
  placementPreview = null;
  hoveredSlotId = null;
  setMessage(`已回到第 ${game.waveIndex + 1} 关开始前状态。`);
  renderSide();
}

function restartCurrentLevel() {
  restoreWaveRetrySnapshot();
}

function updateMainActionButton() {
  if (!startWaveBtn || !game) return;
  startWaveBtn.hidden = game.phase === 'ended';
  startWaveBtn.disabled = false;
  startWaveBtn.classList.remove('button-next-wave', 'button-pause', 'button-start');
  if (game.phase === 'combat') {
    startWaveBtn.textContent = '暂停';
    startWaveBtn.classList.add('button-pause');
  } else if (game.phase === 'paused') {
    startWaveBtn.textContent = '开始战斗';
    startWaveBtn.classList.add('button-start');
  } else {
    startWaveBtn.textContent = '开始战斗';
    startWaveBtn.classList.add('button-start');
    startWaveBtn.disabled = game.phase !== 'prep';
  }
}

function toggleMainAction() {
  if (!game) return;
  if (game.phase === 'combat') {
    game.phase = 'paused';
    setMessage('已暂停。');
    renderSide();
    return;
  }
  if (game.phase === 'paused') {
    game.phase = 'combat';
    setMessage('继续战斗。');
    renderSide();
    return;
  }
  startWave();
}

function startWave() {
  if (game.phase !== 'prep') return;
  if (game.waveIndex >= waveCfg.waves.length) {
    const bossCfg = waveCfg.boss;
    if (bossCfg?.enabled && !game.bossDefeated) startBoss();
    return;
  }
  game.retrySnapshot = createWaveRetrySnapshot();
  const wave = waveCfg.waves[game.waveIndex];
  game.phase = 'combat';
  game.hasStartedOnce = true;
  game.selected = null;
  game.waveAlive = true;
  game.spawnQueue = [];
  game.currentWaveTotal = wave.spawns.reduce((sum, group) => sum + group.count, 0);
  game.currentWaveSpawned = 0;
  game.bossActive = false;
  let delay = 0;
  for (const group of wave.spawns) {
    for (let i = 0; i < group.count; i++) {
      game.spawnQueue.push({ type: group.type, at: delay });
      delay += group.interval;
    }
  }
  game.spawnQueue.sort((a, b) => a.at - b.at);
  game.spawnTimer = 0;
  setMessage(`第 ${wave.wave} 波开始！战斗中部署锁定，不能移动或合成。`);
  renderSide();
}

function finishWave() {
  const wave = waveCfg.waves[game.waveIndex];
  const mineIncome = Object.values(game.deployed).reduce((sum, item) => {
    if (!item || item.type !== 'mine') return sum;
    const level = towersCfg.mine.levels[item.level - 1];
    return sum + level.income;
  }, 0);
  game.gold += wave.reward + mineIncome;
  game.score += game.hp * 3 + mineIncome;
  game.waveIndex += 1;
  game.phase = 'prep';
  game.waveAlive = false;
  rollShop(false);
  if (game.waveIndex >= waveCfg.waves.length) {
    const bossCfg = waveCfg.boss;
    if (bossCfg?.enabled && !game.bossDefeated) {
      startBoss();
    } else {
      game.phase = 'ended';
      game.result = 'win';
      setMessage(`胜利！基地剩余 ${game.hp} 血，最终分数 ${game.score}。`);
    }
  } else {
    setMessage(`第 ${wave.wave} 波结束：奖励 ${wave.reward}，金矿收入 ${mineIncome}。现在可以重新拖拽调整部署。`);
  }
  renderSide();
}

function startBoss() {
  const bossCfg = waveCfg.boss;
  game.retrySnapshot = createWaveRetrySnapshot();
  game.phase = 'combat';
  game.hasStartedOnce = true;
  game.selected = null;
  game.waveAlive = true;
  game.bossActive = true;
  game.bossSpawned = true;
  game.spawnQueue = [];
  game.currentWaveTotal = 1;
  game.currentWaveSpawned = 1;
  const bossType = activeMap?.bossType || bossCfg.type;
  const spawnedBoss = spawnEnemy(bossType);
  const boss = spawnedBoss && enemiesCfg[spawnedBoss.type]?.isBoss ? spawnedBoss : game.enemies.find(e => enemiesCfg[e.type]?.isBoss);
  if (boss && bossCfg.skills?.haste && !enemiesCfg[boss.type]?.towerAttack) {
    boss.skillTimers = { hasteDelay: bossCfg.skills.haste.triggerDelay ?? 1.2, haste: 0 };
  }
  if (boss) setupBossTowerAttack(boss);
  setMessage(bossCfg.warningText || 'BOSS 来袭！');
  renderSide();
}

async function finishBoss() {
  const bossCfg = waveCfg.boss;
  game.bossActive = false;
  game.bossDefeated = true;
  game.waveAlive = false;
  game.gold += bossCfg?.reward || 0;
  game.score += 500 + game.hp * 5;
  game.phase = 'transition';
  if (await advanceToNextMap()) return;
  game.phase = 'ended';
  game.result = 'win';
  setMessage(`Boss 已击败！基地剩余 ${game.hp} 血，最终分数 ${game.score}。`);
  renderSide();
}

function spawnEnemy(type, offset = 0) {
  const def = enemiesCfg[type];
  const p = cfg.game.path[0];
  const waveScale = Math.max(0, game.waveIndex + levelIndex);
  const hp = def.hp * (1 + waveScale * 0.10);
  const enemy = {
    id: crypto.randomUUID(),
    type,
    x: p.x + offset,
    y: p.y,
    hp,
    maxHp: hp,
    speed: def.speed * (1 + waveScale * 0.10),
    waypoint: 1,
    slowTimer: 0,
    slowFactor: 0,
    animTime: 0,
    spawnAge: 0,
    spawnFadeDuration: 0.5,
    attackTimer: 0,
    attackAge: 0,
    attacking: false,
    attackResolved: false,
    attackShakeResolved: false,
    dead: false
  };
  game.enemies.push(enemy);
  return enemy;
}

function update(dt) {
  if (!game) return;

  if (game.phase !== 'combat') {
    updateProjectiles(dt);
    updateFloating(dt);
    updatePortal(dt);
    updateScreenShake(dt);
    game.projectiles = game.projectiles.filter(p => !p.dead);
    game.floating = game.floating.filter(f => f.life > 0);
    return;
  }

  game.spawnTimer += dt;
  while (game.spawnQueue.length && game.spawnQueue[0].at <= game.spawnTimer) {
    const nextSpawn = game.spawnQueue[0];
    if (!canSpawnAtEntrance()) {
      nextSpawn.at = game.spawnTimer + SPAWN_RETRY_DELAY;
      break;
    }
    spawnEnemy(game.spawnQueue.shift().type);
    game.currentWaveSpawned += 1;
  }

  updateEnemies(dt);
  updateBossTowerAttacks(dt);
  updateTowers(dt);
  updateProjectiles(dt);
  updateFloating(dt);
  updatePortal(dt);
  updateScreenShake(dt);

  game.enemies = game.enemies.filter(e => !e.dead);
  game.projectiles = game.projectiles.filter(p => !p.dead);
  game.floating = game.floating.filter(f => f.life > 0);

  if (game.hp <= 0) {
    game.phase = 'ended';
    game.result = 'lose';
    setMessage(`失败：基地被突破。最终分数 ${game.score}。`);
    renderSide();
  } else if (game.spawnQueue.length === 0 && game.enemies.length === 0) {
    if (game.bossActive) finishBoss();
    else finishWave();
  }
}

function canSpawnAtEntrance() {
  const start = cfg.game.path?.[0];
  const next = cfg.game.path?.[1] || start;
  if (!start) return true;
  const dx = (next?.x ?? start.x) - start.x;
  const dy = (next?.y ?? start.y) - start.y;
  const lenSq = dx * dx + dy * dy || 1;
  for (const enemy of game.enemies) {
    if (enemy.dead) continue;
    const t = ((enemy.x - start.x) * dx + (enemy.y - start.y) * dy) / lenSq;
    const along = t * Math.sqrt(lenSq);
    const lateral = distancePointToSegment(enemy.x, enemy.y, start.x, start.y, next.x, next.y);
    if (along >= -8 && along < MIN_SPAWN_GAP && lateral < 36) return false;
  }
  return true;
}

function updatePortal(dt) {
  if (!game) return;
  game.portalTime = (game.portalTime || 0) + dt;
}

function updateScreenShake(dt) {
  if (!game?.screenShake) return;
  if (game.screenShake.time > 0) game.screenShake.time = Math.max(0, game.screenShake.time - dt);
}

function startScreenShake(duration = 0.45, intensity = 8) {
  if (!game) return;
  game.screenShake = { time: duration, duration, intensity };
}

function setupBossTowerAttack(boss) {
  const attackCfg = enemiesCfg[boss.type]?.towerAttack;
  if (!attackCfg) return;
  boss.attackTimer = attackCfg.initialDelay ?? attackCfg.cooldown ?? 8;
  boss.attackAge = 0;
  boss.attacking = false;
  boss.attackResolved = false;
  boss.attackShakeResolved = false;
  boss.attackHitEffectResolved = false;
}

function updateBossTowerAttacks(dt) {
  for (const boss of game.enemies) {
    const attackCfg = enemiesCfg[boss.type]?.towerAttack;
    if (!attackCfg || boss.dead) continue;
    if (boss.attacking) {
      boss.attackAge += dt;
      const attackDuration = attackCfg.duration || 1;
      const shakeAt = Math.max(0, attackDuration - 0.4);
      const hitEffectAt = Math.max(0, attackDuration - (attackCfg.towerHitEffectLead ?? 0.55));
      if (!boss.attackHitEffectResolved && boss.attackAge >= hitEffectAt) {
        boss.attackHitEffectResolved = true;
        spawnBossTowerHitEffects(attackCfg);
      }
      if (!boss.attackShakeResolved && boss.attackAge >= shakeAt) {
        boss.attackShakeResolved = true;
        startScreenShake(attackCfg.shakeDuration || 0.55, attackCfg.shakeIntensity || 9);
      }
      if (!boss.attackResolved && boss.attackAge >= attackDuration) {
        if (!boss.attackHitEffectResolved) {
          boss.attackHitEffectResolved = true;
          spawnBossTowerHitEffects(attackCfg);
        }
        resolveBossTowerAttack(boss, attackCfg);
      }
      if (boss.attackAge >= attackDuration) boss.attacking = false;
    }
    boss.attackTimer = (boss.attackTimer ?? attackCfg.cooldown ?? 8) - dt;
    if (boss.attackTimer <= 0) {
      triggerBossTowerAttack(boss, attackCfg);
      boss.attackTimer = attackCfg.cooldown || 8;
    }
  }
}

function triggerBossTowerAttack(boss, attackCfg) {
  boss.attacking = true;
  boss.attackAge = 0;
  boss.attackResolved = false;
  boss.attackShakeResolved = false;
  boss.attackHitEffectResolved = false;
  floatText(boss.x, boss.y - 86, attackCfg.name || '雪崩', '#93c5fd', { life: 1.05, size: 24, stroke: '#1e3a8a' });
}

function resolveBossTowerAttack(boss, attackCfg) {
  boss.attackResolved = true;
  const affected = damageAllTowersByBoss(attackCfg);
  if (affected > 0) setMessage(`Boss 发动${attackCfg.name || '雪崩'}：${affected} 座塔受到攻击，低级塔会消失，高级塔会降级。`);
}

function spawnBossTowerHitEffects(attackCfg = {}) {
  const hitEffect = attackCfg.towerHitEffect;
  if (!hitEffect) return;
  for (const slot of [...allTowerSlots()]) {
    const tower = game.deployed[slot.id];
    if (!tower) continue;
    spawnBossTowerHitEffect(slot, tower, hitEffect);
  }
}

function spawnBossTowerHitEffect(slot, tower, effectKey) {
  const def = SPRITE_SHEET_EFFECTS[effectKey];
  if (!slot || !tower || !def) return;
  const rect = towerSpriteRect(slot, tower);
  game.projectiles.push({
    type: 'spriteEffect',
    effect: effectKey,
    x: slot.x,
    y: rect.y + rect.height * 0.56,
    width: def.width,
    height: def.height,
    scale: 0.5 + Math.random() * 0.5,
    age: 0,
    duration: def.duration,
    frameEase: 'easeOut'
  });
}

function damageAllTowersByBoss(attackCfg = {}) {
  let affected = 0;
  for (const slot of [...allTowerSlots()]) {
    const tower = game.deployed[slot.id];
    if (!tower) continue;
    affected += 1;
    if (tower.level <= 1) {
      delete game.deployed[slot.id];
      game.customTowerSlots = game.customTowerSlots.filter(item => item.id !== slot.id);
      if (game.selected?.area === 'deployed' && game.selected.slotId === slot.id) game.selected = null;
      floatText(slot.x, slot.y - 72, '破碎', '#bfdbfe', { life: 0.9, size: 17, stroke: '#1e3a8a' });
    } else {
      tower.level -= 1;
      tower.cd = 0;
      floatText(slot.x, slot.y - 72, `降为Lv${tower.level}`, '#bfdbfe', { life: 0.9, size: 17, stroke: '#1e3a8a' });
    }
  }
  cleanupEmptyTowerSlots();
  renderSide();
  return affected;
}

function updateEnemies(dt) {
  const path = cfg.game.path;
  for (const enemy of game.enemies) {
    if (enemy.slowTimer > 0) enemy.slowTimer -= dt;
    if (enemy.skillTimers?.hasteTip > 0) enemy.skillTimers.hasteTip -= dt;
    enemy.spawnAge = Math.min(enemy.spawnFadeDuration || 1, (enemy.spawnAge || 0) + dt);
    enemy.animTime += dt;
    const hasteMultiplier = updateEnemyHaste(enemy, dt);
    const speed = enemy.attacking ? 0 : enemy.speed * hasteMultiplier * (enemy.slowTimer > 0 ? 1 - enemy.slowFactor : 1);
    const target = path[enemy.waypoint];
    const dx = target.x - enemy.x;
    const dy = target.y - enemy.y;
    const dist = Math.hypot(dx, dy);
    if (dist < speed * dt) {
      enemy.x = target.x;
      enemy.y = target.y;
      enemy.waypoint += 1;
      if (enemy.waypoint >= path.length) {
        enemy.dead = true;
        game.hp -= enemiesCfg[enemy.type].baseDamage;
        floatText(enemy.x, enemy.y, `-${enemiesCfg[enemy.type].baseDamage}❤`, '#fb7185');
      }
    } else {
      enemy.x += (dx / dist) * speed * dt;
      enemy.y += (dy / dist) * speed * dt;
    }
  }
}

function updateEnemyHaste(enemy, dt) {
  const def = enemiesCfg[enemy.type];
  if (!def?.isBoss || !enemy.skillTimers) return 1;
  const hasteCfg = waveCfg.boss?.skills?.haste;
  if (!hasteCfg) return 1;
  if (enemy.skillTimers.haste > 0) {
    enemy.skillTimers.haste -= dt;
    return hasteCfg.speedMultiplier || 2;
  }
  enemy.skillTimers.hasteDelay -= dt;
  if (enemy.skillTimers.hasteDelay <= 0) {
    enemy.skillTimers.haste = hasteCfg.duration || 4;
    enemy.skillTimers.hasteTip = 0.95;
    enemy.skillTimers.hasteDelay = hasteCfg.cooldown || 8;
    floatText(enemy.x, enemy.y - 66, hasteCfg.name || '极速', '#22c55e', { life: 1.1, size: 24, stroke: '#052e16' });
    return hasteCfg.speedMultiplier || 2;
  }
  return 1;
}

function updateTowers(dt) {
  for (const slot of allTowerSlots()) {
    const tower = game.deployed[slot.id];
    if (!tower || tower.type === 'mine') continue;
    tower.cd -= dt;
    if (tower.cd > 0) continue;
    const def = towersCfg[tower.type];
    const stat = def.levels[tower.level - 1];
    const targets = tower.type === 'ice'
      ? findRandomTargets(slot.x, slot.y, stat.range, stat.targetCount || 2)
      : [findTarget(slot.x, slot.y, stat.range)].filter(Boolean);
    if (!targets.length) continue;
    tower.cd = stat.cooldown;
    fireTower(tower, slot, targets[0], stat, targets);
  }
}

function findRandomTargets(x, y, range, count = 2) {
  const pool = game.enemies.filter(enemy => Math.hypot(enemy.x - x, enemy.y - y) <= range);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

function findTargets(x, y, range, count = 1) {
  return game.enemies
    .map(enemy => ({
      enemy,
      dist: Math.hypot(enemy.x - x, enemy.y - y),
      progress: enemy.waypoint * 10000 + enemy.x + enemy.y
    }))
    .filter(item => item.dist <= range)
    .sort((a, b) => b.progress - a.progress)
    .slice(0, count)
    .map(item => item.enemy);
}

function findTarget(x, y, range) {
  let best = null;
  let bestProgress = -1;
  for (const enemy of game.enemies) {
    const dist = Math.hypot(enemy.x - x, enemy.y - y);
    if (dist > range) continue;
    const progress = enemy.waypoint * 10000 + enemy.x + enemy.y;
    if (progress > bestProgress) {
      best = enemy;
      bestProgress = progress;
    }
  }
  return best;
}

function towerSpriteInfo(tower) {
  const def = towersCfg[tower.type];
  const sprite = def.sprite || {};
  const levelSprite = sprite.levels?.[tower.level - 1] || sprite;
  const overrideSprite = towerSpriteOverride(tower.type, tower.level) || {}; 
  return {
    image: overrideSprite.image || levelSprite.image,
    width: overrideSprite.width || levelSprite.width || sprite.width || 92,
    height: overrideSprite.height || levelSprite.height || sprite.height || 92,
    footY: overrideSprite.footY ?? levelSprite.footY ?? sprite.footY ?? 0.82,
    gemX: overrideSprite.gemX ?? levelSprite.gemX ?? sprite.gemX ?? 0.5,
    gemY: overrideSprite.gemY ?? levelSprite.gemY ?? sprite.gemY ?? 0.24
  };
}

function towerSpriteRect(slot, tower) {
  const sprite = towerSpriteInfo(tower);
  const width = sprite.width;
  const height = sprite.height;
  const x = slot.x - width / 2;
  const y = slot.y - height * sprite.footY;
  return { x, y, width, height, sprite };
}

function towerGemPoint(slot, tower) {
  const rect = towerSpriteRect(slot, tower);
  return {
    x: rect.x + rect.width * rect.sprite.gemX,
    y: rect.y + rect.height * rect.sprite.gemY
  };
}

function enemyHitPoint(enemy) {
  const def = enemiesCfg[enemy.type] || {};
  const sprite = def.sprite;
  if (sprite) {
    const height = sprite.height || 58;
    const footY = sprite.footY ?? 0.82;
    return { x: enemy.x, y: enemy.y - height * footY + height * 0.5 };
  }
  return { x: enemy.x, y: enemy.y };
}

function fireTower(tower, slot, target, stat, targets = [target]) {
  const color = towersCfg[tower.type].color;
  const origin = towerGemPoint(slot, tower);
  const targetHit = enemyHitPoint(target);
  if (tower.type === 'thunder') {
    damageEnemy(target, stat.damage, tower.type, stat);
    spawnHitEffect('thunderHit', targetHit.x, targetHit.y);
    explode({ tx: target.x, ty: target.y, splash: stat.splash, damage: Math.round(stat.damage * 0.55), primaryTargetId: target.id });
    game.projectiles.push({ type: 'effectBeam', effect: 'thunderBeam', x: origin.x, y: origin.y, tx: targetHit.x, ty: targetHit.y, targetExtend: 12, age: 0, duration: EFFECT_SEQUENCES.thunderBeam.duration, color });
  } else {
    if (tower.type === 'ice') {
      const iceAsset = PROJECTILE_ASSETS.ice;
      const shotCount = targets.length;
      targets.forEach((iceTarget, index) => {
        const spread = (index - (shotCount - 1) / 2) * 9;
        const iceHit = enemyHitPoint(iceTarget);
        const aimAngle = Math.atan2(iceHit.y - origin.y, iceHit.x - origin.x);
        const ox = origin.x + Math.cos(aimAngle + Math.PI / 2) * spread;
        const oy = origin.y + Math.sin(aimAngle + Math.PI / 2) * spread;
        damageEnemy(iceTarget, stat.damage, tower.type, stat);
        game.projectiles.push({ type: 'imageProjectile', imageKey: 'ice', x: ox, y: oy, tx: iceHit.x, ty: iceHit.y, age: 0, life: 0.16, maxWidth: iceAsset.maxWidth, maxHeight: iceAsset.maxHeight, color });
      });
    } else {
      damageEnemy(target, stat.damage, tower.type, stat);
      if (tower.type === 'light') {
        spawnHitEffect('lightHit', targetHit.x, targetHit.y);
        game.projectiles.push({ type: 'effectBeam', effect: 'lightBeam', x: origin.x, y: origin.y, tx: targetHit.x, ty: targetHit.y, age: 0, duration: EFFECT_SEQUENCES.lightBeam.duration, color });
      } else {
        game.projectiles.push({ type: 'beam', x: origin.x, y: origin.y, tx: targetHit.x, ty: targetHit.y, life: 0.12, color, width: 3 });
      }
    }
  }
}

function spawnHitEffect(effect, x, y) {
  const def = SPRITE_SHEET_EFFECTS[effect];
  if (!def) return;
  game.projectiles.push({ type: 'spriteEffect', effect, x, y, age: 0, duration: def.duration });
}

function updateProjectiles(dt) {
  for (const p of game.projectiles) {
    if (p.type === 'beam') {
      p.life -= dt;
      if (p.life <= 0) p.dead = true;
      continue;
    }
    if (p.type === 'effectBeam') {
      p.age += dt;
      if (p.age >= p.duration) p.dead = true;
      continue;
    }
    if (p.type === 'imageProjectile') {
      p.age += dt;
      if (p.age >= p.life) p.dead = true;
      continue;
    }
    if (p.type === 'spriteEffect') {
      p.age += dt;
      if (p.age >= p.duration) p.dead = true;
      continue;
    }
    if (p.type === 'shockwave') {
      p.age += dt;
      if (p.age >= p.life) p.dead = true;
      continue;
    }
    const dx = p.tx - p.x;
    const dy = p.ty - p.y;
    const dist = Math.hypot(dx, dy);
    if (dist < p.speed * dt) {
      explode(p);
      p.dead = true;
    } else {
      p.x += (dx / dist) * p.speed * dt;
      p.y += (dy / dist) * p.speed * dt;
    }
  }
}

function explode(p) {
  let hitCount = 0;
  for (const enemy of game.enemies) {
    if (enemy.id === p.primaryTargetId) continue;
    if (Math.hypot(enemy.x - p.tx, enemy.y - p.ty) <= p.splash) {
      damageEnemy(enemy, p.damage, 'thunder', { splash: p.splash });
      hitCount += 1;
    }
  }
  game.projectiles.push({ type: 'shockwave', x: p.tx, y: p.ty, age: 0, life: 0.28, radius: p.splash, color: '#c4b5fd' });
  floatText(p.tx, p.ty, hitCount ? `雷爆×${hitCount}` : '雷爆', '#ddd6fe');
}

function damageEnemy(enemy, amount, towerType, stat) {
  enemy.hp -= amount;
  if (towerType === 'ice') {
    enemy.slowFactor = Math.max(enemy.slowFactor, stat.slow || 0);
    enemy.slowTimer = Math.max(enemy.slowTimer, stat.slowDuration || 0);
  }
  if (enemy.hp <= 0 && !enemy.dead) killEnemy(enemy);
}

function killEnemy(enemy) {
  enemy.dead = true;
  const def = enemiesCfg[enemy.type];
  game.gold += def.reward;
  game.score += def.reward * 12;
  floatText(enemy.x, enemy.y, `+${def.reward}`, '#fde68a');
  if (def.splitInto) {
    for (let i = 0; i < def.splitInto.count; i++) {
      spawnEnemy(def.splitInto.type, i * -10);
      const child = game.enemies[game.enemies.length - 1];
      child.x = enemy.x + (i ? 10 : -10);
      child.y = enemy.y + (i ? 8 : -8);
      child.waypoint = enemy.waypoint;
      child.hp *= def.splitInto.hpScale;
      child.maxHp = child.hp;
      child.speed *= def.splitInto.speedScale;
    }
  }
}

function floatText(x, y, text, color, options = {}) {
  game.floating.push({ x, y, text, color, life: options.life || 0.8, maxLife: options.life || 0.8, size: options.size || 16, stroke: options.stroke || null });
}

function updateFloating(dt) {
  for (const f of game.floating) {
    f.life -= dt;
    f.y -= 32 * dt;
  }
}

function handleInventoryPointerMove(event) {
  if (!dragging?.pointerMode || game.phase !== 'prep') return;
  if ((event.buttons & 1) !== 1) {
    if (dragging.started) finishPointerDrag(event);
    return;
  }
  const moved = Math.hypot(event.clientX - (dragging.startClientX ?? dragging.startX), event.clientY - (dragging.startClientY ?? dragging.startY));
  if (!dragging.started && moved < 8) return;
  if (!dragging.started) {
    dragging.started = true;
    dragStartedInCommandDeck = true;
    document.body.classList.add('dragging');
  }
  updateCommandDeckDragVisibility(event);
  updateDragTooltipForInventory(event);
  updateDragGhost(event);
  placementPreview = null;
}

function renderGoldHud() {
  if (!goldHudEl) return;
  goldHudEl.innerHTML = `<span class="coin-icon" aria-hidden="true"></span><span class="coin-times">×</span><span class="coin-value">${goldText()}</span>`;
}

function renderSide() {
  if (!game) return;
  if (goldBadgeEl) goldBadgeEl.innerHTML = `<span class="coin-count">×${goldText()}</span>`;
  renderGoldHud();
  if (hudEl) hudEl.innerHTML = '';
  if (pendingBuild && game.phase !== 'prep') {
    pendingBuild = null;
    shopDragging = null;
    placementPreview = null;
  }
  commandDeckEl?.classList.toggle('is-hidden', game.phase !== 'prep');
  syncCommandDeckCollapse();

  shopEl.innerHTML = '';
  for (const type of game.shop) {
    const def = towersCfg[type];
    const card = document.createElement('div');
    card.className = 'shop-card';
    card.tabIndex = 0;
    card.title = `${def.name}：${def.cost} 金币`;
    card.setAttribute('role', 'button');
    if (pendingBuild?.type === type) card.classList.add('selected');
    card.innerHTML = `
      <div class="icon tower-icon shop-icon" style="--tower-color:${def.color}"><img src="${towerIconImage(type, 1)}" alt="${def.name}"></div>
      <div class="shop-item-label"><span class="shop-item-name">${def.name}</span><span class="mini-coin" aria-hidden="true"></span><span class="shop-item-cost">${def.cost}</span></div>
      <p>${def.description}</p>
    `;
    card.addEventListener('pointerdown', event => beginShopDrag(event, type));
    shopEl.appendChild(card);
  }
  for (let i = game.shop.length; i < 4; i += 1) {
    const empty = document.createElement('div');
    empty.className = 'shop-card shop-card-empty';
    empty.setAttribute('aria-hidden', 'true');
    shopEl.appendChild(empty);
  }

  if (inventoryEl) inventoryEl.innerHTML = '';
  game.inventory.forEach((item, index) => {
    const slot = document.createElement('div');
    slot.className = 'slot';
    slot.dataset.index = String(index);
    slot.setAttribute('role', 'button');
    slot.tabIndex = 0;
    if (game.phase !== 'prep') slot.classList.add('locked');
    if (game.selected?.area === 'inventory' && game.selected.index === index) slot.classList.add('selected');
    const previewItem = !item && dragging && inventoryDragPreviewIndex === index ? getItemAt(dragging.source) : null;
    if (previewItem) slot.classList.add('drag-return-preview');
    if (item || previewItem) {
      const renderItem = item || previewItem;
      const def = towersCfg[renderItem.type];
      slot.draggable = false;
      slot.innerHTML = `<div class="icon tower-icon inventory-icon" style="--tower-color:${def.color}"><img src="${towerIconImage(renderItem.type, renderItem.level)}" alt="${def.name} Lv${renderItem.level}"></div><span class="level">Lv${renderItem.level}</span>`;
      slot.title = `${def.name} Lv${renderItem.level}`;
      if (!item) {
        slot.setAttribute('aria-label', `放回 ${def.name} Lv${renderItem.level}`);
      }
      if (item) {
        slot.draggable = false;
        slot.addEventListener('pointerdown', event => {
          if (!pointerPrimaryDown(event)) return;
          if (game.phase !== 'prep') return;
          game.selected = { area: 'inventory', index };
          beginDrag(event, { area: 'inventory', index });
        });
      }
    }
    slot.addEventListener('pointermove', handleInventoryPointerMove);
    slot.addEventListener('click', () => clickInventory(index));
    slot.addEventListener('dragover', event => {
      if (!dragging || game.phase !== 'prep') return;
      event.preventDefault();
      slot.classList.add('drag-over');
      updateDragTooltipForInventory(event);
    });
    slot.addEventListener('dragleave', () => {
      slot.classList.remove('drag-over');
      if (inventoryDragPreviewIndex === index) updateInventoryDragPreview(null);
    });
    slot.addEventListener('drop', event => {
      event.preventDefault();
      slot.classList.remove('drag-over');
      const handled = dropToRef({ area: 'inventory', index }, event);
      if (!handled) clearDragVisuals();
    });
    if (inventoryEl) inventoryEl.appendChild(slot);
  });

  startWaveBtn.hidden = game.phase === 'ended';
  updateMainActionButton();
  if (restartBtn) restartBtn.hidden = !(game.phase === 'ended' && game.result === 'lose');
  if (rerollBtn) {
    rerollBtn.disabled = true;
    rerollBtn.style.display = 'none';
  }
  if (expandBtn) expandBtn.style.display = 'none';
  if (sellBtn) {
    const sellValue = selectedSellValue();
    sellBtn.disabled = game.phase !== 'prep' || !selectedItem();
    sellBtn.innerHTML = `<span class="action-label">出售</span><span class="action-cost"><span class="mini-coin" aria-hidden="true"></span>${sellValue}</span>`;
  }
}

function draw() {
  if (!game) return;
  ctx.save();
  applyScreenShake();
  drawBackground();
  if (game.phase === 'prep') drawPath();
  drawPlacementPreview();
  drawWorldObjects();
  drawProjectiles();
  drawTopBars();
  drawFloating();
  drawOverlayText();
  ctx.restore();
}

function applyScreenShake() {
  const shake = game?.screenShake;
  if (!shake?.time || shake.time <= 0) return;
  const t = shake.duration ? shake.time / shake.duration : 0;
  const amp = (shake.intensity || 8) * t;
  const x = (Math.random() * 2 - 1) * amp;
  const y = (Math.random() * 2 - 1) * amp;
  ctx.translate(x, y);
}

function drawBackground() {
  if (mapImage) {
    ctx.drawImage(mapImage, 0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(2, 6, 23, 0.08)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return;
  }
  const grd = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grd.addColorStop(0, '#0f172a');
  grd.addColorStop(1, '#111827');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawPath() {
  const path = cfg.game.path;
  if (!path?.length) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 6;
  ctx.setLineDash([14, 12]);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.34)';
  ctx.beginPath();
  ctx.moveTo(path[0].x, path[0].y);
  for (const p of path.slice(1)) ctx.lineTo(p.x, p.y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawTowerSlots() {
  for (const slot of allTowerSlots()) {
    const item = game.deployed[slot.id];
    drawTowerSlot(slot, item);
  }
}

function drawTowerSlot(slot, item) {
  const selected = game.selected?.area === 'deployed' && game.selected.slotId === slot.id;
  const hovered = hoveredSlotId === slot.id;
  ctx.save();
  ctx.translate(slot.x, slot.y);

  if (item) {
    const def = towersCfg[item.type];
    const stat = def.levels[item.level - 1];
    if (item.type !== 'mine' && game.phase === 'prep') {
      ctx.fillStyle = `${def.color}0c`;
      ctx.strokeStyle = `${def.color}55`;
      ctx.lineWidth = selected || hovered ? 2 : 1;
      ctx.beginPath();
      ctx.arc(0, 0, stat.range, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    const isDraggingThis = dragging?.source?.area === 'deployed' && dragging.source.slotId === slot.id && dragging.started;
    if (!isDraggingThis) drawTowerSprite(slot, item, 1, selected || hovered);
  } else {
    ctx.fillStyle = game.phase === 'prep' ? 'rgba(226, 232, 240, 0.40)' : 'rgba(148, 163, 184, 0.20)';
    ctx.strokeStyle = game.phase === 'prep' ? 'rgba(203, 213, 225, 0.32)' : 'rgba(148, 163, 184, 0.16)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.stroke();
    ctx.font = '900 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(game.phase === 'prep' ? '+' : '锁', 0, 1);
  }
  ctx.restore();
}

function drawTowerSprite(slot, item, alpha = 1, highlighted = false) {
  const def = towersCfg[item.type];
  const img = towerImages[towerImageKey(item.type, item.level)];
  const rect = towerSpriteRect({ x: 0, y: 0 }, item);
  ctx.save();
  ctx.globalAlpha = alpha;
  if (highlighted) {
    ctx.shadowColor = def.color;
    ctx.shadowBlur = 18;
  }
  if (img) {
    ctx.drawImage(img, rect.x, rect.y, rect.width, rect.height);
  } else {
    ctx.fillStyle = def.color;
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#06111f';
    ctx.font = '900 21px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(def.icon, 0, 1);
  }
  if (highlighted) {
    ctx.shadowBlur = 0;
    ctx.globalAlpha = alpha;
  }
  drawGemIdleEffect(item, rect, alpha);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#0b2a5b';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.78)';
  ctx.lineWidth = 3;
  ctx.font = '900 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeText(`Lv${item.level}`, 0, 31);
  ctx.fillText(`Lv${item.level}`, 0, 31);
  ctx.restore();
}

function drawGemIdleEffect(item, rect, alpha = 1) {
  const effect = GEM_IDLE_EFFECTS[item.type];
  const img = gemIdleImages[item.type];
  if (!effect || !img) return;

  const cols = effect.frameCols || 4;
  const rows = effect.frameRows || 4;
  const frames = effect.frames || cols * rows;
  const frameIndex = Math.floor((performance.now() / 1000) * (effect.fps || 12)) % frames;
  const sx = (frameIndex % cols) * (img.width / cols);
  const sy = Math.floor(frameIndex / cols) * (img.height / rows);
  const sw = img.width / cols;
  const sh = img.height / rows;
  const size = (effect.size || 42) * (item.level === 1 ? 0.6 : item.level === 3 ? 1.3 : 1);
  const cx = rect.x + rect.width * rect.sprite.gemX;
  const cy = rect.y + rect.height * rect.sprite.gemY + (effect.offsetY || 0);

  ctx.save();
  ctx.globalAlpha = Math.min(1, alpha * 0.92);
  ctx.globalCompositeOperation = 'screen';
  ctx.drawImage(img, sx, sy, sw, sh, cx - size / 2, cy - size / 2, size, size);
  ctx.restore();
}

function drawPlacementPreview() {
  if (!placementPreview || game.phase !== 'prep') return;
  const { x, y, ok, item, reason, mergePreview } = placementPreview;
  const def = towersCfg[item.type];
  const stat = def.levels[item.level - 1];

  ctx.save();
  ctx.translate(x, y);

  if (item.type !== 'mine') {
    ctx.fillStyle = ok ? `${def.color}22` : 'rgba(248, 113, 113, 0.16)';
    ctx.strokeStyle = ok ? `${def.color}dd` : 'rgba(248, 113, 113, 0.95)';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.arc(0, 0, stat.range, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // 拖拽时不再绘制建筑底部圆圈；只显示半透明建筑本体。
  drawTowerSprite({ x: 0, y: 0 }, item, ok ? 0.55 : 0.34, false);

  ctx.fillStyle = ok ? '#bbf7d0' : '#fecaca';
  ctx.font = '900 14px Microsoft YaHei, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const label = mergePreview ? mergePreview.text : `${ok ? '可放置' : '不可放置'} / 右键取消`;
  ctx.fillText(label, 0, -42);
  ctx.restore();
}

function drawWorldObjects() {
  drawMonsterExitPortal();
  const objects = [];
  for (const slot of allTowerSlots()) {
    const item = game.deployed[slot.id];
    if (!item) {
      objects.push({ kind: 'slot', y: slot.y, slot, item: null });
      continue;
    }
    objects.push({ kind: 'tower', y: slot.y, slot, item });
  }
  for (const enemy of game.enemies) {
    objects.push({ kind: 'enemy', y: enemy.y, enemy });
  }
  objects.sort((a, b) => a.y - b.y);
  for (const obj of objects) {
    if (obj.kind === 'enemy') drawEnemy(obj.enemy);
    else drawTowerSlot(obj.slot, obj.item);
  }
}

function drawMonsterExitPortal() {
  const def = SPRITE_SHEET_EFFECTS.monsterExitPortal;
  const img = spriteSheetImages.monsterExitPortal;
  const path = cfg.game.path;
  if (!def || !img || !path?.length || game.phase === 'ended') return;
  const start = path[0];
  const next = path[1] || start;
  const angle = Math.atan2(next.y - start.y, next.x - start.x);
  const cols = def.frameCols || 4;
  const rows = def.frameRows || 6;
  const frameCount = def.frames || cols * rows;
  const frameIndex = Math.floor(((game.portalTime || 0) / def.duration) * frameCount) % frameCount;
  const sw = img.width / cols;
  const sh = img.height / rows;
  const sx = (frameIndex % cols) * sw;
  const sy = Math.floor(frameIndex / cols) * sh;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  let x = start.x - dx * 18 - def.width * 0.03;
  let y = start.y - dy * 18 - 29 - def.height * 0.12;
  let drawW = def.width || sw;
  let drawH = def.height || sh;
  const tune = activeMapId === 'level_02' ? level02PortalDebugTune : portalDebugTune;
  x += tune.x;
  y += tune.y;
  drawW *= tune.scale;
  drawH *= tune.scale;
  const transform = { a: tune.scaleX, b: -0.08, c: 0.10, d: tune.scaleY, rotation: tune.rotation };

  ctx.save();
  ctx.globalCompositeOperation = def.composite || 'screen';
  ctx.globalAlpha = 0.92;
  ctx.translate(x, y);
  ctx.rotate(transform.rotation);
  ctx.transform(transform.a, transform.b, transform.c, transform.d, 0, 0);
  ctx.drawImage(img, sx, sy, sw, sh, -drawW / 2, -drawH / 2, drawW, drawH);
  ctx.restore();

  if (PORTAL_DEBUG) drawAdjustDebugOverlay({ start, next, x, y, width: drawW, height: drawH, transform, startLabel: activeMapId === 'level_02' ? '第二关入口点' : '第一关入口点', centerLabel: activeMapId === 'level_02' ? '第二关漩涡中心' : '第一关漩涡中心', tune });
}

function drawAdjustDebugOverlay({ start, next, x, y, width, height, transform, tune, startLabel = '参考点', centerLabel = '中心点' }) {
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.lineWidth = 2;
  ctx.font = '900 13px Microsoft YaHei, sans-serif';
  ctx.textBaseline = 'top';

  if (start) {
    ctx.strokeStyle = 'rgba(34, 197, 94, 0.95)';
    ctx.fillStyle = 'rgba(34, 197, 94, 0.95)';
    ctx.beginPath();
    ctx.moveTo(start.x - 14, start.y);
    ctx.lineTo(start.x + 14, start.y);
    ctx.moveTo(start.x, start.y - 14);
    ctx.lineTo(start.x, start.y + 14);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(start.x, start.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillText(startLabel, start.x + 10, start.y + 8);
  }

  ctx.strokeStyle = 'rgba(250, 204, 21, 0.95)';
  ctx.fillStyle = 'rgba(250, 204, 21, 0.95)';
  ctx.beginPath();
  ctx.moveTo(x - 18, y);
  ctx.lineTo(x + 18, y);
  ctx.moveTo(x, y - 18);
  ctx.lineTo(x, y + 18);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillText(centerLabel, x + 10, y + 8);

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(transform.rotation || 0);
  ctx.transform(transform.a, transform.b || 0, transform.c || 0, transform.d, 0, 0);
  ctx.strokeStyle = 'rgba(251, 113, 133, 0.95)';
  ctx.setLineDash([8, 6]);
  ctx.strokeRect(-width / 2, -height / 2, width, height);
  ctx.restore();

  if (start && next) {
    ctx.strokeStyle = 'rgba(96, 165, 250, 0.85)';
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(next.x, next.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (tune) {
    const text = `漩涡参数 ${JSON.stringify(tune)}`;
    ctx.setLineDash([]);
    ctx.font = '900 18px Microsoft YaHei, sans-serif';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillStyle = '#fef08a';
    ctx.strokeText(text, 18, 18);
    ctx.fillText(text, 18, 18);
  }
  ctx.restore();
}

function applyAdjustDebugKey(event, tune, label = 'AdjustDebug') {
  const step = event.shiftKey ? 10 : 2;
  let handled = true;
  if (event.key === 'ArrowLeft') tune.x -= step;
  else if (event.key === 'ArrowRight') tune.x += step;
  else if (event.key === 'ArrowUp') tune.y -= step;
  else if (event.key === 'ArrowDown') tune.y += step;
  else if (event.key === '=' || event.key === '+') tune.scale = +(tune.scale + 0.03).toFixed(2);
  else if (event.key === '-' || event.key === '_') tune.scale = Math.max(0.1, +(tune.scale - 0.03).toFixed(2));
  else if (event.key === ']') tune.scaleX = +(tune.scaleX + 0.02).toFixed(2);
  else if (event.key === '[') tune.scaleX = Math.max(0.1, +(tune.scaleX - 0.02).toFixed(2));
  else if (event.key === '.') tune.rotation = +((tune.rotation || 0) + (event.shiftKey ? 0.1 : 0.03)).toFixed(3);
  else if (event.key === ',') tune.rotation = +((tune.rotation || 0) - (event.shiftKey ? 0.1 : 0.03)).toFixed(3);
  else handled = false;
  if (!handled) return false;
  event.preventDefault();
  console.log(`[${label}]`, JSON.stringify(tune));
  return true;
}

function drawEnemies() {
  for (const e of game.enemies) {
    drawEnemy(e);
    drawBossHasteTip(e);
  }
}

function drawBossHasteTip(e) {
  const def = enemiesCfg[e.type];
  const tipLife = e.skillTimers?.hasteTip || 0;
  if (!def?.isBoss || tipLife <= 0) return;
  const sprite = def.sprite || {};
  const h = sprite.height || (def.radius || 22) * 2;
  const y = e.y - h * (sprite.footY ?? 0.82) - 20 - (1 - tipLife / 0.95) * 18;
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, tipLife / 0.95));
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '900 28px Microsoft YaHei, sans-serif';
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#052e16';
  ctx.strokeText('极速', e.x, y);
  ctx.fillStyle = '#22c55e';
  ctx.fillText('极速', e.x, y);
  ctx.restore();
}

function drawEnemy(e) {
  const def = enemiesCfg[e.type];
  const isBoss = !!def.isBoss;
  const sprite = e.attacking && def.attackSprite ? def.attackSprite : def.sprite;
  const img = e.attacking && enemyImages[`${e.type}:attack`] ? enemyImages[`${e.type}:attack`] : enemyImages[e.type];
  const radius = def.radius || (e.type === 'brute' ? 17 : 13);

  if (sprite && img) {
    const cols = sprite.frameCols || 4;
    const rows = sprite.frameRows || 4;
    const frames = sprite.frames || cols * rows;
    const fps = sprite.fps || 10;
    const frame = e.attacking
      ? Math.min(frames - 1, Math.floor(((e.attackAge || 0) / (def.towerAttack?.duration || 1)) * frames))
      : Math.floor((e.animTime || 0) * fps) % frames;
    const sx = (frame % cols) * (img.width / cols);
    const sy = Math.floor(frame / cols) * (img.height / rows);
    const sw = img.width / cols;
    const sh = img.height / rows;
    const dw = sprite.width || 58;
    const dh = sprite.height || 58;
    const dx = e.x - dw / 2;
    let dy = e.y - dh * (sprite.footY ?? 0.82);
    if (e.type === 'boss_snow_guardian') dy += 12;

    const shadowWidthScale = isBoss ? 0.46 : (e.type === 'brute' ? 0.82 : 0.70);
    const shadowHeightScale = isBoss ? 0.14 : 0.22;
    drawEnemyShadow(e.x, e.y, dw * shadowWidthScale, Math.max(12, dh * shadowHeightScale));

    ctx.save();
    applyEnemySpawnAppearance(e);
    if (e.slowTimer > 0) {
      ctx.filter = 'brightness(1.48) saturate(0.42) contrast(1.04) drop-shadow(0 0 7px rgba(186, 230, 253, 0.95))';
    } else if (isBoss) {
      ctx.filter = 'drop-shadow(0 4px 8px rgba(15, 23, 42, 0.35))';
    }
    const spawnPurple = enemySpawnPurpleAmount(e);
    if (spawnPurple > 0) {
      ctx.save();
      ctx.globalAlpha *= 1 - spawnPurple;
      ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
      ctx.restore();
      drawTintedSprite(img, sx, sy, sw, sh, dx, dy, dw, dh, spawnPurple);
    } else {
      ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
    }
    ctx.restore();

    const hpW = Math.max(34, dw * 0.72);
    const hpPct = Math.max(0, e.hp / e.maxHp);
    const hpY = e.type === 'boss_snow_guardian' ? dy + 52 : dy - 8;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
    ctx.fillRect(e.x - hpW / 2, hpY, hpW, 5);
    ctx.fillStyle = isBoss ? '#ef4444' : hpPct > 0.4 ? '#22c55e' : '#fb7185';
    ctx.fillRect(e.x - hpW / 2, hpY, hpW * hpPct, 5);
    return;
  }

  drawEnemyShadow(e.x, e.y, radius * (isBoss ? 2.45 : 1.9), radius * 0.9);

  ctx.save();
  applyEnemySpawnAppearance(e);
  if (isBoss) {
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 18;
  }
  const spawnPurple = enemySpawnPurpleAmount(e);
  const drawCircleEnemy = () => {
    ctx.fillStyle = e.slowTimer > 0 ? '#bae6fd' : def.color;
    ctx.strokeStyle = isBoss ? '#fee2e2' : '#0f172a';
    ctx.lineWidth = isBoss ? 4 : 2;
    ctx.beginPath();
    ctx.arc(e.x, e.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (isBoss) {
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff7ed';
      ctx.font = '900 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('B', e.x, e.y + 1);
    }
  };
  if (spawnPurple > 0) {
    ctx.save();
    ctx.globalAlpha *= 1 - spawnPurple;
    drawCircleEnemy();
    ctx.restore();
    ctx.save();
    ctx.globalAlpha *= spawnPurple;
    ctx.fillStyle = '#7c3aed';
    ctx.strokeStyle = '#c4b5fd';
    ctx.lineWidth = isBoss ? 4 : 2;
    ctx.beginPath();
    ctx.arc(e.x, e.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (isBoss) {
      ctx.fillStyle = '#ede9fe';
      ctx.font = '900 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('B', e.x, e.y + 1);
    }
    ctx.restore();
  } else {
    drawCircleEnemy();
  }
  ctx.restore();

  const w = isBoss ? 58 : 34;
  const hpPct = Math.max(0, e.hp / e.maxHp);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
  ctx.fillRect(e.x - w / 2, e.y - radius - 14, w, 5);
  ctx.fillStyle = isBoss ? '#ef4444' : hpPct > 0.4 ? '#22c55e' : '#fb7185';
  ctx.fillRect(e.x - w / 2, e.y - radius - 14, w * hpPct, 5);
}

function applyEnemySpawnAppearance(enemy) {
  const duration = enemy.spawnFadeDuration || 0.5;
  const t = Math.max(0, Math.min(1, (enemy.spawnAge || 0) / duration));
  if (t >= 1) return;
  const eased = t * t * (3 - 2 * t);
  ctx.globalAlpha *= eased;
}

function drawTintedSprite(img, sx, sy, sw, sh, dx, dy, dw, dh, alpha) {
  const w = Math.max(1, Math.ceil(dw));
  const h = Math.max(1, Math.ceil(dh));
  if (tintCanvas.width !== w || tintCanvas.height !== h) {
    tintCanvas.width = w;
    tintCanvas.height = h;
  }
  tintCtx.clearRect(0, 0, w, h);
  tintCtx.globalCompositeOperation = 'source-over';
  tintCtx.globalAlpha = 1;
  tintCtx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
  tintCtx.globalCompositeOperation = 'source-in';
  tintCtx.fillStyle = '#7c3aed';
  tintCtx.fillRect(0, 0, w, h);
  tintCtx.globalCompositeOperation = 'source-over';
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.drawImage(tintCanvas, dx, dy, dw, dh);
  ctx.restore();
}

function enemySpawnPurpleAmount(enemy) {
  const duration = enemy.spawnFadeDuration || 0.5;
  const t = Math.max(0, Math.min(1, (enemy.spawnAge || 0) / duration));
  if (t >= 1) return 0;
  const eased = t * t * (3 - 2 * t);
  return Math.max(0, 1 - eased);
}

function drawEnemyShadow(x, y, width, height) {
  ctx.save();
  const gradient = ctx.createRadialGradient(x, y, 2, x, y, Math.max(width, height));
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0.26)');
  gradient.addColorStop(0.65, 'rgba(0, 0, 0, 0.16)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(x, y + 7, width / 2, height / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawEffectBeam(p) {
  const sequence = EFFECT_SEQUENCES[p.effect];
  const frames = effectImages[p.effect];
  if (!sequence || !frames?.length) {
    ctx.save();
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.tx, p.ty);
    ctx.stroke();
    ctx.restore();
    return;
  }

  const frameIndex = Math.min(frames.length - 1, Math.floor((p.age / p.duration) * frames.length));
  const img = frames[frameIndex];
  const rawDx = p.tx - p.x;
  const rawDy = p.ty - p.y;
  const rawDistance = Math.max(1, Math.hypot(rawDx, rawDy));
  const extend = p.targetExtend || 0;
  const dx = rawDx + (rawDx / rawDistance) * extend;
  const dy = rawDy + (rawDy / rawDistance) * extend;
  const distance = Math.max(24, Math.hypot(dx, dy));
  const angle = Math.atan2(dy, dx);
  const maxFrameWidth = Math.max(...frames.map(frame => frame.width || 1));
  const maxFrameHeight = Math.max(...frames.map(frame => frame.height || 1));
  const drawWidth = distance;
  const drawHeight = sequence.beamThickness || sequence.maxHeight || 60;

  ctx.save();
  ctx.translate((p.x + p.tx) / 2, (p.y + p.ty) / 2);
  ctx.rotate(angle);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'screen';
  ctx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
  ctx.restore();
}

function drawImageProjectile(p) {
  const img = projectileImages[p.imageKey];
  if (!img) {
    ctx.save();
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.tx, p.ty, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  const dx = p.tx - p.x;
  const dy = p.ty - p.y;
  const angle = Math.atan2(dy, dx);
  const scale = Math.min((p.maxWidth || img.width) / img.width, (p.maxHeight || img.height) / img.height);
  const drawWidth = img.width * scale;
  const drawHeight = img.height * scale;
  const t = Math.min(1, p.age / p.life);
  const cx = p.x + dx * t;
  const cy = p.y + dy * t;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.globalAlpha = Math.max(0, 1 - t * 0.35);
  ctx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
  ctx.restore();
}

function drawSpriteEffect(p) {
  const def = SPRITE_SHEET_EFFECTS[p.effect];
  const img = spriteSheetImages[p.effect];
  if (!def || !img) return;
  let drawX = p.x;
  let drawY = p.y;
  if (p.anchorSlotId) {
    const slot = findTowerSlot(p.anchorSlotId);
    const item = slot ? game.deployed[slot.id] : null;
    if (slot && item) {
      const rect = towerSpriteRect(slot, item);
      drawX = slot.x;
      drawY = rect.y + rect.height * 0.48 - 21;
    }
  }
  const cols = def.frameCols || 1;
  const rows = def.frameRows || 1;
  const frameCount = def.frames || cols * rows;
  const t = Math.min(1, p.age / p.duration);
  const frameT = p.frameEase === 'easeOut' ? 1 - Math.pow(1 - t, 4.8) : t;
  const frameIndex = Math.min(frameCount - 1, Math.floor(frameT * frameCount));
  const sw = img.width / cols;
  const sh = img.height / rows;
  const sx = (frameIndex % cols) * sw;
  const sy = Math.floor(frameIndex / cols) * sh;
  const scale = (p.effect === 'towerUpgrade' ? 0.92 + t * 0.18 : 1) * (p.scale ?? 1);
  const dw = (p.width || def.width || sw) * scale;
  const dh = (p.height || def.height || sh) * scale;
  ctx.save();
  ctx.globalCompositeOperation = def.composite || 'source-over';
  ctx.globalAlpha = 1;
  ctx.drawImage(img, sx, sy, sw, sh, drawX - dw / 2, drawY - dh / 2, dw, dh);
  ctx.restore();
}

function drawProjectiles() {
  for (const p of game.projectiles) {
    if (p.type === 'effectBeam') {
      drawEffectBeam(p);
    } else if (p.type === 'spriteEffect') {
      drawSpriteEffect(p);
    } else if (p.type === 'imageProjectile') {
      drawImageProjectile(p);
    } else if (p.type === 'shockwave') {
      drawShockwave(p);
    } else if (p.type === 'beam') {
      ctx.globalAlpha = Math.max(0, p.life / 0.12);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = p.width || 3;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.tx, p.ty);
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawShockwave(p) {
  const t = Math.min(1, p.age / p.life);
  ctx.save();
  ctx.globalAlpha = 1 - t;
  ctx.strokeStyle = p.color || '#c4b5fd';
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.arc(p.x, p.y, Math.max(8, p.radius * (0.35 + t * 0.65)), 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawTopBars() {
  drawTopHudArt();
}

function drawTopHudArt() {
  const centerImg = uiPanelImages.topCenter;
  const hpImg = uiPanelImages.hpBar;
  const spawnImg = uiPanelImages.spawnBar;
  if (!centerImg || !hpImg || !spawnImg) {
    drawBaseHealthBar();
    drawWaveProgressBar();
    return;
  }

  const topHudScale = 0.8;
  const topY = 12;
  const centerW = Math.round(79 * topHudScale);
  const centerH = Math.round(centerW * (centerImg.height / centerImg.width));
  const sideW = Math.round(400 * topHudScale);
  const sideH = Math.round(sideW * (hpImg.height / hpImg.width));
  const gap = Math.round(-8 * topHudScale);
  const spread = Math.round(24 * topHudScale);
  const centerX = Math.round((canvas.width - centerW) / 2);
  const centerY = Math.round(topY);
  const sideY = Math.round(centerY + (centerH - sideH) / 2 + 2);
  const leftX = Math.round(centerX - sideW - gap - spread);
  const rightX = Math.round(centerX + centerW + gap + spread);

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.46)';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 5;
  ctx.drawImage(centerImg, centerX, centerY, centerW, centerH);
  drawImageContain(hpImg, leftX, sideY, sideW, sideH, false);
  drawImageContain(spawnImg, rightX, sideY, sideW, sideH, true);
  ctx.shadowColor = 'transparent';
  ctx.shadowOffsetY = 0;

  const hpPct = Math.max(0, Math.min(1, game.hp / (cfg.game.baseHp || 1)));
  const barX = sideW * 0.113;
  const barY = sideH * 0.385;
  const barW = sideW * 0.786;
  const barH = sideH * 0.227;
  drawBarFill(leftX + barX + 2, sideY + barY, barW, barH, hpPct, '#ef4444');

  let spawnPct = 0;
  let spawnLabel = '0/0';
  if (game.bossActive) {
    const boss = game.enemies.find(e => enemiesCfg[e.type]?.isBoss);
    spawnPct = boss ? 1 - Math.max(0, boss.hp / boss.maxHp) : 1;
    spawnLabel = boss ? 'BOSS' : '1/1';
  } else if (game.phase === 'combat') {
    spawnPct = game.currentWaveTotal ? game.currentWaveSpawned / game.currentWaveTotal : 0;
    spawnLabel = `${Math.min(game.currentWaveSpawned, game.currentWaveTotal)}/${game.currentWaveTotal}`;
  } else if (game.phase === 'prep') {
    spawnPct = waveCfg.waves.length ? game.waveIndex / waveCfg.waves.length : 0;
    spawnLabel = `${Math.min(game.waveIndex + 1, waveCfg.waves.length)}/${waveCfg.waves.length}`;
  } else if (game.result === 'win') {
    spawnPct = 1;
    spawnLabel = '完成';
  }
  drawBarFill(rightX + barX - 4, sideY + barY - 1, barW, barH, Math.max(0, Math.min(1, spawnPct)), game.bossActive ? '#f97316' : '#67e8f9', true);
  drawTopBarText(leftX, sideY, sideW, sideH, `${Math.max(0, Math.ceil(game.hp))}/${cfg.game.baseHp || 1}`);
  drawTopBarText(rightX, sideY, sideW, sideH, spawnLabel);
  ctx.restore();
}

function drawImageContain(img, x, y, w, h, flipX = false) {
  x = Math.round(x);
  y = Math.round(y);
  w = Math.round(w);
  h = Math.round(h);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  if (flipX) {
    ctx.translate(x + w, y);
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0, w, h);
  } else {
    ctx.drawImage(img, x, y, w, h);
  }
  ctx.restore();
}

function drawBarFill(x, y, w, h, pct, color, reverse = false) {
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = color;
  const fillW = w * pct;
  const fillX = reverse ? x + w - fillW : x;
  ctx.beginPath();
  ctx.roundRect(fillX, y, fillW, h, h / 2);
  ctx.fill();
  ctx.restore();
}

function drawTopBarText(x, y, w, h, text) {
  ctx.save();
  ctx.fillStyle = '#f8fafc';
  ctx.strokeStyle = 'rgba(8, 22, 52, 0.88)';
  ctx.lineWidth = 3;
  ctx.font = '900 11px Microsoft YaHei, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const tx = x + w * 0.5;
  const ty = y + h * 0.505;
  ctx.strokeText(text, tx, ty);
  ctx.fillText(text, tx, ty);
  ctx.restore();
}

function drawBaseHealthBar() {
  const maxHp = cfg.game.baseHp || 1;
  const hpPct = Math.max(0, Math.min(1, game.hp / maxHp));
  const w = 520;
  const h = 14;
  const x = (canvas.width - w) / 2;
  const y = 18;

  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 999);
  ctx.fill();

  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.roundRect(x, y, w * hpPct, h, 999);
  ctx.fill();

  ctx.strokeStyle = '#0b2a5b';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 999);
  ctx.stroke();

  ctx.fillStyle = '#fee2e2';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.font = '900 13px Microsoft YaHei, sans-serif';
  ctx.fillText(`基地 ${Math.max(0, Math.ceil(game.hp))}/${maxHp}`, canvas.width / 2, y - 4);
  ctx.restore();
}

function drawWaveProgressBar() {
  const w = 520;
  const h = 10;
  const x = (canvas.width - w) / 2;
  const y = 46;
  let pct = 0;
  let label = '出怪准备';

  if (game.bossActive) {
    const boss = game.enemies.find(e => enemiesCfg[e.type]?.isBoss);
    pct = boss ? 1 - Math.max(0, boss.hp / boss.maxHp) : 1;
    label = boss ? 'BOSS 战' : 'BOSS 已击败';
  } else if (game.phase === 'combat') {
    pct = game.currentWaveTotal ? game.currentWaveSpawned / game.currentWaveTotal : 0;
    label = `出怪 ${Math.min(game.currentWaveSpawned, game.currentWaveTotal)}/${game.currentWaveTotal}`;
  } else if (game.phase === 'prep') {
    pct = waveCfg.waves.length ? game.waveIndex / waveCfg.waves.length : 0;
    label = `波次 ${Math.min(game.waveIndex + 1, waveCfg.waves.length)}/${waveCfg.waves.length}`;
  } else if (game.result === 'win') {
    pct = 1;
    label = game.bossDefeated ? 'BOSS 已击败' : '防守完成';
  }
  pct = Math.max(0, Math.min(1, pct));

  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 999);
  ctx.fill();
  ctx.fillStyle = game.bossActive ? '#f97316' : '#67e8f9';
  ctx.beginPath();
  ctx.roundRect(x, y, w * pct, h, 999);
  ctx.fill();
  ctx.strokeStyle = '#0b2a5b';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 999);
  ctx.stroke();
  ctx.fillStyle = '#e0f2fe';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = '800 12px Microsoft YaHei, sans-serif';
  ctx.fillText(label, canvas.width / 2, y + h + 4);
  ctx.restore();
}

function drawFloating() {
  ctx.textAlign = 'center';
  for (const f of game.floating) {
    const maxLife = f.maxLife || 0.8;
    ctx.globalAlpha = Math.max(0, f.life / maxLife);
    ctx.font = `900 ${f.size || 16}px Microsoft YaHei, sans-serif`;
    if (f.stroke) {
      ctx.lineWidth = Math.max(3, (f.size || 16) * 0.18);
      ctx.strokeStyle = f.stroke;
      ctx.strokeText(f.text, f.x, f.y);
    }
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}

function drawOverlayText() {
  if (game.phase !== 'ended') return;
  ctx.fillStyle = 'rgba(2, 6, 23, 0.64)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const isLose = game.result === 'lose';
  const panel = isLose ? uiPanelImages.defeatPanel : null;
  if (panel) {
    const panelW = 728;
    const panelH = panelW * (panel.height / panel.width);
    const panelX = canvas.width / 2 - panelW / 2;
    const panelY = canvas.height / 2 - panelH / 2 - 18;
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 10;
    ctx.drawImage(panel, panelX, panelY, panelW, panelH);
    ctx.restore();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff7ed';
    ctx.strokeStyle = 'rgba(74, 21, 9, 0.82)';
    ctx.lineWidth = 7;
    ctx.font = '900 48px Microsoft YaHei, sans-serif';
    ctx.strokeText('防守失败', canvas.width / 2, panelY + panelH * 0.42);
    ctx.fillText('防守失败', canvas.width / 2, panelY + panelH * 0.42);
    ctx.fillStyle = '#e5edf8';
    ctx.strokeStyle = 'rgba(2, 6, 23, 0.75)';
    ctx.lineWidth = 4;
    ctx.font = '800 20px Microsoft YaHei, sans-serif';
    const info = `最终分数：${game.score}   剩余基地血量：${game.hp}`;
    ctx.strokeText(info, canvas.width / 2, panelY + panelH * 0.61);
    ctx.fillText(info, canvas.width / 2, panelY + panelH * 0.61);
    return;
  }

  ctx.fillStyle = game.result === 'win' ? '#5eead4' : '#fb7185';
  ctx.textAlign = 'center';
  ctx.font = '900 58px Microsoft YaHei, sans-serif';
  ctx.fillText(game.result === 'win' ? '防守成功' : '防守失败', canvas.width / 2, canvas.height / 2 - 20);
  ctx.fillStyle = '#e5edf8';
  ctx.font = '700 22px Microsoft YaHei, sans-serif';
  ctx.fillText(`最终分数：${game.score}，剩余基地血量：${game.hp}`, canvas.width / 2, canvas.height / 2 + 28);
}

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  const clientX = Number.isFinite(event.clientX) && event.clientX !== 0 ? event.clientX : null;
  const clientY = Number.isFinite(event.clientY) && event.clientY !== 0 ? event.clientY : null;
  if (clientX === null || clientY === null) return lastCanvasPointer;

  const canvasRatio = canvas.width / canvas.height;
  const rectRatio = rect.width / rect.height;
  let drawWidth = rect.width;
  let drawHeight = rect.height;
  let offsetX = 0;
  let offsetY = 0;

  // CSS 使用 object-fit: contain 时，真实绘制区域可能有上下或左右留白；这里扣掉留白再换算。
  if (rectRatio > canvasRatio) {
    drawHeight = rect.height;
    drawWidth = drawHeight * canvasRatio;
    offsetX = (rect.width - drawWidth) / 2;
  } else {
    drawWidth = rect.width;
    drawHeight = drawWidth / canvasRatio;
    offsetY = (rect.height - drawHeight) / 2;
  }

  const x = ((clientX - rect.left - offsetX) / drawWidth) * canvas.width;
  const y = ((clientY - rect.top - offsetY) / drawHeight) * canvas.height;
  lastCanvasPointer = {
    x: Math.max(0, Math.min(canvas.width, x)),
    y: Math.max(0, Math.min(canvas.height, y))
  };
  return lastCanvasPointer;
}

function slotAtCanvasEvent(event, ignoreSlotId = null, radius = 64) {
  const { x, y } = canvasPoint(event);
  return allTowerSlots().find(slot => slot.id !== ignoreSlotId && Math.hypot(slot.x - x, slot.y - y) <= radius) || null;
}

function bestMergeSlotForDragged(event, radius = 86) {
  if (!dragging?.source) return null;
  const moving = getItemAt(dragging.source);
  if (!moving) return null;
  const { x, y } = canvasPoint(event);
  let best = null;
  let bestDist = Infinity;
  for (const slot of allTowerSlots()) {
    if (dragging.source.area === 'deployed' && slot.id === dragging.source.slotId) continue;
    const targetItem = game.deployed[slot.id];
    if (!canMerge(moving, targetItem)) continue;
    const dist = Math.hypot(slot.x - x, slot.y - y);
    if (dist <= radius && dist < bestDist) {
      best = slot;
      bestDist = dist;
    }
  }
  return best;
}

function canvasClick(event) {
  if (suppressNextCanvasClick) {
    suppressNextCanvasClick = false;
    return;
  }
  if (pendingBuild) {
    // 现在商店道具必须通过拖拽建造；单击地图不再放置。
    return;
  }
  const slot = slotAtCanvasEvent(event);
  if (!slot) {
    game.selected = null;
    hideTowerActionMenu();
    renderSide();
    return;
  }
  clickDeployed(slot.id);
  if (towerActionMenuEl?.dataset.slotId === slot.id && !towerActionMenuEl.hidden) return;
  showTowerActionMenu(slot.id, event);
}

function setCommandDeckCollapsed(collapsed) {
  commandDeckCollapsed = !!collapsed;
  syncCommandDeckCollapse();
}

function syncCommandDeckCollapse() {
  commandDeckEl?.classList.toggle('is-collapsed', commandDeckCollapsed);
  battlefieldEl?.classList.toggle('deck-collapsed', commandDeckCollapsed);
  if (deckCollapseBtn) deckCollapseBtn.setAttribute('aria-expanded', String(!commandDeckCollapsed));
  if (deckExpandBtn) deckExpandBtn.setAttribute('aria-expanded', String(!commandDeckCollapsed));
}

function loop(time) {
  const dt = Math.min((time - lastTime) / 1000 || 0, 0.033);
  lastTime = time;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

function toggleLevelSelectPanel() {
  if (!levelSelectPanelEl) return;
  levelSelectPanelEl.classList.toggle('is-hidden');
}

function handleGoldHudClick(event) {
  event.preventDefault();
  event.stopPropagation();
  const now = performance.now();
  if (!goldHudFirstClickTime || now - goldHudFirstClickTime > 1000) {
    goldHudFirstClickTime = now;
    goldHudClickCount = 1;
    return;
  }
  goldHudClickCount += 1;
  if (goldHudClickCount >= 3) {
    goldHudClickCount = 0;
    goldHudFirstClickTime = 0;
    toggleLevelSelectPanel();
  }
}

function updateFullscreenUi() {
  const isFullscreen = !!document.fullscreenElement;
  document.body.classList.toggle('is-fullscreen', isFullscreen);
  if (!fullscreenBtn) return;
  fullscreenBtn.textContent = isFullscreen ? '×' : '⛶';
  fullscreenBtn.setAttribute('aria-label', isFullscreen ? '退出全屏' : '全屏');
  fullscreenBtn.title = isFullscreen ? '退出全屏' : '全屏';
}

async function toggleFullscreen() {
  if (!fullscreenBtn) return;
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen?.();
    } else {
      const target = document.documentElement;
      await target.requestFullscreen?.({ navigationUI: 'hide' });
    }
  } catch (error) {
    setMessage('当前浏览器不支持网页全屏，请使用浏览器菜单或添加到主屏幕。');
  } finally {
    updateFullscreenUi();
  }
}

startWaveBtn.addEventListener('click', toggleMainAction);
restartBtn?.addEventListener('click', restartCurrentLevel);
if (rerollBtn) rerollBtn.addEventListener('click', () => rollShop(true));
if (expandBtn) expandBtn.addEventListener('click', expandInventory);
if (sellBtn) sellBtn.addEventListener('click', sellSelected);
deckCollapseBtn?.addEventListener('click', () => setCommandDeckCollapsed(true));
deckExpandBtn?.addEventListener('click', () => setCommandDeckCollapsed(false));
helpBtn?.addEventListener('click', () => helpDialog?.showModal());
canvas.addEventListener('click', canvasClick);

canvas.addEventListener('dragstart', event => {
  event.preventDefault();
});

canvas.addEventListener('pointerdown', event => {
  if (!pointerPrimaryDown(event)) return;
  if (game.phase !== 'prep') return;
  const slot = slotAtCanvasEvent(event);
  if (!slot || !game.deployed[slot.id]) return;
  beginPointerDragFromCanvas(event, slot.id);
});

canvas.addEventListener('pointermove', event => {
  event.preventDefault();
  const p = canvasPoint(event);
  if (shopDragging) updateShopDrag(event);
  if (pendingBuild && !dragging) updatePendingBuildPreview(p.x, p.y);
  if (!dragging?.pointerMode) return;
  if (!pointerStillDown(event)) {
    if (!dragging.started) {
      const selection = dragging.source;
      clearDragVisuals({ keepSelection: true });
      game.selected = selection;
      renderSide();
      return;
    }
    finishPointerDrag(event);
    return;
  }
  const { x, y } = canvasPoint(event);
  updateCommandDeckDragVisibility(event);
  updateDragTooltipForInventory(event);
  const moved = Math.hypot(event.clientX - (dragging.startClientX ?? dragging.startX), event.clientY - (dragging.startClientY ?? dragging.startY));
  if (!dragging.started && moved < 8) return;
  if (!dragging.started) {
    dragging.started = true;
    hideTowerActionMenu();
    dragStartedInCommandDeck = dragging.source?.area === 'inventory';
    document.body.classList.add('dragging');
    canvas.classList.add('drag-over');
  }
  event.preventDefault();
  hoveredSlotId = dragging.source?.slotId || null;
  const targetSlot = bestMergeSlotForDragged(event) || slotAtCanvasEvent(event, dragging.source?.slotId || null, 64);
  updatePlacementPreview(x, y, targetSlot);
  updateDragGhost(event);
  const placement = targetSlot ? { ok: true } : canCreateTowerSlot(x, y, dragging.source?.slotId || null);
  canvas.classList.toggle('drag-over', placement.ok);
});

function finishPointerDrag(event) {
  if (!dragging?.pointerMode) return;
  releasePointer(event, canvas);
  if (dragging.started) {
    const invRef = inventoryRefFromPoint(event.clientX, event.clientY) || lastInventoryDragTarget;
    if (invRef) {
      dropToRef(invRef, event);
    } else if (dragging.source.area === 'deployed' && commandDeckBottomHot(event.clientX, event.clientY)) {
      moveDraggedToInventory(emptyInventoryRef(), event);
    } else {
      const { x, y } = canvasPoint(event);
      const targetSlot = bestMergeSlotForDragged(event) || slotAtCanvasEvent(event, dragging.source?.slotId || null, 64);
      deployDraggedToMap(x, y, targetSlot, event);
    }
  } else {
    const selection = dragging.source;
    clearDragVisuals({ keepSelection: true });
    game.selected = selection;
    renderSide();
    return;
  }
  suppressNextCanvasClick = true;
  setTimeout(() => { suppressNextCanvasClick = false; }, 180);
  if (dragging) clearDragVisuals();
}

window.addEventListener('pointerup', event => {
  if (shopDragging) finishShopDrag(event);
  finishPointerDrag(event);
});
window.addEventListener('pointercancel', event => {
  if (shopDragging) finishShopDrag(event);
  if (dragging?.pointerMode) cancelActiveDrag();
});
window.addEventListener('mouseup', event => {
  if (shopDragging) finishShopDrag(event);
  finishPointerDrag(event);
});

canvas.addEventListener('dragover', event => {
  if (!dragging || game.phase !== 'prep') return;
  event.preventDefault();
  if ((event.buttons & 2) === 2) {
    cancelActiveDrag();
    return;
  }
  updateCommandDeckDragVisibility(event);
  const slot = bestMergeSlotForDragged(event) || slotAtCanvasEvent(event, dragging?.source?.slotId || null, 64);
  hoveredSlotId = slot?.id || null;
  const { x, y } = canvasPoint(event);
  const mergePreview = slot ? mergePreviewForRef({ area: 'deployed', slotId: slot.id }) : null;
  if (mergePreview) setDragTooltip(mergePreview.text, event.clientX, event.clientY, mergePreview.ok);
  else hideDragTooltip();
  updatePlacementPreview(x, y, slot);
  canvas.classList.add('drag-over');
});

canvas.addEventListener('dragleave', () => {
  hoveredSlotId = null;
  canvas.classList.remove('drag-over');
});

canvas.addEventListener('drop', event => {
  event.preventDefault();
  const slot = bestMergeSlotForDragged(event) || slotAtCanvasEvent(event, dragging?.source?.slotId || null, 64);
  const { x, y } = canvasPoint(event);
  const handled = deployDraggedToMap(x, y, slot, event);
  if (!handled) clearDragVisuals();
});

window.addEventListener('pointermove', event => {
  if (event.target === canvas) return;
  if (shopDragging) updateShopDrag(event);
  if (!dragging?.pointerMode) return;
  if (!pointerStillDown(event)) {
    if (!dragging.started) return;
    finishPointerDrag(event);
    return;
  }
  updateCommandDeckDragVisibility(event);
  updateDragTooltipForInventory(event);
  if (!dragging.started) {
    const moved = Math.hypot(event.clientX - (dragging.startClientX ?? dragging.startX), event.clientY - (dragging.startClientY ?? dragging.startY));
    if (moved < 8) return;
    dragging.started = true;
    hideTowerActionMenu();
    dragStartedInCommandDeck = dragStartedInCommandDeck || dragging.source?.area === 'inventory';
    document.body.classList.add('dragging');
  }
  event.preventDefault();
  updateDragGhost(event);
  const invTarget = inventoryRefFromPoint(event.clientX, event.clientY);
  if (invTarget) {
    hoveredSlotId = null;
    placementPreview = null;
    return;
  }
  const slot = bestMergeSlotForDragged(event) || slotAtCanvasEvent(event, dragging.source?.slotId || null, 64);
  hoveredSlotId = slot?.id || null;
  const { x, y } = canvasPoint(event);
  updatePlacementPreview(x, y, slot);
}, { passive: false });

window.addEventListener('mousemove', event => {
  if (shopDragging) updateShopDrag(event);
  if (!dragging?.pointerMode) return;
  if (!pointerStillDown(event)) {
    if (!dragging.started) return;
    finishPointerDrag(event);
    return;
  }
  updateCommandDeckDragVisibility(event);
  updateDragTooltipForInventory(event);
  if (!dragging.started) {
    const moved = Math.hypot(event.clientX - (dragging.startClientX ?? dragging.startX), event.clientY - (dragging.startClientY ?? dragging.startY));
    if (moved < 8) return;
    dragging.started = true;
    hideTowerActionMenu();
    dragStartedInCommandDeck = dragStartedInCommandDeck || dragging.source?.area === 'inventory';
    document.body.classList.add('dragging');
  }
  updateDragGhost(event);
  const invTarget = inventoryRefFromPoint(event.clientX, event.clientY);
  if (invTarget) {
    hoveredSlotId = null;
    placementPreview = null;
    return;
  }
  const slot = bestMergeSlotForDragged(event) || slotAtCanvasEvent(event, dragging.source?.slotId || null, 64);
  hoveredSlotId = slot?.id || null;
  const { x, y } = canvasPoint(event);
  updatePlacementPreview(x, y, slot);
});

document.addEventListener('dragover', event => {
  updateCommandDeckDragVisibility(event);
  updateDragTooltipForInventory(event);
  updateDragGhost(event);
});

window.addEventListener('mousedown', event => {
  if (event.button !== 2) return;
  if (cancelPendingBuild()) {
    event.preventDefault();
    return;
  }
  if (!dragging) return;
  event.preventDefault();
  cancelActiveDrag();
}, true);

document.addEventListener('contextmenu', event => {
  if (cancelPendingBuild()) {
    event.preventDefault();
    return;
  }
  if (!dragging) return;
  event.preventDefault();
  cancelActiveDrag();
});

function finishHtmlDrag(event) {
  if (!dragging || dragging.pointerMode) return;
  const inventoryTarget = lastInventoryDragTarget || inventoryRefFromPoint(event.clientX, event.clientY);
  if (inventoryTarget) {
    dropToRef(inventoryTarget, event);
    return;
  }
  const slot = bestMergeSlotForDragged(event) || slotAtCanvasEvent(event, dragging.source?.slotId || null, 64);
  const { x, y } = canvasPoint(event);
  const handled = deployDraggedToMap(x, y, slot, event);
  if (!handled) clearDragVisuals();
}

document.addEventListener('dragend', finishHtmlDrag);

function handlePortalDebugKey(event) {
  if (!PORTAL_DEBUG) return;
  const tune = activeMapId === 'level_02' ? level02PortalDebugTune : portalDebugTune;
  const changed = applyAdjustDebugKey(event, tune, activeMapId === 'level_02' ? 'Level02PortalDebug' : 'Level01PortalDebug');
  if (!changed) return;
}

fullscreenBtn?.addEventListener('click', event => {
  event.preventDefault();
  event.stopPropagation();
  toggleFullscreen();
});
document.addEventListener('fullscreenchange', updateFullscreenUi);
updateFullscreenUi();

document.addEventListener('keydown', handlePortalDebugKey);
goldHudEl?.addEventListener('pointerdown', handleGoldHudClick);
goldHudEl?.addEventListener('click', event => {
  event.preventDefault();
  event.stopPropagation();
});
goldHudEl?.addEventListener('keydown', event => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  handleGoldHudClick(event);
});
levelSelectEl?.addEventListener('change', event => chooseLevel(event.target.value));

towerActionMenuEl?.addEventListener('click', event => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const slotId = towerActionMenuEl.dataset.slotId;
  if (!slotId) return;
  if (button.dataset.action === 'sell') sellTowerBySlot(slotId);
  if (button.dataset.action === 'upgrade') upgradeTowerBySlot(slotId);
});

document.addEventListener('click', event => {
  if (!towerActionMenuEl || towerActionMenuEl.hidden) return;
  if (towerActionMenuEl.contains(event.target)) return;
  if (event.target === canvas) return;
  hideTowerActionMenu();
});

function setTitleRunnerFrame(frameIndex) {
  if (!titleRunnerEl) return;
  const frame = Math.max(0, Math.min(35, frameIndex | 0));
  titleRunnerEl.style.setProperty('--runner-frame-x', String(frame % 6));
  titleRunnerEl.style.setProperty('--runner-frame-y', String(Math.floor(frame / 6)));
}

function setTitleRunnerX(x) {
  if (!titleRunnerEl) return;
  titleRunnerEl.style.setProperty('--runner-x', `${x}px`);
}

function startTitleRunnerFrameLoop() {
  if (!titleRunnerEl) return;
  if (titleRunnerFrameTimer) clearInterval(titleRunnerFrameTimer);
  let frame = 0;
  setTitleRunnerFrame(frame);
  titleRunnerFrameTimer = setInterval(() => {
    frame = (frame + 1) % 36;
    setTitleRunnerFrame(frame);
  }, 62);
}

function startTitleRunnerMoveLoop() {
  if (!titleRunnerEl?.parentElement) return;
  runTitleRunnerLoopSequence();
}

function getTitleRunnerStopX() {
  if (!titleRunnerEl || !helpBtn) return 0;
  const wrapRect = titleRunnerEl.parentElement.getBoundingClientRect();
  const helpRect = helpBtn.getBoundingClientRect();
  const runnerWidth = titleRunnerEl.getBoundingClientRect().width || 72;
  return (helpRect.left + helpRect.width * 0.5) - wrapRect.left - runnerWidth * 0.5;
}

const TITLE_RUNNER_ACTION_DURATION = 2600;

function playTitleRunnerAction(durationMs = TITLE_RUNNER_ACTION_DURATION) {
  return new Promise(resolve => {
    if (!titleRunnerEl) {
      resolve();
      return;
    }
    titleRunnerEl.classList.add('is-action');
    setTitleRunnerFrame(0);
    let frame = 0;
    const totalFrames = 36;
    const frameMs = durationMs / totalFrames;
    const timer = setInterval(() => {
      frame += 1;
      if (frame >= totalFrames) {
        clearInterval(timer);
        titleRunnerEl.classList.remove('is-action');
        setTitleRunnerFrame(0);
        resolve();
        return;
      }
      setTitleRunnerFrame(frame);
    }, frameMs);
  });
}

function animateTitleRunnerSegment(fromX, toX, durationMs) {
  return new Promise(resolve => {
    if (!titleRunnerEl) {
      resolve();
      return;
    }
    const start = performance.now();
    titleRunnerMoveRaf = requestAnimationFrame(function step(now) {
      const t = Math.min(1, (now - start) / durationMs);
      const x = fromX + (toX - fromX) * t;
      setTitleRunnerX(x);
      if (t >= 1) {
        resolve();
        return;
      }
      titleRunnerMoveRaf = requestAnimationFrame(step);
    });
  });
}

async function runTitleRunnerLoopSequence() {
  if (!titleRunnerEl || !titleRunnerEl.parentElement || titleRunnerPlaying) return;
  titleRunnerPlaying = true;
  while (titleRunnerPlaying) {
    await runTitleRunnerOnce();
  }
}

async function runTitleRunnerOnce() {
  if (!titleRunnerEl || !titleRunnerEl.parentElement) return;
  if (titleRunnerMoveRaf) cancelAnimationFrame(titleRunnerMoveRaf);
  const wrapWidth = titleRunnerEl.parentElement.getBoundingClientRect().width || 1280;
  const runnerWidth = titleRunnerEl.getBoundingClientRect().width || 151;
  const startX = -runnerWidth - 32;
  const stopX = Math.max(startX + 20, Math.min(getTitleRunnerStopX() - 60, wrapWidth - runnerWidth));
  const endX = wrapWidth + runnerWidth + 32;
  const totalMoveDuration = 40000;
  const firstDistance = Math.max(1, stopX - startX);
  const secondDistance = Math.max(1, endX - stopX);
  const totalDistance = firstDistance + secondDistance;
  const firstDuration = totalMoveDuration * (firstDistance / totalDistance);
  const secondDuration = totalMoveDuration - firstDuration;
  titleRunnerEl.classList.add('is-visible');
  titleRunnerEl.classList.remove('is-action');
  setTitleRunnerFrame(0);
  setTitleRunnerX(startX);
  startTitleRunnerFrameLoop();
  await animateTitleRunnerSegment(startX, stopX, firstDuration);
  if (titleRunnerFrameTimer) {
    clearInterval(titleRunnerFrameTimer);
    titleRunnerFrameTimer = null;
  }
  await playTitleRunnerAction(TITLE_RUNNER_ACTION_DURATION);
  titleRunnerEl.classList.remove('is-action');
  startTitleRunnerFrameLoop();
  await animateTitleRunnerSegment(stopX, endX, secondDuration);
  setTitleRunnerX(endX);
}

function setTitleRunnerAtHelp() {
  if (!titleRunnerEl || !helpBtn) return;
  const wrapRect = titleRunnerEl.parentElement.getBoundingClientRect();
  const helpRect = helpBtn.getBoundingClientRect();
  const runnerWidth = titleRunnerEl.getBoundingClientRect().width || 151;
  const x = (helpRect.left + helpRect.width * 0.5) - wrapRect.left - runnerWidth * 0.5;
  setTitleRunnerX(x);
}

function startTitleRunnerLoop() {
  if (!titleRunnerEl) return;
  if (titleRunnerTimer) clearInterval(titleRunnerTimer);
  if (titleRunnerMoveRaf) cancelAnimationFrame(titleRunnerMoveRaf);
  if (titleRunnerFrameTimer) clearInterval(titleRunnerFrameTimer);
  titleRunnerTimer = null;
  titleRunnerMoveRaf = null;
  titleRunnerFrameTimer = null;
  titleRunnerPlaying = false;
  titleRunnerEl.classList.add('is-visible');
  titleRunnerEl.classList.remove('is-action');
  startTitleRunnerMoveLoop();
}

loadConfig().then(() => {
  newGame();
  startTitleRunnerLoop();
  requestAnimationFrame(loop);
}).catch(error => {
  console.error(error);
  setMessage('配置文件加载失败，请通过本地服务器运行。');
});
