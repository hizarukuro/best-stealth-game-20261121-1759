// guards.js — the Lantern Wardens: waypoint patrols, raycast vision cones,
// a detection meter that fills while the thief is seen (faster in lamplight,
// slower in shadow, never while hidden in the stacks) and cools when he is
// not, investigation of noises and glimpses, and pursuit once he is spotted.

import { angleDelta, clamp, distance, lineOfSightBlocked, slideCircle } from './geometry.js';
import { tileCenter, playerHidden, playerLight, onSpotted, registerStrike } from './state.js';
import { sfx } from './audio.js';

const SPEEDS = { patrol: 1.5, investigate: 2.3, return: 2.0, pursue: 3.7 }; // tiles/second

export function makeGuards(game) {
  const tile = game.tile;
  // Wardens are blocked by everything the thief is, plus the low stacks.
  const coverRects = [];
  for (const key of game.level.cover) {
    const [tx, ty] = key.split(',').map(Number);
    coverRects.push({ x: game.ox + tx * tile, y: game.oy + ty * tile, w: tile, h: tile });
  }
  game.guardSolids = game.solidRects.concat(coverRects);
  return game.level.patrols.map((patrol, i) => {
    const [sx, sy] = tileCenter(patrol.points[0][0], patrol.points[0][1]);
    const [nx, ny] = tileCenter(patrol.points[1][0], patrol.points[1][1]);
    return {
      id: i,
      x: sx,
      y: sy,
      r: tile * 0.3,
      patrol,
      wpIndex: 1,
      dirSign: 1,
      facing: Math.atan2(ny - sy, nx - sx),
      awareness: 0, // 0 calm .. 1 spotted
      mode: 'patrol', // patrol | investigate | return | pursue
      target: null, // {x, y} being investigated
      lastSeen: null, // {x, y} the thief was last visible
      lookT: 0,
      scanBase: 0,
      scanClock: 0,
      alerted: false, // has already raised this spotted episode
      heardCd: 0,
      glimpseCd: 0,
      speech: '',
      speechT: 0,
      stepAcc: 0,
    };
  });
}

export function visionRange(game) {
  return game.tile * 5.0;
}

export function visionHalfAngle() {
  return 0.59; // ~34 degrees each side of the facing
}

// Can this warden see the thief right now? Cone, range, shelf occlusion,
// and the stacks hide the thief completely unless the warden is on top of him.
export function canSee(game, guard) {
  const p = game.player;
  const tile = game.tile;
  const d = distance(guard.x, guard.y, p.x, p.y);
  if (d > visionRange(game)) return false;
  const hidden = playerHidden();
  if (hidden && d > tile * 0.9) return false;
  if (!hidden && d < tile * 0.7) {
    // Close enough to feel a shoulder brush past, cone or no cone.
    return !lineOfSightBlocked(guard.x, guard.y, p.x, p.y, game.wallRects);
  }
  const ang = Math.atan2(p.y - guard.y, p.x - guard.x);
  if (Math.abs(angleDelta(ang, guard.facing)) > visionHalfAngle()) return false;
  return !lineOfSightBlocked(guard.x, guard.y, p.x, p.y, game.wallRects);
}

// How fast awareness fills while the thief is in view: near is fast, the
// edge of the lantern light is slow, and stance and light bend the rate.
function fillRate(game, guard) {
  const p = game.player;
  const tile = game.tile;
  const d = distance(guard.x, guard.y, p.x, p.y);
  const near = tile * 1.2;
  const far = visionRange(game);
  let rate = 1.6 + (0.32 - 1.6) * clamp((d - near) / (far - near), 0, 1);
  rate *= playerLight() === 'lamp' ? 1.55 : 0.6;
  if (p.stance === 'sneak') rate *= 0.75;
  else if (p.stance === 'sprint') rate *= 1.3;
  if (!p.moving) rate *= 0.9;
  return rate;
}

function startInvestigate(game, guard, x, y, why) {
  guard.mode = 'investigate';
  guard.target = { x, y };
  guard.lookT = 0;
  if (why === 'sound') guard.speech = 'FOOTSTEPS!';
  else guard.speech = 'WHAT WAS THAT?';
  guard.speechT = 1.5;
  if (why === 'glimpse') sfx.glimpse();
}

function moveToward(game, guard, tx, ty, speedTiles, dt) {
  const dx = tx - guard.x;
  const dy = ty - guard.y;
  const d = Math.hypot(dx, dy);
  if (d < 4) return true;
  const step = Math.min(d, speedTiles * game.tile * dt);
  const vx = (dx / d) * step;
  const vy = (dy / d) * step;
  const [nx, ny] = slideCircle(guard.x, guard.y, guard.r, vx, vy, game.guardSolids);
  guard.x = nx;
  guard.y = ny;
  turnToward(guard, Math.atan2(dy, dx), dt, guard.mode === 'pursue' ? 9 : 6);
  // Lantern-wardens' boots: audible up close, a warning in themselves.
  guard.stepAcc += step;
  if (guard.stepAcc > game.tile * 0.9) {
    guard.stepAcc = 0;
    const pd = distance(guard.x, guard.y, game.player.x, game.player.y);
    const vol = clamp(1 - pd / (game.tile * 9), 0, 1);
    if (vol > 0.04) sfx.guardStep(vol);
  }
  return d <= Math.max(6, step + 2);
}

