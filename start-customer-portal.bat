@echo off
echo ================================
echo Starting Customer Portal...
echo ================================
cd customer-portal
start "Customer Portal" npm run dev
cd..
echo.
echo Customer Portal is starting...
echo Access it at: http://localhost:5174
echo.
pause

