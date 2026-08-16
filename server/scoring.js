/**
 * Rechenmodell — pure Funktionen, keine Netzwerk- oder DOM-Aufrufe.
 *
 * Läuft identisch im Actions-Runner und im Browser. Genau das ist der Zweck der
 * Extraktion: Was hier herauskommt, wird als data/board.json eingefroren und ist
 * damit nachvollziehbar und backtestbar.
 *
 * Alle Faktoren liefern −2 … +2, immer aus Sicht der **Basiswährung gegen USD**
 * (positiv = Basiswährung stark = Future steigt). Details in docs/SCORING.md.
 */

export const CUR = {
  USD: { name: "US-Dollar", bis: "US", imf: "US" },
  EUR: { name: "Euro", bis: "XM", imf: "U2" },
  JPY: { name: "Yen", bis: "JP", imf: "JP" },
  AUD: { name: "Aussie", bis: "AU", imf: "AU" },
  CAD: { name: "CAD", bis: "CA", imf: "CA" },
};

export const FUTURES = [
  { sym: "6E", base: "EUR", label: "Euro FX", cot: "099741" },
  { sym: "6J", base: "JPY", label: "Japanese Yen", cot: "097741" },
  { sym: "6A", base: "AUD", label: "Australian Dollar", cot: "232741" },
  { sym: "6C", base: "CAD", label: "Canadian Dollar", cot: "090741" },
];

export const W = { px: 0.3, mom: 0.25, carry: 0.2, infl: 0.15, lab: 0.1 };
export const W_FUND = 0.7;
export const W_COT = 0.3;
export const TH_SIGNAL = 1.2;
export const TH_WEAK = 0.6;
export const STALE_DAYS = 240; // ⚠ alt → halbes Gewicht
export const DEAD_DAYS = 900; // komplett raus
export const EV_WARN_HOURS = 48;

/** Ab hier gilt die Crowd als deutlich einseitig: 0.4 entspricht 70/30. */
export const RETAIL_EXTREME = 0.4;

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** Dezimalkomma für die Notiztexte — die Oberfläche ist durchgängig deutsch. */
const de = (n, digits = 2) => n.toFixed(digits).replace(".", ",");

// ------------------------------------------------------------- Datenalter

function periodDate(p) {
  if (/^\d{4}-\d{2}$/.test(p)) return new Date(`${p}-15`);
  const q = /^(\d{4})-Q(\d)$/.exec(p);
  if (q) return new Date(+q[1], +q[2] * 3 - 2, 15);
  return new Date(`${p}-06-15`);
}

const ageDays = (p, now) => (now - periodDate(p).getTime()) / 864e5;

/** Gewichtsfaktor je Datenalter: frisch = 1, alt = 0.5, tot = 0. */
export function ageW(age) {
  if (age == null) return 0;
  if (age > DEAD_DAYS) return 0;
  return age > STALE_DAYS ? 0.5 : 1;
}

// ------------------------------------------------------------- Makrofaktoren

const lastObs = (o) => o.obs[o.obs.length - 1];
const backObs = (o, n) => o.obs[Math.max(0, o.obs.length - 1 - n)];

/** Verdichtet die Rohserien einer Währung zu den fünf Score-Eingangsgrößen. */
export function curFactors(macro, ccy, now = Date.now()) {
  const m = macro?.[ccy] || {};
  const f = {};

  if (m.policy) {
    f.level = lastObs(m.policy).v;
    f.mom = f.level - backObs(m.policy, 12).v;
    f.polPeriod = lastObs(m.policy).p;
    f.polAge = ageDays(f.polPeriod, now);
  }
  if (m.cpi) {
    f.cpi = lastObs(m.cpi).v;
    f.cpiPeriod = lastObs(m.cpi).p;
    f.cpiAge = ageDays(f.cpiPeriod, now);
  }
  if (m.unemp) {
    const isQuarterly = /Q/.test(lastObs(m.unemp).p);
    f.unemp = lastObs(m.unemp).v;
    f.unempTrend = f.unemp - backObs(m.unemp, isQuarterly ? 2 : 6).v;
    f.unePeriod = lastObs(m.unemp).p;
    f.uneAge = ageDays(f.unePeriod, now);
  }
  return f;
}

// ------------------------------------------------------------- Divergenz

