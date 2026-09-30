#!/bin/bash
# ============================================================
# MISE À JOUR DE L'APPLI (à exécuter DANS le LXC)
# Récupère la dernière version du repo et redémarre l'API
# ============================================================
set -e
APP_DIR="/opt/carnet-alimentaire"

cd "$APP_DIR"
git pull origin main
cp -r "$APP_DIR/deploy/api" "$APP_DIR/api"
systemctl restart carnet-api
nginx -t && systemctl reload nginx
echo "✅ Appli mise à jour : $(git rev-parse --short HEAD)"
