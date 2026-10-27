#!/usr/bin/env bash

echo "============================================="
echo " Starting MandateGuard Development Services  "
echo "============================================="

# 1. Start Anvil
echo "[1/3] Starting Anvil local blockchain..."
anvil --chain-id 31337 --port 8545 &
ANVIL_PID=$!

# Wait for Anvil to start
sleep 2

# 2. Deploy Contracts
echo "[2/3] Deploying smart contracts to Anvil..."
cd contracts
forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
cd ..

# 3. Start Backend
echo "[3/3] Starting Authorization Backend Service..."
cd backend
if [ -f ".venv/bin/uvicorn" ]; then
    .venv/bin/uvicorn app.main:app --reload --port 8000 &
elif [ -f ".venv/Scripts/uvicorn.exe" ]; then
    .venv/Scripts/uvicorn.exe app.main:app --reload --port 8000 &
else
    uvicorn app.main:app --reload --port 8000 &
fi
BACKEND_PID=$!
cd ..

# 4. Start Frontend
echo "[4/4] Starting Next.js Frontend Dashboard..."
cd frontend
npm run dev

# Cleanup on exit
trap "kill $ANVIL_PID $BACKEND_PID" EXIT
