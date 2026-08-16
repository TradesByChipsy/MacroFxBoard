# Scoring-Modell — exakt wie implementiert

Alle Faktoren liefern einen Score von **−2 bis +2**, immer aus Sicht der **Basiswährung gegen USD**
(positiv = Basiswährung stark = Future steigt). `clamp(x, -2, 2)` überall.

---

## Makro-/Markt-Score (70 % des Gesamtscores)

| Faktor | Gewicht | Formel | Max bei |
|---|---|---|---|
| Preis-Momentum 30 T | 30 % | `pct * 2/3` | ±3 % |
| Zins-Momentum Δ12M | 25 % | `(Δbase − ΔUSD) * 2` | ±1 pp |
| Zinsniveau / Carry | 20 % | `(base − USD) / 1.5` | ±3 pp |
| Inflationsdruck | 15 % | `cpi_base − cpi_USD` | ±2 pp |
| Arbeitsmarkt-Trend | 10 % | `−(Δunemp_base − Δunemp_USD) * 4` | ±0,5 pp |

Ergebnis = gewichtetes Mittel über alle **verfügbaren** Faktoren (Gewichte werden renormalisiert).

**Vorzeichen-Logik:** Höherer/steigender Zins, höhere Inflation (→ Erwartung restriktiverer Politik)
und *fallende* Arbeitslosigkeit sind positiv für die Währung. Beim Arbeitsmarkt daher das Minus:
sinkende Quote = Stärke.

### Datenalter (`ageW`)
- frisch (< 240 Tage) → Gewicht × 1
- veraltet (240–900 Tage) → Gewicht × **0,5**, Markierung „⚠ alt"
- älter als 900 Tage → Faktor fliegt raus

Bei Differenzen zählt jeweils das **schlechtere** Alter beider Währungen (`Math.min`).

---

## COT-Score (30 % des Gesamtscores)

Drei Gruppen, jeweils als **COT-Index** = Lage der aktuellen Netto-Position im 3-Jahres-Band (0–100):
`index = 100 * (aktuell − min) / (max − min)`

| Gruppe | Gewicht | Formel | Logik |
|---|---|---|---|
| Large Specs | 50 % | `(idx − 50) / 25` | Trendfolgend |
| Commercials | 30 % | `(commIdx − 50) / 25` | **Kontrár-bestätigend** (Smart Money akkumuliert am Wendepunkt) |
| Small Traders | 20 % | `−(smallIdx − 50) / 25` | **Strikt kontrár** (Crowd irrt an Extremen) |

### Squeeze-Regel (wichtigster Mechanismus)

Bei extremer Specs-Positionierung (`idx ≥ 90` oder `idx ≤ 10`):

```js
if (idx <= 10 && preisMomentum > +0.5)  sSpec = +1.0;   // Short-Squeeze
else if (idx >= 90 && preisMomentum < -0.5) sSpec = -1.0;   // Long-Squeeze
else sSpec *= 0.5;                                      // sonst nur dämpfen
```

Begründung: Sind alle Spekulanten short und der Preis dreht trotzdem nach oben, sitzen sie in der
Falle und müssen eindecken → Treibstoff nach oben. Ohne Preisbestätigung ist ein Extrem nur
Reversal-*Risiko*, keine Richtungsaussage — deshalb dann Halbierung statt Verstärkung.

---

## Gesamtscore und Schwellen

```
total = 0.7 * makroScore + 0.3 * cotScore
```
Fehlt eine Seite komplett, zählt die andere allein (mit Warnhinweis auf der Karte).

| Bedingung | Signal |
|---|---|
| `total ≥ +1.2` | **LONG** |
| `total ≤ −1.2` | **SHORT** |
| `0.6 ≤ \|total\| < 1.2` | **Tendenz** (nur A+-Setups, reduzierte Größe) |
| `\|total\| < 0.6` | **KEIN TRADE** |

---

## Events

High-Impact-Termine der Basis- oder US-Währung innerhalb **±48 h** erzeugen eine Warnung auf der
Future-Karte. Sie verändern den Score aktuell **nicht** — das ist bewusst so, siehe Roadmap
(Überraschungs-Scoring erst, wenn Actual-Werte systematisch ausgewertet werden).

---

## Kalibrierung — ungeprüft

Sämtliche Schwellen und Normierungen (±3 %, ±1 pp, 70/30, 1,2/0,6) sind **plausibel gesetzt, aber
nicht empirisch validiert**. Ein Backtest gegen historische Futures-Kurse steht aus und ist der
wichtigste inhaltliche Punkt der Roadmap. Bis dahin: Das Board ist ein strukturierter Filter,
kein validiertes Handelssystem.
