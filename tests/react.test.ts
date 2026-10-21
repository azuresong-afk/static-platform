/** Реакция связей на тело и отрыв (Мещерский §43), программное движение (Яблонский, Д.20) во вкладке «Уравнения Лагранжа». */
import { describe, expect, it } from 'vitest';
import { renderPlots } from '../src/modules/lagrange/draw/plots';
import { solveLagrange, type LagProblem } from '../src/modules/lagrange/model/lagrange';
import { solveReact } from '../src/modules/lagrange/model/react';
import { LAGRANGE_PRESETS, type LagrangePresetKey } from '../src/modules/lagrange/presets';
import { reactSteps } from '../src/modules/lagrange/text/react';
import { lagrangeDoc } from '../src/modules/lagrange/text/solution';
import { LagrangeStore, parseProblem } from '../src/modules/lagrange/ui/store';
import { docHTML } from '../src/shared/doc';
import { setCoordNames, symText } from '../src/shared/sym';

const G = 9.81;
const run = (pr: LagProblem) => {
  const s = solveLagrange(pr);
  if (!s.ok) throw new Error(s.error);
  setCoordNames(s.ctx.coords);
  const r = solveReact(pr, s);
  if (!r.ok) throw new Error(r.error);
  return { s, r };
};
const preset = (k: LagrangePresetKey) => run(LAGRANGE_PRESETS[k].problem);
const par = (k: LagrangePresetKey, n: string) => LAGRANGE_PRESETS[k].problem.params.find((p) => p.name === n)!.value;

describe('§43: ответы книги', () => {
  it('43.1: ω = √(3g/(2l)), парабола y = −l − x²/(3l)', () => {
    const { r } = preset('m431');
    const l = par('m431', 'l');
    expect(r.event!.kind).toBe('stop');
    expect(r.event!.omega!).toBeCloseTo(Math.sqrt((3 * G) / (2 * l)), 8);
    expect(r.flight!.parabola!.c).toBeCloseTo(-1 / (3 * l), 8);
    expect(r.flight!.parabola!.a).toBeCloseTo(-l, 8);
  });
  it('43.2: ω = √(3g/l), y_C = l/2 − 2x²/(3l)', () => {
    const { r } = preset('m432');
    const l = par('m432', 'l');
    expect(Math.abs(r.event!.omega!)).toBeCloseTo(Math.sqrt((3 * G) / l), 8);
    expect(r.flight!.parabola!.c).toBeCloseTo(-2 / (3 * l), 8);
    expect(r.flight!.parabola!.a).toBeCloseTo(l / 2, 8);
  });
  it('43.4: натяжения 2T = 2P₁P₂/(2(3P₁ + 2P₂)), ω₁(t)', () => {
    const { s, r } = preset('m434');
    const [m1, m2, r1] = ['m1', 'm2', 'r1'].map((n) => par('m434', n));
    const T = (m1 * m2 * G) / (2 * (3 * m1 + 2 * m2));
    for (const x of r.body!.series!.n) expect(x).toBeCloseTo(2 * T, 8);
    const k = s.sim!.t.length - 1;
    expect(s.sim!.v[0][k]).toBeCloseTo((2 * G * m2 * s.sim!.t[k]) / (r1 * (3 * m1 + 2 * m2)), 8);
  });
  it('43.5: отрыв от стены при sin φ₁ = (2/3) sin φ₀; R_x(φ) в буквах', () => {
    const { r } = preset('m435');
    expect(r.event!.kind).toBe('sep');
    expect(Math.sin(r.event!.q[0])).toBeCloseTo((2 / 3) * Math.sin(par('m435', 'φ0')), 8);
    expect(symText(r.body!.ReQ!)).toBe('−3·g·m·sin φ₀·cos φ/2 + 9·g·m·sin φ·cos φ/4');
  });
  it('43.7: R_y касается нуля при cos α = 1/3', () => {
    const { r } = preset('m437');
    expect(r.event!.kind).toBe('touch');
    expect(Math.cos(r.event!.q[0])).toBeCloseTo(1 / 3, 6);
  });
  it('43.10: R = P cos φ + 2Pa²(cos φ − cos φ₀)/(ρ² + a²), N = Pρ² sin φ/(ρ² + a²)', () => {
    const { r } = preset('m4310');
    expect(symText(r.body!.ReQ!)).toBe('−2·a²·g·m·(cos φ₀ − cos φ)/(a² + ρ²) + g·m·cos φ');
    const [a, ρ, φ0] = ['a', 'ρ', 'φ0'].map((n) => par('m4310', n));
    expect(-r.body!.R0[1]).toBeCloseTo((G * ρ * ρ * Math.sin(φ0)) / (ρ * ρ + a * a), 10);
  });
  it('43.11: cos α = 4/7, ω = 2√(g/(7r)); нормальная реакция (7 cos θ − 4)mg/3', () => {
    const { r } = preset('m4311');
    expect(symText(r.body!.ReQ!)).toBe('7·g·m·cos θ/3 − 4·g·m/3');
    expect(Math.cos(r.event!.q[0])).toBeCloseTo(4 / 7, 6);
    expect(r.event!.omega!).toBeCloseTo(2 * Math.sqrt(G / (7 * par('m4311', 'r'))), 5);
  });
  it('43.12: ω = (2m cos α/R)√(2gh/((M + 2m)(M + 2m sin²α)))', () => {
    const { r } = preset('m4312');
    const [M, m, R, α, h] = ['M', 'm', 'R', 'α', 'h'].map((n) => par('m4312', n));
    expect(Math.abs(r.event!.v[1])).toBeCloseTo(((2 * m * Math.cos(α)) / R) * Math.sqrt((2 * G * h) / ((M + 2 * m) * (M + 2 * m * Math.sin(α) ** 2))), 8);
  });
});

