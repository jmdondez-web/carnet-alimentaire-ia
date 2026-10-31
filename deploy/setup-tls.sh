#!/bin/bash
# ============================================================
# HTTPS AUTO-SIGNÉ — Carnet Alimentaire (LXC)
# Contexte : la dictée vocale (Web Speech API) et l'accès caméra
# exigent un contexte sécurisé (HTTPS ou localhost). En HTTP,
# Chrome refuse le micro par principe ("micro refusé").
# Ce script génère un certificat auto-signé (10 ans) et active
# le serveur nginx en HTTPS sur le port 443. Le port 80 reste actif.
# Idempotent : relançable sans casser la config existante.
# Usage : bash setup-tls.sh [IP-du-LXC]
# ============================================================
set -e

CERT_DIR="/etc/nginx/ssl"
IP="${1:-192.168.0.105}"
CERT="$CERT_DIR/carnet.crt"
KEY="$CERT_DIR/carnet.key"

if [ "$(id -u)" -ne 0 ]; then
    echo "❌ À lancer en root (dans le LXC)" >&2
    exit 1
fi

echo "🔐 Génération du certificat auto-signé (IP: $IP)"
mkdir -p "$CERT_DIR"
if [ -f "$CERT" ] && [ -f "$KEY" ] && [ "$1" != "--force" ]; then
    echo "ℹ️ Certificat déjà présent — conservation (relance avec --force pour régénérer)"
else
    openssl req -x509 -nodes -newkey rsa:2048 -days 3650 \
        -keyout "$KEY" -out "$CERT" \
        -subj "/C=BE/O=Carnet Alimentaire/CN=$IP" \
        -addext "subjectAltName=IP:$IP,DNS:carnet,DNS:localhost" \
        -addext "basicConstraints=critical,CA:FALSE"
    chmod 600 "$KEY"
fi

echo "🌐 Configuration nginx HTTPS"
cat > /etc/nginx/sites-available/carnet-tls <<'EOF'
server {
    listen 443 ssl;
    server_name _;

    ssl_certificate     /etc/nginx/ssl/carnet.crt;
    ssl_certificate_key /etc/nginx/ssl/carnet.key;
    ssl_protocols TLSv1.2 TLSv1.3;

    client_max_body_size 20M;   # photos de repas

    # PWA statique (frontend)
    root /opt/carnet-alimentaire;
    index index.html;
    location / {
        try_files $uri $uri/ =404;
    }

    # API
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
EOF

ln -sf /etc/nginx/sites-available/carnet-tls /etc/nginx/sites-enabled/

echo "🛡️ Pare-feu : ouverture du 443"
ufw allow 443/tcp || true

nginx -t && systemctl reload nginx

echo ""
echo "✅ HTTPS actif : https://$IP/"
echo "⚠️ Chrome affichera un avertissement (certificat auto-signé)."
echo "   Accepter : Avancé → Procéder. Une seule fois par appareil."
echo "🎤 La dictée et la caméra fonctionnent désormais sur l'origine https."
echo "ℹ️ Les données locales créées en http://$IP ne sont PAS visibles en https"
echo "   (origines distinctes pour le navigateur). Exporter/importer si besoin."
