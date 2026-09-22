/**
 * Снимает эталонные ответы с прототипа prototype/statika.html.
 *
 * Прототип не меняется: в память загружается его копия, в которую добавлена одна строка,
 * открывающая внутренние функции (state, buildModel, solve…) через window.__P.
 * Результат — tests/golden/*.json: входные данные, HTML решения, статус, значения,
 * выбранные уравнения, заголовки карточек и результат операций редактирования.
 *
 * Запуск: npm run golden  (нужен Chromium; путь — CHROMIUM_PATH или /opt/pw-browsers).
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve as pathResolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = pathResolve(dirname(fileURLToPath(import.meta.url)), '..');
const RANDOM_CASES = +(process.env.GOLDEN_CASES || 600);

function chromiumPath(): string | undefined {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const base = '/opt/pw-browsers';
  if (!existsSync(base)) return undefined;
  const dir = readdirSync(base).find((d) => /^chromium-\d+$/.test(d));
  return dir ? `${base}/${dir}/chrome-linux/chrome` : undefined;
}

const HOOK = `window.__P={state,loadPreset,renderAll,buildModel,solve,geomOK,geom,resolve,splitSeg,removeSeg,PRESETS,get G(){return G}};`;

function instrumented(): string {
  const src = readFileSync(pathResolve(root, 'prototype/statika.html'), 'utf8');
  const anchor = "loadPreset('simple');\n})();";
  if (!src.includes(anchor)) throw new Error('Не нашёл точку вставки в прототипе');
  return src.replace(anchor, HOOK + '\n' + anchor);
}

async function main() {
  const browser = await chromium.launch({ executablePath: chromiumPath() });
  const page = await browser.newPage();
  await page.route(/^https?:/, (r) => r.abort());
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setContent(instrumented(), { waitUntil: 'load' });
  await page.addScriptTag({ content: readFileSync(pathResolve(root, 'scripts/golden-page.js'), 'utf8') });
  const capture = (args: object) => page.evaluate(`window.__capture(${JSON.stringify(args)})`) as Promise<Record<string, unknown>>;

  const presets: Record<string, unknown> = {};
  for (const key of ['simple', 'cantilever', 'rod', 'lever', 'gframe', 'pframe', 'post', 'bracket', 'indet', 'blank'])
    presets[key] = await capture({ mode: 'preset', key });
  writeFileSync(pathResolve(root, 'tests/golden/presets.json'), JSON.stringify(presets, null, 1) + '\n');

  const random: unknown[] = [];
  for (let seed = 1; seed <= RANDOM_CASES; seed++) random.push({ seed, ...(await capture({ mode: 'random', seed })) });
  writeFileSync(pathResolve(root, 'tests/golden/random.json'), JSON.stringify(random) + '\n');

  await browser.close();
  const byStatus: Record<string, number> = {};
  (random as { status: string }[]).forEach((r) => (byStatus[r.status] = (byStatus[r.status] || 0) + 1));
  console.log('Готовые задачи:', Object.keys(presets).length, '; случайные:', random.length, byStatus);
  if (errors.length) {
    console.error('Ошибки на странице прототипа:', errors);
    process.exitCode = 1;
  }
}

main();
