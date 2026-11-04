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
# API : copier le CONTENU de deploy/api dans api/ (cp -r avec destination existante
# imbriquait le dossier dans api/api/ — l'API ne recevait jamais les mises à jour).
mkdir -p "$APP_DIR/api"
cp -r "$APP_DIR/deploy/api/." "$APP_DIR/api/"
systemctl restart carnet-api
nginx -t && systemctl reload nginx
# Vérification : l'API doit répondre avec la version du déploiement courant.
sleep 2
curl -s http://localhost:8000/api/health
echo ""
echo "✅ Appli mise à jour : $(git rev-parse --short HEAD)"
