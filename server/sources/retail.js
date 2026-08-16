/**
 * Retail-Sentiment — Myfxbook Community Outlook
 *
 * Liefert die Long/Short-Verteilung offener Retail-Positionen je Paar.
 * Gegenstück zur COT-Seite: dort die großen Spekulanten, hier die Crowd.
 *
 * Quelle:  https://www.myfxbook.com/community/outlook
 * Kein Key, kein Login. Die Werte stehen im statischen HTML (serverseitig gerendert) —
 * die offizielle API unter /api/get-community-outlook.json verlangt dagegen einen
 * Session-Login und ist deshalb bewusst nicht angebunden.
 *
 * Kein CORS-Header → nur serverseitig abrufbar, wie ForexFactory und Myfxbook-RSS.
 */

const URL_OUTLOOK = "https://www.myfxbook.com/community/outlook";

/**
 * Zuordnung Future → Myfxbook-Paar.
 *
 * ACHTUNG, Vorzeichen: Myfxbook quotet USD/JPY und USD/CAD, das Board rechnet aber
 * immer aus Sicht der Basiswährung gegen USD. "70 % long USDJPY" heißt *short JPY*.
 * `invert: true` dreht die Quoten deshalb um. Dieselbe Falle wie bei Frankfurter.
 */
export const FUT2PAIR = {
  "099741": { pair: "EURUSD", base: "EUR", invert: false }, // 6E
  "097741": { pair: "USDJPY", base: "JPY", invert: true },  // 6J
  "232741": { pair: "AUDUSD", base: "AUD", invert: false }, // 6A
  "090741": { pair: "USDCAD", base: "CAD", invert: true },  // 6C
};

const num = (s) => (s == null ? null : +String(s).replace(/,/g, ""));

/**
 * Zerlegt eine Symbolzeile des Outlook-HTML.
 * Die Balkenbreiten tragen die gerundeten Prozente, die (versteckte) Popover-Tabelle
 * zusätzlich Lots und Positionsanzahl.
 */
function parseRow(block) {
  const sym = /symbolName="([A-Z0-9]+)"/.exec(block)?.[1];
  if (!sym) return null;

  const shortPct = num(/progress-bar-danger"\s+style="width:\s*([\d.]+)%/.exec(block)?.[1]);
  const longPct = num(/progress-bar-success"\s+style="width:\s*([\d.]+)%/.exec(block)?.[1]);
  if (shortPct == null || longPct == null) return null;

  // Popover: je eine Zeile für Short und Long mit Prozent | Lots | Positionen
  const detail = {};
  const re =
    /<td[^>]*>(Short|Long)<\/td>\s*<td[^>]*>([\d.]+)%<\/td>\s*<td[^>]*>([\d.,]+)\s*lots<\/td>\s*<td[^>]*>([\d,]+)<\/td>/gi;
  for (const m of block.matchAll(re)) {
    detail[m[1].toLowerCase()] = { pct: num(m[2]), lots: num(m[3]), positions: num(m[4]) };
  }

  return {
    symbol: sym,
    shortPct,
    longPct,
    lots: { short: detail.short?.lots ?? null, long: detail.long?.lots ?? null },
    positions: { short: detail.short?.positions ?? null, long: detail.long?.positions ?? null },
  };
}

/** Rohabzug aller Symbole. `fetchImpl` nur für Tests injizierbar. */
export async function fetchOutlook(fetchImpl = fetch) {
  const res = await fetchImpl(URL_OUTLOOK, {
    headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", accept: "text/html" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Myfxbook HTTP ${res.status}`);

  const html = await res.text();
  const blocks = html.split(/(?=<tr class="outlook-symbol-row")/).slice(1);
  if (!blocks.length) throw new Error("Outlook-Tabelle nicht gefunden — Layout geändert?");

  const out = {};
  for (const b of blocks) {
    const row = parseRow(b);
    if (row) out[row.symbol] = row;
  }
  return out;
}

/**
 * Retail-Sentiment je Future, bereits auf Basiswährung-gegen-USD gedreht.
 *
 * `longPct` = Anteil der Retail-Trader, die auf eine *stärkere Basiswährung* setzen.
 * `retailPos` = (longPct − 50) / 50, also −1 (alle short) … +1 (alle long).
 */
export async function loadRetail(fetchImpl = fetch) {
  const raw = await fetchOutlook(fetchImpl);
  const ts = new Date().toISOString();
  const result = {};

  for (const [cot, { pair, base, invert }] of Object.entries(FUT2PAIR)) {
    const r = raw[pair];
    if (!r) continue;

    const longPct = invert ? r.shortPct : r.longPct;
    const shortPct = invert ? r.longPct : r.shortPct;
    const lots = invert ? { long: r.lots.short, short: r.lots.long } : r.lots;
    const positions = invert
      ? { long: r.positions.short, short: r.positions.long }
      : r.positions;

    result[cot] = {
      base,
      pair,
      inverted: invert,
      longPct,
      shortPct,
      retailPos: (longPct - 50) / 50,
      lots,
      positions,
      ts,
    };
  }
  return result;
}