function turnToward(guard, targetAngle, dt, rate) {
  const d = angleDelta(targetAngle, guard.facing);
  const maxTurn = rate * dt;
  guard.facing += clamp(d, -maxTurn, maxTurn);
}

function patrolTarget(game, guard) {
  const [tx, ty] = guard.patrol.points[guard.wpIndex];
  return tileCenter(tx, ty);
}

function advanceWaypoint(guard) {
  const n = guard.patrol.points.length;
  if (guard.patrol.loop) {
    guard.wpIndex = (guard.wpIndex + 1) % n;
  } else {
    guard.wpIndex += guard.dirSign;
    if (guard.wpIndex >= n - 1) {
      guard.wpIndex = n - 1;
      guard.dirSign = -1;
    } else if (guard.wpIndex <= 0) {
      guard.wpIndex = 0;
      guard.dirSign = 1;
    }
  }
}

function sensePlayer(game, guard, dt) {
  const seen = canSee(game, guard);
  if (guard.heardCd > 0) guard.heardCd -= dt;
  if (guard.glimpseCd > 0) guard.glimpseCd -= dt;
  if (seen) {
    guard.lastSeen = { x: game.player.x, y: game.player.y };
    const was = guard.awareness;
    guard.awareness = clamp(guard.awareness + fillRate(game, guard) * dt, 0, 1);
    if (guard.awareness >= 1) {
      if (guard.mode !== 'pursue') {
        guard.mode = 'pursue';
        guard.speech = 'THERE!';
        guard.speechT = 1.2;
        if (!guard.alerted) {
          guard.alerted = true;
          onSpotted();
        }
      }
    } else if (
      was < 0.45 &&
      guard.awareness >= 0.45 &&
      (guard.mode === 'patrol' || guard.mode === 'return') &&
      guard.glimpseCd <= 0
    ) {
      guard.glimpseCd = 2.5;
      startInvestigate(game, guard, guard.lastSeen.x, guard.lastSeen.y, 'glimpse');
    }
  } else {
    guard.awareness = clamp(guard.awareness - dt * 0.28, 0, 1);
    if (guard.alerted && guard.awareness < 0.15) guard.alerted = false;
    if (guard.mode === 'pursue' && guard.lastSeen) {
      guard.mode = 'investigate';
      guard.target = { ...guard.lastSeen };
      guard.lookT = 0;
      guard.awareness = Math.max(guard.awareness, 0.55);
    }
  }
  return seen;
}

function hearNoises(game, guard) {
  const p = game.player;
  for (const ev of game.noiseEvents) {
    if (ev.kind !== 'coin' || ev.heardBy.has(guard.id)) continue;
    if (distance(guard.x, guard.y, ev.x, ev.y) < ev.r) {
      ev.heardBy.add(guard.id);
      if (guard.mode === 'patrol' || guard.mode === 'return') {
        startInvestigate(game, guard, ev.x, ev.y, 'coin');
      }
    }
  }
  if (
    p.noiseR > 0 &&
    guard.heardCd <= 0 &&
    (guard.mode === 'patrol' || guard.mode === 'return') &&
    distance(guard.x, guard.y, p.x, p.y) < p.noiseR
  ) {
    guard.heardCd = 2.5;
    startInvestigate(game, guard, p.x, p.y, 'sound');
  }
}

export function updateGuards(game, dt) {
  for (const guard of game.guards) {
    if (guard.speechT > 0) guard.speechT -= dt;
    const seen = sensePlayer(game, guard, dt);
    if (game.screen !== 'play') return; // a strike may have ended the chase
    hearNoises(game, guard);

    if (guard.mode === 'patrol') {
      const [tx, ty] = patrolTarget(game, guard);
      if (moveToward(game, guard, tx, ty, SPEEDS.patrol, dt)) advanceWaypoint(guard);
    } else if (guard.mode === 'investigate') {
      if (guard.lookT > 0) {
        guard.lookT -= dt;
        guard.scanClock += dt;
        guard.facing = guard.scanBase + Math.sin(guard.scanClock * 1.5) * 0.75;
        if (guard.lookT <= 0) guard.mode = 'return';
      } else if (guard.target && moveToward(game, guard, guard.target.x, guard.target.y, SPEEDS.investigate, dt)) {
        guard.lookT = 1.6;
        guard.scanBase = guard.facing;
        guard.scanClock = 0;
      }
    } else if (guard.mode === 'return') {
      // Head back to the nearest beat point, then resume the patrol.
      let best = 0;
      let bestD = Infinity;
      guard.patrol.points.forEach(([tx, ty], i) => {
        const [px, py] = tileCenter(tx, ty);
        const d = distance(guard.x, guard.y, px, py);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      const [tx, ty] = tileCenter(guard.patrol.points[best][0], guard.patrol.points[best][1]);
      if (moveToward(game, guard, tx, ty, SPEEDS.return, dt)) {
        guard.wpIndex = best;
        guard.mode = 'patrol';
        advanceWaypoint(guard);
      }
    } else if (guard.mode === 'pursue') {
      const target = seen ? { x: game.player.x, y: game.player.y } : guard.lastSeen;
      if (target) moveToward(game, guard, target.x, target.y, SPEEDS.pursue, dt);
      const d = distance(guard.x, guard.y, game.player.x, game.player.y);
      if (d < guard.r + game.player.r + 2) {
        registerStrike();
        return;
      }
    }
  }
}
