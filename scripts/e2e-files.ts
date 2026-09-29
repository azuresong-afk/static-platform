/**
 * Проверка в браузере: сохранение и открытие проекта, перетаскивание файла, ошибки, вкладки разделов, отчёт в PDF.
 * Запуск: npm run build && npm run e2e:files   (PDF и скриншот — в E2E_OUT, по умолчанию не сохраняются)
 */
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve as pathResolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Page } from 'playwright-core';
import { preview } from 'vite';

const root = pathResolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = process.env.E2E_OUT;

function chromiumPath(): string | undefined {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const base = '/opt/pw-browsers';
  if (!existsSync(base)) return undefined;
  const dir = readdirSync(base).find((d) => /^chromium-\d+$/.test(d));
  return dir ? `${base}/${dir}/chrome-linux/chrome` : undefined;
}

let fails = 0;
const check = (ok: boolean, name: string, detail = '') => {
  console.log(`${ok ? '✓' : '✗'} ${name}${ok || !detail ? '' : ': ' + detail}`);
  if (!ok) fails++;
};

/** То, что должно совпасть у одинаковых проектов (идентификаторы после открытия новые). */
const state = (p: Page) =>
  p.evaluate(`(() => ({
    solution: document.querySelector('#solution').innerText,
    fields: [...document.querySelectorAll('.panel[aria-label="Конфигуратор"] input, .panel[aria-label="Конфигуратор"] select')]
      .filter((e) => e.offsetParent !== null && e.id !== 'asFrom' && !(e.dataset.f in { at: 1, from: 1, to: 1 }))
      .map((e) => (e.type === 'checkbox' ? String(e.checked) : e.value)),
    stamp: [...document.querySelectorAll('#svg .t-stv')].map((t) => t.textContent),
  }))()`) as Promise<{ solution: string; fields: string[]; stamp: string[] }>;

