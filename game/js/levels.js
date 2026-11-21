// levels.js — the three floors of the Night Archive: tile maps, lamp and loot
// placement, and the Lantern Wardens' patrol beats. Pure data plus a parser.
//
// Tile legend:
//   #  tall shelf   — blocks movement and sight
//   =  low book stack — the thief can slip in and hide; wardens cannot enter,
//                       and it does not block sight
//   L  lamp stand   — a pool of lamplight (floor you can walk on)
//   A  the Ember Atlas on its pedestal (solid; take it with E beside it)
//   X  exit door    — walk out once the Atlas is taken
//   P  thief's entry point
//   *  loot         — an inkwell or coin stack, picked up by walking over it
//   .  bare floor

export const LEVEL_DEFS = [
  {
    name: '1 · THE READING ROOM',
    sub: 'Learn the dark. Two wardens, wide lanes, deep shadow.',
    grid: [
      '###################',
      '#....L........L...#',
      '#.##....##....##..#',
      '#.##....##....##..#',
      '#................*#',
      '#..====......====.#',
      '#..====..##..====.#',
      '#P.......##.....A.#',
      '#..====..##..====.#',
      '#..====......====.#',
      '#........**.......#',
      '#.##....##....##..#',
      '#....L........L.X.#',
      '###################',
    ],
    patrols: [
      { points: [[1, 1], [16, 1], [16, 4]], loop: false },
      { points: [[12, 7], [15, 7]], loop: false },
    ],
  },
  {
    name: '2 · THE LONG STACKS',
    sub: 'Long shelves, long memories. Three wardens walk the stacks.',
    grid: [
      '#######################',
      '#P...L..........L.....#',
      '#.##########....#####.#',
      '#..........#....#...#.#',
      '#..====....#....#.*.#.#',
      '#..====....#....#...#.#',
      '#..........#....##.##.#',
      '#....L.....#..........#',
      '#.##########..#####...#',
      '#..................##.#',
      '#..====...L....====...#',
      '#..====...........##..#',
      '#..====...#####.......#',
      '#........*.........#..#',
      '#.#####....####....#A.#',
      '#.....#....#..#....#..#',
      '#..*..#....#..#..L.#.X#',
      '#######################',
    ],
    patrols: [
      { points: [[21, 1], [21, 7], [17, 7]], loop: false },
      { points: [[2, 9], [17, 9]], loop: false },
      { points: [[16, 13], [16, 16], [18, 16], [18, 13]], loop: true },
    ],
  },
  {
    name: '3 · THE EMBER VAULT',
    sub: 'The Atlas sleeps behind a shelf-walled vault. Five wardens. One door.',
    grid: [
      '#######################',
      '#X...L..........L.....#',
      '#.####....####....###.#',
      '#.#..#....#..#....#.#.#',
      '#.#..#....#..#....#.#.#',
      '#..*......*.......#.#.#',
      '#............########.#',
      '#............#......#.#',
      '#..L.........#..##..#.#',
      '#...................#.#',
      '#............#.....A#.#',
      '#............########.#',
      '#..====...............#',
      '#..====....####....#..#',
      '#..====....#..#....#*.#',
      '#P.........#..#....#..#',
      '#....L.....####..L.#..#',
      '#######################',
    ],
    patrols: [
      { points: [[6, 1], [12, 1]], loop: false },
      { points: [[21, 2], [21, 12]], loop: false },
      { points: [[8, 5], [8, 12]], loop: false },
      { points: [[15, 7], [15, 10], [18, 10]], loop: false },
      { points: [[16, 13], [16, 15]], loop: false },
    ],
  },
];

// Parse one level definition into tile sets and object lists (tile coords).
export function parseLevel(def) {
  const rows = def.grid.length;
  const cols = def.grid[0].length;
  const walls = new Set();
  const cover = new Set();
  const lamps = [];
  const loot = [];
  let atlas = null;
  let exit = null;
  let start = null;
  for (let y = 0; y < rows; y++) {
    const row = def.grid[y];
    if (row.length !== cols) throw new Error(`level row ${y} has ${row.length} tiles, want ${cols}`);
    for (let x = 0; x < cols; x++) {
      const ch = row[x];
      const key = x + ',' + y;
      if (ch === '#') walls.add(key);
      else if (ch === '=') cover.add(key);
      else if (ch === 'L') lamps.push({ tx: x, ty: y });
      else if (ch === '*') loot.push({ tx: x, ty: y, taken: false });
      else if (ch === 'A') atlas = { tx: x, ty: y };
      else if (ch === 'X') exit = { tx: x, ty: y };
      else if (ch === 'P') start = { tx: x, ty: y };
      else if (ch !== '.') throw new Error(`unknown tile '${ch}' at ${x},${y}`);
    }
  }
  if (!atlas || !exit || !start) throw new Error('level needs P, A and X tiles');
  return {
    name: def.name,
    sub: def.sub,
    cols,
    rows,
    walls,
    cover,
    lamps,
    loot,
    atlas,
    exit,
    start,
    patrols: def.patrols,
  };
}

export function tileKey(tx, ty) {
  return tx + ',' + ty;
}
