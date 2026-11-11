@echo off
rem Spusti lokalni server s appkou a otevre ji v Edge jako samostatne okno.
rem Po instalaci appky v Edge (ikona v adresnim radku) uz server neni potreba:
rem appka bezi offline ze sve mezipameti. Tento soubor pak slouzi hlavne pro aktualizace.
cd /d "%~dp0"
set "PATH=C:\Program Files\nodejs;%PATH%"

if not exist node_modules (
  echo Instaluji zavislosti...
  call npm install || goto :error
)
if not exist dist\index.html (
  echo Builduji aplikaci...
  call npm run build || goto :error
)

curl -s -o nul http://localhost:4173 && goto :open
echo Spoustim server na http://localhost:4173 ...
start "Sealed Portfolio - server (zavrenim ukoncis)" /min cmd /c "npx vite preview --port 4173 --strictPort"

for /l %%i in (1,1,30) do (
  curl -s -o nul http://localhost:4173 && goto :open
  timeout /t 1 /nobreak >nul
)
goto :error

:open
start "" msedge --app=http://localhost:4173
exit /b 0

:error
echo.
echo Neco se nepovedlo. Zkontroluj, ze je nainstalovany Node.js (https://nodejs.org).
pause
exit /b 1
