#!/bin/bash
# ============================================================
# CRÉATION DU LXC UNIQUE — Carnet Alimentaire IA
# À exécuter SUR L'HÔTE PROXMOX (root)
# Usage : bash create-lxc.sh
# ============================================================
set -e

CT_ID="${CT_ID:-102}"
CT_NAME="carnet-alimentaire"
CT_PASSWORD="${CT_PASSWORD:-changer-moi}"
STORAGE="${STORAGE:-local}"
BRIDGE="${BRIDGE:-vmbr0}"
IP="${IP:-dhcp}"   # ex: 192.168.1.102/24 ou dhcp

# Télécharger le template Debian 12 si absent
pveam update >/dev/null 2>&1 || true
TEMPLATE=$(pveam list local | grep "debian-12-standard" | awk '{print $2}' | head -n1)
if [ -z "$TEMPLATE" ]; then
  pveam download local debian-12-standard_12.7-1_amd64.tar.zst
  TEMPLATE="local:vztmpl/debian-12-standard_12.7-1_amd64.tar.zst"
fi

# Créer le conteneur
pct create "$CT_ID" "$TEMPLATE" \
  --hostname "$CT_NAME" \
  --memory 2048 --swap 512 \
  --cores 2 \
  --rootfs "$STORAGE":8 \
  --net0 name=eth0,bridge="$BRIDGE",ip="$IP" \
  --unprivileged 1 \
  --features nesting=1 \
  --onboot 1 \
  --start 1

# Mot de passe root
echo "root:$CT_PASSWORD" | pct exec "$CT_ID" -- chpasswd

echo "✅ LXC $CT_ID ($CT_NAME) créé et démarré."
echo "👉 Ensuite : pct push $CT_ID setup-lxc.sh /root/setup-lxc.sh"
echo "   puis    : pct exec $CT_ID -- bash /root/setup-lxc.sh"
