/**
 * Задачи Мещерского (src/model/textbook.ts): ответ приложения сравнивается с ответом книги
 * с точностью до двух единиц последнего напечатанного знака; дробные ответы из формул — точно.
 * Дополнительно каждое решение проверяется независимым расчётом равновесия.
 */
import { describe, expect, it } from 'vitest';
import { analyze } from '../src/core';
import { resolve } from '../src/model/geometry';
import { presetStructure } from '../src/model/presets';
import { TEXTBOOK } from '../src/model/textbook';
import { residuals, wrenches } from './helpers/equilibrium';

/**
 * Допуск — две единицы последнего напечатанного знака (7,78 → 0,02; 790 → 2); дроби из формул — точно.
 * Книга округляет промежуточные величины (например, sin 60° ≈ 0,87 в 4.25), отсюда запас в две единицы.
 */
function printedUnit(v: number): number {
  const s = String(Math.abs(v));
  const d = s.includes('.') ? s.split('.')[1].length : 0;
  return d > 6 ? 1e-9 : 2 * Math.pow(10, -d);
}

describe('Мещерский: задачи на одно тело', () => {
  for (const p of TEXTBOOK)
    it(`${p.id} — ${p.title}`, () => {
      const s = presetStructure(p.preset);
      const { solution, model } = analyze(s);
      expect(solution.status).toBe('ok');
      const keys = model.unknowns.map((u) => u.key);
      for (const k of Object.keys(p.answer)) expect(keys, `нет неизвестного ${k}`).toContain(k);
      for (const [k, book] of Object.entries(p.answer)) {
        const got = solution.vals[k];
        const d = p.discrepancy?.[k];
        if (d) {
          // Расхождение с книгой: сверяем с ручным пересчётом и убеждаемся, что оно действительно есть.
          expect(got, `${k}: ручной пересчёт`).toBeCloseTo(d.computed, 9);
          expect(Math.abs(got - book), `${k}: книга ${book}`).toBeGreaterThan(printedUnit(book));
        } else expect(Math.abs(got - book), `${k}: получено ${got}, в книге ${book}`).toBeLessThanOrEqual(printedUnit(book) + 1e-9);
      }
      const ws = wrenches(resolve(s).structure, solution.vals, model.unknowns, new Set());
      const r = residuals(ws, [[0, 0], ...model.pts.map((q) => [q.x, q.y] as [number, number])]);
      const tol = 1e-9 * r.scale;
      expect(Math.abs(r.fx)).toBeLessThan(tol);
      expect(Math.abs(r.fy)).toBeLessThan(tol);
      r.ms.forEach((m) => expect(Math.abs(m)).toBeLessThan(tol));
    });
});
