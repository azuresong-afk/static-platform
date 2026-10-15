/**
 * Один файл для раздачи: dist/index.html со встроенными CSS и JS → dist/statika.html, затем проверка в браузере
 * без сервера (готовая задача решается, есть блоки навигации и «Задачник»). Запуск: npm run build && npm run bundle.
 * В конце печатает имена файлов сборки — они нужны для публикации (см. CLAUDE.md).
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const dist = resolve(dirname(fileURLToPath(import.meta.url)), '../dist');
let html = readFileSync(`${dist}/index.html`, 'utf8');
const assets: string[] = [];
let css = 0,
  js = 0;
html = html.replace(/<link rel="stylesheet"[^>]*href="\.?\/?(assets\/[^"]+\.css)"[^>]*>/g, (_, f: string) => {
  css++;
  assets.push(f);
  return `<style>${readFileSync(`${dist}/${f}`, 'utf8')}</style>`;
});
html = html.replace(/<script type="module"[^>]*src="\.?\/?(assets\/[^"]+\.js)"[^>]*><\/script>/g, (_, f: string) => {
  js++;
  assets.push(f);
  return `<script type="module">${readFileSync(`${dist}/${f}`, 'utf8').replace(/<\/script/g, '<\\/script')}</script>`;
});
if (css !== 1 || js !== 1) throw new Error(`ожидались один CSS и один JS, найдено ${css} и ${js}`);
const out = `${dist}/statika.html`;
writeFileSync(out, html);
console.log(`dist/statika.html: ${(html.length / 1e6).toFixed(2)} МБ`);

function chromiumPath(): string | undefined {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const base = '/opt/pw-browsers';
  if (!existsSync(base)) return undefined;
  const dir = readdirSync(base).find((d) => /^chromium-\d+$/.test(d));
  return dir ? `${base}/${dir}/chrome-linux/chrome` : undefined;
}
const browser = await chromium.launch({ executablePath: chromiumPath() });
const p = await browser.newPage();
await p.route(/fonts\.g/, (r) => r.abort());
const errs: string[] = [];
p.on('pageerror', (e) => errs.push(e.message));
await p.goto(pathToFileURL(out).href);
await p.selectOption('#preset', 'rafter');
const solved = (await p.innerText('#solution')).includes('5,231');
const blocks = await p.locator('[data-block]').count();
await p.click('[data-tab="tasks"]');
const tasks = await p.locator('.tk-item').count();
await browser.close();
console.log(`решение: ${solved ? 'да' : 'НЕТ'}; блоков навигации: ${blocks}; задач в «Задачнике»: ${tasks}; ошибок: ${errs.length}`);
console.log(`файлы для публикации: ${assets.join(', ')}`);
if (!solved || errs.length) {
  console.error(errs.join('\n'));
  process.exit(1);
}
