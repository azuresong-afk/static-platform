/**
 * Сравнение интерфейса с прототипом в браузере: одни и те же действия выполняются в prototype/statika.html
 * и в собранном приложении (dist/), после каждого шага сравниваются чертёж (SVG), текст решения,
 * поля конфигуратора, выделение, сообщения, кнопки истории и мастер.
 *
 * Запуск: npm run build && npm run compare:ui   (скриншоты — в COMPARE_SHOTS, если задан)
 */
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, resolve as pathResolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Page } from 'playwright-core';
import { preview } from 'vite';

const root = pathResolve(dirname(fileURLToPath(import.meta.url)), '..');
const shots = process.env.COMPARE_SHOTS;

function chromiumPath(): string | undefined {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const base = '/opt/pw-browsers';
  if (!existsSync(base)) return undefined;
  const dir = readdirSync(base).find((d) => /^chromium-\d+$/.test(d));
  return dir ? `${base}/${dir}/chrome-linux/chrome` : undefined;
}

/** Состояние страницы, которое должно совпасть. */
// Код передаётся строкой: tsx добавляет в функции служебный __name, которого нет в странице.
const SNAPSHOT = `(() => {
  const q = (s) => document.querySelector(s);
  const visible = (e) => e.offsetParent !== null;
  const conf = q('.panel[aria-label="Конфигуратор"]');
  return {
    viewBox: q('#svg').getAttribute('viewBox'),
    svg: q('#svg').innerHTML.replace(/>\\s+</g, '><'),
    solution: visible(q('#solution')) ? q('#solution').innerText : '(скрыто)',
    solwait: q('#solwait') ? visible(q('#solwait')) : false,
    config: conf.innerText,
    fields: [...conf.querySelectorAll('input, select')].filter(visible).map((i) =>
      (i.type === 'checkbox' ? String(i.checked) : i.value) + (i.disabled ? ' disabled' : '') + (i.classList.contains('bad') ? ' bad' : '')),
    asdir: [...document.querySelectorAll('[data-asdir]')].map((b) => b.disabled + '/' + b.getAttribute('aria-pressed')),
    sel: [...document.querySelectorAll('.item.sel')].map((e) => e.dataset.item),
    msg: q('#segmsg').textContent,
    preset: q('#preset').value,
    undo: q('#undo').disabled,
    redo: q('#redo').disabled,
    view: [...document.querySelectorAll('[data-view]')].map((b) => b.getAttribute('aria-pressed')),
    wiz: q('#wiz') && visible(q('#wiz')) ? q('#wiz').innerText : '(нет мастера)',
    dimedit: q('#dimedit') && visible(q('#dimedit')) ? q('#dimedit').value : null,
  };
})()`;
const snapshot = (p: Page) => p.evaluate(SNAPSHOT) as Promise<Record<string, unknown>>;

type Act = (p: Page) => Promise<void>;
const center = async (p: Page, sel: string, nth = 0, fx = 0.5, fy = 0.5) => {
  const b = (await p.locator(sel).nth(nth).boundingBox())!;
  return [b.x + b.width * fx, b.y + b.height * fy] as const;
};

const steps: [string, Act][] = [];
const step = (name: string, a: Act) => steps.push([name, a]);

