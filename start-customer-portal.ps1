# Start Customer Portal
Write-Host "`n================================" -ForegroundColor Cyan
Write-Host "Starting Customer Portal..." -ForegroundColor Cyan
Write-Host "================================`n" -ForegroundColor Cyan

Set-Location -Path "customer-portal"
Start-Process -FilePath "npm" -ArgumentList "run", "dev" -NoNewWindow

Write-Host "`nCustomer Portal is starting..." -ForegroundColor Green
Write-Host "Access it at: http://localhost:5174`n" -ForegroundColor Yellow

Set-Location -Path ".."

