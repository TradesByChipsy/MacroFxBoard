# Macro FX Decision Board — lokaler Mini-Server mit Feed-Proxy
# Start: Doppelklick auf Start-Board.bat (oder: powershell -ExecutionPolicy Bypass -File board-server.ps1)
# Stop:  Fenster schließen oder Strg+C

$port = 8371
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

# Nur diese Hosts darf der Proxy abrufen (Sicherheit)
$allowedHosts = @(
  "nfs.faireconomy.media",
  "cdn-nfs.faireconomy.media",
  "www.myfxbook.com",
  "api.db.nomics.world",
  "publicreporting.cftc.gov",
  "api.frankfurter.dev",
  "api.frankfurter.app"
)

$mime = @{ ".html"="text/html; charset=utf-8"; ".js"="text/javascript"; ".css"="text/css";
           ".json"="application/json"; ".png"="image/png"; ".ico"="image/x-icon" }

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
try { $listener.Start() } catch {
  Write-Host "Port $port belegt? Läuft der Server evtl. schon? ($_)" -ForegroundColor Yellow
  Start-Process "http://localhost:$port/macro-fx-decision-board.html"
  exit
}
Write-Host ""
Write-Host "  Macro FX Decision Board läuft: http://localhost:$port/macro-fx-decision-board.html" -ForegroundColor Green
Write-Host "  Fenster offen lassen. Beenden mit Strg+C oder Fenster schließen." -ForegroundColor DarkGray
Write-Host ""
Start-Process "http://localhost:$port/macro-fx-decision-board.html"

while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
    $req = $ctx.Request
    $res = $ctx.Response
    $res.Headers.Add("Access-Control-Allow-Origin","*")
    try {
      if ($req.Url.AbsolutePath -eq "/proxy") {
        $target = $req.QueryString["url"]
        $uri = $null
        $ok = [Uri]::TryCreate($target, [UriKind]::Absolute, [ref]$uri)
        if (-not $ok -or $allowedHosts -notcontains $uri.Host) {
          $res.StatusCode = 403
          $msg = [Text.Encoding]::UTF8.GetBytes("Host nicht erlaubt")
          $res.OutputStream.Write($msg,0,$msg.Length)
        } else {
          $wc = New-Object System.Net.WebClient
          $wc.Headers.Add("User-Agent","Mozilla/5.0 (Windows NT 10.0; Win64; x64)")
          $wc.Headers.Add("Accept","*/*")
          $bytes = $wc.DownloadData($target)
          $ct = $wc.ResponseHeaders["Content-Type"]
          if ($ct) { $res.ContentType = $ct } else { $res.ContentType = "application/octet-stream" }
          $res.OutputStream.Write($bytes,0,$bytes.Length)
          Write-Host ("  proxy  OK   " + $uri.Host + $uri.AbsolutePath) -ForegroundColor DarkGray
        }
      } else {
        # Statische Datei ausliefern
        $rel = $req.Url.AbsolutePath.TrimStart("/")
        if ($rel -eq "") { $rel = "macro-fx-decision-board.html" }
        $path = [IO.Path]::GetFullPath((Join-Path $root $rel))
        if ((Test-Path $path) -and ($path.StartsWith([IO.Path]::GetFullPath($root)))) {
          $ext = [IO.Path]::GetExtension($path).ToLower()
          if ($mime.ContainsKey($ext)) { $res.ContentType = $mime[$ext] }
          $bytes = [IO.File]::ReadAllBytes($path)
          $res.OutputStream.Write($bytes,0,$bytes.Length)
        } else {
          $res.StatusCode = 404
        }
      }
    } catch {
      Write-Host ("  Fehler: " + $_.Exception.Message) -ForegroundColor Yellow
      try { $res.StatusCode = 502 } catch {}
    } finally {
      try { $res.OutputStream.Close() } catch {}
    }
  } catch { break }
}
