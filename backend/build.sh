#!/usr/bin/env bash
set -e
echo "=== Creation des dossiers ==="
mkdir -p data uploads exports

echo "=== Seed de la base de donnees ==="
cd "$(dirname "$0")"
python scripts/seed_lite.py

echo "=== Build termine ==="
