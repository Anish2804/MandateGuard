#!/usr/bin/env bash
set -e

echo "Running MandateGuard End-to-End Test Suite..."
if [ -f "backend/.venv/bin/python" ]; then
    backend/.venv/bin/python scripts/test_e2e.py
elif [ -f "backend/.venv/Scripts/python.exe" ]; then
    backend/.venv/Scripts/python.exe scripts/test_e2e.py
else
    python scripts/test_e2e.py
fi
