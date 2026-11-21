// render.js — draws the archive itself: chequered floor, tall bookcase
// shelves with coloured spines, low book stacks to hide in, lamp stands and
// their warm pools of light, the wardens' raycast vision cones, the Atlas
// pedestal, the exit, loot, noise rings and the actors. Flat vector art on
// one canvas; decoration is hashed per tile so every frame is identical.

import { VIEW, tileCenter, playerHidden } from './state.js';
import { nearAtlas } from './player.js';
import { visionRange, visionHalfAngle } from './guards.js';
import { conePolygon as castCone } from './geometry.js';

// Deterministic per-tile decoration hash (stable across frames and runs).
function hash2(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

const SPINE_COLORS = ['#7a4a3a', '#4a6b8a', '#8a6d3b', '#5d7a4a', '#6b4a7a', '#94503f', '#3f6b6b', '#836953'];

function drawFloor(ctx, game) {
  const { tile, ox, oy, level } = game;
  ctx.fillStyle = '#11151f';
  ctx.fillRect(VIEW.PLAY_X - 4, VIEW.PLAY_Y - 4, VIEW.PLAY_W + 8, VIEW.PLAY_H + 8);
  for (let ty = 0; ty < level.rows; ty++) {
    for (let tx = 0; tx < level.cols; tx++) {
      const x = ox + tx * tile;
      const y = oy + ty * tile;
      const odd = (tx + ty) % 2 === 0;
      ctx.fillStyle = odd ? '#26303f' : '#222b39';
      ctx.fillRect(x, y, tile, tile);
      ctx.fillStyle = 'rgba(255,255,255,0.025)';
      ctx.fillRect(x, y, tile, 1);
    }
  }
}

function drawExit(ctx, game) {
  const tile = game.tile;
  const [x, y] = tileCenter(game.level.exit.tx, game.level.exit.ty);
  const w = tile * 0.92;
  const h = tile * 0.92;
  const open = game.hasAtlas;
  ctx.save();
  ctx.translate(x, y);
  if (open) {
    const pulse = 0.65 + 0.35 * Math.sin(game.time * 4);
    ctx.shadowColor = 'rgba(120,255,170,0.8)';
    ctx.shadowBlur = 16 * pulse;
  }
  ctx.fillStyle = open ? '#2e7d5b' : '#3a4152';
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = open ? '#8ff5bd' : '#59637a';
  ctx.lineWidth = 2;
  ctx.strokeRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6);
  ctx.fillStyle = open ? '#d9ffe9' : '#8b96ad';
  ctx.font = `bold ${Math.round(tile * 0.26)}px Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('EXIT', 0, -tile * 0.08);
  ctx.font = `${Math.round(tile * 0.3)}px Georgia, serif`;
  ctx.fillText(open ? '➤' : '⚿', 0, tile * 0.2);
  ctx.restore();
}

function drawLoot(ctx, game) {
  const tile = game.tile;
  for (const item of game.level.loot) {
    if (item.taken) continue;
    const [x, y] = tileCenter(item.tx, item.ty);
    const bob = Math.sin(game.time * 3 + item.tx * 1.7 + item.ty) * 2;
    ctx.save();
    ctx.translate(x, y + bob);
    ctx.shadowColor = 'rgba(255,205,90,0.9)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#f2c14e';
    ctx.beginPath();
    ctx.moveTo(0, -tile * 0.16);
    ctx.lineTo(tile * 0.13, 0);
    ctx.lineTo(0, tile * 0.16);
    ctx.lineTo(-tile * 0.13, 0);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath();
    ctx.arc(0, 0, tile * 0.045, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawPedestalStone(ctx, game) {
  const tile = game.tile;
  const [x, y] = tileCenter(game.level.atlas.tx, game.level.atlas.ty);
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#4b5468';
  ctx.fillRect(-tile * 0.34, -tile * 0.1, tile * 0.68, tile * 0.42);
  ctx.fillStyle = '#5d6880';
  ctx.fillRect(-tile * 0.4, -tile * 0.18, tile * 0.8, tile * 0.12);
  ctx.restore();
}

function drawAtlasPedestal(ctx, game) {
  const tile = game.tile;
  const [x, y] = tileCenter(game.level.atlas.tx, game.level.atlas.ty);
  ctx.save();
  ctx.translate(x, y);
  if (!game.hasAtlas) {
    // The Ember Atlas: an ember-orange book that glows like a coal.
    const pulse = 0.7 + 0.3 * Math.sin(game.time * 2.6);
    ctx.shadowColor = 'rgba(255,120,40,0.95)';
    ctx.shadowBlur = 18 * pulse;
    ctx.fillStyle = '#e86a17';
    ctx.fillRect(-tile * 0.2, -tile * 0.46, tile * 0.4, tile * 0.3);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffb347';
    ctx.fillRect(-tile * 0.2, -tile * 0.46, tile * 0.4, tile * 0.07);
    ctx.fillStyle = '#7a2d05';
    ctx.fillRect(-tile * 0.03, -tile * 0.46, tile * 0.06, tile * 0.3);
  } else {
    ctx.fillStyle = '#39415a';
    ctx.font = `${Math.round(tile * 0.24)}px Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.fillText('taken', 0, -tile * 0.28);
  }
  ctx.restore();
  if (nearAtlas(game)) {
    ctx.save();
    ctx.font = `bold ${Math.round(tile * 0.3)}px Georgia, serif`;
    ctx.textAlign = 'center';
    const label = 'E — TAKE THE EMBER ATLAS';
    const w = ctx.measureText(label).width + 18;
    ctx.fillStyle = 'rgba(8,10,18,0.85)';
    ctx.beginPath();
    ctx.roundRect(x - w / 2, y - tile * 1.25, w, tile * 0.52, 6);
    ctx.fill();
    ctx.fillStyle = '#ffd9a0';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x, y - tile * 0.98);
    ctx.restore();
  }
}

