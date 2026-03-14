#!/usr/bin/env bash
# Script de build Render - installé et seed automatique
set -o errexit

echo "=== Installation des dépendances ==="
pip install --upgrade pip
pip install -r requirements_lite.txt

echo "=== Création des dossiers ==="
mkdir -p uploads exports

echo "=== Seed de la base de données ==="
python scripts/seed_lite.py

echo "=== Build terminé ==="
