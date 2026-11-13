// Tests du carnet — sans dépendance, sans navigateur : node tests/run-tests.mjs
// Les fonctions testées sont pures : elles ne touchent ni localStorage ni le DOM.
// Garde DOM dans les modules : importables depuis Node.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { classifyFinal } from "../js/voice.js";
import { filterMealsByDays, waterRowsByDays } from "../js/print.js";
import { computeStats, critiqueLocale, FAMILLES } from "../js/trends.js";
import { extractPhotoVerdict } from "../js/ia-external.js";
import { getIAEndpoint, isProxyConfigured } from "../js/ia-settings.js";
import { sortMealsByDatetimeDesc, updateMealInList } from "../js/storage.js";

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log("  ok " + name); }
  catch (e) { fail++; console.error("  ÉCHEC " + name + " : " + e.message); }
}

const NOW = new Date("2026-11-03T12:00:00").getTime();

console.log("Dictée (régression bug Chrome Android) :");
test("fragment identique → ignoré", () => {
  assert.deepEqual(classifyFinal("salade", "salade"), { action: "ignore" });
});
test("fragment croissant → révision", () => {
  assert.deepEqual(classifyFinal("salade de", "salade"), { action: "revise", from: "salade", to: "salade de" });
});
test("énoncé indépendant → ajout", () => {
  assert.deepEqual(classifyFinal("et un yaourt", "salade de lentilles"), { action: "append", text: "et un yaourt" });
});
test("séquence réelle « salade de lentilles » → 1 ajout + 2 révisions, 0 doublon", () => {
  const seq = ["salade", "salade", "salade", "salade", "salade de", "salade de lentilles"];
  let last = "", appends = [], revisions = [];
  for (const t of seq) {
    const v = classifyFinal(t, last);
    if (v.action === "append") appends.push(v.text);
    if (v.action === "revise") revisions.push(v);
    last = t;
  }
  assert.equal(appends.length, 1);
  assert.equal(appends[0], "salade");
  assert.equal(revisions.length, 2);
  assert.equal(revisions[1].to, "salade de lentilles");
});

console.log("Impression :");
const meals = [
  { datetime: "2026-11-03T08:00", text: "petit-déjeuner" },
  { datetime: "2026-11-01T19:00", text: "souper" },
  { datetime: "2026-09-02T12:00", text: "vieux repas" }
];
test("filtre 7 jours", () => {
  const out = filterMealsByDays(meals, 7, NOW);
  assert.equal(out.length, 2);
  assert.equal(out[0].text, "petit-déjeuner");
});
test("filtre tout l'historique", () => {
  assert.equal(filterMealsByDays(meals, 0, NOW).length, 3);
});
const waterRaw = {
  "2026-11-02": [{ cl: 33 }, { cl: 50 }],
  "2026-11-03": [{ cl: 20 }],
  "2026-08-01": [{ cl: 100 }]
};
test("eau : somme par jour, format ancien (nombre) toléré", () => {
  const rows = waterRowsByDays({ "2026-11-02": 83, "2026-08-01": 10 }, 0, NOW);
  assert.equal(rows[0].total, 83);
});
test("eau : filtre période", () => {
  const rows = waterRowsByDays(waterRaw, 7, NOW);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].total, 20);
  assert.equal(rows[1].total, 83);
});

