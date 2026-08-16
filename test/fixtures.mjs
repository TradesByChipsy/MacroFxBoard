// Temporäre Testdaten. Retail-Werte sind die echten Myfxbook-Stände vom 16.08.2026.
const months = (n, start, step) => Array.from({ length: n }, (_, i) => {
  const d = new Date(2026, 7 - (n - 1 - i), 1);
  return { p: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, v: +(start + step * i).toFixed(2) };
});
const series = (n, s, st) => ({ key: "FIXTURE", obs: months(n, s, st) });
const now = Date.now();

export const macro = {
  USD: { policy: series(24, 4.0, 0), cpi: series(24, 2.5, 0), unemp: series(24, 4.0, 0) },
  EUR: { policy: series(24, 2.0, 0.02), cpi: series(24, 2.0, 0), unemp: series(24, 6.5, -0.01) },
  JPY: { policy: series(24, 0.5, 0), cpi: series(24, 3.0, 0), unemp: series(24, 2.5, 0) },
  AUD: { policy: series(24, 4.35, 0), cpi: series(24, 3.5, 0), unemp: series(24, 4.1, 0) },
  CAD: { policy: series(24, 2.75, 0), cpi: series(24, 2.0, 0), unemp: series(24, 6.9, 0) },
};
export const cot = {
  "099741": { index: 20, net: -40000, netPct: -6.2, chg6w: 5000, commIdx: 70, commNet: 45000, smallIdx: 55, smallNet: -5000, date: "2026-08-11" },
  "097741": { index: 50, net: 0, netPct: 0, chg6w: 0, commIdx: 50, commNet: 0, smallIdx: 50, smallNet: 0, date: "2026-08-11" },
  "232741": { index: 85, net: 30000, netPct: 9.1, chg6w: 8000, commIdx: 30, commNet: -28000, smallIdx: 60, smallNet: 3000, date: "2026-08-11" },
  "090741": { index: 95, net: 60000, netPct: 12.0, chg6w: 9000, commIdx: 20, commNet: -55000, smallIdx: 65, smallNet: 4000, date: "2026-08-11" },
};
export const retail = {
  "099741": { base: "EUR", pair: "EURUSD", inverted: false, longPct: 35, shortPct: 65, retailPos: -0.30, ts: "2026-08-16T09:00:00Z" },
  "097741": { base: "JPY", pair: "USDJPY", inverted: true, longPct: 52, shortPct: 48, retailPos: 0.04, ts: "2026-08-16T09:00:00Z" },
  "232741": { base: "AUD", pair: "AUDUSD", inverted: false, longPct: 20, shortPct: 80, retailPos: -0.60, ts: "2026-08-16T09:00:00Z" },
  "090741": { base: "CAD", pair: "USDCAD", inverted: true, longPct: 36, shortPct: 64, retailPos: -0.28, ts: "2026-08-16T09:00:00Z" },
};
export const fx = { from: "2026-07-15", date: "2026-08-14", days: 22, EUR: 1.5, JPY: -0.8, AUD: 2.4, CAD: -2.0 };
export const events = [
  { title: "ECB Main Refinancing Rate", c: "EUR", date: new Date(now + 6 * 3600e3).toISOString(), impact: "High", fc: "2.15%", prev: "2.15%" },
  { title: "Core CPI m/m", c: "USD", date: new Date(now - 20 * 3600e3).toISOString(), impact: "High", fc: "0.3%", prev: "0.2%" },
  { title: "Employment Change", c: "AUD", date: new Date(now + 30 * 3600e3).toISOString(), impact: "Medium", fc: "25.0K", prev: "18.2K" },
];
export const recent = [
  { ccy: "USD", title: "Core CPI m/m", date: new Date(now - 20 * 3600e3).toISOString(), impact: "high", prev: "0.2%", cons: "0.3%", act: "0.5%", surprise: 0.2 },
  { ccy: "CAD", title: "Manufacturing Sales", date: new Date(now - 3 * 3600e3).toISOString(), impact: "medium", prev: "1.1%", cons: "0.4%", act: "0.4%", surprise: 0 },
];
export const sources = {
  macro: { ok: true }, cot: { ok: true }, fx: { ok: true },
  retail: { ok: true }, calendar: { ok: true }, recent: { ok: false, error: "HTTP 503" },
};
