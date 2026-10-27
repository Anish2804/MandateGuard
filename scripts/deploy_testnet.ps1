# MandateGuard Base Sepolia Testnet Deployment Script
param (
    [Parameter(Mandatory=$false)]
    [string]$PrivateKey = $env:DEPLOYER_PRIVATE_KEY,

    [Parameter(Mandatory=$false)]
    [string]$AuthorizerAddress = $env:AUTHORIZER_ADDRESS
)

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "  MandateGuard - Base Sepolia Testnet Deploy   " -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan

if (-not $PrivateKey) {
    Write-Host "[!] Error: DEPLOYER_PRIVATE_KEY is required to deploy on Base Sepolia." -ForegroundColor Red
    Write-Host "    Example usage:" -ForegroundColor Yellow
    Write-Host "    .\scripts\deploy_testnet.ps1 -PrivateKey 0xYOUR_TESTNET_KEY -AuthorizerAddress 0xYOUR_SIGNER_ADDRESS" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "    You can get free Base Sepolia testnet ETH from:" -ForegroundColor Cyan
    Write-Host "    https://www.alchemy.com/faucets/base-sepolia or https://faucets.chain.link" -ForegroundColor Cyan
    exit 1
}

if (-not $AuthorizerAddress) {
    # Default to platform authorizer address from dev if not specified
    $AuthorizerAddress = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
}

Write-Host "[1/2] Broadcasting smart contracts to Base Sepolia (Chain ID: 84532)..." -ForegroundColor Yellow

$forgeCmd = "cd /mnt/e/MandateGuard/contracts && DEPLOYER_PRIVATE_KEY=$PrivateKey AUTHORIZER_ADDRESS=$AuthorizerAddress ~/.foundry/bin/forge script script/Deploy.s.sol:DeployScript --rpc-url base_sepolia --broadcast -vvv"

wsl -d Ubuntu-D -e bash -c $forgeCmd

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "[2/2] Deployment Successful!" -ForegroundColor Green
    Write-Host "View verified transactions on BaseScan: https://sepolia.basescan.org" -ForegroundColor Cyan
} else {
    Write-Host "[!] Deployment failed. Check RPC connection and testnet ETH balance." -ForegroundColor Red
}
