@echo off
setlocal

cd /d "%~dp0"

if not exist package.json (
  echo No se encontro package.json en %cd%.
  exit /b 1
)

echo Iniciando backend y frontend con npm run dev:all...
start "Inventario Web" cmd /k "npm run dev:all"

echo Espera unos segundos mientras se levanta el front...
timeout /t 4 >nul

echo Abriendo http://localhost:5173/
start "" "http://localhost:5173/"

endlocal
exit /b 0