/**
 * Divergenz Large Specs (COT) gegen Retail-Crowd (Myfxbook).
 *
 * Kernidee: Die **Richtung** kommt von den großen Spekulanten, die **Stärke** vom
 * Ausmaß der Gegenposition der Crowd. Stehen beide auf derselben Seite, schweigt das
 * Signal — bewusst, statt Rauschen beizusteuern.
 *
 * Absichtlich multiplikativ, nicht additiv: Zwei entgegengesetzte Extreme sollen sich
 * verstärken, nicht gegeneinander aufheben. Genau das passiert in der additiven
 * COT-Summe, in der Specs und Small Traders getrennt einfließen.
 */
export function divergence(cot, retail) {
  if (!cot || !retail || retail.retailPos == null) return null;

  const specPos = (cot.index - 50) / 50; // −1 … +1
  const retailPos = retail.retailPos; // −1 … +1
  const opposed = specPos !== 0 && retailPos !== 0 && Math.sign(specPos) !== Math.sign(retailPos);
  const crowded = Math.abs(retailPos) >= RETAIL_EXTREME;
  const fires = opposed && crowded;

  const score = fires ? clamp(specPos * Math.abs(retailPos) * 2, -2, 2) : 0;
  const mag = Math.abs(score);

  return {
    score,
    fires,
    specPos: +specPos.toFixed(3),
    retailPos: +retailPos.toFixed(3),
    specIdx: cot.index,
    retailLongPct: retail.longPct,
    retailShortPct: retail.shortPct,
    pair: retail.pair,
    inverted: retail.inverted,
    strength: !fires ? "keine" : mag >= 1.2 ? "stark" : mag >= 0.6 ? "moderat" : "schwach",
    reason: !opposed
      ? "Specs und Crowd stehen auf derselben Seite"
      : !crowded
        ? `Crowd nicht einseitig genug (${retail.longPct}/${retail.shortPct})`
        : `Specs ${specPos > 0 ? "long" : "short"} gegen ${Math.max(retail.longPct, retail.shortPct)} % der Crowd`,
    cotDate: cot.date,
    retailTs: retail.ts,
  };
}

// ------------------------------------------------------------- Gesamtscore

