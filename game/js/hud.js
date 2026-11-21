// hud.js — everything that is not the world itself: the header bar (level,
// objective, timer, strikes), the right-hand panel (DETECTION banner, ALARM
// meter, VISIBILITY / NOISE / LOOT / SPOTTED / GOAL readouts, a LEGEND of
// every icon and the CONTROLS), and the title, pause, level-complete,
// caught and win screens.

import { VIEW, playerHidden, playerLight } from './state.js';
import { LEVEL_DEFS, parseLevel } from './levels.js';

const INK = '#e8dfc8';
const DIM = '#9aa3b8';
const AMBER = '#ffbe55';
const TEAL = '#40c4b2';
const RED = '#ff5a4e';

export function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

// The panel's headline state, from the most aware warden.
export function detectionState(game) {
  let maxAware = 0;
  let investigating = false;
  for (const g of game.guards) {
    if (g.mode === 'pursue') return { level: 'spotted', label: 'SPOTTED !', hint: 'RUN. Break line of sight and let the alarm cool.' };
    if (g.mode === 'investigate') investigating = true;
    if (g.awareness > maxAware) maxAware = g.awareness;
  }
  if (investigating || maxAware >= 0.35) {
    return { level: 'suspicious', label: 'SUSPICIOUS ?', hint: 'A warden is looking for you — stay dark, stay still, or slip into the stacks.' };
  }
  return { level: 'quiet', label: 'QUIET', hint: 'No one has seen you. Lamplight betrays; shadow keeps.' };
}

function noiseReadout(game) {
  const p = game.player;
  if (!p || !p.moving || p.stance === 'sneak') return ['SILENT', TEAL];
  if (p.stance === 'sprint') return ['LOUD', RED];
  return ['SOFT', AMBER];
}

function visibilityReadout(game) {
  if (!game.player) return ['—', DIM];
  if (playerHidden()) return ['HIDDEN', '#7dffc8'];
  if (playerLight() === 'lamp') return ['IN LAMPLIGHT', AMBER];
  return ['IN SHADOW', TEAL];
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const trial = line ? line + ' ' + w : w;
    if (ctx.measureText(trial).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = trial;
  }
  if (line) lines.push(line);
  return lines;
}