async function main() {
  const server = await preview({ root, preview: { port: 4176, strictPort: true }, logLevel: 'error' });
  // Локаль UTF-8: без неё Chromium отвергает кириллицу в именах скачиваемых файлов (у пользователей она есть всегда).
  const browser = await chromium.launch({ executablePath: chromiumPath(), env: { ...process.env, LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8' } });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, acceptDownloads: true });
  await ctx.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
  const p = await ctx.newPage();
  const errors: string[] = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto('http://localhost:4176/');

  // 1. Своя схема: П-рама с правками → сохранить.
  await p.selectOption('#preset', 'pframe');
  await p.locator('.item [data-f="F"]').first().fill('7,5');
  await p.locator('.item [data-f="F"]').first().press('Tab');
  await p.uncheck('[data-target] >> nth=0');
  const saved = await state(p);
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#fsave')]);
  const name = dl.suggestedFilename();
  const text = await (await dl.createReadStream()).toArray().then((c) => Buffer.concat(c).toString('utf8'));
  check(/^Своя схема \d{4}-\d{2}-\d{2}\.statika\.json$/.test(name), 'имя файла', name);
  check(JSON.parse(text).format === 'statika-project' && JSON.parse(text).version === 2 && JSON.parse(text).module === 'frames', 'формат файла: версия 2, раздел frames');
  check((await p.textContent('.notice'))!.includes(name), 'уведомление о сохранении');

  // 2. Другая задача → открыть сохранённый файл через выбор файла.
  await p.selectOption('#preset', 'simple');
  const [chooser] = await Promise.all([p.waitForEvent('filechooser'), p.click('#fopen')]);
  await chooser.setFiles({ name, mimeType: 'application/json', buffer: Buffer.from(text) });
  await p.waitForSelector('.notice.n-ok');
  const opened = await state(p);
  check(JSON.stringify(opened) === JSON.stringify(saved), 'открытый проект совпадает с сохранённым');
  check((await p.textContent('.notice'))!.includes('Открыт проект'), 'уведомление об открытии');
  check((await p.inputValue('#preset')) === 'custom', 'в списке задач — «Своя схема»');

  // 3. Открытие отменяется.
  await p.click('#undo');
  check((await p.inputValue('#preset')) === 'simple', 'отмена открытия возвращает прежнюю задачу');

  // 4. Перетаскивание файла на страницу.
  const dt = await p.evaluateHandle(
    ([t, n]) => {
      const d = new DataTransfer();
      d.items.add(new File([t], n, { type: 'application/json' }));
      return d;
    },
    [text, name] as const,
  );
  await p.dispatchEvent('.canvas', 'dragover', { dataTransfer: dt });
  await p.dispatchEvent('.canvas', 'drop', { dataTransfer: dt });
  await p.waitForFunction(() => document.querySelector('#preset') && (document.querySelector('#preset') as HTMLSelectElement).value === 'custom');
  check(JSON.stringify(await state(p)) === JSON.stringify(saved), 'перетащенный файл открыт');

  // 5. Испорченный файл.
  const [ch2] = await Promise.all([p.waitForEvent('filechooser'), p.click('#fopen')]);
  const broken = JSON.parse(text);
  broken.structure.items[0].at = 'nope';
  await ch2.setFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(broken)) });
  await p.waitForSelector('.notice.n-bad');
  const msg = (await p.textContent('.notice.n-bad'))!;
  check(msg.includes('Не удалось открыть «broken.json»') && msg.includes('привязан к несуществующей точке'), 'понятная ошибка для испорченного файла', msg);
  check(JSON.stringify(await state(p)) === JSON.stringify(saved), 'после ошибки схема не изменилась');

  // 6. Ctrl+S из поля ввода.
  await p.locator('[data-seg]').first().focus();
  const [dl2] = await Promise.all([p.waitForEvent('download'), p.keyboard.press('Control+s')]);
  check(dl2.suggestedFilename().endsWith('.statika.json'), 'Ctrl+S сохраняет файл');

  // 7. Внутренний шарнир: трёхшарнирная арка без шарнира неопределима, с шарниром — определима.
  await p.selectOption('#preset', 'arch3');
  const stampStatus = () => p.evaluate(`[...document.querySelectorAll('#svg .t-stv')].pop().textContent`) as Promise<string>;
  check((await stampStatus()) === 'статически определима', 'арка с шарниром определима');
  check((await p.innerText('#solution')).includes('Расчленяем конструкцию по шарнирам'), 'в решении есть шаг «Расчленяем конструкцию»');
  check((await p.locator('#svg .ihinge').count()) === 1, 'шарнир нарисован на чертеже');
  await p.uncheck('[data-hinge]:checked');
  check((await stampStatus()) === 'статически неопределима', 'без шарнира — неопределима');
  await p.click('#undo');
  check((await stampStatus()) === 'статически определима', 'отмена возвращает шарнир');

  // Шарниры переживают сохранение и открытие.
  const [dl3] = await Promise.all([p.waitForEvent('download'), p.click('#fsave')]);
  const archText = await (await dl3.createReadStream()).toArray().then((c) => Buffer.concat(c).toString('utf8'));
  await p.selectOption('#preset', 'simple');
  const openText = async (fileName: string, body: string, tone: 'ok' | 'bad') => {
    await p.click('.notice .del').catch(() => {});
    const [c] = await Promise.all([p.waitForEvent('filechooser'), p.click('#fopen')]);
    await c.setFiles({ name: fileName, mimeType: 'application/json', buffer: Buffer.from(body) });
    await p.waitForSelector(`.notice.n-${tone}`);
    return (await p.textContent('.notice'))!;
  };
  await openText('arch.json', archText, 'ok');
  check((await p.locator('#svg .ihinge').count()) === 1 && (await stampStatus()) === 'статически определима', 'шарнир сохраняется в файле и восстанавливается');

  // 7а. Вкладки разделов и файлы разных версий и разделов.
  check((await p.locator('.tabs [role="tab"]').count()) === 9, 'девять вкладок: три готовых раздела и шесть запланированных');
  check((await p.getAttribute('[data-tab="frames"]', 'aria-selected')) === 'true', 'активна вкладка «Балки и рамы»');
  check(await p.isDisabled('[data-tab="truss"]'), 'запланированные разделы недоступны');
  const v1 = JSON.parse(text);
  delete v1.module;
  v1.version = 1;
  await p.selectOption('#preset', 'simple');
  await openText('old.json', JSON.stringify(v1), 'ok');
  check(JSON.stringify(await state(p)) === JSON.stringify(saved), 'файл версии 1 открывается во вкладке «Балки и рамы»');
  const truss = await openText('truss.json', JSON.stringify({ ...JSON.parse(text), module: 'truss' }), 'bad');
  check(truss.includes('раздел «Фермы» ещё в разработке'), 'файл неготового раздела — понятное сообщение', truss);
  check(JSON.stringify(await state(p)) === JSON.stringify(saved), 'после такого файла схема не изменилась');
  if (out) {
    await p.click('[data-view="schema"]');
    await p.screenshot({ path: pathResolve(out, 'arch3.png'), fullPage: true });
    await p.click('[data-view="construct"]');
  }
  await p.selectOption('#preset', 'pframe');
  await p.locator('.item [data-f="F"]').first().fill('7,5');
  await p.uncheck('[data-target] >> nth=0');

  // 8. Отчёт в PDF (печать).
  await p.emulateMedia({ media: 'print' });
  const report = await p.evaluate(`(() => {
    const r = document.querySelector('.print-report');
    return { visible: r.offsetParent !== null || getComputedStyle(r).display !== 'none', app: getComputedStyle(document.querySelector('.wrap')).display,
      text: r.innerText, svgs: r.querySelectorAll('svg').length };
  })()`) as { visible: boolean; app: string; text: string; svgs: number };
  check(report.visible && report.app === 'none', 'при печати виден отчёт, а не интерфейс');
  check(report.svgs === 2, 'в отчёте оба вида чертежа');
  for (const s of ['Дано', 'Найти:', 'Решение', 'Освобождаемся от связей', 'Ответ', 'Сила'])
    check(report.text.includes(s), `в отчёте есть «${s}»`);
  const pdf = await p.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
  const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  check(pdf.length > 20000 && pages >= 2, 'PDF создан', `${pdf.length} байт, страниц: ${pages}`);
  console.log(`  PDF: ${Math.round(pdf.length / 1024)} КБ, страниц: ${pages}`);
  if (out) {
    writeFileSync(pathResolve(out, 'report.pdf'), pdf);
    await p.screenshot({ path: pathResolve(out, 'report-print.png'), fullPage: true });
  }

  // 9. Вкладка «Изгиб».
  await p.emulateMedia({ media: 'screen' });
  await p.click('[data-tab="bending"]');
  check((await p.getAttribute('[data-tab="bending"]', 'aria-selected')) === 'true', 'вкладка «Изгиб» открывается');
  await p.selectOption('#bpreset', 'antonov7');
  const sol = await p.innerText('#bsolution');
  check(sol.includes('54,704') && sol.includes('опасное сечение'), 'решение по участкам: экстремум и опасное сечение');
  check((await p.locator('#bdg .dg-line').count()) === 8, 'эпюры Q и M по четырём участкам');
  const mLabel = () => p.evaluate(`[...document.querySelectorAll('#bdg .dg-val')].find((t) => t.textContent === '−120').getAttribute('y')`) as Promise<string>;
  const yCompressed = +(await mLabel());
  await p.click('input[name="mSide"] >> nth=1');
  const yTension = +(await mLabel());
  check(yTension < yCompressed, 'на растянутых волокнах отрицательный момент откладывается вверх', `${yCompressed} → ${yTension}`);
  check((await p.innerText('#bsolution')).includes('растянутых волокнах'), 'правило знаков в решении меняется вместе с настройкой');
  await p.click('input[name="axis"] >> nth=1');
  await p.click('input[name="indexed"] >> nth=1');
  check((await p.innerText('#bsolution')).includes('Qy(x1)'), 'обозначения Qy и ось x в формулах');
  await p.reload();
  await p.waitForSelector('#bsolution');
  check((await p.getAttribute('[data-tab="bending"]', 'aria-selected')) === 'true', 'после перезагрузки открыта та же вкладка');
  check(await p.isChecked('input[name="mSide"] >> nth=1'), 'настройки правил запоминаются');
  await p.click('input[name="mSide"] >> nth=0');
  await p.click('input[name="axis"] >> nth=0');
  await p.click('input[name="indexed"] >> nth=0');
  // Схема общая с «Балками и рамами»: правка там видна здесь; файл «Балок и рам» открывается во вкладке «Изгиб».
  await p.selectOption('#bpreset', 'antonov85');
  await p.click('#bedit');
  check((await p.getAttribute('[data-tab="frames"]', 'aria-selected')) === 'true', '«Изменить схему» ведёт в «Балки и рамы»');
  check((await p.inputValue('#preset')) === 'custom' && (await p.textContent('h1'))!.includes('балки'), 'там открыта та же схема');
  await p.selectOption('#preset', 'pframe');
  await p.click('[data-tab="bending"]');
  check((await p.innerText('.dg-empty')).includes('только для прямых горизонтальных балок'), 'для рамы — понятное сообщение');
  await p.click('.hist button[title^="Отменить"]');
  check((await p.innerText('#bsolution')).includes('M(0,667) = 2,667'), 'отмена во вкладке «Изгиб» возвращает балку (M_max = 8/9·ql²)');
  await openText('beam.json', text, 'ok');
  check((await p.getAttribute('[data-tab="bending"]', 'aria-selected')) === 'true', 'файл «Балок и рам» открывается, не уходя с вкладки «Изгиб»');
  await p.selectOption('#bpreset', 'antonov7');
  await p.emulateMedia({ media: 'print' });
  const brep = (await p.evaluate(`(() => { const r = document.querySelector('.print-report'); return { text: r.innerText, svgs: r.querySelectorAll('svg').length, shown: getComputedStyle(r).display }; })()`)) as { text: string; svgs: number; shown: string };
  check(brep.shown !== 'none' && brep.svgs === 2 && brep.text.includes('Участок IV') && brep.text.includes('54,704'), 'отчёт вкладки «Изгиб»: схема, эпюры и решение');
  await p.emulateMedia({ media: 'screen' });

  // 10. Вкладка «Подбор сечения».
  await p.click('[data-tab="sections"]');
  await p.selectOption('#spreset', 'antonov7');
  let ss = await p.innerText('#ssolution');
  check(ss.includes('678,26 см³') && ss.includes('двутавр №36') && ss.includes('16,86 МПа'), 'подбор по задаче Антонова: W, двутавр №36, касательные', ss.slice(0, 200));
  check((await p.locator('#ssketch .sk-best').count()) === 1, 'эскизы сечений, самое лёгкое выделено');
  await p.click('input[name="s-source"] >> nth=1');
  await p.fill('#s-M', '30');
  await p.locator('#s-M').blur();
  ss = await p.innerText('#ssolution');
  check(ss.includes('|M|max = 30 кН·м') && !ss.includes('(в точке'), 'M и Q вручную');
  await p.fill('#s-tau', '-3');
  check((await p.getAttribute('#s-tau', 'class')) === 'bad', 'неверное значение подсвечивается');
  await p.locator('#s-tau').blur();
  await p.click('.hist button[title^="Отменить"]');
  check((await p.inputValue('#s-M')) === '20', 'первая отмена — прежнее значение M');
  await p.click('.hist button[title^="Отменить"]');
  check((await p.innerText('#ssolution')).includes('|M|max = 120 кН·м'), 'вторая отмена — снова M и Q с эпюр');
  const [dl4] = await Promise.all([p.waitForEvent('download'), p.click('#fsave')]);
  const secText = await (await dl4.createReadStream()).toArray().then((c) => Buffer.concat(c).toString('utf8'));
  check(JSON.parse(secText).module === 'sections' && JSON.parse(secText).section.sigmaT === 230, 'файл подбора: раздел sections и исходные данные');
  await p.click('[data-tab="frames"]');
  await p.selectOption('#preset', 'simple');
  await openText('sec.json', secText, 'ok');
  check((await p.getAttribute('[data-tab="sections"]', 'aria-selected')) === 'true', 'файл подбора из «Балок и рам» открывается во вкладке «Подбор сечения»');
  check((await p.innerText('#ssolution')).includes('двутавр №36'), 'после открытия — тот же подбор');
  await p.emulateMedia({ media: 'print' });
  const srep = (await p.evaluate(`(() => { const r = document.querySelector('.print-report'); return { text: r.innerText, svgs: r.querySelectorAll('svg').length }; })()`)) as { text: string; svgs: number };
  check(srep.svgs === 1 && srep.text.includes('Проверка по касательным напряжениям'), 'отчёт подбора сечения');
  await p.emulateMedia({ media: 'screen' });

  await browser.close();
  await new Promise<void>((r) => server.httpServer.close(() => r()));
  if (errors.length) console.log('Ошибки на странице:', errors);
  console.log(fails || errors.length ? `Провалено проверок: ${fails}` : 'Все проверки пройдены.');
  process.exitCode = fails || errors.length ? 1 : 0;
}

main();
