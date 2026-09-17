export const FPS = 60;
export const PEACH_INTERNAL_ID = 12;
export const RARE_ITEMS = new Map([
  [6, "Bob-omb"],
  [7, "Mr. Saturn"],
  [12, "Beam Sword"],
]);

export function elapsed(frame) {
  const seconds = Math.max(0, Math.floor(Number(frame || 0) / FPS));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function normalized(value) {
  return String(value || "").trim().toUpperCase();
}

export function findPlayer(metadata, settings, code, tags = []) {
  const wantedCode = normalized(code);
  const wantedTags = new Set(tags.map(normalized));
  for (const player of settings?.players || []) {
    const names = metadata?.players?.[player.playerIndex]?.names || {};
    if ((wantedCode && normalized(names.code) === wantedCode) || wantedTags.has(normalized(names.netplay))) {
      return { ...player, names };
    }
  }
  return null;
}

export function scoreMoment(moment, gameDate) {
  let score = 0;
  if (moment.type === "rare-item") score += 120;
  if (moment.type === "turnip-action") score += 65;
  if (moment.type === "kill-sequence") score += 55;
  if (moment.type === "combo") score += 28;
  if (moment.gameEnding) score += 24;
  if (moment.didKill) score += 30;
  score += Math.min(40, Math.round((moment.damage || 0) * 0.55));
  score += Math.min(24, (moment.hits || 0) * 3);
  if (gameDate && gameDate >= "2026-08-28") score += 18;
  return score;
}

export function isIntentionalStockLoss(stock, conversions, priorStocks = []) {
  const endFrame = Number(stock?.endFrame ?? -Infinity);
  const recentKill = conversions.some(c => c?.didKill && c?.playerIndex != null && endFrame - Number(c.endFrame || 0) >= 0 && endFrame - Number(c.endFrame || 0) <= 180);
  const lowPercent = Number(stock?.endPercent || 0) < 35;
  const clusteredLowDeaths = lowPercent && priorStocks.filter(s =>
    Number(s?.endPercent || 0) < 35 && Math.abs(endFrame - Number(s?.endFrame || 0)) < 1800
  ).length >= 1;
  return !recentKill && (lowPercent || clusteredLowDeaths);
}

export function validComeback(opponentStocks, conversions) {
  const suspicious = opponentStocks.filter((s, i) => isIntentionalStockLoss(s, conversions, opponentStocks.slice(0, i)));
  return suspicious.length === 0;
}
