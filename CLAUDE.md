# Macro FX Decision Board

Vollautomatisches Makro-Scoring für CME-Währungsfutures (6E, 6J, 6A, 6C).
Ziel: **objektiver Richtungs-Bias pro Future aus offiziellen Daten** — ohne manuelle Bewertung.
Der eigentliche Einstieg passiert danach semi-manuell intraday über Volumen/Orderflow.

## Kernprinzip

Das Board sagt **nicht**, wann man einsteigt. Es sagt, **ob und in welche Richtung** ein Future
heute überhaupt handelbar ist. Drei Zustände pro Future: `LONG` / `SHORT` / `Tendenz` / `KEIN TRADE`.
"Kein Trade" ist ein gültiges, gewolltes Ergebnis — bei widersprüchlicher Datenlage soll das System flat sein.

## Nicht verhandelbare Design-Regeln

1. **Keine manuelle Dateneingabe.** Jeder Faktor muss aus einer freien, offiziellen Quelle automatisch ableitbar sein.
   Subjektive Scorecards wurden bewusst verworfen.
2. **Datenherkunft ist immer sichtbar.** Jeder Wert zeigt seinen Stand; veraltete Serien werden markiert
   und heruntergewichtet, nicht stillschweigend verwendet.
3. **Keine erfundenen Zahlen.** Fehlt eine Quelle, fliegt der Faktor raus und die Gewichte renormalisieren sich.
4. **Frische schlägt Präzision.** Für Intraday-Handel sind tagesaktuelle Marktdaten wertvoller als exakte,
   aber drei Monate alte Statistiken.

## Aktueller Stand

Scoring liegt im Backend (`server/scoring.js`), das Frontend zeigt nur noch `data/board.json` an.
**GitHub Actions ist das Backend**: Es holt die Feeds (im Runner existiert das CORS-Problem nicht),
rechnet, committet `data/board.json` plus einen Snapshot nach `data/history/`; Pages liefert statisch aus.
Damit ist CORS gelöst und die Signal-Historie fällt nebenbei ab.

Neu im Modell: **Divergenz Large Specs gegen Retail-Crowd** (CFTC vs. Myfxbook Community Outlook).
Multiplikativ statt additiv — Richtung von den Specs, Stärke aus dem Retail-Extrem. Wird vorerst
nur angezeigt und fließt **nicht** in den Gesamtscore.

## Nächster Schritt

1. Erste Actions-Läufe beobachten und Pages aktivieren.
2. Datenqualität retten: Leitzinsen/CPI direkt von BIS/EZB/FRED/BoC statt DBnomics (Priorität 1 —
   ohne das ist knapp die Hälfte des Makro-Scores wertlos).
3. Nach ein paar Wochen Historie: Divergenz-Gewichtung festlegen und Backtest rechnen.

## Arbeitsregeln

- **Node ist auf dem Entwicklungsrechner nicht installiert.** `server/scoring.js` ist deshalb
  bewusst pures JavaScript ohne Node-APIs und über `test/scoring.test.html` im Browser testbar.
  Diese Eigenschaft nicht aufgeben.
- Änderungen am Rechenmodell immer gegen `test/scoring.test.html` prüfen (28 Tests).

## Wichtige Dokumente

- `HANDOVER.md` — vollständige Übergabe, Zielarchitektur, Roadmap
- `docs/DATA-SOURCES.md` — alle Endpunkte, verifiziert, mit Response-Shapes und Fallstricken
- `docs/SCORING.md` — das Rechenmodell exakt wie implementiert
- `server/` — minimales Node-Scaffold als Startpunkt

## Disclaimer

Privates Analysewerkzeug. Keine Anlageberatung, keine Order-Ausführung, keine Broker-Anbindung.
Das System trifft keine Handelsentscheidungen und soll das auch nie tun.
