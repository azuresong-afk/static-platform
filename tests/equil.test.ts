/** «Уравнения Лагранжа»: положения равновесия и устойчивость — Яблонский Д.22, Мещерский 52.4, 48.27, независимые проверки. */
import { describe, expect, it } from 'vitest';
import { findEquilibria, type EquilResult } from '../src/modules/lagrange/model/equil';
import { solveLagrange, type LagProblem } from '../src/modules/lagrange/model/lagrange';
import { LAGRANGE_PRESETS } from '../src/modules/lagrange/presets';
import { equilSteps } from '../src/modules/lagrange/text/equil';
import { LagrangeStore, parseProblem } from '../src/modules/lagrange/ui/store';
import { inlineText, type Doc } from '../src/shared/doc';
import { docText } from './helpers/doctext';

const ok = (pr: LagProblem): EquilResult => {
  const r = findEquilibria(pr);
  if (!r || !r.ok) throw new Error(r ? r.error : 'нет поиска');
  return r;
};
const deg = (x: number) => (x * 180) / Math.PI;
const one = (P: string, params: Record<string, number>, from: number, to: number, o: Partial<LagProblem> = {}): LagProblem => ({
  coords: [{ name: 'φ', q0: 0, v0: 0, eq: 0, Q: '' }],
  params: Object.entries(params).map(([name, value]) => ({ name, value })),
  T: '',
  P,
  tEnd: 0,
  eqSearch: { from, to },
  ...o,
});

describe('Яблонский, Д.22 (пример)', () => {
  const r = ok(LAGRANGE_PRESETS.yd22.problem);
  it('шесть положений: 0 (излом, минимум), 60° и 300° (максимум), 112,89° и 247,11° (минимум), 180° (максимум)', () => {
    expect(r.points.map((p) => +deg(p.q[0]).toFixed(2))).toEqual([0, 60, 112.89, 180, 247.11, 300]);
    expect(r.points.map((p) => p.stable)).toEqual(['stable', 'unstable', 'stable', 'unstable', 'stable', 'unstable']);
    expect(r.points[0]).toMatchObject({ kind: 'kink' });
    // Книга: sin(φ/2) = 5/6 и 1/2; dΠ/dφ справа от нуля = 2cl²·1,25·0,5 = 1,25.
    expect(Math.sin(r.points[2].q[0] / 2)).toBeCloseTo(5 / 6, 12);
    expect(r.points[0].jump![0]).toBeCloseTo(1.25, 9);
    expect(r.points[0].jump![1]).toBeCloseTo(-1.25, 9);
  });
  it('T не задана — уравнения движения не выводятся, но статика решается', () => {
    expect(solveLagrange(LAGRANGE_PRESETS.yd22.problem)).toMatchObject({ ok: false, field: 'T' });
    const t = docText({ steps: equilSteps(r, { explain: true, hasT: false }).steps } as Doc);
    expect(t).toMatch(/излом W — обобщённая сила меняет знак скачком: слева F = 1,25, справа F = −1,25/);
    expect(t).toMatch(/φ\* = 1,9702 \(112,89°\): K = W″ = 0,1528 > 0 — минимум W, равновесие устойчиво/);
    expect(t).toMatch(/Кинетическая энергия не задана/);
  });
});

