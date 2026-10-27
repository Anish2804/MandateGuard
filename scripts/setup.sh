#!/usr/bin/env bash
set -e

echo "============================================="
echo " MandateGuard — Development Setup Script     "
echo "============================================="

# 1. Setup Contracts
echo "[1/3] Setting up smart contracts..."
cd contracts
if command -v forge &> /dev/null; then
    forge install
    forge build
else
    echo "Warning: forge not found on PATH. Please ensure Foundry is installed."
fi
cd ..

# 2. Setup Backend Virtual Environment
echo "[2/3] Setting up backend virtual environment..."
cd backend
if [ ! -d ".venv" ]; then
    python3 -m venv .venv || python -m venv .venv
fi

if [ -f ".venv/bin/pip" ]; then
    .venv/bin/pip install --upgrade pip
    .venv/bin/pip install -r requirements.txt
elif [ -f ".venv/Scripts/pip.exe" ]; then
    .venv/Scripts/pip.exe install --upgrade pip
    .venv/Scripts/pip.exe install -r requirements.txt
fi
cd ..

# 3. Setup Frontend
echo "[3/3] Setting up Next.js frontend..."
cd frontend
npm install
cd ..

echo "Setup complete! Run ./scripts/dev.sh to launch the application stack."
