import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../assets/piket-core.js',import.meta.url),'utf8');
const box={}; vm.createContext(box); vm.runInContext(source,box);
const r=box.PIKET_RELIABILITY;
let passed=0;
function check(name,ok){if(!ok)throw new Error(`FAIL ${name}`);console.log(`PASS ${name}`);passed++;}

check('точный свежий фикс',r.confidence({fixQuality:'good',fixAgeMs:900,accuracy:12}).key==='exact');
check('позиция по счёту',r.confidence({fixQuality:'deadreckoning'}).key==='calculated');
check('восстановление после РЭБ',r.confidence({recovering:true}).key==='recovering');
check('ручная сверка имеет высший приоритет',r.confidence({manualReview:true,recovering:true}).key==='review');
check('средняя скорость 120 км за час',Math.abs(r.requiredAverageKmh(120000,3600)-120)<0.001);
check('просроченное время не рассчитывается',r.requiredAverageKmh(1000,0)===null);
check('ошибка направления туда',r.directionMismatch(1000,700,'tuda',120)===true);
check('правильное обратное направление',r.directionMismatch(1000,700,'obratno',120)===false);
check('малая контрольная поправка применяется сразу',r.checkpointCorrection(40,1).confirmed===true);
check('крупная поправка ждёт подтверждений',r.checkpointCorrection(600,3).confirmed===false&&r.checkpointCorrection(600,4).confirmed===true);
check('срабатывание в пределах 250 м принято',r.triggerAudit(2000,1810).ok===true);
check('раннее или позднее срабатывание обнаружено',r.triggerAudit(2000,1600).ok===false);
check('дача — Петрозаводск ограничена 120 км/ч',r.browserSpeedCeiling('Д. Долг - Павлово')===120&&r.browserSpeedCeiling('Горы - Петрозаводск')===120);
check('Чудово — Петрозаводск ограничено 120 км/ч',r.browserSpeedCeiling('Чудово - Новгород')===120&&r.browserSpeedCeiling('Волховстрой - Чудово')===120);
check('Балтийский — Луга ограничено 140 км/ч',r.browserSpeedCeiling('Броневая - Луга')===140);
check('Финляндский — Каменногорск ограничено 160 км/ч',r.browserSpeedCeiling('СПбФин - Выборг')===160&&r.browserSpeedCeiling('Выборг - Каменногорск')===160);
check('Москва без выбранного номера допускает автоопределение до 250',r.browserSpeedCeiling('СпбГл - Москва')===250&&r.browserTrustedSpeedCeiling('СпбГл - Москва')===160);
check('обычные поезда Москва — Петербург ограничены 160 км/ч',['723','724','801','802','841','842'].every(n=>r.browserSpeedCeiling('СпбГл - Москва',n)===160));
check('Сапсан 751–786 допускает 250 км/ч',r.browserSpeedCeiling('СпбГл - Москва','751')===250&&r.browserSpeedCeiling('СпбГл - Москва','786')===250);
check('чужой или испорченный номер не включает 250 км/ч',r.browserSpeedCeiling('СпбГл - Москва','787')===160&&r.browserSpeedCeiling('СпбГл - Москва','751x')===160);
const autoFirst=r.confirmAutomaticHighSpeed(null,0,200,200,true),autoSecond=r.confirmAutomaticHighSpeed(autoFirst.candidate,autoFirst.count,205,205,true);
check('автоматические 250 требуют два координатных подтверждения',!autoFirst.confirmed&&autoSecond.confirmed&&!r.confirmAutomaticHighSpeed(null,0,250,250,false).confirmed);
check('счёт по ложной скорости прекращается при долгой потере GPS',r.lossSpeed(250,1,120,false,0)===0&&r.lossSpeed(160,30,30,false,0)<110);
console.log(`${passed} reliability scenarios passed`);