function drawHeader(ctx, game) {
  ctx.fillStyle = '#141a2c';
  ctx.fillRect(0, 0, VIEW.W, VIEW.HEADER);
  ctx.fillStyle = '#c9a227';
  ctx.fillRect(0, VIEW.HEADER - 2, VIEW.W, 2);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = INK;
  ctx.font = 'bold 19px Georgia, serif';
  ctx.fillText(game.level ? game.level.name : 'HUSHSTACK', 16, VIEW.HEADER / 2);
  ctx.textAlign = 'center';
  ctx.fillStyle = AMBER;
  ctx.font = '15px Georgia, serif';
  const objective = game.hasAtlas
    ? '◆ OBJECTIVE: Reach the exit unseen'
    : '◆ OBJECTIVE: Take the Ember Atlas, then reach the exit';
  ctx.fillText(objective, 470, VIEW.HEADER / 2);
  ctx.textAlign = 'right';
  ctx.fillStyle = INK;
  ctx.font = 'bold 16px Georgia, serif';
  ctx.fillText(`TIME ${formatTime(game.time)}`, VIEW.W - 196, VIEW.HEADER / 2);
  // Strikes as three lanterns: lit red once spent.
  for (let i = 0; i < 3; i++) {
    const x = VIEW.W - 108 + i * 30;
    ctx.beginPath();
    ctx.arc(x, VIEW.HEADER / 2, 8, 0, Math.PI * 2);
    if (i < game.strikes) {
      ctx.fillStyle = RED;
      ctx.fill();
    } else {
      ctx.strokeStyle = DIM;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }
  ctx.fillStyle = DIM;
  ctx.font = '11px Georgia, serif';
  ctx.textAlign = 'right';
  ctx.fillText('STRIKES', VIEW.W - 132, VIEW.HEADER / 2);
}

function statRow(ctx, x, y, w, label, value, color) {
  ctx.textAlign = 'left';
  ctx.fillStyle = DIM;
  ctx.font = '12px Georgia, serif';
  ctx.fillText(label, x, y);
  ctx.textAlign = 'right';
  ctx.fillStyle = color;
  ctx.font = 'bold 15px Georgia, serif';
  ctx.fillText(value, x + w, y);
}

function legendRow(ctx, x, y, drawIcon, text) {
  ctx.save();
  ctx.translate(x, y);
  drawIcon(ctx);
  ctx.restore();
  ctx.textAlign = 'left';
  ctx.fillStyle = INK;
  ctx.font = '12.5px Georgia, serif';
  ctx.fillText(text, x + 34, y + 1);
}

function drawPanel(ctx, game) {
  const x = VIEW.PANEL_X;
  const w = VIEW.PANEL_W;
  ctx.fillStyle = '#10141f';
  ctx.fillRect(x - 6, VIEW.HEADER, VIEW.W - x + 6, VIEW.H - VIEW.HEADER);
  ctx.fillStyle = '#c9a227';
  ctx.fillRect(x - 6, VIEW.HEADER, 2, VIEW.H - VIEW.HEADER);
  ctx.textBaseline = 'middle';

  // DETECTION banner.
  const det = detectionState(game);
  const detColor = det.level === 'spotted' ? RED : det.level === 'suspicious' ? AMBER : TEAL;
  ctx.textAlign = 'left';
  ctx.fillStyle = DIM;
  ctx.font = 'bold 12px Georgia, serif';
  ctx.fillText('DETECTION', x + 8, 76);
  ctx.fillStyle = det.level === 'spotted' ? '#3d130f' : det.level === 'suspicious' ? '#3a2a10' : '#0f2e2a';
  ctx.beginPath();
  ctx.roundRect(x + 8, 86, w - 16, 56, 8);
  ctx.fill();
  ctx.strokeStyle = detColor;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = detColor;
  ctx.font = 'bold 27px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText(det.label, x + w / 2, 115);
  ctx.font = '12px Georgia, serif';
  ctx.fillStyle = INK;
  ctx.textAlign = 'left';
  const hintLines = wrapText(ctx, det.hint, w - 24).slice(0, 2);
  hintLines.forEach((line, i) => ctx.fillText(line, x + 10, 158 + i * 15));

  // ALARM meter.
  ctx.fillStyle = DIM;
  ctx.font = 'bold 12px Georgia, serif';
  ctx.fillText('ALARM', x + 8, 196);
  ctx.fillStyle = '#2a2f3d';
  ctx.beginPath();
  ctx.roundRect(x + 8, 206, w - 16, 14, 7);
  ctx.fill();
  if (game.alarm > 0.01) {
    const hue = game.alarm < 0.5 ? AMBER : RED;
    ctx.fillStyle = hue;
    ctx.beginPath();
    ctx.roundRect(x + 8, 206, (w - 16) * game.alarm, 14, 7);
    ctx.fill();
  }

  // Readouts.
  const [visText, visColor] = visibilityReadout(game);
  const [noiseText, noiseColor] = noiseReadout(game);
  const levelLootTotal = game.level.loot.length;
  let ry = 248;
  statRow(ctx, x + 8, ry, w - 16, 'VISIBILITY', visText, visColor);
  statRow(ctx, x + 8, (ry += 27), w - 16, 'NOISE', noiseText, noiseColor);
  statRow(ctx, x + 8, (ry += 27), w - 16, 'LOOT', `${game.bankedLoot + game.levelLoot} / ${game.totalLoot}`, '#f2c14e');
  statRow(ctx, x + 8, (ry += 27), w - 16, 'SPOTTED', String(game.spottedCount), game.spottedCount ? RED : INK);
  statRow(ctx, x + 8, (ry += 27), w - 16, 'GOAL', game.hasAtlas ? 'REACH THE EXIT' : 'TAKE THE ATLAS', AMBER);

  // LEGEND.
  let ly = ry + 34;
  ctx.fillStyle = DIM;
  ctx.font = 'bold 12px Georgia, serif';
  ctx.textAlign = 'left';
  ctx.fillText('LEGEND', x + 8, ly);
  ly += 20;
  const coneIcon = (rgb) => (c) => {
    c.fillStyle = `rgba(${rgb},0.5)`;
    c.beginPath();
    c.moveTo(2, 0);
    c.lineTo(24, -8);
    c.lineTo(24, 8);
    c.closePath();
    c.fill();
  };
  legendRow(ctx, x + 8, ly, coneIcon('64,196,178'), "Warden's gaze — calm");
  legendRow(ctx, x + 8, (ly += 21), coneIcon('250,176,60'), '— suspicious · red: spotted');
  legendRow(ctx, x + 8, (ly += 21), (c) => {
    c.fillStyle = '#ffd9a0';
    c.beginPath();
    c.arc(12, 0, 6, 0, Math.PI * 2);
    c.fill();
  }, 'Lamplight — you are seen sooner');
  legendRow(ctx, x + 8, (ly += 21), (c) => {
    c.fillStyle = '#5d7a4a';
    c.fillRect(2, -6, 22, 5);
    c.fillStyle = '#7a4a3a';
    c.fillRect(3, 0, 20, 5);
  }, 'Low book stack — hide inside');
  legendRow(ctx, x + 8, (ly += 21), (c) => {
    c.fillStyle = '#4c3822';
    c.fillRect(2, -8, 22, 16);
    c.fillStyle = '#94503f';
    c.fillRect(5, -6, 3, 12);
    c.fillStyle = '#4a6b8a';
    c.fillRect(10, -6, 3, 12);
    c.fillStyle = '#8a6d3b';
    c.fillRect(15, -6, 3, 12);
  }, 'Tall shelf — blocks sight');
  legendRow(ctx, x + 8, (ly += 21), (c) => {
    c.fillStyle = '#e86a17';
    c.fillRect(5, -7, 14, 14);
    c.fillStyle = '#ffb347';
    c.fillRect(5, -7, 14, 4);
  }, 'The Ember Atlas');
  legendRow(ctx, x + 8, (ly += 21), (c) => {
    c.strokeStyle = '#8ff5bd';
    c.lineWidth = 2;
    c.strokeRect(4, -8, 18, 16);
  }, 'Exit — opens once you hold it');
  legendRow(ctx, x + 8, (ly += 21), (c) => {
    c.fillStyle = '#f2c14e';
    c.beginPath();
    c.moveTo(12, -8);
    c.lineTo(19, 0);
    c.lineTo(12, 8);
    c.lineTo(5, 0);
    c.closePath();
    c.fill();
  }, 'Loot — inkwell or coin stack');

  // CONTROLS.
  let cy = ly + 32;
  ctx.fillStyle = DIM;
  ctx.font = 'bold 12px Georgia, serif';
  ctx.fillText('CONTROLS', x + 8, cy);
  ctx.fillStyle = INK;
  ctx.font = '12.5px Georgia, serif';
  const controls = [
    'WASD / arrows — move',
    'SHIFT — sneak (silent, slow)',
    'SPACE — sprint (fast, loud)',
    'E — take the Atlas',
    'CLICK — throw a coin',
    'ESC — pause · R — retry floor',
  ];
  controls.forEach((line, i) => ctx.fillText(line, x + 8, cy + 20 + i * 18));
}

function dimScreen(ctx, alpha) {
  ctx.fillStyle = `rgba(4,6,13,${alpha})`;
  ctx.fillRect(0, 0, VIEW.W, VIEW.H);
}

function centerPanel(ctx, w, h) {
  const x = (VIEW.W - w) / 2;
  const y = (VIEW.H - h) / 2;
  ctx.fillStyle = 'rgba(13,17,28,0.96)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 12);
  ctx.fill();
  ctx.strokeStyle = '#c9a227';
  ctx.lineWidth = 2;
  ctx.stroke();
  return [x, y];
}

function overlayStats(ctx, cx, y, rows) {
  ctx.font = '16px Georgia, serif';
  rows.forEach(([label, value], i) => {
    ctx.textAlign = 'right';
    ctx.fillStyle = DIM;
    ctx.fillText(label, cx - 12, y + i * 28);
    ctx.textAlign = 'left';
    ctx.fillStyle = INK;
    ctx.font = 'bold 16px Georgia, serif';
    ctx.fillText(value, cx + 12, y + i * 28);
    ctx.font = '16px Georgia, serif';
  });
  return y + rows.length * 28;
}

function drawTitle(ctx, game, now) {
  dimScreen(ctx, 0.84);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  try { ctx.letterSpacing = '14px'; } catch { /* older canvas: no letterspacing */ }
  ctx.fillStyle = INK;
  ctx.font = 'bold 68px Georgia, serif';
  ctx.fillText('HUSHSTACK', VIEW.W / 2, 168);
  try { ctx.letterSpacing = '6px'; } catch { /* ignore */ }
  ctx.fillStyle = AMBER;
  ctx.font = '19px Georgia, serif';
  ctx.fillText('— THE NIGHT ARCHIVE —', VIEW.W / 2, 222);
  try { ctx.letterSpacing = '0px'; } catch { /* ignore */ }
  ctx.fillStyle = INK;
  ctx.font = '16.5px Georgia, serif';
  const story = [
    'The grand archive sleeps by candlelight, and the Lantern Wardens walk its stacks.',
    'Somewhere inside sits the Ember Atlas, a book of maps bound in ember.',
    'Take it from its pedestal and reach the exit — unseen.',
  ];
  story.forEach((line, i) => ctx.fillText(line, VIEW.W / 2, 286 + i * 26));
  ctx.fillStyle = AMBER;
  ctx.font = 'bold 16px Georgia, serif';
  ctx.fillText('◆ OBJECTIVE: Take the Ember Atlas, then reach the exit', VIEW.W / 2, 396);
  ctx.fillStyle = DIM;
  ctx.font = '15px Georgia, serif';
  const controls = [
    'WASD / arrows — move        SHIFT — sneak (silent)        SPACE — sprint (loud)',
    'E — take the Atlas        CLICK — throw a coin to draw a warden        ESC — pause',
    'Hide in the low book stacks. Lamplight betrays you; shadow keeps you.',
    'Three strikes and the night is lost.',
  ];
  controls.forEach((line, i) => ctx.fillText(line, VIEW.W / 2, 448 + i * 26));
  const pulse = 0.6 + 0.4 * Math.sin(now * 2.4);
  ctx.fillStyle = `rgba(255,190,85,${pulse})`;
  ctx.font = 'bold 22px Georgia, serif';
  ctx.fillText('PRESS ENTER TO BEGIN', VIEW.W / 2, 592);
  ctx.fillStyle = DIM;
  ctx.font = '13px Georgia, serif';
  ctx.fillText('Three floors · sound on, if you can — footsteps tell you where a warden walks', VIEW.W / 2, 640);
}

function drawPause(ctx) {
  dimScreen(ctx, 0.6);
  ctx.textAlign = 'center';
  ctx.fillStyle = INK;
  ctx.font = 'bold 40px Georgia, serif';
  ctx.fillText('PAUSED', VIEW.W / 2, VIEW.H / 2 - 20);
  ctx.fillStyle = DIM;
  ctx.font = '16px Georgia, serif';
  ctx.fillText('ESC — resume · R — restart this floor', VIEW.W / 2, VIEW.H / 2 + 26);
}

function drawComplete(ctx, game) {
  dimScreen(ctx, 0.62);
  const [x, y] = centerPanel(ctx, 480, 320);
  ctx.textAlign = 'center';
  ctx.fillStyle = TEAL;
  ctx.font = 'bold 32px Georgia, serif';
  ctx.fillText('FLOOR CLEARED', VIEW.W / 2, y + 52);
  ctx.fillStyle = DIM;
  ctx.font = '15px Georgia, serif';
  ctx.fillText(game.level.name, VIEW.W / 2, y + 82);
  const lootTotal = parseLevel(LEVEL_DEFS[game.levelIndex]).loot.length;
  const endY = overlayStats(ctx, VIEW.W / 2, y + 126, [
    ['Time', formatTime(game.time)],
    ['Loot', `${game.levelLoot} / ${lootTotal}`],
    ['Times spotted', String(game.spottedCount)],
    ['Strikes', String(game.strikes)],
  ]);
  ctx.textAlign = 'center';
  ctx.fillStyle = AMBER;
  ctx.font = 'bold 17px Georgia, serif';
  ctx.fillText('ENTER — descend to the next floor', VIEW.W / 2, endY + 26);
}

function drawCaught(ctx, game) {
  dimScreen(ctx, 0.7);
  const [x, y] = centerPanel(ctx, 500, 300);
  ctx.textAlign = 'center';
  ctx.fillStyle = RED;
  ctx.font = 'bold 32px Georgia, serif';
  ctx.fillText('CAUGHT IN THE LAMPLIGHT', VIEW.W / 2, y + 56);
  ctx.fillStyle = INK;
  ctx.font = '15.5px Georgia, serif';
  ctx.fillText('Three strikes. The wardens keep the Atlas another night.', VIEW.W / 2, y + 96);
  const endY = overlayStats(ctx, VIEW.W / 2, y + 136, [
    ['Floor reached', game.level.name],
    ['Times spotted', String(game.spottedCount)],
    ['Loot pocketed', String(game.bankedLoot + game.levelLoot)],
  ]);
  ctx.textAlign = 'center';
  ctx.fillStyle = AMBER;
  ctx.font = 'bold 17px Georgia, serif';
  ctx.fillText('ENTER — try this floor again', VIEW.W / 2, endY + 26);
}

function drawWin(ctx, game) {
  dimScreen(ctx, 0.66);
  const [x, y] = centerPanel(ctx, 500, 330);
  ctx.textAlign = 'center';
  ctx.fillStyle = AMBER;
  ctx.font = 'bold 34px Georgia, serif';
  ctx.fillText('THE ATLAS IS YOURS', VIEW.W / 2, y + 54);
  ctx.fillStyle = INK;
  ctx.font = '15.5px Georgia, serif';
  ctx.fillText('Out of the vault, past the wardens, into the night.', VIEW.W / 2, y + 88);
  const endY = overlayStats(ctx, VIEW.W / 2, y + 128, [
    ['Total time', formatTime(game.totalTime)],
    ['Loot', `${game.bankedLoot} / ${game.totalLoot}`],
    ['Times spotted', String(game.spottedCount)],
    ['Strikes', String(game.strikes)],
  ]);
  ctx.textAlign = 'center';
  ctx.fillStyle = AMBER;
  ctx.font = 'bold 17px Georgia, serif';
  ctx.fillText('ENTER — steal it all again', VIEW.W / 2, endY + 26);
}

// Header, panel and the screen overlays, drawn over render.js's world.
export function drawInterface(ctx, game, now) {
  if (game.screen === 'title') {
    drawTitle(ctx, game, now);
    return;
  }
  drawHeader(ctx, game);
  drawPanel(ctx, game);
  if (game.screen === 'paused') drawPause(ctx);
  else if (game.screen === 'complete') drawComplete(ctx, game);
  else if (game.screen === 'caught') drawCaught(ctx, game);
  else if (game.screen === 'win') drawWin(ctx, game);
}
