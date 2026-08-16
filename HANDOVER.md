# Übergabe an Claude Code

## Ausgangslage in einem Absatz

Es geht um Makro-Trading von CME-Währungsfutures (6E Euro, 6J Yen, 6A Aussie, 6C CAD).
Die Idee: Wenn Währung A fundamental stark und Währung B schwach ist, bewegt sich der Kurs
verlässlich in eine Richtung — man muss nur objektiv bestimmen können, welche Währung gerade
wo steht. Genau das macht dieses Board: Es leitet aus offiziellen Daten automatisch einen
Richtungs-Bias pro Future ab. Der Einstieg selbst passiert danach manuell intraday über
Volumen/Orderflow (Breakout-Retest an Volumenzonen etc.) — **nur in Richtung des Bias**.

Entstanden ist eine funktionierende Single-File-HTML-Anwendung. Sie soll jetzt eine echte App werden.

## Was funktioniert

- Vollautomatisches Scoring aus fünf Makro-/Marktfaktoren plus dreistufiger COT-Analyse
- Signalableitung je Future: LONG / SHORT / Tendenz / KEIN TRADE, mit voller Aufschlüsselung
  jedes Faktorbeitrags (keine Blackbox)
- Squeeze-Erkennung: extreme Positionierung + gegenläufiges Preis-Momentum wird kontrár gewertet
- Datenalter-Handling: veraltete Serien werden halbiert und markiert statt still verwendet
- Wochenkalender und News-Feed inkl. Actual/Consensus (nur mit Server, siehe unten)

## Was nicht funktioniert — und warum umgezogen wird

**1. CORS blockiert die Event-Feeds.** ForexFactory und Myfxbook senden keine CORS-Header.
Öffentliche Proxy-Dienste wurden getestet und scheitern im Zielnetz reproduzierbar
(`Failed to fetch`, `HTTP 403`). Ein PowerShell-Server als Workaround liegt in `legacy/` und
funktioniert, ist aber als Dauerlösung unbrauchbar. → **Ein eigenes Backend löst das sauber.**

**2. Die Makrodaten sind teilweise unbrauchbar veraltet.** Über DBnomics kamen Leitzinsen mit
Stand `2025-06` (~14 Monate alt), CPI fehlte für EUR und AUD komplett. Da Zins-Momentum und
Carry zusammen 45 % des Makro-Scores ausmachen, ist das der größte inhaltliche Mangel.
→ Direkte Quellen anbinden (BIS SDMX, EZB Data Portal, FRED, Bank of Canada Valet, RBA).

**3. Nichts ist backgetestet.** Alle Gewichte und Schwellen sind plausibel gesetzt, aber nie
gegen historische Kurse validiert.

---

## Zielarchitektur

```
macro-fx-board/
├─ server/           Node-Backend: Feed-Abruf, Normalisierung, Cache, Scoring-API
│   ├─ index.js      ← vorhandenes Scaffold (Static + Proxy, keine Dependencies)
│   ├─ sources/      je Quelle ein Adapter (cftc, bis, ecb, fred, boc, frankfurter, calendar)
│   └─ scoring.js    Rechenmodell, aus dem HTML extrahiert
├─ web/              Frontend
│   └─ index.html    ← aktueller Stand, lauffähig
├─ data/             SQLite o. ä. für Historie (Voraussetzung für Backtest)
└─ docs/
```

**Kernidee der Trennung:** Das Scoring gehört ins Backend, nicht ins Frontend. Erst dann lassen
sich Historie speichern, Signale nachvollziehen und Backtests rechnen. Das Frontend wird zur
reinen Darstellung, die eine fertige JSON-API konsumiert (`GET /api/board`).

Der Node-Server im Scaffold hat **keine Dependencies** (Node 18+ reicht). Ob es dabei bleibt oder
Express/Fastify dazukommt, ist eine offene Entscheidung — für den Anfang trägt es.

### Sofort lauffähig

```bash
cd macro-fx-board
npm start          # → http://localhost:8371
```

