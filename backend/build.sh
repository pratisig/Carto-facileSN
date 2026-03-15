#!/usr/bin/env bash
set -e

BACKEND_DIR="$(dirname "$0")"

echo "=== Installation des dependances ==="
pip install -r "$BACKEND_DIR/requirements-render.txt"

echo "=== Creation des dossiers ==="
mkdir -p "$BACKEND_DIR/data" "$BACKEND_DIR/uploads" "$BACKEND_DIR/exports"

echo "=== Seed de la base de donnees ==="
cd "$BACKEND_DIR"
# Le seed est optionnel : l'app fonctionne sans DB (100% SHP)
# On l'execute mais on ne bloque pas le build si ca echoue
python scripts/seed_lite.py || echo "[WARN] Seed ignore (non critique - app fonctionne en mode SHP)"

echo "=== Build termine ==="
