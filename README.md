# Slippi Peach Highlight Scanner

A local Node.js CLI that parses Super Smash Bros. Melee `.slp` replay files and ranks clip-worthy moments from a selected player's Peach games.

It looks for:

- high-damage and high-hit combos
- kill sequences and game-ending plays
- rare item pulls and turnip action
- comeback finishes

The scoring includes checks for low-percent, unforced opponent stock losses so intentional self-destructs do not earn comeback credit. It also filters short games, quit-outs, CPU or unidentified opponents, and obvious self-destruct or statless games. Timestamps are elapsed from the start of each replay.

## Install

Requires Node.js 18 or newer and your own legally obtained replay files.

```sh
npm install
```

The parser dependency is pinned to `slp-parser-js@4.1.0`.

## Run

```sh
node src/cli.js /path/to/Slippi \
  --code 'YOUR#CODE' \
  --tag 'optional display tag' \
  --top 10 \
  --max-files 200 \
  --json highlights.json
```

`--tag` can be repeated. A connect code is more reliable because tags can change. The input directory is walked recursively, and files are ordered by local modified time before the `--max-files` limit is applied.

The JSON report contains ranked moments, non-Peach picks, and exclusions or parse errors. It does not upload replay files or include replay contents in its output.

## Test

```sh
npm test
```
