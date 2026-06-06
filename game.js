const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const tintCanvas = document.createElement('canvas');
const tintCtx = tintCanvas.getContext('2d');
const shopEl = document.getElementById('shop');
const inventoryEl = document.getElementById('inventory');
const commandDeckEl = document.querySelector('.command-deck');
const shopCancelZoneEl = document.getElementById('shopCancelZone');
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
const shopInfoPanelEl = document.getElementById('shopInfoPanel');
const towerActionMenuEl = document.getElementById('towerActionMenu');
const titleRunnerEl = document.getElementById('titleRunner');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const battleSpeedBtn = document.getElementById('battleSpeedBtn');
const speedTestBtn = document.getElementById('speedTestBtn');
const waveSettlePanelEl = document.getElementById('waveSettlePanel');
const waveSettleContentEl = document.getElementById('waveSettleContent');
const waveSettleCloseBtn = document.getElementById('waveSettleCloseBtn');

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
let roadMaskPixels = null;
let placementGridData = null;
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
let placementGridCache = null;
let placementGridCacheKey = '';
let dragTooltip = null;
let transparentDragImage = null;
let dragTooltipEl = null;
let inventoryDragPreviewIndex = null;
let lastInventoryDragTarget = null;
let dragGhostEl = null;
let shopBuildGhostEl = null;
let commandDeckCollapsed = false;
let pendingBuild = null;
let shopDragging = null;
let shopCancelZoneActive = false;
let suppressNextCanvasClick = false;
let goldHudClickCount = 0;
let goldHudFirstClickTime = 0;
let battleSpeed = 1;
let speedBeforeTest = 1;
let speedTestUnlocked = false;
let speedTestActive = false;
let activeShopInfoType = null;
let latestSettleNetGold = 0;
let displayedGoldOverride = null;
let goldCountTweenRaf = null;
const SETTLEMENT_COIN_SHEET = './assets/effects/settlement_coin_fly_sheet.png';
const NORMAL_BATTLE_SPEEDS = [1, 2];
const MAX_LOGIC_STEP = 1 / 60;

function setBattleSpeed(speed) {
  battleSpeed = NORMAL_BATTLE_SPEEDS.includes(speed) ? speed : 1;
  speedBeforeTest = battleSpeed;
  speedTestActive = false;
  updateBattleSpeedUi();
}

function updateBattleSpeedUi() {
  if (battleSpeedBtn) {
    const shownSpeed = speedTestActive ? 6 : battleSpeed;
    battleSpeedBtn.textContent = '';
    battleSpeedBtn.dataset.speed = String(shownSpeed);
    battleSpeedBtn.setAttribute('aria-label', shownSpeed === 2 ? '战斗倍速 X2' : (shownSpeed === 6 ? '战斗倍速 X6 测试' : '战斗倍速 X1'));
    battleSpeedBtn.classList.toggle('is-x2', shownSpeed === 2);
    battleSpeedBtn.classList.toggle('is-test-speed', !!speedTestActive);
  }
  if (speedTestBtn) {
    speedTestBtn.textContent = `X6 测试：${speedTestActive ? '开' : '关'}`;
    speedTestBtn.classList.toggle('is-active', !!speedTestActive);
    speedTestBtn.disabled = !speedTestUnlocked;
    speedTestBtn.title = speedTestUnlocked ? 'X6测试倍速开关' : '快速点击金币3次后解锁';
  }
}

function toggleBattleSpeed() {
  const index = NORMAL_BATTLE_SPEEDS.indexOf(battleSpeed);
  setBattleSpeed(NORMAL_BATTLE_SPEEDS[(index + 1 + NORMAL_BATTLE_SPEEDS.length) % NORMAL_BATTLE_SPEEDS.length]);
}

function toggleSpeedTest() {
  if (!speedTestUnlocked) return setMessage('快速点击金币 3 次后解锁 X6 测试功能。');
  if (!speedTestActive) {
    speedBeforeTest = NORMAL_BATTLE_SPEEDS.includes(battleSpeed) ? battleSpeed : 1;
    speedTestActive = true;
  } else {
    speedTestActive = false;
    battleSpeed = NORMAL_BATTLE_SPEEDS.includes(speedBeforeTest) ? speedBeforeTest : 1;
  }
  updateBattleSpeedUi();
  setMessage(speedTestActive ? 'X6 测试倍速已开启。' : `X6 测试倍速已关闭，已恢复 X${battleSpeed}。`);
}

function showWaveSettlePanel(waveNumber, stats, bossReady = false) {
  if (!waveSettlePanelEl || !waveSettleContentEl) return;
  const net = stats.killGold + stats.mineGold + stats.rewardGold - stats.leakPenalty;
  latestSettleNetGold = Math.max(0, net);
  if (latestSettleNetGold > 0 && !hasInfiniteGold()) {
    displayedGoldOverride = Math.max(0, game.gold - latestSettleNetGold);
    renderGoldHud();
  } else {
    displayedGoldOverride = null;
  }
  const moneyValue = (value) => `
    <strong class="settle-money ${value < 0 ? 'negative' : 'positive'}">
      <span class="settle-mini-coin" aria-hidden="true"></span><span>${value >= 0 ? '+' : ''}${value}</span>
    </strong>`;
  waveSettleContentEl.innerHTML = `
    <div class="settle-row"><span>第 ${waveNumber} 波</span><strong>完成</strong></div>
    <div class="settle-row"><span>击杀获得</span>${moneyValue(stats.killGold)}</div>
    <div class="settle-row"><span>金矿产出</span>${moneyValue(stats.mineGold)}</div>
    <div class="settle-row"><span>通关奖励</span>${moneyValue(stats.rewardGold)}</div>
    <div class="settle-row"><span>漏怪扣除</span>${moneyValue(-stats.leakPenalty)}</div>
    <div class="settle-row total"><span>本波净收益</span>${moneyValue(net)}</div>
    <p class="settle-tip">${bossReady ? '可以先调整建筑布置，确认后挑战 BOSS。' : '可以重新调整建筑布置，确认后开始下一波。'}</p>
  `;
  waveSettlePanelEl.hidden = false;
}

function hideWaveSettlePanel() {
  const shouldFlyCoins = !!(waveSettlePanelEl && !waveSettlePanelEl.hidden && latestSettleNetGold > 0);
  const settleCardRect = waveSettlePanelEl?.querySelector('.wave-settle-card')?.getBoundingClientRect();
  const settlePanelRect = waveSettlePanelEl?.getBoundingClientRect();
  const sourceRect = settleCardRect && settleCardRect.width > 0 && settleCardRect.height > 0 ? settleCardRect : settlePanelRect;
  const source = sourceRect && sourceRect.width > 0 && sourceRect.height > 0
    ? { x: sourceRect.left + sourceRect.width / 2, y: sourceRect.top + sourceRect.height / 2 - Math.max(32, sourceRect.height * 0.16) }
    : { x: window.innerWidth / 2, y: window.innerHeight * 0.42 };
  const settleAmount = latestSettleNetGold;
  if (waveSettlePanelEl) waveSettlePanelEl.hidden = true;
  if (shouldFlyCoins) playSettlementCoinFly(settleAmount, source);
  latestSettleNetGold = 0;
}

function renderGoldHud() {
  if (!goldHudEl) return;
  const shown = displayedGoldOverride === null || displayedGoldOverride === undefined ? goldText() : String(Math.max(0, Math.floor(displayedGoldOverride)));
  let coinIconEl = goldHudEl.querySelector('.coin-icon');
  let coinTextEl = goldHudEl.querySelector('.coin-text');
  if (!coinIconEl || !coinTextEl) {
    goldHudEl.innerHTML = '<span class="coin-icon" aria-hidden="true"><span class="coin-icon-shake-layer"></span></span><span class="coin-text"></span>';
    coinIconEl = goldHudEl.querySelector('.coin-icon');
    coinTextEl = goldHudEl.querySelector('.coin-text');
  }
  if (coinTextEl) coinTextEl.textContent = `X ${shown}`;
}

function animateGoldCountDuringCoinFly(amount, firstArrival, lastArrival) {
  if (!goldHudEl || !Number.isFinite(amount) || amount <= 0 || hasInfiniteGold()) return;
  const endGold = game.gold;
  const startGold = Math.max(0, endGold - Math.floor(amount));
  const duration = Math.max(260, lastArrival - firstArrival);
  const born = performance.now();
  if (goldCountTweenRaf) cancelAnimationFrame(goldCountTweenRaf);
  displayedGoldOverride = startGold;
  renderGoldHud();
  function tick(now) {
    const t = Math.max(0, Math.min(1, (now - born) / duration));
    const eased = 1 - Math.pow(1 - t, 2.2);
    displayedGoldOverride = Math.round(startGold + (endGold - startGold) * eased);
    renderGoldHud();
    if (t < 1) {
      goldCountTweenRaf = requestAnimationFrame(tick);
    } else {
      displayedGoldOverride = null;
      goldCountTweenRaf = null;
      renderGoldHud();
    }
  }
  goldCountTweenRaf = requestAnimationFrame(tick);
}

