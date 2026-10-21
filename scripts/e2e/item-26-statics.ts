/** Пункт 26: «Сходящиеся силы» — системы тел, трение, механизмы; «Центр тяжести» — поверхности и обратные задачи; 5.14. */
import type { E2EKit } from '../e2e-kit';

export default async function ({ p, check, tab, openText, saveText, report, shot }: E2EKit) {
  // «Сходящиеся силы»: экран задач пункта 26.
  await tab('converging');
  await p.click('#vto-extra');
  check(
    (await p.locator('#vxask').count()) === 1 && (await p.locator('.wrap h1').first().innerText()).includes('системы тел'),
    'кнопка открывает экран «Системы тел, трение, механизмы»',
  );
  await p.selectOption('#vpreset', 'x238');
  let sol = await p.innerText('#vxsolution');
  check(sol.includes('R = 163,') && sol.includes('шарнир A: ΣX'), 'Мещерский 2.38: уравновешивающая сила R ≈ 163 и уравнения шарниров', sol.slice(-300));
  check((await p.locator('#vxsvg path').count()) >= 3, 'схема системы на чертеже');
  await p.locator('#vx-loads').fill('A Q 100 -15; B R 50 240');
  await p.locator('#vx-loads').blur();
  check((await p.innerText('#vxsolution')).includes('равновесие невозможно'), 'без неизвестной силы механизм не в равновесии — так и сказано');
  await p.click('.hist button[title^="Отменить"]');
  check((await p.inputValue('#vx-loads')).includes('R ? 240'), 'отмена возвращает силы');
  await p.selectOption('#vpreset', 'x448');
  check((await p.innerText('#vxsolution')).includes('S_AB = 6'), 'Мещерский 4.48: стержень GH растянут силой 6 т');
  await p.selectOption('#vpreset', 'x262');
  sol = await p.innerText('#vxsolution');
  check(sol.includes('Этап 2') && sol.includes('P = 2'), 'Мещерский 2.62: клин в два этапа', sol.slice(-200));
  await p.selectOption('#vxask', 'bifilar');
  check((await p.innerText('#vxsolution')).includes('Pr²sin α/h'), 'вопрос «бифиляр» выбирается в списке');
  const cvText = await saveText();
  const cv = JSON.parse(cvText);
  check(cv.module === 'converging' && cv.view === 'extra' && cv.extra.ask === 'bifilar', 'файл сохраняет экран и вопрос');
  const cvSol = await p.innerText('#vxsolution');
  await tab('frames');
  await openText('statics2.json', cvText, 'ok');
  check(
    (await p.getAttribute('[data-tab="converging"]', 'aria-selected')) === 'true' && (await p.innerText('#vxsolution')) === cvSol,
    'файл открывается на экране задач без потерь',
  );
  const rep = await report();
  check(rep.svgs >= 1 && rep.text.includes('Геометрия закрутки'), 'отчёт по задаче экрана');
  await p.click('#vto-main');
  check((await p.locator('#vmode').count()) === 1, 'кнопка возвращает к узлу и приведению системы сил');

  // «Центр тяжести»: поверхности в пространстве и обратные задачи.
  await tab('centroid');
  await p.selectOption('#gpreset', 'm928');
  sol = await p.innerText('#gsolution');
  check(
    (await p.inputValue('#gmode')) === 'surface' && sol.includes('3,333') && sol.includes('0,444') && sol.includes('3,556'),
    'Мещерский 9.28: согнутый лист — центр тяжести поверхности',
    sol.slice(-200),
  );
  await p.selectOption('#gpreset', 'm924');
  check((await p.innerText('#gsolution')).includes('0,507'), 'Мещерский 9.24: корпус мины — сферические пояса');
  await p.click('#gto-extra');
  await p.selectOption('#gpreset', 'x913');
  check((await p.innerText('#gxsolution')).includes('0,366'), 'Мещерский 9.13: BE = 0,366a');
  const gText = await saveText();
  await tab('frames');
  await openText('centroid2.json', gText, 'ok');
  check(
    (await p.getAttribute('[data-tab="centroid"]', 'aria-selected')) === 'true' && (await p.locator('#gxsolution').count()) === 1,
    'файл обратной задачи открывается на её экране',
  );
  await p.click('#gto-main');
  check((await p.locator('#gmode').count()) === 1, 'возврат к частям');

  // «Графическая статика»: 5.14 — силовые многоугольники узлов.
  await tab('graphstat');
  await p.selectOption('#gpreset', 'm514');
  sol = await p.innerText('#gsolution');
  check(sol.includes('Силовые многоугольники узлов') && sol.includes('книга'), 'Мещерский 5.14: усилия по силовым многоугольникам узлов', sol.slice(-200));
  check((await p.locator('#gsvg2 .gs-nw').count()) >= 5, 'многоугольники узлов на втором чертеже');
  await shot('statics2.png');
}
