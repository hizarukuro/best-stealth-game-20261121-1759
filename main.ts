// HUSHSTACK: The Night Archive — hand-in program for our stealth game entry.
//
// Running this file delivers the finished entry in one pass. It takes the
// game's own folder, game/ — the plain static files the browser loads to play
// HUSHSTACK, a top-down night-time stealth game about slipping through a
// candle-lit archive unseen — together with the screenshots/ folder holding
// the four captures that show the game in play, and copies both of them,
// untouched, into the output directory the grader reads. It then writes one
// further file alongside them, dossier.json: the machine-made summary of the
// entry (its file listing, sizes and source text) that the judge works from,
// produced by the vendored make.fun library exactly as the kit prescribes.
// Nothing here transforms, rebuilds or generates any part of the game itself;
// the program only carries the entry from this repository to the grader and
// leaves the dossier as the receipt of what was handed in.

// A working best-game-01 entry (Node 22, standard library only): the game is this directory's
// game/ folder, plain static files a desktop browser loads offline (game/index.html and its ES
// modules, no library and no network request), and the program hands it in. It copies game/ and
// screenshots/ from beside this file to /output and writes /output/dossier.json, the summary the
// judge reads, with the vendored make.fun library. A starting point, not a winner: Block Dodger, a
// plain 2D canvas game where a paddle dodges falling blocks and catches coins, with a title screen,
// score, lives and levels, game over and restart, flat colours and no sound. Build your own game
// (any genre, any library you vendor under game/, or none), put your 3 or 4 PNG or JPEG screenshots
// in screenshots/ (the first by name is the cover) and run it.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

// One-line hand-in summary, printed once the dossier is on disk: walk the output
// directory, count every file that was delivered — the game tree, the screenshots
// and dossier.json itself — and report the tally under the entry's name.
import { readdirSync } from 'node:fs';

const handedInCount = readdirSync(out, { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile()).length;
console.log(`HUSHSTACK: The Night Archive - handed in ${handedInCount} files (game, screenshots and dossier.json).`);
