/** Пункт 29: замкнутые рамы и фермы («Возможные перемещения»), §38 и Д.18 («Кинетическая энергия»), параметр по положению равновесия («Уравнения Лагранжа»). */
import type { E2EKit } from '../e2e-kit';
import { sg, solveExtra } from '../../src/shared/extra';
import { fmt } from '../../src/shared/format';
import { ENERGY_ASKS } from '../../src/modules/energy/model/extra';
import { ENERGY_EXTRA_PRESETS } from '../../src/modules/energy/extraPresets';
import { LAGRANGE_PRESETS } from '../../src/modules/lagrange/presets';
import { findEquilibria, type EquilResult } from '../../src/modules/lagrange/model/equil';
import { findInverse } from '../../src/modules/lagrange/model/inverse';

export default async function ({ p, check, tab, openText, saveText, shot }: E2EKit) {
  // «Возможные перемещения», режим «Машины»: 46.24 и 46.28.
  await tab('virtual');
  await p.click('#mc-mode-machines');
  await p.selectOption('#mcpreset', 'm4624');
  let t = await p.innerText('#mcsolution');
  check(t.includes('16,97') && t.includes('совпадает с ответом книги') && !t.includes('NaN'), 'Мещерский 46.24: S = 12√2·P₁', t.slice(-300));
  await p.fill('#mc-P2', '5');
  await p.press('#mc-P2', 'Tab');
  t = await p.innerText('#mcsolution');
  check(t.includes('16,97'), '46.24: от P₂ усилие не зависит');
  await p.click('.hist button[title^="Отменить"]');
  check((await p.inputValue('#mc-P2')) === '1', '46.24: отмена возвращает P₂');
  await p.selectOption('#mcpreset', 'm4628');
  t = await p.innerText('#mcsolution');
  check(
    t.includes('C₁ = (0; 3)') && t.includes('совпадает с ответом книги') && !t.includes('NaN'),
    'Мещерский 46.28: мгновенные центры ферм и R_B',
    t.slice(-300),
  );
  check((await p.locator('#mcsvg line').count()) > 8, '46.28: чертёж ферм');
  await shot('item29-trusses.png');
  const vwText = await saveText();
  check(JSON.parse(vwText).machine?.id === 'trusses', 'файл режима «Машины» хранит фермы');
  await p.click('#mc-mode-base');

  // «Кинетическая энергия», второй экран.
  await tab('energy');
  await p.click('#eto-extra');
  for (const k of ['x3808', 'x3827', 'x3828', 'yd18'] as const) {
    const pr = ENERGY_EXTRA_PRESETS[k];
    await p.selectOption('#epreset', k);
    const out = solveExtra(ENERGY_ASKS, pr.problem, true);
    const key = Object.keys(pr.book).includes('w') ? 'w' : Object.keys(pr.book)[0] === 'T' ? 'T' : 'vs';
    const txt = await p.innerText('#exsolution');
    check(
      out.ok && txt.includes('Ответ') && txt.includes(sg(out.vals[key])) && !txt.includes('NaN'),
      `${pr.title.split(':')[0]}: ${key} = ${sg(out.vals[key])}`,
      txt.slice(-300),
    );
  }
  const yd = await p.innerText('#exsolution');
  check(yd.includes('τ = 0,01') && yd.includes('l = 37,9'), 'Д.18: время трогания и тормозной путь механическим тормозом');
  const eText = await saveText();
  await tab('frames');
  await openText('energy-29.json', eText, 'ok');
  check(
    (await p.getAttribute('[data-tab="energy"]', 'aria-selected')) === 'true' && (await p.innerText('#exsolution')) === yd,
    'Д.18: файл второго экрана открывается без потерь',
  );
  await p.click('#eto-main');

  // «Уравнения Лагранжа»: параметр по положению равновесия.
  await tab('lagrange');
  const want = (k: 'm4717' | 'm4718' | 'm4719') => {
    const pr = LAGRANGE_PRESETS[k].problem;
    const iv = findInverse(pr, findEquilibria(pr) as EquilResult)!;
    return iv.ok ? fmt(iv.roots[0].p, 4) : 'нет';
  };
  await p.selectOption('#lgpreset', 'm4717');
  let lg = await p.innerText('#lgsolution');
  check(
    lg.includes('Параметр по положению равновесия') && lg.includes(`ω = ${want('m4717')}`) && !lg.includes('NaN'),
    `Мещерский 47.17: ω = ${want('m4717')}`,
    lg.slice(-400),
  );
  await p.selectOption('#lgpreset', 'm4718');
  lg = await p.innerText('#lgsolution');
  check(
    lg.includes(`n = ${want('m4718')}`) && Math.abs(parseFloat(want('m4718').replace(',', '.')) - 188) < 0.5,
    'Мещерский 47.18: n ≈ 188 об/мин',
    lg.slice(-300),
  );
  await p.selectOption('#lgpreset', 'm4719');
  lg = await p.innerText('#lgsolution');
  check(
    lg.includes(`ω = ${want('m4719')}`) && lg.includes('при любом положении'),
    'Мещерский 47.19: ω не зависит от угла — равновесие безразличное',
    lg.slice(-300),
  );
  await p.click('#lginv');
  check(!(await p.innerText('#lgsolution')).includes('Параметр по положению равновесия'), 'обратная задача выключается');
  await p.click('.hist button[title^="Отменить"]');
  check((await p.isChecked('#lginv')) && (await p.innerText('#lgsolution')).includes('Параметр по положению равновесия'), 'отмена возвращает обратную задачу');
  await p.selectOption('#lgpreset', 'm4713');
  lg = await p.innerText('#lgsolution');
  check(lg.includes('Ответ') && !lg.includes('NaN'), 'Мещерский 47.13: стержень на трёх катках', lg.slice(-200));
}
