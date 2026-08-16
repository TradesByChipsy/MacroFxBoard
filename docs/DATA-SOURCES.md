# Datenquellen — verifiziert

Alle Quellen sind kostenlos und ohne API-Key nutzbar. Status: **live getestet**, sofern nicht anders vermerkt.

---

## 1. CFTC — Commitments of Traders (COT)

**Status: einwandfrei, direkt im Browser nutzbar (CORS ok).** Die zuverlässigste Quelle im Projekt.

Basis: `https://publicreporting.cftc.gov/resource/6dca-aqww.json` (Socrata/SODA-API, Legacy Futures-Only)

Beispiel:
```
?cftc_contract_market_code=099741
&$where=report_date_as_yyyy_mm_dd > '2023-08-01'
&$order=report_date_as_yyyy_mm_dd ASC
&$select=report_date_as_yyyy_mm_dd,noncomm_positions_long_all,noncomm_positions_short_all,
         comm_positions_long_all,comm_positions_short_all,
         nonrept_positions_long_all,nonrept_positions_short_all,open_interest_all
&$limit=200
```

Contract-Codes:

| Future | Markt | Code |
|---|---|---|
| 6E | Euro FX | `099741` |
| 6J | Japanese Yen | `097741` |
| 6A | Australian Dollar | `232741` |
| 6C | Canadian Dollar | `090741` |
| — | US Dollar Index (ICE, nur Kontext) | `098662` |

Drei Händlergruppen (Netto = long − short):
- `noncomm_*` → **Large Speculators** (Trendfolger)
- `comm_*` → **Commercials** (Hedger / "Smart Money")
- `nonrept_*` → **Small Traders** (Crowd)

Fallstricke: Werte kommen als **Strings** (mit `+` casten). Datenstand ist jeweils **Dienstag**,
Veröffentlichung Freitag → beim Handeln immer ~3 Tage alt. Kein Key nötig, aber Rate-Limits bei
sehr vielen Requests; ein Token wäre optional möglich.

---

## 2. Wechselkurse — Frankfurter (EZB-Referenzkurse)

**Status: funktioniert, CORS ok.** Liefert das Preis-Momentum, den frischesten Faktor.

```
https://api.frankfurter.dev/v1/{start}..{end}?base=USD&symbols=EUR,JPY,AUD,CAD
Fallback: https://api.frankfurter.app/{start}..{end}?from=USD&to=EUR,JPY,AUD,CAD
```

**Wichtig — Vorzeichenfalle:** Die Rate ist "Fremdwährung pro USD". Steigt der Wert, wird die
Fremdwährung *schwächer*. Im Code daher negiert:
`stärke_der_basiswährung_in_prozent = -100 * (rate_neu / rate_alt - 1)`

Nur Bankarbeitstage, keine Wochenenden. Zeitraum großzügig wählen (32 Tage für ~30-Tage-Momentum).

---

## 3. Makrodaten — DBnomics (BIS + IMF)

**Status: funktioniert, CORS ok — aber mit erheblichen Datenlücken (siehe unten).**

```
https://api.db.nomics.world/v22/series/{provider}/{dataset}/{series}?observations=1
```
Antwort: `series.docs[0]` mit parallelen Arrays `period[]` und `value[]`.
Werte können `"NA"` sein → herausfiltern.

| Indikator | Serie |
|---|---|
| Leitzins | `BIS/WS_CBPOL/M.{US\|XM\|JP\|AU\|CA}` |
| Inflation (CPI YoY) | `IMF/IFS/M.{US\|U2\|JP\|AU\|CA}.PCPI_PC_CP_A_PT` |
| Arbeitslosenquote | `IMF/IFS/M.{US\|U2\|JP\|AU\|CA}.LUR_PT` |

Ländercodes: USA `US`, Eurozone `XM` (BIS) bzw. `U2` (IMF), Japan `JP`, Australien `AU`, Kanada `CA`.

### ⚠ Bekannte Probleme — hier liegt der größte Verbesserungshebel

Im Livebetrieb (Stand 08/2026) beobachtet:

- **Leitzinsen ~14 Monate alt** (letzter Stand `2025-06`). Der DBnomics-Spiegel der BIS-Serie
  aktualisiert offenbar nicht zuverlässig. Das ist gravierend, weil Zins-Momentum und Carry
  zusammen 45 % des Makro-Scores ausmachen.
- **CPI fehlt komplett für EUR und AUD** (`n/a`).
- **Arbeitslosenquote fehlt für EUR**, US-Wert war ~20 Monate alt.

