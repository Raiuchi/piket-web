import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const read = path => fs.readFileSync(new URL(path, root), 'utf8');
const checks = [];
const check = (name, condition) => {
  checks.push({ name, ok: Boolean(condition) });
  if (!condition) process.exitCode = 1;
};

const html = read('index.html');
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(match => match[1]);
check('all embedded JavaScript parses', scripts.every((script, index) => {
  try { new vm.Script(script, { filename: `web-script-${index}.js` }); return true; }
  catch { return false; }
}));

const ids = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map(match => match[1]);
check('HTML ids are unique', new Set(ids).size === ids.length);
check('bottom sheets and dialogs stay above navigation', html.includes('.nav{left:10px;right:10px;bottom:calc(16px + env(safe-area-inset-bottom));z-index:100') && html.includes('.sheet{position:fixed;left:0;right:0;bottom:0;z-index:120') && html.includes('.cfScrim{position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:130'));
check('closed bottom sheets cannot cast shadows over navigation', html.includes('.sheet:not(.on){visibility:hidden!important;box-shadow:none!important}'));
check('night mode and in-app replacement disclaimer are removed', !html.includes('Ночной режим') && !html.includes('nightOverlay') && !html.includes('Помощник, а не замена'));
check('calibration fields use examples instead of preset-looking values', html.includes('id="cKm" class="num" inputmode="numeric" placeholder="напр. 1"') && html.includes('id="cPk" class="num" inputmode="numeric" placeholder="напр. 1"') && html.includes('id="cM" class="num" inputmode="numeric" placeholder="напр. 0"') && html.includes('$("#cKm").value="";') && html.includes('$("#cPk").value="";') && html.includes('$("#cM").value="";'));
check('DU-61 practical reasons and power commands are present', ['Неисправность пути','Дефект рельса','Опустить токоприёмник','Поднять токоприёмник','Отключить ток','Включить ток','Неисправность средств СЦБ и связи','Негабаритный груз'].every(x => html.includes(x)));
check('official kilometer offset is learned and isolated per route', html.includes('sap_routeOffsets') && html.includes('function routeOfficialOffset') && html.includes('function learnRouteOffset') && html.includes('officialTrackM(autoTM,state.ctx.peregon)'));
check('spline snapping continuously refines sub-segment position', html.includes('for(var refine=0;refine<10;refine++)') && html.includes('var refined=(left+right)/2'));
check('manifest is linked', html.includes('rel="manifest" href="manifest.json"'));
check('service worker is registered', html.includes("navigator.serviceWorker.register('./sw.js')"));

const manifest = JSON.parse(read('manifest.json'));
check('PWA starts in standalone mode', manifest.display === 'standalone');
check('PWA icons exist', manifest.icons.every(icon => fs.existsSync(new URL(icon.src, root))));
check('Apple touch icon exists', fs.existsSync(new URL('icons/apple-touch-icon.png', root)));
check('animated signal emblem is bundled and used', fs.existsSync(new URL('icons/piket-signal.gif', root)) && html.includes('url("icons/piket-signal.gif")'));
check('bottom navigation uses crisp text and icons', html.includes('text-shadow:none!important') && html.includes('filter:none!important;shape-rendering:geometricPrecision'));
check('offline premium Manrope fonts exist', fs.existsSync(new URL('assets/fonts/manrope-cyrillic.woff2', root)) && fs.existsSync(new URL('assets/fonts/manrope-latin.woff2', root)));
check('smooth GPS recovery is implemented', html.includes('correctionTargetOdo') && html.includes('GPS восстановлен — плавно уточняю позицию'));
check('official chainage is separated from physical track', html.includes('var CHAINAGE =') && html.includes('function baseOfficialTrackM') && html.includes('official<=0 || Math.abs(official-physical)>3000'));
check('moving recovery follows confirmed physical GPS target', html.includes('targetTrackM=state.calib._trackM+(dirDown()?-1:1)*rt.correctionTargetOdo') && html.includes('plausibilityDiff=Math.abs(tMfinal-targetTrackM)') && html.includes('rt.correctionTargetOdo=newOdoVal'));
check('GPS jitter is filtered along the moving track without coordinate lag', html.includes('function stableAlongTrackCandidate') && html.includes('rt.gpsResiduals.length>5'));
check('dead-reckoning speed decay is based on elapsed time, not callback count', html.includes('decayPerSecond') && html.includes('Math.pow(decayPerSecond,lossDt)'));
check('train dynamics reject impossible acceleration and confirm speed recovery', html.includes('maxSpeedChange=Math.min(12*Math.max(dt,0.5)+5, 45)') && html.includes('rt.speedCandCount<2'));
check('confirmed large position recovery is immediate', html.includes('diff>=50 && signalGood && !satelliteWeak') && html.includes('rt.odo=newOdoVal; rt.correctionTargetOdo=null'));
check('PIKET RS premium red theme is present', html.includes('PIKET RS · единая спортивная премиум-тема') && html.includes('#F02D3A'));
check('speed reference uses red main and yellow side track palette', html.includes('🔴 Гл.п — главный путь · 🟡 Бок.п — боковой путь') && html.includes('.srBadge.glp{background:linear-gradient(180deg,rgba(240,45,58,.30)') && html.includes('.srBadge.bokp{background:linear-gradient(180deg,rgba(245,183,36,.28)') && !html.includes('rgba(47,157,235,.3)'));
check('restriction acknowledgement uses premium red styling', html.includes('background:linear-gradient(180deg,#f42b43 0%,#c8102e 58%,#8d071e 100%)'));
check('stale, spoofed and poor Doppler fixes are rejected', html.includes('fixAge>5000') && html.includes('mockLocation===true') && html.includes('poorDoppler') && html.includes('constellationDiversity'));

const worker = read('sw.js');
new vm.Script(worker, { filename: 'sw.js' });
check('offline shell includes main page, manifest and signal animation', worker.includes("'./index.html'") && worker.includes("'./manifest.json'") && worker.includes("'./icons/piket-signal.gif'"));
check('old PWA caches are removed', worker.includes("key.startsWith('piket-web-')"));

for (const result of checks) console.log(`${result.ok ? 'PASS' : 'FAIL'} ${result.name}`);
console.log(`${checks.filter(result => result.ok).length}/${checks.length} checks passed`);
