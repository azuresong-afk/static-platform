/** Пункт 34: готовые задачи §46–49, 52, 54–56 — открываются из списка, решение без NaN, файл проекта, отчёт. */
import type { E2EKit } from '../e2e-kit';
import { LAG_PRESETS_34 } from '../../src/modules/lagrange/presets34';

const bad = (t: string) => t.includes('NaN') || t.includes('Infinity') || t.trim().length < 100;

export default async function ({ p, check, tab, openText, saveText, report, shot }: E2EKit) {
  // «Уравнения Лагранжа»: все 83 задачи пункта.
  await tab('lagrange');
  let fails: string[] = [];
  for (const [k, pr] of Object.entries(LAG_PRESETS_34)) {
    await p.selectOption('#lgpreset', k);
    const t = await p.innerText('#lgsolution');
    if (bad(t)) fails.push(pr.title.split(':')[0]);
  }
  check(fails.length === 0, `«Уравнения Лагранжа»: ${Object.keys(LAG_PRESETS_34).length} задач пункта 34 решаются`, fails.join(', '));
  await p.selectOption('#lgpreset', 'm5211');
  const lg = await p.innerText('#lgsolution');
  check(lg.includes('неустойчив'), 'Мещерский 52.11: среди положений есть неустойчивое', lg.slice(-300));
  await shot('item34-lagrange.png');
  const lgText = await saveText();
  await tab('frames');
  await openText('lagrange-34.json', lgText, 'ok');
  check(
    (await p.getAttribute('[data-tab="lagrange"]', 'aria-selected')) === 'true' && (await p.innerText('#lgsolution')) === lg,
    '52.11: файл проекта открывается без потерь',
  );

  // «Колебания систем»: 7 задач §54.
  await tab('vibration');
  fails = [];
  for (const k of ['m546', 'm547', 'm5412', 'm5419', 'm5421', 'm5422', 'm5439']) {
    await p.selectOption('#vbpreset', k);
    if (bad(await p.innerText('#vbsolution'))) fails.push(k);
  }
  check(fails.length === 0, '«Колебания систем»: 54.6, 54.7, 54.12, 54.19, 54.21, 54.22, 54.39', fails.join(', '));

  // «Устойчивость и нелинейные колебания»: главный экран и 52.6, 52.9 на втором.
  await tab('hamilton');
  fails = [];
  for (const k of ['m493', 'm495', 'm498', 'm4911', 'm5511', 'm4850', 'm561', 'm562', 'm5612']) {
    await p.selectOption('#hmpreset', k);
    if (bad(await p.innerText('#hmsolution'))) fails.push(k);
  }
  check(fails.length === 0, '«Устойчивость»: 49.3, 49.5, 49.8, 49.11, 55.11, 48.50, 56.1, 56.2, 56.12', fails.join(', '));
  await p.click('#hmto-extra');
  for (const k of ['x526', 'x529']) {
    await p.selectOption('#hmpreset', k);
    const t = await p.innerText('#hmxsolution');
    check(t.includes('Ответ') && !bad(t), `второй экран: ${k}`, t.slice(-300));
  }

  // «Возможные перемещения»: 46.23.
  await tab('virtual');
  await p.selectOption('#vwpreset', 'm4623');
  const vw = await p.innerText('#vwsolution');
  check(vw.includes('21') && !bad(vw), 'Мещерский 46.23: момент в заделке 21 тм', vw.slice(-300));
  const r = await report();
  check(r.text.includes('46.23') && r.svgs > 0, '46.23: отчёт для печати с чертежом');
}
