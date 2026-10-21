/**
 * Общие итоги в документах: число задач «Задачника» и список заданий Яблонского в README, итоги покрытия в
 * docs/coverage-meshchersky.md, docs/coverage-yablonsky.md и сводка в docs/coverage.md. Их считают из реестра готовых
 * задач и строк таблиц по параграфам и заданиям, поэтому параллельные пункты эти строки не правят (см. CLAUDE.md,
 * «Параллельные пункты»): после слияния всех пунктов итоги пересчитывает `npm run totals`. В обычном прогоне тестов —
 * только проверка, что подсчёт работает.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createModules } from '../src/app/registry';
import { taskInfo } from '../src/shared/tasks';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const path = (f: string) => resolve(root, f);
const update = process.env.npm_lifecycle_event === 'totals';

interface Part {
  title: string;
  n: number;
  ok: number;
  half: number;
  no: number;
}

const num = (s: string) => (s.trim() === '' ? 0 : +s.trim());
const pct = (x: number, n: number) => (x ? `${x} (${Math.round((100 * x) / n)} %)` : '0');

/** Части Мещерского по заголовкам «### …» раздела «По параграфам» и суммы по строкам параграфов. */
function meshParts(md: string): Part[] {
  const parts: Part[] = [];
  const body = md.slice(md.indexOf('## По параграфам'));
  for (const line of body.split('\n')) {
    const h = /^### (.+)$/.exec(line);
    if (h) parts.push({ title: h[1], n: 0, ok: 0, half: 0, no: 0 });
    const c = line.split('|');
    if (parts.length && /^\| \d+\. /.test(line)) {
      const part = parts[parts.length - 1];
      part.n += num(c[2]);
      part.ok += num(c[3]);
      part.half += num(c[4]);
      part.no += num(c[5]);
    }
  }
  return parts;
}

function sum(parts: Part[]): Part {
  return parts.reduce((s, p) => ({ ...s, n: s.n + p.n, ok: s.ok + p.ok, half: s.half + p.half, no: s.no + p.no }), {
    title: 'Всего',
    n: 0,
    ok: 0,
    half: 0,
    no: 0,
  });
}

function meshTable(parts: Part[]): string {
  const t = sum(parts);
  const row = (p: Part) => `| ${p.title} | ${p.n} | ${pct(p.ok, p.n)} | ${pct(p.half, p.n)} | ${pct(p.no, p.n)} | ${p.n - p.ok - p.half - p.no} |`;
  const b = (s: string | number) => `**${s}**`;
  return [
    '| Часть | Задач | Собирается | Частично | Нет | Вне формата |',
    '|---|--:|--:|--:|--:|--:|',
    ...parts.map(row),
    `| ${b('Всего')} | ${b(t.n)} | ${b(pct(t.ok, t.n))} | ${b(pct(t.half, t.n))} | ${b(pct(t.no, t.n))} | ${b(t.n - t.ok - t.half - t.no)} |`,
  ].join('\n');
}

/** Задания Яблонского по разделам «### Статика» и т. д.: строки «| С.1 | … | ✓ | …». */
function yabParts(md: string): (Part & { first: string; last: string })[] {
  const parts: (Part & { first: string; last: string })[] = [];
  for (const line of md.split('\n')) {
    const h = /^### (.+)$/.exec(line);
    if (h) parts.push({ title: h[1], n: 0, ok: 0, half: 0, no: 0, first: '', last: '' });
    const r = /^\| ([СКД]\.\d+) \|[^|]*\| *([✓½✗])/.exec(line);
    if (r && parts.length) {
      const part = parts[parts.length - 1];
      part.n++;
      if (r[2] === '✓') part.ok++;
      else if (r[2] === '½') part.half++;
      else part.no++;
      part.first ||= r[1];
      part.last = r[1];
    }
  }
  return parts.filter((p) => p.n);
}

function yabTable(parts: ReturnType<typeof yabParts>): string {
  const t = sum(parts);
  return [
    '| Раздел | Заданий | ✓ | ½ | ✗ |',
    '|---|--:|--:|--:|--:|',
    ...parts.map((p) => `| ${p.title} (${p.first}–${p.last}) | ${p.n} | ${p.ok} | ${p.half} | ${p.no} |`),
    `| **Всего** | **${t.n}** | **${t.ok}** | **${t.half}** | **${t.no}** |`,
  ].join('\n');
}

/** Заменить таблицу, которая начинается строкой-заголовком head, на table. */
function replaceTable(md: string, head: string, table: string): string {
  const start = md.indexOf(head);
  if (start < 0) throw new Error(`нет таблицы «${head}»`);
  let end = md.indexOf('\n\n', start);
  if (end < 0) end = md.length;
  return md.slice(0, start) + table + md.slice(end);
}

function replaceOnce(md: string, re: RegExp, to: string): string {
  if (!re.test(md)) throw new Error(`не найдено: ${re}`);
  return md.replace(re, to);
}

/** Пересчитанные файлы: имя → новое содержимое. */
function totals(): Record<string, string> {
  const tasks = createModules().flatMap((m) => m.tasks ?? []);
  const yabIds = [
    ...new Map(
      tasks
        .map((t) => taskInfo(t.title))
        .filter((i) => i.book === 'yab')
        .sort((a, b) => a.order[0] - b.order[0] || a.order[1] - b.order[1])
        .map((i) => [i.group, i.group.slice(4)]),
    ).values(),
  ];

  const files: Record<string, string> = {};
  const mesh = readFileSync(path('docs/coverage-meshchersky.md'), 'utf8');
  const parts = meshParts(mesh);
  files['docs/coverage-meshchersky.md'] = replaceTable(mesh, '| Часть | Задач |', meshTable(parts));

  const yab = readFileSync(path('docs/coverage-yablonsky.md'), 'utf8');
  const yParts = yabParts(yab);
  files['docs/coverage-yablonsky.md'] = replaceTable(yab, '| Раздел | Заданий |', yabTable(yParts));

  const m = sum(parts);
  const y = sum(yParts);
  const p = (x: number) => Math.round((100 * x) / m.n);
  let cov = readFileSync(path('docs/coverage.md'), 'utf8');
  cov = replaceOnce(
    cov,
    /\d+ задачи: \d+ % собираются, \d+ % частично, \d+ % нет конструктора/,
    `${m.n} задачи: ${p(m.ok)} % собираются, ${p(m.half)} % частично, ${p(m.no)} % нет конструктора`,
  );
  cov = replaceOnce(
    cov,
    /\d+ заданий: \d+ собираются, \d+ частично, без конструктора — (ни одного|\d+)/,
    `${y.n} заданий: ${y.ok} собираются, ${y.half} частично, без конструктора — ${y.no || 'ни одного'}`,
  );
  files['docs/coverage.md'] = cov;

  let readme = readFileSync(path('README.md'), 'utf8');
  readme = replaceOnce(readme, /все готовые задачи \(\d+\)/, `все готовые задачи (${tasks.length})`);
  readme = replaceOnce(readme, /Яблонский по заданиям \([^)]*\)/, `Яблонский по заданиям (${yabIds.join(', ')})`);
  files['README.md'] = readme;
  return files;
}

describe('общие итоги (npm run totals)', () => {
  it('считаются из реестра задач и таблиц покрытия', () => {
    const files = totals();
    expect(Object.keys(files)).toHaveLength(4);
    for (const text of Object.values(files)) expect(text.length).toBeGreaterThan(1000);
    if (update) for (const [f, text] of Object.entries(files)) writeFileSync(path(f), text);
  });
});
