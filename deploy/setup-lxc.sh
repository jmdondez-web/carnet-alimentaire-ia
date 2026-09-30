#!/bin/bash
# ============================================================
# CONFIGURATION INTERNE DU LXC — Carnet Alimentaire IA
# À exécuter DANS le LXC (ou via pct exec)
# Installe : Python 3, FastAPI, Nginx, git, Tailscale (optionnel)
# ============================================================
set -e

APP_DIR="/opt/carnet-alimentaire"
REPO_URL="https://github.com/jmdondez-web/carnet-alimentaire-ia.git"

echo "📦 Mise à jour + paquets de base"
apt-get update && apt-get upgrade -y
apt-get install -y python3 python3-venv python3-pip git nginx curl ufw

echo "📁 Récupération du code"
mkdir -p "$APP_DIR"
git clone "$REPO_URL" "$APP_DIR"
# Les scripts de déploiement sont dans deploy/
cp -r "$APP_DIR/deploy/api" "$APP_DIR/api" 2>/dev/null || true

echo "🐍 Environnement Python"
python3 -m venv /opt/venv
/opt/venv/bin/pip install --upgrade pip
/opt/venv/bin/pip install fastapi "uvicorn[standard]"

echo "🔧 Service systemd carnet-api"
cat > /etc/systemd/system/carnet-api.service <<EOF
[Unit]
Description=Carnet Alimentaire - FastAPI
After=network.target

[Service]
Type=simple
WorkingDirectory=$APP_DIR
ExecStart=/opt/venv/bin/uvicorn api.main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now carnet-api

echo "🌐 Nginx reverse proxy"
cat > /etc/nginx/sites-available/carnet <<'EOF'
server {
    listen 80;
    server_name _;

    client_max_body_size 20M;   # photos de repas

    # PWA statique (frontend)
    root /opt/carnet-alimentaire;
    index index.html;
    location / {
        try_files \$uri \$uri/ =404;
    }

    # API
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/carnet /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

echo "🛡️ Pare-feu basique"
ufw allow 80/tcp
ufw allow 22/tcp
ufw --force enable

echo ""
echo "✅ LXC prêt ! Test : curl http://localhost/ (PWA) et curl http://localhost/api/health"
echo "ℹ️ Tailscale (accès mobile) : curl -fsSL https://tailscale.com/install.sh | sh && tailscale up"
echo "ℹ️ HTTPS plus tard via Certbot (domaine) — pour l'usage perso, Tailscale (chiffré) suffit."