// Все готовые задачи в обоих видах.
for (const k of ['cantilever', 'rod', 'lever', 'gframe', 'pframe', 'post', 'bracket', 'indet', 'simple']) {
  step(`задача ${k}`, (p) => p.selectOption('#preset', k).then(() => undefined));
  step(`${k}: расчётная схема`, (p) => p.click('[data-view="schema"]'));
  step(`${k}: конструкция`, (p) => p.click('[data-view="construct"]'));
}
// Правка конструкции и элементов на «Балке на двух опорах».
step('разделить первый участок', (p) => p.click('[data-split]'));
step('добавить каток', (p) => p.click('[data-add="roller"]'));
step('удалить выделенный каток', (p) => p.click('.item.sel [data-del]'));
step('добавить силу', (p) => p.click('[data-add="force"]'));
step('модуль силы 12,5', (p) => p.locator('.item.sel [data-f="F"]').fill('12,5'));
step('модуль силы 12,5 → 12,57', (p) => p.locator('.item.sel [data-f="F"]').fill('12,57'));
step('модуль силы: ошибка ввода', (p) => p.locator('.item.sel [data-f="F"]').fill('12,x'));
step('модуль силы 9', (p) => p.locator('.item.sel [data-f="F"]').fill('9'));
step('уйти из поля', (p) => p.locator('.item.sel [data-f="F"]').press('Tab'));
step('угол 30', (p) => p.locator('.item.sel [data-f="alpha"]').fill('30'));
step('отсчёт от «влево»', (p) => p.selectOption('.item.sel select[data-f="ref"]', 'left').then(() => undefined));
step('по часовой', (p) => p.selectOption('.item.sel select[data-f="rot"]', 'cw').then(() => undefined));
step('сила вверх без угла', (p) => p.click('.item.sel [data-dirq="up"]'));
step('модуль неизвестен', (p) => p.check('.item.sel [data-f="unknown"]'));
step('модуль известен', (p) => p.uncheck('.item.sel [data-f="unknown"]'));
step('опора: поверхность сверху', (p) => p.selectOption('.item[data-kind="sup"] select[data-f="side"] >> nth=0', 'above').then(() => undefined));
step('каток наклонный', (p) => p.selectOption('.item[data-kind="sup"] select[data-f="side"] >> nth=1', 'tilt').then(() => undefined));
step('угол катка 60', (p) => p.locator('.item[data-kind="sup"] [data-f="angle"]').fill('60'));
step('опора снова снизу', (p) => p.selectOption('.item[data-kind="sup"] select[data-f="side"] >> nth=0', 'below').then(() => undefined));
step('каток снова снизу', (p) => p.selectOption('.item[data-kind="sup"] select[data-f="side"] >> nth=1', 'below').then(() => undefined));
step('q в конце 5', (p) => p.locator('.item [data-f="q2"]').fill('5'));
step('нагрузка от точки B', async (p) => {
  const v = await p.locator('.item select[data-f="from"] option').nth(1).getAttribute('value');
  await p.selectOption('.item select[data-f="from"]', v!);
});
step('«что найти»: снять первую', (p) => p.uncheck('[data-target] >> nth=0'));
step('длина первого участка 1,5', (p) => p.locator('[data-seg] >> nth=0').fill('1,5'));
step('длина: ноль — ошибка', (p) => p.locator('[data-seg] >> nth=1').fill('0'));
step('длина: уйти из поля', (p) => p.locator('[data-seg] >> nth=1').press('Tab'));
step('участок вверх из A', async (p) => {
  await p.selectOption('#asFrom', { index: 0 });
  await p.click('[data-asdir="u"]');
  await p.fill('#asLen', '2,5');
  await p.click('#asGo');
});
step('участок вверх из A ещё раз — занято', async (p) => {
  await p.selectOption('#asFrom', { index: 0 });
  await p.click('#asGo');
});
step('длина нового участка: неверная', async (p) => {
  await p.fill('#asLen', '-1');
  await p.click('#asGo');
});
step('направление последнего участка ←', (p) => p.selectOption('[data-segdir] >> nth=-1', 'l').then(() => undefined));
step('направление: наложение', (p) => p.selectOption('[data-segdir] >> nth=0', 'l').then(() => undefined));
step('перетащить опору в третью точку', async (p) => {
  const [x, y] = await center(p, '[data-drag]', 0);
  const [tx, ty] = await center(p, '.memhit', 2, 0, 0.5);
  await p.mouse.move(x, y);
  await p.mouse.down();
  await p.mouse.move((x + tx) / 2, (y + ty) / 2, { steps: 4 });
  await p.mouse.move(tx, ty, { steps: 4 });
  await p.mouse.up();
});
// Размер может быть перекрыт областью захвата элемента, поэтому щелчок отправляется прямо на него.
step('щелчок по размеру', (p) => p.locator('[data-dim]').nth(0).dispatchEvent('click'));
step('размер 2,5 и Enter', async (p) => {
  await p.fill('#dimedit', '2,5');
  await p.press('#dimedit', 'Enter');
});
step('двойной щелчок по участку', async (p) => {
  const [x, y] = await center(p, '.memhit', 1, 0.3, 0.5);
  await p.mouse.dblclick(x, y);
});
step('выделить распределённую нагрузку на чертеже', async (p) => {
  const [x, y] = await center(p, '[data-pick]', 0);
  await p.mouse.click(x, y);
});
step('щелчок мимо — снять выделение', async (p) => {
  const b = (await p.locator('#svg').boundingBox())!;
  await p.mouse.click(b.x + 20, b.y + 20);
});
step('отменить', (p) => p.click('#undo'));
step('отменить', (p) => p.click('#undo'));
step('повторить', (p) => p.click('#redo'));
step('Ctrl+Z', async (p) => {
  await p.locator('.wrap h1').click();
  await p.keyboard.press('Control+z');
});
step('Ctrl+Y', (p) => p.keyboard.press('Control+y'));
step('Ctrl+Shift+Z', (p) => p.keyboard.press('Control+Shift+z'));
step('расчётная схема', (p) => p.click('[data-view="schema"]'));
step('конструкция', (p) => p.click('[data-view="construct"]'));
// Мастер.
step('пустой шаблон', (p) => p.selectOption('#preset', 'blank').then(() => undefined));
step('мастер: далее', (p) => p.click('#wnext'));
step('мастер: шарнир', (p) => p.click('[data-add="pin"]'));
step('мастер: каток', (p) => p.click('[data-add="roller"]'));
step('мастер: далее', (p) => p.click('#wnext'));
step('мастер: сила', (p) => p.click('[data-add="force"]'));
step('мастер: далее', (p) => p.click('#wnext'));
step('мастер: показать решение', (p) => p.click('#wnext'));
step('мастер: к шагу 2', (p) => p.click('[data-wgo="2"]'));
step('мастер: назад', (p) => p.click('#wprev'));
step('мастер: полный редактор', (p) => p.click('#wexit'));

