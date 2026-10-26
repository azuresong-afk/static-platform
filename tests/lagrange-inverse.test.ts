/** Пункт 29, «Уравнения Лагранжа»: 47.13, 47.16 и обратная задача — параметр по положению равновесия (47.17–47.19). */
import { describe, expect, it } from 'vitest';
import { docHTML } from '../src/shared/doc';
import { findEquilibria, type EquilResult } from '../src/modules/lagrange/model/equil';
import { findInverse } from '../src/modules/lagrange/model/inverse';
import { inverseSteps } from '../src/modules/lagrange/text/inverse';
import { solveLagrange } from '../src/modules/lagrange/model/lagrange';
import { LAGRANGE_PRESETS } from '../src/modules/lagrange/presets';
import { LagrangeStore, parseProblem } from '../src/modules/lagrange/ui/store';

const G = 9.81;
const inv = (k: keyof typeof LAGRANGE_PRESETS) => {
  const pr = LAGRANGE_PRESETS[k].problem;
  const er = findEquilibria(pr) as EquilResult;
  expect(er.ok).toBe(true);
  const iv = findInverse(pr, er)!;
  if (!iv.ok) throw new Error(iv.error);
  const t = inverseSteps(er, iv, { explain: true });
  expect(docHTML({ steps: t.steps })).not.toContain('NaN');
  return iv;
};

describe('обратная задача: параметр по положению равновесия', () => {
  it('47.17: ω² = g(P₁ + P₂ + 2lc(1 − cos α))·tg α/(P₂(a + l sin α))', () => {
    const iv = inv('m4717');
    const [P1, P2, l, a, c, al] = [10, 5, 0.3, 0.05, 100, Math.PI / 6];
    const w = Math.sqrt((G * (P1 + P2 + 2 * l * c * (1 - Math.cos(al))) * Math.tan(al)) / (P2 * (a + l * Math.sin(al))));
    expect(iv.split?.k).toBe(2);
    expect(iv.roots).toHaveLength(1);
    expect(iv.roots[0].p).toBeCloseTo(w, 9);
    expect(iv.roots[0].anyQ).toBe(false);
  });
  it('47.18: n = 188 об/мин', () => {
    const iv = inv('m4718');
    expect(iv.roots).toHaveLength(1);
    expect(Math.abs(iv.roots[0].p - 188)).toBeLessThan(0.5);
  });
  it('47.19: ω = √(2gQa/(Pl²)), равновесие безразличное при любом φ', () => {
    const iv = inv('m4719');
    expect(iv.roots).toHaveLength(1);
    expect(iv.roots[0].p).toBeCloseTo(Math.sqrt((2 * G * 5 * 0.1) / (2 * 0.3 * 0.3)), 9);
    expect(iv.roots[0].anyQ).toBe(true);
  });
  it('без разложения по степеням — перебором на отрезке', () => {
    // Π = c(x − a)² + x·sin a: F = −2c(x − a) − sin a, a входит не только множителем.
    const pr = {
      coords: [{ name: 'x', q0: 0, v0: 0, Q: '', eq: 0.7 }],
      params: [
        { name: 'c', value: 2 },
        { name: 'a', value: 0 },
      ],
      T: '',
      P: 'c (x − a)^2 + x sin a',
      tEnd: 0,
      eqSearch: { from: -2, to: 2 },
      inverse: { param: 'a', from: -1, to: 1.5 },
    };
    const er = findEquilibria(pr) as EquilResult;
    const iv = findInverse(pr, er)!;
    expect(iv.ok).toBe(true);
    if (!iv.ok) return;
    expect(iv.split).toBeNull();
    expect(iv.roots).toHaveLength(1);
    const a = iv.roots[0].p;
    expect(Math.abs(-4 * (0.7 - a) - Math.sin(a))).toBeLessThan(1e-9);
  });
  it('параметр не входит в условие — сообщение', () => {
    const pr = { ...LAGRANGE_PRESETS.m4716.problem, inverse: { param: 'g', from: 0, to: 10 } };
    const pr2 = { ...pr, P: '−2 (p + p1) l cos φ', T: "(p/g) l^2 (φ'^2 + ω^2 sin(φ)^2)", params: pr.params };
    const er = findEquilibria(pr2) as EquilResult;
    const iv = findInverse({ ...pr2, inverse: { param: 'p1', from: 0, to: 10 } }, er)!;
    expect(iv.ok).toBe(true);
    const bad = findInverse({ ...pr2, inverse: { param: 'нет', from: 0, to: 10 } }, er)!;
    expect(bad.ok).toBe(false);
  });
  it('файл проекта сохраняет обратную задачу, отмена снимает её', () => {
    const st = new LagrangeStore({ preset: 'm4716' });
    st.setInverse(true);
    expect(st.get().problem.inverse).toBeTruthy();
    const back = parseProblem(JSON.parse(JSON.stringify(st.get().problem)));
    expect(back.ok && back.problem.inverse).toEqual(st.get().problem.inverse);
    st.undo();
    expect(st.get().problem.inverse ?? null).toBeNull();
  });
});

describe('47.13, 47.16', () => {
  it('47.13: ẍ = 8gF/(8Q + 9P)', () => {
    const r = solveLagrange(LAGRANGE_PRESETS.m4713.problem);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const sim = r.sim!;
    const k = sim.t.length - 1;
    // x = w·t²/2
    const w = (8 * G * 2) / (8 * 10 + 9 * 5);
    expect(sim.q[0][k]).toBeCloseTo((w * sim.t[k] * sim.t[k]) / 2, 6);
  });
  it('47.16: cos φ = (p + p₁)g/(p·l·ω²)', () => {
    const er = findEquilibria(LAGRANGE_PRESETS.m4716.problem) as EquilResult;
    const phi = Math.acos(((5 + 10) * G) / (5 * 0.3 * 225));
    expect(er.points.some((p) => Math.abs(p.q[0] - phi) < 1e-7)).toBe(true);
  });
});