function playSettlementCoinFly(amount, sourceOverride = null) {
  if (!goldHudEl || amount <= 0) return;
  const targetRect = goldHudEl.getBoundingClientRect();
  const center = sourceOverride || { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const target = { x: targetRect.left + targetRect.width / 2, y: targetRect.top + targetRect.height / 2 };
  const count = 10 + Math.floor(Math.random() * 6);
  const arrivals = [];
  window.clearTimeout(goldHudEl._coinShakeDelayTimer);
  window.clearTimeout(goldHudEl._coinShakeTimer);
  goldHudEl.classList.remove('coin-collect-shake');
  for (let i = 0; i < count; i += 1) {
    const startDelay = i === 0 ? 0 : Math.random() * 1000;
    const radius = (18 + Math.random() * 54) * (battlefieldEl ? Math.max(0.55, Number.parseFloat(getComputedStyle(battlefieldEl).getPropertyValue('--stage-scale')) || 1) : 1);
    const angle = Math.random() * Math.PI * 2;
    const start = {
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius
    };
    const duration = 980 + Math.random() * 430;
    arrivals.push(startDelay + duration);
    window.setTimeout(() => spawnSettlementCoinFlyToTarget(start, target, i, duration), startDelay);
  }
  const firstArrival = Math.max(0, Math.min(...arrivals));
  const lastArrival = Math.max(...arrivals);
  goldHudEl._coinShakeDelayTimer = window.setTimeout(() => {
    animateGoldCountDuringCoinFly(amount, firstArrival, lastArrival);
    goldHudEl.classList.add('coin-collect-shake');
    goldHudEl._coinShakeTimer = window.setTimeout(() => goldHudEl.classList.remove('coin-collect-shake'), Math.max(180, lastArrival - firstArrival + 220));
  }, firstArrival);
}

function spawnSettlementCoinFlyToTarget(start, target, index = 0, forcedDuration = null) {
  const coin = document.createElement('div');
  coin.className = 'settlement-coin-fly settlement-coin-debug-preview';
  coin.style.backgroundImage = `url("${SETTLEMENT_COIN_SHEET}")`;
  coin.style.animationDuration = `${0.56 + Math.random() * 0.48}s`;
  document.body.appendChild(coin);
  const scale = battlefieldEl ? Math.max(0.55, Number.parseFloat(getComputedStyle(battlefieldEl).getPropertyValue('--stage-scale')) || 1) : 1;
  const size = Math.max(26, 48 * scale * (0.8 + Math.random() * 0.4));
  coin.style.width = `${size}px`;
  coin.style.height = `${size}px`;
  const control = {
    x: start.x + (target.x - start.x) * (0.28 + Math.random() * 0.22) + (Math.random() - 0.15) * 180 * scale,
    y: Math.min(start.y, target.y) - (95 + Math.random() * 135) * scale
  };
  const duration = forcedDuration ?? (980 + Math.random() * 430);
  const born = performance.now();
  function fastSlowFast(t) {
    // 平滑的 快 -> 慢 -> 快：避免速度拐点卡顿
    const linear = t;
    const slowBias = 0.18 * Math.sin(Math.PI * t);
    return Math.max(0, Math.min(1, linear - slowBias));
  }
  function tick(now) {
    const tRaw = Math.max(0, Math.min(1, (now - born) / duration));
    const t = fastSlowFast(tRaw);
    const m = 1 - t;
    const x = m * m * start.x + 2 * m * t * control.x + t * t * target.x;
    const y = m * m * start.y + 2 * m * t * control.y + t * t * target.y;
    const flyScale = 1 - 0.12 * tRaw;
    coin.style.transform = `translate3d(${x - size / 2}px, ${y - size / 2}px, 0) scale(${flyScale})`;
    coin.style.opacity = tRaw > 0.92 ? String(Math.max(0, 1 - (tRaw - 0.92) / 0.08)) : '1';
    if (tRaw < 1) requestAnimationFrame(tick);
    else coin.remove();
  }
  requestAnimationFrame(tick);
}

function stepUpdateWithBattleSpeed(dt) {
  const scaledDt = dt * (speedTestActive ? 6 : battleSpeed);
  let remaining = scaledDt;
  let guard = 0;
  while (remaining > 0 && guard < 24) {
    const step = Math.min(MAX_LOGIC_STEP, remaining);
    update(step);
    remaining -= step;
    guard += 1;
  }
}

function updateStageUiScale() {
  const viewport = window.visualViewport;
  const viewWidth = Math.max(1, viewport?.width || window.innerWidth || document.documentElement.clientWidth || 1280);
  const viewHeight = Math.max(1, viewport?.height || window.innerHeight || document.documentElement.clientHeight || 720);
  document.documentElement.style.setProperty('--app-vw', `${viewWidth}px`);
  document.documentElement.style.setProperty('--app-vh', `${viewHeight}px`);
  if (!battlefieldEl) return;
  const rect = battlefieldEl.getBoundingClientRect();
  const scale = Math.max(0.35, Math.min(rect.width / 1280, rect.height / 720));
  battlefieldEl.style.setProperty('--stage-scale', scale.toFixed(4));
}

const CONFIG_FILES = [
  './config/game.json',
  './config/towers.json',
  './config/enemies.json',
  './config/waves.json',
  './config/maps.json'
];

const ASSET_VERSION = '20260602-tower-top-anchor-v2';

function loadUiAnchorDebugTuneFromStorage(defaultTune) {
  if (!UI_ANCHOR_DEBUG) return defaultTune;
  try {
    const raw = localStorage.getItem('pocketDefense.uiAnchorDebugTune');
    if (!raw) return defaultTune;
    const saved = JSON.parse(raw);
    return {
      active: saved.active === 'start' ? 'start' : 'gold',
      gold: {
        cx: Number.isFinite(saved.gold?.cx) ? saved.gold.cx : defaultTune.gold.cx,
        cy: Number.isFinite(saved.gold?.cy) ? saved.gold.cy : defaultTune.gold.cy,
        icon: Number.isFinite(saved.gold?.icon) ? saved.gold.icon : defaultTune.gold.icon
      },
      start: {
        cx: Number.isFinite(saved.start?.cx) ? saved.start.cx : defaultTune.start.cx,
        cy: Number.isFinite(saved.start?.cy) ? saved.start.cy : defaultTune.start.cy,
        size: Number.isFinite(saved.start?.size) ? saved.start.size : defaultTune.start.size
      }
    };
  } catch (_) {
    return defaultTune;
  }
}

function saveUiAnchorDebugTuneToStorage() {
  try {
    localStorage.setItem('pocketDefense.uiAnchorDebugTune', JSON.stringify(uiAnchorDebugTune));
  } catch (_) {}
}

function applyUiAnchorDebugStyles() {
  if (!battlefieldEl) return;
  const g = uiAnchorDebugTune.gold;
  const s = uiAnchorDebugTune.start;
  battlefieldEl.style.setProperty('--gold-cx', `${g.cx}px`);
  battlefieldEl.style.setProperty('--gold-cy', `${g.cy}px`);
  battlefieldEl.style.setProperty('--gold-icon', `${g.icon}px`);
  battlefieldEl.style.setProperty('--start-cx', `${s.cx}px`);
  battlefieldEl.style.setProperty('--start-cy', `${s.cy}px`);
  battlefieldEl.style.setProperty('--start-size', `${s.size}px`);
  document.body?.classList.toggle('ui-anchor-debug', !!UI_ANCHOR_DEBUG);
}

function handleUiAnchorDebugKey(event) {
  if (!UI_ANCHOR_DEBUG) return false;
  const key = event.key.toLowerCase();
  if (key === 'g') {
    uiAnchorDebugTune.active = 'gold';
    setMessage('UI调试：当前调整金币 icon。方向键移动，+/-以中心缩放。');
    event.preventDefault();
    return true;
  }
  if (key === 'b') {
    uiAnchorDebugTune.active = 'start';
    setMessage('UI调试：当前调整开战按钮。方向键移动，+/-以中心缩放。');
    event.preventDefault();
    return true;
  }
  const target = uiAnchorDebugTune[uiAnchorDebugTune.active];
  if (!target) return false;
  const step = event.shiftKey ? 5 : 1;
  let changed = false;
  if (event.key === 'ArrowLeft') {
    if (uiAnchorDebugTune.active === 'start') target.cx += step;
    else target.cx -= step;
    changed = true;
  }
  else if (event.key === 'ArrowRight') {
    if (uiAnchorDebugTune.active === 'start') target.cx -= step;
    else target.cx += step;
    changed = true;
  }
  else if (event.key === 'ArrowUp') { target.cy += step; changed = true; }
  else if (event.key === 'ArrowDown') { target.cy -= step; changed = true; }
  else if (event.key === '+' || event.key === '=') {
    if (uiAnchorDebugTune.active === 'gold') target.icon += step;
    else target.size += step;
    changed = true;
  } else if (event.key === '-' || event.key === '_') {
    if (uiAnchorDebugTune.active === 'gold') target.icon = Math.max(10, target.icon - step);
    else target.size = Math.max(20, target.size - step);
    changed = true;
  } else if (key === 'i' && uiAnchorDebugTune.active === 'gold') { target.icon += step; changed = true; }
  else if (key === 'k' && uiAnchorDebugTune.active === 'gold') { target.icon = Math.max(10, target.icon - step); changed = true; }
  else if (key === 'c') {
    console.log('UI_ANCHOR_DEBUG', JSON.stringify(uiAnchorDebugTune));
    setMessage(`UI调试值：${JSON.stringify(uiAnchorDebugTune)}`);
    event.preventDefault();
    return true;
  }
  if (!changed) return false;
  applyUiAnchorDebugStyles();
  saveUiAnchorDebugTuneToStorage();
  console.log('UI_ANCHOR_DEBUG', JSON.stringify(uiAnchorDebugTune));
  setMessage(`UI调试 ${uiAnchorDebugTune.active}: ${JSON.stringify(target)}`);
  event.preventDefault();
  return true;
}

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
  ice: { image: './assets/effects/hit/ice_projectile.png', maxWidth: 34, maxHeight: 14, speed: 520 }
};

const SPRITE_SHEET_EFFECTS = {
  lightHit: { image: './assets/effects/hit/light_hit_sheet.png', frameCols: 3, frameRows: 3, frames: 9, duration: 0.36, width: 88, height: 88, composite: 'screen' },
  thunderHit: { image: './assets/effects/hit/thunder_hit_sheet.png', frameCols: 3, frameRows: 3, frames: 9, duration: 0.38, width: 96, height: 96, composite: 'screen' },
  thunderSplash: { image: './assets/effects/hit/thunder_splash_sheet.png', frameCols: 3, frameRows: 3, frames: 9, duration: 0.36, width: 236, height: 142, composite: 'screen' },
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
const UI_ANCHOR_DEBUG = false;
const portalDebugTune = { x: 8, y: 26, scale: 1.15, scaleX: 0.8, scaleY: 0.72, rotation: 0.42 };
const level02PortalDebugTune = { x: 20, y: 14, scale: 1.06, scaleX: 0.84, scaleY: 0.72, rotation: 0.36 };
const uiAnchorDebugTune = loadUiAnchorDebugTuneFromStorage({
  active: 'gold',
  gold: { cx: 78, cy: 94, icon: 106 },
  start: { cx: 98, cy: 90, size: 138 }
});
applyUiAnchorDebugStyles();

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

function buildRoadMaskPixelCache() {
  roadMaskPixels = null;
  if (!roadMaskCtx) return;
  const { data } = roadMaskCtx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = new Uint8Array(canvas.width * canvas.height);
  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a < 20) continue;
    const whiteRoad = r >= 150 && g >= 150 && b >= 150;
    const redCenterline = r >= 120 && r > g * 1.35 && r > b * 1.35;
    const blueStart = b >= 120 && b > r * 1.25 && b > g * 1.25;
    const yellowEnd = r >= 150 && g >= 130 && b <= 130;
    pixels[p] = (whiteRoad || redCenterline || blueStart || yellowEnd) ? 1 : 0;
  }
  roadMaskPixels = pixels;
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
  buildRoadMaskPixelCache();
  buildPlacementGridData();
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
  const inheritedGold = inheritedGoldFromCurrentLevel();
  await loadActiveMap(nextId);
  const preservedScore = game.score;
  const preservedHp = game.hp;
  newGame({ inheritedGold });
  game.score = preservedScore;
  game.hp = preservedHp;
  setMessage(`进入下一关：${activeMap.name || activeMapId}。上一关资产折算 +${inheritedGold} 金币，现在可以重新部署防线。`);
  syncLevelSelect();
  renderSide();
  return true;
}

