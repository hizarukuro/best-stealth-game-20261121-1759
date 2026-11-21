// state.js — the whole game state and the flow between its screens: title,
// play, pause, level complete, caught and the win. Also the canvas layout,
// the loaded level's geometry (tile size, wall rectangles, lamp pools) and
// the shared input queues that main.js fills and player.js reads.

import { LEVEL_DEFS, parseLevel, tileKey } from './levels.js';
import { sfx } from './audio.js';

export const VIEW = {
  W: 1280,
  H: 800,
  HEADER: 56,
  PLAY_X: 8,
  PLAY_Y: 64,
  PLAY_W: 918,
  PLAY_H: 726,
  PANEL_X: 938,
  PANEL_W: 334,
};

export const input = {
  keys: new Set(),
  clicks: [],
};

export const game = {
  screen: 'title', // title | play | paused | complete | caught | win
  levelIndex: 0,
  level: null, // parsed level def (tile data)
  tile: 40,
  ox: 0,
  oy: 0,
  wallRects: [], // tall shelves: block sight and movement
  solidRects: [], // wallRects + the Atlas pedestal: block movement only
  lampPts: [], // {x, y, r} in pixels
  player: null,
  guards: [],
  hasAtlas: false,
  time: 0, // seconds in this level
  totalTime: 0, // seconds across finished levels
  strikes: 0,
  levelLoot: 0,
  bankedLoot: 0,
  totalLoot: 0,
  spottedCount: 0,
  alarm: 0, // 0..1, drives the ALARM meter
  noiseEvents: [], // {x, y, t, dur, r, kind, heardBy:Set}
  message: '',
  messageT: 0,
  shotMode: false,
  factories: null, // {makePlayer, makeGuards} supplied by main.js
};

export function tileCenter(tx, ty) {
  return [game.ox + (tx + 0.5) * game.tile, game.oy + (ty + 0.5) * game.tile];
}

export function tileAtPixel(x, y) {
  return [Math.floor((x - game.ox) / game.tile), Math.floor((y - game.oy) / game.tile)];
}

export function playerTile() {
  if (!game.player) return [-1, -1];
  return tileAtPixel(game.player.x, game.player.y);
}

export function playerHidden() {
  const [tx, ty] = playerTile();
  return game.level.cover.has(tileKey(tx, ty));
}

// 'lamp' inside a lamp's pool, else 'shadow'. Hiding overrides this in the HUD.
export function playerLight() {
  if (!game.player) return 'shadow';
  for (const l of game.lampPts) {
    const d = Math.hypot(game.player.x - l.x, game.player.y - l.y);
    if (d < l.r) return 'lamp';
  }
  return 'shadow';
}

export function say(text, seconds = 3) {
  game.message = text;
  game.messageT = seconds;
}

// Load (or reload) level `index`: geometry, lamps, fresh loot, entities.
export function loadLevel(index) {
  game.levelIndex = index;
  const level = parseLevel(LEVEL_DEFS[index]);
  game.level = level;
  if (!game.totalLoot) {
    game.totalLoot = LEVEL_DEFS.reduce((n, d) => n + parseLevel(d).loot.length, 0);
  }
  const tile = Math.floor(Math.min(VIEW.PLAY_W / level.cols, VIEW.PLAY_H / level.rows));
  game.tile = tile;
  game.ox = VIEW.PLAY_X + Math.floor((VIEW.PLAY_W - tile * level.cols) / 2);
  game.oy = VIEW.PLAY_Y + Math.floor((VIEW.PLAY_H - tile * level.rows) / 2);
  game.wallRects = [];
  for (const key of level.walls) {
    const [tx, ty] = key.split(',').map(Number);
    game.wallRects.push({ x: game.ox + tx * tile, y: game.oy + ty * tile, w: tile, h: tile, tx, ty });
  }
  const [ax, ay] = tileCenter(level.atlas.tx, level.atlas.ty);
  game.solidRects = game.wallRects.concat([
    { x: ax - tile * 0.42, y: ay - tile * 0.42, w: tile * 0.84, h: tile * 0.84 },
  ]);
  game.lampPts = level.lamps.map((l) => {
    const [x, y] = tileCenter(l.tx, l.ty);
    return { x, y, r: tile * 2.55 };
  });
  game.hasAtlas = false;
  game.time = 0;
  game.levelLoot = 0;
  game.alarm = 0;
  game.noiseEvents = [];
  game.message = '';
  game.messageT = 0;
  if (game.factories) {
    game.player = game.factories.makePlayer(game);
    game.guards = game.factories.makeGuards(game);
  }
}

export function startGame() {
  game.strikes = 0;
  game.totalTime = 0;
  game.bankedLoot = 0;
  game.totalLoot = LEVEL_DEFS.reduce((n, d) => n + parseLevel(d).loot.length, 0);
  game.spottedCount = 0;
  loadLevel(0);
  game.screen = 'play';
  say('Take the Ember Atlas, then reach the exit unseen.', 4);
}

// A warden's awareness reached full: the alarm is up and the count grows.
export function onSpotted() {
  game.spottedCount += 1;
  game.alarm = 1;
  sfx.alert();
  say('SPOTTED! Break line of sight!', 2.5);
}

// A pursuing warden laid a hand on the thief.
export function registerStrike() {
  game.strikes += 1;
  sfx.caught();
  if (game.strikes >= 3) {
    game.screen = 'caught';
    return;
  }
  say(`Caught! The wardens drag you back to the door. Strike ${game.strikes} of 3.`, 3.5);
  if (game.factories) {
    game.player = game.factories.makePlayer(game);
    game.guards = game.factories.makeGuards(game);
  }
  game.alarm = 0.25;
}

export function takeAtlas() {
  game.hasAtlas = true;
  sfx.takeAtlas();
  say('The Ember Atlas is yours. Now reach the exit.', 3.5);
}

export function completeLevel() {
  game.bankedLoot += game.levelLoot;
  game.totalTime += game.time;
  if (game.levelIndex >= LEVEL_DEFS.length - 1) {
    game.screen = 'win';
    sfx.win();
  } else {
    game.screen = 'complete';
    sfx.levelDone();
  }
}

export function nextLevel() {
  loadLevel(game.levelIndex + 1);
  game.screen = 'play';
  say(game.level.sub, 3.5);
}

export function retryLevel() {
  game.strikes = 0;
  loadLevel(game.levelIndex);
  game.screen = 'play';
  say('Once more, quieter.', 2.5);
}

// Per-frame bookkeeping that belongs to no single actor: timers, the alarm's
// slow cooling, and noise rings living out their short lives.
export function updateGame(dt) {
  game.time += dt;
  if (game.messageT > 0) game.messageT -= dt;
  let anyAlert = false;
  let maxAware = 0;
  for (const g of game.guards) {
    if (g.mode === 'pursue') anyAlert = true;
    if (g.awareness > maxAware) maxAware = g.awareness;
  }
  const target = anyAlert ? 1 : maxAware * 0.65;
  if (game.alarm < target) game.alarm = Math.min(target, game.alarm + dt * 1.8);
  else game.alarm = Math.max(target, game.alarm - dt * 0.07);
  for (const n of game.noiseEvents) n.t += dt;
  game.noiseEvents = game.noiseEvents.filter((n) => n.t < n.dur);
}
