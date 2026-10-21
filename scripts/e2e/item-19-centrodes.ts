/** Вкладка «Центроиды» (пункт 19): построение, ползунок положения, отмена, файл, отчёт. */
import type { E2EKit } from '../e2e-kit';

export default async function ({ p, check, tab, openText, saveText, report, shot }: E2EKit) {
  await tab('centrodes');
  await p.selectOption('#cpreset', 'm176');
  let ceS = await p.innerText('#csolution');
  check(
    ceS.includes('Неподвижная центроида') && ceS.includes('гипербола с фокусами A и B') && ceS.includes('наибольшая невязка уравнения книги'),
    'Мещерский 17.6: антипараллелограмм — гиперболы из ответа книги',
    ceS.slice(0, 200),
  );
  check(
    (await p.locator('#csvg .ce-fixed').count()) >= 2 &&
      (await p.locator('#csvg .ce-moving').count()) >= 2 &&
      (await p.locator('#csvg2 .ce-moving').count()) >= 2,
    'на чертежах — обе центроиды',
  );
  const phi0 = await p.textContent('#cphival');
  await p.$eval('#cphi', (el) => {
    const i = el as HTMLInputElement;
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    set.call(i, '60');
    i.dispatchEvent(new Event('input', { bubbles: true }));
  });
  check(
    (await p.textContent('#cphival')) !== phi0 && (await p.locator('#csvg .ce-ic').count()) === 1,
    'ползунок меняет положение, мгновенный центр на чертеже',
  );
  await p.locator('#cv-b').fill('6');
  await p.locator('#cv-b').blur();
  check((await p.innerText('#csolution')).includes('наибольшая невязка уравнения книги'), 'размер изменён — центроиды пересчитаны');
  await p.click('.hist button[title^="Отменить"]');
  check((await p.inputValue('#cv-b')) === '5', 'отмена возвращает размер');
  await p.selectOption('#cpreset', 'm1711');
  ceS = await p.innerText('#csolution');
  check(ceS.includes('x² = a(2y − a)') && ceS.includes('ξ² = a(2η − a)'), 'Мещерский 17.11: параболы из ответа книги', ceS.slice(-300));
  await p.selectOption('#cpreset', 'm1710');
  check((await p.innerText('#csolution')).includes('η² = aξ'), 'Мещерский 17.10: подвижная центроида η² = aξ');
  const ceText = await saveText();
  check(JSON.parse(ceText).module === 'centrodes' && JSON.parse(ceText).preset === 'm1710', 'файл центроид');
  const ceSol = await p.innerText('#csolution');
  await tab('frames');
  await openText('centrodes.json', ceText, 'ok');
  check(
    (await p.getAttribute('[data-tab="centrodes"]', 'aria-selected')) === 'true' && (await p.innerText('#csolution')) === ceSol,
    'файл центроид открывается в своей вкладке без потерь',
  );
  const ceRep = await report();
  check(ceRep.svgs === 2 && ceRep.text.includes('Подвижная центроида'), 'отчёт по центроидам');
  await shot('centrodes.png');
}