**Empfohlene Ablösung** (für die App-Version, Priorität 1):
- Leitzinsen direkt von der BIS: `https://stats.bis.org/api/v2/data/dataflow/BIS/WS_CBPOL/...` (SDMX-JSON)
- Eurozone: EZB Data Portal `https://data-api.ecb.europa.eu/service/data/...` — HICP, Zinsen, Arbeitslosigkeit, sehr zuverlässig
- USA: FRED (kostenloser Key, serverseitig völlig unproblematisch) — `FEDFUNDS`, `CPIAUCSL`, `UNRATE`, **und `DGS2` für 2-Jahres-Renditen**
- Australien: RBA CSV, Kanada: Bank of Canada Valet API (`https://www.bankofcanada.ca/valet/observations/...`), Japan: BoJ / e-Stat

---

## 4. Wirtschaftskalender — ForexFactory

**Status: Inhalt verifiziert, ABER kein CORS-Header → nur serverseitig abrufbar.**

```
https://nfs.faireconomy.media/ff_calendar_thisweek.json
```
Felder: `title`, `country` (bereits als Währungscode: `USD`, `EUR`, `JPY`, `AUD`, `CAD`),
`date` (ISO mit Offset), `impact` (`High`/`Medium`/`Low`/`Holiday`), `forecast`, `previous`.

**Kein `actual`-Feld** — deshalb zusätzlich Quelle 5.

---

## 5. Veröffentlichte Zahlen inkl. Actual — Myfxbook RSS

**Status: Inhalt verifiziert, ABER kein CORS-Header → nur serverseitig abrufbar.**

```
https://www.myfxbook.com/rss/forex-economic-calendar-events
```
Rollierender Feed der letzten Stunden (~60 Items, alle Länder). XML/RSS.
Pro `<item>`: `<title>`, `<pubDate>`, `<link>` und ein `<description>` mit **HTML-escapter Tabelle**,
die `Previous | Consensus | Actual` enthält. Impact steckt als CSS-Klasse drin:
`sprite-(high|medium|low|no)-impact`.

Währungszuordnung über den Link-Slug:
`/forex-economic-calendar/{united-states|japan|australia|canada|euro-area|germany|france|...}/`
→ Mapping-Tabelle im Code (`SLUG2CCY`).

Das ist die **einzige verifizierte freie Quelle mit Actual-Werten** — Grundlage für das geplante
Überraschungs-Scoring (Actual vs. Consensus).

---

## 6. Retail-Sentiment — Myfxbook Community Outlook

**Status: live verifiziert (16.08.2026), kein Key, kein Login. Kein CORS-Header → nur serverseitig.**

```
https://www.myfxbook.com/community/outlook
```

Gegenstück zur COT-Seite: dort die großen Spekulanten, hier die Retail-Crowd. Die Werte stehen
im **statischen HTML** (serverseitig gerendert), kein JavaScript nötig — 72 Symbole pro Abruf.
Adapter: [`server/sources/retail.js`](../server/sources/retail.js).

Je Symbol eine `<tr class="outlook-symbol-row" symbolName="EURUSD">` mit:
- Balkenbreiten `progress-bar-danger` (= Short %) und `progress-bar-success` (= Long %)
- versteckte Popover-Tabelle mit `Percentage | Volume (lots) | Positions` je Richtung

> **Nicht die offizielle API verwenden.** `/api/get-community-outlook.json` antwortet ohne
> Session mit `{"error":true,"message":"Required fields missing."}` — sie verlangt einen
> Account-Login. Die öffentliche Seite liefert dieselben Zahlen ohne Zugangsdaten.

**Vorzeichenfalle, zweite Auflage:** Myfxbook quotet `USDJPY` und `USDCAD`, das Board rechnet
aber immer Basiswährung gegen USD. „52 % long USDJPY" heißt *48 % long JPY*. Im Adapter über
`invert: true` gedreht — betrifft 6J und 6C, also die Hälfte der Futures.

| Future | Myfxbook-Paar | invertiert |
|---|---|---|
| 6E | `EURUSD` | nein |
| 6J | `USDJPY` | **ja** |
| 6A | `AUDUSD` | nein |
| 6C | `USDCAD` | **ja** |

**Frequenz:** quasi live (Minutentakt). Damit trifft ein tagesaktueller Retail-Stand auf einen
COT-Stand vom Dienstag davor — beide Zeitstempel gehören auf die Karte, sonst liest man eine
Divergenz, die es so nie gleichzeitig gab.

Robustheit: reines HTML-Scraping, bricht bei jedem Layout-Wechsel. Der Adapter wirft, wenn keine
`outlook-symbol-row` gefunden wird, statt stumm leere Daten zu liefern.

---

## CORS-Situation (Kern des Umzugs)

| Quelle | Direkt im Browser |
|---|---|
| CFTC, Frankfurter, DBnomics | ✅ funktioniert |
| ForexFactory, Myfxbook (RSS + Outlook) | ❌ blockiert |

Öffentliche Proxy-Dienste (corsproxy.io, allorigins, codetabs) wurden getestet und scheitern im
Zielnetz (`Failed to fetch` bzw. `HTTP 403`). **Konsequenz: eigener Server.** Genau das leistet
das Node-Scaffold in `server/` — serverseitig existiert das Problem nicht.