describe('Д.20: программное движение', () => {
  it('пример книги: P = 33,90 Н, M = −4,39 Н·м при t = τ/2', () => {
    const { r } = preset('yd20');
    expect(r.program!.Qat[0]).toBeCloseTo(33.9, 1);
    expect(r.program!.Qat[1]).toBeCloseTo(-4.39, 2);
  });
});

describe('текст, графики, файл проекта', () => {
  it('решение и графики строятся для всех задач вкладки', () => {
    for (const [k, p] of Object.entries(LAGRANGE_PRESETS)) {
      const s = solveLagrange(p.problem);
      if (!s.ok) continue;
      const r = solveReact(p.problem, s);
      if (!r.ok) throw new Error(k + ': ' + r.error);
      const base = lagrangeDoc(p.problem, s, { explain: true });
      const rs = reactSteps(p.problem, s, r, { explain: true });
      const html = docHTML({ steps: [...base.steps, ...rs.steps] });
      expect(html, k).not.toContain('NaN');
      expect(html, k).not.toContain('undefined');
      const pl = renderPlots(s, r);
      if (pl) expect(pl.svg, k).not.toContain('NaN');
    }
  });
  it('сохраняется и открывается; старый файл без новых полей открывается', () => {
    for (const k of ['m431', 'm4310', 'yd20'] as const) {
      const a = new LagrangeStore({ preset: k });
      const f = a.exportProject(new Date(2026, 9, 21));
      const b = new LagrangeStore({ preset: 'm4811' });
      expect(b.importProject(f.text, f.name)).toBe(true);
      expect(b.get().problem).toEqual(a.get().problem);
    }
    expect(parseProblem({ ...LAGRANGE_PRESETS.m4811.problem }).ok).toBe(true);
    expect(parseProblem({ ...LAGRANGE_PRESETS.m431.problem, body: { m: 'm' } }).ok).toBe(false);
  });
  it('программа следует за числом координат', () => {
    const st = new LagrangeStore({ preset: 'yd20' });
    st.addCoord();
    expect(st.get().problem.program!.laws.length).toBe(3);
    st.removeCoord(2);
    expect(st.get().problem.program!.laws.length).toBe(2);
  });
});
