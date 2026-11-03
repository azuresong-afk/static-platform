/** Пункт 32: готовые задачи статики §1–9 — открываются из «Задачника» и из списков разделов, ответы как в книге. */
import type { E2EKit } from '../e2e-kit';

export default async function ({ p, check, tab, shot }: E2EKit) {
  const has = (s: string, ...parts: string[]) => parts.every((x) => s.includes(x)) && !s.includes('NaN');

  // «Задачник» → «Балки и рамы»: задача контакта тел и задача поиска размера.
  await tab('tasks');
  await p.fill('#tksearch', '3.24');
  check((await p.locator('[data-task="frames:tb:3.24"]').count()) === 1, '«Задачник» находит Мещерского 3.24');
  await p.click('[data-task="frames:tb:3.24"]');
  check(
    (await p.getAttribute('[data-tab="frames"]', 'aria-selected')) === 'true' &&
      (await p.inputValue('#preset')) === 'tb:3.24' &&
      (await p.textContent('.notice'))!.includes('Ответ задачника'),
    'Мещерский 3.24 открывается в «Балках и рамах» с ответом задачника',
  );
  await tab('tasks');
  await p.fill('#tksearch', '4.67');
  await p.click('[data-task="frames:tb:4.67"]');
  check(
    (await p.inputValue('#preset')) === 'tb:4.67' && !(await p.innerText('#solution')).includes('NaN'),
    'Мещерский 4.67: задача поиска открывается и решается',
  );

  // «Сходящиеся силы»: пространственный узел и приведение к динаме.
  await tab('converging');
  await p.selectOption('#vpreset', 'm612');
  let sol = await p.innerText('#vsolution');
  check(has(sol, '0,732', '2,732'), 'Мещерский 6.12: оттяжки 2T(sin φ ∓ cos φ) при φ = 60°', sol.slice(-300));
  await p.selectOption('#vpreset', 'm710');
  sol = await p.innerText('#vsolution');
  check(has(sol, '5,385', '47,5'), 'Мещерский 7.10: V = 5,4 н, M* = 47,5', sol.slice(-300));

  // «Пространственное тело»: неизвестный момент пары и условие T + t = 750.
  await tab('spacebody');
  await p.selectOption('#bpreset', 'm812');
  sol = await p.innerText('#bsolution');
  check(has(sol, '50', '−18'), 'Мещерский 8.12: M = 50, X_A = −18', sol.slice(-300));
  await p.selectOption('#bpreset', 'm838');
  sol = await p.innerText('#bsolution');
  check(has(sol, '492', '−447'), 'Мещерский 8.38: T = 492 кГ, Z_A = −447 кГ', sol.slice(-300));

  // «Фермы»: 5.6 — расхождение со стержнем 7.
  await tab('truss');
  await p.selectOption('#tpreset', 'm56');
  sol = await p.innerText('#tsolution');
  check(has(sol, '0,81'), 'Мещерский 5.6: стержень 7 — −0,81 т', sol.slice(-300));

  // «Центр тяжести»: пластинка 9.11.
  await tab('centroid');
  await p.selectOption('#gpreset', 'm911');
  sol = await p.innerText('#gsolution');
  check(has(sol, '5,769', '1,769'), 'Мещерский 9.11: x = 5 10/13, y = 1 10/13', sol.slice(-300));
  await shot('statics-tasks.png');
}
