/**
 * Termine und veröffentlichte Zahlen.
 *
 *  - ForexFactory   Wochenkalender mit Forecast/Previous, aber OHNE Actual
 *  - Myfxbook RSS   rollierender Feed der letzten Stunden, MIT Actual/Consensus
 *
 * Beide senden keine CORS-Header — im Browser nicht abrufbar, im Actions-Runner
 * und hinter dem Dev-Proxy dagegen völlig unproblematisch.
 *
 * Kein DOMParser in Node: Das RSS wird bewusst per Regex zerlegt. Der Feed ist flach
 * und stabil aufgebaut, ein XML-Parser als Abhängigkeit lohnt hier nicht.
 */

const FF_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";
const FF_CDN = "https://cdn-nfs.faireconomy.media/ff_calendar_thisweek.json";
const RSS_URL = "https://www.myfxbook.com/rss/forex-economic-calendar-events";

const CCY = ["USD", "EUR", "JPY", "AUD", "CAD"];

/** Land-Slug im Myfxbook-Link → Währung. Eurozone-Mitglieder zählen auf EUR ein. */
export const SLUG2CCY = {
  "united-states": "USD",
  japan: "JPY",
  australia: "AUD",
  canada: "CAD",
  "euro-area": "EUR",
  "european-union": "EUR",
  germany: "EUR",
  france: "EUR",
  italy: "EUR",
  spain: "EUR",
};

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", apos: "'", nbsp: " " };
const unescapeHtml = (s) =>
  String(s).replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (_, e) => ENTITIES[e]);
const stripTags = (s) => unescapeHtml(String(s).replace(/<[^>]*>/g, "")).trim();

// ---------------------------------------------------------------- ForexFactory

export async function loadCalendar(fetchImpl = fetch) {
  const errors = [];
  for (const url of [FF_URL, FF_CDN]) {
    try {
      const res = await fetchImpl(url, {
        headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const rows = await res.json();
      if (!Array.isArray(rows) || !rows.length) throw new Error("leere Antwort");

      return rows
        .filter((r) => CCY.includes(r.country) && (r.impact === "High" || r.impact === "Medium"))
        .map((r) => ({
          title: r.title,
          c: r.country,
          date: r.date,
          impact: r.impact,
          fc: r.forecast ?? "",
          prev: r.previous ?? "",
        }));
    } catch (err) {
      errors.push(`${new URL(url).host}: ${err.message}`);
    }
  }
  throw new Error(`ForexFactory nicht erreichbar — ${errors.join(" · ")}`);
}

// ------------------------------------------------------------- Myfxbook RSS

/**
 * Zerlegt ein <item>. Die `<description>` enthält eine HTML-escapte Tabelle;
 * deren zweite Zeile trägt in Spalte 3–5 Previous | Consensus | Actual.
 */
function parseItem(item) {
  const pick = (tag) => {
    const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i").exec(item);
    if (!m) return "";
    return m[1].replace(/^<!\[CDATA\[|\]\]>$/g, "").trim();
  };

  const link = pick("link");
  const slug = /forex-economic-calendar\/([a-z-]+)\//.exec(link)?.[1];
  const ccy = slug ? SLUG2CCY[slug] : null;
  if (!ccy) return null;

  const desc = unescapeHtml(pick("description"));
  const impact = /sprite-(high|medium|low|no)-impact/.exec(desc)?.[1] ?? "no";

  const rows = desc.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
  let prev = "", cons = "", act = "";
  if (rows.length > 1) {
    const tds = (rows[1].match(/<td[^>]*>[\s\S]*?<\/td>/gi) || []).map(stripTags);
    prev = tds[2] ?? "";
    cons = tds[3] ?? "";
    act = tds[4] ?? "";
  }

  return { ccy, title: stripTags(pick("title")), date: pick("pubDate"), impact, prev, cons, act };
}

/** Zahl aus einem Feldwert wie "0,4%" oder "-1.2K" — für das Überraschungsmaß. */
export function parseNum(s) {
  if (!s) return null;
  const m = String(s).replace(",", ".").match(/-?\d+(\.\d+)?/);
  return m ? +m[0] : null;
}

export async function loadRecent(fetchImpl = fetch) {
  const res = await fetchImpl(RSS_URL, {
    headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", accept: "application/rss+xml,*/*" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Myfxbook RSS: HTTP ${res.status}`);

  const xml = await res.text();
  const items = xml.match(/<item[^>]*>[\s\S]*?<\/item>/gi) || [];
  if (!items.length) throw new Error("RSS ohne <item> — Feed-Format geändert?");

  const out = [];
  for (const it of items) {
    const parsed = parseItem(it);
    if (!parsed) continue;
    // Überraschung = Actual − Consensus. Vorerst nur Anzeige, siehe Roadmap.
    const a = parseNum(parsed.act);
    const c = parseNum(parsed.cons);
    parsed.surprise = a != null && c != null ? +(a - c).toFixed(4) : null;
    out.push(parsed);
  }
  return out;
}
