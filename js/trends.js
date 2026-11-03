// Tendances alimentaires : stats locales + critique locale OU IA externe.
// Transparence obligatoire : le badge signale TOUJOURS quel type d'analyse a produit la critique.
import * as Storage from './storage.js';
import { getIASettings, hasValidAPIKey } from './ia-settings.js';
import { analyseTendances } from './ia-external.js';

const FAMILLES = [
  { nom: "Fruits & légumes", mots: ["fruit", "legume", "salade", "tomate", "pomme", "banane", "orange", "poire", "carotte", "brocoli", "epinard", "courgette", "haricot", "lentille", "chou", "soupe", "crudite", "potiron", "radis", "concombre", "fraise", "framboise", "citron", "pamplemousse", "avocat"] },
  { nom: "Féculents & céréales", mots: ["pain", "riz", "pate", "pomme de terre", "patate", "semoule", "ble", "boulgour", "quinoa", "avoine", "cereal", "bagel", "tartine", "croissant", "brioche", "polenta", "gnocchi"] },
  { nom: "Produits laitiers", mots: ["yaourt", "lait", "fromage", "beurre", "creme", "kefir", "faisselle"] },
  { nom: "Viande, poisson, œufs", mots: ["viande", "poulet", "boeuf", "porc", "agneau", "poisson", "saumon", "thon", "cabillaud", "jambon", "steak", "escalope", "oeuf", "crevette", "moule"] },
  { nom: "Plats gras ou sucrés", mots: ["frite", "pizza", "burger", "hamburger", "kebab", "snack", "chips", "chocolat", "cookie", "gateau", "patisserie", "bonbon", "sucre", "soda", "coca", "biere", "vin", "alcool", "aperitif", "charcuterie"] }
];

function normalize(t) {
  return (t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/[&<>]/g, function(m) {
    if (m === "&") return "&amp;";
    if (m === "<") return "&lt;";
    return "&gt;";
  });
}

function computeStats(days) {
  const limit = days ? Date.now() - days * 86400000 : 0;
  const meals = Storage.loadRepas().filter(function(m) {
    return new Date(m.datetime).getTime() >= limit;
  });

  const famCounts = FAMILLES.map(function(f) {
    return {
      nom: f.nom,
      repas: meals.filter(function(m) {
        const t = normalize(m.text);
        return f.mots.some(function(w) { return t.includes(normalize(w)); });
      }).length
    };
  });

  const water = Storage.loadWaterHistory();
  let waterSum = 0;
  let firstDate = null;
  for (const entry of Object.entries(water)) {
    const total = Array.isArray(entry[1])
      ? entry[1].reduce(function(s, e) { return s + (e.cl || 0); }, 0)
      : (typeof entry[1] === "number" ? entry[1] : 0);
    if (days) {
      const lim = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
      if (entry[0] < lim) continue;
    }
    waterSum += total;
    if (!firstDate || entry[0] < firstDate) firstDate = entry[0];
  }

  let span = days;
  if (!span) {
    const dates = meals.map(function(m) { return m.datetime.slice(0, 10); });
    if (firstDate) dates.push(firstDate);
    if (dates.length) {
      const min = Math.min.apply(null, dates.map(function(d) { return new Date(d).getTime(); }));
      span = Math.max(1, Math.ceil((Date.now() - min) / 86400000));
    } else span = 1;
  }

  return {
    days: days || span,
    meals: meals,
    famCounts: famCounts,
    avgRepas: meals.length / span,
    avgEau: waterSum / span,
    alertes: meals.filter(function(m) { return !!m.interactionDetected; }).length
  };
}

function critiqueLocale(stats) {
  const L = [];
  L.push("Points observés sur la période (" + stats.days + " jours) :");
  const nb = stats.meals.length;
  if (nb === 0) {
    L.push("- Aucun repas enregistré sur la période : impossible de dégager une tendance.");
  } else {
    L.push("- " + nb + " repas enregistrés (" + stats.avgRepas.toFixed(1) + "/jour en moyenne).");
    const fl = stats.famCounts.filter(function(f) { return f.nom === "Fruits & légumes"; })[0];
    if (nb >= 5 && fl && fl.repas / nb < 0.5) {
      L.push("- Fruits & légumes présents dans moins d'un repas sur deux : le repère PNNS est de 5 par jour.");
    }
    const gras = stats.famCounts.filter(function(f) { return f.nom === "Plats gras ou sucrés"; })[0];
    if (nb >= 5 && gras && gras.repas / nb > 0.4) {
      L.push("- Aliments gras ou sucrés fréquents (plus de 4 repas sur 10) : le PNNS recommande d'en limiter la fréquence.");
    }
    if (stats.avgEau > 0 && stats.avgEau < 100) {
      L.push("- Hydratation moyenne de " + Math.round(stats.avgEau) + " cl/jour, en dessous du repère (~150 cl/jour).");
    } else if (stats.avgEau >= 150) {
      L.push("- Hydratation moyenne conforme au repère (~150 cl/jour).");
    }
    if (stats.alertes > 0) {
      L.push("- " + stats.alertes + " alerte(s) d'interaction ou allergène relevée(s) dans l'historique.");
    }
  }
  L.push("");
  L.push("Analyse purement éducative, sans valeur médicale.");
  return L.join("\n");
}

