import fs from "node:fs";
import path from "node:path";
import { SlippiGame } from "slp-parser-js";
import { elapsed, findPlayer, PEACH_INTERNAL_ID, RARE_ITEMS, scoreMoment, validComeback } from "./scoring.js";

const CHARACTER_NAMES = ["Captain Falcon","Donkey Kong","Fox","Mr. Game & Watch","Kirby","Bowser","Link","Luigi","Mario","Marth","Mewtwo","Ness","Peach","Pikachu","Ice Climbers","Jigglypuff","Samus","Yoshi","Zelda","Sheik","Falco","Young Link","Dr. Mario","Roy","Pichu","Ganondorf"];

function replayDate(filename) {
  const m = path.basename(filename).match(/Game_(\d{4})(\d{2})(\d{2})T/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
}

function listReplayFiles(root, maxFiles = 200) {
  const out = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith(".slp")) out.push(full);
    }
  }
  walk(root);
  return out.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs).slice(0, maxFiles);
}

function itemClusters(frames, playerIndex) {
  const active = new Map();
  const moments = [];
  for (const [frameKey, frame] of Object.entries(frames || {})) {
    const frameNo = Number(frameKey);
    const position = frame?.players?.[playerIndex]?.post?.position;
    if (!position) continue;
    for (const item of frame?.items || []) {
      if (!RARE_ITEMS.has(item.typeId) || !item.position) continue;
      const key = item.typeId;
      const prior = active.get(key);
      const distance = Math.hypot(item.position.x - position.x, item.position.y - position.y);
      if ((!prior || frameNo - prior > 45) && distance <= 12) {
        moments.push({ type: "rare-item", frame: frameNo, item: RARE_ITEMS.get(item.typeId), description: `${RARE_ITEMS.get(item.typeId)} pull` });
      }
      active.set(key, frameNo);
    }
  }
  return moments;
}

function turnipActionMoments(frames, playerIndex) {
  const moments = [];
  let last = -9999;
  for (const [frameKey, frame] of Object.entries(frames || {})) {
    const frameNo = Number(frameKey);
    const peach = frame?.players?.[playerIndex];
    if (!peach) continue;
    const nearbyTurnip = (frame.items || []).some(item => item.typeId === 99 && item.position && peach.post?.position && Math.hypot(item.position.x - peach.post.position.x, item.position.y - peach.post.position.y) < 16);
    if (nearbyTurnip && frameNo - last > 240) {
      moments.push({ type: "turnip-action", frame: frameNo, description: "Turnip pressure sequence" });
      last = frameNo;
    }
  }
  return moments;
}

export function scanReplay(file, options) {
  const game = new SlippiGame(file);
  const settings = game.getSettings();
  const metadata = game.getMetadata();
  const player = findPlayer(metadata, settings, options.code, options.tags);
  if (!player) return { file, excluded: "player-not-found" };
  const opponent = (settings.players || []).find(p => p.playerIndex !== player.playerIndex);
  if (player.characterId !== PEACH_INTERNAL_ID) {
    return { file, nonPeach: true, character: CHARACTER_NAMES[player.characterId] || `ID ${player.characterId}` };
  }
  if (!opponent || (opponent.type === 1 && !metadata?.players?.[opponent.playerIndex]?.names?.code)) return { file, excluded: "cpu-or-unidentified-opponent" };

  const stats = game.getStats();
  const gameEnd = game.getGameEnd();
  const frames = game.getFrames();
  const duration = Math.max(0, Number(metadata?.lastFrame || 0) / 60);
  if (duration < 30) return { file, excluded: "under-30-seconds" };
  if (gameEnd?.gameEndMethod === 7) return { file, excluded: "quit-out" };

  const conversions = (stats?.conversions || []).filter(c => c.playerIndex === player.playerIndex);
  const opponentStocks = (stats?.stocks || []).filter(s => s.playerIndex === opponent.playerIndex && s.endFrame != null);
  const playerStocks = (stats?.stocks || []).filter(s => s.playerIndex === player.playerIndex && s.endFrame != null);
  const allStocks = stats?.stocks || [];
  const finalFrame = Number(metadata?.lastFrame || 0);
  const moments = [];

  for (const c of conversions) {
    const damage = Math.max(0, Number(c.endPercent || 0) - Number(c.startPercent || 0));
    const hits = (c.moves || []).reduce((n, m) => n + Number(m.hitCount || 1), 0);
    if (c.didKill || damage >= 35 || hits >= 5) {
      moments.push({
        type: c.didKill ? "kill-sequence" : "combo",
        frame: c.startFrame,
        endFrame: c.endFrame,
        damage,
        hits,
        didKill: Boolean(c.didKill),
        gameEnding: Boolean(c.didKill && finalFrame - Number(c.endFrame || 0) < 180),
        description: `${hits}-hit, ${Math.round(damage)}% ${c.didKill ? "kill sequence" : "combo"}`
      });
    }
  }
  moments.push(...itemClusters(frames, player.playerIndex));
  moments.push(...turnipActionMoments(frames, player.playerIndex));

  const won = opponentStocks.length >= 4 && playerStocks.length < 4;
  const comebackEligible = won && validComeback(opponentStocks, conversions);
  for (const m of moments) {
    if (comebackEligible && m.gameEnding) m.description += " to close a verified comeback";
    m.elapsed = elapsed(m.frame);
    m.score = scoreMoment(m, replayDate(file));
  }

  const suspiciousDeaths = opponentStocks.filter(s => Number(s.endPercent || 0) < 35 && !conversions.some(c => c.didKill && Math.abs(Number(c.endFrame || 0) - Number(s.endFrame || 0)) <= 180));
  if (suspiciousDeaths.length >= 2 && moments.length <= 1) return { file, excluded: "self-destruct-or-statless-game" };

  return {
    file,
    filename: path.basename(file),
    date: replayDate(file),
    peach: true,
    playerTag: player.names?.netplay || "",
    opponentCharacter: CHARACTER_NAMES[opponent.characterId] || `ID ${opponent.characterId}`,
    duration: elapsed(finalFrame),
    comebackEligible,
    moments: moments.sort((a, b) => b.score - a.score)
  };
}

export function scanDirectory(root, options) {
  const results = listReplayFiles(root, options.maxFiles).map(file => {
    try { return scanReplay(file, options); }
    catch (error) { return { file, error: error.message }; }
  });
  const nonPeach = results.filter(r => r.nonPeach).map(r => ({ filename: path.basename(r.file), character: r.character }));
  const moments = results.flatMap(r => (r.moments || []).map(m => ({ ...m, filename: r.filename, opponentCharacter: r.opponentCharacter, date: r.date })))
    .sort((a, b) => b.score - a.score).slice(0, options.top);
  return { scanned: results.length, qualifyingGames: results.filter(r => r.peach).length, moments, nonPeach, exclusions: results.filter(r => r.excluded || r.error) };
}
