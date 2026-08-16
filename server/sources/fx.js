/**
 * Preis-Momentum ~30 Tage aus EZB-Referenzkursen (Frankfurter).
 *
 * VORZEICHENFALLE: Die Rate ist "Fremdwährung pro USD". Steigt sie, wird die
 * Fremdwährung *schwächer*. Deshalb das Minus in der Formel — klassische Fehlerquelle.
 *
 * Nur Bankarbeitstage, keine Wochenenden → Zeitraum großzügig wählen (32 Tage).
 */

const SYMBOLS = ["EUR", "JPY", "AUD", "CAD"];

export async function loadFxMomentum(fetchImpl = fetch) {
  const end = new Date();
  const start = new Date(Date.now() - 32 * 864e5);
  const s = start.toISOString().slice(0, 10);
  const e = end.toISOString().slice(0, 10);

  const urls = [
    `https://api.frankfurter.dev/v1/${s}..${e}?base=USD&symbols=${SYMBOLS.join(",")}`,
    `https://api.frankfurter.app/${s}..${e}?from=USD&to=${SYMBOLS.join(",")}`,
  ];

  const errors = [];
  for (const u of urls) {
    try {
      const res = await fetchImpl(u, { signal: AbortSignal.timeout(20_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();

      const days = Object.keys(j.rates || {}).sort();
      if (days.length < 10) throw new Error(`nur ${days.length} Handelstage`);

      const first = j.rates[days[0]];
      const lastR = j.rates[days[days.length - 1]];
      const out = { from: days[0], date: days[days.length - 1], days: days.length };

      for (const c of SYMBOLS) {
        if (first[c] && lastR[c]) {
          // negiert: Rate = c pro USD, steigende Rate = schwächeres c
          out[c] = -100 * (lastR[c] / first[c] - 1);
        }
      }
      return out;
    } catch (err) {
      errors.push(`${new URL(u).host}: ${err.message}`);
    }
  }
  throw new Error(`Frankfurter nicht erreichbar — ${errors.join(" · ")}`);
}
