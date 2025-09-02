@echo off
echo Starting Repair Shop Development Environment...
echo.

echo Starting Backend Server (Port 3000)...
start "Backend Server" cmd /k "cd repairshop-backend && npm run dev"

echo Waiting for backend to start...
timeout /t 3 /nobreak > nul

echo Starting Frontend Server (Port 3001)...
start "Frontend Server" cmd /k "cd repairshop-frontend && npm run dev"

echo.
echo Development servers are starting...
echo Backend: http://localhost:3000
echo Frontend: http://localhost:3001
echo.
echo Press any key to close this window...
pause > nul