export function pairScore(fut, data, now = Date.now()) {
  const { macro, cot: cotAll, fx, retail: retailAll, events } = data;
  const b = curFactors(macro, fut.base, now);
  const u = curFactors(macro, "USD", now);
  const parts = [];

  const add = (name, w, s, note, stale) =>
    parts.push({ name, w, s: clamp(s, -2, 2), note, stale });

  // Preis-Momentum — der einzige tagesfrische Faktor
  if (fx && fx[fut.base] != null) {
    add("Preis-Momentum 30T", W.px, fx[fut.base] * (2 / 3), `${de(fx[fut.base])} % vs USD`, false);
  }
  if (b.mom != null && u.mom != null) {
    const aw = Math.min(ageW(b.polAge), ageW(u.polAge));
    if (aw > 0) add("Zins-Momentum Δ12M", W.mom * aw, (b.mom - u.mom) * 2, `${de(b.mom)} vs ${de(u.mom)} pp`, aw < 1);
  }
  if (b.level != null && u.level != null) {
    const aw = Math.min(ageW(b.polAge), ageW(u.polAge));
    if (aw > 0) add("Zinsniveau / Carry", W.carry * aw, (b.level - u.level) / 1.5, `${de(b.level, 1)} % vs ${de(u.level, 1)} %`, aw < 1);
  }
  if (b.cpi != null && u.cpi != null) {
    const aw = Math.min(ageW(b.cpiAge), ageW(u.cpiAge));
    if (aw > 0) add("Inflationsdruck", W.infl * aw, b.cpi - u.cpi, `CPI ${de(b.cpi, 1)} vs ${de(u.cpi, 1)} %`, aw < 1);
  }
  if (b.unempTrend != null && u.unempTrend != null) {
    const aw = Math.min(ageW(b.uneAge), ageW(u.uneAge));
    // Minus: sinkende Arbeitslosigkeit = Stärke
    if (aw > 0) add("Arbeitsmarkt-Trend", W.lab * aw, -(b.unempTrend - u.unempTrend) * 4, `Δ6M ${de(b.unempTrend)} vs ${de(u.unempTrend)} pp`, aw < 1);
  }

  const wSum = parts.reduce((a, p) => a + p.w, 0);
  const fund = wSum > 0 ? parts.reduce((a, p) => a + p.w * p.s, 0) / wSum : null;

  // --- COT: drei Gruppen, mit Squeeze-Regel an den Extremen
  let cot = null, cotExtreme = false, cotSqueeze = false, cotParts = null;
  const d = cotAll?.[fut.cot];
  if (d) {
    const idx = d.index;
    cotExtreme = idx >= 90 || idx <= 10;
    let sSpec = clamp((idx - 50) / 25, -2, 2);
    const px = fx ? fx[fut.base] : null;

    if (cotExtreme) {
      // Extrem + gegenläufiger Preis = Eindeckungsdruck, zählt kontrár.
      // Ohne Preisbestätigung ist das Extrem nur Reversal-Risiko → dämpfen.
      if (px != null && idx <= 10 && px > 0.5) { sSpec = 1.0; cotSqueeze = true; }
      else if (px != null && idx >= 90 && px < -0.5) { sSpec = -1.0; cotSqueeze = true; }
      else sSpec *= 0.5;
    }

    const sComm = d.commIdx != null ? clamp((d.commIdx - 50) / 25, -2, 2) : null;
    const sSmall = d.smallIdx != null ? clamp(-(d.smallIdx - 50) / 25, -2, 2) : null;
    const wSpec = 0.5, wComm = sComm != null ? 0.3 : 0, wSmall = sSmall != null ? 0.2 : 0;
    cot = (wSpec * sSpec + (sComm || 0) * wComm + (sSmall || 0) * wSmall) / (wSpec + wComm + wSmall);
    cotParts = { sSpec, sComm, sSmall };
  }

  let total = null;
  if (fund != null && cot != null) total = W_FUND * fund + W_COT * cot;
  else if (fund != null) total = fund;
  else if (cot != null) total = cot;

  // --- Divergenz: berechnet und angezeigt, fließt bewusst NICHT in `total`.
  // Erst nach ein paar Wochen echter Fälle lässt sich die Gewichtung begründen
  // statt raten — die übrigen Schwellen sind ohnehin unvalidiert (docs/SCORING.md).
  const div = divergence(d, retailAll?.[fut.cot]);

  let evWarns = [];
  if (Array.isArray(events)) {
    evWarns = events
      .filter((ev) => ev.impact === "High" && (ev.c === fut.base || ev.c === "USD")
        && Math.abs(new Date(ev.date).getTime() - now) < EV_WARN_HOURS * 3600e3)
      .map((ev) => ({ c: ev.c, title: ev.title, date: ev.date }));
  }

  // `cotCode` statt `fut.cot`: Der Spread würde die Kontraktnummer sonst mit dem
  // gleichnamigen COT-*Score* überschreiben — und damit den Zugriff B.cot[code] zerstören.
  return { ...fut, cotCode: fut.cot, parts, fund, cot, cotExtreme, cotSqueeze, cotParts, divergence: div, total, evWarns, signal: signalFor(total) };
}

/** Vier Zustände. "KEIN TRADE" ist ein gewolltes Ergebnis, kein Mangel. */
export function signalFor(total) {
  if (total == null) return { key: "none", label: "DATEN FEHLEN", hint: "Keine Daten ladbar." };
  if (total >= TH_SIGNAL)
    return { key: "long", label: "LONG", hint: "Nur Long-Setups: Breakout-Retest über Volumenzonen, Value Area Low, Absorption am Support." };
  if (total <= -TH_SIGNAL)
    return { key: "short", label: "SHORT", hint: "Nur Short-Setups: Breakdown-Retest, Value Area High, Absorption am Widerstand." };
  if (Math.abs(total) >= TH_WEAK)
    return { key: "weak", label: total > 0 ? "Tendenz Long" : "Tendenz Short", hint: "Schwaches Signal — nur A+-Setups, reduzierte Größe." };
  return { key: "none", label: "KEIN TRADE", hint: "Keine ausreichende Divergenz — Future auslassen." };
}

/** Vollständiges Board aus den Rohdaten. Das ist der Inhalt von data/board.json. */
export function buildBoard(data, now = Date.now()) {
  return {
    generatedAt: new Date(now).toISOString(),
    futures: FUTURES.map((f) => pairScore(f, data, now)),
    macroTable: Object.fromEntries(
      Object.keys(CUR).map((ccy) => [ccy, { ...CUR[ccy], ...curFactors(data.macro, ccy, now), px: ccy === "USD" ? null : data.fx?.[ccy] ?? null }])
    ),
    cot: data.cot ?? null,
    retail: data.retail ?? null,
    fx: data.fx ?? null,
    events: data.events ?? null,
    recent: data.recent ?? null,
    sources: data.sources ?? {},
  };
}
