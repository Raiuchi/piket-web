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
check('night mode and in-app replacement disclaimer are removed', !html.includes('Ночной режим') && !html.includes('nightOverlay') && !html.includes('Помощник, а не замена'));
check('calibration fields use examples instead of preset-looking values', html.includes('id="cKm" class="num" inputmode="numeric" placeholder="напр. 1"') && html.includes('id="cPk" class="num" inputmode="numeric" placeholder="напр. 1"') && html.includes('id="cM" class="num" inputmode="numeric" placeholder="напр. 0"') && html.includes('$("#cKm").value="";') && html.includes('$("#cPk").value="";') && html.includes('$("#cM").value="";'));
check('DU-61 practical reasons and power commands are present', ['Неисправность пути','Дефект рельса','Опустить токоприёмник','Поднять токоприёмник','Отключить ток','Включить ток','Неисправность средств СЦБ и связи','Негабаритный груз'].every(x => html.includes(x)));
check('manifest is linked', html.includes('rel="manifest" href="manifest.json"'));
check('service worker is registered', html.includes("navigator.serviceWorker.register('./sw.js')"));

const manifest = JSON.parse(read('manifest.json'));
check('PWA starts in standalone mode', manifest.display === 'standalone');
check('PWA icons exist', manifest.icons.every(icon => fs.existsSync(new URL(icon.src, root))));
check('Apple touch icon exists', fs.existsSync(new URL('icons/apple-touch-icon.png', root)));
check('premium icon is used in header', html.includes('url("icons/icon-192.png")'));
check('offline premium Manrope fonts exist', fs.existsSync(new URL('assets/fonts/manrope-cyrillic.woff2', root)) && fs.existsSync(new URL('assets/fonts/manrope-latin.woff2', root)));
check('smooth GPS recovery is implemented', html.includes('correctionTargetOdo') && html.includes('GPS восстановлен — плавно уточняю позицию'));
check('stale, spoofed and poor Doppler fixes are rejected', html.includes('fixAge>5000') && html.includes('mockLocation===true') && html.includes('poorDoppler') && html.includes('constellationDiversity'));

const worker = read('sw.js');
new vm.Script(worker, { filename: 'sw.js' });
check('offline shell includes main page and manifest', worker.includes("'./index.html'") && worker.includes("'./manifest.json'"));
check('old PWA caches are removed', worker.includes("key.startsWith('piket-web-')"));

for (const result of checks) console.log(`${result.ok ? 'PASS' : 'FAIL'} ${result.name}`);
console.log(`${checks.filter(result => result.ok).length}/${checks.length} checks passed`);
