// Headless smoke test for loop-app.html — stubs the DOM, runs the real app code.
const fs = require("fs");
const vm = require("vm");
const path = require("path").join(__dirname, "..", "loop-app.html");
const html = fs.readFileSync(path, "utf8");
const js = html.split("<script>")[1].split("</script>")[0];

function El() {
  const t = {
    innerHTML: "", textContent: "", value: "", dataset: {}, style: {}, files: [],
    scrollTop: 0, scrollHeight: 0, firstElementChild: null, files: [],
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    style: { setProperty() {}, removeProperty() {} },
    scrollWidth: 900, offsetWidth: 300, children: [],
    getBoundingClientRect: () => ({ top: 0, bottom: 900, left: 0, right: 300, width: 300, height: 900 }),
    setAttribute() {}, removeAttribute() {}, addEventListener() {}, focus() {},
    click() {}, insertAdjacentHTML() {}, scrollIntoView() {}
  };
  return new Proxy(t, {
    get(o, k) { return k in o ? o[k] : function () { return El(); }; },
    set(o, k, v) { o[k] = v; return true; }
  });
}
const sandbox = {
  console, setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
  JSON, Math, Object, Array, String, Number, Boolean, Set, Map, Date, isFinite, parseInt, parseFloat, RegExp, Error,
  document: { querySelector: () => El(), getElementById: () => El(), querySelectorAll: () => [], addEventListener() {}, createElement: () => El(), body: El(), documentElement: El(), head: El() },
  window: { innerWidth: 1400, scrollTo() {}, addEventListener() {}, matchMedia: () => ({ matches: false }) },
  performance: { now: () => 0 }, requestAnimationFrame: () => 0,
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  IntersectionObserver: function () { this.observe = function () {}; this.unobserve = function () {}; },

  location: { hash: "" },
  FileReader: function () { this.readAsDataURL = function () {}; }
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(js + ";globalThis.__API={S,scoreGarment,wardrobeStats,semanticFilter,filtered,analyseBuy,aiAnswer,startScan,editDraft,commitGarment,RENDER,scoreModal,circAction,exportData,landingPreview,buildNav,G};", sandbox);

const A = sandbox.__API;

let fails = 0;
function ok(name, cond, extra) {
  if (!cond) { fails++; console.log("  FAIL " + name + (extra !== undefined ? "  -> " + extra : "")); }
  else console.log("  ok   " + name + (extra !== undefined ? "  (" + extra + ")" : ""));
}
const S = A.S, sg = A.scoreGarment;
const byName = (n) => S.items.filter((x) => x.n === n)[0];
const g = (n) => sg(byName(n));

console.log("\n== ENGINE: all garments produce finite, in-range values ==");
const bad = S.items.filter((it) => {
  const r = sg(it);
  const subBad = Object.keys(r.sub).some((k) => !(r.sub[k] >= 0 && r.sub[k] <= 100));
  return !(r.overall >= 0 && r.overall <= 100) || subBad ||
    !isFinite(r.waterL) || !isFinite(r.co2) || !isFinite(r.lifespan) || !isFinite(r.cpw);
}).map((i) => i.n);
ok("every garment: 7 sub-scores + total in 0-100, all figures finite", bad.length === 0, bad.join(", "));
ok("dataset is 18 garments", S.items.length === 18, S.items.length);
ok("every garment's fibre percentages sum to 100",
  S.items.every((i) => i.mat.reduce((a, b) => a + b[1], 0) === 100),
  S.items.filter((i) => i.mat.reduce((a, b) => a + b[1], 0) !== 100).map((i) => i.n).join(","));

console.log("\n== ENGINE: does it rank things the way a jury would expect? ==");
ok("organic cotton tee > polyester party top", g("Organic cotton tee").overall > g("Sequin party top").overall,
  g("Organic cotton tee").overall + " vs " + g("Sequin party top").overall);
ok("linen shirt > conventional-cotton poplin", g("Linen camp shirt").overall > g("White poplin shirt").overall,
  g("Linen camp shirt").overall + " vs " + g("White poplin shirt").overall);
ok("cotton poplin carries a heavy water figure", g("White poplin shirt").waterL > 1500, g("White poplin shirt").waterL + " L");
ok("wool overcoat carbon > cotton tee carbon", g("Wool-blend overcoat").co2 > g("Organic cotton tee").co2,
  g("Wool-blend overcoat").co2 + " vs " + g("Organic cotton tee").co2 + " kg");
ok("second-hand attribution applied to leather jacket", g("Leather biker jacket").co2 < 10, g("Leather biker jacket").co2 + " kg (30% attributed)");
ok("wool/acrylic knit flagged as unrecyclable blend", g("Cream knit sweater").blended === true);
ok("100% linen not flagged as a blend", g("Linen camp shirt").blended === false);
ok("scoring is deterministic (same input, same output)", sg(byName("Straight-leg jeans")).overall === sg(byName("Straight-leg jeans")).overall);

console.log("\n== WARDROBE SCORE ==");
const w = A.wardrobeStats();
["overall", "sustainability", "util", "durability", "versatility", "circularity", "buying"]
  .forEach((k) => ok("wardrobe." + k + " in 0-100", w[k] >= 0 && w[k] <= 100, w[k]));
ok("total carbon plausible for 18 garments", w.co2 > 100 && w.co2 < 900, w.co2 + " kg CO2e");
ok("total water plausible", w.water > 50000, w.water + " L");
ok("best / worst resolve", !!w.best && !!w.worst, w.best.n + " / " + w.worst.n);

console.log("\n== SEMANTIC SEARCH (the brief's own examples) ==");
const r1 = A.semanticFilter(S.items, "black clothes for work");
ok('"black clothes for work"', r1.length > 0 && r1.every((i) => i.fam === "black" && i.occ.indexOf("Work") >= 0), r1.map((i) => i.n).join(", "));
const r2 = A.semanticFilter(S.items, "something suitable for 15C weather");
ok('"suitable for 15C" maps to Mild', r2.length > 0 && r2.every((i) => i.weather.indexOf("Mild") >= 0), r2.length + " items");
ok("plain keyword search still works", A.semanticFilter(S.items, "linen").length === 1);
ok("nonsense query returns empty (empty state renders)", A.semanticFilter(S.items, "zzzz").length === 0);

console.log("\n== FILTERS ==");
const setF = (o) => { S.filters = Object.assign({ q: "", cat: "", occ: "", weather: "", season: "", sort: "score", only: null }, o); };
setF({ cat: "Footwear" }); ok("category filter", A.filtered().every((i) => i.cat === "Footwear"), A.filtered().length + " items");
setF({ weather: "Rain" }); ok("weather filter", A.filtered().every((i) => i.weather.indexOf("Rain") >= 0), A.filtered().length + " rain-rated");
setF({ only: "second" }); ok("second-hand chip", A.filtered().length === 1 && A.filtered()[0].second === true);
setF({ only: "dormant" }); ok("dormant chip", A.filtered().every((i) => i.lw > 150), A.filtered().length + " items");
setF({ sort: "cpw" });
const c = A.filtered(); ok("cost-per-wear sort ascending", sg(c[0]).cpw <= sg(c[c.length - 1]).cpw, sg(c[0]).cpw.toFixed(2) + " -> " + sg(c[c.length - 1]).cpw.toFixed(2));
setF({});

console.log("\n== SHOULD I BUY THIS? ==");
A.analyseBuy();
let r = S.buy.result;
ok("pre-filled black polyester dress is REFUSED", r.verdict.k === "skip", r.verdict.t + ", composite " + r.composite);
ok("it names the real duplicates it found", r.exact.length >= 1, r.exact.map((i) => i.n).join(", "));
ok("need score is low", r.need < 50, r.need);
ok("an alternative is offered", !!r.alt, r.alt);
ok("cost per wear finite and positive", isFinite(r.cpw) && r.cpw > 0, "EUR " + r.cpw.toFixed(2));
S.buy.form = { n: "Waterproof shell", br: "Rains", price: 110, cat: "Outerwear", fam: "green",
  mat: [["poly_r", 100]], occ: ["Casual", "Travel", "University", "Work"], seasons: ["All-season"], weather: ["Rain", "Wind", "Cold"], size: "M" };
A.analyseBuy(); r = S.buy.result;
ok("a genuine gap-filler is NOT refused", r.verdict.k !== "skip", r.verdict.t + ", composite " + r.composite + ", need " + r.need);
ok("gap detection fired", r.fillsGap === true, "thinnest weather: " + r.gap.thinW + " (" + r.gap.thinWn + " items)");

console.log("\n== LOOP AI — must answer only from the real wardrobe ==");
["Do I need another black dress?", "What can I wear to a formal dinner?", "What should I wear tomorrow?",
 "Which items in my wardrobe am I underusing?", "What sustainable gap exists in my wardrobe?",
 "What can I wear with my olive tapered trousers?", "What is my wardrobe carbon footprint?",
 "How is the score calculated?", "Should I buy this 80 euro dress?", "banana helicopter"]
.forEach((q) => {
  const a = A.aiAnswer(q);
  const cards = (a.cards || []).filter(Boolean);
  const realOnly = cards.every((x) => S.items.indexOf(x) >= 0);
  ok('"' + q + '"', !!a.h && a.h.length > 20 && realOnly && a.h.indexOf("undefined") < 0, cards.length + " garment cards, all real");
});

console.log("\n== SCAN & ADD FLOW ==");
const before = S.items.length;
A.startScan("label");
ok("label scan creates a verified draft", !!S.scan.draft && S.scan.draft.labelScanned === true, S.scan.draft.n);
ok("draft scores immediately", sg(S.scan.draft).overall > 0, sg(S.scan.draft).overall + "/100");
A.editDraft("cat", "Knitwear"); ok("editing category remaps the artwork", S.scan.draft.art === "sweater");
A.commitGarment();
ok("garment lands in the wardrobe", S.items.length === before + 1, S.items.length + " items");
ok("composition renormalised to 100%", S.items[S.items.length - 1].mat.reduce((a, b) => a + b[1], 0) === 100);
S.items.pop();

console.log("\n== RENDER: every screen builds without throwing ==");
Object.keys(A.RENDER).forEach((k) => {
  try { S.itemId = 1; A.RENDER[k](); ok("RENDER." + k, true); }
  catch (e) { fails++; console.log("  FAIL RENDER." + k + " -> " + e.message); }
});
try { A.scoreModal(1); A.circAction("Resell", 3); A.exportData(); A.landingPreview(); A.buildNav(); ok("modals, export, landing preview, nav", true); }
catch (e) { fails++; console.log("  FAIL " + e.message); }

console.log(fails === 0 ? "\nALL CHECKS PASSED" : "\n" + fails + " FAILURE(S)");
process.exit(fails ? 1 : 0);
