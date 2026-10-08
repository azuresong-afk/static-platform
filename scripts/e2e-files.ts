/**
 * Проверка в браузере: сохранение и открытие проекта, перетаскивание файла, ошибки, вкладки разделов, отчёт в PDF.
 * Запуск: npm run build && npm run e2e:files   (PDF и скриншот — в E2E_OUT, по умолчанию не сохраняются)
 */
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve as pathResolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Page } from 'playwright-core';
import { preview } from 'vite';
import { blockOf, NAV_BLOCKS } from '../src/app/nav';

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
  /** Перейти в раздел: сначала его блок (вкладки разделов видны только внутри блока), затем вкладка. */
  const tab = async (id: string) => {
    const b = blockOf(id);
    if (b && !(await p.locator(`.tabs [data-tab="${id}"]`).count())) await p.click(`[data-block="${b.id}"]`);
    await p.click(`[data-tab="${id}"]`);
  };

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
  check((await p.getAttribute('[data-tab="frames"]', 'aria-selected')) === 'true', 'активна вкладка «Балки и рамы»');
  check((await p.locator('[data-block]').count()) === 5 && (await p.locator('[data-course="theor"] [data-block]').count()) === 4, 'навигация: четыре блока Мещерского и сопромат Антонова');
  check((await p.getAttribute('[data-block="statics"]', 'aria-current')) === 'true' && (await p.locator('.tabs [role="tab"]').count()) === 5, 'блок «Статика» активен, в нём пять разделов');
  const seen: string[] = [];
  for (const b of NAV_BLOCKS) {
    await p.click(`[data-block="${b.id}"]`);
    seen.push(...(await p.locator('.tabs [role="tab"]').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.tab!))));
  }
  check(new Set(seen).size === 25 && seen.length === 25, 'двадцать пять разделов, каждый — в одном блоке', seen.join(' '));
  await tab('frames');
  check((await p.evaluate(`getComputedStyle(document.querySelector('.nav')).position`)) === 'sticky', 'навигация прилипает к верху страницы');
  const beforeMap = JSON.stringify(await state(p));
  await tab('roadmap');
  check((await p.locator('.rm-block').count()) === 5, 'дорожная карта: статика, динамика, кинематика, аналитическая механика, сопромат');
  check((await p.locator('.rm-done').count()) === 27, 'готово двадцать семь пунктов');
  check((await p.textContent('[data-rm="joints"] .rm-badge')) === 'следующий', 'следующий раздел — резьбовые и сварные соединения');
  check((await p.locator('.filebar').count()) === 0, 'на дорожной карте нет кнопок файлов');
  await p.keyboard.press('Control+z');
  await p.click('[data-rm="composite"] .rm-open');
  check((await p.getAttribute('[data-tab="composite"]', 'aria-selected')) === 'true', '«Открыть» ведёт во вкладку раздела');
  await tab('frames');
  check(JSON.stringify(await state(p)) === beforeMap, 'Ctrl+Z на дорожной карте не меняет схему');
  const v1 = JSON.parse(text);
  delete v1.module;
  v1.version = 1;
  await p.selectOption('#preset', 'simple');
  await openText('old.json', JSON.stringify(v1), 'ok');
  check(JSON.stringify(await state(p)) === JSON.stringify(saved), 'файл версии 1 открывается во вкладке «Балки и рамы»');
  const fric = await openText('joints.json', JSON.stringify({ ...JSON.parse(text), module: 'joints' }), 'bad');
  check(fric.includes('раздел «Резьбовые и сварные соединения» ещё в разработке'), 'файл неготового раздела — понятное сообщение', fric);
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
  await tab('bending');
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
  await tab('bending');
  check((await p.innerText('.dg-empty')).includes('вкладка «Рамы: эпюры N, Q, M»'), 'для рамы — понятное сообщение со ссылкой на вкладку рам');
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
  await tab('sections');
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
  await tab('frames');
  await p.selectOption('#preset', 'simple');
  await openText('sec.json', secText, 'ok');
  check((await p.getAttribute('[data-tab="sections"]', 'aria-selected')) === 'true', 'файл подбора из «Балок и рам» открывается во вкладке «Подбор сечения»');
  check((await p.innerText('#ssolution')).includes('двутавр №36'), 'после открытия — тот же подбор');
  await p.emulateMedia({ media: 'print' });
  const srep = (await p.evaluate(`(() => { const r = document.querySelector('.print-report'); return { text: r.innerText, svgs: r.querySelectorAll('svg').length }; })()`)) as { text: string; svgs: number };
  check(srep.svgs === 1 && srep.text.includes('Проверка по касательным напряжениям'), 'отчёт подбора сечения');
  await p.emulateMedia({ media: 'screen' });

  // 11. Вкладка «Растяжение-сжатие».
  await tab('axial');
  await p.selectOption('#apreset', 'antonov11');
  let as = await p.innerText('#asolution');
  check(as.includes('6,667 см²') && as.includes('|σ|max = 150 МПа'), 'задача 1.1: площадь A из условия прочности', as.slice(0, 200));
  await p.selectOption('#apreset', 'antonov12');
  as = await p.innerText('#asolution');
  check(as.includes('−92,861') && as.includes('1,72'), 'задача 1.2: реакция и запас прочности');
  check((await p.locator('#adg .dg-line').count()) === 12, 'эпюры N, σ, ε, Δ по трём участкам');
  await p.click('input[name="a-areaMode"] >> nth=0');
  check((await p.innerText('.dg-empty')).includes('площадь A нужно задать'), 'нагрев с двумя заделками — A нужно задать');
  await p.click('.hist button[title^="Отменить"]');
  await p.click('#aadd');
  check((await p.locator('.arow').count()) === 4, 'ступень добавляется');
  check((await p.locator('#a-f4').count()) === 0, 'в точке у заделки поля силы нет');
  await p.click('input[name="a-supports"] >> nth=0');
  await p.fill('#a-f4', '−50');
  await p.locator('#a-f4').blur();
  as = await p.innerText('#asolution');
  check(as.includes('FE'), 'сила в новой точке E входит в решение', as.slice(0, 300));
  const [dl5] = await Promise.all([p.waitForEvent('download'), p.click('#fsave')]);
  const axText = await (await dl5.createReadStream()).toArray().then((c) => Buffer.concat(c).toString('utf8'));
  check(JSON.parse(axText).module === 'axial' && JSON.parse(axText).bar.steps.length === 4, 'файл бруса: раздел axial');
  await tab('frames');
  await openText('bar.json', axText, 'ok');
  check((await p.getAttribute('[data-tab="axial"]', 'aria-selected')) === 'true', 'файл бруса открывается во вкладке «Растяжение-сжатие»');
  await p.emulateMedia({ media: 'print' });
  const arep = (await p.evaluate(`(() => { const r = document.querySelector('.print-report'); return { text: r.innerText, svgs: r.querySelectorAll('svg').length }; })()`)) as { text: string; svgs: number };
  check(arep.svgs === 2 && arep.text.includes('Продольные силы по участкам'), 'отчёт по брусу');
  await p.emulateMedia({ media: 'screen' });

  // 12. Вкладка «Пространственный брус».
  await tab('space3');
  await p.selectOption('#spreset3', 's16');
  let s3 = await p.innerText('#s3solution');
  check(s3.includes('51,235') && s3.includes('d = 149 мм'), 'задача 3: M_экв в заделке и диаметр круга', s3.slice(0, 200));
  check((await p.locator('#sMb .sp-line').count()) >= 3 && (await p.locator('#sMk .sp-line').count()) >= 1, 'эпюры изгибающих и крутящего моментов');
  await p.click('input[name="s3-section"] >> nth=1');
  check((await p.innerText('#s3solution')).includes('D = 177 мм, d = 141 мм'), 'кольцо: D и d');
  await p.click('input[name="s3-hyp"] >> nth=1');
  check((await p.innerText('#s3solution')).includes('четвёртой'), 'четвёртая гипотеза');
  await p.click('.segbtns button:has-text("+ сила")');
  check((await p.locator('.lrow').count()) === 3, 'нагрузка добавляется');
  await p.click('.hist button[title^="Отменить"]');
  check((await p.locator('.lrow').count()) === 2, 'отмена');
  const [dl6] = await Promise.all([p.waitForEvent('download'), p.click('#fsave')]);
  const s3Text = await (await dl6.createReadStream()).toArray().then((c) => Buffer.concat(c).toString('utf8'));
  await tab('frames');
  await openText('space.json', s3Text, 'ok');
  check((await p.getAttribute('[data-tab="space3"]', 'aria-selected')) === 'true', 'файл пространственного бруса открывается в своей вкладке');
  await p.emulateMedia({ media: 'print' });
  const s3rep = (await p.evaluate(`(() => { const r = document.querySelector('.print-report'); return { text: r.innerText, svgs: r.querySelectorAll('svg').length }; })()`)) as { text: string; svgs: number };
  check(s3rep.svgs === 4 && s3rep.text.includes('Опасное сечение'), 'отчёт по пространственному брусу');
  await p.emulateMedia({ media: 'screen' });

  // 13. Вкладка «Составное сечение».
  await tab('composite');
  await p.selectOption('#cpreset', 's7');
  let cs = await p.innerText('#csolution');
  check(cs.includes('7,672 см') && cs.includes('4609,91') && cs.includes('32·(−6,872)²'), 'задача 6, схема 7: центр тяжести и I_X', cs.slice(0, 200));
  await p.fill('#c-M', '10');
  await p.locator('#c-M').blur();
  check((await p.innerText('#csolution')).includes('σ = −34,12 МПа'), 'напряжение в наиболее нагруженной точке при M = 10 кН·м');
  await p.selectOption('.cprow:not(.cphead) select[aria-label="Разворот"] >> nth=2', '270');
  check((await p.innerText('#csolution')).includes('косой') === false, 'разворот швеллера на 270° — сечение остаётся симметричным');
  await p.selectOption('.cprow:not(.cphead) select[aria-label="Вид"] >> nth=2', 'angle');
  check((await p.innerText('#csolution')).includes('изгиб косой'), 'несимметричное сечение — косой изгиб и главные оси');
  await p.click('.hist button[title^="Отменить"]');
  await p.click('.hist button[title^="Отменить"]');
  const [dl7] = await Promise.all([p.waitForEvent('download'), p.click('#fsave')]);
  const cText = await (await dl7.createReadStream()).toArray().then((c) => Buffer.concat(c).toString('utf8'));
  check(JSON.parse(cText).module === 'composite' && JSON.parse(cText).parts.length === 3, 'файл сечения');
  await tab('frames');
  await openText('sec.json', cText, 'ok');
  check((await p.getAttribute('[data-tab="composite"]', 'aria-selected')) === 'true', 'файл сечения открывается в своей вкладке');
  await p.emulateMedia({ media: 'print' });
  const crep = (await p.evaluate(`(() => { const r = document.querySelector('.print-report'); return { text: r.innerText, svgs: r.querySelectorAll('svg').length }; })()`)) as { text: string; svgs: number };
  check(crep.svgs === 1 && crep.text.includes('Моменты сопротивления'), 'отчёт по сечению');
  await p.emulateMedia({ media: 'screen' });

  // 14. Наклонные участки в «Балках и рамах».
  await tab('frames');
  await p.selectOption('#preset', 'rafter');
  let fs = await p.innerText('#solution');
  check(fs.includes('перпендикулярно участку') && fs.includes('5,231') && fs.includes('5,462'), 'стропила: ветер по нормали к скату, реакции 4.21', fs.slice(0, 300));
  check((await stampStatus()) === 'статически определима' && (await p.locator('#svg .angarc').count()) >= 2, 'на чертеже — углы наклона участков');
  await p.selectOption('#preset', 'blank');
  await p.click('#wexit');
  await p.click('[data-asdir="ur"]');
  await p.click('#asByXY');
  await p.fill('#asDx', '4');
  await p.fill('#asDy', '3');
  await p.click('#asGo');
  check((await p.inputValue('[data-segang]')) === '36,8699' && (await p.locator('[data-seg]').nth(1).inputValue()) === '5', 'участок по проекциям 4 × 3: длина 5, угол 36,87°');
  await p.fill('[data-segang]', '45');
  await p.locator('[data-segang]').blur();
  check((await p.innerText('#asFrom')).includes('C (7,54; 3,54)'), 'угол 45°: точка C сдвинулась', await p.innerText('#asFrom'));
  await p.click('#undo');
  check((await p.inputValue('[data-segang]')) === '36,8699', 'отмена возвращает угол');
  const [dl8] = await Promise.all([p.waitForEvent('download'), p.click('#fsave')]);
  const iText = await (await dl8.createReadStream()).toArray().then((c) => Buffer.concat(c).toString('utf8'));
  const iseg = JSON.parse(iText).structure.segs[1];
  check(iseg.dir === 'a' && Math.abs(iseg.ang - 36.8698976) < 1e-6 && Math.abs(iseg.len - 5) < 1e-12, 'в файле — наклонный участок с углом', JSON.stringify(iseg));
  const incState = await state(p);
  await p.selectOption('#preset', 'simple');
  await openText('incl.json', iText, 'ok');
  check(JSON.stringify(await state(p)) === JSON.stringify(incState), 'наклонный участок сохраняется и открывается');
  await p.selectOption('#preset', 'ladder');
  await p.selectOption('.item[data-kind="sup"] >> nth=1 >> select[data-f="side"]', 'below');
  await p.click('[data-normal="135"]');
  check((await p.inputValue('.item[data-kind="sup"] >> nth=1 >> [data-f="angle"]')) === '135', 'каток: реакция перпендикулярно участку одной кнопкой');
  if (out) await p.screenshot({ path: pathResolve(out, 'inclined.png'), fullPage: true });

  // 14а. Трение и односторонние связи.
  await p.selectOption('#preset', 'incline');
  let frs = await p.innerText('#solution');
  check(frs.includes('3,268 ≤') && frs.includes('≤ 6,732') && frs.includes('готова скользить'), 'брус на наклонной плоскости: интервал силы и предельное скольжение', frs.slice(-300));
  await p.fill('.item[data-kind="sup"] [data-f="f"]', '0,6');
  await p.locator('.item[data-kind="sup"] [data-f="f"]').blur();
  frs = await p.innerText('#solution');
  check(frs.includes('−0,196 ≤') || frs.includes('−0,196'), 'при f = 0,6 брус держится и без силы: нижняя граница отрицательна', frs.slice(-200));
  await p.selectOption('#preset', 'crane');
  frs = await p.innerText('#solution');
  check(frs.includes('F ≤ 5,18') || frs.includes('≤ 5,18 кН'), 'кран 3.23: наибольший груз 5,18', frs.slice(-200));
  check(frs.includes('опрокинуться вокруг точки E'), 'кран: опрокидывание вокруг рельса');
  await p.click('[data-add="rough"]');
  check((await p.locator('.item[data-kind="sup"] [data-f="f"]').count()) === 1, 'палитра: опора с трением');
  await p.click('#undo');
  const [dl10] = await Promise.all([p.waitForEvent('download'), p.click('#fsave')]);
  const cr = JSON.parse(await (await dl10.createReadStream()).toArray().then((c) => Buffer.concat(c).toString('utf8')));
  check(cr.structure.items.filter((i: { oneSided?: boolean }) => i.oneSided).length === 2, 'в файле — односторонние связи');

  // 16. Вкладка «Пространственное тело».
  await tab('spacebody');
  let bs = await p.innerText('#bsolution');
  check(bs.includes('статически определимо') && bs.includes('T = 20 кН') && bs.includes('8,66'), 'Мещерский 8.24: натяжение и реакции', bs.slice(0, 200));
  await p.selectOption('#bpreset', 'm826');
  bs = await p.innerText('#bsolution');
  check(bs.includes('2,165') && bs.includes('−3,428'), 'Мещерский 8.26: реакция острия и подшипника', bs.slice(-300));
  await p.click('#bsups .del >> nth=2');
  check((await p.innerText('#bsolution')).includes('равновесие невозможно'), 'без острия пластинка поворачивается — равновесие невозможно');
  await p.click('.hist button[title^="Отменить"]');
  const [dl11] = await Promise.all([p.waitForEvent('download'), p.click('#fsave')]);
  const bText = await (await dl11.createReadStream()).toArray().then((c) => Buffer.concat(c).toString('utf8'));
  check(JSON.parse(bText).module === 'spacebody' && JSON.parse(bText).body.supports.length === 3, 'файл тела');
  const bSol = await p.innerText('#bsolution');
  await tab('frames');
  await openText('body.json', bText, 'ok');
  check((await p.getAttribute('[data-tab="spacebody"]', 'aria-selected')) === 'true' && (await p.innerText('#bsolution')) === bSol, 'файл тела открывается в своей вкладке без потерь');

  // 17. Вкладка «Центр тяжести».
  await tab('centroid');
  let gs = await p.innerText('#gsolution');
  check(gs.includes('= −0,07') || gs.includes('−0,07'), 'Мещерский 9.12: доска с отверстием', gs.slice(-200));
  await p.click('[data-cut="1"]');
  check((await p.innerText('#gsolution')).includes('= 0,055'), 'без отметки «вырез» квадрат добавляется: 0,49·0,5/4,49 = 0,055');
  await p.click('.hist button[title^="Отменить"]');
  await p.selectOption('#gpreset', 'm920');
  check((await p.innerText('#gsolution')).includes('= 8,8'), 'Мещерский 9.20: молоток, y = 8,8');
  await p.selectOption('#gmode', 'line');
  check((await p.locator('#gparts select[aria-label="Вид части"] option').count()) === 2, 'для линии — отрезок и дуга');
  await p.click('.hist button[title^="Отменить"]');
  const [dl12] = await Promise.all([p.waitForEvent('download'), p.click('#fsave')]);
  const gText = await (await dl12.createReadStream()).toArray().then((c) => Buffer.concat(c).toString('utf8'));
  check(JSON.parse(gText).module === 'centroid' && JSON.parse(gText).problem.mode === 'volume', 'файл задачи о центре тяжести');
  const gSol = await p.innerText('#gsolution');
  await tab('frames');
  await openText('cg.json', gText, 'ok');
  check((await p.getAttribute('[data-tab="centroid"]', 'aria-selected')) === 'true' && (await p.innerText('#gsolution')) === gSol, 'файл открывается в своей вкладке без потерь');

  // 18. Вкладка «Сходящиеся силы».
  await tab('converging');
  let vs = await p.innerText('#vsolution');
  check(vs.includes('866,025') && vs.includes('−500') && vs.includes('стержень сжат') && vs.includes('теореме Лами'), 'Мещерский 2.7: S_A = 866, S_B = −500', vs.slice(-300));
  await p.selectOption('#vpreset', 'm615');
  check((await p.innerText('#vsolution')).includes('−3,849') && (await p.innerText('#vsolution')).includes('три уравнения'), 'Мещерский 6.15: тренога, −3,85');
  await p.click('#vadd');
  check((await p.innerText('#vsolution')).includes('статически неопределима'), 'пятая сила — неопределима');
  await p.click('.hist button[title^="Отменить"]');
  await p.selectOption('#vpreset', 'm712');
  vs = await p.innerText('#vsolution');
  check(vs.includes('динамическому винту') && vs.includes('R = 15 кН') && vs.includes('x = 2,2') && vs.includes('y = 2'), 'Мещерский 7.12: динама, ось через (2,2; 2)', vs.slice(-300));
  await p.selectOption('#vpreset', 'plane');
  check((await p.innerText('#vsolution')).includes('приводится к равнодействующей'), 'плоская система — равнодействующая');
  await p.click('#vaddp');
  check((await p.locator('#vsys .cgpar').count()) === 6, 'добавлена пара');
  const [dl13] = await Promise.all([p.waitForEvent('download'), p.click('#fsave')]);
  const vText = await (await dl13.createReadStream()).toArray().then((c) => Buffer.concat(c).toString('utf8'));
  check(JSON.parse(vText).module === 'converging' && JSON.parse(vText).problem.reduce.pairs.length === 2, 'файл задачи о приведении');
  const vSol = await p.innerText('#vsolution');
  await tab('frames');
  await openText('cv.json', vText, 'ok');
  check((await p.getAttribute('[data-tab="converging"]', 'aria-selected')) === 'true' && (await p.innerText('#vsolution')) === vSol, 'файл сходящихся сил открывается в своей вкладке без потерь');
  await tab('frames');

  // 19. Вкладка «Геометрия масс».
  await tab('inertia');
  const inS = await p.innerText('#isolution');
  check(inS.includes('0,5417') && inS.includes('Гюйгенса'), 'Мещерский 34.21: (14m₁ + 99m₂)r²/6 = 0,5417', inS.slice(-300));
  await p.selectOption('#ipreset', 'm3420');
  check((await p.innerText('#isolution')).includes('101,9') && (await p.innerText('#isolution')).includes('P/g'), 'Мещерский 34.20: 102 кГ·м·с², массы из весов');
  await p.selectOption('#ipreset', 'm3419');
  check((await p.innerText('#isolution')).includes('ρ = 0,154'), 'Мещерский 34.19: ρ = 15,4 см');
  await p.click('#iadd');
  check((await p.locator('#iparts .cgrow').count()) === 2, 'добавлена часть');
  await p.click('[data-cut="1"]');
  check((await p.innerText('#isolution')).includes('проверьте данные'), 'вырез массивнее тела — сообщение об ошибке');
  await p.click('.hist button[title^="Отменить"]');
  const [dl14] = await Promise.all([p.waitForEvent('download'), p.click('#fsave')]);
  const inText = await (await dl14.createReadStream()).toArray().then((c) => Buffer.concat(c).toString('utf8'));
  check(JSON.parse(inText).module === 'inertia' && JSON.parse(inText).problem.parts.length === 2, 'файл задачи о моментах инерции');
  const iSol = await p.innerText('#isolution');
  await tab('frames');
  await openText('in.json', inText, 'ok');
  check((await p.getAttribute('[data-tab="inertia"]', 'aria-selected')) === 'true' && (await p.innerText('#isolution')) === iSol, 'файл геометрии масс открывается в своей вкладке без потерь');
  await tab('frames');

  // 20. Вкладка «Кинетическая энергия».
  await tab('energy');
  const enS = await p.innerText('#esolution');
  check(enS.includes('2,3055') && enS.includes('приведённая масса'), 'Мещерский 38.45: v по теореме об изменении кинетической энергии', enS.slice(-300));
  check(enS.includes('Натяжения нитей (принцип Даламбера)'), '38.45: натяжения нитей по принципу Даламбера');
  await p.selectOption('#epreset', 'm3823');
  check((await p.innerText('#esolution')).includes('пойдёт в обратную сторону'), '38.23: из покоя груз не поднимется — предупреждение');
  await p.selectOption('#epreset', 'm3813');
  check((await p.innerText('#esolution')).includes('109,8'), 'Мещерский 38.13: 109,8 оборота до остановки');
  await p.selectOption('#epreset', 'm3845');
  await p.selectOption('#emode', 's');
  await p.locator('#e-v1').fill('2,3055');
  await p.locator('#e-v1').blur();
  check((await p.innerText('#esolution')).includes('= 1 м'), 'обратная задача: путь до скорости 2,3055 — 1 м');
  await p.click('#eadd');
  check((await p.locator('#ebodies .cgrow').count()) === 4, 'добавлено тело');
  const [dl15] = await Promise.all([p.waitForEvent('download'), p.click('#fsave')]);
  const enText = await (await dl15.createReadStream()).toArray().then((c) => Buffer.concat(c).toString('utf8'));
  check(JSON.parse(enText).module === 'energy' && JSON.parse(enText).problem.bodies.length === 4, 'файл задачи о кинетической энергии');
  const enSol = await p.innerText('#esolution');
  await tab('frames');
  await openText('en.json', enText, 'ok');
  check((await p.getAttribute('[data-tab="energy"]', 'aria-selected')) === 'true' && (await p.innerText('#esolution')) === enSol, 'файл кинетической энергии открывается в своей вкладке без потерь');
  await tab('frames');

  // 21. Вкладка «Вращение тела».
  await tab('rotation');
  const rtS = await p.innerText('#rsolution');
  check(rtS.includes('Дифференциальное уравнение вращения') && rtS.includes('ω∞'), 'Мещерский 37.45: уравнение с вязким сопротивлением', rtS.slice(-300));
  await p.selectOption('#rpreset', 'm377');
  check((await p.innerText('#rsolution')).includes('66,5647'), 'Мещерский 37.7: время остановки 66,56 с');
  await p.selectOption('#rpreset', 'm3740');
  check((await p.innerText('#rsolution')).includes('период малых колебаний'), 'Мещерский 37.40: период малых колебаний');
  await p.selectOption('#rpreset', 'm3754');
  check((await p.innerText('#rsolution')).includes('100 об/мин'), 'Мещерский 37.54: скамейка Жуковского, 100 об/мин');
  await p.click('#raddpoint');
  check((await p.locator('#ritems .cvrow').count()) === 2, 'добавлена точка');
  const [dl16] = await Promise.all([p.waitForEvent('download'), p.click('#fsave')]);
  const rtText = await (await dl16.createReadStream()).toArray().then((c) => Buffer.concat(c).toString('utf8'));
  check(JSON.parse(rtText).module === 'rotation' && JSON.parse(rtText).problem.K.length === 2, 'файл задачи о вращении');
  const rtSol = await p.innerText('#rsolution');
  await tab('frames');
  await openText('rt.json', rtText, 'ok');
  check((await p.getAttribute('[data-tab="rotation"]', 'aria-selected')) === 'true' && (await p.innerText('#rsolution')) === rtSol, 'файл вращения открывается в своей вкладке без потерь');
  await tab('frames');

  // 22. Вкладка «Принцип Даламбера».
  await tab('dalembert');
  const daS = await p.innerText('#dsolution');
  check(daS.includes('Силы инерции, приведённые к центру O') && daS.includes('Уравнения кинетостатики'), 'Мещерский 42.7: силы инерции и кинетостатика', daS.slice(-300));
  await p.selectOption('#dpreset', 'm4211');
  check((await p.innerText('#dsolution')).includes('822,'), 'Мещерский 42.11: динамическое давление 822 кГ');
  await p.selectOption('#dgrav', 'none');
  check(!(await p.innerText('#dsolution')).includes('Сила тяжести'), 'без силы тяжести — только динамические реакции');
  await p.click('#dadd');
  check((await p.locator('#dparts .cgrow').count()) === 2, 'добавлена часть');
  const [dl17] = await Promise.all([p.waitForEvent('download'), p.click('#fsave')]);
  const daText = await (await dl17.createReadStream()).toArray().then((c) => Buffer.concat(c).toString('utf8'));
  check(JSON.parse(daText).module === 'dalembert' && JSON.parse(daText).problem.parts.length === 2, 'файл задачи о динамических реакциях');
  const daSol = await p.innerText('#dsolution');
  await tab('frames');
  await openText('da.json', daText, 'ok');
  check((await p.getAttribute('[data-tab="dalembert"]', 'aria-selected')) === 'true' && (await p.innerText('#dsolution')) === daSol, 'файл принципа Даламбера открывается в своей вкладке без потерь');
  await tab('frames');

  // 23. Вкладка «Динамика точки».
  await tab('pointdyn');
  const pdS = await p.innerText('#psolution');
  check(pdS.includes('19,5497') && pdS.includes('2,6066'), 'Мещерский 27.7: путь 19,55 м и время 2,61 с до остановки', pdS.slice(-300));
  await p.selectOption('#ppreset', 'm279');
  check((await p.innerText('#psolution')).includes('Предельная (установившаяся) скорость'), 'Мещерский 27.9: предельная скорость');
  await p.selectOption('#pask', 'x');
  await p.locator('#p-x1').fill('100');
  await p.locator('#p-x1').blur();
  check((await p.innerText('#psolution')).includes('до x = 100 м'), 'вопрос по пути');
  const [dl18] = await Promise.all([p.waitForEvent('download'), p.click('#fsave')]);
  const pdText = await (await dl18.createReadStream()).toArray().then((c) => Buffer.concat(c).toString('utf8'));
  check(JSON.parse(pdText).module === 'pointdyn' && JSON.parse(pdText).problem.line.ask === 'x', 'файл задачи динамики точки');
  const pdSol = await p.innerText('#psolution');
  await tab('frames');
  await openText('pd.json', pdText, 'ok');
  check((await p.getAttribute('[data-tab="pointdyn"]', 'aria-selected')) === 'true' && (await p.innerText('#psolution')) === pdSol, 'файл динамики точки открывается в своей вкладке без потерь');
  await p.selectOption('#ppreset', 'f2615');
  const fS = await p.innerText('#psolution');
  check(fS.includes('−50,3') && fS.includes('cos(1,5708t)'), 'Мещерский 26.15: производные формулами и сила −50,3 Н', fS.slice(0, 300));
  await p.locator('#pf-x').fill('10 sin(');
  check((await p.getAttribute('#pf-x', 'class'))?.includes('bad') === true, 'ошибка в формуле подсвечена');
  await p.locator('#pf-x').fill('5t^2');
  await p.locator('#pf-x').blur();
  check((await p.innerText('#psolution')).includes('10t'), 'новая формула: производная 10t');
  await p.selectOption('#ppreset', 'p2744');
  check((await p.innerText('#psolution')).includes('Высшая точка траектории'), 'Мещерский 27.44: траектория и высшая точка');
  await p.selectOption('#pmode', 'line');
  check((await p.locator('#pask').count()) === 1, 'переключение режима');
  await tab('frames');

  // 24. Вкладка «Центр масс и плоское движение».
  await tab('masscenter');
  const mcS = await p.innerText('#msolution');
  check(mcS.includes('3,27') && mcS.includes('без скольжения'), 'Мещерский 39.11: цилиндр катится, a = 2/3 g sin α', mcS.slice(-300));
  await p.selectOption('#mpreset', 'm3914');
  check((await p.innerText('#msolution')).includes('колесо скользит'), 'Мещерский 39.14: скольжение');
  await p.selectOption('#mpreset', 'm3520');
  check((await p.innerText('#msolution')).includes('0,0378'), 'Мещерский 35.20: клин сместится на 3,77 см');
  await p.selectOption('#mpreset', 'm357');
  check((await p.innerText('#msolution')).includes('180,96'), 'Мещерский 35.7: давление насоса на грунт');
  await p.click('#maddpt');
  check((await p.locator('#mpts .cvrow').count()) === 4, 'добавлена точка');
  const [dl19] = await Promise.all([p.waitForEvent('download'), p.click('#fsave')]);
  const mcText = await (await dl19.createReadStream()).toArray().then((c) => Buffer.concat(c).toString('utf8'));
  check(JSON.parse(mcText).module === 'masscenter' && JSON.parse(mcText).problem.points.pts.length === 4, 'файл задачи о центре масс');
  const mcSol = await p.innerText('#msolution');
  await tab('frames');
  await openText('mc.json', mcText, 'ok');
  check((await p.getAttribute('[data-tab="masscenter"]', 'aria-selected')) === 'true' && (await p.innerText('#msolution')) === mcSol, 'файл центра масс открывается в своей вкладке без потерь');
  await tab('frames');

  // 25. Вкладка «Кинематика точки».
  await tab('pointkin');
  const knS = await p.innerText('#ksolution');
  check(knS.includes('2,8284') && knS.includes('2t'), 'Мещерский 12.28: v = 2√2, производные формулами', knS.slice(0, 300));
  await p.selectOption('#kpreset', 'k1226');
  check((await p.innerText('#ksolution')).includes('2,125'), 'Мещерский 12.26: ρ = 2⅛');
  await p.selectOption('#kmode', 'polar');
  check((await p.locator('#k-phi').count()) === 1, 'полярный способ — поля r и φ');
  const [dl20] = await Promise.all([p.waitForEvent('download'), p.click('#fsave')]);
  const knText = await (await dl20.createReadStream()).toArray().then((c) => Buffer.concat(c).toString('utf8'));
  check(JSON.parse(knText).module === 'pointkin' && JSON.parse(knText).problem.mode === 'polar', 'файл кинематики точки');
  const knSol = await p.innerText('#ksolution');
  await tab('frames');
  await openText('kn.json', knText, 'ok');
  check((await p.getAttribute('[data-tab="pointkin"]', 'aria-selected')) === 'true' && (await p.innerText('#ksolution')) === knSol, 'файл кинематики точки открывается в своей вкладке без потерь');
  await tab('frames');

  // 26. Вкладка «Вращение и передачи».
  await tab('gears');
  const grS = await p.innerText('#gsolution');
  check(grS.includes('0,7854') && grS.includes('−0,25'), 'Мещерский 14.5: скорость рейки 7,85 мм/с, внешнее зацепление меняет знак', grS.slice(0, 300));
  await p.selectOption('#gpreset', 'g143');
  check((await p.innerText('#gsolution')).includes('t = 10'), 'Мещерский 14.3: 300 об/мин через 10 с');
  await p.click('#gaddw');
  check((await p.locator('#gwheels > div').count()) === 3 && (await p.innerText('#gsolution')).includes('Колёса 2 и 3') === false, 'колесо добавлено, передача решается');
  const [dl21] = await Promise.all([p.waitForEvent('download'), p.click('#fsave')]);
  const grText = await (await dl21.createReadStream()).toArray().then((c) => Buffer.concat(c).toString('utf8'));
  check(JSON.parse(grText).module === 'gears' && JSON.parse(grText).problem.wheels.length === 3, 'файл передачи');
  const grSol = await p.innerText('#gsolution');
  await tab('frames');
  await openText('gr.json', grText, 'ok');
  check((await p.getAttribute('[data-tab="gears"]', 'aria-selected')) === 'true' && (await p.innerText('#gsolution')) === grSol, 'файл передачи открывается в своей вкладке без потерь');
  await tab('frames');
  await tab('gears');
  await p.selectOption('#gpreset', 'g141');
  check((await p.innerText('#gsolution')).includes('диаметр 120'), 'Мещерский 14.1: D₂ = 120 мм — неизвестный размер колеса');
  await p.selectOption('#gpreset', 'u138');
  check((await p.innerText('#gsolution')).includes('t = 8 с'), 'Мещерский 13.8: остановка через 8 с');
  await p.click('#gu-k-t');
  check((await p.innerText('#gsolution')).includes('ровно три'), 'четыре известные величины — понятное сообщение');
  await p.selectOption('#gpreset', 'e148');
  const elS = await p.innerText('#gsolution');
  check(elS.includes('= 2π') && elS.includes('= 32π'), 'Мещерский 14.8: ω_min = 2π, ω_max = 32π', elS.slice(0, 400));
  await p.selectOption('#gpreset', 'f1410');
  check((await p.innerText('#gsolution')).includes('t = 10') && (await p.innerText('#gsolution')).includes('6,2832'), 'Мещерский 14.10: при d = r через 10 с ε = 2π');
  await p.selectOption('#gmode', 'ellipse');
  const [dl22] = await Promise.all([p.waitForEvent('download'), p.click('#fsave')]);
  const elText = await (await dl22.createReadStream()).toArray().then((c) => Buffer.concat(c).toString('utf8'));
  const elSol = await p.innerText('#gsolution');
  await tab('frames');
  await openText('el.json', elText, 'ok');
  check(JSON.parse(elText).problem.mode === 'ellipse' && (await p.innerText('#gsolution')) === elSol, 'файл эллиптических колёс открывается без потерь');
  await tab('frames');

  // 27. Вкладка «Плоский механизм».
  await tab('mechanism');
  const meS = await p.innerText('#msolution');
  check(meS.includes('565,6854') && meS.includes('= 2 рад/с'), 'Мещерский 18.12: ω_AB = 2, w_B = 565,6', meS.slice(0, 300));
  check((await p.locator('#msvg .mc-icr').count()) === 1, 'на чертеже — МЦС шатуна');
  await p.click('#mshow-a');
  check((await p.locator('#msvg .cv-r').count()) >= 2, 'переключение на ускорения');
  await p.selectOption('#mpreset', 'm1636');
  check((await p.innerText('#msolution')).includes('3,75'), 'Мещерский 16.36: ω_OB = 3,75 с⁻¹ (механизм Уатта)');
  await p.selectOption('#mpreset', 'm1615');
  await p.locator('#mpoints input[aria-label="Имя точки"]').nth(1).fill('K');
  await p.locator('#mpoints input[aria-label="Имя точки"]').nth(1).blur();
  const meK = await p.innerText('#msolution');
  check(meK.includes('Звено OA') && meK.includes('v') && !meK.includes('проверьте механизм'), 'переименование точки — механизм по-прежнему решается', meK.slice(0, 200));
  await p.click('#maddd-proj');
  check((await p.innerText('#msolution')).includes('противоречат'), 'лишнее ведущее — понятное сообщение');
  await p.click('.hist button[title^="Отменить"]');
  const [dl23] = await Promise.all([p.waitForEvent('download'), p.click('#fsave')]);
  const meText = await (await dl23.createReadStream()).toArray().then((c) => Buffer.concat(c).toString('utf8'));
  const meSol = await p.innerText('#msolution');
  check(JSON.parse(meText).module === 'mechanism' && JSON.parse(meText).problem.points[1].name === 'K', 'файл механизма');
  await tab('frames');
  await openText('me.json', meText, 'ok');
  check((await p.getAttribute('[data-tab="mechanism"]', 'aria-selected')) === 'true' && (await p.innerText('#msolution')) === meSol, 'файл механизма открывается в своей вкладке без потерь');
  await tab('frames');

  // 28. Вкладка «Сложное движение».
  await tab('relative');
  const rlS = await p.innerText('#rsolution');
  check(rlS.includes('35,5528') && rlS.includes('27,7128'), 'Мещерский 23.27: w = 35,56, кориолисово 27,71', rlS.slice(-400));
  check((await p.locator('#rsvg .rl-c').count()) === 0 && ((await p.textContent('#rsvg')) ?? '').includes('⊙'), 'кориолисово ускорение перпендикулярно чертежу — отмечено ⊙');
  await p.selectOption('#rpreset', 'r2314');
  check((await p.innerText('#rsolution')).includes('10,953'), 'Мещерский 23.14: w_ξ = 10,95');
  await p.selectOption('#rcarrier', 'trans');
  check((await p.innerText('#rsolution')).includes('кориолисово') && (await p.locator('#r-xe').count()) === 1, 'поступательное переносное движение — поля x(t), y(t)');
  const [dl24] = await Promise.all([p.waitForEvent('download'), p.click('#fsave')]);
  const rlText = await (await dl24.createReadStream()).toArray().then((c) => Buffer.concat(c).toString('utf8'));
  const rlSol = await p.innerText('#rsolution');
  check(JSON.parse(rlText).module === 'relative' && JSON.parse(rlText).problem.carrier === 'trans', 'файл сложного движения');
  await tab('frames');
  await openText('rl.json', rlText, 'ok');
  check((await p.getAttribute('[data-tab="relative"]', 'aria-selected')) === 'true' && (await p.innerText('#rsolution')) === rlSol, 'файл сложного движения открывается в своей вкладке без потерь');
  await tab('frames');

  // 29. Вкладка «Сосуды».
  await tab('vessels');
  const vsS = await p.innerText('#vsolution');
  check(vsS.includes('Схема по рисунку') && vsS.includes('6,3632 мм') && vsS.includes('принимаем 7 мм'), 'задача 4, рис. 1, строка 1: δ = 6,36 мм по III гипотезе', vsS.slice(-300));
  await p.selectOption('#vpreset', 'f4r10');
  check((await p.innerText('#vsolution')).includes('0,204') && (await p.locator('#va-H3').count()) === 1, 'рис. 4: давление газа по пьезометру 0,204 МПа');
  await p.selectOption('#vfig', '16');
  check((await p.innerText('#vsolution')).includes('давление p'), 'рис. 16 без давления — понятное сообщение');
  await p.selectOption('#vpreset', 'cylgas');
  check((await p.innerText('#vsolution')).includes('δ = 10 мм'), 'цилиндр под газом: δ = pr/[σ] = 10 мм');
  await p.click('#vadd-ell');
  check((await p.locator('#vsegs > div').count()) === 2 && !(await p.innerText('#vsolution')).includes('проверьте данные'), 'добавлено эллиптическое днище — сосуд решается');
  await p.selectOption('#vsupport', 'lugs');
  check((await p.locator('#v-zs').count()) === 1, 'опора на лапах — поле высоты лап');
  const [dl25] = await Promise.all([p.waitForEvent('download'), p.click('#fsave')]);
  const vsText = await (await dl25.createReadStream()).toArray().then((c) => Buffer.concat(c).toString('utf8'));
  const vsSol = await p.innerText('#vsolution');
  check(JSON.parse(vsText).module === 'vessels' && JSON.parse(vsText).problem.mode === 'custom' && JSON.parse(vsText).problem.custom.segs.length === 2, 'файл сосуда');
  await tab('frames');
  await openText('vs.json', vsText, 'ok');
  check((await p.getAttribute('[data-tab="vessels"]', 'aria-selected')) === 'true' && (await p.innerText('#vsolution')) === vsSol, 'файл сосуда открывается в своей вкладке без потерь');
  await tab('frames');

  // 30. Вкладка «Кручение».
  await tab('torsion');
  const trS = await p.innerText('#torsolution');
  check(trS.includes('65,6513 мм') && trS.includes('определяет жёсткость'), 'шкивы: d = 65,65 мм, определяет жёсткость', trS.slice(0, 300));
  await p.selectOption('#torpreset', 'ant72');
  const tr72 = await p.innerText('#torsolution');
  check(tr72.includes('участок I (AB)') && tr72.includes('= −1 кН·м') && tr72.includes('= 1 кН·м'), 'Антонов, рис. 7.2: M_z = −M и +M', tr72.slice(0, 400));
  await p.locator('#t-m0').fill('2');
  await p.locator('#t-m0').blur();
  check((await p.innerText('.sheet')).includes('уравновешиваться'), 'вал без заделок с неуравновешенными моментами — понятное сообщение');
  await p.click('.hist button[title^="Отменить"]');
  await p.selectOption('#torpreset', 'bothfixed');
  check((await p.innerText('#torsolution')).includes('статически неопределимый'), 'вал с двумя заделками — статически неопределимый');
  const [dl26] = await Promise.all([p.waitForEvent('download'), p.click('#fsave')]);
  const trText = await (await dl26.createReadStream()).toArray().then((c) => Buffer.concat(c).toString('utf8'));
  const trSol = await p.innerText('#torsolution');
  check(JSON.parse(trText).module === 'torsion' && JSON.parse(trText).shaft.supports === 'both', 'файл вала');
  await tab('frames');
  await openText('tr.json', trText, 'ok');
  check((await p.getAttribute('[data-tab="torsion"]', 'aria-selected')) === 'true' && (await p.innerText('#torsolution')) === trSol, 'файл вала открывается в своей вкладке без потерь');
  await tab('frames');

  // 31. Вкладка «Рамы: эпюры N, Q, M» (схема общая с «Балками и рамами»).
  await tab('framediag');
  await p.selectOption('#fdpreset', 'gframe');
  const fd = await p.innerText('#fdsolution');
  check(fd.includes('M(0) = 38 (растянуты волокна слева)') && fd.includes('M(2) = 50') && fd.includes('узел C') && fd.includes('= 30 (растянуты волокна сверху)'), 'Г-рама: M в заделке 50, в узле C 34 и 30, проверка узла', fd.slice(0, 400));
  check((await p.locator('.fd-canvas .fd-grid svg').count()) === 3 && (await p.locator('#fd-M .dg-line').count()) === 3, 'три эпюры, по линии на участок');
  const mSideX = () => p.evaluate(`[...document.querySelectorAll('#fd-M .dg-val')].find((t) => t.textContent === '50').getAttribute('x')`) as Promise<string>;
  const xc = +(await mSideX());
  await p.click('input[name="mSide"] >> nth=1');
  const xt = +(await mSideX());
  check(xt < xc, 'на растянутых волокнах эпюра M у стойки переходит на левую сторону', `${xc} → ${xt}`);
  await p.click('input[name="mSide"] >> nth=0');
  await p.selectOption('#fdpreset', 'inclined');
  const fdi = await p.innerText('#fdsolution');
  check(fdi.includes('Участок') && fdi.includes('ΣX = 0') && !fdi.includes('NaN'), 'рама с наклонным ригелем: решение и проверка узлов');
  await p.click('#fdedit');
  check((await p.getAttribute('[data-tab="frames"]', 'aria-selected')) === 'true' && (await p.inputValue('#preset')) === 'custom', '«Изменить схему» ведёт в «Балки и рамы» с той же рамой');
  await p.selectOption('#preset', 'indet');
  await tab('framediag');
  check((await p.innerText('.dg-empty')).includes('статически определимая'), 'неопределимая схема — понятное сообщение');
  await p.click('.hist button[title^="Отменить"]');
  check((await p.locator('.fd-canvas .fd-grid').count()) === 1, 'отмена возвращает раму');
  await tab('frames');

  // 32. Вкладка «Возможные перемещения» (схема общая с «Балками и рамами»).
  await tab('virtual');
  await p.selectOption('#vwpreset', 'm4619');
  const vw = await p.innerText('#vwsolution');
  check(vw.includes('= 10,5') && vw.includes('= −0,5') && vw.includes('совпадает ✓') && !vw.includes('не совпадает'), 'Мещерский 46.19: R_B = 10,5, R_D = −0,5, совпадает с уравнениями равновесия', vw.slice(0, 300));
  check((await p.locator('#vwfig .vw-center').count()) === 1, 'перемещение для Y_A: левая часть поворачивается вокруг шарнира C');
  await p.selectOption('#vwpreset', 'm4625');
  check((await p.innerText('#vwsolution')).includes('поворачивается вокруг точки D'), 'Мещерский 46.25: правая часть поворачивается вокруг угла рамы');
  await p.click('input[name="vw-pick"] >> nth=2');
  check((await p.locator('#vwfig .vw-delta').count()) === 1 && (await p.locator('#vwfig path.vw-delta').count()) === 1, 'для момента заделки — поворот сечения (дуга)');
  await p.selectOption('#vwpreset', 'm4620');
  check((await p.innerText('#vwsolution')).includes('Неизвестная нагрузка M'), 'Мещерский 46.20: неизвестная пара');
  await p.click('#vwedit');
  await p.selectOption('#preset', 'indet');
  await tab('virtual');
  check((await p.innerText('.dg-empty')).includes('статически определимая'), 'неопределимая схема — понятное сообщение');
  await p.click('.hist button[title^="Отменить"]');
  check((await p.locator('#vwfig').count()) === 1, 'отмена возвращает схему');
  await tab('frames');

  // 33. Вкладка «Уравнения Лагранжа».
  await tab('lagrange');
  await p.selectOption('#lgpreset', 'm4811');
  let lg = await p.innerText('#lgsolution');
  check(lg.includes('(l + r·φ)·φ̈ + r·φ̇² + g·sin φ = 0') && lg.includes('сокращаем на m·(l + r·φ)'), 'Мещерский 48.11: уравнение движения после сокращения', lg.slice(0, 400));
  await p.selectOption('#lgpreset', 'm4837');
  lg = await p.innerText('#lgsolution');
  check(lg.includes('cos φ·ẍ + l·φ̈ + g·sin φ = 0') && lg.includes('1,6379 с'), 'Мещерский 48.37–48.38: уравнения и период малых колебаний', lg.slice(0, 400));
  check((await p.locator('#lgplot .rt-line').count()) === 3, 'графики x(t), φ(t) и интеграла энергии');
  await p.locator('#lg-T').fill("(m1 + m2) x'^2/2 + k");
  check((await p.getAttribute('#lg-T', 'class'))?.includes('bad') === true && (await p.innerText('.panel.conv')).includes('неизвестное обозначение «k»'), 'неизвестное обозначение в T подсвечивается');
  await p.locator('#lg-T').blur();
  await p.click('#lgaddp');
  await p.locator('#lg-pn4').fill('k');
  await p.locator('#lg-pn4').blur();
  await p.locator('#lg-T').fill("(m1 + m2) x'^2/2 + m2 l x' φ' cos φ + m2 l^2 φ'^2/2");
  await p.locator('#lg-T').blur();
  await p.locator('#lg-q1').fill("−k φ'");
  await p.locator('#lg-q1').blur();
  lg = await p.innerText('#lgsolution');
  check(lg.includes('механическая энергия не сохраняется') && lg.includes('k·φ̇'), 'непотенциальная сила сопротивления входит в уравнение', lg.slice(0, 300));
  check((await p.locator('#lgplot .rt-line').count()) === 2, 'без интеграла энергии — только графики координат');
  const [dl33] = await Promise.all([p.waitForEvent('download'), p.click('#fsave')]);
  const lgText = await (await dl33.createReadStream()).toArray().then((c) => Buffer.concat(c).toString('utf8'));
  const lgSol = await p.innerText('#lgsolution');
  check(JSON.parse(lgText).module === 'lagrange' && JSON.parse(lgText).problem.coords[1].Q.includes('k'), 'файл задачи Лагранжа');
  await tab('frames');
  await openText('lg.json', lgText, 'ok');
  check((await p.getAttribute('[data-tab="lagrange"]', 'aria-selected')) === 'true' && (await p.innerText('#lgsolution')) === lgSol, 'файл задачи Лагранжа открывается в своей вкладке без потерь');
  await tab('frames');

  // 34. Навигация и «Задачник».
  await tab('tasks');
  check((await p.getAttribute('[data-tab="tasks"]', 'aria-current')) === 'true' && (await p.locator('.tk-book').count()) === 3, '«Задачник»: Мещерский, Антонов, примеры приложения');
  const allTasks = await p.locator('.tk-item').count();
  check(allTasks > 250 && (await p.locator('.filebar').count()) === 0, 'в «Задачнике» все готовые задачи, кнопок файлов нет', String(allTasks));
  await p.fill('#tksearch', '46.19');
  check((await p.locator('.tk-item').count()) === 1, 'поиск по номеру задачи');
  await p.click('[data-task="virtual:m4619"]');
  check((await p.getAttribute('[data-tab="virtual"]', 'aria-selected')) === 'true' && (await p.inputValue('#vwpreset')) === 'm4619' && (await p.innerText('#vwsolution')).includes('= 10,5'), 'задача из «Задачника» открывается в своём разделе');
  await tab('tasks');
  await p.fill('#tksearch', 'конец оттянут тросом');
  await p.click('[data-task="frames:tb:3.7"]');
  check((await p.getAttribute('[data-tab="frames"]', 'aria-selected')) === 'true' && (await p.inputValue('#preset')) === 'tb:3.7', 'задача Мещерского 3.7 открывается в «Балках и рамах»');
  check((await p.textContent('.notice'))!.includes('Ответ задачника: R_B = 300; R_E = 400') && (await p.innerText('#solution')).includes('300'), 'при загрузке задачи из книги показан ответ задачника');
  const groups = await p.locator('#preset optgroup').evaluateAll((els) => els.map((e) => e.getAttribute('label')));
  check(groups[0]!.startsWith('Мещерский, § 3.') && groups.some((g) => g!.startsWith('Мещерский, § 4.')) && groups[groups.length - 1] === 'Другие примеры', 'список «Готовая задача» сгруппирован: Мещерский по параграфам, затем примеры', groups.join(' | '));
  await tab('tasks');
  await p.fill('#tksearch', '');
  await p.click('[data-book="ant"]');
  check((await p.locator('.tk-book').count()) === 1 && (await p.locator('.tk-item').count()) >= 15, 'фильтр по книге: только Антонов');
  await p.click('[data-book="all"]');
  await tab('vessels');
  const vg = await p.locator('#vpreset optgroup').evaluateAll((els) => els.map((e) => e.getAttribute('label')));
  check(vg[0] === 'Антонов, Задача 4. Тонкостенные сосуды' && vg[1] === 'Другие примеры', 'в «Сосудах» — задачи Антонова отдельно от примеров', vg.join(' | '));
  // Блок помнит последний раздел.
  await tab('rotation');
  await p.click('[data-block="statics"]');
  await p.click('[data-block="dynamics"]');
  check((await p.getAttribute('[data-tab="rotation"]', 'aria-selected')) === 'true', 'блок возвращает в последний открытый раздел');
  // Узкий экран: меню-оглавление.
  await p.setViewportSize({ width: 390, height: 800 });
  check(await p.isVisible('.nav-menu'), 'на узком экране — кнопка меню');
  await p.click('.nav-menu');
  check((await p.locator('.nav-sheet [data-go]').count()) === 27, 'в меню все разделы, «Задачник» и «Дорожная карта»');
  await p.click('.nav-sheet [data-go="torsion"]');
  check((await p.getAttribute('[data-tab="torsion"]', 'aria-selected')) === 'true' && (await p.locator('.nav-sheet').count()) === 0, 'выбор в меню открывает раздел и закрывает меню');
  await p.setViewportSize({ width: 1280, height: 1000 });
  await tab('frames');

  // 15. Вкладка «Фермы».
  await tab('truss');
  let ts = await p.innerText('#tsolution');
  check(ts.includes('ферма статически определима') && ts.includes('1,299') && ts.includes('−3,5') && ts.includes('совпадает с вырезанием узлов'), 'Мещерский 5.7: усилия и проверка Риттера', ts.slice(0, 200));
  check((await p.locator('#tsvg .tb-ten').count()) === 3 && (await p.locator('#tsvg .tb-comp').count()) === 4, 'растянутые и сжатые стержни на чертеже');
  await p.selectOption('#tpreset', 'm511');
  ts = await p.innerText('#tsolution');
  check(!ts.includes('Нулевые стержни') && ts.includes('не нагружен') && ts.includes('−2,6'), 'Мещерский 5.11: стержень 7 не нагружен (по расчёту, не по признакам)', ts.slice(0, 200));
  await p.click('#taddbar');
  check((await p.innerText('#tsolution')).includes('статически неопределима'), 'лишний стержень — неопределима');
  await p.click('#tbars .trow:last-child .del');
  await p.locator('#tnodes .trow:nth-child(4) input').first().fill('6');
  await p.locator('#tnodes .trow:nth-child(4) input').first().blur();
  check((await p.innerText('#tsolution')).includes('ферма статически определима'), 'узел сдвинут — ферма по-прежнему решается');
  await p.click('.hist button[title^="Отменить"]');
  check((await p.inputValue('#tnodes .trow:nth-child(4) input >> nth=0')) === '5', 'отмена возвращает координату');
  const [dl9] = await Promise.all([p.waitForEvent('download'), p.click('#fsave')]);
  const tText = await (await dl9.createReadStream()).toArray().then((c) => Buffer.concat(c).toString('utf8'));
  check(JSON.parse(tText).module === 'truss' && JSON.parse(tText).truss.bars.length === 9, 'файл фермы');
  const tSol = await p.innerText('#tsolution');
  await tab('frames');
  await openText('truss.json', tText, 'ok');
  check((await p.getAttribute('[data-tab="truss"]', 'aria-selected')) === 'true' && (await p.innerText('#tsolution')) === tSol, 'файл фермы открывается в своей вкладке без потерь');
  await p.emulateMedia({ media: 'print' });
  const trep = (await p.evaluate(`(() => { const r = document.querySelector('.print-report'); return { text: r.innerText, svgs: r.querySelectorAll('svg').length }; })()`)) as { text: string; svgs: number };
  check(trep.svgs === 1 && trep.text.includes('Метод вырезания узлов'), 'отчёт по ферме');
  await p.emulateMedia({ media: 'screen' });
  if (out) await p.screenshot({ path: pathResolve(out, 'truss.png'), fullPage: true });

  await browser.close();
  await new Promise<void>((r) => server.httpServer.close(() => r()));
  if (errors.length) console.log('Ошибки на странице:', errors);
  console.log(fails || errors.length ? `Провалено проверок: ${fails}` : 'Все проверки пройдены.');
  process.exitCode = fails || errors.length ? 1 : 0;
}

main();
