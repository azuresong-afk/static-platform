/** Готовые задачи пункта 34 в «Уравнениях Лагранжа» (Мещерский §47–48): ответ книги сходится. */
import { describe, expect, it } from 'vitest';
import { LAGRANGE_PRESETS } from '../src/modules/lagrange/presets';
import { LAG_PRESETS_34, b4825, besselJ1, besselY1 } from '../src/modules/lagrange/presets34';
import { taskInfo } from '../src/shared/tasks';
import { lagValues } from './lagrange-values';

describe('функции Бесселя для ответа 48.13', () => {
  it('J₁(1), Y₁(1), J₁(10), Y₁(10)', () => {
    expect(besselJ1(1)).toBeCloseTo(0.4400505857, 8);
    expect(besselY1(1)).toBeCloseTo(-0.7812128213, 8);
    expect(besselJ1(10)).toBeCloseTo(0.0434727462, 8);
    expect(besselY1(10)).toBeCloseTo(0.2490154242, 8);
  });
});

describe('готовые задачи пункта 34 («Уравнения Лагранжа»): ответ книги', () => {
  for (const [key, p] of Object.entries(LAG_PRESETS_34)) {
    it(`${key}: ${p.title}`, () => {
      expect(taskInfo(p.title).book).toBe('mesh');
      expect(LAGRANGE_PRESETS[key as keyof typeof LAGRANGE_PRESETS]).toBe(p);
      const got = lagValues(p.problem);
      const tol = p.relTol ?? 1e-6;
      for (const [k, book] of Object.entries(p.book)) {
        expect(got[k], `${key}: нет величины ${k}`).toBeDefined();
        if (Math.abs(book) < 1e-12) expect(Math.abs(got[k]), `${key} ${k}: ${got[k]}`).toBeLessThan(1e-6);
        else expect(Math.abs(got[k] - book), `${key} ${k}: ${got[k]} против ${book}`).toBeLessThanOrEqual(tol * Math.abs(book));
      }
    });
  }
  it('47.27: M₁ опускается ровно при m₁ > 4m₂m₃/(m₂ + m₃)', () => {
    const pr = LAG_PRESETS_34.m4727.problem;
    const at = (m1: number) => lagValues({ ...pr, params: pr.params.map((x) => (x.name === 'm1' ? { ...x, value: m1 } : x)) }).a1;
    const m1 = (4 * 2 * 1) / 3;
    expect(at(m1 * 1.01)).toBeGreaterThan(0);
    expect(at(m1 * 0.99)).toBeLessThan(0);
    expect(Math.abs(at(m1))).toBeLessThan(1e-9);
  });
});

describe('48.25: расхождение с книгой в координатах центра диска', () => {
  it('ξ, η идут с аргументом (α − β)t²/(2R), а не (α + β)', () => {
    const got = lagValues(LAG_PRESETS_34.m4825.problem);
    const { M, m, J, R, α } = { M: 3, m: 1, J: 0.6, R: 0.4, α: 0.5 };
    const μ = (m * M) / (m + M),
      β = (μ * R * R * α) / (J + μ * R * R);
    const arg = ((α - β) / (2 * R)) * 4;
    expect(got.qEnd1).toBeCloseTo(-((m * R) / (m + M)) * Math.cos(arg), 4);
    expect(got.qEnd2).toBeCloseTo(-((m * R) / (m + M)) * Math.sin(arg), 4);
    expect(Math.abs(got.qEnd1 - b4825.ξ)).toBeGreaterThan(0.01);
  });
});

describe('52.11: расхождение с книгой в устойчивости третьего положения', () => {
  it('ψ₃ = 3π/2 — максимум Π (Π″ = −3Pa/4), а не минимум', () => {
    const got = lagValues(LAG_PRESETS_34.m5211.problem);
    expect(got.eq3).toBeCloseTo((3 * Math.PI) / 2, 5);
    expect(got.eqStable3).toBe(0);
    const Pi = (ψ: number) => (1 / Math.SQRT2) * Math.cos(ψ + Math.PI / 4) + Math.SQRT2 * Math.sin(ψ / 2);
    const h = 1e-4,
      ψ3 = (3 * Math.PI) / 2;
    expect((Pi(ψ3 + h) - 2 * Pi(ψ3) + Pi(ψ3 - h)) / (h * h)).toBeCloseTo(-0.75, 5);
  });
});
