@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js no esta instalado.
  echo Instala una version LTS de Node.js y vuelve a ejecutar este archivo.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo npm no esta disponible. Reinstala Node.js LTS.
  pause
  exit /b 1
)

if not exist "node_modules\.bin\vite.cmd" (
  echo Preparando una instalacion limpia...
  if exist node_modules rmdir /s /q node_modules
  call npm cache verify
  if errorlevel 1 goto :error
  call npm install --no-audit --no-fund
  if errorlevel 1 goto :error
)

echo Abriendo Ori^♡n Shows...
call npm run dev
exit /b 0

:error
echo.
echo No se pudieron instalar las dependencias.
echo Ejecuta REPARAR_E_INICIAR.bat para limpiar todo e intentarlo de nuevo.
pause
exit /b 1