console.log("Tendances :");
const data30 = {
  meals: [
    { datetime: "2026-11-02T12:00", text: "salade de lentilles et une part de pizza" },
    { datetime: "2026-11-02T19:00", text: "steak frites, bière" },
    { datetime: "2026-10-25T12:00", text: "soupe de légumes, yaourt" },
    { datetime: "2026-10-20T12:00", text: "pâtes au fromage", interactionDetected: { message: "test" } },
    { datetime: "2026-08-01T12:00", text: "hors période : salade pizza frites" }
  ],
  water: {
    "2026-11-02": [{ cl: 150 }],
    "2026-10-25": [{ cl: 80 }]
  }
};
test("stats : périmètre 30 jours exclu le repas hors période", () => {
  const s = computeStats(30, data30, NOW);
  assert.equal(s.meals.length, 4);
  assert.equal(s.alertes, 1);
});
test("stats : portions standard par famille (salade → fruits & légumes)", () => {
  const s = computeStats(30, data30, NOW);
  const fl = s.famCounts.find(f => f.nom === "Fruits & légumes");
  const gras = s.famCounts.find(f => f.nom === "Plats gras ou sucrés");
  assert.equal(fl.portions, 2); // 2 repas avec fruits & légumes (salade de lentilles, soupe) ; le « salade » hors période n'est pas compté
  assert.equal(gras.portions, 2); // 2 repas avec plat gras/sucré (pizza, steak frites)
});
test("stats : jours d'utilisation = étendue réelle des données (pas la période)", () => {
  const s = computeStats(30, data30, NOW);
  // Données du 20/10 au 02/11 inclus = 14 jours ; eau 230 cl au total sur ces jours
  assert.equal(s.joursUtilisation, 14);
  assert.equal(Math.round(s.avgEau), Math.round(230 / 14));
  assert.equal(s.avgRepas.toFixed(1), (4 / 14).toFixed(1));
});
test("stats : 1 seul jour d'essai → moyennes NON diluées par la période de 30 jours", () => {
  const data1jour = {
    meals: [
      { datetime: "2026-11-02T08:00", text: "pain et beurre" },
      { datetime: "2026-11-02T12:00", text: "salade de riz" },
      { datetime: "2026-11-02T19:00", text: "soupe de légumes" }
    ],
    water: { "2026-11-02": [{ cl: 150 }] }
  };
  const s = computeStats(30, data1jour, NOW);
  assert.equal(s.joursUtilisation, 1);
  assert.equal(s.avgRepas, 3);        // 3 repas ce jour-là → 3/jour, pas 0,1
  assert.equal(s.avgEau, 150);        // 150 cl ce jour-là → 150 cl/jour, pas 5
});
test("critique locale : mentionne l'hypothèse portion standard", () => {
  const s = computeStats(30, data30, NOW);
  const txt = critiqueLocale(s);
  assert.ok(txt.includes("portion individuelle standard"));
});
test("critique locale : alerte PNNS 5 portions si fruits & légumes rares", () => {
  // 6 repas (seuil de déclenchement), fruits & légumes dans 1 repas sur 6 (< 1/2)
  const dataLowFl = {
    meals: [
      { datetime: "2026-11-03T08:00", text: "pain et beurre" },
      { datetime: "2026-11-03T12:00", text: "pâtes au fromage" },
      { datetime: "2026-11-02T12:00", text: "steak frites" },
      { datetime: "2026-11-02T19:00", text: "riz et poulet" },
      { datetime: "2026-11-01T12:00", text: "pizza" },
      { datetime: "2026-11-01T19:00", text: "salade verte" }
    ],
    water: {}
  };
  const s = computeStats(30, dataLowFl, NOW);
  const txt = critiqueLocale(s);
  assert.ok(txt.includes("5 portions par jour"));
  assert.ok(txt.includes("3 avec des données")); // période 30 jours, 3 jours d'utilisation
});

console.log("Paramètres IA (endpoint) :");
test("clé personnelle présente → appel direct Mistral", () => {
  assert.equal(getIAEndpoint({ apiKey: "mstrl_abcdef123456" }), "direct");
});
test("sans clé personnelle → proxy serveur", () => {
  assert.equal(getIAEndpoint({ apiKey: "" }), "proxy");
});
test("health du serveur configuré → proxy actif", () => {
  assert.equal(isProxyConfigured({ status: "ok", app: "carnet-alimentaire", version: "0.3.1", ia_proxy: true }), true);
});
test("health sans clé serveur (ia_proxy false) → proxy inactif", () => {
  assert.equal(isProxyConfigured({ status: "ok", app: "carnet-alimentaire", version: "0.3.1", ia_proxy: false }), false);
});
test("serveur injoignable (health null, usage hors LXC) → proxy inactif", () => {
  assert.equal(isProxyConfigured(null), false);
});

