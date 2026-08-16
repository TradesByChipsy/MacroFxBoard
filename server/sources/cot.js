/**
 * CFTC Commitments of Traders — Legacy Futures-Only (Socrata/SODA).
 *
 * Datenstand ist jeweils **Dienstag**, Veröffentlichung Freitag 15:30 ET.
 * Beim Handeln also immer ~3 Tage alt: Positionierungs-Kontext, kein Timing-Werkzeug.
 *
 * Achtung: Die API liefert **alle Zahlen als Strings** — überall casten.
 */

const BASE = "https://publicreporting.cftc.gov/resource/6dca-aqww.json";

const FIELDS = [
  "report_date_as_yyyy_mm_dd",
  "noncomm_positions_long_all",
  "noncomm_positions_short_all",
  "comm_positions_long_all",
  "comm_positions_short_all",
  "nonrept_positions_long_all",
  "nonrept_positions_short_all",
  "open_interest_all",
].join(",");

/** COT-Index: Lage der aktuellen Netto-Position im eigenen 3-Jahres-Band (0–100). */
export function cotIndex(nets) {
  const cur = nets[nets.length - 1];
  const min = Math.min(...nets);
  const max = Math.max(...nets);
  return max === min ? 50 : Math.round((100 * (cur - min)) / (max - min));
}

export async function loadCot(futures, fetchImpl = fetch) {
  const since = new Date();
  since.setFullYear(since.getFullYear() - 3);
  const sinceStr = since.toISOString().slice(0, 10);

  const result = {};
  for (const f of futures) {
    const url =
      `${BASE}?cftc_contract_market_code=${f.cot}` +
      `&$where=${encodeURIComponent(`report_date_as_yyyy_mm_dd > '${sinceStr}'`)}` +
      `&$order=${encodeURIComponent("report_date_as_yyyy_mm_dd ASC")}` +
      `&$select=${encodeURIComponent(FIELDS)}` +
      `&$limit=200`;

    const res = await fetchImpl(url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`CFTC ${f.sym}: HTTP ${res.status}`);
    const rows = await res.json();
    if (!rows.length) continue;

    const specN = rows.map((x) => +x.noncomm_positions_long_all - +x.noncomm_positions_short_all);
    const commN = rows.map((x) => +x.comm_positions_long_all - +x.comm_positions_short_all);
    const smallN = rows.map((x) => +x.nonrept_positions_long_all - +x.nonrept_positions_short_all);

    const cur = specN[specN.length - 1];
    const oi = +rows[rows.length - 1].open_interest_all;

    result[f.cot] = {
      index: cotIndex(specN),
      net: cur,
      netPct: oi ? (100 * cur) / oi : 0,
      chg6w: cur - (specN.length > 6 ? specN[specN.length - 7] : specN[0]),
      commIdx: cotIndex(commN),
      commNet: commN[commN.length - 1],
      smallIdx: cotIndex(smallN),
      smallNet: smallN[smallN.length - 1],
      openInterest: oi,
      weeks: specN.length,
      date: rows[rows.length - 1].report_date_as_yyyy_mm_dd.slice(0, 10),
    };
  }
  return result;
}
