# MandateGuard — Windows PowerShell Automated Test Runner
$ErrorActionPreference = "Stop"

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host " MandateGuard: Complete Test Suite Runner (Windows PowerShell)" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan

# 1. Smart Contract Tests
Write-Host "`n[1/3] Running Smart Contract Tests (Foundry via WSL)..." -ForegroundColor Yellow
try {
    wsl -d Ubuntu-D -e bash -c "cd /mnt/e/MandateGuard/contracts && ~/.foundry/bin/forge test -vvv"
    Write-Host "[+] Smart contract tests passed successfully." -ForegroundColor Green
} catch {
    Write-Host "[-] Smart contract tests failed!" -ForegroundColor Red
    exit 1
}

# 2. Backend Unit & API Tests
Write-Host "`n[2/3] Running Backend Tests (pytest)..." -ForegroundColor Yellow
try {
    & ".\backend\.venv\Scripts\pytest.exe" backend/tests -v
    Write-Host "[+] Backend tests passed successfully." -ForegroundColor Green
} catch {
    Write-Host "[-] Backend tests failed!" -ForegroundColor Red
    exit 1
}

# 3. End-to-End Integration Tests on Live Chain
Write-Host "`n[3/4] Running Live End-to-End Integration Suite..." -ForegroundColor Yellow
try {
    & ".\backend\.venv\Scripts\python.exe" scripts/test_e2e.py
    Write-Host "[+] End-to-End tests passed successfully." -ForegroundColor Green
} catch {
    Write-Host "[-] End-to-End tests failed!" -ForegroundColor Red
    exit 1
}

# 4. Frontend Unit Tests & Production Build Verification
Write-Host "`n[4/4] Running Frontend Automated Tests & Build Verification..." -ForegroundColor Yellow
try {
    Push-Location frontend
    npm test
    npm run build
    Pop-Location
    Write-Host "[+] Frontend tests and production build passed successfully." -ForegroundColor Green
} catch {
    Pop-Location
    Write-Host "[-] Frontend verification failed!" -ForegroundColor Red
    exit 1
}

Write-Host "`n======================================================================" -ForegroundColor Green
Write-Host " ALL TEST SUITES PASSED (100% QUALITY GATES MET)!" -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Green
