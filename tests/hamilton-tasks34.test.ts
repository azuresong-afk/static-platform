/** Пункт 34, «Устойчивость и нелинейные колебания»: независимая проверка ответов книги (48.50, 52.6, 52.9, 55.11, 56.2, 56.12). */
import { describe, expect, it } from 'vitest';
import { rollRhs } from '../src/modules/hamilton/model/roll';
import { solveRouth } from '../src/modules/hamilton/model/routh';
import { solveNonlin } from '../src/modules/hamilton/model/nonlin';
import { solveConstr } from '../src/modules/hamilton/model/constr';
import { HAM_PRESETS } from '../src/modules/hamilton/presets';

describe('48.50: уравнения катящегося колеса совпадают с уравнениями книги', () => {
  it('ω̇₁, ω̇₂, ω̇₃ из теорем динамики — то же, что θ̈, ψ̈, d(φ̇ + ψ̇ cos θ)/dt книги', () => {
    const p = { m: 2, a: 0.4, A: 0.1, C: 0.16, g: 9.81 };
    const { m, a, A, C, g } = p;
    for (const [th, dth, dpsi, w3] of [
      [0.2, 0.4, 1.3, 6],
      [-0.5, -0.7, 2.1, -3],
      [0.05, 0, 0.3, 8],
    ]) {
      const tb = th + Math.PI / 2; // θ книги — наклон к горизонту
      const s = Math.sin(tb),
        c = Math.cos(tb);
      const [, , u1, u2, u3] = rollRhs([th, 0, dth, dpsi * s, w3], p);
      const thdd = (A * dpsi * dpsi * s * c - (C + m * a * a) * w3 * dpsi * s - m * g * a * c) / (A + m * a * a);
      const psidd = (C * w3 * dth * s - 2 * A * dpsi * s * c * dth) / (A * s * s);
      const w3d = (m * a * a * dth * dpsi * s) / (C + m * a * a);
      expect(u1).toBeCloseTo(thdd, 10);
      expect(u2).toBeCloseTo(psidd * s + dpsi * c * dth, 10);
      expect(u3).toBeCloseTo(w3d, 10);
    }
  });
});

describe('55.11: второе решение (π/2 < θ₂ < π) неустойчиво', () => {
  it('θ₂ — максимум приведённой потенциальной энергии', () => {
    const pr = HAM_PRESETS.m5511.problem.routh;
    const θ2 = 2.466472329619157;
    const r = solveRouth({ ...pr, coords: [{ ...pr.coords[0], q0: θ2, eq: θ2 }, pr.coords[1]] });
    if (!r.ok) throw new Error(r.error);
    expect(r.steady!.residual).toBeLessThan(1e-8);
    expect(r.steady!.verdict).not.toBe('asym');
    expect(r.steady!.verdict).not.toBe('linear');
  });
});

describe('56.2: амплитуда за период умножается на (k₂/k₁)² = c₂/c₁', () => {
  it('максимумы виброграммы', () => {
    const r = solveNonlin(HAM_PRESETS.m562.problem.nonlin);
    if (!r.ok) throw new Error(r.error);
    const pk = r.measured!.peaks;
    expect(pk[0] / 13).toBeCloseTo(100 / 340, 3);
    expect(pk[1] / pk[0]).toBeCloseTo(100 / 340, 3);
    // Ряд книги 13,0; 7,05; 3,80; 2,05 мм — отношение за полпериода √(c₁/c₂) = 1,844.
    expect(Math.sqrt(3.4)).toBeCloseTo(13 / 7.05, 1);
  });
});

describe('56.12: амплитуда установившихся колебаний по интегрированию', () => {
  it('близка к радиусу цикла M₀/(πhk)', () => {
    const r = solveNonlin(HAM_PRESETS.m5612.problem.nonlin);
    if (!r.ok) throw new Error(r.error);
    expect(Math.abs(r.measured!.amp - 0.3 / (Math.PI * 0.05 * 2)) / (0.3 / (Math.PI * 0.05 * 2))).toBeLessThan(0.03);
  });
});

describe('52.6 и 52.9: положения равновесия по формулам книги', () => {
  it('52.6: наклонное положение — α = β, OA/OB = P₂/P₁', () => {
    const r = solveConstr({
      coords: ['x1', 'y1', 'x2', 'y2'],
      params: { P: 1, l: 1.5, a: 2, b: 1, R: 3 },
      Pi: 'P (y1 + a y2)',
      cons: ['sqrt(x1^2 + y1^2) + sqrt(x2^2 + y2^2) − R', '(x2 − x1)^2 + (y2 − y1)^2 − l^2', ''],
      fdef: '',
      keep: '−y1; −y2',
      box: 3,
    });
    if (!r.ok) throw new Error(r.error);
    const incl = r.sols.find((s) => Math.abs(s.q[0]) > 1e-6)!;
    const [x1, y1, x2, y2] = incl.q;
    expect(Math.hypot(x1, y1) / Math.hypot(x2, y2)).toBeCloseTo(2, 8);
    expect(Math.atan2(Math.abs(x1), -y1)).toBeCloseTo(Math.atan2(Math.abs(x2), -y2), 8);
  });
  it('52.9: горизонтальный стержень — sin φ₂ = l/(2b), а не √(l/2b)', () => {
    const [a, b, l] = [2, 1, 1.5];
    const r = solveConstr({
      coords: ['x1', 'y1', 'x2', 'y2'],
      params: { P: 1, l, a, b, R: 1 },
      Pi: 'P (y1 + y2)/2',
      cons: ['f(x1, y1)', 'f(x2, y2)', '(x2 − x1)^2 + (y2 − y1)^2 − l^2'],
      fdef: 'x^2/b^2 + y^2/a^2 − 1',
      keep: 'x2 − x1',
      box: 2.5,
    });
    if (!r.ok) throw new Error(r.error);
    const hor = r.sols.filter((s) => Math.abs(s.q[1] - s.q[3]) < 1e-8);
    expect(hor.length).toBeGreaterThan(0);
    for (const s of hor) {
      const sinφ2 = s.q[2] / b; // x = b sin φ
      expect(Math.abs(sinφ2)).toBeCloseTo(l / (2 * b), 8);
      expect(Math.abs(Math.abs(sinφ2) - Math.sqrt(l / (2 * b)))).toBeGreaterThan(0.1);
    }
  });
});
