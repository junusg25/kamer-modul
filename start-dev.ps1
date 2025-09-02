Write-Host "Starting Repair Shop Development Environment..." -ForegroundColor Green
Write-Host ""

# Check if Node.js is installed
try {
    $nodeVersion = node --version 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Node.js is not installed or not in PATH" -ForegroundColor Red
        Write-Host "Please install Node.js from https://nodejs.org/" -ForegroundColor Yellow
        Read-Host "Press Enter to exit"
        exit 1
    }
    Write-Host "Node.js version: $nodeVersion" -ForegroundColor Cyan
} catch {
    Write-Host "ERROR: Node.js is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install Node.js from https://nodejs.org/" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if .env file exists in backend
if (-not (Test-Path "repairshop-backend\.env")) {
    Write-Host "WARNING: .env file not found in backend" -ForegroundColor Yellow
    Write-Host "Creating .env from env.example..." -ForegroundColor Cyan
    Copy-Item "repairshop-backend\env.example" "repairshop-backend\.env"
    Write-Host "Please edit repairshop-backend\.env with your configuration" -ForegroundColor Yellow
}

# Check if node_modules exist in backend
if (-not (Test-Path "repairshop-backend\node_modules")) {
    Write-Host "Installing backend dependencies..." -ForegroundColor Yellow
    Set-Location "repairshop-backend"
    npm install
    Set-Location ".."
}

# Check if node_modules exist in frontend
if (-not (Test-Path "repairshop-frontend\node_modules")) {
    Write-Host "Installing frontend dependencies..." -ForegroundColor Yellow
    Set-Location "repairshop-frontend"
    npm install
    Set-Location ".."
}

Write-Host ""
Write-Host "Starting Backend Server (Port 3000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\repairshop-backend'; npm run dev" -WindowStyle Normal

Write-Host "Waiting for backend to start..." -ForegroundColor Cyan
Start-Sleep -Seconds 5

Write-Host "Starting Frontend Server (Port 3001)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\repairshop-frontend'; npm run dev" -WindowStyle Normal

Write-Host ""
Write-Host "Development servers are starting..." -ForegroundColor Green
Write-Host "Backend: http://localhost:3000" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:3001" -ForegroundColor Cyan
Write-Host ""
Write-Host "NOTE: Make sure to configure your .env file in repairshop-backend if you haven't already" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press any key to close this window..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
