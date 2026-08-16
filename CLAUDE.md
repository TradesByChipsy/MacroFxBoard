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

Single-File-HTML (`web/index.html`), lauffähig, alle Datenquellen verifiziert.
**Offenes Hauptproblem:** Die beiden Event-Feeds brauchen einen serverseitigen Proxy (CORS).
Der PowerShell-Workaround in `legacy/` funktioniert, ist aber der Grund für den Umzug nach Claude Code.

## Nächster Schritt

Überführung in eine echte App mit Node-Backend (siehe `HANDOVER.md`, Abschnitt "Zielarchitektur").
Das Backend löst CORS, cached serverseitig und ermöglicht Historie/Backtest.

## Wichtige Dokumente

- `HANDOVER.md` — vollständige Übergabe, Zielarchitektur, Roadmap
- `docs/DATA-SOURCES.md` — alle Endpunkte, verifiziert, mit Response-Shapes und Fallstricken
- `docs/SCORING.md` — das Rechenmodell exakt wie implementiert
- `server/` — minimales Node-Scaffold als Startpunkt

## Disclaimer

Privates Analysewerkzeug. Keine Anlageberatung, keine Order-Ausführung, keine Broker-Anbindung.
Das System trifft keine Handelsentscheidungen und soll das auch nie tun.
