/** Пункт 30: колебания, доработки — вторые экраны «Удара и колебаний» и «Колебаний систем»: ответ, правка, отмена, файл, отчёт. */
import type { E2EKit } from '../e2e-kit';
import { sg, solveExtra, type AskDef, type ExtraProblem } from '../../src/shared/extra';
import { OSC_ASKS } from '../../src/modules/oscillation/model/extra';
import { OSC_EXTRA_PRESETS2 } from '../../src/modules/oscillation/extraPresets2';
import { VIB_ASKS } from '../../src/modules/vibration/model/extra';
import { VIB_EXTRA_PRESETS } from '../../src/modules/vibration/extraPresets';

type P = Record<string, { title: string; problem: ExtraProblem; book: Record<string, number> }>;
// вкладка, префикс второго экрана, вопросы, готовые задачи, какие из них открыть
const SECTIONS: [string, string, AskDef[], P, string[]][] = [
  ['oscillation', 'o', OSC_ASKS, OSC_EXTRA_PRESETS2, ['x5345', 'x5348', 'x5350', 'x5353', 'yD25']],
  ['vibration', 'vb', VIB_ASKS, VIB_EXTRA_PRESETS, ['x5410', 'x5411', 'x5423', 'x5424', 'x5425', 'x5426', 'x5441']],
];

export default async function ({ p, check, tab, openText, saveText, report, shot }: E2EKit) {
  for (const [id, x, asks, presets, keys] of SECTIONS) {
    await tab(id);
    await p.click(`#${x}to-extra`);
    check((await p.locator(`#${x}xask`).count()) === 1, `${id}: второй экран открыт`);
    for (const k of keys) {
      const pr = presets[k];
      await p.selectOption(`#${x}preset`, k);
      const out = solveExtra(asks, pr.problem, true);
      const key = Object.keys(pr.book)[0];
      const want = sg(out.vals[key]);
      const txt = await p.innerText(`#${x}xsolution`);
      check(
        out.ok && txt.includes('Ответ') && [want, sg(-out.vals[key]), sg(Math.abs(out.vals[key]))].some((w) => txt.includes(w)) && !txt.includes('NaN'),
        `${pr.title.split(':')[0]}: ${key} = ${want}`,
        txt.slice(-300),
      );
    }
    if (id === 'oscillation') {
      // Д.25: правка параметра пересчитывает решение, отмена возвращает
      await p.selectOption(`#${x}preset`, 'yD25');
      const before = await p.innerText(`#${x}xsolution`);
      await p.locator('#ox-P0').fill('40');
      await p.locator('#ox-P0').blur();
      check((await p.innerText(`#${x}xsolution`)) !== before, 'Д.25: правка силы пересчитывает амплитуду');
      await p.click('.hist button[title^="Отменить"]');
      check((await p.inputValue('#ox-P0')) === '20', 'Д.25: отмена возвращает силу');
    } else {
      // 54.25: формула платформы вместо гармонического закона — решение пересчитывается
      await p.selectOption(`#${x}preset`, 'x5425');
      await p.selectOption(`#${x}xs-kind`, 'formula');
      check((await p.innerText(`#${x}xsolution`)).includes('Движение из состояния покоя'), '54.25: режим «любой ξ(t)» — интегрирование из покоя');
    }
    const sol = await p.innerText(`#${x}xsolution`);
    const text = await saveText();
    const j = JSON.parse(text);
    check(j.module === id && j.view === 'extra' && j.extra?.ask, `${id}: файл хранит второй экран`);
    await p.click(`#${x}to-main`);
    check((await p.locator(`#${x}to-extra`).count()) === 1, `${id}: возврат к основному экрану`);
    await tab('frames');
    await openText(`${id}-30.json`, text, 'ok');
    check(
      (await p.getAttribute(`[data-tab="${id}"]`, 'aria-selected')) === 'true' && (await p.innerText(`#${x}xsolution`)) === sol,
      `${id}: файл второго экрана открывается без потерь`,
    );
    if (id === 'oscillation') {
      const rep = await report();
      check(rep.text.includes('Ответ') && rep.text.includes('Д.25'), 'отчёт по Д.25', rep.text.slice(0, 200));
      await shot('item30-d25.png');
    }
  }
}
