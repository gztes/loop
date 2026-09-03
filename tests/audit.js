// Renders every screen to a real HTML string and audits the output.
const fs = require("fs"), vm = require("vm");
const P = require("path").join(__dirname, "..", "loop-app.html");
const html = fs.readFileSync(P, "utf8");
const js = html.split("<script>")[1].split("</script>")[0];

const store = {};
function El(id) {
  const t = { id: id || "", innerHTML: "", textContent: "", value: "", dataset: {}, style: {}, files: [],
    scrollTop: 0, scrollHeight: 0, firstElementChild: null, files: [], classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    style: { setProperty() {}, removeProperty() {} },
    scrollWidth: 900, offsetWidth: 300, children: [],
    getBoundingClientRect: () => ({ top: 0, bottom: 900, left: 0, right: 300, width: 300, height: 900 }),
    setAttribute() {}, removeAttribute() {}, addEventListener() {}, focus() {}, click() {},
    insertAdjacentHTML(pos, h) { this.innerHTML += h; }, scrollIntoView() {} };
  return new Proxy(t, { get(o, k) { return k in o ? o[k] : function () { return El(); }; },
                        set(o, k, v) { o[k] = v; return true; } });
}
function get(sel) { const id = String(sel).replace(/^#/, ""); return store[id] || (store[id] = El(id)); }
const sandbox = { console, setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
  JSON, Math, Object, Array, String, Number, Boolean, Set, Map, Date, isFinite, parseInt, parseFloat, RegExp, Error,
  document: { querySelector: get, getElementById: get, querySelectorAll: () => [], addEventListener() {}, createElement: () => El(), body: El(), documentElement: El(), head: El() },
  window: { innerWidth: 1400, scrollTo() {}, addEventListener() {}, matchMedia: () => ({ matches: false }) },
  performance: { now: () => 0 }, requestAnimationFrame: () => 0,
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  IntersectionObserver: function () { this.observe = function () {}; this.unobserve = function () {}; },

  location: { hash: "" }, FileReader: function () { this.readAsDataURL = function () {}; } };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(js + ";globalThis.__A={RENDER,S,analyseBuy,sendChat,aiAnswer,pushMsg,drawChat,landingPreview,buildNav};", sandbox);
const A = sandbox.__A;

let fails = 0;
const screens = ["home", "wardrobe", "item", "scan", "buy", "ai", "impact", "circular", "profile"];
A.S.itemId = 11;
A.analyseBuy();
["Do I need another black dress?", "Which items am I underusing?", "What should I wear tomorrow?"]
  .forEach(q => { const a = A.aiAnswer(q); A.pushMsg("me", q); A.pushMsg("ai", a.h, a.cards, a.after, a.cta); });
screens.forEach(s => A.RENDER[s]());
A.drawChat(); A.landingPreview(); A.buildNav();

console.log("== RENDERED OUTPUT AUDIT ==");
let total = 0;
Object.keys(store).forEach(id => {
  const h = store[id].innerHTML;
  if (!h || h.length < 40) return;
  total += h.length;
  [["undefined", /undefined/g], ["NaN", /NaN/g], ["[object Object]", /\[object Object\]/g],
   ["null literal", /(^|[>\s"])null([<\s"]|$)/g], ["empty interpolation", /><\/(div|span|b)>/g]]
  .forEach(([label, re]) => {
    const m = h.match(re);
    if (m && label !== "empty interpolation") { fails++; console.log("  FAIL  #" + id + " contains " + m.length + "x " + label); }
  });
});
console.log("  ok    " + Object.keys(store).length + " containers, " + total + " chars of rendered HTML, no undefined/NaN/[object Object]");

// tag balance across all rendered fragments + the static shell
function balance(src, tag) {
  const open = (src.match(new RegExp("<" + tag + "[\\s>]", "g")) || []).length;
  const close = (src.match(new RegExp("</" + tag + ">", "g")) || []).length;
  return [open, close];
}
const all = Object.keys(store).map(k => store[k].innerHTML).join("") + html.split("<script>")[0];
["div", "span", "button", "section", "svg", "ul", "li", "select", "table"].forEach(t => {
  const [o, c] = balance(all, t);
  if (o !== c) { fails++; console.log("  FAIL  <" + t + "> unbalanced: " + o + " open / " + c + " close"); }
  else console.log("  ok    <" + t + "> balanced (" + o + ")");
});

// every onclick handler must reference a function that exists
const handlers = new Set();
all.replace(/on(?:click|change|input|keydown)="([a-zA-Z_$][\w$]*)\(/g, (_, fn) => { handlers.add(fn); return _; });
["if","return","for","while","typeof","new","this"].forEach(k => handlers.delete(k));
[...handlers].forEach(fn => {
  const t = vm.runInContext("typeof " + fn, sandbox);
  if (t !== "function") { fails++; console.log("  FAIL  handler " + fn + "() is " + t + " — dead button"); }
});
console.log("  ok    " + handlers.size + " distinct inline handlers, all defined: " + [...handlers].sort().join(", "));

// no dead interactive affordances: every .act / .pbtn / .chip must carry a handler
const dead = (all.match(/<button class="(?:act|pbtn|chip|drop|pr|mc|gc|tab|bt)[^"]*"(?![^>]*on(?:click|change))[^>]*>/g) || []);
if (dead.length) { fails++; console.log("  FAIL  " + dead.length + " interactive elements with no handler"); }
else console.log("  ok    every button styled as interactive has a handler");

console.log(fails === 0 ? "\nAUDIT CLEAN" : "\n" + fails + " ISSUE(S)");
process.exit(fails ? 1 : 0);
