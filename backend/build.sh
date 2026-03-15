#!/usr/bin/env bash
set -e

BACKEND_DIR="$(dirname "$0")"

echo "=== Installation des dependances ==="
pip install -r "$BACKEND_DIR/requirements-render.txt"

echo "=== Creation des dossiers ==="
mkdir -p "$BACKEND_DIR/data" "$BACKEND_DIR/uploads" "$BACKEND_DIR/exports"

echo "=== Seed de la base de donnees ==="
cd "$BACKEND_DIR"
python scripts/seed_lite.py

echo "=== Build termine ==="
