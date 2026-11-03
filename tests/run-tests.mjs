// Tests du carnet — sans dépendance, sans navigateur : node tests/run-tests.mjs
// Les fonctions testées sont pures : elles ne touchent ni localStorage ni le DOM.
// Garde DOM dans les modules : importables depuis Node.
import assert from "node:assert/strict";
import { classifyFinal } from "../js/voice.js";
import { filterMealsByDays, waterRowsByDays } from "../js/print.js";
import { computeStats, critiqueLocale, FAMILLES } from "../js/trends.js";

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
  const s = computeStats(30, data30);
  assert.equal(s.meals.length, 4);
  assert.equal(s.alertes, 1);
});
test("stats : portions standard par famille (salade → fruits & légumes)", () => {
  const s = computeStats(30, data30);
  const fl = s.famCounts.find(f => f.nom === "Fruits & légumes");
  const gras = s.famCounts.find(f => f.nom === "Plats gras ou sucrés");
  assert.equal(fl.portions, 3); // salade, soupe de légumes, salade(hors période non comptée)
  assert.equal(gras.portions, 2); // pizza, frites
});
test("stats : eau moyenne sur la période (diviseur = jours de période)", () => {
  const s = computeStats(30, data30);
  assert.equal(Math.round(s.avgEau), Math.round(230 / 30));
});
test("critique locale : mentionne l'hypothèse portion standard", () => {
  const s = computeStats(30, data30);
  const txt = critiqueLocale(s);
  assert.ok(txt.includes("portion individuelle standard"));
  assert.ok(txt.includes("5 portions"));
});

console.log("");
if (fail > 0) { console.error(fail + " test(s) en échec sur " + (pass + fail)); process.exit(1); }
console.log("✅ " + pass + " tests OK");
