#!/usr/bin/env bash
set -o errexit

echo "=== Python version ==="
python --version

echo "=== Mise a jour pip + setuptools ==="
pip install --upgrade pip setuptools wheel

echo "=== Installation des dependances ==="
pip install -r requirements_lite.txt

echo "=== Creation des dossiers ==="
mkdir -p uploads exports

echo "=== Seed de la base de donnees ==="
python scripts/seed_lite.py

echo "=== Build termine ==="