describe('Мещерский 52.4 и 48.27', () => {
  it('52.4: sin³φ = a/l при разных a; Π″ < 0 — неустойчиво', () => {
    for (const a of [0.1, 0.3, 0.6]) {
      const r = ok({
        ...LAGRANGE_PRESETS.m524.problem,
        params: [
          { name: 'P', value: 1 },
          { name: 'l', value: 1 },
          { name: 'a', value: a },
        ],
      });
      expect(r.points).toHaveLength(1);
      expect(Math.sin(r.points[0].q[0]) ** 3).toBeCloseTo(a, 10);
      expect(r.points[0].stable).toBe('unstable');
    }
  });
  it('48.27: относительное равновесие cos θ = g/(aω²) устойчиво, θ = 0 и π — нет; частота ω² = K/(ma²)', () => {
    const r = ok(LAGRANGE_PRESETS.m4827.problem);
    expect(r.T0.length).toBeGreaterThan(0);
    const th = Math.acos(9.81 / 16);
    expect(r.points.map((p) => +p.q[0].toFixed(9) || 0)).toEqual([-th, 0, th, Math.PI].map((x) => +x.toFixed(9)));
    expect(r.points.map((p) => p.stable)).toEqual(['stable', 'unstable', 'stable', 'unstable']);
    // W″ = mga cos θ − ma²ω² cos 2θ.
    expect(r.points[2].k[0]).toBeCloseTo(9.81 * Math.cos(th) - 16 * Math.cos(2 * th), 9);
    expect(r.points[2].w2![0]).toBeCloseTo(r.points[2].k[0], 9);
    // При aω² < g боковых положений нет, нижнее устойчиво.
    const slow = ok({
      ...LAGRANGE_PRESETS.m4827.problem,
      params: [
        { name: 'm', value: 1 },
        { name: 'a', value: 1 },
        { name: 'ω', value: 2 },
        { name: 'g', value: 9.81 },
      ],
    });
    expect(slow.points.map((p) => [+p.q[0].toFixed(9) || 0, p.stable])).toEqual([
      [0, 'stable'],
      [+Math.PI.toFixed(9), 'unstable'],
    ]);
    const t = docText({ steps: equilSteps(r, { explain: false, hasT: true }).steps } as Doc);
    expect(t).toMatch(/W = Π − T₀ = /);
    expect(t).toMatch(/частота малых колебаний ω = √\(K\/A\) = 3,1599 рад\/с/);
  });
});

describe('высшие производные, непотенциальные силы, несколько координат', () => {
  it('Π = φ⁴ — W″ = 0, W⁽⁴⁾ > 0: устойчиво; Π = φ³ — перегиб, неустойчиво; Π = const — безразличное', () => {
    expect(ok(one('k φ^4', { k: 1 }, -1, 1.3)).points).toMatchObject([{ stable: 'stable', higher: { order: 4 } }]);
    expect(ok(one('φ^3', {}, -1, 1.3)).points).toMatchObject([{ stable: 'unstable', higher: { order: 3 } }]);
    const ind = ok(one('k', { k: 2 }, -1, 1));
    expect(ind.indifferent).toBe(true);
    expect(docText({ steps: equilSteps(ind, { explain: false, hasT: false }).steps } as Doc)).toMatch(/любое положение — положение безразличного равновесия/);
  });
  it('маятник с постоянным моментом: sin φ = M/(mgl); устойчиво в нижнем, неустойчиво в верхнем', () => {
    const pr = one('−m g l cos φ', { m: 1, g: 10, l: 2, M: 5 }, -3.1415, 3.1416, { coords: [{ name: 'φ', q0: 0, v0: 0, eq: 0, Q: 'M' }], T: "m l^2 φ'^2/2" });
    const r = ok(pr);
    expect(r.nonPot).toBe(true);
    const s = Math.asin(5 / 20);
    expect(r.points.map((p) => [+p.q[0].toFixed(9), p.stable])).toEqual([
      [+s.toFixed(9), 'stable'],
      [+(Math.PI - s).toFixed(9), 'unstable'],
    ]);
    expect(r.points[0].w2![0]).toBeCloseTo((20 * Math.cos(s)) / 4, 9);
  });
  it('полюс не принимается за равновесие: Π = tg φ на (−3; 3)', () => {
    // dΠ/dφ = 1/cos²φ ≠ 0: равновесий нет, хотя при ±π/2 сила разрывна.
    expect(ok(one('tg φ', {}, -3, 3)).points).toEqual([]);
  });
  it('двойной маятник (две координаты): Ньютон от приближения, нижнее — устойчиво, «верх — низ» — неустойчиво', () => {
    const base: LagProblem = {
      coords: [
        { name: 'φ1', q0: 0, v0: 0, eq: 0.2, Q: '' },
        { name: 'φ2', q0: 0, v0: 0, eq: -0.1, Q: '' },
      ],
      params: [
        { name: 'm', value: 1 },
        { name: 'l', value: 1 },
        { name: 'g', value: 9.81 },
      ],
      T: "m l^2 (2 φ1'^2 + φ2'^2 + 2 φ1' φ2' cos(φ1 − φ2))/2",
      P: '−m g l (2 cos φ1 + cos φ2)',
      tEnd: 0,
      eqSearch: { from: 0, to: 1 },
    };
    const low = ok(base);
    expect(low.mode).toBe('newton');
    expect(low.points[0].q.map((x) => Math.abs(x) < 1e-12)).toEqual([true, true]);
    expect(low.points[0].stable).toBe('stable');
    // Частоты двойного маятника: ω² = (2 ± √2) g/l.
    expect(low.points[0].w2!.map((w) => +w.toFixed(6))).toEqual([(2 - Math.SQRT2) * 9.81, (2 + Math.SQRT2) * 9.81].map((w) => +w.toFixed(6)));
    const up = ok({
      ...base,
      coords: [
        { ...base.coords[0], eq: 3 },
        { ...base.coords[1], eq: 0.1 },
      ],
    });
    expect(up.points[0].q[0]).toBeCloseTo(Math.PI, 10);
    expect(up.points[0].stable).toBe('unstable');
  });
});

