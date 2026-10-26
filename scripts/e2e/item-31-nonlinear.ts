/** Пункт 31: второй экран «Устойчивости и нелинейных колебаний», своё движение в «Центроидах», примеры Яблонского. */
import type { E2EKit } from '../e2e-kit';
import { solveExtra } from '../../src/shared/extra';
import { HAM_ASKS } from '../../src/modules/hamilton/model/extra';
import { HAM_EXTRA_PRESETS } from '../../src/modules/hamilton/extraPresets';

/** В тексте есть число, близкое к v (относительно rel). */
const has = (txt: string, v: number, rel = 1e-3) =>
  (txt.replace(/−/g, '-').match(/-?\d+(?:,\d+)?(?:e-?\d+)?/g) ?? []).some((m) => {
    const x = Number(m.replace(',', '.'));
    return Math.abs(Math.abs(x) - Math.abs(v)) <= rel * Math.max(Math.abs(v), 1e-9);
  });

export default async function ({ p, check, tab, openText, saveText, report, shot }: E2EKit) {
  // «Устойчивость и нелинейные колебания»: второй экран, все готовые задачи.
  await tab('hamilton');
  await p.click('#hmto-extra');
  check((await p.locator('#hmxask').count()) === 1, 'hamilton: второй экран открыт');
  for (const [k, pr] of Object.entries(HAM_EXTRA_PRESETS)) {
    await p.selectOption('#hmpreset', k);
    const out = solveExtra(HAM_ASKS, pr.problem, true);
    const key = Object.keys(pr.book)[0];
    const txt = await p.innerText('#hmxsolution');
    check(
      out.ok && txt.includes('Ответ') && has(txt, out.vals[key]) && !txt.includes('NaN'),
      `${pr.title.split(':')[0]}: ${key} = ${out.vals[key]}`,
      txt.slice(-300),
    );
  }
  await p.selectOption('#hmpreset', 'x568');
  check((await p.locator('#hmxsvg').count()) === 1, 'Мещерский 56.8: график движения');
  await p.locator('#hmx-H1').fill('2');
  await p.locator('#hmx-H1').blur();
  check((await p.innerText('#hmxsolution')).includes('H₁'), 'правка трения покоя пересчитывает задачу');
  await p.click('.hist button[title^="Отменить"]');
  check((await p.inputValue('#hmx-H1')) === '1.5' || (await p.inputValue('#hmx-H1')) === '1,5', 'отмена возвращает H₁');
  const sol = await p.innerText('#hmxsolution');
  const text = await saveText();
  const j = JSON.parse(text);
  check(j.module === 'hamilton' && j.view === 'extra' && j.extra?.ask === 'stops', 'hamilton: файл хранит второй экран');
  await p.click('#hmto-main');
  check((await p.locator('#hmto-extra').count()) === 1, 'hamilton: возврат к основному экрану');
  await tab('frames');
  await openText('hamilton-31.json', text, 'ok');
  check(
    (await p.getAttribute('[data-tab="hamilton"]', 'aria-selected')) === 'true' && (await p.innerText('#hmxsolution')) === sol,
    'hamilton: файл второго экрана открывается без потерь',
  );
  const rep = await report();
  check(rep.text.includes('Ответ'), 'отчёт по второму экрану «Устойчивости»', rep.text.slice(0, 200));
  await shot('item31-hamilton.png');
  await p.click('#hmto-main');

  // «Центроиды»: своё движение.
  await tab('centrodes');
  await p.selectOption('#cpreset', 'own');
  let ceS = await p.innerText('#csolution');
  check(ceS.includes('Проверяемое уравнение') && !ceS.includes('NaN'), 'Центроиды: своё движение (колесо) с проверяемыми уравнениями', ceS.slice(0, 300));
  check((await p.locator('#csvg .ce-fixed').count()) >= 1 && (await p.locator('#csvg2 .ce-moving').count()) >= 1, 'своё движение: обе центроиды на чертежах');
  await p.locator('#co-eqf').fill('y − 2');
  await p.locator('#co-eqf').blur();
  ceS = await p.innerText('#csolution');
  check(ceS.includes('y − 2'), 'правка проверяемого уравнения', ceS.slice(0, 300));
  await p.click('.hist button[title^="Отменить"]');
  check((await p.inputValue('#co-eqf')) === 'y', 'отмена возвращает уравнение');
  const ceText = await saveText();
  check(JSON.parse(ceText).preset === 'own' && JSON.parse(ceText).own?.theta === '−t', 'файл хранит своё движение');
  const ceSol = await p.innerText('#csolution');
  await tab('frames');
  await openText('centrodes-own.json', ceText, 'ok');
  check(
    (await p.getAttribute('[data-tab="centrodes"]', 'aria-selected')) === 'true' && (await p.innerText('#csolution')) === ceSol,
    'файл своего движения открывается без потерь',
  );
  await shot('item31-centrodes.png');

  // «Кинематика точки»: §12.
  await tab('pointkin');
  for (const k of ['k1212', 'k1217', 'k1233', 's1224']) {
    await p.selectOption('#kpreset', k);
    const t = await p.innerText('#ksolution');
    check(t.length > 100 && !t.includes('NaN'), `Кинематика точки: ${k}`, t.slice(0, 200));
  }

  // «Тело с неподвижной точкой»: примеры Яблонского К.5, К.6, К.8.
  await tab('fixedpoint');
  for (const [k, want] of [
    ['yK5', 30.3],
    ['yK6', 2.32],
    ['yK8a', 128],
    ['yK8b', 132.7],
  ] as const) {
    await p.selectOption('#fppreset', k);
    const t = await p.innerText('#fpsolution');
    check(has(t, want, 0.005) && !t.includes('NaN'), `Тело с неподвижной точкой: ${k} — ${want}`, t.slice(0, 300));
  }

  // «Плоский механизм»: пример К.9 — камень B на звене CA (точка «на прямой» с углом от направления на A).
  await tab('mechanism');
  await p.selectOption('#mpreset', 'mK9a');
  const mt = await p.innerText('#msolution');
  check(mt.includes('DB') && !mt.includes('NaN'), 'Плоский механизм: К.9, пример книги', mt.slice(0, 300));
  check((await p.locator('#m-points-4-def-lto').inputValue()) === 'A', 'точка B: угол прямой от направления на A');
}