Das behebt CORS auf der Stelle: Das Frontend ruft `/proxy?url=...` auf, der Server holt den Feed.
Die Quellen-Whitelist steht in `server/index.js`.

> **Prüfstand des Scaffolds:** Statische Auslieferung, `/health`, Routing, Whitelist-Abweisung und
> Cache-Logik sind getestet und laufen (Node 22). Der eigentliche Upstream-Abruf ließ sich in der
> Testumgebung nicht verifizieren, weil deren Netzwerk nur bestimmte Domains zulässt — auf einem
> normalen Rechner ist das kein Thema, beide Feeds wurden inhaltlich separat verifiziert.
> Beim ersten Start also einmal `curl "http://localhost:8371/proxy?url=https://nfs.faireconomy.media/ff_calendar_thisweek.json"`
> gegenprüfen.

---

## Roadmap, nach Wirkung sortiert

**1. Datenqualität retten (höchste Priorität).**
Leitzinsen, CPI und Arbeitsmarkt direkt von BIS/EZB/FRED/BoC/RBA statt über DBnomics.
Ohne das ist knapp die Hälfte des Makro-Scores wertlos. Endpunkte stehen in `docs/DATA-SOURCES.md`.

**2. 2-Jahres-Renditen als Faktor.**
Der Leitzins ist ein träger Proxy — der Markt preist Zinsänderungen vorher ein. Die Differenz der
2J-Staatsanleiherenditen ist der deutlich bessere Erwartungs-Indikator und in der Praxis der
stärkste Einzeltreiber für FX. Über FRED (`DGS2`) und nationale Quellen serverseitig machbar.
Vorschlag: Zins-Momentum teilweise dadurch ersetzen.

**3. Überraschungs-Scoring.**
Der Myfxbook-Feed liefert Actual vs. Consensus. Systematisch ausgewertet ergibt das einen
kurzfristigen Impuls-Faktor („CPI 0,4 pp über Erwartung → Währung positiv für 1–3 Tage").
Genau der Baustein, der Intraday-Signale schärft.

**4. Historie speichern.**
Jeden Lauf mit Zeitstempel persistieren. Voraussetzung für alles Weitere und billig zu haben.

**5. Backtest.**
Historische Futures-Kurse gegen historische Scores. Erst danach lassen sich Gewichte und
Schwellen (70/30, 1,2/0,6) ehrlich kalibrieren statt zu raten.

**6. Intraday-Regelwerk.**
Der ursprünglich geplante nächste inhaltliche Schritt: konkrete Einstiegsregeln (Volume Profile,
Value Area, Absorption, Breakout-Retest) passend zum jeweiligen Bias. Bewusst semi-manuell.

---

## Fachliche Hinweise, die man beim Weiterbauen kennen sollte

- **Frankfurter-Vorzeichenfalle:** Rate = Fremdwährung pro USD. Steigende Rate = *schwächere*
  Fremdwährung. Im Code negiert. Klassische Fehlerquelle.
- **COT ist immer ~3 Tage alt** (Stand Dienstag, Publikation Freitag). Kein Intraday-Werkzeug,
  sondern Positionierungs-Kontext.
- **Commercials sind in FX weitgehend das Spiegelbild der Specs** — jemand muss die Gegenseite
  halten. Der echte Zusatznutzen steckt in den Small Traders und in der Squeeze-Regel
  (Positionierung × Preisverhalten), nicht in den Commercials allein.
- **„KEIN TRADE" ist ein Feature.** Bei widersprüchlicher Datenlage soll das System flat sein.
  Nicht wegoptimieren.
- **Alle Zahlen der CFTC-API kommen als Strings.**

## Grenzen

Privates Analysewerkzeug, keine Anlageberatung. Keine Order-Ausführung, keine Broker-Anbindung —
das System soll nie selbst handeln. Alle Datenquellen sind frei und ohne Key nutzbar
(Ausnahme: FRED, kostenloser Key, serverseitig unkritisch).
