/**
 * Makrodaten über DBnomics (Spiegel von BIS und IMF).
 *
 * ACHTUNG — bekannte Schwachstelle, siehe docs/DATA-SOURCES.md:
 * Die Leitzins-Serie hinkt teils über ein Jahr hinterher, CPI fehlt für EUR und AUD.
 * Zins-Momentum und Carry machen zusammen 45 % des Makro-Scores aus — solange diese
 * Quelle hängt, trägt knapp die Hälfte des Scores wenig. Die Ablösung durch BIS/EZB/
 * FRED/BoC direkt ist Roadmap-Priorität 1. Das Datenalter-Handling im Scoring fängt
 * das ab (halbes Gewicht ab 240 Tagen, Rauswurf ab 900), heilt es aber nicht.
 */

const DBN = "https://api.db.nomics.world/v22/series/";

/** Mehrere Serien-IDs je Indikator: DBnomics benennt Datasets gelegentlich um. */
export const SERIES = {
  policy: (cc) => [`BIS/WS_CBPOL/M.${cc}`, `BIS/WS_CBPOL_M/M.${cc}`, `BIS/CBPOL/M.${cc}`],
  cpi: (cc) => [`IMF/IFS/M.${cc}.PCPI_PC_CP_A_PT`, `IMF/CPI/M.${cc}.PCPI_PC_CP_A_PT`],
  unemp: (cc) => [`IMF/IFS/M.${cc}.LUR_PT`, `IMF/IFS/Q.${cc}.LUR_PT`],
};

/** Erste Serien-ID, die genug verwertbare Beobachtungen liefert. */
async function fetchSeries(candidates, fetchImpl) {
  for (const key of candidates) {
    try {
      const res = await fetchImpl(`${DBN}${key}?observations=1`, {
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) continue;
      const j = await res.json();
      const doc = j.series?.docs?.[0];
      if (!doc?.period || !doc?.value) continue;

      const obs = [];
      for (let i = 0; i < doc.period.length; i++) {
        const v = doc.value[i];
        if (v != null && v !== "NA" && !isNaN(+v)) obs.push({ p: doc.period[i], v: +v });
      }
      if (obs.length < 8) continue;
      return { key, obs };
    } catch {
      // nächste Kandidaten-ID probieren
    }
  }
  return null;
}

export async function loadMacro(currencies, fetchImpl = fetch) {
  const out = {};
  await Promise.all(
    Object.entries(currencies).map(async ([ccy, c]) => {
      const [policy, cpi, unemp] = await Promise.all([
        fetchSeries(SERIES.policy(c.bis), fetchImpl),
        fetchSeries(SERIES.cpi(c.imf), fetchImpl),
        fetchSeries(SERIES.unemp(c.imf), fetchImpl),
      ]);
      out[ccy] = { policy, cpi, unemp };
    })
  );
  return out;
}
