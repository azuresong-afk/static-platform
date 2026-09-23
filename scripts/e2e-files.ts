/**
 * Проверка в браузере: сохранение и открытие проекта, перетаскивание файла, ошибки, отчёт в PDF.
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
  check(JSON.parse(text).format === 'statika-project', 'формат файла');
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

  // 7. Отчёт в PDF (печать).
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

  await browser.close();
  await new Promise<void>((r) => server.httpServer.close(() => r()));
  if (errors.length) console.log('Ошибки на странице:', errors);
  console.log(fails || errors.length ? `Провалено проверок: ${fails}` : 'Все проверки пройдены.');
  process.exitCode = fails || errors.length ? 1 : 0;
}

main();
