@echo off
setlocal
cd /d "%~dp0"
if not exist node_modules call npm install
call npm run build
if errorlevel 1 (
  echo La compilacion fallo.
  pause
  exit /b 1
)
echo Compilacion terminada. Los archivos publicables estan en dist.
pause
