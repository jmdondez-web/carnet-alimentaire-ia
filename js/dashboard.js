// ========== TABLEAU DE BORD PNNS ==========
// Classification éducative des repas par groupes d'aliments (repères PNNS)
// Éducatif uniquement : pas de calories, pas de jugement.

const GROUPES = {
  fruits_legumes: {
    label: "Fruits & légumes", emoji: "🍎", unite: "portions/jour",
    motsCles: ["pomme", "poire", "banane", "orange", "citron", "fraise", "fraises", "framboise", "kiwi", "ananas", "mangue", "pêche", "peche", "abricot", "cerise", "raisin", "melon", "pasteque", "pastèque", "pruneau", "fruit", "salade", "legume", "légume", "carotte", "tomate", "tomates", "courgette", "aubergine", "poireau", "poivron", "brocoli", "chou", "epinard", "épinard", "haricot vert", "haricots verts", "potiron", "potimarron", "radis", "concombre", "betterave", "artichaut", "asperge", "champignon", "champignons", "soupe", "potage", "gaspacho", "ratatouille", "crudites", "crudités", "compote", "legumes", "légumes"]
  },
  poisson: {
    label: "Poisson", emoji: "🐟", unite: "fois/semaine",
    motsCles: ["poisson", "saumon", "truite", "cabillaud", "colin", "thon", "maquereau", "sardine", "sardines", "anchois", "anchois", "dorade", "lieu", "sole", "haddock", "surimi", "crevette", "crevettes", "moule", "moules", "huitre", "huître", "huitres", "huîtres", "coquillage", "fruits de mer", "calamar", "seiche"]
  },
  produits_laitiers: {
    label: "Produits laitiers", emoji: "🥛", unite: "portions/jour",
    motsCles: ["lait", "yaourt", "yogourt", "fromage blanc", "petit suisse", "fromage", "comté", "comte", "gruyere", "gruyère", "camembert", "brie", "roquefort", "emmental", "mozzarella", "chevre", "chèvre", "faisselle", "skyr", "kefir", "kéfir", "creme", "crème", "beurre", "laitage"]
  },
  legumineuses: {
    label: "Légumineuses", emoji: "🫘", unite: "fois/semaine",
    motsCles: ["lentille", "lentilles", "pois chiche", "pois chiches", "haricot", "haricots", "flageolet", "pois casse", "pois cassé", "feve", "fève", "fèves", "tofu", "soja", "tempeh", "dahl", "houmous", "hummus", "cassoulet", "chili"]
  }
};

function normalize(str) {
  if (!str) return "";
  return str.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// Détecte les groupes présents dans un repas
export function classifyMeal(mealText) {
  const text = normalize(mealText);
  const detected = [];
  for (const [key, g] of Object.entries(GROUPES)) {
    if (g.motsCles.some(m => text.includes(normalize(m)))) {
      detected.push(key);
    }
  }
  return detected;
}

// Agrège les repas par jour et par groupe
export function aggregateByDay(repasList) {
  const byDay = {};
  for (const meal of repasList) {
    const date = (meal.datetime || "").slice(0, 10) || (meal.createdAt || "").slice(0, 10);
    if (!date) continue;
    if (!byDay[date]) byDay[date] = { count: 0, groups: {} };
    byDay[date].count++;
    for (const g of classifyMeal(meal.text)) {
      byDay[date].groups[g] = (byDay[date].groups[g] || 0) + 1;
    }
  }
  return byDay;
}

// Rendu du tableau de bord (objectifs PNNS indicatifs)
export function renderDashboard(containerId, repasList) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const byDay = aggregateByDay(repasList);
  const today = new Date().toISOString().slice(0, 10);
  const todayData = byDay[today] || { count: 0, groups: {} };

  const flToday = todayData.groups.fruits_legumes || 0;
  const plToday = todayData.groups.produits_laitiers || 0;

  let poisson7j = 0, legum7j = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    if (byDay[key]) {
      poisson7j += byDay[key].groups.poisson || 0;
      legum7j += byDay[key].groups.legumineuses || 0;
    }
  }

  const rows = [
    { ...GROUPES.fruits_legumes, actuel: flToday, cible: 5, type: "jour" },
    { ...GROUPES.produits_laitiers, actuel: plToday, cible: 3, type: "jour" },
    { ...GROUPES.poisson, actuel: poisson7j, cible: 2, type: "semaine" },
    { ...GROUPES.legumineuses, actuel: legum7j, cible: 2, type: "semaine" }
  ];

  container.innerHTML = rows.map(r => {
    const pct = Math.min(100, Math.round((r.actuel / r.cible) * 100));
    const atteint = r.actuel >= r.cible;
    return `
      <div class="dash-row">
        <div class="dash-label">
          <span class="dash-emoji">${r.emoji}</span>
          <span class="dash-name">${r.label}</span>
          <span class="dash-count">${r.actuel}/${r.cible}</span>
        </div>
        <div class="dash-bar">
          <div class="dash-fill ${atteint ? 'ok' : ''}" style="width: ${pct}%"></div>
        </div>
        <small class="dash-unit">${atteint ? "✅ " : ""}${r.unite}</small>
      </div>
    `;
  }).join("") +
    '<p class="dash-note">💡 Estimation indicative basée sur tes descriptions de repas. Pour un suivi précis, demande conseil à un diététicien ou ton médecin.</p>';
}
