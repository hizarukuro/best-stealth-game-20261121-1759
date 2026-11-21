// player.js — the thief: WASD/arrow movement with sneak and sprint stances,
// sliding collision against shelves, hiding in low book stacks, taking the
// Ember Atlas with E, walking out the exit, collecting loot, and throwing
// coins with the mouse to pull a warden off his beat.

import { slideCircle, distance } from './geometry.js';
import { input, tileCenter, playerTile, takeAtlas, completeLevel } from './state.js';
import { sfx } from './audio.js';

let eWasDown = false;

export function makePlayer(game) {
  const [x, y] = tileCenter(game.level.start.tx, game.level.start.ty);
  return {
    x,
    y,
    r: game.tile * 0.27,
    facing: -Math.PI / 2,
    stance: 'walk', // walk | sneak | sprint
    moving: false,
    noiseR: 0, // how far this frame's footsteps carry, in pixels
    stepAcc: 0,
    coinCd: 0,
  };
}

const KEYMAP = [
  ['KeyW', 0, -1],
  ['ArrowUp', 0, -1],
  ['KeyS', 0, 1],
  ['ArrowDown', 0, 1],
  ['KeyA', -1, 0],
  ['ArrowLeft', -1, 0],
  ['KeyD', 1, 0],
  ['ArrowRight', 1, 0],
];

export function updatePlayer(game, dt) {
  const p = game.player;
  const tile = game.tile;
  let mx = 0;
  let my = 0;
  for (const [code, dx, dy] of KEYMAP) {
    if (input.keys.has(code)) {
      mx += dx;
      my += dy;
    }
  }
  const sneak = input.keys.has('ShiftLeft') || input.keys.has('ShiftRight');
  const sprint = input.keys.has('Space');
  p.stance = sneak ? 'sneak' : sprint ? 'sprint' : 'walk';
  const speedTiles = p.stance === 'sneak' ? 1.8 : p.stance === 'sprint' ? 5.0 : 3.1;
  p.moving = mx !== 0 || my !== 0;
  if (p.moving) {
    const len = Math.hypot(mx, my);
    const vx = (mx / len) * speedTiles * tile * dt;
    const vy = (my / len) * speedTiles * tile * dt;
    const [nx, ny] = slideCircle(p.x, p.y, p.r, vx, vy, game.solidRects);
    p.x = nx;
    p.y = ny;
    p.facing = Math.atan2(my, mx);
    // Footsteps: distance-based stride, stance sets the volume and the noise.
    p.stepAcc += Math.hypot(vx, vy);
    if (p.stepAcc > tile * 0.85) {
      p.stepAcc = 0;
      sfx.step(p.stance);
    }
    p.noiseR = p.stance === 'sprint' ? tile * 3.0 : p.stance === 'walk' ? tile * 1.0 : 0;
  } else {
    p.noiseR = 0;
  }

  // Interact: take the Atlas from its pedestal.
  const eDown = input.keys.has('KeyE');
  if (eDown && !eWasDown && !game.hasAtlas) {
    const [ax, ay] = tileCenter(game.level.atlas.tx, game.level.atlas.ty);
    if (distance(p.x, p.y, ax, ay) < tile * 1.45) takeAtlas();
  }
  eWasDown = eDown;

  // Loot: walk over an inkwell or coin stack to pocket it.
  const [ptx, pty] = playerTile();
  for (const item of game.level.loot) {
    if (item.taken) continue;
    const [ix, iy] = tileCenter(item.tx, item.ty);
    if (distance(p.x, p.y, ix, iy) < tile * 0.52) {
      item.taken = true;
      game.levelLoot += 1;
      sfx.pickup();
    }
  }

  // Exit: only once the Atlas is in hand.
  if (game.hasAtlas && ptx === game.level.exit.tx && pty === game.level.exit.ty) {
    completeLevel();
    return;
  }

  // Thrown coins: clicks queued by main.js, one per frame is plenty.
  if (p.coinCd > 0) p.coinCd -= dt;
  while (input.clicks.length) {
    const click = input.clicks.shift();
    if (game.screen !== 'play') continue;
    if (p.coinCd > 0) continue;
    throwCoin(game, click.x, click.y);
  }
}

// A coin lands where clicked (or as far as the throw carries) and rings:
// wardens within earshot come to look. The ring itself is a noise event.
export function throwCoin(game, clickX, clickY) {
  const p = game.player;
  const tile = game.tile;
  const maxThrow = tile * 8;
  let dx = clickX - p.x;
  let dy = clickY - p.y;
  const d = Math.hypot(dx, dy);
  if (d > maxThrow) {
    dx = (dx / d) * maxThrow;
    dy = (dy / d) * maxThrow;
  }
  const x = Math.min(Math.max(p.x + dx, game.ox + 8), game.ox + game.level.cols * tile - 8);
  const y = Math.min(Math.max(p.y + dy, game.oy + 8), game.oy + game.level.rows * tile - 8);
  game.noiseEvents.push({ x, y, t: 0, dur: 0.9, r: tile * 3.4, kind: 'coin', heardBy: new Set() });
  p.coinCd = 1.1;
  sfx.coin();
}

// Is the thief close enough to the pedestal for the E prompt to show?
export function nearAtlas(game) {
  if (game.hasAtlas || !game.player) return false;
  const [ax, ay] = tileCenter(game.level.atlas.tx, game.level.atlas.ty);
  return distance(game.player.x, game.player.y, ax, ay) < game.tile * 1.45;
}

export function playerOnExit(game) {
  const [tx, ty] = playerTile();
  return tx === game.level.exit.tx && ty === game.level.exit.ty && !game.hasAtlas;
}