async function main() {
  const server = await preview({ root, preview: { port: 4174, strictPort: true }, logLevel: 'error' });
  const browser = await chromium.launch({ executablePath: chromiumPath() });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  await ctx.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
  const P = await ctx.newPage(),
    A = await ctx.newPage();
  const errors: string[] = [];
  for (const [n, p] of [['прототип', P], ['приложение', A]] as const) p.on('pageerror', (e) => errors.push(`${n}: ${e.message}`));
  await P.goto('file://' + pathResolve(root, 'prototype/statika.html'));
  await A.goto('http://localhost:4174/');
  // Пояснения — новая функция; для сравнения с прототипом выключаем.
  if (await A.isChecked('.toggle input')) await A.click('.toggle input');
  if (shots) mkdirSync(shots, { recursive: true });

  let fails = 0,
    i = 0;
  const check = async (name: string) => {
    const [a, b] = await Promise.all([snapshot(P), snapshot(A)]);
    const diff = Object.keys(a).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
    if (diff.length) {
      fails++;
      console.log(`✗ ${name}: различается ${diff.join(', ')}`);
      for (const k of diff) {
        const x = JSON.stringify(a[k]),
          y = JSON.stringify(b[k]);
        let j = 0;
        while (j < x.length && x[j] === y[j]) j++;
        console.log(`   ${k}: прототип …${x.slice(Math.max(0, j - 80), j + 120)}\n   ${' '.repeat(k.length)}  порт     …${y.slice(Math.max(0, j - 80), j + 120)}`);
      }
    } else console.log(`✓ ${name}`);
    if (shots) await A.screenshot({ path: `${shots}/${String(++i).padStart(3, '0')}.png`, fullPage: true });
  };
  await check('старт');
  for (const [name, act] of steps) {
    await act(P);
    await act(A);
    await check(name);
  }
  // Баг №7 исправлен только в порте: отдельная проверка.
  await A.selectOption('#preset', 'simple');
  const before = await A.locator('.segrow').count();
  await A.click('[data-segdel] >> nth=1');
  const after = await A.locator('.segrow').count();
  console.log(after === before - 1 ? '✓ «Убрать участок» работает (баг №7)' : `✗ «Убрать участок»: было ${before}, стало ${after}`);
  if (after !== before - 1) fails++;

  await browser.close();
  await new Promise<void>((r) => server.httpServer.close(() => r()));
  if (errors.length) console.log('Ошибки на страницах:', errors);
  console.log(fails || errors.length ? `Расхождений: ${fails}` : `Все ${steps.length + 1} шагов совпали с прототипом.`);
  process.exitCode = fails || errors.length ? 1 : 0;
}

main();
