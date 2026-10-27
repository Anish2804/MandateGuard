# MandateGuard — Windows PowerShell Development Runner
param (
    [string]$service = "all"
)

$ErrorActionPreference = "Continue"

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host " MandateGuard: Local Development Environment (PowerShell)" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan

function Start-AnvilNode {
    Write-Host "[+] Starting Anvil Local Chain on port 8545..." -ForegroundColor Green
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "wsl -d Ubuntu-D -e bash -c '~/.foundry/bin/anvil --chain-id 31337 --port 8545 --host 0.0.0.0'"
}

function Start-BackendService {
    Write-Host "[+] Starting FastAPI Authorization Backend on port 8000..." -ForegroundColor Green
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; .\`.venv\Scripts\activate; uvicorn app.main:app --reload --port 8000"
}

function Start-FrontendService {
    Write-Host "[+] Starting Next.js Dashboard on port 3000..." -ForegroundColor Green
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev"
}

if ($service -eq "anvil") {
    Start-AnvilNode
} elseif ($service -eq "backend") {
    Start-BackendService
} elseif ($service -eq "frontend") {
    Start-FrontendService
} else {
    Write-Host "Launching full stack (Anvil + Backend + Frontend)..." -ForegroundColor Yellow
    Start-AnvilNode
    Start-Sleep -Seconds 2
    Start-BackendService
    Start-Sleep -Seconds 2
    Start-FrontendService
    Write-Host "`nAll services initiated in separate windows!" -ForegroundColor Green
    Write-Host "Frontend: http://localhost:3000" -ForegroundColor Cyan
    Write-Host "Backend Docs: http://localhost:8000/docs" -ForegroundColor Cyan
    Write-Host "Anvil RPC: http://127.0.0.1:8545" -ForegroundColor Cyan
}
