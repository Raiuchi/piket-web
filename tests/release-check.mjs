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
const core = read('assets/piket-core.js');
const source = core + '\n' + html;
const scripts = [core, ...[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(match => match[1])];
check('all embedded JavaScript parses', scripts.every((script, index) => {
  try { new vm.Script(script, { filename: `web-script-${index}.js` }); return true; }
  catch { return false; }
}));

const ids = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map(match => match[1]);
check('HTML ids are unique', new Set(ids).size === ids.length);
check('bottom sheets and dialogs stay above navigation', source.includes('.nav{left:10px;right:10px;bottom:calc(16px + env(safe-area-inset-bottom));z-index:100') && source.includes('.sheet{position:fixed;left:0;right:0;bottom:0;z-index:120') && source.includes('.cfScrim{position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:130'));
check('closed bottom sheets cannot cast shadows over navigation', source.includes('.sheet:not(.on){visibility:hidden!important;box-shadow:none!important}'));
check('night mode and in-app replacement disclaimer are removed', !source.includes('Ночной режим') && !source.includes('nightOverlay') && !source.includes('Помощник, а не замена'));
check('calibration fields use examples instead of preset-looking values', source.includes('id="cKm" class="num" inputmode="numeric" placeholder="напр. 1"') && source.includes('id="cPk" class="num" inputmode="numeric" placeholder="напр. 1"') && source.includes('id="cM" class="num" inputmode="numeric" placeholder="напр. 0"') && source.includes('$("#cKm").value="";') && source.includes('$("#cPk").value="";') && source.includes('$("#cM").value="";'));
check('DU-61 practical reasons and power commands are present', ['Неисправность пути','Дефект рельса','Опустить токоприёмник','Поднять токоприёмник','Отключить ток','Включить ток','Неисправность средств СЦБ и связи','Негабаритный груз'].every(x => source.includes(x)));
check('official kilometer offset is learned and isolated per route', source.includes('sap_routeOffsets') && source.includes('function routeOfficialOffset') && source.includes('function learnRouteOffset') && source.includes('officialTrackM(autoTM,state.ctx.peregon)'));
check('spline snapping continuously refines sub-segment position', source.includes('for(var refine=0;refine<10;refine++)') && source.includes('var refined=(left+right)/2'));
check('manifest is linked', source.includes('rel="manifest" href="manifest.json"'));
check('service worker is registered', source.includes("navigator.serviceWorker.register('./sw.js')"));

const manifest = JSON.parse(read('manifest.json'));
check('PWA starts in standalone mode', manifest.display === 'standalone');
check('PWA icons exist', manifest.icons.every(icon => fs.existsSync(new URL(icon.src, root))));
check('Apple touch icon exists', fs.existsSync(new URL('icons/apple-touch-icon.png', root)));
check('animated signal emblem is bundled and used', fs.existsSync(new URL('icons/piket-signal.gif', root)) && source.includes('url("icons/piket-signal.gif")'));
check('bottom navigation uses crisp text and icons', source.includes('text-shadow:none!important') && source.includes('filter:none!important;shape-rendering:geometricPrecision'));
check('shared route core is loaded', source.includes('assets/piket-core.js') && core.includes('var TRACK =') && core.includes('var CHAINAGE ='));
check('storage failures are visible to the user', source.includes('function storageFailure()') && source.includes('Не удалось сохранить данные'));
check('offline premium Manrope fonts exist', fs.existsSync(new URL('assets/fonts/manrope-cyrillic.woff2', root)) && fs.existsSync(new URL('assets/fonts/manrope-latin.woff2', root)));
check('smooth GPS recovery is implemented', source.includes('correctionTargetOdo') && source.includes('GPS восстановлен — плавно уточняю позицию'));
check('official chainage is separated from physical track', source.includes('var CHAINAGE =') && source.includes('function baseOfficialTrackM') && source.includes('official<=0 || Math.abs(official-physical)>3000'));
check('moving recovery follows confirmed physical GPS target', source.includes('targetTrackM=state.calib._trackM+(dirDown()?-1:1)*rt.correctionTargetOdo') && source.includes('plausibilityDiff=Math.abs(tMfinal-targetTrackM)') && source.includes('rt.correctionTargetOdo=newOdoVal'));
check('GPS jitter is filtered along the moving track without coordinate lag', source.includes('function stableAlongTrackCandidate') && source.includes('rt.gpsResiduals.length>5'));
check('dead-reckoning speed decay is based on elapsed time, not callback count', source.includes('decayPerSecond') && source.includes('Math.pow(decayPerSecond,lossDt)'));
check('train dynamics reject impossible acceleration and confirm speed recovery', source.includes('maxSpeedChange=Math.min(12*Math.max(dt,0.5)+5, 45)') && source.includes('rt.speedCandCount<2'));
check('confirmed large position recovery is immediate', source.includes('diff>=50 && signalGood && !satelliteWeak') && source.includes('rt.odo=newOdoVal; rt.correctionTargetOdo=null'));
check('PIKET RS premium red theme is present', source.includes('PIKET RS · единая спортивная премиум-тема') && source.includes('#F02D3A'));
check('speed reference uses red main and yellow side track palette', source.includes('🔴 Гл.п — главный путь · 🟡 Бок.п — боковой путь') && source.includes('.srBadge.glp{background:linear-gradient(180deg,rgba(240,45,58,.30)') && source.includes('.srBadge.bokp{background:linear-gradient(180deg,rgba(245,183,36,.28)') && !source.includes('rgba(47,157,235,.3)'));
check('restriction acknowledgement uses premium red styling', source.includes('background:linear-gradient(180deg,#f42b43 0%,#c8102e 58%,#8d071e 100%)'));
check('stale, spoofed and poor Doppler fixes are rejected', source.includes('fixAge>5000') && source.includes('mockLocation===true') && source.includes('poorDoppler') && source.includes('constellationDiversity'));
check('position confidence has four explicit states', core.includes('label:"точная"') && core.includes('label:"расчётная"') && core.includes('label:"восстанавливается"') && core.includes('label:"нужна сверка"'));
check('wrong direction requires repeated heading mismatch', source.includes('directionMismatchCount>=3') && source.includes('Проверь выбранное направление движения'));
check('unacknowledged restrictions repeat without constant spam', source.includes('Date.now()-(rt.alertRepeatAt||0)>20000') && source.includes('Ограничение не подтверждено'));
check('restriction trigger distance is audited', source.includes('sap_triggerAudit') && core.includes('triggerAudit'));
check('running time calculator is guarded against impossible plans', source.includes('Перегонное время хода') && source.includes('План недостижим безопасно') && core.includes('requiredAverageKmh'));

const worker = read('sw.js');
new vm.Script(worker, { filename: 'sw.js' });
check('offline shell includes main page, manifest, versioned route core and signal animation', worker.includes("'./index.html'") && worker.includes("'./manifest.json'") && worker.includes("'./assets/piket-core.js?v=1.4.92-reliability1'") && worker.includes("'./icons/piket-signal.gif'"));
check('old PWA caches are removed', worker.includes("key.startsWith('piket-web-')"));

for (const result of checks) console.log(`${result.ok ? 'PASS' : 'FAIL'} ${result.name}`);
console.log(`${checks.filter(result => result.ok).length}/${checks.length} checks passed`);
