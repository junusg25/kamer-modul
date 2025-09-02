@echo off
echo Starting Repair Shop Development Environment...
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if .env file exists in backend
if not exist "repairshop-backend\.env" (
    echo WARNING: .env file not found in backend
    echo Creating .env from env.example...
    copy "repairshop-backend\env.example" "repairshop-backend\.env"
    echo Please edit repairshop-backend\.env with your configuration
)

REM Check if node_modules exist in backend
if not exist "repairshop-backend\node_modules" (
    echo Installing backend dependencies...
    cd repairshop-backend
    npm install
    cd ..
)

REM Check if node_modules exist in frontend
if not exist "repairshop-frontend\node_modules" (
    echo Installing frontend dependencies...
    cd repairshop-frontend
    npm install
    cd ..
)

echo.
echo Starting Backend Server (Port 3000)...
start "Backend Server" cmd /k "cd repairshop-backend && npm run dev"

echo Waiting for backend to start...
timeout /t 5 /nobreak > nul

echo Starting Frontend Server (Port 3001)...
start "Frontend Server" cmd /k "cd repairshop-frontend && npm run dev"

echo.
echo Development servers are starting...
echo Backend: http://localhost:3000
echo Frontend: http://localhost:3001
echo.
echo NOTE: Make sure to configure your .env file in repairshop-backend if you haven't already
echo.
echo Press any key to close this window...
pause > nul
