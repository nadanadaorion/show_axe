@echo off
setlocal
cd /d "%~dp0"

echo Eliminando instalaciones incompletas...
if exist node_modules rmdir /s /q node_modules

where npm >nul 2>nul
if errorlevel 1 (
  echo npm no esta disponible. Reinstala Node.js LTS.
  pause
  exit /b 1
)

call npm cache clean --force
call npm cache verify
call npm install --no-audit --no-fund
if errorlevel 1 (
  echo.
  echo La reparacion no pudo completarse.
  echo Ejecuta node -v y npm -v y comparte los resultados.
  pause
  exit /b 1
)

call npm run dev