function newGame(options = {}) {
  hideWaveSettlePanel();
  const g = cfg.game;
  game = {
    phase: 'prep',
    hasStartedOnce: false,
    hp: g.baseHp,
    gold: g.startGold + Math.max(0, Math.floor(options.inheritedGold || 0)),
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
    bossReady: false,
    bossActive: false,
    bossSpawned: false,
    bossDefeated: false,
    waveAlive: false,
    result: null,
    bossTest: !!options.bossTest,
    portalTime: 0,
    screenShake: { time: 0, duration: 0, intensity: 0 },
    waveStats: resetWaveStats()
  };
  if (!options.bossTest) levelSelectMode = 'normal';
  rollShop(false);
  syncLevelSelect();
  pendingBuild = null;
  hideTowerActionMenu();
  // 地形逻辑格只在关卡加载时重建；建筑动态占用实时查 allTowerSlots()，不用让每次建造/移动都清缓存。
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
  if (!roadMaskPixels) return false;
  const px = Math.max(0, Math.min(canvas.width - 1, Math.round(x)));
  const py = Math.max(0, Math.min(canvas.height - 1, Math.round(y)));
  return roadMaskPixels[py * canvas.width + px] === 1;
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

function placementFootprintForItem(item = null) {
  const type = item?.type || pendingBuild?.type || 'light';
  const isMine = type === 'mine';
  const { tileW, tileH } = placementGridMetrics();
  // 固定格子占地：range_a = 普通塔 2x2；range_b = 金矿 3x3。
  // 后续如果有大建筑，可以继续扩展 range_c = 4x4。
  const size = isMine ? 3 : 2;
  return {
    range: isMine ? 'range_b' : 'range_a',
    cols: size,
    rows: size,
    rx: tileW * size * 0.5,
    ry: tileH * size * 0.5,
    offsetX: 0,
    offsetY: isMine ? -18 : -8
  };
}

function isPointInPlacementFootprint(dx, dy, fp) {
  const { tileW, tileH } = placementGridMetrics();
  const lx = dx - (fp.offsetX || 0);
  const ly = dy - (fp.offsetY || 0);
  const a = lx / tileW + ly / tileH;
  const b = ly / tileH - lx / tileW;
  return Math.abs(a) <= fp.cols / 2 && Math.abs(b) <= fp.rows / 2;
}

function roadOverlapInFootprint(x, y, item = null) {
  const fp = placementFootprintForItem(item);
  const { tileW, tileH } = placementGridMetrics();
  const step = 6;
  const rx = tileW * fp.cols * 0.5;
  const ry = tileH * fp.rows * 0.5;
  for (let dy = -ry; dy <= ry; dy += step) {
    for (let dx = -rx; dx <= rx; dx += step) {
      if (!isPointInPlacementFootprint(dx, dy, fp)) continue;
      if (isRoadPixel(x + dx, y + dy)) return true;
    }
  }
  return false;
}

function isInBottomBuildBlockByClient(clientX, clientY) {
  const rect = battlefieldEl?.getBoundingClientRect?.();
  if (!rect) return false;
  const blockHeight = Math.max(96, rect.height * 0.16);
  return clientX >= rect.left && clientX <= rect.right && clientY >= rect.bottom - blockHeight && clientY <= rect.bottom;
}

function isInBottomBuildBlockByCanvasY(y) {
  return y >= canvas.height * 0.84;
}

function setShopDragCancelUi(active, over = false) {
  shopCancelZoneActive = !!active;
  commandDeckEl?.classList.toggle('is-drag-hidden', !!active);
  shopCancelZoneEl?.classList.toggle('is-visible', !!active);
  shopCancelZoneEl?.classList.toggle('is-over', !!over);
}

function placementGridCellSize() {
  return 16;
}

function placementGridMetrics() {
  const cell = placementGridCellSize();
  return {
    cell,
    tileW: cell * 2,
    tileH: cell,
    originX: canvas.width * 0.5,
    originY: 48
  };
}

function placementGridCoordFromPoint(x, y) {
  const { tileW, tileH, originX, originY } = placementGridMetrics();
  const dx = x - originX;
  const dy = y - originY;
  return {
    a: Math.round(dx / tileW + dy / tileH),
    b: Math.round(dy / tileH - dx / tileW)
  };
}

function placementGridPointFromCoord(a, b) {
  const { tileW, tileH, originX, originY } = placementGridMetrics();
  return {
    x: originX + (a - b) * tileW * 0.5,
    y: originY + (a + b) * tileH * 0.5
  };
}

function placementGridKey(a, b) {
  return `${a},${b}`;
}

function itemPlacementRangeKey(item = null) {
  return placementFootprintForItem(item).range;
}

function buildPlacementGridData() {
  const { tileW, tileH } = placementGridMetrics();
  const margin = Math.ceil(Math.max(canvas.width / tileW, canvas.height / tileH)) + 8;
  const cells = [];
  const terrain = { range_a: new Map(), range_b: new Map() };
  const terrainCells = { range_a: [], range_b: [] };
  for (let a = -margin; a <= margin * 2; a += 1) {
    for (let b = -margin; b <= margin * 2; b += 1) {
      const anchor = placementGridPointFromCoord(a, b);
      const key = placementGridKey(a, b);
      cells.push({ a, b, x: anchor.x, y: anchor.y, key });
      for (const range of ['range_a', 'range_b']) {
        const sampleItem = range === 'range_b' ? { type: 'mine', level: 1 } : { type: 'light', level: 1 };
        const fp = placementFootprintForItem(sampleItem);
        const towerX = anchor.x - (fp.offsetX || 0);
        const towerY = anchor.y - (fp.offsetY || 0);
        if (towerX < 48 || towerX > canvas.width - 48 || towerY < 48 || towerY > canvas.height - 48) continue;
        const ok = isTerrainBuildableAt(towerX, towerY, sampleItem);
        terrain[range].set(key, ok);
        terrainCells[range].push({ a, b, key, anchorX: anchor.x, anchorY: anchor.y, towerX, towerY, ok });
      }
    }
  }
  placementGridData = { cells, terrain, terrainCells };
}

function isTerrainBuildableAt(x, y, item = null) {
  if (isInBottomBuildBlockByCanvasY(y)) return false;
  if (x < 55 || x > canvas.width - 55 || y < 55 || y > canvas.height - 55) return false;
  return !roadOverlapInFootprint(x, y, item);
}

function placementTerrainAllows(x, y, item = null) {
  if (!placementGridData) buildPlacementGridData();
  const fp = placementFootprintForItem(item);
  const coord = placementGridCoordFromPoint(x + (fp.offsetX || 0), y + (fp.offsetY || 0));
  const key = placementGridKey(coord.a, coord.b);
  const range = itemPlacementRangeKey(item);
  return placementGridData?.terrain?.[range]?.get(key) === true;
}

function footprintIndexOffsets(size) {
  if (size <= 1) return [0];
  const start = -Math.floor((size - 1) / 2);
  return Array.from({ length: size }, (_, index) => start + index);
}

function footprintGridEdgeBoundsAt(x, y, item = null) {
  const cells = footprintGridCellsAt(x, y, item);
  if (!cells.length) return null;
  let minA = Infinity;
  let maxA = -Infinity;
  let minB = Infinity;
  let maxB = -Infinity;
  for (const cell of cells) {
    minA = Math.min(minA, cell.a - 0.5);
    maxA = Math.max(maxA, cell.a + 0.5);
    minB = Math.min(minB, cell.b - 0.5);
    maxB = Math.max(maxB, cell.b + 0.5);
  }
  return { minA, maxA, minB, maxB };
}

function footprintGridCellsAt(x, y, item = null) {
  const fp = placementFootprintForItem(item);
  const coord = placementGridCoordFromPoint(x + (fp.offsetX || 0), y + (fp.offsetY || 0));
  const cells = [];
  const aOffsets = footprintIndexOffsets(fp.cols);
  const bOffsets = footprintIndexOffsets(fp.rows);
  for (const da of aOffsets) {
    for (const db of bOffsets) {
      const a = coord.a + da;
      const b = coord.b + db;
      const p = placementGridPointFromCoord(a, b);
      cells.push({ a, b, key: placementGridKey(a, b), x: p.x, y: p.y });
    }
  }
  return cells;
}

function footprintGridBoundsAt(x, y, item = null) {
  const fp = placementFootprintForItem(item);
  const coord = placementGridCoordFromPoint(x + (fp.offsetX || 0), y + (fp.offsetY || 0));
  return {
    a: coord.a,
    b: coord.b,
    minA: coord.a - fp.cols / 2,
    maxA: coord.a + fp.cols / 2,
    minB: coord.b - fp.rows / 2,
    maxB: coord.b + fp.rows / 2,
    cols: fp.cols,
    rows: fp.rows
  };
}

function footprintsOverlap(x1, y1, item1, x2, y2, item2, marginCells = 0) {
  const a = footprintGridEdgeBoundsAt(x1, y1, item1) || footprintGridBoundsAt(x1, y1, item1);
  const b = footprintGridEdgeBoundsAt(x2, y2, item2) || footprintGridBoundsAt(x2, y2, item2);
  const overlapA = a.minA - marginCells < b.maxA && a.maxA + marginCells > b.minA;
  const overlapB = a.minB - marginCells < b.maxB && a.maxB + marginCells > b.minB;
  return overlapA && overlapB;
}

function placementSpacingMarginCells() {
  return 2;
}

function placementOverlapsTower(x, y, ignoreSlotId = null, item = null) {
  for (const slot of allTowerSlots()) {
    if (slot.id === ignoreSlotId) continue;
    const tower = game?.deployed?.[slot.id];
    if (!tower) continue;
    if (footprintsOverlap(x, y, item, slot.x, slot.y, tower, placementSpacingMarginCells())) return true;
  }
  return false;
}

function snapPlacementPoint(x, y, item = null) {
  const fp = placementFootprintForItem(item);
  const coord = placementGridCoordFromPoint(x + (fp.offsetX || 0), y + (fp.offsetY || 0));
  const p = placementGridPointFromCoord(coord.a, coord.b);
  return {
    x: Math.max(48, Math.min(canvas.width - 48, p.x - (fp.offsetX || 0))),
    y: Math.max(48, Math.min(canvas.height - 48, p.y - (fp.offsetY || 0))),
    anchorX: p.x,
    anchorY: p.y
  };
}

function canCreateTowerSlot(x, y, ignoreSlotId = null, itemOverride = null, options = {}) {
  const footprintItem = itemOverride || pendingBuild?.item || (dragging ? getItemAt(dragging.source) : null) || placementPreview?.item || null;
  if (!placementTerrainAllows(x, y, footprintItem)) {
    if (isInBottomBuildBlockByCanvasY(y)) return { ok: false, reason: '底部商店区域不能放置建筑。' };
    if (x < 55 || x > canvas.width - 55 || y < 55 || y > canvas.height - 55) return { ok: false, reason: '太靠近地图边缘，放不下炮台。' };
    return { ok: false, reason: '不能放在道路 mask 上。' };
  }
  if (!options.skipTowerOverlap && placementOverlapsTower(x, y, ignoreSlotId, footprintItem)) {
    return { ok: false, reason: '离已有炮台太近，不能重叠放置。' };
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
  // 地形逻辑格只在关卡加载时重建；建筑动态占用实时查 allTowerSlots()，不用让每次建造/移动都清缓存。
  return id;
}

function cleanupEmptyTowerSlots() {
  game.customTowerSlots = game.customTowerSlots.filter(slot => game.deployed[slot.id]);
  for (const slotId of Object.keys(game.deployed)) {
    if (!game.customTowerSlots.some(slot => slot.id === slotId)) delete game.deployed[slotId];
  }
  // 地形逻辑格只在关卡加载时重建；建筑动态占用实时查 allTowerSlots()，不用让每次建造/移动都清缓存。
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

function addGold(amount) {
  if (!Number.isFinite(amount) || amount === 0 || hasInfiniteGold()) return;
  game.gold = Math.max(0, game.gold + Math.floor(amount));
}

function resetWaveStats() {
  return { killGold: 0, mineGold: 0, rewardGold: 0, leakPenalty: 0 };
}

function getWaveStats() {
  if (!game.waveStats) game.waveStats = resetWaveStats();
  return game.waveStats;
}

function currentAssetValue() {
  const towerValue = Object.values(game.deployed || {}).reduce((sum, item) => sum + towerSellValue(item), 0);
  return Math.max(0, Math.floor((Number.isFinite(game.gold) ? game.gold : 0) + towerValue));
}

function inheritedGoldFromCurrentLevel() {
  const rate = cfg.game.levelAssetCarryRate ?? 0.1;
  return Math.max(0, Math.floor(currentAssetValue() * rate));
}

function mineCount() {
  return Object.values(game.deployed || {}).filter(item => item?.type === 'mine').length;
}

function mineLimit() {
  return towersCfg.mine?.maxCount ?? Infinity;
}

function canBuildTowerType(type) {
  const def = towersCfg[type];
  if (!def) return { ok: false, kind: 'unknown', reason: '未知建筑。' };
  if (type === 'mine' && mineCount() >= mineLimit()) {
    return { ok: false, kind: 'mineLimit', reason: '建造达到上限' };
  }
  if (!canAfford(def.cost)) {
    return { ok: false, kind: 'gold', reason: `金币不足：${def.name} 需要 ${def.cost} 金币，还差 ${def.cost - game.gold}。` };
  }
  return { ok: true, kind: '', reason: '' };
}

function waveSettleText(waveNumber, stats) {
  const net = stats.killGold + stats.mineGold + stats.rewardGold - stats.leakPenalty;
  return `第 ${waveNumber} 波结算：击杀 +${stats.killGold}，金矿 +${stats.mineGold}，通关 +${stats.rewardGold}，漏怪 -${stats.leakPenalty}，净收益 ${net >= 0 ? '+' : ''}${net}。`;
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
  const buildCheck = canBuildTowerType(type);
  if (!buildCheck.ok) return setMessage(buildCheck.reason);
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
  return false;
}

function mergeGoldCost(type, fromLevel) {
  const baseCost = towersCfg[type]?.cost || 0;
  return fromLevel === 1 ? baseCost * 3 : baseCost * 6;
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
    // 地形逻辑格只在关卡加载时重建；建筑动态占用实时查 allTowerSlots()，不用让每次建造/移动都清缓存。
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
  return null;
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

function updateShopBuildGhost(event, visible = false) {
  if (!visible || !pendingBuild?.item || !shopDragging?.started) {
    removeShopBuildGhost();
    return;
  }
  const item = pendingBuild.item;
  if (!shopBuildGhostEl) {
    const def = towersCfg[item.type];
    shopBuildGhostEl = document.createElement('div');
    shopBuildGhostEl.className = 'drag-ghost shop-build-ghost';
    shopBuildGhostEl.style.setProperty('--tower-color', def.color);
    shopBuildGhostEl.innerHTML = `<img src="${towerIconImage(item.type, item.level)}" alt="${def.name} Lv${item.level}">`;
    document.body.appendChild(shopBuildGhostEl);
  }
  shopBuildGhostEl.style.left = `${event.clientX}px`;
  shopBuildGhostEl.style.top = `${event.clientY}px`;
}

function removeShopBuildGhost() {
  shopBuildGhostEl?.remove();
  shopBuildGhostEl = null;
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
  setShopDragCancelUi(false);
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

  if (!targetItem) {
    setItemAt(source, null);
    setItemAt(target, moving);
    game.selected = target;
    setMessage(target.area === 'deployed' ? `已部署 ${towerName(moving)}。` : `已移动 ${towerName(moving)}。`);
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
  if (game.phase !== 'prep') return;
  shopDragging = { type, started: false, pointerId: event.pointerId ?? null, startClientX: event.clientX, startClientY: event.clientY };
  capturePointer(event);
  event.preventDefault();
}

function startShopDragFromPending(event) {
  if (!shopDragging || shopDragging.started) return false;
  const type = shopDragging.type;
  const buildCheck = canBuildTowerType(type);
  if (!buildCheck.ok) {
    const tip = buildCheck.kind === 'mineLimit' ? '建造达到上限' : '金币不足';
    setMessage(tip);
    floatText(lastCanvasPointer.x, lastCanvasPointer.y - 24, tip, '#fca5a5', { size: 18, life: 1.08, vy: -20, stroke: 'rgba(127, 29, 29, 0.45)' });
    shopDragging = null;
    pendingBuild = null;
    placementPreview = null;
    setShopDragCancelUi(false);
    removeShopBuildGhost();
    document.body.classList.remove('dragging');
    renderSide();
    return false;
  }
  pendingBuild = { type, item: makeTower(type) };
  shopDragging.started = true;
  game.selected = null;
  hideTowerActionMenu();
  hideShopInfoPanel();
  const p = canvasPoint(event);
  updatePendingBuildPreview(p.x, p.y);
  removeShopBuildGhost();
  return true;
}

function updateShopDrag(event) {
  if (!shopDragging) return;
  if (!pointerStillDown(event)) {
    finishShopDrag(event);
    return;
  }
  const moved = Math.hypot(event.clientX - shopDragging.startClientX, event.clientY - shopDragging.startClientY);
  if (!shopDragging.started && moved < 12) return;
  if (!shopDragging.started && !startShopDragFromPending(event)) return;
  if (!pendingBuild) return;
  const overCancel = isInBottomBuildBlockByClient(event.clientX, event.clientY);
  setShopDragCancelUi(true, overCancel);
  const p = canvasPoint(event);
  updatePendingBuildPreview(p.x, p.y);
  updateShopBuildGhost(event, overCancel);
  if (placementPreview && overCancel) {
    placementPreview.ok = false;
    placementPreview.reason = '拖回商店取消放置';
  }
  document.body.classList.add('dragging');
}

function finishShopDrag(event) {
  if (!shopDragging) return;
  releasePointer(event, document.body);
  const wasStarted = shopDragging.started;
  const cancelledByShopZone = wasStarted && isInBottomBuildBlockByClient(event.clientX, event.clientY);
  shopDragging = null;
  document.body.classList.remove('dragging');
  removeShopBuildGhost();
  setShopDragCancelUi(false);
  if (!pendingBuild) return;
  if (!wasStarted) {
    pendingBuild = null;
    placementPreview = null;
    renderSide();
    return;
  }
  if (cancelledByShopZone) {
    pendingBuild = null;
    placementPreview = null;
    setMessage('已拖回商店，取消放置。');
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
  removeShopBuildGhost();
  document.body.classList.remove('dragging');
  setShopDragCancelUi(false);
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
  const snap = mergePreview ? { x, y, anchorX: x, anchorY: y } : snapPlacementPoint(x, y, item);
  const placement = mergePreview ? { ok: mergePreview.ok, reason: mergePreview.text } : canCreateTowerSlot(snap.x, snap.y, ignoreSlotId, item);
  placementPreview = {
    x,
    y,
    snapX: snap.x,
    snapY: snap.y,
    anchorX: snap.anchorX ?? snap.x,
    anchorY: snap.anchorY ?? snap.y,
    rawX: x,
    rawY: y,
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
  const snap = snapPlacementPoint(x, y, pendingBuild.item);
  const placement = canCreateTowerSlot(snap.x, snap.y, null, pendingBuild.item);
  placementPreview = {
    x,
    y,
    snapX: snap.x,
    snapY: snap.y,
    anchorX: snap.anchorX ?? snap.x,
    anchorY: snap.anchorY ?? snap.y,
    rawX: x,
    rawY: y,
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
    setShopDragCancelUi(false);
    setMessage('战斗中不能购买，请等本波结束。');
    renderSide();
    return true;
  }
  const { x: rawX, y: rawY } = canvasPoint(event);
  const { x, y } = snapPlacementPoint(rawX, rawY, pendingBuild.item);
  const def = towersCfg[pendingBuild.type];
  const placement = canCreateTowerSlot(x, y, null, pendingBuild.item);
  const previewBlocksPlacement = placementPreview && !placementPreview.ok && Math.hypot((placementPreview.snapX ?? x) - x, (placementPreview.snapY ?? y) - y) < 8;
  if (!placement.ok || previewBlocksPlacement) {
    const reason = placement.reason || placementPreview?.reason || '当前位置不可放置';
    updatePendingBuildPreview(x, y);
    pendingBuild = null;
    shopDragging = null;
    placementPreview = null;
    setShopDragCancelUi(false);
    removeShopBuildGhost();
    document.body.classList.remove('dragging');
    setMessage(`${reason}，建造失败，请重新从商店拖拽。`);
    renderSide();
    return true;
  }
  const buildCheck = canBuildTowerType(pendingBuild.type);
  if (!buildCheck.ok) {
    pendingBuild = null;
    placementPreview = null;
    setShopDragCancelUi(false);
    removeShopBuildGhost();
    setMessage(buildCheck.reason);
    renderSide();
    return true;
  }
  spendGold(def.cost);
  const slotId = createCustomTowerSlot(x, y);
  game.deployed[slotId] = pendingBuild.item;
  // 地形逻辑格只在关卡加载时重建；建筑动态占用实时查 allTowerSlots()，不用让每次建造/移动都清缓存。
  game.selected = { area: 'deployed', slotId };
  setMessage(`已建造 ${towerName(pendingBuild.item)}。`);
  pendingBuild = null;
  shopDragging = null;
  placementPreview = null;
  setShopDragCancelUi(false);
  removeShopBuildGhost();
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
  const point = targetSlot ? { x, y } : snapPlacementPoint(x, y, moving);
  const placement = canCreateTowerSlot(point.x, point.y, movingExistingSlotId, moving);
  const previewBlocksPlacement = placementPreview && !placementPreview.ok && !placementPreview.mergePreview && Math.hypot((placementPreview.snapX ?? point.x) - point.x, (placementPreview.snapY ?? point.y) - point.y) < 8;
  if (!placement.ok || previewBlocksPlacement) {
    setMessage(placement.reason || placementPreview?.reason || '当前位置不可放置');
    return false;
  }

  if (source.area === 'deployed') {
    const slot = game.customTowerSlots.find(item => item.id === source.slotId);
    if (!slot) return false;
    slot.x = point.x;
    slot.y = point.y;
    // 地形逻辑格只在关卡加载时重建；建筑动态占用实时查 allTowerSlots()，不用让每次建造/移动都清缓存。
    game.selected = source;
    setMessage(`已调整 ${towerName(moving)} 的位置。`);
  } else {
    const slotId = createCustomTowerSlot(point.x, point.y);
    setItemAt(source, null);
    game.deployed[slotId] = moving;
    // 地形逻辑格只在关卡加载时重建；建筑动态占用实时查 allTowerSlots()，不用让每次建造/移动都清缓存。
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
  return towerSellValue(selectedItem());
}

function towerSellValue(item) {
  if (!item) return 0;
  if (item.type === 'mine') return [20, 45, 80][item.level - 1] || 20;
  return Math.ceil(towersCfg[item.type].cost * (0.50 + (item.level - 1) * 0.45));
}

function upgradeDirectCost(item) {
  if (!item || item.level >= 3) return 0;
  const baseCost = towersCfg[item.type]?.cost || 0;
  return item.level === 1 ? baseCost * 3 : baseCost * 6;
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
  const upgradeOk = canUpgrade && canAfford(upgradeCost);
  const upgradeText = canUpgrade ? upgradeCost : 'MAX';
  towerActionMenuEl.dataset.slotId = slotId;
  towerActionMenuEl.innerHTML = `
    <button class="tower-menu-btn sell" type="button" data-action="sell"><span class="mini-coin" aria-hidden="true"></span><span class="tower-menu-price">${sellValue}</span></button>
    <button class="tower-menu-btn upgrade ${upgradeOk ? 'can-upgrade' : 'cant-upgrade'}" type="button" data-action="upgrade" ${canUpgrade ? '' : 'disabled'}><span class="mini-coin" aria-hidden="true"></span><span class="tower-menu-price">${upgradeText}</span></button>
  `;
  const rect = battlefieldEl.getBoundingClientRect();
  const pos = event ? canvasPoint(event) : { x: slot.x, y: slot.y };
  const menuWidth = 142;
  const menuHeight = 174;
  const towerRect = towerSpriteRect(slot, item);
  const towerPxWidth = towerRect.width * (rect.width / canvas.width);
  const menuGap = -10;
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
  addGold(value);
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
  addGold(value);
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
  const source = { ...game, retrySnapshot: null };
  const snapshot = JSON.parse(JSON.stringify(source));
  snapshot.retryWaveIndex = game.waveIndex;
  snapshot.phase = 'prep';
  snapshot.result = null;
  snapshot.selected = null;
  snapshot.enemies = [];
  snapshot.projectiles = [];
  snapshot.floating = [];
  snapshot.spawnQueue = [];
  snapshot.spawnTimer = 0;
  snapshot.currentWaveSpawned = 0;
  snapshot.currentWaveTotal = 0;
  snapshot.waveAlive = false;
  snapshot.bossReady = game.waveIndex >= waveCfg.waves.length && !!(waveCfg.boss?.enabled && !game.bossDefeated);
  snapshot.bossActive = false;
  snapshot.screenShake = { time: 0, duration: 0, intensity: 0 };
  snapshot.waveStats = resetWaveStats();
  return snapshot;
}

function restoreWaveRetrySnapshot() {
  const snapshot = game?.retrySnapshot;
  if (!snapshot) {
    newGame();
    setMessage('未找到当前波次开始数据，已重新开始本关。');
    return;
  }
  const restored = JSON.parse(JSON.stringify(snapshot));
  restored.retrySnapshot = JSON.parse(JSON.stringify(snapshot));
  game = restored;
  dragging = null;
  pendingBuild = null;
  shopDragging = null;
  placementPreview = null;
  hoveredSlotId = null;
  inventoryDragPreviewIndex = null;
  lastInventoryDragTarget = null;
  suppressNextCanvasClick = false;
  hideDragTooltip();
  hideTowerActionMenu();
  hideWaveSettlePanel();
  setShopDragCancelUi(false);
  document.body.classList.remove('dragging');
  canvas.classList.remove('drag-over');
  setMessage(`已回到第 ${game.waveIndex + 1} 波开始前状态。`);
  renderSide();
}

function restartCurrentLevel() {
  if (game?.retrySnapshot) {
    restoreWaveRetrySnapshot();
    return;
  }
  const wasBossTest = !!game?.bossTest || levelSelectMode === 'boss';
  newGame({ bossTest: wasBossTest });
  if (wasBossTest) {
    levelSelectMode = 'boss';
    game.bossTest = true;
    game.gold = Infinity;
    game.waveIndex = waveCfg.waves.length;
    game.bossDefeated = false;
    game.bossSpawned = false;
    setMessage(`已重玩当前 Boss 关：${activeMap.name || activeMapId}，回到未开始放塔状态。`);
  } else {
    setMessage(`已重玩当前关卡：${activeMap.name || activeMapId}，回到未开始放塔状态。`);
  }
  renderSide();
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
    startWaveBtn.textContent = game.bossReady ? '开始BOSS' : '开始战斗';
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

function adjustedWaveSpawns(wave) {
  const adjustments = activeMap?.waveAdjustments?.[String(wave.wave)] || {};
  return wave.spawns
    .map(group => ({ ...group, count: Math.max(0, group.count + (adjustments[group.type] || 0)) }))
    .filter(group => group.count > 0);
}

function startWave() {
  if (game.phase !== 'prep') return;
  hideWaveSettlePanel();
  if (game.waveIndex >= waveCfg.waves.length) {
    const bossCfg = waveCfg.boss;
    if (bossCfg?.enabled && !game.bossDefeated) startBoss();
    return;
  }
  game.retrySnapshot = createWaveRetrySnapshot();
  const wave = waveCfg.waves[game.waveIndex];
  const spawns = adjustedWaveSpawns(wave);
  game.phase = 'combat';
  game.hasStartedOnce = true;
  game.selected = null;
  game.waveAlive = true;
  game.waveStats = resetWaveStats();
  game.spawnQueue = [];
  game.currentWaveTotal = spawns.reduce((sum, group) => sum + group.count, 0);
  game.currentWaveSpawned = 0;
  game.bossReady = false;
  game.bossActive = false;
  let delay = 0;
  for (const group of spawns) {
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
  const stats = getWaveStats();
  stats.mineGold = mineIncome;
  stats.rewardGold = wave.reward;
  addGold(wave.reward + mineIncome);
  game.score += game.hp * 3 + mineIncome;
  const settle = waveSettleText(wave.wave, stats);
  game.waveIndex += 1;
  game.phase = 'prep';
  game.waveAlive = false;
  rollShop(false);
  if (game.waveIndex >= waveCfg.waves.length) {
    const bossCfg = waveCfg.boss;
    if (bossCfg?.enabled && !game.bossDefeated) {
      game.bossReady = true;
      setMessage(`${settle} 现在可以调整建筑布置，准备好后点击开始战斗挑战 BOSS。`);
    } else {
      game.phase = 'ended';
      game.result = 'win';
      setMessage(`胜利！基地剩余 ${game.hp} 血，最终分数 ${game.score}。`);
    }
  } else {
    setMessage(`${settle} 现在可以重新拖拽调整部署。`);
  }
  const showBossReady = game.waveIndex >= waveCfg.waves.length && !!(waveCfg.boss?.enabled && !game.bossDefeated);
  game.retrySnapshot = createWaveRetrySnapshot();
  showWaveSettlePanel(wave.wave, stats, showBossReady);
  renderSide();
}

function startBoss() {
  const bossCfg = waveCfg.boss;
  game.retrySnapshot = createWaveRetrySnapshot();
  game.phase = 'combat';
  game.hasStartedOnce = true;
  game.selected = null;
  game.waveAlive = true;
  game.bossReady = false;
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
        const enemyDef = enemiesCfg[enemy.type];
        if (enemyDef?.isBoss) {
          game.hp = 0;
          game.result = 'lose';
          floatText(enemy.x, enemy.y, 'Boss突破!', '#fb7185', { life: 1.1, size: 24, stroke: '#7f1d1d' });
          setMessage('防守失败：Boss 没有被击败，已突破防线。');
          continue;
        }
        game.hp -= enemyDef.baseDamage;
        const leakPenalty = enemyDef.reward || 0;
        if (leakPenalty > 0) {
          addGold(-leakPenalty);
          getWaveStats().leakPenalty += leakPenalty;
        }
        floatText(enemy.x, enemy.y, `-${enemyDef.baseDamage}❤`, '#fb7185');
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
  const imageKey = towerImageKey(tower.type, tower.level);
  const img = towerImages[imageKey];
  const configuredWidth = overrideSprite.width || levelSprite.width || sprite.width || 92;
  const configuredHeight = overrideSprite.height || levelSprite.height || sprite.height || 92;
  let width = configuredWidth;
  let height = configuredHeight;
  if (img?.width && img?.height) {
    const imageAspect = img.width / img.height;
    if (imageAspect > 0) {
      width = configuredHeight * imageAspect;
      height = configuredHeight;
    }
  }
  return {
    image: overrideSprite.image || levelSprite.image,
    width,
    height,
    footY: overrideSprite.footY ?? levelSprite.footY ?? sprite.footY ?? 0.82,
    gemX: overrideSprite.gemX ?? levelSprite.gemX ?? sprite.gemX ?? 0.5,
    gemY: overrideSprite.gemY ?? levelSprite.gemY ?? sprite.gemY ?? 0
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
  const x = rect.x + rect.width * rect.sprite.gemX;
  const y = rect.y + rect.height * rect.sprite.gemY;
  return { x, y };
}

function enemyHitPoint(enemy) {
  const def = enemiesCfg[enemy.type] || {};
  const sprite = enemy.attacking && def.attackSprite ? def.attackSprite : def.sprite;
  if (sprite) {
    const height = sprite.height || 58;
    const footY = sprite.footY ?? 0.82;
    return { x: enemy.x, y: enemy.y - height * footY + height * 0.5 };
  }
  return { x: enemy.x, y: enemy.y };
}

function enemyFootHitPoint(enemy) {
  const def = enemiesCfg[enemy.type] || {};
  const sprite = enemy.attacking && def.attackSprite ? def.attackSprite : def.sprite;
  if (sprite) {
    const height = sprite.height || 58;
    const footY = sprite.footY ?? 0.82;
    const topY = enemy.y - height * footY;
    const centerY = topY + height * 0.5;
    return { x: enemy.x, y: centerY + (enemy.y - centerY) * 0.67 };
  }
  const radius = def.radius || 13;
  return { x: enemy.x, y: enemy.y + radius * 0.55 };
}

function enemyEffectScale(enemy, base = 1) {
  const def = enemiesCfg[enemy.type] || {};
  const sprite = enemy.attacking && def.attackSprite ? def.attackSprite : def.sprite;
  const size = sprite ? Math.max(sprite.width || 58, sprite.height || 58) : (def.radius || 13) * 2;
  return base * Math.max(0.24, Math.min(1.15, size / 118));
}

function fireTower(tower, slot, target, stat, targets = [target]) {
  const color = towersCfg[tower.type].color;
  const origin = towerGemPoint(slot, tower);
  const targetHit = enemyHitPoint(target);
  if (tower.type === 'thunder') {
    damageEnemy(target, stat.damage, tower.type, stat);
    spawnHitEffect('thunderHit', targetHit.x, targetHit.y);
    explode({ tx: target.x, ty: target.y, splash: stat.splash, damage: Math.round(stat.damage * 0.70), primaryTargetId: target.id });
    game.projectiles.push({ type: 'effectBeam', effect: 'thunderBeam', x: origin.x, y: origin.y, tx: targetHit.x, ty: targetHit.y, targetExtend: 12, age: 0, duration: EFFECT_SEQUENCES.thunderBeam.duration, color });
  } else {
    if (tower.type === 'ice') {
      const iceAsset = PROJECTILE_ASSETS.ice;
      const shotCount = targets.length;
      targets.forEach((iceTarget, index) => {
        const spread = (index - (shotCount - 1) / 2) * 9;
        const iceHit = enemyFootHitPoint(iceTarget);
        const aimAngle = Math.atan2(iceHit.y - origin.y, iceHit.x - origin.x);
        const ox = origin.x + Math.cos(aimAngle + Math.PI / 2) * spread;
        const oy = origin.y + Math.sin(aimAngle + Math.PI / 2) * spread;
        damageEnemy(iceTarget, stat.damage, tower.type, stat);
        spawnHitEffect('snowBossTowerHit', iceHit.x, iceHit.y, { scale: enemyEffectScale(iceTarget, 0.48), duration: 0.25, composite: 'screen', alpha: 1 });
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

function spawnHitEffect(effect, x, y, options = {}) {
  const def = SPRITE_SHEET_EFFECTS[effect];
  if (!def) return;
  game.projectiles.push({ type: 'spriteEffect', effect, x, y, age: 0, duration: options.duration ?? def.duration, scale: options.scale ?? 1, composite: options.composite, alpha: options.alpha ?? 1 });
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
  spawnHitEffect('thunderSplash', p.tx, p.ty, { scale: Math.max(0.72, p.splash / 118), duration: 0.36, composite: 'screen', alpha: 0.95 });
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
  const reward = def.reward || 0;
  if (reward > 0) {
    addGold(reward);
    getWaveStats().killGold += reward;
    floatText(enemy.x, enemy.y, `+${reward}`, '#fde68a');
  }
  game.score += reward * 12;
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
  game.floating.push({ x, y, text, color, life: options.life || 0.8, maxLife: options.life || 0.8, size: options.size || 16, stroke: options.stroke || null, vy: options.vy ?? -32 });
}

function updateFloating(dt) {
  for (const f of game.floating) {
    f.life -= dt;
    f.y += (f.vy ?? -32) * dt;
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

function renderGoldHudLegacyRemoved() {
  return;
}

function hideShopInfoPanel() {
  activeShopInfoType = null;
  if (!shopInfoPanelEl) return;
  shopInfoPanelEl.hidden = true;
  shopInfoPanelEl.innerHTML = '';
}

function showShopInfoPanel(type) {
  const def = towersCfg[type];
  if (!def || !shopInfoPanelEl) return;
  activeShopInfoType = type;
  const levels = Array.isArray(def.levels) ? def.levels : [];
  const statLines = levels.map((level, index) => {
    const parts = [];
    if (Number.isFinite(level.damage) && level.damage > 0) parts.push(`伤害 ${level.damage}`);
    if (Number.isFinite(level.range) && level.range > 0) parts.push(`范围 ${level.range}`);
    if (Number.isFinite(level.cooldown) && level.cooldown < 90) parts.push(`间隔 ${level.cooldown}s`);
    if (Number.isFinite(level.splash) && level.splash > 0) parts.push(`溅射 ${level.splash}`);
    if (Number.isFinite(level.slow) && level.slow > 0) parts.push(`减速 ${Math.round(level.slow * 100)}%`);
    if (Number.isFinite(level.targetCount) && level.targetCount > 1) parts.push(`目标 ${level.targetCount}`);
    if (Number.isFinite(level.income) && level.income > 0) parts.push(`每波 +${level.income}`);
    return `<div class="shop-info-stat"><b>Lv${index + 1}</b><span>${parts.join(' / ') || '辅助建筑'}</span></div>`;
  }).join('');
  shopInfoPanelEl.innerHTML = `
    <div class="shop-info-head">
      <div class="shop-info-icon" style="--tower-color:${def.color}"><img src="${towerIconImage(type, 1)}" alt="${def.name}"></div>
      <div><div class="shop-info-title-row"><h3>${def.name}</h3><div class="shop-info-cost"><span class="mini-coin" aria-hidden="true"></span>${def.cost}</div></div></div>
    </div>
    <p>${def.description || ''}</p>
    <div class="shop-info-stats">${statLines}</div>
  `;
  shopInfoPanelEl.hidden = false;
}

function toggleShopInfoPanel(type) {
  if (activeShopInfoType === type && shopInfoPanelEl && !shopInfoPanelEl.hidden) hideShopInfoPanel();
  else showShopInfoPanel(type);
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
  commandDeckEl?.classList.toggle('is-hidden', false);
  commandDeckEl?.classList.toggle('is-locked', game.phase !== 'prep');
  if (game.phase !== 'prep') hideShopInfoPanel();
  syncCommandDeckCollapse();

  shopEl.innerHTML = '';
  for (const type of game.shop) {
    const def = towersCfg[type];
    const card = document.createElement('div');
    card.className = 'shop-card';
    card.tabIndex = 0;
    const buildCheck = canBuildTowerType(type);
    const shownCost = buildCheck.kind === 'mineLimit' ? 'max' : def.cost;
    card.title = '';
    card.setAttribute('role', 'button');
    if (pendingBuild?.type === type) card.classList.add('selected');
    if (!buildCheck.ok) card.classList.add('cant-afford');
    if (game.phase !== 'prep') card.classList.add('shop-locked');
    if (activeShopInfoType === type && shopInfoPanelEl && !shopInfoPanelEl.hidden) card.classList.add('info-active');
    card.innerHTML = `
      <div class="icon tower-icon shop-icon" style="--tower-color:${def.color}"><img src="${towerIconImage(type, 1)}" alt="${def.name}"></div>
      <div class="shop-item-label"><span class="shop-item-name">${def.name}</span><span class="mini-coin" aria-hidden="true"></span><span class="shop-item-cost">${shownCost}</span></div>
      <p>${def.description}</p>
    `;
    card.addEventListener('pointerdown', event => {
      if (!pointerPrimaryDown(event)) return;
      event.stopPropagation();
      beginShopDrag(event, type);
    });
    card.addEventListener('pointerup', event => {
      event.stopPropagation();
      const wasDragging = shopDragging?.started;
      finishShopDrag(event);
      if (!wasDragging && game.phase === 'prep') showShopInfoPanel(type);
    });
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
  if (restartBtn) {
    const hasBuiltTower = Object.values(game.deployed || {}).some(Boolean);
    const showQuickRestart = game.phase !== 'ended' && (game.hasStartedOnce || hasBuiltTower);
    const showFailedRestart = game.phase === 'ended' && game.result === 'lose';
    restartBtn.hidden = !(showQuickRestart || showFailedRestart);
    restartBtn.classList.toggle('is-quick-restart', showQuickRestart);
  }
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
  drawWorldObjects();
  drawPlacementGrid();
  drawPlacementPreview();
  drawPlacementActiveFootprintOverlay();
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
  const isDraggingThis = dragging?.source?.area === 'deployed' && dragging.source.slotId === slot.id && dragging.started;
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
    drawTowerSprite(slot, item, isDraggingThis ? 0.24 : 1, selected || hovered);
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
  ctx.strokeText(`Lv${item.level}`, 0, 20);
  ctx.fillText(`Lv${item.level}`, 0, 20);
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
  const cy = rect.y + rect.height * rect.sprite.gemY;

  ctx.save();
  ctx.globalAlpha = Math.min(1, alpha * 0.92);
  ctx.globalCompositeOperation = 'screen';
  ctx.drawImage(img, sx, sy, sw, sh, cx - size / 2, cy - size / 2, size, size);
  ctx.restore();
}

function drawPlacementDiamond(g, centerX, centerY, tileW, tileH, fillStyle, strokeStyle, lineWidth = 1) {
  g.beginPath();
  g.moveTo(centerX, centerY - tileH * 0.5);
  g.lineTo(centerX + tileW * 0.5, centerY);
  g.lineTo(centerX, centerY + tileH * 0.5);
  g.lineTo(centerX - tileW * 0.5, centerY);
  g.closePath();
  if (fillStyle) {
    g.fillStyle = fillStyle;
    g.fill();
  }
  if (strokeStyle) {
    g.strokeStyle = strokeStyle;
    g.lineWidth = lineWidth;
    g.stroke();
  }
}

function forEachPlacementGridCenter(minX, maxX, minY, maxY, visitor) {
  const { tileW, tileH, originX, originY } = placementGridMetrics();
  const margin = Math.ceil(Math.max(canvas.width / tileW, canvas.height / tileH)) + 8;
  const minA = -margin;
  const maxA = margin * 2;
  const minB = -margin;
  const maxB = margin * 2;
  for (let a = minA; a <= maxA; a++) {
    for (let b = minB; b <= maxB; b++) {
      const x = originX + (a - b) * tileW * 0.5;
      const y = originY + (a + b) * tileH * 0.5;
      if (x < minX || x > maxX || y < minY || y > maxY) continue;
      visitor(x, y, a, b);
    }
  }
}

function placementGridCacheSignature(item, ignoreSlotId) {
  return [
    activeMapId || '',
    itemPlacementRangeKey(item),
    canvas.width,
    canvas.height,
    placementGridCellSize(),
    'buildable-footprint-cells-red-green-overlay-v1'
  ].join('~');
}

function drawPlacementFootprintShape(g, towerX, towerY, item, fillStyle, strokeStyle, lineWidth = 1) {
  const bounds = footprintGridEdgeBoundsAt(towerX, towerY, item) || footprintGridBoundsAt(towerX, towerY, item);
  const top = placementGridPointFromCoord(bounds.minA, bounds.minB);
  const right = placementGridPointFromCoord(bounds.maxA, bounds.minB);
  const bottom = placementGridPointFromCoord(bounds.maxA, bounds.maxB);
  const left = placementGridPointFromCoord(bounds.minA, bounds.maxB);
  g.beginPath();
  g.moveTo(top.x, top.y);
  g.lineTo(right.x, right.y);
  g.lineTo(bottom.x, bottom.y);
  g.lineTo(left.x, left.y);
  g.closePath();
  if (fillStyle) {
    g.fillStyle = fillStyle;
    g.fill();
  }
  if (strokeStyle) {
    g.strokeStyle = strokeStyle;
    g.lineWidth = lineWidth;
    g.stroke();
  }
}

function getPlacementGridCache(item, ignoreSlotId, minX, maxX, minY, maxY, cell) {
  const key = placementGridCacheSignature(item, ignoreSlotId);
  if (placementGridCache && placementGridCacheKey === key) return placementGridCache;
  if (!placementGridData) buildPlacementGridData();

  const off = document.createElement('canvas');
  off.width = canvas.width;
  off.height = canvas.height;
  const g = off.getContext('2d');
  const { tileW, tileH } = placementGridMetrics();
  const range = itemPlacementRangeKey(item);
  const terrainCells = placementGridData?.terrainCells?.[range] || [];

  // 玩家视角：整张地图直接显示红/绿单格，不做 footprint 大面积叠加，避免视觉过曝。
  // 每个格子的颜色仍然代表“当前建筑放到这个格子中心时，完整 footprint 是否能落下”。
  for (const cellData of terrainCells) {
    drawPlacementDiamond(
      g,
      cellData.towerX,
      cellData.towerY,
      tileW,
      tileH,
      cellData.ok ? 'rgba(34, 197, 94, 0.115)' : 'rgba(239, 68, 68, 0.135)',
      cellData.ok ? 'rgba(210, 255, 225, 0.24)' : 'rgba(255, 218, 218, 0.28)',
      0.7
    );
  }

  placementGridCache = off;
  placementGridCacheKey = key;
  return placementGridCache;
}

function invalidatePlacementGridCache() {
  placementGridCache = null;
  placementGridCacheKey = '';
}

function warmPlacementGridCache() {
  // 预热全图斜格缓存会造成关卡打开或首次交互卡顿，当前版本先禁用。
}

function drawPlacementLocalGrid(item, ignoreSlotId, centerX, centerY) {
  const { tileW, tileH } = placementGridMetrics();
  if (!placementGridData) buildPlacementGridData();
  const minX = Math.max(48, centerX - 220);
  const maxX = Math.min(canvas.width - 48, centerX + 220);
  const minY = Math.max(48, centerY - 150);
  const maxY = Math.min(canvas.height - 48, centerY + 150);
  const terrain = placementGridData?.terrain?.[itemPlacementRangeKey(item)];
  for (const cell of placementGridData?.cells || []) {
    if (cell.x < minX || cell.x > maxX || cell.y < minY || cell.y > maxY) continue;
    const terrainOk = terrain?.get(cell.key) === true;
    const ok = terrainOk && !placementOverlapsTower(cell.x, cell.y, ignoreSlotId, item);
    drawPlacementDiamond(
      ctx,
      cell.x,
      cell.y,
      tileW,
      tileH,
      ok ? 'rgba(21, 230, 104, 0.18)' : 'rgba(255, 58, 58, 0.2)',
      ok ? 'rgba(180, 255, 205, 0.24)' : 'rgba(255, 205, 205, 0.28)',
      0.8
    );
  }
}

function drawPlacementExactGrid(item, ignoreSlotId) {
  if (!placementGridData) buildPlacementGridData();
  const { tileW, tileH } = placementGridMetrics();
  const range = itemPlacementRangeKey(item);
  const terrainCells = placementGridData?.terrainCells?.[range] || [];
  const displayCells = new Map();

  // 关键：地图红绿不再表示“这个单格能不能当落点”，而是表示“当前建筑 footprint 覆盖到这里时是否可放”。
  // 这样普通塔 2x2、金矿 3x3 的显示会和最终放置判定一致：能放的占地区域整块变绿，不能放才变红。
  // 如果同一个格子被多个候选 footprint 覆盖，只要存在一个合法放置方案，就优先显示绿色，避免出现“红格上却能放”的误导。
  for (const cellData of terrainCells) {
    const placement = canCreateTowerSlot(cellData.towerX, cellData.towerY, ignoreSlotId, item);
    const footprintCells = footprintGridCellsAt(cellData.towerX, cellData.towerY, item);
    for (const fpCell of footprintCells) {
      const previous = displayCells.get(fpCell.key);
      if (previous?.ok) continue;
      displayCells.set(fpCell.key, { ...fpCell, ok: !!placement.ok });
    }
  }

  for (const cellData of displayCells.values()) {
    drawPlacementDiamond(
      ctx,
      cellData.x,
      cellData.y,
      tileW,
      tileH,
      cellData.ok ? 'rgba(34, 197, 94, 0.105)' : 'rgba(239, 68, 68, 0.125)',
      cellData.ok ? 'rgba(215, 255, 228, 0.23)' : 'rgba(255, 220, 220, 0.27)',
      0.65
    );
  }
}

function drawPlacementOccupiedOverlay(item, ignoreSlotId) {
  if (!placementGridData) buildPlacementGridData();
  const { tileW, tileH } = placementGridMetrics();
  const range = itemPlacementRangeKey(item);
  const terrainCells = placementGridData?.terrainCells?.[range] || [];
  for (const cellData of terrainCells) {
    if (!cellData.ok) continue;
    if (!placementOverlapsTower(cellData.towerX, cellData.towerY, ignoreSlotId, item)) continue;
    drawPlacementDiamond(
      ctx,
      cellData.towerX,
      cellData.towerY,
      tileW,
      tileH,
      'rgba(239, 68, 68, 0.16)',
      'rgba(255, 220, 220, 0.36)',
      0.8
    );
  }
}

function drawPlacementFootprintCells(towerX, towerY, item, ok, cell, minX, minY) {
  ctx.save();
  const { tileW, tileH } = placementGridMetrics();
  const cells = footprintGridCellsAt(towerX, towerY, item);
  for (const fpCell of cells) {
    drawPlacementDiamond(
      ctx,
      fpCell.x,
      fpCell.y,
      tileW,
      tileH,
      ok ? 'rgba(74, 222, 128, 0.24)' : 'rgba(248, 113, 113, 0.24)',
      null,
      0
    );
  }
  drawPlacementFootprintShape(
    ctx,
    towerX,
    towerY,
    item,
    null,
    ok ? 'rgba(250, 255, 252, 1)' : 'rgba(255, 238, 238, 1)',
    1.45
  );
  ctx.restore();
}

function drawPlacementActiveFootprintOverlay() {
  if (!placementPreview || game.phase !== 'prep') return;
  const item = placementPreview.item;
  if (!item) return;
  const px = placementPreview.snapX ?? placementPreview.x;
  const py = placementPreview.snapY ?? placementPreview.y;
  drawPlacementFootprintCells(px, py, item, placementPreview.ok, placementGridCellSize(), 48, 48);
}

function drawPlacementGrid() {
  if (!placementPreview || game.phase !== 'prep') return;
  const item = placementPreview.item;
  if (!item) return;

  const cell = placementGridCellSize();
  const ignoreSlotId = dragging?.source?.area === 'deployed' ? dragging.source.slotId : null;
  const minX = 48;
  const maxX = canvas.width - 48;
  const minY = 48;
  const maxY = canvas.height - 48;

  ctx.save();
  // 直接用最终 canCreateTowerSlot 结果画红/绿格，保证显示和实际放置完全一致。
  // 这一步只查预计算数组和已有建筑 footprint，不读 mask，不会回到旧卡顿模式。
  drawPlacementExactGrid(item, ignoreSlotId);

  const px = placementPreview.snapX ?? placementPreview.x;
  const py = placementPreview.snapY ?? placementPreview.y;
  const current = canCreateTowerSlot(px, py, ignoreSlotId, item);
  // 当前拖拽位置只显示真实 footprint 外轮廓，不再额外画单格落点，避免用户误解“单格红绿”和“2x2/3x3占地”的关系。

  // 显示真实塔底占用格子：使用塔最终落点坐标，不能使用内部 anchor，否则金矿等带 offset 的建筑会偏移/变得很怪。
  drawPlacementFootprintCells(px, py, item, current.ok, cell, minX, minY);

  // 已有建筑占用不再额外画红圈；最终是否可放由 footprint 高亮颜色表达。
  ctx.restore();
}

function drawPlacementPreview() {
  if (!placementPreview || game.phase !== 'prep') return;
  const { ok, item, reason, mergePreview } = placementPreview;
  const x = placementPreview.snapX ?? placementPreview.x;
  const y = placementPreview.snapY ?? placementPreview.y;
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

  // 地图区域必须绘制真实塔影，保证鼠标指向位置和最终落点一致；只有拖回商店取消区时改用顶层 DOM 小虚影避免被 UI 遮挡。
  if (!(pendingBuild && shopDragging?.started && reason === '拖回商店取消放置')) {
    drawTowerSprite({ x: 0, y: 0 }, item, ok ? 0.50 : 0.30, false);
  }

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
      ctx.filter = 'none';
    } else if (isBoss) {
      ctx.filter = 'drop-shadow(0 4px 8px rgba(15, 23, 42, 0.35))';
    }
    const drawFrozenSprite = e.slowTimer > 0;
    if (!drawFrozenSprite) {
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
    } else {
      drawFrozenTintedSprite(img, sx, sy, sw, sh, dx, dy, dw, dh, 0.34);
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

function drawFrozenTintedSprite(img, sx, sy, sw, sh, dx, dy, dw, dh, tintAlpha = 0.34) {
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

  // 冰冻调色：逐像素把原 sprite 往冷白冰蓝偏移，保留原 alpha，避免蒙层白边/半透明重影。
  const imageData = tintCtx.getImageData(0, 0, w, h);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    if (alpha < 4) continue;
    const edgeGuard = Math.min(1, alpha / 180);
    const amount = tintAlpha * edgeGuard;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    data[i] = Math.round(r + (218 - r) * amount + 8 * edgeGuard);
    data[i + 1] = Math.round(g + (246 - g) * amount + 10 * edgeGuard);
    data[i + 2] = Math.round(b + (255 - b) * amount + 14 * edgeGuard);
    data[i + 3] = alpha;
  }
  tintCtx.putImageData(imageData, 0, 0);
  ctx.drawImage(tintCanvas, dx, dy, dw, dh);
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
  ctx.globalCompositeOperation = p.composite || def.composite || 'source-over';
  ctx.globalAlpha = p.alpha ?? 1;
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
  // 中间小建筑 UI 已移除：保留其布局占位，避免血条/波次条位置变化。
  // ctx.drawImage(centerImg, centerX, centerY, centerW, centerH);
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
  drawCurrentWaveLabel(centerX, centerY, centerW, centerH);
  ctx.restore();
}

function drawCurrentWaveLabel(x, y, w, h) {
  const totalWaves = waveCfg.waves?.length || 1;
  const currentWave = Math.max(1, Math.min(game.waveIndex + 1, totalWaves));
  const label = game.bossActive ? 'BOSS' : `第 ${currentWave} 波`;
  const tx = x + w * 0.5;
  const ty = y + h * 1.02;
  const bgW = Math.max(72, ctx.measureText(label).width + 34);
  const bgH = 25;
  const gradient = ctx.createLinearGradient(tx - bgW / 2, ty, tx + bgW / 2, ty);
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
  gradient.addColorStop(0.18, 'rgba(0, 0, 0, 0.58)');
  gradient.addColorStop(0.82, 'rgba(0, 0, 0, 0.58)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.save();
  ctx.fillStyle = gradient;
  ctx.fillRect(tx - bgW / 2, ty - bgH / 2, bgW, bgH);
  ctx.font = '900 18px Microsoft YaHei, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 2;
  ctx.strokeStyle = 'rgba(9, 22, 50, 0.95)';
  ctx.lineWidth = 4;
  ctx.fillStyle = '#ffe9a6';
  drawSpacedText(label, tx, ty, 2.5);
  ctx.restore();
}

function drawSpacedText(text, x, y, spacing = 0) {
  const chars = Array.from(text);
  const widths = chars.map(char => ctx.measureText(char).width);
  const total = widths.reduce((sum, width) => sum + width, 0) + spacing * Math.max(0, chars.length - 1);
  let cursor = x - total / 2;
  for (let i = 0; i < chars.length; i += 1) {
    const char = chars[i];
    const cx = cursor + widths[i] / 2;
    ctx.strokeText(char, cx, y);
    ctx.fillText(char, cx, y);
    cursor += widths[i] + spacing;
  }
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

    const contentCenterX = panelX + panelW * 0.5;
    const titleY = panelY + panelH * 0.295;
    const infoY = panelY + panelH * 0.435;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff7ed';
    ctx.strokeStyle = 'rgba(74, 21, 9, 0.82)';
    ctx.lineWidth = 7;
    ctx.font = '900 48px Microsoft YaHei, sans-serif';
    ctx.strokeText('防守失败', contentCenterX, titleY);
    ctx.fillText('防守失败', contentCenterX, titleY);
    ctx.fillStyle = '#e5edf8';
    ctx.strokeStyle = 'rgba(2, 6, 23, 0.75)';
    ctx.lineWidth = 4;
    ctx.font = '800 20px Microsoft YaHei, sans-serif';
    const info = `最终分数：${game.score}   剩余基地血量：${game.hp}`;
    ctx.strokeText(info, contentCenterX, infoY);
    ctx.fillText(info, contentCenterX, infoY);
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

function towerSlotAtCanvasEvent(event, ignoreSlotId = null) {
  const { x, y } = canvasPoint(event);
  const candidates = [];
  for (const slot of allTowerSlots()) {
    if (slot.id === ignoreSlotId) continue;
    const item = game.deployed?.[slot.id];
    if (!item) continue;
    const rect = towerSpriteRect(slot, item);
    const padX = Math.max(8, rect.width * 0.08);
    const padTop = Math.max(6, rect.height * 0.04);
    const padBottom = Math.max(10, rect.height * 0.08);
    const inRect = x >= rect.x - padX && x <= rect.x + rect.width + padX && y >= rect.y - padTop && y <= rect.y + rect.height + padBottom;
    if (!inRect) continue;
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height * 0.52;
    candidates.push({ slot, dist: Math.hypot(x - cx, y - cy), bottom: slot.y });
  }
  candidates.sort((a, b) => a.dist - b.dist || b.bottom - a.bottom);
  return candidates[0]?.slot || null;
}

function bestMergeSlotForDragged(event, radius = 86) {
  if (!dragging || game.phase !== 'prep') return null;
  const moving = getItemAt(dragging.source);
  if (!moving) return null;
  const ignoreSlotId = dragging.source?.area === 'deployed' ? dragging.source.slotId : null;
  const { x, y } = canvasPoint(event);
  const snap = snapPlacementPoint(x, y, moving);
  const candidates = [];
  for (const slot of allTowerSlots()) {
    if (slot.id === ignoreSlotId) continue;
    const tower = game.deployed?.[slot.id];
    if (!tower) continue;
    // 只有真正进入目标建筑的占地/一圈禁止间隔时，才认为是“替换/交换目标”。
    // 间隔之外松手应当正常放在旁边，不再用旧的 64 像素半径误判成替换。
    if (!footprintsOverlap(snap.x, snap.y, moving, slot.x, slot.y, tower, placementSpacingMarginCells())) continue;
    candidates.push({ slot, dist: Math.hypot(slot.x - snap.x, slot.y - snap.y) });
  }
  candidates.sort((a, b) => a.dist - b.dist);
  return candidates[0]?.slot || null;
}

function canvasClick(event) {
  hideShopInfoPanel();
  if (suppressNextCanvasClick) {
    suppressNextCanvasClick = false;
    return;
  }
  if (pendingBuild) {
    // 现在商店道具必须通过拖拽建造；单击地图不再放置。
    return;
  }
  const slot = towerSlotAtCanvasEvent(event);
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
  stepUpdateWithBattleSpeed(dt);
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
    speedTestUnlocked = true;
    updateBattleSpeedUi();
    toggleLevelSelectPanel();
    setMessage('测试功能已解锁：可在选关面板下方单独开启 X6。');
  }
}

function updateFullscreenUi() {
  const isFullscreen = !!document.fullscreenElement || document.body.classList.contains('is-mobile-game-fullscreen');
  document.body.classList.toggle('is-fullscreen', isFullscreen && !!document.fullscreenElement);
  updateStageUiScale();
  requestAnimationFrame(() => {
    updateStageUiScale();
    restartTitleRunnerMotion();
  });
  setTimeout(() => {
    updateStageUiScale();
    restartTitleRunnerMotion();
  }, 260);
  if (!fullscreenBtn) return;
  fullscreenBtn.textContent = '';
  fullscreenBtn.setAttribute('aria-label', isFullscreen ? '退出全屏' : '全屏');
  fullscreenBtn.title = isFullscreen ? '退出全屏' : '全屏';
}

function isCoarsePointerDevice() {
  return window.matchMedia?.('(pointer: coarse)')?.matches;
}

async function toggleFullscreen() {
  if (!fullscreenBtn) return;
  if (isCoarsePointerDevice()) {
    document.body.classList.toggle('is-mobile-game-fullscreen');
    requestAnimationFrame(updateStageUiScale);
    updateFullscreenUi();
    return;
  }
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
battleSpeedBtn?.addEventListener('click', toggleBattleSpeed);
speedTestBtn?.addEventListener('click', toggleSpeedTest);
waveSettleCloseBtn?.addEventListener('click', hideWaveSettlePanel);
restartBtn?.addEventListener('click', restartCurrentLevel);
if (rerollBtn) rerollBtn.addEventListener('click', () => rollShop(true));
if (expandBtn) expandBtn.addEventListener('click', expandInventory);
if (sellBtn) sellBtn.addEventListener('click', sellSelected);
deckCollapseBtn?.addEventListener('click', () => setCommandDeckCollapsed(true));
deckExpandBtn?.addEventListener('click', () => setCommandDeckCollapsed(false));
helpBtn?.addEventListener('click', () => helpDialog?.showModal());
canvas.addEventListener('click', event => {
  const slot = towerSlotAtCanvasEvent(event);
  if (!slot || !game?.deployed?.[slot.id]) hideShopInfoPanel();
  canvasClick(event);
});

canvas.addEventListener('dragstart', event => {
  event.preventDefault();
});

canvas.addEventListener('pointerdown', event => {
  if (!pointerPrimaryDown(event)) return;
  if (game.phase !== 'prep') return;
  const slot = towerSlotAtCanvasEvent(event);
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
  const targetSlot = bestMergeSlotForDragged(event);
  updatePlacementPreview(x, y, targetSlot);
  updateDragGhost(event);
  const snapped = snapPlacementPoint(x, y, getItemAt(dragging.source));
  const placement = targetSlot ? { ok: true } : canCreateTowerSlot(snapped.x, snapped.y, dragging.source?.slotId || null, getItemAt(dragging.source));
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
      const targetSlot = bestMergeSlotForDragged(event);
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
  const slot = bestMergeSlotForDragged(event);
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
  const slot = bestMergeSlotForDragged(event);
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
  const slot = bestMergeSlotForDragged(event);
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
  const slot = bestMergeSlotForDragged(event);
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
  const slot = bestMergeSlotForDragged(event);
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
window.addEventListener('resize', () => {
  updateStageUiScale();
  applyUiAnchorDebugStyles();
  requestAnimationFrame(() => {
    updateStageUiScale();
    applyUiAnchorDebugStyles();
  });
});
window.visualViewport?.addEventListener('resize', () => {
  updateStageUiScale();
  applyUiAnchorDebugStyles();
  requestAnimationFrame(() => {
    updateStageUiScale();
    applyUiAnchorDebugStyles();
  });
});
window.visualViewport?.addEventListener('scroll', () => {
  updateStageUiScale();
  applyUiAnchorDebugStyles();
});
updateFullscreenUi();

document.addEventListener('keydown', event => {
  if (handleUiAnchorDebugKey(event)) return;
  handlePortalDebugKey(event);
});
window.addEventListener('pointerdown', event => {
  if (event.target?.closest?.('.shop-info-panel')) return;
  if (event.target?.closest?.('.shop-icon')) return;
  hideShopInfoPanel();
}, true);

goldHudEl?.addEventListener('pointerdown', handleGoldHudClick);
goldHudEl?.addEventListener('click', event => {
  event.preventDefault();
  event.stopPropagation();
});
goldHudEl?.addEventListener('keydown', event => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  handleGoldHudClick(event);
});
updateBattleSpeedUi();
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
  titleRunnerEl.style.setProperty('--runner-x', `${Number.isFinite(x) ? x : 0}px`);
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
  if (!titleRunnerEl || !helpBtn) return 820;
  const wrapRect = titleRunnerEl.parentElement.getBoundingClientRect();
  const helpRect = helpBtn.getBoundingClientRect();
  const runnerWidth = titleRunnerEl.getBoundingClientRect().width || 151;
  const x = (helpRect.left + helpRect.width * 0.5) - wrapRect.left - runnerWidth * 0.5 - 30;
  return Math.max(120, Math.min(x, Math.max(120, wrapRect.width - runnerWidth - 24)));
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
        requestAnimationFrame(() => setTitleRunnerFrame(0));
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
  const startX = -runnerWidth - 24;
  const stopX = Math.max(startX + 20, Math.min(getTitleRunnerStopX(), wrapWidth - runnerWidth - 12));
  const endX = wrapWidth + runnerWidth + 24;
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
  setTitleRunnerFrame(0);
  startTitleRunnerFrameLoop();
  await animateTitleRunnerSegment(stopX, endX, secondDuration);
  setTitleRunnerX(endX);
}

function setTitleRunnerAtHelp() {
  if (!titleRunnerEl || !helpBtn) return;
  const wrapRect = titleRunnerEl.parentElement.getBoundingClientRect();
  const helpRect = helpBtn.getBoundingClientRect();
  const runnerWidth = titleRunnerEl.getBoundingClientRect().width || 151;
  const x = (helpRect.left + helpRect.width * 0.5) - wrapRect.left - runnerWidth * 0.5 - 30;
  setTitleRunnerX(x);
}

function restartTitleRunnerMotion() {
  if (!titleRunnerEl) return;
  if (titleRunnerMoveRaf) cancelAnimationFrame(titleRunnerMoveRaf);
  if (titleRunnerFrameTimer) clearInterval(titleRunnerFrameTimer);
  titleRunnerMoveRaf = null;
  titleRunnerFrameTimer = null;
  titleRunnerPlaying = false;
  requestAnimationFrame(() => startTitleRunnerLoop());
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
  updateStageUiScale();
  startTitleRunnerLoop();
  requestAnimationFrame(loop);
}).catch(error => {
  console.error(error);
  setMessage('配置文件加载失败，请通过本地服务器运行。');
});
