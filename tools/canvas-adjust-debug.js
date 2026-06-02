// Canvas 素材调试工具
// 用途：临时调试 Canvas 中某个精灵/特效/图片的位置、缩放、横向压扁和旋转。
// 注意：本文件默认不被 index.html 加载，不影响正式游戏运行。

export function drawAdjustDebugOverlay(ctx, {
  reference,
  next,
  x,
  y,
  width,
  height,
  transform = {},
  referenceLabel = '参考点',
  centerLabel = '素材中心'
}) {
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.lineWidth = 2;
  ctx.font = '900 13px Microsoft YaHei, sans-serif';
  ctx.textBaseline = 'top';

  if (reference) {
    ctx.strokeStyle = 'rgba(34, 197, 94, 0.95)';
    ctx.fillStyle = 'rgba(34, 197, 94, 0.95)';
    ctx.beginPath();
    ctx.moveTo(reference.x - 14, reference.y);
    ctx.lineTo(reference.x + 14, reference.y);
    ctx.moveTo(reference.x, reference.y - 14);
    ctx.lineTo(reference.x, reference.y + 14);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(reference.x, reference.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillText(referenceLabel, reference.x + 10, reference.y + 8);
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
  ctx.transform(transform.a ?? transform.scaleX ?? 1, transform.b || 0, transform.c || 0, transform.d ?? transform.scaleY ?? 1, 0, 0);
  ctx.strokeStyle = 'rgba(251, 113, 133, 0.95)';
  ctx.setLineDash([8, 6]);
  ctx.strokeRect(-width / 2, -height / 2, width, height);
  ctx.restore();

  if (reference && next) {
    ctx.strokeStyle = 'rgba(96, 165, 250, 0.85)';
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(reference.x, reference.y);
    ctx.lineTo(next.x, next.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();
}

export function applyAdjustDebugKey(event, tune, label = 'AdjustDebug') {
  const step = event.shiftKey ? 10 : 2;
  const rotateStep = event.shiftKey ? 0.1 : 0.03;
  let handled = true;

  if (event.key === 'ArrowLeft') tune.x -= step;
  else if (event.key === 'ArrowRight') tune.x += step;
  else if (event.key === 'ArrowUp') tune.y -= step;
  else if (event.key === 'ArrowDown') tune.y += step;
  else if (event.key === '=' || event.key === '+') tune.scale = +(tune.scale + 0.03).toFixed(2);
  else if (event.key === '-' || event.key === '_') tune.scale = Math.max(0.1, +(tune.scale - 0.03).toFixed(2));
  else if (event.key === ']') tune.scaleX = +(tune.scaleX + 0.02).toFixed(2);
  else if (event.key === '[') tune.scaleX = Math.max(0.1, +(tune.scaleX - 0.02).toFixed(2));
  else if (event.key === '.') tune.rotation = +((tune.rotation || 0) + rotateStep).toFixed(3);
  else if (event.key === ',') tune.rotation = +((tune.rotation || 0) - rotateStep).toFixed(3);
  else handled = false;

  if (!handled) return false;
  event.preventDefault();
  console.log(`[${label}]`, JSON.stringify(tune));
  return true;
}

export function createDefaultAdjustTune(overrides = {}) {
  return {
    x: 0,
    y: 0,
    scale: 1,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    ...overrides
  };
}
