# Mode d'emploi — Testeurs du Carnet Alimentaire

Bienvenue. Ce guide couvre l'installation, le premier démarrage et l'usage quotidien. Durée d'installation : environ 5 minutes.

## 1. Le principe en une phrase

Tes repas et tes données restent **sur ton téléphone** — rien n'est envoyé automatiquement, personne d'autre ne voit tes données.

## 2. Installation en 5 étapes

1. **Accepte l'invitation** reçue par e-mail (lien Tailscale). Si tu n'as pas de compte, tu peux en créer un gratuit avec cette adresse.
2. **Installe l'application Tailscale** (Play Store ou App Store).
3. Ouvre Tailscale, connecte-toi avec l'adresse e-mail invitée, et **active le VPN** (le bouton principal).
4. Ouvre cette adresse dans Chrome (Android) ou Safari (iOS) : **https://carnet-alimentaire.tail45201a.ts.net**
5. Menu ⋮ → **« Installer l'application »** (ou « Ajouter à l'écran d'accueil »). Utilise ensuite cette icône.

Important : l'application ne fonctionne que VPN Tailscale **activé**. C'est un réseau privé — c'est ce qui protège tes données.

## 3. Premier démarrage

1. En haut à droite, vérifie le **badge de version** (date + code). S'il ne correspond pas à la dernière version annoncée, ferme et rouvre l'application deux fois.
2. ⚙️ Réglages → section IA :
   - **Accepte le consentement** (obligatoire pour l'IA externe, révocable à tout moment).
   - Mode : **Externe**. Laisse le champ clé **vide** — le serveur détient déjà la clé.
   - Appuie sur **« Tester la connexion »** : tu dois voir « ✅ Proxy serveur actif ».
3. Dans Réglages, saisis tes **traitements, allergies et problèmes de santé** si tu veux les alertes d'interaction (optionnel).

## 4. Au quotidien

**Encoder un repas** — trois façons, au choix :

- **Texte** : décris ton repas (« salade de lentilles, pamplemousse, riz »).
- **Photo** : bouton 📷. L'analyse démarre immédiatement et s'affiche sous l'aperçu — corrige la description si l'IA s'est trompée **avant** d'enregistrer.
- **Dictée** : bouton 🎤 (Chrome/Edge Android, Safari iOS). Autorise le micro si demandé.

Les chips « sur le pouce » (petit-déj, sandwich, etc.) enregistrent en deux gestes. L'heure est « maintenant » par défaut ; déplie 📅 pour la corriger, y compris après coup.

**Eau** : boutons de prises, histogramme de la journée.

**Historique** (trié par heure réelle, pas par ordre de saisie) :

- **✏️ Modifier** sur un repas : texte, heure, photo. Si tu changes le contenu, l'analyse se relance automatiquement.
- 🖨️ **Impression PDF** pour la consultation (2, 7, 14, 30 jours ou tout).
- 📈 **Tendances** : moyennes calculées uniquement sur tes jours réels d'utilisation.

**Hors ligne** : tout fonctionne sans réseau, sauf l'IA externe (le mode repasse alors sur les règles locales).

## 5. Ce qui part de ton téléphone (transparence)

- **Par défaut, rien** ne sort de ton téléphone.
- Uniquement si tu actives le mode IA externe : la description du repas, la photo et ton contexte santé déclaré (traitements, allergies) sont envoyés à l'IA (Mistral, hébergée en UE) via le serveur personnel du projet, sans stockage intermédiaire, pour générer l'analyse. Chaque analyse affiche sa source. Le consentement est révocable dans les réglages.
- Le mode local n'envoie rien ; il se limite à la base embarquée (plus restreinte).

## 6. Quoi tester (dans l'ordre)

1. Repas texte → repas photo → repas dictée.
2. Eau : quelques prises, histogramme.
3. Réglages : traitements/allergies, mode sombre, consentement.
4. Historique : ✏️ Modifier un repas (change l'heure, change le texte), impression PDF, tendances.
5. Hors ligne : coupe le réseau, rouvre l'application.

## 7. Signaler un problème

Indique : la **version affichée** (badge date + code), ton **appareil et navigateur**, ce que tu as fait, ce qui était attendu, ce qui s'est passé. Une capture d'écran aide.

## 8. Petits dépannages

- « Serveur injoignable » → vérifie que le VPN Tailscale est activé.
- Badge absent ou ancien → ferme et rouvre l'application deux fois.
- Micro refusé → autorise le micro pour Chrome dans les réglages Android.
- L'application ne s'ouvre pas → VPN activé ? C'est un réseau privé, c'est normal sinon.

## 9. Notes pour les évaluateurs professionnels (médecin, diététicienne)

- Le produit est éducatif : pas de diagnostic, pas de posologie, pas de calories. Les alertes d'interaction sont des rappels ; leur pertinence clinique vous revient.
- La base d'interactions est visible dans `connaissances.json` — vos corrections de contenu (aliments, médicaments, messages) sont les bienvenues et seront intégrées après relecture.
- Les tendances comptent des présences d'aliments, pas des quantités ; sans grammage, une portion individuelle standard est assumée (hypothèse affichée).
- L'usage de l'IA est signalé dans chaque analyse (règles locales ou Mistral, consentement RGPD Art. 9 requis pour l'externe). Détails : page À propos de l'application.
- Vous ne voyez jamais les données des autres testeurs : par conception.
