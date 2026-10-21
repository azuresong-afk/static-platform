/** Симплекс-метод: известные задачи и сравнение с перебором вершин на случайных задачах. */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { linprog } from '../src/shared/lp';
import { gauss } from '../src/shared/gauss';
import { rankOf } from '../src/shared/rank';

describe('linprog', () => {
  it('простая задача с неравенствами', () => {
    // max x + y при x + 2y ≤ 4, 3x + y ≤ 6, x ≥ 0, y ≥ 0 → (1,6; 1,2), 2,8
    const r = linprog([-1, -1], [], [], [[1, 2], [3, 1], [-1, 0], [0, -1]], [4, 6, 0, 0]);
    expect(r.status).toBe('optimal');
    if (r.status !== 'optimal') return;
    expect(r.x[0]).toBeCloseTo(1.6, 9);
    expect(r.x[1]).toBeCloseTo(1.2, 9);
  });
  it('равенства и свободные переменные', () => {
    // min x при x + y = 1, y ≤ 5 → x = −4
    const r = linprog([1, 0], [[1, 1]], [1], [[0, 1]], [5]);
    expect(r.status === 'optimal' && r.x[0]).toBeCloseTo(-4, 9);
  });
  it('несовместна и неограничена', () => {
    expect(linprog([1], [[1]], [1], [[1]], [0]).status).toBe('infeasible');
    expect(linprog([1, 0], [[1, 1]], [1], [], []).status).toBe('unbounded');
  });
  it('совпадает с перебором вершин (2 переменные, до 5 неравенств)', () => {
    const coef = fc.integer({ min: -5, max: 5 });
    fc.assert(
      fc.property(fc.tuple(coef, coef), fc.array(fc.tuple(coef, coef, fc.integer({ min: -3, max: 10 })), { minLength: 1, maxLength: 5 }), (c, rows) => {
        // Ограничиваем область коробкой |x|, |y| ≤ 20, чтобы минимум существовал.
        const G = [...rows.map(([a, b]) => [a, b]), [1, 0], [-1, 0], [0, 1], [0, -1]];
        const h = [...rows.map((r) => r[2]), 20, 20, 20, 20];
        const r = linprog(c, [], [], G, h);
        let best = Infinity;
        for (let i = 0; i < G.length; i++)
          for (let j = i + 1; j < G.length; j++) {
            if (rankOf([G[i], G[j]]) < 2) continue;
            const p = gauss([G[i], G[j]], [h[i], h[j]]);
            if (G.every((g, k) => g[0] * p[0] + g[1] * p[1] <= h[k] + 1e-7)) best = Math.min(best, c[0] * p[0] + c[1] * p[1]);
          }
        if (best === Infinity) expect(r.status).toBe('infeasible');
        else {
          expect(r.status).toBe('optimal');
          if (r.status === 'optimal') expect(r.value).toBeCloseTo(best, 6);
        }
      }),
      { numRuns: 800, seed: 5 },
    );
  });
});
