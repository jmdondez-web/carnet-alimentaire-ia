# Tests — Carnet Alimentaire

Aucune dépendance, aucun navigateur requis. Les fonctions testées sont pures
(données injectées, aucun localStorage ni DOM).

```bash
node tests/run-tests.mjs
```

Sortie attendue : « ✅ N tests OK ». Tout échec sort en code 1 — utilisable
dans un futur pipeline CI ou simplement avant chaque merge.

## Périmètre
- classifyFinal (voice.js) : régression du bug de doublons dictée Chrome Android.
- filterMealsByDays / waterRowsByDays (print.js) : filtres de période, formats eau anciens et nouveaux.
- computeStats / critiqueLocale (trends.js) : périmètre, portions standard, alertes, hypothèse affichée.

## Convention
Toute nouvelle fonction de logique métier doit être pure et couverte ici avant merge.