console.log("Historique : tri et édition :");
test("tri chronologique inverse — un repas encodé tardivement remonte à sa vraie place", () => {
  const list = [
    { id: 3, text: "dîner", datetime: "2026-11-09T19:00" },
    { id: 1, text: "petit-déj", datetime: "2026-11-09T07:00" },
    { id: 2, text: "midi", datetime: "2026-11-09T12:00" }
  ];
  const sorted = sortMealsByDatetimeDesc(list);
  assert.deepEqual(sorted.map(m => m.id), [3, 2, 1]);
  // pas de mutation de la liste d'origine
  assert.equal(list[1].id, 1);
});
test("repas sans date valide → en fin de liste, sans crash", () => {
  const list = [
    { id: 1, text: "sans date", datetime: "" },
    { id: 2, text: "daté", datetime: "2026-11-09T12:00" }
  ];
  const sorted = sortMealsByDatetimeDesc(list);
  assert.deepEqual(sorted.map(m => m.id), [2, 1]);
});
test("updateMealInList remplace par id, conserve les autres et la position", () => {
  const list = [
    { id: 1, text: "ancien", datetime: "2026-11-09T07:00" },
    { id: 2, text: "milieu", datetime: "2026-11-09T12:00" },
    { id: 3, text: "fin", datetime: "2026-11-09T19:00" }
  ];
  const out = updateMealInList(list, { id: 2, text: "corrigé", datetime: "2026-11-09T12:30" });
  assert.equal(out.length, 3);
  assert.equal(out[1].text, "corrigé");
  assert.equal(out[1].datetime, "2026-11-09T12:30");
  assert.equal(list[1].text, "milieu"); // pas de mutation de la liste d'origine
});
test("updateMealInList : id inconnu → liste inchangée (copie)", () => {
  const list = [{ id: 1, text: "a" }];
  const out = updateMealInList(list, { id: 99, text: "x" });
  assert.equal(out.length, 1);
  assert.equal(out[0].text, "a");
  assert.notEqual(out, list);
});

console.log("Reconnaissance photo (verdict) :");
test("verdict ok extrait et retiré du texte affiché", () => {
  const r = extractPhotoVerdict("Salade et poulet identifiés. Aucune interaction.\n[VERDICT] ok");
  assert.equal(r.verdict, "ok");
  assert.ok(!r.analysis.includes("[VERDICT]"));
  assert.ok(r.analysis.includes("Salade"));
});
test("verdict partielle détecté", () => {
  const r = extractPhotoVerdict("Je ne peux pas identifier l'élément brun à gauche.\n[VERDICT] partielle");
  assert.equal(r.verdict, "partielle");
});
test("verdict impossible détecté", () => {
  const r = extractPhotoVerdict("Photo non exploitable.\n[VERDICT] impossible");
  assert.equal(r.verdict, "impossible");
});
test("absence de tag → verdict null, texte intact (aucune invention côté client)", () => {
  const r = extractPhotoVerdict("Analyse simple sans tag");
  assert.equal(r.verdict, null);
  assert.equal(r.analysis, "Analyse simple sans tag");
});

// Non-régression (13/11) : ui.js appelait Storage.sortMealsByDatetimeDesc alors
// que « Storage » est une interface native du navigateur (localStorage) — TypeError
// au premier rendu d'une liste NON vide (liste vide = retour anticipé, donc badge OK
// à l'init puis crash au premier enregistrement). Un module qui utilise Storage.*
// doit importer le namespace ; sinon l'identifiant résout vers l'interface native.
test("collision interface native : Storage.* exige « import * as Storage »", () => {
  const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "js");
  for (const f of readdirSync(dir).filter(f => f.endsWith(".js"))) {
    const src = readFileSync(join(dir, f), "utf8");
    if (/\bStorage\.[a-zA-Z]/.test(src)) {
      assert.ok(
        src.includes("import * as Storage"),
        f + " : Storage.* utilisé sans « import * as Storage » — l'identifiant résout vers l'interface native du navigateur (bug du 13/11)"
      );
    }
  }
});

console.log("");
if (fail > 0) { console.error(fail + " test(s) en échec sur " + (pass + fail)); process.exit(1); }
console.log("✅ " + pass + " tests OK");
