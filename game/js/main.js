// main.js — boot and the game loop: canvas, keyboard and mouse input, the
// screen flow keys (ENTER to start/advance, ESC to pause, R to retry), and
// the per-frame update order — thief, wardens, then the state's own timers.
// A ?shot=N query poses a still scene of the real game for screenshots.

import {
  VIEW,
  game,
  input,
  loadLevel,
  startGame,
  nextLevel,
  retryLevel,
  updateGame,
  tileCenter,
} from './state.js';
import { makePlayer, updatePlayer } from './player.js';
import { makeGuards, updateGuards } from './guards.js';
import { drawWorld } from './render.js';
import { drawInterface, detectionState } from './hud.js';
import { ensureAudio } from './audio.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

game.factories = { makePlayer, makeGuards };
loadLevel(0); // the Reading Room sits behind the title screen
game.screen = 'title';

// ---------------------------------------------------------------- input ---
window.addEventListener('keydown', (e) => {
  ensureAudio();
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  input.keys.add(e.code);
  if (e.repeat) return;
  if (e.code === 'Enter') {
    if (game.screen === 'title' || game.screen === 'win') startGame();
    else if (game.screen === 'complete') nextLevel();
    else if (game.screen === 'caught') retryLevel();
  } else if (e.code === 'Escape') {
    if (game.screen === 'play') game.screen = 'paused';
    else if (game.screen === 'paused') game.screen = 'play';
  } else if (e.code === 'KeyR') {
    if (game.screen === 'play' || game.screen === 'paused' || game.screen === 'caught') retryLevel();
  }
});
window.addEventListener('keyup', (e) => input.keys.delete(e.code));
window.addEventListener('blur', () => input.keys.clear());
canvas.addEventListener('mousedown', (e) => {
  ensureAudio();
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (VIEW.W / rect.width);
  const y = (e.clientY - rect.top) * (VIEW.H / rect.height);
  input.clicks.push({ x, y });
});

// ------------------------------------------------------- screenshot poses ---
// ?shot=title | 1 | 2 | 3 — poses the shipped game in a still scene so its
// maker can photograph it. Harmless in play: no parameter, no posing.
function applyShotPose(shot) {
  game.shotMode = true;
  if (shot === 'title') {
    game.screen = 'title';
    return;
  }
  game.screen = 'play';
  if (shot === '1') {
    // The Ember Vault, late: Atlas in hand, the long way back to the exit.
    loadLevel(2);
    game.hasAtlas = true;
    game.levelLoot = 1;
    game.level.loot[0].taken = true;
    game.time = 83;
    const [px, py] = tileCenter(10, 12);
    game.player.x = px;
    game.player.y = py;
    game.player.facing = -0.5;
    const [gx, gy] = tileCenter(21, 6);
    game.guards[1].x = gx;
    game.guards[1].y = gy;
    game.guards[1].facing = Math.PI / 2;
    const [vx, vy] = tileCenter(18, 9);
    game.guards[3].x = vx;
    game.guards[3].y = vy;
    game.guards[3].facing = Math.PI;
  } else if (shot === '2') {
    // The Reading Room: hidden in a low stack while a cone sweeps past.
    loadLevel(0);
    game.time = 47;
    const [px, py] = tileCenter(6, 6);
    game.player.x = px;
    game.player.y = py;
    game.player.facing = 0.4;
    const [gx, gy] = tileCenter(10, 4);
    game.guards[1].x = gx;
    game.guards[1].y = gy;
    game.guards[1].facing = Math.PI - 0.46;
  } else if (shot === '3') {
    // The Long Stacks: a thrown coin has pulled a warden off his beat.
    loadLevel(1);
    game.time = 132;
    game.spottedCount = 1;
    const [px, py] = tileCenter(5, 10);
    game.player.x = px;
    game.player.y = py;
    game.player.facing = 0.3;
    const guard = game.guards[1];
    const [gx, gy] = tileCenter(11, 9);
    guard.x = gx;
    guard.y = gy;
    guard.facing = 0;
    guard.mode = 'investigate';
    const [tx, ty] = tileCenter(14, 9);
    guard.target = { x: tx, y: ty };
    guard.awareness = 0.62;
    guard.speech = 'WHAT WAS THAT?';
    guard.speechT = 1.5;
    game.noiseEvents.push({ x: tx, y: ty, t: 0.4, dur: 0.9, r: game.tile * 3.4, kind: 'coin', heardBy: new Set([1]) });
  }
}

const shotParam = new URLSearchParams(location.search).get('shot');
if (shotParam) applyShotPose(shotParam);

// A small handle for the maker's own play-tests: the live state, plus a
// one-line summary of where everything stands.
game.snapshot = () => ({
  screen: game.screen,
  level: game.levelIndex,
  hasAtlas: game.hasAtlas,
  strikes: game.strikes,
  spotted: game.spottedCount,
  loot: game.bankedLoot + game.levelLoot,
  player: game.player ? { x: Math.round(game.player.x), y: Math.round(game.player.y) } : null,
  guards: game.guards.map((g) => ({
    mode: g.mode,
    awareness: Math.round(g.awareness * 100) / 100,
    x: Math.round(g.x),
    y: Math.round(g.y),
  })),
});
window.__hush = game;

// ----------------------------------------------------------------- loop ---
let last = performance.now();
let lastStatus = '';
function frame(nowMs) {
  requestAnimationFrame(frame);
  let dt = (nowMs - last) / 1000;
  last = nowMs;
  if (dt > 0.033) dt = 0.033;
  if (!game.shotMode && game.screen === 'play') {
    updatePlayer(game, dt);
    if (game.screen === 'play') updateGuards(game, dt);
    if (game.screen === 'play') updateGame(dt);
  }
  drawWorld(ctx, game);
  drawInterface(ctx, game, nowMs / 1000);
  const label = game.screen === 'play' ? detectionState(game).label : game.screen;
  if (label !== lastStatus && statusEl) {
    lastStatus = label;
    statusEl.textContent = `Hushstack: ${label}`;
  }
}
requestAnimationFrame(frame);
