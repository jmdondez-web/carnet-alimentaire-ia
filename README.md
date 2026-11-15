# Carnet Alimentaire IA

Carnet alimentaire éducatif sous forme de PWA (Progressive Web App). Objectif : aider à comprendre et ajuster son alimentation et ses interactions aliment-médicament, sans diagnostic ni comptage calorique.

## Principes

- Éducatif : pas de diagnostic, pas de comptage calorique.
- Confidentialité : les données de santé (médicaments, maladies, repas) restent dans l'appli, sur le téléphone (localStorage). Le serveur ne persiste aucune donnée personnelle.
- Architecture minimaliste : un seul LXC Proxmox — Nginx (PWA statique + proxy /api) + FastAPI (uvicorn sur 127.0.0.1:8000). L'API ne sert que la base de connaissances publique (`connaissances.json`).
- Accès mobile chiffré via Tailscale, sans port exposé sur Internet.

## Contenu du dépôt

- `index.html`, `about.html`, `settings.html`, `print.html`, `tendances.html` — frontend PWA
- `js/` — logique applicative
- `manifest.json`, `sw.js` — PWA (installation, service worker)
- `connaissances.json` — base de connaissances interactions aliment-médicament
- `tests/` — tests
- `deploy/` — scripts de déploiement (création LXC, setup, TLS, mise à jour)

## Installation complète (de zéro)

Prérequis : un hôte Proxmox VE avec accès root, et ce dépôt.

### 1. Sur l'hôte Proxmox (root)

```bash
git clone https://github.com/jmdondez-web/carnet-alimentaire-ia.git
cd carnet-alimentaire-ia/deploy

# Créer le LXC (personnaliser : CT_ID, IP, mot de passe, bridge)
CT_ID=102 CT_PASSWORD='ton-mot-de-passe' bash create-lxc.sh

# Pousser et exécuter le setup dans le LXC
pct push 102 setup-lxc.sh /root/setup-lxc.sh
pct exec 102 -- bash /root/setup-lxc.sh
```

`create-lxc.sh` crée un conteneur Debian 12 non privilégié (2 Go RAM, 2 vCPU, 8 Go disque, nesting requis). `setup-lxc.sh` installe Python 3, FastAPI, Nginx, git, ufw, clone ce dépôt dans `/opt/carnet-alimentaire`, crée le service systemd `carnet-api` et configure Nginx en reverse proxy.

### 2. Dans le LXC — Tailscale (accès mobile chiffré)

```bash
curl -fsSL https://tailscale.com/install.sh | sh
tailscale up
tailscale serve https / http://localhost:80
```

URL de l'appli : `https://carnet-alimentaire.<ton-tailnet>.ts.net`

### 3. HTTPS auto-signé (requis pour dictée vocale et caméra)

Chrome refuse le micro et la caméra hors contexte sécurisé.

```bash
cd /opt/carnet-alimentaire/deploy
bash setup-tls.sh <IP-du-LXC>
```

- Accepter l'avertissement une fois par appareil (Avancé → Procéder).
- localStorage est propre à chaque origine : les données saisies en http:// ne sont pas visibles en https://. Utiliser l'export/import JSON pour migrer.
- Régénérer le certificat : `bash setup-tls.sh --force`.

## Vérifications après installation

```bash
systemctl status carnet-api        # API FastAPI doit être active
curl 127.0.0.1/version.txt         # version déployée
curl 127.0.0.1/api/health           # santé de l'API
curl 127.0.0.1/api/knowledge        # base de connaissances
tailscale serve status             # exposition Tailscale
```

## Mise à jour

Une seule ligne, dans le LXC :

```bash
cd /opt/carnet-alimentaire && bash deploy/update.sh
```

`update.sh` enchaîne : `git pull origin main`, écrit `version.txt`, copie `deploy/api` vers `api/`, redémarre `carnet-api`, recharge nginx après `nginx -t`, vérifie `/api/health`.

Cron quotidien (4 h) :

```bash
(crontab -l 2>/dev/null; echo "0 4 * * * /opt/carnet-alimentaire/deploy/update.sh >> /var/log/carnet-update.log 2>&1") | crontab -
```

## Sauvegardes

Sur l'hôte Proxmox, vzdump quotidien du conteneur :

```bash
(crontab -l 2>/dev/null; echo "0 2 * * * vzdump 102 --storage local --mode snapshot --compress zstd") | crontab -
```

## Dépannage connu

- PWA « incomplète » (badge de version absent, paramètres inaccessibles) : la PWA se charge depuis le cache du service worker. Sur Android : Chrome → Paramètres des sites → effacer et réinitialiser le site, puis rouvrir l'appli. La PR #37 (service worker réseau-d'abord) corrige ce comportement.
- Données invisibles après passage http → https : origines localStorage distinctes, utiliser l'export/import JSON.

## Feuille de route

1. PWA fiabilisée (interactions enrichies, consentement, tableau de bord)
2. Infrastructure LXC unique (terminée)
3. Multimodal / IA (Whisper, CLIP/YOLOv8 ou Mistral API avec consentement) — pas inclus
4. Conformité RGPD (Art. 9 : données santé)
5. Groupe de testeurs, puis SaaS optionnel

## Conformité

Données de santé : jamais stockées côté serveur, jamais transmises aux API externes sans consentement explicite. Le LXC ne persiste aucun contexte médical.

## Licence

Usage personnel. Pas de licence ouverte pour l'instant.
