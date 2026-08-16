# MacroFxBoard

Vollautomatisches Makro-Scoring für CME-Währungsfutures (6E, 6J, 6A, 6C).

Das Board sagt **nicht**, wann man einsteigt. Es sagt, **ob und in welche Richtung** ein Future
heute überhaupt handelbar ist — als objektiver Richtungs-Bias aus offiziellen Daten, ohne
manuelle Bewertung. Vier Zustände je Future: `LONG` · `SHORT` · `Tendenz` · `KEIN TRADE`.

„Kein Trade" ist ein gewolltes Ergebnis: Bei widersprüchlicher Datenlage soll das System flat sein.

## Wie es läuft

GitHub Pages ist statisch und kann die Feeds nicht selbst holen — ForexFactory und Myfxbook
senden keine CORS-Header. Der Actions-Runner kann es, dort gibt es die Browser-Beschränkung nicht.
Er ist deshalb das Backend:

```
Actions (alle 6 h + freitags nach dem CFTC-Release)
   ├─ holt CFTC · Frankfurter · DBnomics · Myfxbook · ForexFactory
   ├─ rechnet das Scoring  (server/scoring.js)
   └─ committet data/board.json + Snapshot nach data/history/
                                  ↓
GitHub Pages  →  liefert web/ + board.json statisch aus
```

Jeder Lauf hinterlässt einen Zeitstempel-Snapshot. Das ergibt nebenbei eine lückenlose
Signal-Historie — die Voraussetzung für den noch ausstehenden Backtest.

## Das Modell

`total = 0.7 × Makro/Markt + 0.3 × COT`, jeder Faktor auf −2…+2 begrenzt, immer aus Sicht der
Basiswährung gegen USD. Details in [`docs/SCORING.md`](docs/SCORING.md).

| Makro-/Marktfaktor | Gewicht |
|---|---|
| Preis-Momentum 30 T | 30 % |
| Zins-Momentum Δ12M | 25 % |
| Zinsniveau / Carry | 20 % |
| Inflationsdruck | 15 % |
| Arbeitsmarkt-Trend | 10 % |

COT: Large Specs (50 %, trendfolgend mit Squeeze-Regel an Extremen) · Commercials (30 %,
kontrár-bestätigend) · Small Traders (20 %, strikt kontrár).

**Divergenz Specs gegen Retail-Crowd:** Stehen die großen Spekulanten (CFTC) gegen die
Retail-Crowd (Myfxbook) und ist die Crowd deutlich einseitig (ab 70/30), entsteht ein Signal —
Richtung von den großen Playern, Stärke aus dem Ausmaß der Gegenposition. Bewusst multiplikativ,
damit sich zwei entgegengesetzte Extreme verstärken statt sich in einer Summe aufzuheben.
Wird derzeit **nur angezeigt und fließt nicht in den Score**, bis genug echte Fälle vorliegen.

## Lokal

```bash
npm run build   # Daten holen und data/board.json schreiben (Node 18+)
npm start       # http://localhost:8371
```

Tests: `test/scoring.test.html` über den Dev-Server öffnen — 28 Prüfungen des Rechenmodells,
ohne Abhängigkeiten, weil `server/scoring.js` pures JavaScript ohne Node-APIs ist.

## Stand und Grenzen

- **Nicht backgetestet.** Sämtliche Gewichte und Schwellen (70/30, 1,2/0,6, ±3 %, ±1 pp) sind
  plausibel gesetzt, aber nie gegen historische Kurse validiert. Bis dahin ist das Board ein
  strukturierter Filter, kein validiertes Handelssystem.
- **Makrodaten teils veraltet.** Über DBnomics hinken Leitzinsen zurück, CPI fehlt für EUR und AUD.
  Da Zins-Momentum und Carry zusammen 45 % des Makro-Scores ausmachen, ist die Ablösung durch
  BIS/EZB/FRED/BoC direkt die wichtigste offene Aufgabe. Veraltete Serien zählen halb und werden
  markiert — das fängt den Mangel ab, heilt ihn aber nicht.
- **Retail-Sentiment hängt an einer einzigen Quelle** und wird aus HTML gelesen; ein Layout-Wechsel
  bei Myfxbook bricht den Adapter (er wirft dann, statt still leere Daten zu liefern).

Weiteres: [`HANDOVER.md`](HANDOVER.md) · [`docs/DATA-SOURCES.md`](docs/DATA-SOURCES.md)

## Disclaimer

Privates Analysewerkzeug. Keine Anlageberatung, keine Order-Ausführung, keine Broker-Anbindung.
Das System trifft keine Handelsentscheidungen und soll das auch nie tun.
