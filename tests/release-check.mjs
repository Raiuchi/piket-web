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
const schedule = read('assets/piket-schedules.js');
const source = core + '\n' + html;
const scripts = [core, schedule, ...[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(match => match[1])];
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
check('service worker is registered', /navigator\.serviceWorker\.register\('\.\/sw\.js'(?:,|\))/.test(source));
check('premium in-app update banner is bundled', source.includes('Вышло обновление') && source.includes('id="ubDownload"') && source.includes('showUpdateBanner'));

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
check('dead-reckoning speed decay is based on elapsed time, not callback count', source.includes('lossSpeed(rt.speed,lossDt,totalLossSec') && core.includes('Math.pow(decay,elapsedSec)'));
check('train dynamics reject impossible acceleration and confirm speed recovery', source.includes('maxSpeedChange=Math.min(12*Math.max(dt,0.5)+5, 45)') && source.includes('rt.speedCandCount<2'));
check('regional web routes reject false 250 km/h fixes', source.includes('currentBrowserSpeedCeiling()') && source.includes('gps_speed_rejected') && source.includes('stored_speed_rejected') && core.includes('browserSpeedCeiling'));
check('Moscow automatic 250 mode requires two coordinate confirmations', core.includes('browserTrustedSpeedCeiling') && core.includes('confirmAutomaticHighSpeed') && source.includes('PIKET_RELIABILITY.confirmAutomaticHighSpeed'));
check('web GPS restarts from last usable fix rather than repeated errors', source.includes('primaryFixSilence=rt.lastBrowserFixAt') && source.includes('gps_watch_restarted') && source.includes('sinceGoodFix = primaryFixSilence'));
check('iPhone foreground return discards stale motion and restarts GPS', source.includes('function restartBrowserGps') && source.includes('function resumeWebTrip') && source.includes('gps_resume_restart') && source.includes('rt.speed=0;rt.last=null') && source.includes('pageshow') && source.includes('focus') && source.includes('после разблокировки восстановлю'));
check('active web trip survives an iOS PWA process eviction', source.includes('function saveWebTripSession') && source.includes('sap_web_active') && source.includes('web_trip_auto_resumed') && source.includes('webTripAge<43200000') && source.includes('pagehide'));check('lightweight telemetry keeps web GPS smooth without rebuilding heavy cards', source.includes('function renderTripTelemetry()') && source.includes('function renderTripAdaptive(force)') && source.includes('rt.posM=currentMeters(); renderTripAdaptive(false); evalAlerts();'));
check('heat brightness action persists Auto dimming', source.includes('state.settings.screenMode="auto";delete state.settings.wake;persist();syncSw();') && source.includes('Автозатемнение включено, яркость снижена'));
check('dead reckoning cannot run indefinitely on stale speed', source.includes('PIKET_RELIABILITY.lossSpeed') && core.includes('totalLossSec>=120'));
check('stationary coordinates suppress false high Doppler speed', source.includes('stationaryAge>=10 && stationaryDist<=25') && source.includes('rt.speed=0'));
check('learned jammer zones never speak or toast repeatedly', source.includes('rt.zoneHintCooldownUntil=Date.now()+600000') && source.includes('частая зона помех') && !source.includes('Внимание, впереди зона частого глушения'));
check('trip start requires an explicit manual calibration', source.includes('state.calib==null || state.calib._manual!==true') && source.includes('Сначала обязательная калибровка') && source.includes('_manual:true'));
check('startup auto-calibration is disabled while en-route GPS correction remains', source.includes('if(false && state.calib==null && rt.tracking') && source.includes('rt.odo=newOdoVal; rt.correctionTargetOdo=null'));
check('confirmed large position recovery is immediate', source.includes('diff>=50 && signalGood && !satelliteWeak') && source.includes('rt.odo=newOdoVal; rt.correctionTargetOdo=null'));
check('PIKET RS premium red theme is present', source.includes('PIKET RS · единая спортивная премиум-тема') && source.includes('#F02D3A'));
check('premium gauge has a clear inner dial and complete 220–250 scale', source.includes('.g-sheen{inset:19%') && source.includes('.g-center{z-index:6;inset:25%') && source.includes('>230</text>') && source.includes('>240</text>') && source.includes('>250</text>') && source.includes('rotate(113.4 100 100)') && !source.includes('fadeGrad') && !source.includes('g-redline') && !source.includes('g-tickM-red') && !source.includes('g-tickS-red'));
check('speed reference uses green main and yellow side track palette', source.includes('🟢 Гл.п — главный путь · 🟡 Бок.п — боковой путь') && source.includes('.srBadge.glp{border-color:rgba(73,214,132,.38)') && source.includes('.srBadge.bokp{border-color:rgba(245,183,36,.35)'));
check('Sapsan uses white and Lastochka black cards with red train labels', source.includes('function speedTrainClass') && source.includes('.routeCard.train-sapsan{border-color:rgba(255,255,255,.96);background:linear-gradient(145deg,#FFFFFF,#ECECEF)') && source.includes('.routeCard.train-sapsan .rcTrain{border-color:rgba(240,45,58,.42);background:#FFFFFF;color:#D91D2B}') && source.includes('.routeCard.train-sapsan .rcName{color:#151519}') && source.includes('.routeCard.train-lastochka{border-color:rgba(240,45,58,.30);background:linear-gradient(145deg,#0B0B0D,#020203)') && source.includes('.routeCard.train-lastochka .rcTrain{border-color:rgba(240,45,58,.38);background:#050506;color:#F02D3A}') && source.includes('#v-speedref.train-sapsan #srTitle,#v-speedref.train-lastochka #srTitle{color:#F02D3A}'));
check('restriction acknowledgement uses premium red styling', source.includes('background:linear-gradient(180deg,#f42b43 0%,#c8102e 58%,#8d071e 100%)'));
check('stale, spoofed and poor Doppler fixes are rejected', source.includes('fixAge>5000') && source.includes('mockLocation===true') && source.includes('poorDoppler') && source.includes('constellationDiversity'));
check('position confidence has four explicit states', core.includes('label:"точная"') && core.includes('label:"расчётная"') && core.includes('label:"восстанавливается"') && core.includes('label:"нужна сверка"'));
check('wrong direction requires repeated heading mismatch', source.includes('directionMismatchCount>=3') && source.includes('Проверь выбранное направление движения'));
check('restriction alerts close automatically without acknowledgement or overspeed speech', !source.includes('Ограничение не подтверждено') && !source.includes('fireOverspeedAlert') && !source.includes('id="alAck"') && source.includes('rt.alertHideTimer=setTimeout'));
check('restrictions are pinned to an explicit physical kilometer axis', source.includes('id="rAxisPick"') && source.includes('function officialToTrackCandidates') && source.includes('trackStartM:resAxisTrackM') && source.includes('startHint=r.trackStartM!=null') && source.includes('Выбери конкретную километровую ось'));
check('restriction trigger distance is audited', source.includes('sap_triggerAudit') && core.includes('triggerAudit'));
check('running time calculator is guarded against impossible plans', source.includes('Перегонное время хода') && source.includes('График недостижим: расчёт') && core.includes('requiredAverageKmh'));
check('official timetable train selector is bundled', source.includes('id="scheduleTrainPick"') && source.includes('function renderTrainSchedule') && schedule.includes('window.PIKET_SCHEDULES=') && (schedule.match(/"number":"\d{3}"/g) || []).length === 66);
check('station time edits and restriction-aware run calculation are implemented', source.includes('sap_schedule_overrides') && source.includes('openScheduleTimePicker') && source.includes('function scheduleRequirement'));
check('single-picket restrictions reserve 100 metres in run calculation', source.includes('r.kmE!=null?metersOf(r.kmE,r.pkE):start+100') && !source.includes('+r.spd>0&&r.kmE!=null'));
check('scheduled run uses departure to next arrival', source.includes('fromTime=x.dep||x.arr,toTime=next.arr||next.dep') && source.includes('средняя по графику'));
check('live timetable pace follows actual position and remaining clock time', source.includes('function updateScheduleLivePace') && source.includes('var distance=Math.abs(to-pos)') && source.includes('scheduleRequirement(pos,to,left)') && source.includes('ориентир по графику'));
check('live timetable updates once per second without rebuilding the cards', source.includes('now-(rt.lastSchedulePaceAt||0)<1000') && source.includes('function setScheduleLiveText') && source.includes('document.visibilityState==="hidden"'));
check('impossible timetable averages use the current route ceiling', source.includes('impossible=!isFinite(req)||req>currentBrowserSpeedCeiling()') && source.includes('график недостижим · расчёт'));
check('selected train persists and reaches the native GPS service', source.includes('sap_schedule_trains') && source.includes('train:selectedTrain||null'));
check('Vyborg cab change remains one through trip', source.includes('VYBORG_THROUGH="СПбФин - Каменногорск"') && source.includes('"СПбФин - Выборг", "Выборг - Каменногорск"], recalibrate: true') && source.includes('Выборг: километровая ось переключена автоматически'));
check('Vyborg timetable joins both kilometer axes', source.includes('function scheduleRowsForContext()') && source.includes('join=128900') && source.includes('scheduleSourceRoute()'));
check('Vyborg uses the documented 128.9 km stopped junction', source.includes('boundaryM:128900,cabChange:true') && source.includes('boundaryM:1000,cabChange:true'));
check('Dacha Dolgorukova to Petrozavodsk remains one through trip', source.includes('DACHA_THROUGH="Дача Долгорукова - Петрозаводск"') && source.includes('isDachaLeg(label)') && source.includes('"Д. Долг - Павлово", "Павлово - Горы II путь", "Горы - Петрозаводск"], recalibrate: true'));
check('Zanevsky Post and Gory marks retain direction-specific flight-map labels', source.includes('"7 км 4 пк → 2 км 3 пк"') && source.includes('"2 км 3 пк → 6 км 4 пк"') && source.includes('"33 км 5 пк → 42 км 8 пк"') && source.includes('"42 км 8 пк → 33 км 5 пк"'));
check('819 and 820 share one Chudovo to Petrozavodsk duty route', source.includes('CHUDOVO_DUTY="Чудово - Петрозаводск"') && source.includes('String(t.number)==="819"||String(t.number)==="820"'));
check('duty route changes technical direction at Volkhov and Novgorod', source.includes('place:"Волховстрой"') && source.includes('trainChange:"819 → 820"') && source.includes('place:"Великий Новгород"'));
check('Volkhov internal junction uses its real 124.4 km boundary', source.includes('boundaryM:124400') && source.includes('Math.abs(curM0-chainNext.boundaryM)<=800'));
check('Chudovo and Novgorod use production junction boundaries', source.includes('place:"Чудово",boundaryM:101000,cabChange:true') && source.includes('place:"Великий Новгород",boundaryM:75175,trainChange'));
check('cab and train changes wait for a stop', source.includes('(chainNext.cabChange||chainNext.trainChange)&&rt.speed>5') && source.includes('Чудово: смена кабины'));

const worker = read('sw.js');
new vm.Script(worker, { filename: 'sw.js' });
check('offline shell includes main page, manifest, route core, timetable and signal animation', worker.includes("'./index.html'") && worker.includes("'./manifest.json'") && /'\.\/assets\/piket-core\.js\?v=[^']+'/.test(worker) && /'\.\/assets\/piket-schedules\.js\?v=[^']+'/.test(worker) && worker.includes("'./icons/piket-signal.gif'"));
check('old PWA caches are removed', worker.includes("key.startsWith('piket-web-')"));

for (const result of checks) console.log(`${result.ok ? 'PASS' : 'FAIL'} ${result.name}`);
console.log(`${checks.filter(result => result.ok).length}/${checks.length} checks passed`);
