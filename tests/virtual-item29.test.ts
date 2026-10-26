/** Пункт 29, «Возможные перемещения»: замкнутые рамы и фермы на стержнях (Мещерский 46.24, 46.28). */
import { describe, expect, it } from 'vitest';
import { gauss } from '../src/shared/gauss';
import { VIRTUAL_CATALOG } from '../src/modules/virtual/machines';
import { scaffold, trusses, trussesBook } from '../src/modules/virtual/machines29';
import { defaults } from '../src/shared/machines/types';

describe('готовые задачи пункта 29', () => {
  for (const k of ['m4624', 'm4628']) {
    const ps = VIRTUAL_CATALOG.presets[k];
    it(ps.title, () => {
      const m = VIRTUAL_CATALOG.machines.find((x) => x.id === ps.machine)!;
      const out = m.solve({ ...defaults(m), ...ps.vals });
      expect(out.ok).toBe(true);
      if (!out.ok) return;
      for (const [key, book] of Object.entries(ps.book!)) expect(out.rows.find((r) => r.key === key)!.val).toBeCloseTo(book, 9);
      expect(out.fig.svg).not.toContain('NaN');
      expect(JSON.stringify(out.steps)).not.toContain('NaN');
    });
  }
});

describe('независимая проверка уравнениями равновесия', () => {
  it('46.24: S = 12√2·P₁ при любых a, H, P₂', () => {
    for (const v of [
      { a: 1, H: 3, P1: 1, P2: 0 },
      { a: 0.7, H: 5, P1: 2, P2: 3 },
    ]) {
      const { r } = scaffold(v);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value).toBeCloseTo(12 * Math.SQRT2 * v.P1, 9);
    }
  });
  it('46.28: R_B совпадает с уравнениями равновесия ферм и стержней', () => {
    const v = { L: 6, a: 4, P: 1, e: 1.5, hE: 3, hC: 5, beta: 60 };
    const { r, n } = trusses(v);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // Неизвестные: Y_A, Dx, Dy, S3, S4, R_B. Ферма I: Y_A вверх, −(Dx, Dy) от II, сила стержня III вдоль CE.
    const E = [v.L - v.e, -v.hE],
      F = [v.L + v.e, -v.hE],
      C = [v.L, -v.hC],
      D = [v.L, 0],
      B = [2 * v.L, 0];
    const u = (p: number[]) => {
      const d = [p[0] - C[0], p[1] - C[1]];
      const L = Math.hypot(d[0], d[1]);
      return [d[0] / L, d[1] / L];
    };
    const e3 = u(E),
      e4 = u(F);
    // Усилие стержня S (растяжение) действует на ферму в узле к C: −e·S.
    const mom = (p: number[], f: number[]) => p[0] * f[1] - p[1] * f[0];
    // Строки: ΣX_I, ΣY_I, ΣM_I, ΣX_II, ΣY_II, ΣM_II; столбцы: Y_A, Dx, Dy, S3, S4, R_B
    const A6 = [
      [0, 1, 0, -e3[0], 0, 0],
      [1, 0, 1, -e3[1], 0, 0],
      [0, mom(D, [1, 0]), mom(D, [0, 1]), mom(E, [-e3[0], -e3[1]]), 0, 0],
      [0, -1, 0, 0, -e4[0], n[0]],
      [0, 0, -1, 0, -e4[1], n[1]],
      [0, -mom(D, [1, 0]), -mom(D, [0, 1]), 0, mom(F, [-e4[0], -e4[1]]), mom(B, n)],
    ];
    const rhs = [0, v.P, -mom([v.a, 0], [0, -v.P]), 0, 0, 0];
    const x = gauss(A6, rhs);
    expect(r.value).toBeCloseTo(x[5], 9);
    expect(trussesBook(v)).toBeCloseTo(Math.abs(x[5]), 9);
  });
});
