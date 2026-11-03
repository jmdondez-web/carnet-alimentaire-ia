#!/bin/bash
# ============================================================
# MISE À JOUR DE L'APPLI (à exécuter DANS le LXC)
# Récupère la dernière version du repo et redémarre l'API
# ============================================================
set -e
APP_DIR="/opt/carnet-alimentaire"

cd "$APP_DIR"
git pull origin main
# Version affichée dans l'appli : date + commit (distingue plusieurs déploiements le même jour)
printf "%s" "$(date '+%d/%m/%Y %H:%M') · $(git rev-parse --short HEAD)" > "$APP_DIR/version.txt"
cp -r "$APP_DIR/deploy/api" "$APP_DIR/api"
systemctl restart carnet-api
nginx -t && systemctl reload nginx
echo "✅ Appli mise à jour : $(git rev-parse --short HEAD)"
