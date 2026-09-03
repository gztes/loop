// Targeted checks for the new marketing page: screen builders + scroll engine.
const fs = require("fs"), vm = require("vm");
const html = fs.readFileSync(require("path").join(__dirname, "..", "loop-app.html"), "utf8");
const js = html.split("<script>")[1].split("</script>")[0];

function El() {
  const t = { innerHTML: "", textContent: "", value: "", dataset: {}, files: [],
    scrollTop: 0, scrollHeight: 0, scrollWidth: 900, offsetWidth: 300, children: [], firstElementChild: null,
    classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
    style: { setProperty(){}, removeProperty(){} },
    getBoundingClientRect: () => ({ top: 0, bottom: 900, left: 0, right: 300, width: 300, height: 900 }),
    setAttribute(){}, removeAttribute(){}, addEventListener(){}, focus(){}, click(){},
    insertAdjacentHTML(){}, scrollIntoView(){}, remove(){} };
  return new Proxy(t, { get:(o,k)=> k in o ? o[k] : function(){ return El(); }, set:(o,k,v)=>{o[k]=v;return true;} });
}
const sandbox = { console, setTimeout:()=>0, clearTimeout(){}, setInterval:()=>0, clearInterval(){},
  JSON, Math, Object, Array, String, Number, Boolean, Set, Map, Date, isFinite, parseInt, parseFloat, RegExp, Error,
  performance:{now:()=>0}, requestAnimationFrame:()=>0,
  localStorage:{getItem:()=>null,setItem(){},removeItem(){}},
  IntersectionObserver: function(){ this.observe=function(){}; this.unobserve=function(){}; },
  document:{ querySelector:()=>El(), getElementById:()=>El(), querySelectorAll:()=>[],
             addEventListener(){}, createElement:()=>El(), body:El(), documentElement:El(), head:El() },
  window:{ innerWidth:1400, pageYOffset:0, scrollTo(){}, addEventListener(){}, matchMedia:()=>({matches:false}) },
  location:{ hash:"" }, FileReader: function(){ this.readAsDataURL=function(){}; } };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(js + ";globalThis.__A={SHOWCASE,msScan,msItem,msWardrobe,msBuy,msAI,initSite,buildShowcaseStatic,S,PHOTOS,countTo,tile,scenes};", sandbox);
const A = sandbox.__A;

let fails = 0;
const ok = (n, c, x) => { if (!c) { fails++; console.log("  FAIL " + n + (x!==undefined?"  -> "+x:"")); } else console.log("  ok   " + n + (x!==undefined?"  ("+x+")":"")); };

console.log("== PRODUCT SHOWCASE SCREENS ==");
["msScan","msItem","msWardrobe","msBuy","msAI"].forEach(fn => {
  let h = "";
  try { h = A[fn](); } catch (e) { fails++; console.log("  FAIL " + fn + " threw -> " + e.message); return; }
  ok(fn, h.length > 300 && !/undefined|NaN|\[object Object\]/.test(h), h.length + " chars");
});
ok("showcase has 5 steps", A.SHOWCASE.length === 5);
ok("every step has copy + a screen builder",
   A.SHOWCASE.every(s => s.k && s.t && s.b && typeof s.make === "function"));

console.log("\n== SCREENS USE THE REAL CATALOGUE ==");
const nPhotos = Object.keys(A.PHOTOS || {}).length;
ok("photography embedded", nPhotos === 21, nPhotos + " shots");
const w = A.msWardrobe();
ok("wardrobe screen shows real photos", (w.match(/data:image\/jpeg/g) || []).length >= 4,
   (w.match(/data:image\/jpeg/g) || []).length + " images");
ok("wardrobe screen answers 'black clothes for work'", w.includes("black clothes for work"));
ok("buy screen shows the real refusal", A.msBuy().includes("Probably skip"));
const item = A.msItem();
const partyTop = A.S.items.filter(i => i.id === 11)[0];
const realScore = String(sandbox.scoreGarment ? 0 : 0);
ok("item screen renders a real garment", item.includes(partyTop.n) && item.includes(partyTop.br), partyTop.n);

console.log("\n== SCROLL ENGINE ==");
try { A.initSite(); ok("initSite() runs without throwing", true); }
catch (e) { fails++; console.log("  FAIL initSite -> " + e.message); }
try { A.buildShowcaseStatic(); ok("reduced-motion fallback builds", true); }
catch (e) { fails++; console.log("  FAIL buildShowcaseStatic -> " + e.message); }

console.log("\n== MARKUP SANITY ==");
const lp = html.slice(html.indexOf('<div id="landing">'), html.indexOf("<!-- ============ APP"));
["problem","shift","product","who"].forEach(id =>
  ok('#' + id + ' target exists for nav link', lp.includes('id="' + id + '"')));
const prose = html.replace(/Array\.prototype/g, "");
ok("ships as a product — no unfinished or demo-disclaimer copy",
   !/lorem ipsum|coming soon|demo only|not a real|TODO|FIXME/i.test(prose));
["div","section","span","button","footer","nav"].forEach(t => {
  const o = (lp.match(new RegExp("<" + t + "[\\s>]", "g")) || []).length;
  const c = (lp.match(new RegExp("</" + t + ">", "g")) || []).length;
  ok("<" + t + "> balanced in landing", o === c, o + "/" + c);
});

console.log(fails === 0 ? "\nSITE CHECKS PASSED" : "\n" + fails + " FAILURE(S)");
process.exit(fails ? 1 : 0);
