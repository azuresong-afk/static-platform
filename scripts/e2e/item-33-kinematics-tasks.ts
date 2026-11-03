/** Пункт 33 (кинематика, готовые задачи): новые задачи Мещерского §10–24 открываются и дают ответ книги. */
import type { E2EKit } from '../e2e-kit';

export default async function ({ p, check, tab }: E2EKit) {
  const clean = (s: string) => !/NaN|undefined|Infinity|\[object/.test(s);

  // Кинематика точки: 11.5 и 23.33 (числа ответа — в тексте решения).
  await tab('pointkin');
  for (const k of ['k115', 'k1010', 'k2333']) {
    await p.selectOption('#kpreset', k);
    const s = await p.innerText('#ksolution');
    check(s.length > 80 && clean(s), `Кинематика точки: готовая задача ${k} решается`, s.slice(0, 120));
  }

  // Зубчатые передачи и редукторы: ответы книги 24.7 (3000 об/мин), 24.10 (280 с⁻¹), 24.6 (1000 и 1800 об/мин).
  await tab('mechanism');
  for (const [k, ans] of [
    ['m247', '3000'],
    ['m2410', '280'],
    ['m246', '1000'],
    ['m2412', '375'],
    ['m1635a', ''],
  ] as const) {
    await p.selectOption('#mpreset', k);
    const s = await p.innerText('#msolution');
    check(s.length > 80 && clean(s) && s.includes(ans), `Плоский механизм: ${k} решается${ans ? `, в решении ${ans}` : ''}`, s.slice(0, 160));
  }

  // Зубчатые колёса §13/§16.
  await tab('gears');
  for (const k of ['g131a', 'g1631']) {
    await p.selectOption('#gpreset', k);
    const s = await p.innerText('#gsolution');
    check(s.length > 60 && clean(s), `Передачи: готовая задача ${k} решается`, s.slice(0, 120));
  }

  // Сложное движение §22–23: центробежный регулятор (293,7), Земля (23.62–23.66).
  await tab('relative');
  for (const k of ['r2358', 'r2359', 'r2361', 'e2362', 'e2366']) {
    await p.selectOption('#rpreset', k);
    const s = await p.innerText('#rsolution');
    check(s.length > 80 && clean(s), `Сложное движение: готовая задача ${k} решается`, s.slice(0, 120));
  }
}
