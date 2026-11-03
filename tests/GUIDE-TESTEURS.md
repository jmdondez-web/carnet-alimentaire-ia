# Guide testeurs — Carnet Alimentaire

## Installation (3 étapes, ~5 minutes)
1. Installer l'application **Tailscale** (Play Store / App Store) et accepter l'invitation reçue par e-mail.
2. Ouvrir l'URL communiquée (https://…ts.net) — l'ajouter à l'écran d'accueil du téléphone propose l'installation comme application.
3. Vérifier la version affichée en haut à droite (date + code). Si elle ne correspond pas à la dernière annoncée, fermer/rouvrir l'appli.

## Quoi tester (par ordre)
1. **Repas** : ajouter un repas avec description, puis avec photo, puis en dictée vocale (bouton 🎤). La dictée exige Chrome/Edge (Android) ou Safari (iOS).
2. **Eau** : boutons de suivi, histogramme des prises.
3. **Réglages** : traitements, allergies, problèmes de santé, mode sombre, mode IA (local/externe avec consentement).
4. **Historique** : impression PDF (bouton 🖨️), tendances (bouton 📈).
5. **Hors ligne** : couper le réseau, rouvrir l'appli — tout doit fonctionner sauf l'IA externe.

## Signaler un problème
Indiquer : la version affichée (date + code), l'appareil et le navigateur, ce que vous avez fait, ce qui était attendu, ce qui s'est passé. Une capture d'écran aide. Vos données restent sur votre téléphone : aucune donnée ne nous est envoyée automatiquement.

## Notes pour les évaluateurs professionnels (médecin, diététicienne)
- Le produit est éducatif : pas de diagnostic, pas de posologie, pas de calories. Les alertes d'interaction sont des rappels, leur pertinence clinique vous revient.
- La base d'interactions est visible dans connaissances.json — vos corrections de contenu (aliments, médicaments, messages) sont les bienvenues et seront intégrées après relecture.
- Repères PNNS : 5 fruits/légumes, ~1,5 L d'eau, limitation gras/sucrés. Les tendances comptent des présences d'aliments, pas des quantités ; sans grammage, une portion individuelle standard est assumée (hypothèse affichée).
- L'usage de l'IA est signalé dans chaque analyse (règles locales ou Mistral, consentement RGPD Art. 9 requis pour l'externe). Détails : page À propos de l'appli.
- Vous ne voyez jamais les données des autres testeurs : par conception.
