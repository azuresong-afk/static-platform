/** Пункт 28: вторые экраны разделов динамики — готовые задачи, ответ книги, возврат, файл проекта, отчёт. */
import type { E2EKit } from '../e2e-kit';
import { sg, solveExtra, type AskDef, type ExtraProblem } from '../../src/shared/extra';
import { POINT_EXTRA_ASKS } from '../../src/modules/pointdyn/model/extra';
import { POINT_EXTRA_PRESETS } from '../../src/modules/pointdyn/extraPresets';
import { OSC_ASKS } from '../../src/modules/oscillation/model/extra';
import { OSC_EXTRA_PRESETS } from '../../src/modules/oscillation/extraPresets';
import { ROT_ASKS } from '../../src/modules/rotation/model/extra';
import { ROT_EXTRA_PRESETS } from '../../src/modules/rotation/extraPresets';
import { BODY_ASKS } from '../../src/modules/planebody/model/extra';
import { BODY_EXTRA_PRESETS } from '../../src/modules/planebody/extraPresets';
import { IMPACT_ASKS } from '../../src/modules/impact/model/extra';
import { IMP_EXTRA_PRESETS } from '../../src/modules/impact/extraPresets';
import { ORBIT_ASKS } from '../../src/modules/orbit/model/extra';
import { ORB_EXTRA_PRESETS } from '../../src/modules/orbit/extraPresets';
import { SHAFT_ASKS } from '../../src/modules/dalembert/model/extra';
import { SHAFT_EXTRA_PRESETS } from '../../src/modules/dalembert/extraPresets';
import { INERTIA_ASKS } from '../../src/modules/inertia/model/extra';
import { INERTIA_EXTRA_PRESETS } from '../../src/modules/inertia/extraPresets';
import { MC_ASKS } from '../../src/modules/masscenter/model/extra';
import { MC_EXTRA_PRESETS } from '../../src/modules/masscenter/extraPresets';

type P = Record<string, { title: string; problem: ExtraProblem; book: Record<string, number> }>;
// вкладка, префикс второго экрана, вопросы, готовые задачи, какие из них открыть
const SECTIONS: [string, string, AskDef[], P, string[]][] = [
  ['pointdyn', 'p', POINT_EXTRA_ASKS, POINT_EXTRA_PRESETS, ['x2625', 'x3114', 'yd1', 'yd5', 'yd6']],
  ['oscillation', 'o', OSC_ASKS, OSC_EXTRA_PRESETS, ['x3210', 'x3223', 'x3923']],
  ['rotation', 'r', ROT_ASKS, ROT_EXTRA_PRESETS, ['x3737', 'x3749', 'yd9', 'yd11']],
  ['planebody', 'b', BODY_ASKS, BODY_EXTRA_PRESETS, ['x3701', 'x3901', 'x4309']],
  ['impact', 'im', IMPACT_ASKS, IMP_EXTRA_PRESETS, ['x4409', 'x4415', 'yd13b']],
  ['orbit', 'ob', ORBIT_ASKS, ORB_EXTRA_PRESETS, ['x5007', 'x5029', 'x2810']],
  ['dalembert', 'd', SHAFT_ASKS, SHAFT_EXTRA_PRESETS, ['x4212', 'x4213']],
  ['inertia', 'in', INERTIA_ASKS, INERTIA_EXTRA_PRESETS, ['x3433']],
  ['masscenter', 'mc', MC_ASKS, MC_EXTRA_PRESETS, ['x2901', 'x3516', 'yd7', 'yd8a', 'yd12']],
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
    if (id === 'masscenter') {
      // своя задача: правка поля, отмена
      await p.selectOption(`#${x}preset`, 'x2901');
      await p.locator('#mcx-P').fill('8000');
      await p.locator('#mcx-P').blur();
      check((await p.innerText('#mcxsolution')).includes('8000'), 'Центр масс: правка веса пересчитывает работу');
      await p.click('.hist button[title^="Отменить"]');
      check((await p.inputValue('#mcx-P')) === '4000', 'отмена возвращает вес');
    }
    const sol = await p.innerText(`#${x}xsolution`);
    const text = await saveText();
    const j = JSON.parse(text);
    check(j.module === id && j.view === 'extra' && j.extra?.ask, `${id}: файл хранит второй экран`);
    await p.click(`#${x}to-main`);
    check((await p.locator(`#${x}to-extra`).count()) === 1, `${id}: возврат к основному экрану`);
    await tab('frames');
    await openText(`${id}-28.json`, text, 'ok');
    check(
      (await p.getAttribute(`[data-tab="${id}"]`, 'aria-selected')) === 'true' && (await p.innerText(`#${x}xsolution`)) === sol,
      `${id}: файл второго экрана открывается без потерь`,
    );
    if (id === 'masscenter') {
      const rep = await report();
      check(rep.text.includes('Ответ') || rep.text.includes('Работа'), 'отчёт по второму экрану «Центра масс»', rep.text.slice(0, 200));
      await shot('item28-masscenter.png');
    }
    await p.click(`#${x}to-main`);
  }
}
