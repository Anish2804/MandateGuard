#!/usr/bin/env bash
set -e

echo "============================================="
echo " MandateGuard — Complete Automated Test Suite"
echo "============================================="

# 1. Smart Contract Tests
echo ""
echo ">>> [1/3] Running Smart Contract Tests (Foundry)..."
cd contracts
forge test -vvv
cd ..

# 2. Backend Tests
echo ""
echo ">>> [2/3] Running Backend Tests (pytest)..."
cd backend
if [ -f ".venv/bin/pytest" ]; then
    .venv/bin/pytest -v
elif [ -f ".venv/Scripts/pytest.exe" ]; then
    .venv/Scripts/pytest.exe -v
else
    pytest -v
fi
cd ..

# 3. End-to-End Integration Tests
echo ""
echo ">>> [3/3] Running End-to-End Integration Suite..."
if [ -f "backend/.venv/bin/python" ]; then
    backend/.venv/bin/python scripts/test_e2e.py
elif [ -f "backend/.venv/Scripts/python.exe" ]; then
    backend/.venv/Scripts/python.exe scripts/test_e2e.py
else
    python scripts/test_e2e.py
fi

echo ""
echo "============================================="
echo " ALL TEST SUITES PASSED (100% QUALITY GATES) "
echo "============================================="
