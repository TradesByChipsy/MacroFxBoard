/**
 * Macro FX Decision Board — minimaler Server (Node 18+, keine Dependencies)
 *
 *   node server/index.js     →  http://localhost:8371
 *
 * Zweck: liefert web/ aus und stellt data/ bereit, damit das Board lokal genauso
 * läuft wie auf GitHub Pages. Der /proxy bleibt für Experimente mit rohen Feeds.
 *
 * In Produktion ist dieser Server NICHT beteiligt: Dort holt der Actions-Workflow
 * die Daten und Pages liefert die statischen Dateien aus. Das hier ist der
 * Entwicklungsserver — erst `npm run build`, dann `npm start`.
 */

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const PORT = process.env.PORT || 8371;
const PROJECT = fileURLToPath(new URL("..", import.meta.url));
const ROOT = join(PROJECT, "web");
const DATA = join(PROJECT, "data");

// Nur diese Hosts darf der Proxy abrufen
const ALLOWED = new Set([
  "nfs.faireconomy.media",
  "cdn-nfs.faireconomy.media",
  "www.myfxbook.com",
  "api.db.nomics.world",
  "publicreporting.cftc.gov",
  "api.frankfurter.dev",
  "api.frankfurter.app",
  "stats.bis.org",
  "data-api.ecb.europa.eu",
  "www.bankofcanada.ca",
]);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

// Simpler In-Memory-Cache: Feeds 10 min, alles andere 6 h
const cache = new Map();
const ttlFor = (host) =>
  host.includes("faireconomy") || host.includes("myfxbook") ? 10 * 60e3 : 6 * 3600e3;

async function proxy(target, res) {
  let url;
  try {
    url = new URL(target);
  } catch {
    res.writeHead(400).end("ungültige URL");
    return;
  }
  if (!ALLOWED.has(url.host)) {
    res.writeHead(403).end("Host nicht erlaubt: " + url.host);
    return;
  }

  const hit = cache.get(target);
  if (hit && Date.now() - hit.ts < ttlFor(url.host)) {
    res.writeHead(200, { "content-type": hit.ct, "x-cache": "HIT" }).end(hit.body);
    return;
  }

  try {
    const upstream = await fetch(target, {
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        accept: "*/*",
      },
      signal: AbortSignal.timeout(20_000),
    });
    const body = Buffer.from(await upstream.arrayBuffer());
    const ct = upstream.headers.get("content-type") || "application/octet-stream";
    if (upstream.ok) cache.set(target, { ts: Date.now(), body, ct });
    res.writeHead(upstream.status, { "content-type": ct, "x-cache": "MISS" }).end(body);
    console.log(`  proxy ${upstream.status}  ${url.host}${url.pathname}`);
  } catch (err) {
    console.warn(`  proxy FEHLER ${url.host}: ${err.message}`);
    res.writeHead(502).end("Upstream-Fehler: " + err.message);
  }
}

createServer(async (req, res) => {
  res.setHeader("access-control-allow-origin", "*");
  const { pathname, searchParams } = new URL(req.url, `http://localhost:${PORT}`);

  if (pathname === "/proxy") return proxy(searchParams.get("url") || "", res);
  if (pathname === "/health") return res.writeHead(200).end("ok");

  // data/ liegt neben web/, nicht darin — auf Pages stellt der Workflow das zusammen.
  const fromData = pathname.startsWith("/data/");
  const base = fromData ? DATA : ROOT;
  const rel = fromData ? pathname.slice("/data/".length) : pathname === "/" ? "index.html" : pathname.slice(1);
  const path = normalize(join(base, rel));
  if (!path.startsWith(base)) return res.writeHead(403).end();
  try {
    const buf = await readFile(path);
    res.writeHead(200, { "content-type": MIME[extname(path)] || "application/octet-stream" }).end(buf);
  } catch {
    res.writeHead(404).end("nicht gefunden");
  }
}).listen(PORT, () => {
  console.log(`\n  Macro FX Decision Board:  http://localhost:${PORT}\n`);
});