function drawCoverStacks(ctx, game) {
  const { tile, ox, oy, level } = game;
  for (const key of level.cover) {
    const [tx, ty] = key.split(',').map(Number);
    const x = ox + tx * tile;
    const y = oy + ty * tile;
    const h = hash2(tx, ty);
    // A low pile of oversized books, drawn as three stacked slabs.
    const slabs = 3;
    for (let i = 0; i < slabs; i++) {
      const inset = 3 + hash2(tx * 3 + i, ty) * 5;
      const sy = y + tile - 8 - (i + 1) * (tile * 0.2);
      ctx.fillStyle = SPINE_COLORS[Math.floor(hash2(tx + i * 7, ty * 2) * SPINE_COLORS.length)];
      ctx.beginPath();
      ctx.roundRect(x + inset, sy, tile - inset * 2, tile * 0.2 - 1, 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,240,200,0.25)';
      ctx.fillRect(x + inset, sy, tile - inset * 2, 2);
    }
    if (h > 0.55) {
      ctx.fillStyle = 'rgba(242,193,78,0.85)';
      ctx.beginPath();
      ctx.arc(x + tile * 0.7, y + tile * 0.24, tile * 0.05, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawShelves(ctx, game) {
  const { tile } = game;
  for (const r of game.wallRects) {
    // Bookcase carcass.
    ctx.fillStyle = '#3a2a18';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = '#4c3822';
    ctx.fillRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4);
    // Two shelves of book spines, hashed per tile so the rows look stocked.
    for (let shelf = 0; shelf < 2; shelf++) {
      const sy = r.y + 4 + shelf * (tile / 2);
      let sx = r.x + 4;
      let i = 0;
      while (sx < r.x + r.w - 7) {
        const bw = 3 + hash2(r.tx * 13 + i, r.ty * 7 + shelf) * 4;
        ctx.fillStyle = SPINE_COLORS[Math.floor(hash2(r.tx + i * 3, r.ty + shelf * 11) * SPINE_COLORS.length)];
        ctx.fillRect(sx, sy + 2, bw, tile / 2 - 7);
        sx += bw + 1.4;
        i++;
      }
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(r.x + 2, sy + tile / 2 - 3, r.w - 4, 2);
    }
    ctx.fillStyle = 'rgba(255,220,150,0.10)';
    ctx.fillRect(r.x, r.y, r.w, 2);
  }
}

function drawLampStands(ctx, game) {
  const tile = game.tile;
  for (const l of game.lampPts) {
    ctx.save();
    ctx.translate(l.x, l.y);
    ctx.fillStyle = '#191d29';
    ctx.beginPath();
    ctx.ellipse(0, tile * 0.16, tile * 0.16, tile * 0.06, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#8a6d3b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, tile * 0.14);
    ctx.lineTo(0, -tile * 0.12);
    ctx.stroke();
    ctx.restore();
  }
}

// Darkness first, then the lamp pools cut warm holes in it.
function drawLighting(ctx, game) {
  const { ox, oy, tile, level } = game;
  const w = level.cols * tile;
  const h = level.rows * tile;
  ctx.fillStyle = 'rgba(4,6,15,0.40)';
  ctx.fillRect(ox, oy, w, h);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const l of game.lampPts) {
    const g = ctx.createRadialGradient(l.x, l.y, 4, l.x, l.y, l.r);
    g.addColorStop(0, 'rgba(255,176,92,0.30)');
    g.addColorStop(0.55, 'rgba(255,150,70,0.12)');
    g.addColorStop(1, 'rgba(255,140,60,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(l.x, l.y, l.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // The bright bulb at the heart of each pool.
  for (const l of game.lampPts) {
    ctx.save();
    ctx.translate(l.x, l.y);
    ctx.shadowColor = 'rgba(255,190,90,1)';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#ffd9a0';
    ctx.beginPath();
    ctx.arc(0, -game.tile * 0.16, game.tile * 0.09, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function coneColor(guard) {
  if (guard.mode === 'pursue' || guard.awareness >= 0.99) return '244,72,60';
  if (guard.mode === 'investigate' || guard.awareness >= 0.35) return '250,176,60';
  return '64,196,178';
}

function coneAlpha(guard) {
  if (guard.mode === 'pursue' || guard.awareness >= 0.99) return 0.22;
  if (guard.mode === 'investigate' || guard.awareness >= 0.35) return 0.17;
  return 0.10;
}

function drawCones(ctx, game) {
  for (const guard of game.guards) {
    const pts = castCone(guard.x, guard.y, guard.facing, visionHalfAngle(), visionRange(game), game.wallRects);
    const rgb = coneColor(guard);
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fillStyle = `rgba(${rgb},${coneAlpha(guard)})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(${rgb},${coneAlpha(guard) + 0.13})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

function drawNoiseRings(ctx, game) {
  for (const ev of game.noiseEvents) {
    const k = ev.t / ev.dur;
    ctx.beginPath();
    ctx.arc(ev.x, ev.y, Math.max(1, ev.r * k), 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,220,150,${(1 - k) * 0.85})`;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(ev.x, ev.y, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,220,150,${(1 - k) * 0.9})`;
    ctx.fill();
  }
}

function drawGuard(ctx, game, guard) {
  const tile = game.tile;
  ctx.save();
  ctx.translate(guard.x, guard.y);
  // Ground shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(0, guard.r * 0.75, guard.r * 0.95, guard.r * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  // Crimson warden's coat.
  ctx.fillStyle = '#a63a32';
  ctx.beginPath();
  ctx.arc(0, 0, guard.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#7e2a24';
  ctx.beginPath();
  ctx.arc(0, 0, guard.r * 0.62, 0, Math.PI * 2);
  ctx.fill();
  // Face toward the facing direction.
  const fx = Math.cos(guard.facing);
  const fy = Math.sin(guard.facing);
  ctx.fillStyle = '#e8c39a';
  ctx.beginPath();
  ctx.arc(fx * guard.r * 0.34, fy * guard.r * 0.34, guard.r * 0.3, 0, Math.PI * 2);
  ctx.fill();
  // The lantern he carries, out at his side.
  ctx.shadowColor = 'rgba(255,190,90,1)';
  ctx.shadowBlur = 9;
  ctx.fillStyle = '#ffca7a';
  ctx.beginPath();
  ctx.arc(fy * guard.r * 0.85, -fx * guard.r * 0.85, guard.r * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();

  // Detection tick above the warden: fills as he catches on.
  if (guard.awareness > 0.02) {
    const w = tile * 0.9;
    const x = guard.x - w / 2;
    const y = guard.y - guard.r - 14;
    ctx.fillStyle = 'rgba(5,6,12,0.75)';
    ctx.fillRect(x, y, w, 5);
    ctx.fillStyle = guard.awareness >= 0.99 ? '#f4483c' : guard.awareness >= 0.45 ? '#faaf3c' : '#40c4b2';
    ctx.fillRect(x, y, w * guard.awareness, 5);
  }
  // State marker.
  ctx.save();
  ctx.font = `bold ${Math.round(tile * 0.55)}px Georgia, serif`;
  ctx.textAlign = 'center';
  if (guard.mode === 'pursue') {
    ctx.fillStyle = '#ff5a4e';
    ctx.fillText('!', guard.x, guard.y - guard.r - 20);
  } else if (guard.mode === 'investigate') {
    ctx.fillStyle = '#ffbe55';
    ctx.fillText('?', guard.x, guard.y - guard.r - 20);
  }
  ctx.restore();
  // Speech: what pulled him off his beat, in his own words.
  if (guard.speechT > 0 && guard.speech) {
    ctx.save();
    ctx.font = `bold ${Math.round(tile * 0.3)}px Georgia, serif`;
    ctx.textAlign = 'center';
    const w = ctx.measureText(guard.speech).width + 16;
    const bx = Math.min(Math.max(guard.x, VIEW.PLAY_X + w / 2), VIEW.PLAY_X + VIEW.PLAY_W - w / 2);
    const by = guard.y - guard.r - tile * 1.15;
    ctx.fillStyle = 'rgba(245,240,225,0.95)';
    ctx.beginPath();
    ctx.roundRect(bx - w / 2, by - 13, w, 24, 7);
    ctx.fill();
    ctx.fillStyle = '#23202a';
    ctx.textBaseline = 'middle';
    ctx.fillText(guard.speech, bx, by);
    ctx.restore();
  }
}

function drawPlayer(ctx, game) {
  const p = game.player;
  if (!p) return;
  const hidden = playerHidden();
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(0, p.r * 0.75, p.r * 0.95, p.r * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  if (hidden) ctx.globalAlpha = 0.55;
  // Teal thief's cloak and hood.
  ctx.fillStyle = '#2fa39a';
  ctx.beginPath();
  ctx.arc(0, 0, p.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1d6f68';
  ctx.beginPath();
  ctx.arc(0, 0, p.r * 0.6, 0, Math.PI * 2);
  ctx.fill();
  const fx = Math.cos(p.facing);
  const fy = Math.sin(p.facing);
  ctx.fillStyle = '#d9e8e4';
  ctx.beginPath();
  ctx.arc(fx * p.r * 0.3, fy * p.r * 0.3, p.r * 0.27, 0, Math.PI * 2);
  ctx.fill();
  if (game.hasAtlas) {
    ctx.fillStyle = '#e86a17';
    ctx.fillRect(-fx * p.r * 0.8 - 4, -fy * p.r * 0.8 - 5, 8, 10);
  }
  ctx.restore();
  if (hidden) {
    ctx.save();
    ctx.strokeStyle = 'rgba(120,255,205,0.8)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r + 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

// The unchanging layer — floor, shelves, stacks, pedestal stone, lamp
// stands — is painted once per floor into an offscreen canvas; a software
// renderer would otherwise redraw thousands of book spines every frame.
let staticLayer = null;
let staticKey = '';
function drawStaticLayer(ctx, game) {
  const key = `${game.levelIndex}:${game.tile}:${game.ox}:${game.oy}`;
  if (!staticLayer || staticKey !== key) {
    staticKey = key;
    staticLayer = document.createElement('canvas');
    staticLayer.width = VIEW.W;
    staticLayer.height = VIEW.H;
    const sctx = staticLayer.getContext('2d');
    drawFloor(sctx, game);
    drawCoverStacks(sctx, game);
    drawShelves(sctx, game);
    drawPedestalStone(sctx, game);
    drawLampStands(sctx, game);
  }
  ctx.drawImage(staticLayer, 0, 0);
}

// The whole world, back to front. The header and side panel are hud.js's job.
export function drawWorld(ctx, game) {
  if (!game.level) return;
  drawStaticLayer(ctx, game);
  drawExit(ctx, game);
  drawLoot(ctx, game);
  drawAtlasPedestal(ctx, game);
  drawLighting(ctx, game);
  drawCones(ctx, game);
  drawNoiseRings(ctx, game);
  for (const guard of game.guards) drawGuard(ctx, game, guard);
  drawPlayer(ctx, game);
  // Transient announcement along the bottom of the playfield.
  if (game.messageT > 0 && game.message && game.screen === 'play') {
    ctx.save();
    ctx.font = 'italic 16px Georgia, serif';
    ctx.textAlign = 'center';
    const w = ctx.measureText(game.message).width + 28;
    const cx = game.ox + (game.level.cols * game.tile) / 2;
    const cy = game.oy + game.level.rows * game.tile - 16;
    ctx.fillStyle = 'rgba(8,10,18,0.82)';
    ctx.beginPath();
    ctx.roundRect(cx - w / 2, cy - 14, w, 28, 8);
    ctx.fill();
    ctx.fillStyle = '#e8dfc8';
    ctx.textBaseline = 'middle';
    ctx.fillText(game.message, cx, cy + 1);
    ctx.restore();
  }
}
