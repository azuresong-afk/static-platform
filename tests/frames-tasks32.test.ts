/** Пункт 32: готовые задачи «Балок и рам» (Мещерский §2–4) — ответы книги, равновесие и текст решения. */
import { describe, expect, it } from 'vitest';
import { analyze } from '../src/modules/frames/analyze';
import { POSITIONS32, TASKS32 } from '../src/modules/frames/model/tasks32';
import { FRAMES_TASKS } from '../src/modules/frames/tasks';
import { docText } from './helpers/doctext';

const tolOf = (book: number, relTol = 0) => {
  const s = String(Math.abs(book));
  const d = s.includes('.') ? s.split('.')[1].length : 0;
  return Math.max(d > 6 ? 1e-9 : 2 * Math.pow(10, -d), relTol * Math.abs(book), 1e-9);
};
const near = (a: number, b: number, abs: number) => Math.abs(a - b) <= abs;

describe('пункт 32: задачи с ответом', () => {
  for (const p of TASKS32)
    it(`${p.id} — ${p.title}`, () => {
      const a = analyze(p.build(), { explain: true });
      const sol = a.solution;
      const vals = sol.friction ? sol.friction.sample! : sol.vals;
      if (!sol.friction) expect(sol.status, p.id).toBe('ok');
      for (const [k, book] of Object.entries(p.check.vals ?? {})) {
        const v = k.includes(',') ? Math.hypot(...k.split(',').map((x) => vals[x])) : vals[k];
        expect(v, `${p.id}: ${k} — нет в решении`).toBeDefined();
        const d = p.discrepancy?.[k];
        if (d) {
          expect(Math.abs(v - d.computed), `${p.id} ${k}: ${v} против пересчёта ${d.computed}`).toBeLessThanOrEqual(tolOf(d.computed));
          expect(Math.abs(v - book)).toBeGreaterThan(tolOf(book, p.relTol));
        } else expect(Math.abs(v - book), `${p.id} ${k}: ${v} против ${book}`).toBeLessThanOrEqual(tolOf(book, p.relTol));
      }
      expect(docText(a.doc)).not.toMatch(/NaN|undefined/);
    });
});

describe('пункт 32: поиск размера', () => {
  for (const p of POSITIONS32)
    it(p.id, () => {
      const a = analyze(p.build(), { explain: true });
      const c = p.check;
      expect(a.search!.errors).toEqual([]);
      const span = a.structure.search!.max - a.structure.search!.min;
      expect(a.search!.points.map((x) => x.p).length).toBe(c.points!.length);
      c.points!.forEach((x, i) => expect(near(a.search!.points[i].p, x, 1e-6 * span), `${p.id}: ${a.search!.points[i].p} ≠ ${x}`).toBe(true));
      c.ranges?.forEach(([lo, hi], i) => {
        expect(near(a.search!.ranges[i][0], lo, 1e-6 * span)).toBe(true);
        expect(near(a.search!.ranges[i][1], hi, 1e-6 * span)).toBe(true);
      });
      expect(docText(a.doc)).toContain('Ищем положение равновесия');
      expect(p.answer.startsWith('Ответ задачника')).toBe(true);
    });
});

it('пункт 32: задачи в списке вкладки', () => {
  const titles = FRAMES_TASKS.map((t) => t.title);
  for (const p of [...TASKS32, ...POSITIONS32])
    expect(
      titles.some((t) => t.startsWith(`Мещерский ${p.id.replace(/\s*\(.*\)$/, '')}:`)),
      p.id,
    ).toBe(true);
});
