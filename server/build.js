/**
 * Board bauen — holt alle Quellen, rechnet das Scoring, schreibt data/.
 *
 *   node server/build.js
 *
 * Läuft im GitHub-Actions-Runner (dort gibt es kein CORS) und lokal identisch.
 * Erzeugt:
 *   data/board.json                       aktueller Stand, den das Frontend lädt
 *   data/history/YYYY-MM/<ISO-Stunde>.json  kompakter Snapshot je Lauf → Backtest-Basis
 *
 * Grundsatz: Fällt eine Quelle aus, fliegt sie raus und der Rest rechnet weiter —
 * keine erfundenen Zahlen, keine stillen Platzhalter. Der Status jeder Quelle landet
 * in board.json und ist im Frontend sichtbar.
 */

import { writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { buildBoard, CUR, FUTURES } from "./scoring.js";
import { loadCot } from "./sources/cot.js";
import { loadFxMomentum } from "./sources/fx.js";
import { loadMacro } from "./sources/macro.js";
import { loadRetail } from "./sources/retail.js";
import { loadCalendar, loadRecent } from "./sources/calendar.js";

const ROOT = join(fileURLToPath(new URL("..", import.meta.url)));
const DATA = join(ROOT, "data");

/** Führt einen Quellenabruf aus und protokolliert Erfolg oder Fehler, ohne zu werfen. */
async function attempt(status, name, fn) {
  const t0 = Date.now();
  try {
    const value = await fn();
    status[name] = { ok: true, ms: Date.now() - t0, at: new Date().toISOString() };
    console.log(`  ✓ ${name.padEnd(9)} ${Date.now() - t0} ms`);
    return value;
  } catch (err) {
    status[name] = { ok: false, ms: Date.now() - t0, error: err.message, at: new Date().toISOString() };
    console.warn(`  ✗ ${name.padEnd(9)} ${err.message}`);
    return null;
  }
}

/** Kompakter Verlaufseintrag — nur was der Backtest braucht, damit die Historie klein bleibt. */
function historyRecord(board) {
  return {
    generatedAt: board.generatedAt,
    futures: board.futures.map((f) => ({
      sym: f.sym,
      total: f.total == null ? null : +f.total.toFixed(4),
      fund: f.fund == null ? null : +f.fund.toFixed(4),
      cot: f.cot == null ? null : +f.cot.toFixed(4),
      signal: f.signal.key,
      px30: board.fx?.[f.base] == null ? null : +board.fx[f.base].toFixed(3),
      specIdx: board.cot?.[f.cotCode]?.index ?? null,
      cotDate: board.cot?.[f.cotCode]?.date ?? null,
      divScore: f.divergence?.score == null ? null : +f.divergence.score.toFixed(4),
      divFires: f.divergence?.fires ?? null,
      retailLongPct: f.divergence?.retailLongPct ?? null,
    })),
  };
}

async function main() {
  console.log("\nMacro FX Board — Datenabruf");
  const sources = {};

  // Unabhängige Quellen parallel; ein Ausfall betrifft nur den eigenen Faktor.
  const [macro, cot, fx, retail, events, recent] = await Promise.all([
    attempt(sources, "macro", () => loadMacro(CUR)),
    attempt(sources, "cot", () => loadCot(FUTURES)),
    attempt(sources, "fx", () => loadFxMomentum()),
    attempt(sources, "retail", () => loadRetail()),
    attempt(sources, "calendar", () => loadCalendar()),
    attempt(sources, "recent", () => loadRecent()),
  ]);

  const okCount = Object.values(sources).filter((s) => s.ok).length;
  if (okCount === 0) {
    console.error("\nAlle Quellen fehlgeschlagen — es wird nichts geschrieben.");
    process.exit(1);
  }

  const board = buildBoard({ macro, cot, fx, retail, events, recent, sources });

  await mkdir(DATA, { recursive: true });
  await writeFile(join(DATA, "board.json"), JSON.stringify(board, null, 2) + "\n");

  const stamp = board.generatedAt.slice(0, 13).replace(":", ""); // YYYY-MM-DDTHH
  const histPath = join(DATA, "history", stamp.slice(0, 7), `${stamp}.json`);
  await mkdir(dirname(histPath), { recursive: true });
  await writeFile(histPath, JSON.stringify(historyRecord(board), null, 2) + "\n");

  console.log(`\n  Quellen ok: ${okCount}/6`);
  console.log("  Signale:");
  for (const f of board.futures) {
    const t = f.total == null ? "  n/a " : (f.total >= 0 ? "+" : "") + f.total.toFixed(2);
    const d = f.divergence?.fires
      ? `  ⇄ Divergenz ${f.divergence.score > 0 ? "+" : ""}${f.divergence.score.toFixed(2)} (${f.divergence.strength})`
      : "";
    console.log(`    ${f.sym}  ${t}  ${f.signal.label}${d}`);
  }
  console.log(`\n  geschrieben: data/board.json  ·  ${histPath.replace(ROOT, "")}\n`);
}

main().catch((err) => {
  console.error("\nAbbruch:", err);
  process.exit(1);
});
