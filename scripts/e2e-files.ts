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
      .filter((e) => e.offsetParent !== null && e.id !== 'asFrom' && e.id !== 'bodyFrom' && !(e.dataset.f in { at: 1, from: 1, to: 1 }) && !('linka' in e.dataset || 'linkb' in e.dataset || 'addvia' in e.dataset))
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
  check(new Set(seen).size === 36 && seen.length === 36, 'тридцать шесть разделов, каждый — в одном блоке', seen.join(' '));
  await tab('frames');
  check((await p.evaluate(`getComputedStyle(document.querySelector('.nav')).position`)) === 'sticky', 'навигация прилипает к верху страницы');
  const beforeMap = JSON.stringify(await state(p));
  await tab('roadmap');
  check((await p.locator('.rm-block').count()) === 5, 'дорожная карта: статика, динамика, кинематика, аналитическая механика, сопромат');
  check((await p.locator('.rm-done').count()) === 39, 'готово тридцать девять пунктов');
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
  as = await p.innerText('#asolution');
  check(as.includes('Площадь из условия прочности (с нагревом)') && as.includes('A ≥ 857,14/139,286 = 6,154 см²'), 'нагрев с двумя заделками: площадь из условия прочности 6,154 см²', as.slice(0, 400));
  await p.click('.hist button[title^="Отменить"]');
  await p.click('input[name="a-heat"] >> nth=0');
  check((await p.locator('#a-t0').count()) === 0 && (await p.locator('#a-alpha').count()) === 0 && (await p.innerText('#asolution')).includes('−85,714'), 'нагрев выключен: ΔT и α скрыты и не учитываются');
  await p.click('.hist button[title^="Отменить"]');
  check((await p.locator('#a-t0').count()) === 1 && (await p.innerText('#asolution')).includes('−92,861'), 'нагрев снова включён — значения ΔT сохранились');
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
  await p.selectOption('#bpreset', 'shaft');
  bs = await p.innerText('#bsolution');
  check(bs.includes('T = 2·t = 2') && (await p.inputValue('#b-link0')) === '1' && (await p.inputValue('#b-k0')) === '2', 'связанные силы: натяжение ветви ремня T = 2t', bs.slice(0, 300));
  // t неизвестна, P = 1 задана: (T − t)·0,2 = P·0,1 ⇒ t = 0,5, T = 1.
  await p.click('#bforces .sbload >> nth=1 >> input[type="checkbox"]');
  await p.click('#bforces .sbload >> nth=2 >> input[type="checkbox"]');
  bs = await p.innerText('#bsolution');
  check(bs.includes('связана с неизвестной') && bs.includes('t = 0,5 кН') && bs.includes('T = 2·t = 1 кН'), 'ведущая сила неизвестна: T входит через t', bs.slice(-400));
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
  await p.selectOption('#dpreset', 'yd17');
  const d17 = await p.innerText('#dsolution');
  check(d17.includes('7,8431') && d17.includes('15,6863') && d17.includes('−65,8084') && (await p.inputValue('#ddrive')) === 'couple', 'Яблонский, Д.17: ε = M/J_z, ω = ετ, реакции', d17.slice(0, 300));
  await p.selectOption('#ddrive', 'given');
  check((await p.locator('#d-omega').count()) === 1 && (await p.locator('#d-M').count()) === 0, 'вращение: обратно к заданным ω и ε');
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
  await p.selectOption('#ppreset', 'm2740');
  const p40 = await p.innerText('#psolution');
  check(p40.includes('2,4514') && p40.includes('−2v²/(3 + x)') && (await p.inputValue('#p-form')) === '-2v^2/(3 + x)', 'Мещерский 27.40: сила-формула F(t, x, v), путь 2,4514 м', p40.slice(0, 300));
  await p.locator('#p-form').fill('-2v^2/(3 + y)');
  check((await p.getAttribute('#p-form', 'class'))?.includes('bad') === true, 'неизвестная переменная в формуле силы подсвечена');
  await p.locator('#p-form').fill('-v');
  await p.locator('#p-form').blur();
  check((await p.innerText('#psolution')).includes('F(t, x, v) = −v'), 'новая сила-формула применена');
  await p.selectOption('#ppreset', 'yd2');
  check((await p.innerText('#psolution')).includes('−4x − 2vx') && (await p.inputValue('#pp-formY')) === '-4y - 2vy', 'Яблонский, Д.2: составляющие силы формулами');
  await p.selectOption('#ppreset', 'p2744');
  check((await p.innerText('#psolution')).includes('Высшая точка траектории'), 'Мещерский 27.44: траектория и высшая точка');
  await p.selectOption('#ppreset', 'c311');
  const c311 = await p.innerText('#psolution');
  check((await p.inputValue('#pmode')) === 'circle' && c311.includes('2,8991') && c311.includes('0,4748'), 'Мещерский 31.1: натяжение 2,9 кГ и подъём 47,5 см', c311.slice(-300));
  await p.selectOption('#pcask', 'full');
  check((await p.innerText('#psolution')).includes('4,4294'), 'Мещерский 31.2: наименьшая v₀ для полного оборота');
  await p.selectOption('#ppreset', 'c3122');
  check((await p.innerText('#psolution')).includes('42,7245° от верхней точки'), 'Мещерский 31.22: камень сходит с купола');
  await p.selectOption('#ppreset', 'c3115');
  check((await p.innerText('#psolution')).includes('N = −7 кГ'), 'Мещерский 31.15: давление 7 кГ вверх');
  await p.click('#pcspring');
  check(!(await p.innerText('#psolution')).includes('пружина от точки') && (await p.locator('#pc-c').count()) === 0, 'пружина снята');
  const [dlc] = await Promise.all([p.waitForEvent('download'), p.click('#fsave')]);
  const pcText = await (await dlc.createReadStream()).toArray().then((c) => Buffer.concat(c).toString('utf8'));
  check(JSON.parse(pcText).problem.mode === 'circle' && JSON.parse(pcText).problem.circle.spring === false, 'файл задачи о движении по окружности');
  const pcSol = await p.innerText('#psolution');
  await tab('frames');
  await openText('pc.json', pcText, 'ok');
  check((await p.innerText('#psolution')) === pcSol, 'файл движения по окружности открывается без потерь');
  await p.selectOption('#ppreset', 'yd4');
  const rl = await p.innerText('#psolution');
  check((await p.inputValue('#pmode')) === 'rel' && rl.includes('0,2466') && rl.includes('0,1064'), 'Яблонский, Д.4: x₁ = 0,2466 м, давление на стенку 0,1064 Н', rl.slice(-300));
  await p.selectOption('#ppreset', 'm3313');
  check((await p.innerText('#psolution')).includes('0,1748'), 'Мещерский 33.13: кольцо сходит со стержня через 0,175 с');
  await p.selectOption('#prframe', 'trans');
  await p.locator('#pr-y1').fill('0,1 cos(πt)');
  await p.locator('#pr-y1').blur();
  check((await p.innerText('#psolution')).includes('тело движется поступательно'), 'поступательное переносное движение по закону');
  const [dlr] = await Promise.all([p.waitForEvent('download'), p.click('#fsave')]);
  const prText = await (await dlr.createReadStream()).toArray().then((c) => Buffer.concat(c).toString('utf8'));
  check(JSON.parse(prText).problem.mode === 'rel' && JSON.parse(prText).problem.rel.y1 === '0,1 cos(πt)', 'файл задачи об относительном движении');
  const prSol = await p.innerText('#psolution');
  await tab('frames');
  await openText('pr.json', prText, 'ok');
  check((await p.innerText('#psolution')) === prSol, 'файл относительного движения открывается без потерь');
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

  // Вкладка «Удар».
  await tab('impact');
  const imS = await p.innerText('#impsolution');
  check(imS.includes('2,0298') && imS.includes('2,0785'), 'Мещерский 44.10: косой удар шаров', imS.slice(-300));
  await p.selectOption('#imppreset', 'm4422');
  check((await p.innerText('#impsolution')).includes('865,9175') && (await p.innerText('#impsolution')).includes('выполняется'), 'Мещерский 44.22: скорость снаряда по углу отклонения, теорема Карно');
  await p.selectOption('#imppreset', 'm4424');
  check((await p.innerText('#impsolution')).includes('7,6007'), 'Мещерский 44.24: наименьшая скорость шара (1/3)√(53ga)');
  await p.selectOption('#imppreset', 'yd13');
  check((await p.innerText('#impsolution')).includes('1208,1266'), 'Яблонский, Д.13: ударный импульс ступеньки 1208 Н·с');
  await p.selectOption('#impcontact', 'smooth');
  check((await p.innerText('#impsolution')).includes('контакт гладкий'), 'гладкий контакт');
  await p.selectOption('#imp2-kind', 'axis');
  check((await p.locator('#imp2-ox').count()) === 1 && (await p.locator('#imp2-inertia').count()) === 1, 'тело 2 на оси — поля оси и момента инерции');
  const [dlim] = await Promise.all([p.waitForEvent('download'), p.click('#fsave')]);
  const imText = await (await dlim.createReadStream()).toArray().then((c) => Buffer.concat(c).toString('utf8'));
  check(JSON.parse(imText).module === 'impact' && JSON.parse(imText).problem.b2.kind === 'axis', 'файл задачи об ударе');
  const imSol = await p.innerText('#impsolution');
  await tab('frames');
  await openText('im.json', imText, 'ok');
  check((await p.getAttribute('[data-tab="impact"]', 'aria-selected')) === 'true' && (await p.innerText('#impsolution')) === imSol, 'файл удара открывается в своей вкладке без потерь');
  await tab('frames');

  // Вкладка «Переменная масса».
  await tab('varmass');
  const vmS = await p.innerText('#vmsolution');
  check(vmS.includes('5651,0078') && vmS.includes('Циолковского'), 'Мещерский 45.3: высота ракеты через 30 с — 5,65 км', vmS.slice(-300));
  await p.selectOption('#vmpreset', 'm455');
  check((await p.innerText('#vmsolution')).includes('1744862,3853'), 'Мещерский 45.5: наибольшая высота после сгорания топлива');
  await p.selectOption('#vmpreset', 'm4521');
  check((await p.innerText('#vmsolution')).includes('118,796'), 'Мещерский 45.21: время пробега обледеневающего самолёта');
  await p.selectOption('#vmpreset', 'm4539');
  const vm39 = await p.innerText('#vmsolution');
  check(vm39.includes('3,1219') && vm39.includes('15166,2283'), 'Мещерский 45.39: наименьший стартовый вес двухступенчатой ракеты', vm39.slice(-300));
  await p.click('#vmaddst');
  check((await p.locator('#vmstages .cvrow').count()) === 3, 'добавлена ступень');
  const [dlvm] = await Promise.all([p.waitForEvent('download'), p.click('#fsave')]);
  const vmText = await (await dlvm.createReadStream()).toArray().then((c) => Buffer.concat(c).toString('utf8'));
  check(JSON.parse(vmText).module === 'varmass' && JSON.parse(vmText).problem.stages.stages.length === 3, 'файл задачи о переменной массе');
  const vmSol = await p.innerText('#vmsolution');
  await tab('frames');
  await openText('vm.json', vmText, 'ok');
  check((await p.getAttribute('[data-tab="varmass"]', 'aria-selected')) === 'true' && (await p.innerText('#vmsolution')) === vmSol, 'файл переменной массы открывается в своей вкладке без потерь');
  await tab('frames');

  // Вкладка «Тяготение и орбиты».
  await tab('orbit');
  const obS = await p.innerText('#orbsolution');
  check(obS.includes('52789') && obS.includes('e = 0,064474') && obS.includes('97,86 мин'), 'Мещерский 50.22–50.23: интеграл площадей, эксцентриситет и период', obS.slice(-300));
  await p.selectOption('#orbpreset', 'm5038');
  check((await p.innerText('#orbsolution')).includes('u = 2,9502'), 'Мещерский 50.38: касательный импульс для перелёта к орбите Марса');
  await p.selectOption('#orbpreset', 'm3027');
  check((await p.innerText('#orbsolution')).includes('v₀ = 10,733'), 'Мещерский 30.27: скорость снаряда до точки равного притяжения');
  await p.selectOption('#orbpreset', 'm5107');
  check((await p.innerText('#orbsolution')).includes('высота 308,23'), 'Мещерский 51.7: высота включения тормозного двигателя');
  await p.selectOption('#orbmode', 'planet');
  await p.selectOption('#orbbody', 'mars');
  check((await p.innerText('#orbsolution')).includes('v₁ = 3,535') && (await p.locator('#orbsvg circle').count()) > 0, 'небесное тело: космические скорости Марса');
  const [dlob] = await Promise.all([p.waitForEvent('download'), p.click('#fsave')]);
  const obText = await (await dlob.createReadStream()).toArray().then((c) => Buffer.concat(c).toString('utf8'));
  check(JSON.parse(obText).module === 'orbit' && JSON.parse(obText).problem.planet.body === 'mars', 'файл задачи о тяготении');
  const obSol = await p.innerText('#orbsolution');
  await tab('frames');
  await openText('ob.json', obText, 'ok');
  check((await p.getAttribute('[data-tab="orbit"]', 'aria-selected')) === 'true' && (await p.innerText('#orbsolution')) === obSol, 'файл тяготения открывается в своей вкладке без потерь');
  await tab('frames');

  // Вкладка «Колебания систем».
  await tab('vibration');
  let vb = await p.innerText('#vbsolution');
  check(vb.includes('k₂ = 14,007 рад/с') && vb.includes('x₂ = 0,016667 − 0,016667·cos 24,261t'), 'Мещерский 54.44–54.45: частоты и движение вагонов', vb.slice(-400));
  check((await p.locator('#vbsvg .vb-mode-l').count()) === 3 && (await p.locator('#vbsvg .rt-line').count()) >= 3, 'формы главных колебаний и графики движения');
  await p.selectOption('#vbpreset', 'm5429');
  vb = await p.innerText('#vbsolution');
  check(vb.includes('δ₁₁ = 4/243·L³/(EJ)') && vb.includes('k₂ = 22,045 рад/с'), 'Мещерский 54.29: коэффициенты влияния и частоты балки', vb.slice(0, 400));
  await p.click('#vbaddm');
  check((await p.locator('#vbmasses .vb-item').count()) === 3 && (await p.innerText('#vbsolution')).includes('k₃'), 'добавлен груз — третья частота');
  await p.selectOption('#vbpreset', 'm5437');
  vb = await p.innerText('#vbsolution');
  check(vb.includes('c₂ = H/A = 10/0,002 = 5000') && vb.includes('гашение колебаний'), 'Мещерский 54.37: гаситель — масса и жёсткость, амплитуда фундамента нулевая', vb.slice(0, 400));
  await p.selectOption('#vbpreset', 'm5438');
  check((await p.innerText('#vbsolution')).includes('φ₁ = −0,014737·sin 15t'), 'Мещерский 54.38: вынужденные колебания дисков');
  await p.selectOption('#vbpreset', 'y26');
  vb = await p.innerText('#vbsolution');
  check(
    vb.includes('F₀ = δ/(hᵀC⁻¹h) = 16,8') && vb.includes('z = 0,014·cos 89,443t') && (await p.inputValue('#vbforce')) === 'harmcos',
    'Яблонский, Д.26: амплитуда момента по статическому повороту, антирезонанс',
    vb.slice(-400),
  );
  await p.selectOption('#vbpreset', 'y26r1');
  check((await p.innerText('#vbsolution')).includes('z = −0,16788·t sin 66,452t + 0,0034571·cos 66,452t'), 'Яблонский, Д.26: резонанс — вековой член');
  await p.selectOption('#vbpreset', 'm5420');
  vb = await p.innerText('#vbsolution');
  check(vb.includes('k⁴ − 16,715·k² + 34,403 = 0') && vb.includes('ε₂ = −90°'), 'Мещерский 54.20: гироскопические силы', vb.slice(0, 400));
  await p.selectOption('#vbpreset', 'm5436');
  check((await p.innerText('#vbsolution')).includes('k₁ = 0,49662') && (await p.locator('#vbmasses .vb-item').count()) === 1, 'Мещерский 54.36: груз на стойке');
  await p.selectOption('#vbpreset', 'm5448');
  check((await p.innerText('#vbsolution')).includes('в полосе пропускания'), 'Мещерский 54.48: фильтр крутильных колебаний');
  await p.selectOption('#vbpreset', 'm549');
  check((await p.innerText('#vbsolution')).includes('A₂ = 1,18'), 'Мещерский 54.9: формы главных колебаний по T и Π');
  await p.fill('#vb-ceq0', '0,3');
  await p.locator('#vb-ceq0').blur();
  check((await p.innerText('#vbsolution')).includes('не положение равновесия'), 'q* — не равновесие: сообщение');
  await p.click('#vbaddq');
  check((await p.locator('#vbcoords .vb-item').count()) === 3, 'добавлена координата');
  await p.selectOption('#vbpreset', 'm542');
  await p.click('#vbaddb');
  check((await p.locator('#vbbodies .vb-item').count()) === 3 && (await p.innerText('#vbsolution')).includes('k₃'), 'в цепочку добавлен диск');
  const [dlvb] = await Promise.all([p.waitForEvent('download'), p.click('#fsave')]);
  const vbText = await (await dlvb.createReadStream()).toArray().then((c) => Buffer.concat(c).toString('utf8'));
  check(JSON.parse(vbText).module === 'vibration' && JSON.parse(vbText).problem.chain.bodies.length === 3, 'файл задачи о колебаниях');
  const vbSol = await p.innerText('#vbsolution');
  await tab('frames');
  await openText('vb.json', vbText, 'ok');
  check((await p.getAttribute('[data-tab="vibration"]', 'aria-selected')) === 'true' && (await p.innerText('#vbsolution')) === vbSol, 'файл колебаний открывается в своей вкладке без потерь');
  await tab('frames');

  // Контакт тел («Балки и рамы»): несколько тел, касания, нити через блоки, перебор случаев.
  await p.selectOption('#preset', 'tb:3.35');
  const ctS = await p.innerText('#solution');
  check(
    ctS.includes('Расчленяем систему на тела') && ctS.includes('= 160') && ctS.includes('= 400') && ctS.includes('Проверяем односторонние связи'),
    'Мещерский 3.35: балка опирается на балку, давление 160, опора 400',
    ctS.slice(0, 300),
  );
  check((await p.locator('#svg .icontact').count()) === 1 && (await p.textContent('.notice'))!.includes('R_B = 160'), 'на схеме — касание, показан ответ задачника');
  const [dlct] = await Promise.all([p.waitForEvent('download'), p.click('#fsave')]);
  const ctText = await (await dlct.createReadStream()).toArray().then((c) => Buffer.concat(c).toString('utf8'));
  const ctJ = JSON.parse(ctText).structure;
  check(ctJ.links?.[0]?.type === 'contact' && ctJ.nodes.some((n: { place?: unknown }) => n.place), 'в файле — второе тело и касание');
  await p.selectOption('#preset', 'simple');
  await openText('contact.json', ctText, 'ok');
  check((await p.innerText('#solution')) === ctS, 'схема с двумя телами сохраняется и открывается без потерь');
  await p.selectOption('#bodyFrom', { index: 0 });
  await p.fill('#bodyDx', '0');
  await p.fill('#bodyDy', '0');
  const nLinks = await p.locator('.linkcard').count();
  await p.click('#bodyGo');
  check((await p.locator('[data-body]').count()) === 2 && (await p.locator('.linkcard').count()) === nLinks + 1, 'новое тело в точке — сразу с касанием');
  await p.click('[data-addlink="thread"]');
  check((await p.locator('.linkcard').count()) === nLinks + 2 && (await p.locator('#svg polyline.thread').count()) === 1, 'нить между телами');
  await p.click('#undo');
  await p.click('#undo');
  check((await p.innerText('#solution')) === ctS, 'отмена возвращает схему');
  await tab('virtual');
  check((await p.innerText('.dg-empty')).includes('только во вкладке «Балки и рамы»'), '«Возможные перемещения» объясняют, что несколько тел здесь не считаются');
  await tab('frames');
  await p.selectOption('#preset', 'yb:С.9');
  const c9 = await p.innerText('#solution');
  check(c9.includes('Случай 1') && c9.includes('предположение неверно') && c9.includes('Случай 2') && c9.includes('9,949'), 'Яблонский С.9: перебор случаев, работает связь F', c9.slice(-400));
  await p.selectOption('#preset', 'tb:2.66');
  const c266 = await p.innerText('#solution');
  check(c266.includes('98,038') && c266.includes('101,962') && c266.includes('трение между телами'), 'Мещерский 2.66: тело на теле, интервал силы 98…102');
  await p.selectOption('#preset', 'yb:С.5а');
  check((await p.innerText('#solution')).includes('94,281') && (await p.locator('#svg .pulley').count()) === 1, 'Яблонский С.5: тормоз, нить через блок, P_min = 94,3');
  if (out) await p.screenshot({ path: pathResolve(out, 'contact.png'), fullPage: true });

  // Вкладка «Неподвижная точка».
  await tab('fixedpoint');
  const fpS = await p.innerText('#fpsolution');
  check(fpS.includes('25,1327') && fpS.includes('Аксоиды') && fpS.includes('3158,2734'), 'Мещерский 19.5–19.6: конус обегает неподвижный конус — ω = 8π, аксоиды, ускорение точки C', fpS.slice(-300));
  await p.selectOption('#fppreset', 'm2512');
  const fp12 = await p.innerText('#fpsolution');
  check(fp12.includes('кривошип IV = 4 с⁻¹') && fp12.includes('|v| = 28 см/с'), 'Мещерский 25.12: дифференциал — угловая скорость кривошипа и скорость точки A', fp12.slice(-300));
  check((await p.locator('#fpsvg .fp-inst').count()) === 1 && (await p.locator('#fpsvg .fp-cone').count()) >= 3, 'схема: мгновенная ось сателлита и конусы колёс');
  await p.selectOption('#fppreset', 'm2015');
  check((await p.innerText('#fpsolution')).includes('|ω| = 3,4641'), 'Мещерский 20.15: углы Эйлера — ω = 2√3');
  await p.selectOption('#fppreset', 'm2529');
  check((await p.innerText('#fpsolution')).includes('поступательное со скоростью v = (x: −12; y: 12; z: −8)'), 'Мещерский 25.29: четыре вращения куба — поступательное движение');
  await p.selectOption('#fppreset', 'm2517');
  check((await p.innerText('#fpsolution')).includes('210,3426'), 'Мещерский 25.17: ускорение точки сателлита');
  const nb = await p.locator('#fpbodies > div').count();
  await p.click('#fp-addbody');
  check((await p.locator('#fpbodies > div').count()) === nb + 1 && (await p.innerText('#fpsolution')).includes('Не хватает условий'), 'новое звено без условий — сообщение «не хватает условий»');
  const [dlfp] = await Promise.all([p.waitForEvent('download'), p.click('#fsave')]);
  const fpText = await (await dlfp.createReadStream()).toArray().then((c) => Buffer.concat(c).toString('utf8'));
  check(JSON.parse(fpText).module === 'fixedpoint' && JSON.parse(fpText).problem.scheme.bodies.length === nb + 1, 'файл задачи о теле с неподвижной точкой');
  const fpSol = await p.innerText('#fpsolution');
  await tab('frames');
  await openText('fp.json', fpText, 'ok');
  check((await p.getAttribute('[data-tab="fixedpoint"]', 'aria-selected')) === 'true' && (await p.innerText('#fpsolution')) === fpSol, 'файл неподвижной точки открывается в своей вкладке без потерь');
  await tab('frames');

  // Вкладка «Гироскоп».
  await tab('gyro');
  const gyS = await p.innerText('#gysolution');
  check(gyS.includes('778,4913') && gyS.includes('621,5087'), 'Мещерский 40.8: колёсный скат на закруглении — давления на рельсы 700 ± 79 кГ', gyS.slice(-300));
  await p.selectOption('#gypreset', 'm4011');
  check((await p.innerText('#gysolution')).includes('α = 45,0555°'), 'Мещерский 40.11: равновесие рамки гироскопа на широте 30°');
  await p.selectOption('#gypreset', 'm405');
  check((await p.innerText('#gysolution')).includes('8,6614'), 'Мещерский 40.5: период прецессии оси снаряда');
  await p.selectOption('#gy-mode', 'forced');
  check((await p.inputValue('#gy-jMode')) === 'J' && (await p.innerText('#gysolution')).includes('Гироскопический момент'), 'смена режима: кинетический момент заменён моментом инерции');
  const [dlgy] = await Promise.all([p.waitForEvent('download'), p.click('#fsave')]);
  const gyText = await (await dlgy.createReadStream()).toArray().then((c) => Buffer.concat(c).toString('utf8'));
  check(JSON.parse(gyText).module === 'gyro' && JSON.parse(gyText).problem.mode === 'forced', 'файл задачи о гироскопе');
  const gySol = await p.innerText('#gysolution');
  await tab('frames');
  await openText('gy.json', gyText, 'ok');
  check((await p.getAttribute('[data-tab="gyro"]', 'aria-selected')) === 'true' && (await p.innerText('#gysolution')) === gySol, 'файл гироскопа открывается в своей вкладке без потерь');
  await tab('frames');

  // Вкладка «Центр масс»: сохранение количества движения, давление струи, работа и мощность (§29, 36).
  await tab('masscenter');
  await p.selectOption('#mpreset', 'm368');
  const moS = await p.innerText('#msolution');
  check(moS.includes('−4,4182') && (await p.locator('#msvg .cv-r').count()) === 1, 'Мещерский 36.8: откат ствола 4,42 м/с', moS.slice(-300));
  await p.selectOption('#mpreset', 'm3616');
  check((await p.innerText('#msolution')).includes('51,24'), 'Мещерский 36.16: давление на колено трубы 51,2 кГ');
  await p.selectOption('#mpreset', 'm3618');
  check((await p.innerText('#msolution')).includes('давление на опоры 0'), 'Мещерский 36.18: давление котла на опоры равно нулю');
  await p.selectOption('#mpreset', 'm293');
  check((await p.innerText('#msolution')).includes('34 ч 43 мин 20 с'), 'Мещерский 29.3: время работы насоса');
  await p.click('#maddload');
  check((await p.locator('#mwloads .cvrow').count()) === 2 && (await p.locator('#mmode').inputValue()) === 'power', 'работа и мощность: добавлена нагрузка');
  const [dlpw] = await Promise.all([p.waitForEvent('download'), p.click('#fsave')]);
  const pwText = await (await dlpw.createReadStream()).toArray().then((c) => Buffer.concat(c).toString('utf8'));
  check(JSON.parse(pwText).module === 'masscenter' && JSON.parse(pwText).problem.power.loads.length === 2, 'файл задачи о работе и мощности');
  const pwSol = await p.innerText('#msolution');
  await tab('frames');
  await openText('pw.json', pwText, 'ok');
  check((await p.getAttribute('[data-tab="masscenter"]', 'aria-selected')) === 'true' && (await p.innerText('#msolution')) === pwSol, 'файл работы и мощности открывается без потерь');
  await tab('frames');

  // Вкладка «Устойчивость и нелинейные колебания».
  await tab('hamilton');
  let hm = await p.innerText('#hmsolution');
  check(hm.includes('R = l²·m·θ̇²/2 + g·l·m·cos θ − n²/(2·l²·m·sin² θ)') && hm.includes('ω = 5,836 рад/с'), 'Мещерский 55.24: функция Рауса, устойчивость конического движения', hm.slice(-400));
  check((await p.locator('#hmplot .rt-line').count()) === 4, 'графики θ, ψ, циклического импульса и H');
  await p.selectOption('#hmpreset', 'm499');
  check((await p.innerText('#hmsolution')).includes('H = −g·l·m·cos φ + p_φ²/(2·l²·m)'), 'Мещерский 49.9: функция Гамильтона');
  await p.selectOption('#hmpreset', 'm5518');
  hm = await p.innerText('#hmsolution');
  check(hm.includes('−A·B·m + J·c·β > 0') && hm.includes('A = 6') && (await p.getAttribute('#hm-mode-stab', 'aria-pressed')) === 'true', 'Мещерский 55.18: условие Гурвица и граница по A', hm.slice(-400));
  await p.click('#hm-form-first');
  check((await p.innerText('#hmsolution')).includes('det(λI − A) = 0'), 'устойчивость по матрице системы');
  await p.click('#hm-form-poly');
  await p.selectOption('#hmpreset', 'm566');
  hm = await p.innerText('#hmsolution');
  check(hm.includes('a = 0,5 — устойчивый (автоколебания) цикл') && (await p.locator('#hmplot .vb-mode-l').count()) >= 3, 'Мещерский 56.6: предельный цикл и фазовый портрет', hm.slice(-400));
  await p.click('#hmaddst');
  check((await p.locator('[id^="hm-st"]').count()) === 2, 'добавлена фазовая траектория');
  const [dlhm] = await Promise.all([p.waitForEvent('download'), p.click('#fsave')]);
  const hmText = await (await dlhm.createReadStream()).toArray().then((c) => Buffer.concat(c).toString('utf8'));
  check(JSON.parse(hmText).module === 'hamilton' && JSON.parse(hmText).problem.nonlin.starts.length === 2, 'файл задачи об устойчивости и колебаниях');
  const hmSol = await p.innerText('#hmsolution');
  await tab('frames');
  await openText('hm.json', hmText, 'ok');
  check((await p.getAttribute('[data-tab="hamilton"]', 'aria-selected')) === 'true' && (await p.innerText('#hmsolution')) === hmSol, 'файл открывается в своей вкладке без потерь');
  await tab('frames');

  // Вкладка «Реакции при плоском движении».
  await tab('planebody');
  const pbS = await p.innerText('#pbsolution');
  check(pbS.includes('T1 = 3,27') && pbS.includes('−6,54'), 'Мещерский 39.20: T = mg/3, ускорение оси 2g/3', pbS.slice(-300));
  await p.selectOption('#pbpreset', 'm3917');
  check((await p.innerText('#pbsolution')).includes('T1 = 0,25'), 'Мещерский 39.17: T = P/4');
  await p.selectOption('#pbpreset', 'm3921');
  const pb21 = await p.innerText('#pbsolution');
  check(pb21.includes('0,1955') && pb21.includes('трение скольжения'), 'Мещерский 39.21: натяжение нитей и трение скольжения', pb21.slice(-300));
  await p.selectOption('#pbpreset', 'm4115');
  check((await p.innerText('#pbsolution')).includes('4820,7692') && (await p.innerText('#pbsolution')).includes('Уравнения кинетостатики'), 'Мещерский 41.15: давления колёс кинетостатикой');
  await p.selectOption('#pbpreset', 'm435b');
  check((await p.innerText('#pbsolution')).includes('N1 = 0 кГ'), 'Мещерский 43.5: в момент отхода давление на стену равно нулю');
  await p.locator('#pb-vx').fill('0');
  await p.locator('#pb-vx').blur();
  await p.selectOption('#pbmode', 'given');
  check((await p.innerText('#pbsolution')).includes('Заданное движение и силы инерции'), 'режим «движение задано»');
  await p.click('#pbaddpt');
  await p.click('#pbaddf');
  check((await p.locator('#pbpoints .cvrow').count()) === 1 && (await p.locator('#pbloads .cvrow').count()) === 1, 'добавлены точка и сила');
  const [dlpb] = await Promise.all([p.waitForEvent('download'), p.click('#fsave')]);
  const pbText = await (await dlpb.createReadStream()).toArray().then((c) => Buffer.concat(c).toString('utf8'));
  check(JSON.parse(pbText).module === 'planebody' && JSON.parse(pbText).problem.mode === 'given' && JSON.parse(pbText).problem.loads.length === 1, 'файл задачи о реакциях при плоском движении');
  const pbSol = await p.innerText('#pbsolution');
  await tab('frames');
  await openText('pb.json', pbText, 'ok');
  check((await p.getAttribute('[data-tab="planebody"]', 'aria-selected')) === 'true' && (await p.innerText('#pbsolution')) === pbSol, 'файл реакций при плоском движении открывается в своей вкладке без потерь');
  await tab('frames');

  // Вкладка «Усталостная прочность».
  await tab('fatigue');
  const faS = await p.innerText('#fasolution');
  check(faS.includes('1,676') && faS.includes('Гафа и Полларда'), 'Антонов, п. 11.7: изгиб с кручением — n = 1,676', faS.slice(-300));
  await p.selectOption('#fapreset', 'f114');
  check((await p.innerText('#fasolution')).includes('запас недостаточен'), 'пульсационный цикл: запас меньше [n]');
  await p.selectOption('#fa-sigma-mode', 'ma');
  check((await p.inputValue('#fa-sigma-a')) === '60', 'переход к σ_m, σ_a пересчитывает цикл');
  await p.selectOption('#fa-kmode', 'surf');
  check((await p.innerText('#fasolution')).includes('K_v'), 'формула K с поверхностным упрочнением');
  const [dlf] = await Promise.all([p.waitForEvent('download'), p.click('#fsave')]);
  const faText = await (await dlf.createReadStream()).toArray().then((c) => Buffer.concat(c).toString('utf8'));
  check(JSON.parse(faText).module === 'fatigue' && JSON.parse(faText).problem.kMode === 'surf', 'файл усталостной прочности');
  const faSol = await p.innerText('#fasolution');
  await tab('frames');
  await openText('fa.json', faText, 'ok');
  check((await p.getAttribute('[data-tab="fatigue"]', 'aria-selected')) === 'true' && (await p.innerText('#fasolution')) === faSol, 'файл усталостной прочности открывается в своей вкладке без потерь');
  await tab('frames');

  // 25. Вкладка «Кинематика точки».
  await tab('pointkin');
  const knS = await p.innerText('#ksolution');
  check(knS.includes('2,8284') && knS.includes('2t'), 'Мещерский 12.28: v = 2√2, производные формулами', knS.slice(0, 300));
  await p.selectOption('#kpreset', 'k1226');
  check((await p.innerText('#ksolution')).includes('2,125'), 'Мещерский 12.26: ρ = 2⅛');
  await p.selectOption('#kmode', 'polar');
  check((await p.locator('#k-phi').count()) === 1, 'полярный способ — поля r и φ');
  await p.selectOption('#kpreset', 'k106');
  check((await p.innerText('#ksolution')).includes('4x² + 9y − 18 = 0'), 'Мещерский 10.6: уравнение траектории 4x² + 9y = 18');
  await p.selectOption('#kpreset', 'k1117');
  const k17 = await p.innerText('#ksolution');
  check(k17.includes('1,3305') && k17.includes('rθ″ + 2ṙθ′'), 'Мещерский 11.17, 12.35: сферические координаты', k17.slice(-300));
  await p.selectOption('#kpreset', 'u1210');
  check((await p.innerText('#ksolution')).includes('0,3078') && (await p.innerText('#ksolution')).includes('t = 80 с'), 'Мещерский 12.10: равнопеременное движение на закруглении');
  await p.click('#ku-k-t');
  check((await p.innerText('#ksolution')).includes('ровно три'), 'отметок не три — понятное сообщение');
  await p.click('#ku-k-t');
  await p.selectOption('#kpreset', 'k1226');
  await p.selectOption('#kmode', 'polar');
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
  // 27а. Кулисы, силы, массы, параметр положения.
  await p.selectOption('#mpreset', 'm2322');
  const kuS = await p.innerText('#msolution');
  check(kuS.includes('Кулисный камень') && kuS.includes('1,2096') && kuS.includes('103,68'), 'Мещерский 23.22–23.23: ε кулисы 1,21, w_r = 103,7', kuS.slice(0, 300));
  check((await p.locator('#msvg .mc-stone').count()) === 1 && (await p.locator('#mplotsvg .rt-line').count()) >= 1, 'на чертеже — кулисный камень, под ним — график по φ');
  await p.fill('#m-param-val', '0');
  await p.locator('#m-param-val').blur();
  check((await p.innerText('#msolution')).includes('154,2857'), 'φ = 0: w_r = 154,3 см/с²');
  await p.selectOption('#mpreset', 'm4610');
  const eqS = await p.innerText('#msolution');
  check(eqS.includes('принцип возможных перемещений') && /X = 80\b/.test(eqS) && (await p.locator('#msvg .mc-unk').count()) >= 1, 'Мещерский 46.10: Q = 80 из принципа возможных перемещений', eqS.slice(0, 300));
  await p.selectOption('#mpreset', 'm3849');
  const meEn = await p.innerText('#msolution');
  check(meEn.includes('Теорема об изменении кинетической энергии') && meEn.includes('3,07'), 'Мещерский 38.49: ω = √(3π) = 3,07 по теореме об энергии', meEn.slice(0, 300));
  await p.selectOption('#mpreset', 'm1615');
  await p.click('#mparam');
  await p.fill('#m-points-1-def-ang', 'φ');
  await p.locator('#m-points-1-def-ang').blur();
  await p.click('#maddm-point');
  const pmS = await p.innerText('#msolution');
  check(!pmS.includes('проверьте') && pmS.includes('Кинетическая энергия механизма') && pmS.includes('Параметр положения'), 'φ в поле угла и точечная масса — решение с кинетической энергией', pmS.slice(0, 300));
  // 27б. Законы движения по времени.
  await p.selectOption('#mpreset', 'm163');
  const lwS = await p.innerText('#msolution');
  check(lwS.includes('Законы движения в момент t') && lwS.includes('φ = 0,5236 рад = 30°') && lwS.includes('12,204'), 'Мещерский 16.3, 18.2: законы x_C(t), φ(t), a_A = 12,20', lwS.slice(0, 300));
  check((await p.isChecked('#mtime')) && !(await p.isChecked('#mparam')) && (await p.locator('#mlaws .mc-law').count()) === 2, 'режим законов движения: два закона, параметр φ выключен');
  await p.fill('#m-time-t', '0');
  await p.locator('#m-time-t').blur();
  check((await p.innerText('#msolution')).includes('9,8696'), 't = 0: v_A = π² = 9,87 см/с (16.2)');
  await p.selectOption('#mplot', 'v:A');
  check(((await p.textContent('#mplotsvg')) ?? '').includes('t, с'), 'график по времени');
  await p.fill('#m-time-t', '0,5');
  await p.locator('#m-time-t').blur();
  await p.fill('#m-drives-1-w', "2φ'");
  await p.locator('#m-drives-1-w').blur();
  check((await p.innerText('#msolution')).includes('не согласуется с законами движения'), 'ведущее не согласовано с законом — предупреждение');
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
  // 33а. Положения равновесия и устойчивость.
  await p.selectOption('#lgpreset', 'yd22');
  lg = await p.innerText('#lgsolution');
  check(
    lg.includes('6 положений равновесия') && lg.includes('φ* = 1,9702 (112,89°): K = W″ = 0,1528 > 0 — минимум W, равновесие устойчиво') && lg.includes('излом W') && (await p.innerText('.dg-empty')).includes('только положения равновесия'),
    'Яблонский, Д.22: шесть положений равновесия, излом при φ = 0, статика без T',
    lg.slice(0, 400),
  );
  await p.selectOption('#lgpreset', 'm4827');
  lg = await p.innerText('#lgsolution');
  check(lg.includes('W = Π − T₀') && lg.includes('(52,18°)') && lg.includes('Малые колебания') && (await p.isChecked('#lgeq')), 'Мещерский 48.27: относительное равновесие cos θ = g/(aω²) и уравнения движения', lg.slice(-500));
  await p.fill('#lg-eqto', '1');
  await p.locator('#lg-eqto').blur();
  check(!(await p.innerText('#lgsolution')).includes('180°'), 'отрезок поиска сужен — верхнего положения нет');
  await p.click('#lgeq');
  check(!(await p.innerText('#lgsolution')).includes('Положения равновесия'), 'поиск выключен');
  await tab('frames');

  // 33а. Вкладка «Удар и колебания».
  await tab('oscillation');
  let os = await p.innerText('#osolution');
  check(os.includes('x = −0,5 cos 44,29t + 10 sin 44,29t') && os.includes('груз отрывается'), 'Мещерский 32.4: удар о балку — закон движения и отрыв груза', os.slice(0, 400));
  await p.selectOption('#opreset', 'm3255');
  os = await p.innerText('#osolution');
  check(os.includes('число полуразмахов: 4') && os.includes('размах 5,2') && os.includes('размах 0,4'), 'Мещерский 32.55: сухое трение — 4 полуразмаха 5,2 … 0,4 см', os.slice(-500));
  check((await p.locator('#osvg .os-zone').count()) === 1, 'на графике — область застоя');
  await p.selectOption('#opreset', 'm3287');
  check((await p.innerText('#osolution')).includes('резонанс'), 'Мещерский 32.87: резонанс');
  await p.selectOption('#opreset', 'a104');
  os = await p.innerText('#osolution');
  check(os.includes('26,6') && os.includes('прочность обеспечена') && os.includes('108,4'), 'Антонов, рис. 10.4: K_д = 26,6, σ_max = 108,4 МПа', os.slice(-600));
  await p.selectOption('#opreset', 'm321');
  await p.selectOption('#ostiff', 'elems');
  await p.click('#oaddstage');
  check((await p.locator('#ostages .os-stage').count()) === 2 && (await p.locator('#osvg .os-spring').count()) === 2, 'добавлена вторая ступень пружин');
  for (const id of ['#o-e00-c', '#o-e10-c']) {
    await p.locator(id).fill('2');
    await p.locator(id).blur();
  }
  os = await p.innerText('#osolution');
  check(os.includes('ступени последовательно') && os.includes('c = 1 Г/см'), 'две пружины по 2 Г/см последовательно: c = 1 Г/см', os.slice(0, 500));
  await p.selectOption('#odamp', 'b');
  await p.locator('#o-b').fill('0,5');
  await p.locator('#o-b').blur();
  check((await p.innerText('#osolution')).includes('затухающие колебания') && (await p.locator('#osvg .os-damper').count()) === 1, 'вязкое сопротивление: затухающие колебания и демпфер на схеме');
  const [dl34] = await Promise.all([p.waitForEvent('download'), p.click('#fsave')]);
  const osText = await (await dl34.createReadStream()).toArray().then((c) => Buffer.concat(c).toString('utf8'));
  const osSol = await p.innerText('#osolution');
  check(JSON.parse(osText).module === 'oscillation' && JSON.parse(osText).problem.el.stages.length === 2, 'файл задачи о колебаниях');
  await tab('frames');
  await openText('os.json', osText, 'ok');
  check((await p.getAttribute('[data-tab="oscillation"]', 'aria-selected')) === 'true' && (await p.innerText('#osolution')) === osSol, 'файл колебаний открывается в своей вкладке без потерь');
  await tab('frames');

  // 33б. Вкладка «Стержневые системы».
  await tab('rods');
  let rd = await p.innerText('#rdsolution');
  check(rd.includes('Степень статической неопределимости: 3 − 2 = 1') && rd.includes('= 0,2·F') && rd.includes('= 0,8·F') && rd.includes('= 64 кН'), 'Антонов, рис. 4.4: N = 0,2F и 0,8F, [F]п = 64 кН', rd.slice(0, 400));
  check(rd.includes('[F]п/[F] = 1,6'), 'предельная нагрузка в 1,6 раза больше допускаемой');
  check((await p.locator('#rdsvg .rd-ten').count()) === 3 && (await p.locator('#rdsvg .rd-def').count()) >= 3, 'растянутые стержни и план перемещений на схеме');
  await p.selectOption('#rdpreset', 'a38');
  check((await p.innerText('#rdsolution')).includes('A ≥ 2,411 см²'), 'Антонов, рис. 3.8: подбор площади, A ≥ 2,411 см²');
  await p.selectOption('#rdpreset', 'a310');
  rd = await p.innerText('#rdsolution');
  check(rd.includes('22,86') && rd.includes('Δl2 = −Δl₁'), 'Антонов, рис. 3.10: монтажное усилие 22,86 кН и совместность Δl₂ = −Δl₁', rd.slice(0, 600));
  await p.selectOption('#rdpreset', 'a44');
  await p.click('#rdaddrod');
  check((await p.locator('#rdrods .rd-item').count()) === 4 && (await p.innerText('#rdsolution')).includes('4 − 2 = 2'), 'четвёртый стержень — система дважды неопределима');
  await p.selectOption('#rdbody', 'bar');
  check((await p.locator('#rdsups .rd-item').count()) === 1 && (await p.locator('#rdsvg .rd-bar').count()) === 1, 'узел заменён жёстким брусом с шарнирной опорой');
  const [dl35] = await Promise.all([p.waitForEvent('download'), p.click('#fsave')]);
  const rdText = await (await dl35.createReadStream()).toArray().then((c) => Buffer.concat(c).toString('utf8'));
  const rdSol = await p.innerText('#rdsolution');
  check(JSON.parse(rdText).module === 'rods' && JSON.parse(rdText).problem.rods.length === 4, 'файл стержневой системы');
  await tab('frames');
  await openText('rd.json', rdText, 'ok');
  check((await p.getAttribute('[data-tab="rods"]', 'aria-selected')) === 'true' && (await p.innerText('#rdsolution')) === rdSol, 'файл стержневой системы открывается в своей вкладке без потерь');
  await tab('frames');

  // 34. Навигация и «Задачник».
  await tab('tasks');
  check((await p.getAttribute('[data-tab="tasks"]', 'aria-current')) === 'true' && (await p.locator('.tk-book').count()) === 4, '«Задачник»: Мещерский, Антонов, Яблонский, примеры приложения');
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
  check(
    groups[0]!.startsWith('Мещерский, § 2.') && groups[1]!.startsWith('Мещерский, § 3.') && groups.some((g) => g!.startsWith('Мещерский, § 4.')) && groups[groups.length - 1] === 'Другие примеры',
    'список «Готовая задача» сгруппирован: Мещерский по параграфам, затем примеры',
    groups.join(' | '),
  );
  // Пример задания С.3 Яблонского: скользящая заделка между частями.
  await tab('tasks');
  await p.fill('#tksearch', 'скользящая заделка в C');
  await p.click('[data-task="frames:yb:С.3b"]');
  const ybS = await p.innerText('#solution');
  check(
    (await p.inputValue('#preset')) === 'yb:С.3b' && (await p.textContent('.notice'))!.includes('X_A = −5,50') && ybS.includes('скользящей заделке') && ybS.includes('−5,5'),
    'Яблонский С.3: скользящая заделка между частями, X_A = −5,50 как в книге',
    ybS.slice(0, 300),
  );
  check((await p.locator('#svg .islide').count()) === 1, 'на схеме — скользящая заделка между частями');
  await p.click('[data-add="slide"]');
  check((await p.innerText('#solution')).includes('Скользящая заделка') && (await p.locator('[data-item][data-kind="sup"]').count()) === 3, 'опора «скользящая заделка» добавляется из палитры');
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
  check((await p.locator('.nav-sheet [data-go]').count()) === 38, 'в меню все разделы, «Задачник» и «Дорожная карта»');
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
