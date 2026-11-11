# Spustí SealedVault: v případě potřeby nainstaluje závislosti a zbuildí appku,
# na pozadí pustí lokální server (port 4173) a otevře appku v samostatném okně Edge.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$env:Path = "C:\Program Files\nodejs;" + $env:Path
$url = 'http://localhost:4173'

function Test-Server {
  try { Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 2 | Out-Null; return $true } catch { return $false }
}

try {
  if (-not (Test-Path 'node_modules')) { & npm.cmd install --no-audit --no-fund | Out-Null }
  if (-not (Test-Path 'dist\index.html')) { & npm.cmd run build | Out-Null }

  if (-not (Test-Server)) {
    Start-Process -FilePath 'node.exe' -ArgumentList 'node_modules/vite/bin/vite.js', 'preview', '--port', '4173', '--strictPort' `
      -WorkingDirectory $root -WindowStyle Hidden
    for ($i = 0; $i -lt 30 -and -not (Test-Server); $i++) { Start-Sleep -Milliseconds 500 }
    if (-not (Test-Server)) { throw 'Server se nepodařilo spustit.' }
  }

  Start-Process 'msedge.exe' "--app=$url"
} catch {
  Add-Type -AssemblyName PresentationFramework
  [System.Windows.MessageBox]::Show("SealedVault se nepodařilo spustit:`n$($_.Exception.Message)", 'SealedVault') | Out-Null
}