describe('хранилище и файл', () => {
  it('включение поиска, отрезок, отмена; файл туда-обратно', () => {
    const s = new LagrangeStore({ preset: 'm4811' });
    s.setEqSearch(true);
    expect(s.get().problem.eqSearch).toEqual({ from: -3.1415, to: 3.1416 });
    s.typeEqRange('to', 2);
    s.endSession('eq:to');
    expect(s.get().problem.eqSearch?.to).toBe(2);
    const s2 = new LagrangeStore();
    expect(s2.importProject(s.exportProject().text)).toBe(true);
    expect(s2.get().problem.eqSearch).toEqual({ from: -3.1415, to: 2 });
    s.undo();
    s.undo();
    expect(s.get().problem.eqSearch).toBeFalsy();
    expect(parseProblem({ ...LAGRANGE_PRESETS.yd22.problem, eqSearch: { from: 1, to: 0 } }).ok).toBe(false);
  });
  it('отдельные строки ответа', () => {
    const r = ok(LAGRANGE_PRESETS.yd22.problem);
    const rows = equilSteps(r, { explain: false, hasT: false }).rows.map((x) => inlineText(x.val) + ' — ' + x.note);
    expect(rows[0]).toBe('φ* = 0 (0°) — устойчиво');
    expect(rows[1]).toBe('φ* = 1,0472 (60°) — неустойчиво');
  });
});

describe('случайные потенциалы (независимая проверка мелким перебором)', () => {
  it('Π = Σ aₖ sin kφ + bₖ cos kφ: те же корни Π′, устойчивость — по знаку Π″', () => {
    let seed = 20261012;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648) * 2 - 1;
    for (let n = 0; n < 60; n++) {
      const a = [rnd(), rnd(), rnd()],
        bb = [rnd(), rnd(), rnd()];
      const P = a.map((x, k) => `${x.toFixed(6)} sin(${k + 1} φ) + ${bb[k].toFixed(6)} cos(${k + 1} φ)`).join(' + ');
      const A = a.map((x) => +x.toFixed(6)),
        B = bb.map((x) => +x.toFixed(6));
      const dP = (x: number) => A.reduce((s, ak, k) => s + ak * (k + 1) * Math.cos((k + 1) * x) - B[k] * (k + 1) * Math.sin((k + 1) * x), 0);
      const d2P = (x: number) => A.reduce((s, ak, k) => s - ak * (k + 1) ** 2 * Math.sin((k + 1) * x) - B[k] * (k + 1) ** 2 * Math.cos((k + 1) * x), 0);
      const lo = -3,
        hi = 3;
      const brute: number[] = [];
      const M = 200000;
      for (let i = 0; i < M; i++) {
        const x0 = lo + ((hi - lo) * i) / M,
          x1 = lo + ((hi - lo) * (i + 1)) / M;
        if (dP(x0) * dP(x1) < 0) brute.push((x0 + x1) / 2);
      }
      const r = ok(one(P.replace(/\+ -/g, '− '), {}, lo, hi));
      expect(r.points.length, P).toBe(brute.length);
      r.points.forEach((p, i) => {
        expect(Math.abs(p.q[0] - brute[i])).toBeLessThan(1e-4);
        expect(p.stable).toBe(d2P(p.q[0]) > 0 ? 'stable' : 'unstable');
      });
    }
  });
});
