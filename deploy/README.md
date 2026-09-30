# Déploiement — LXC unique

Reconstruction complète du serveur (le LXC précédent a été effacé).
Tout le code est sur GitHub ; ces scripts reconstruisent l'environnement.

## 1. Sur l'hôte Proxmox (root)
```bash
# récupérer les scripts
git clone https://github.com/jmdondez-web/carnet-alimentaire-ia.git
cd carnet-alimentaire-ia/deploy

# créer le LXC (personnaliser : CT_ID, IP, mot de passe)
CT_ID=102 CT_PASSWORD='ton-mot-de-passe' bash create-lxc.sh

# pousser et exécuter le setup dans le LXC
pct push 102 setup-lxc.sh /root/setup-lxc.sh
pct exec 102 -- bash /root/setup-lxc.sh
```

## 2. Dans le LXC
```bash
# (optionnel mais recommandé) accès mobile chiffré sans exposition publique
curl -fsSL https://tailscale.com/install.sh | sh
tailscale up
```

## Tests
- PWA : `http://<IP-du-LXC>/`
- API : `http://<IP-du-LXC>/api/health`
- Base de connaissances : `http://<IP-du-LXC>/api/knowledge`

## Mises à jour
```bash
bash /opt/carnet-alimentaire/deploy/update.sh
```
Ou automatique via cron (une fois par jour à 4h) :
```bash
(crontab -l 2>/dev/null; echo "0 4 * * * /opt/carnet-alimentaire/deploy/update.sh >> /var/log/carnet-update.log 2>&1") | crontab -
```

## Architecture conforme aux décisions (25/09/2026)
- **1 seul LXC** : Nginx (PWA statique + proxy /api) + FastAPI (uvicorn :8000)
- **Aucune donnée de santé stockée côté serveur** : médicaments/maladies/repas restent dans l'appli (téléphone). L'API ne sert que la base de connaissances publique et ne persiste rien.
- **Accès** : Tailscale pour l'usage perso (chiffré, sans port exposé) ; Cloudflare Tunnel + Certbot seulement à l'étape testeurs.
- **Sauvegardes** : sur l'hôte Proxmox, ajouter un vzdump quotidien :
  ```bash
  echo '0 2 * * * vzdump 102 --storage local --mode snapshot --compress zstd' >> /etc/crontab/root 2>/dev/null || \
  (crontab -l 2>/dev/null; echo '0 2 * * * vzdump 102 --storage local --mode snapshot --compress zstd') | crontab -
  ```

## Multimodal (Phase 3 — pas encore inclus)
Whisper (audio) et CLIP/YOLOv8 (image) seront ajoutés plus tard dans ce même LXC si les ressources le permettent, sinon passage par Mistral API avec consentement.
