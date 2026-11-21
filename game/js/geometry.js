// geometry.js — small 2D helpers: segment/rectangle tests, line of sight and
// vision-cone raycasting against the level's tall shelves. Pure math, no state.

// Shortest angle difference between two headings, in (-PI, PI].
export function angleDelta(a, b) {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function distance(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

// Does segment (x1,y1)-(x2,y2) touch or cross axis-aligned rect {x,y,w,h}?
// Slab test: find the segment's parameter range inside the rect.
export function segmentHitsRect(x1, y1, x2, y2, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let t0 = 0;
  let t1 = 1;
  if (Math.abs(dx) < 1e-9) {
    if (x1 < r.x || x1 > r.x + r.w) return false;
  } else {
    let ta = (r.x - x1) / dx;
    let tb = (r.x + r.w - x1) / dx;
    if (ta > tb) { const t = ta; ta = tb; tb = t; }
    t0 = Math.max(t0, ta);
    t1 = Math.min(t1, tb);
    if (t0 > t1) return false;
  }
  if (Math.abs(dy) < 1e-9) {
    if (y1 < r.y || y1 > r.y + r.h) return false;
  } else {
    let ta = (r.y - y1) / dy;
    let tb = (r.y + r.h - y1) / dy;
    if (ta > tb) { const t = ta; ta = tb; tb = t; }
    t0 = Math.max(t0, ta);
    t1 = Math.min(t1, tb);
    if (t0 > t1) return false;
  }
  return true;
}

// Line of sight between two points: blocked when any wall rect crosses the
// segment. A tiny inset keeps a guard standing beside a shelf from being
// blinded by the shelf face it is next to.
export function lineOfSightBlocked(x1, y1, x2, y2, wallRects) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return false;
  const inset = Math.min(6, len * 0.2);
  const ux = (dx / len) * inset;
  const uy = (dy / len) * inset;
  const ax = x1 + ux;
  const ay = y1 + uy;
  const bx = x2 - ux;
  const by = y2 - uy;
  for (const r of wallRects) {
    if (segmentHitsRect(ax, ay, bx, by, r)) return true;
  }
  return false;
}

// Cast one ray from (x, y) along `angle`; return the distance to the nearest
// wall rect, capped at maxDist. Ray vs AABB slab test per rect.
export function castRay(x, y, angle, wallRects, maxDist) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  let best = maxDist;
  for (const r of wallRects) {
    let tmin = 0;
    let tmax = best;
    if (Math.abs(dx) < 1e-9) {
      if (x < r.x || x > r.x + r.w) continue;
    } else {
      let ta = (r.x - x) / dx;
      let tb = (r.x + r.w - x) / dx;
      if (ta > tb) { const t = ta; ta = tb; tb = t; }
      tmin = Math.max(tmin, ta);
      tmax = Math.min(tmax, tb);
      if (tmin > tmax) continue;
    }
    if (Math.abs(dy) < 1e-9) {
      if (y < r.y || y > r.y + r.h) continue;
    } else {
      let ta = (r.y - y) / dy;
      let tb = (r.y + r.h - y) / dy;
      if (ta > tb) { const t = ta; ta = tb; tb = t; }
      tmin = Math.max(tmin, ta);
      tmax = Math.min(tmax, tb);
      if (tmin > tmax) continue;
    }
    if (tmin > 0.01 && tmin < best) best = tmin;
  }
  return best;
}

// The visible polygon of a vision cone: fan of rays across the cone's arc,
// each stopped by the nearest shelf. Points are canvas coordinates.
export function conePolygon(x, y, facing, halfAngle, range, wallRects) {
  const steps = 26;
  const pts = [[x, y]];
  for (let i = 0; i <= steps; i++) {
    const a = facing - halfAngle + (2 * halfAngle * i) / steps;
    const d = castRay(x, y, a, wallRects, range);
    pts.push([x + Math.cos(a) * d, y + Math.sin(a) * d]);
  }
  return pts;
}

// Move a circle (cx, cy, radius) by (dx, dy), sliding along wall rects.
// Resolves axis by axis so actors slip around shelf corners instead of
// sticking on them. Returns the new [x, y].
export function slideCircle(cx, cy, radius, dx, dy, wallRects) {
  let nx = cx + dx;
  for (const r of wallRects) {
    if (nx + radius > r.x && nx - radius < r.x + r.w && cy + radius > r.y && cy - radius < r.y + r.h) {
      nx = dx > 0 ? r.x - radius : r.x + r.w + radius;
    }
  }
  let ny = cy + dy;
  for (const r of wallRects) {
    if (nx + radius > r.x && nx - radius < r.x + r.w && ny + radius > r.y && ny - radius < r.y + r.h) {
      ny = dy > 0 ? r.y - radius : r.y + r.h + radius;
    }
  }
  return [nx, ny];
}