function buildExternalPrompt(stats) {
  const famText = stats.famCounts.map(function(f) { return f.nom + " : " + f.repas + " repas"; }).join("\n");
  const mealsText = stats.meals.slice(0, 80).map(function(m) {
    return "- " + m.text;
  }).join("\n");
  return "Période analysée : " + stats.days + " jours\n" +
    "Repas enregistrés : " + stats.meals.length + " (" + stats.avgRepas.toFixed(1) + "/jour)\n" +
    "Eau moyenne : " + Math.round(stats.avgEau) + " cl/jour (repère ~150 cl)\n" +
    "Alertes d'interactions relevées : " + stats.alertes + "\n" +
    "Familles d'aliments détectées :\n" + famText + "\n\n" +
    "Descriptions des repas (les plus récents d'abord) :\n" + (mealsText || "Aucun");
}

function renderStats(stats) {
  const el = document.getElementById("trendsStats");
  if (!el) return;
  const cards = [
    { label: "Repas enregistrés", value: String(stats.meals.length) },
    { label: "Moyenne repas/jour", value: stats.avgRepas.toFixed(1) },
    { label: "Eau moyenne (cl/jour)", value: String(Math.round(stats.avgEau)) },
    { label: "Alertes relevées", value: String(stats.alertes) }
  ];
  el.innerHTML = cards.map(function(c) {
    return "<div class='stat-card'><div class='stat-value'>" + c.value + "</div><div class='stat-label'>" + escapeHtml(c.label) + "</div></div>";
  }).join("");

  const famEl = document.getElementById("trendsFamilies");
  if (famEl) {
    const max = Math.max.apply(null, stats.famCounts.map(function(f) { return f.repas; }).concat([1]));
    famEl.innerHTML = stats.famCounts.map(function(f) {
      const pct = Math.round(100 * f.repas / max);
      return "<div class='fam-row'><span class='fam-name'>" + escapeHtml(f.nom) + "</span>" +
        "<div class='fam-bar'><div class='fam-fill' style='width:" + pct + "%'></div></div>" +
        "<span class='fam-count'>" + f.repas + " repas</span></div>";
    }).join("");
  }
}

function setBadge(kind, detail) {
  const badge = document.getElementById("trendsIABadge");
  if (!badge) return;
  badge.classList.remove("local", "external");
  if (kind === "external") {
    badge.classList.add("external");
    badge.textContent = "🤖 Critique générée par IA externe — Mistral (mistral-small-latest)" + (detail ? " — " + detail : "");
  } else {
    badge.classList.add("local");
    badge.textContent = "🔍 Analyse locale — règles prédéfinies, aucune IA" + (detail ? " — " + detail : "");
  }
}

async function runCritique(stats) {
  const critiqueEl = document.getElementById("trendsCritique");
  const settings = getIASettings();
  const externalWanted = settings.mode === "external" && hasValidAPIKey();

  if (externalWanted) {
    critiqueEl.textContent = "⏳ Analyse IA en cours…";
    const res = await analyseTendances(buildExternalPrompt(stats));
    if (res.success && res.analysis) {
      setBadge("external", "données transmises le temps de l'analyse, rien de stocké");
      critiqueEl.textContent = res.analysis;
      return;
    }
    setBadge("local", "repli : IA externe indisponible (" + (res.error || "erreur") + ")");
    critiqueEl.textContent = critiqueLocale(stats);
    return;
  }

  setBadge("local", settings.mode !== "external" ? "mode local actif" : "clé absente");
  critiqueEl.textContent = critiqueLocale(stats);
}

function currentPeriodDays() {
  const sel = document.getElementById("trendsPeriod");
  if (!sel) return 30;
  const n = parseInt(sel.value);
  return [7, 30, 90, 0].includes(n) ? n : 30;
}

async function refresh() {
  const stats = computeStats(currentPeriodDays());
  renderStats(stats);
  await runCritique(stats);
}

document.getElementById("trendsRefreshBtn").onclick = refresh;
const periodSel = document.getElementById("trendsPeriod");
if (periodSel) periodSel.onchange = refresh;
refresh();
