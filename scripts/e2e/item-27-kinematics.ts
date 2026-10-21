/** Пункт 27 (кинематика, доработки): новые режимы и задачи в «Кинематике точки», «Плоском механизме», «Сложном движении», «Неподвижной точке». */
import type { E2EKit } from '../e2e-kit';

export default async function ({ p, check, tab, openText, saveText, report }: E2EKit) {
  const clean = (s: string) => !/NaN|undefined|Infinity|\[object/.test(s);

  // Кинематика точки: составная задача и пересчёт координат.
  await tab('pointkin');
  for (const k of ['k123', 'k1019', 'k1236', 'p103c']) {
    await p.selectOption('#kpreset', k);
    const s = await p.innerText('#ksolution');
    check(s.length > 80 && clean(s), `Кинематика точки: готовая задача ${k} решается`, s.slice(0, 120));
  }

  // Плоский механизм: «Триплекс», эпицикл, манипулятор, ω и ε по ускорениям двух точек.
  await tab('mechanism');
  for (const k of ['m2413', 'm2417', 'mK9', 'm1829', 'm1411']) {
    await p.selectOption('#mpreset', k);
    const s = await p.innerText('#msolution');
    check(s.length > 80 && clean(s), `Плоский механизм: готовая задача ${k} решается`, s.slice(0, 120));
  }

  // Сложное движение: условия и уравнения.
  await tab('relative');
  for (const k of ['c221', 'c2210', 'c216', 'c2112', 'e2114']) {
    await p.selectOption('#rpreset', k);
    const s = await p.innerText('#rsolution');
    check(s.length > 80 && clean(s), `Сложное движение: готовая задача ${k} решается`, s.slice(0, 120));
  }

  // Неподвижная точка: режим «по формулам» — задача, правка поля, отмена, файл.
  await tab('fixedpoint');
  await p.selectOption('#fppreset', 'm1913');
  let fs = await p.innerText('#fpsolution');
  check(fs.includes('x + 2y = 0') && fs.includes('3x + z = 0'), 'Мещерский 19.13: мгновенная ось x + 2y = 0, 3x + z = 0', fs.slice(0, 200));
  check((await p.inputValue('#fpmode')) === 'calc', 'режим «по формулам» выбран задачей');
  await p.selectOption('#fppreset', 'm2524');
  fs = await p.innerText('#fpsolution');
  check(fs.includes('2') && fs.includes('0,5') && clean(fs), 'Мещерский 25.24: ω₁/ω₂ = 2 и 0,5', fs.slice(0, 200));
  await p.selectOption('#fppreset', 'm2013');
  const before = await p.innerText('#fpsolution');
  await p.locator('#fp-c-alpha').fill('45');
  await p.locator('#fp-c-alpha').blur();
  const after = await p.innerText('#fpsolution');
  check(after !== before && clean(after), 'правка угла α пересчитывает решение');
  await p.click('.hist button[title^="Отменить"]');
  check((await p.inputValue('#fp-c-alpha')) === '30', 'отмена возвращает угол α');
  await p.selectOption('#fpckind', 'cardan');
  check((await p.innerText('#fpsolution')).includes('Кардана'), 'вид задачи переключается');
  const text = await saveText();
  check(JSON.parse(text).module === 'fixedpoint' && JSON.parse(text).problem.mode === 'calc', 'файл режима «по формулам»');
  const sol = await p.innerText('#fpsolution');
  await tab('mechanism');
  await openText('fixedpoint-calc.json', text, 'ok');
  check(
    (await p.getAttribute('[data-tab="fixedpoint"]', 'aria-selected')) === 'true' && (await p.innerText('#fpsolution')) === sol,
    'файл открывается в своей вкладке без потерь',
  );
  const rep = await report();
  check(rep.svgs >= 1 && rep.text.includes('Решение'), 'отчёт по режиму «по формулам»');
}
