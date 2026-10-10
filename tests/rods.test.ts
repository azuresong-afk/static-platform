/** Стержневые системы: схемы Антонова (гл. 3, п. 4.5), типовые задачи и независимые проверки. */
import { describe, expect, it } from 'vitest';
import { solveRods, type RodProblem, type RodResult } from '../src/modules/rods/model/rods';
import { newLoad, newRod, newSupport, ROD_PRESETS } from '../src/modules/rods/presets';

const tol = (v: number) => {
  const s = String(Math.abs(v));
  const d = s.includes('.') ? s.split('.')[1].length : 0;
  return 2 * Math.pow(10, -d);
};

function values(pr: RodProblem, r: RodResult): Record<string, number> {
  const out: Record<string, number> = { degree: r.degree };
  r.base?.rods.forEach((s, i) => (out['N' + (i + 1)] = s.N));
  const P = pr.loads[0]?.F ?? 1;
  if (r.limit) {
    out.Pallow = r.limit.lamAllow * P;
    out.Plim = r.limit.lamU * P;
    out.PlimN = (r.limit.lamU * P) / pr.n;
    out.ratio = r.limit.lamU / pr.n / r.limit.lamAllow;
  }
  return out;
}

describe('готовые задачи', () => {
  for (const [key, p] of Object.entries(ROD_PRESETS))
    it(p.title, () => {
      const r = solveRods(p.problem);
      expect(r.ok, key + r.errors.join()).toBe(true);
      expect(r.residual, 'невязка равновесия').toBeLessThan(1e-9);
      if ('book' in p) {
        const got = values(p.problem, r);
        for (const [k, book] of Object.entries(p.book)) expect(Math.abs(got[k] - book), `${k}: ${got[k]} против ${book}`).toBeLessThanOrEqual(tol(book));
      }
      // Уравнения совместности выполняются.
      for (const c of r.compat) {
        const dl = r.base!.rods.map((s) => s.dl);
        const rhs = c.base.reduce((s, b, j) => s + c.w[j] * dl[b], 0);
        expect(dl[c.k]).toBeCloseTo(rhs, 9);
      }
    });
});

describe('независимые проверки', () => {
  it('рис. 3.10: N = Δ/(l₁/(EA₁) + l₂/(EA₂))', () => {
    const r = solveRods(ROD_PRESETS.a310.problem);
    const E = 2e5,
      A1 = 400,
      A2 = 800;
    const N = 0.2 / (400 / (E * A1) + 600 / (E * A2)) / 1000;
    expect(r.base!.rods[0].N).toBeCloseTo(N, 9);
    expect(r.base!.rods[1].N).toBeCloseTo(N, 9);
    expect(r.collinear).toBe(true);
    expect(r.degree).toBe(1);
  });
  it('стержень между двумя заделками нагрет: σ = −EαΔT', () => {
    const pr: RodProblem = { ...ROD_PRESETS.a310.problem, rods: [newRod({ ang: 180, l: 1, dT: 50 }), newRod({ ang: 0, l: 1, dT: 50 })] };
    const r = solveRods(pr);
    expect(r.base!.rods[0].sigma).toBeCloseTo(-2e5 * 1.25e-5 * 50, 9);
  });
  it('брус на шарнире: предельный множитель = Σσт·A_i·|h_i| / M нагрузки (одна степень свободы)', () => {
    const pr = ROD_PRESETS.a38.problem;
    const r = solveRods({ ...pr, ask: 'limit', A: 2, sT: 240, n: 1.5 });
    const NT = 240 * 200; // Н
    const arms = [2.5, 1.5, 0.5].map((h) => h * 1000);
    const Mload = 50 * 1000 * (3 - 0.3) * 1000;
    expect(r.limit!.lamU).toBeCloseTo((NT * arms.reduce((s, h) => s + h, 0)) / Mload, 9);
    expect(r.limit!.atYield.every(Boolean)).toBe(true);
    expect(r.degree).toBe(2);
  });
  it('подбор площади: при A_min наибольшее |σ| равно [σ], в том числе с нагревом', () => {
    for (const heat of [0, 30]) {
      const pr: RodProblem = {
        ...ROD_PRESETS.mix.problem,
        ask: 'design',
        rods: ROD_PRESETS.mix.problem.rods.map((r, i) => ({ ...r, dT: i === 1 ? heat : 0, delta: 0 })),
      };
      const r = solveRods(pr);
      expect(r.ok, r.errors.join()).toBe(true);
      const chk = solveRods({ ...pr, ask: 'check', A: r.design!.Amin });
      expect(Math.abs(chk.sigmaMax!.v)).toBeCloseTo(160, 6);
    }
  });
  it('допускаемая нагрузка: при λ·F наибольшее |σ| равно [σ]', () => {
    const pr = ROD_PRESETS.bar2.problem;
    const r = solveRods(pr);
    const lam = r.allow!.lam;
    const chk = solveRods({ ...pr, ask: 'check', loads: pr.loads.map((l) => ({ ...l, F: l.F * lam })) });
    expect(Math.abs(chk.sigmaMax!.v)).toBeCloseTo(160, 6);
    // 1,2F/(2A·...): |σ₂| = 1,2·λ·100 кН / 5 см² ·10 = 160 МПа.
    expect(lam * 100).toBeCloseTo((160 * 5) / 10 / 1.2, 9);
  });
  it('силы и пары на брусе без шарнира: три стержня держат брус', () => {
    const pr: RodProblem = {
      body: 'bar',
      L: 2,
      supports: [],
      rods: [newRod({ x: 0, ang: 90 }), newRod({ x: 2, ang: 90 }), newRod({ x: 1, ang: 180 })],
      loads: [newLoad({ x: 1, F: 10 }), newLoad({ kind: 'M', F: 4 })],
      A: 1,
      ask: 'check',
      sAllow: 160,
      sT: 240,
      n: 1.5,
    };
    const r = solveRods(pr);
    expect(r.degree).toBe(0);
    // ΣM относительно левого конца: N₂·2 − 10·1 + 4 = 0 ⇒ N₂ = 3; ΣY: N₁ + N₂ = 10 ⇒ N₁ = 7.
    expect(r.base!.rods[1].N).toBeCloseTo(3, 9);
    expect(r.base!.rods[0].N).toBeCloseTo(7, 9);
    expect(r.base!.rods[2].N).toBeCloseTo(0, 9);
  });
  it('механизм и зависимые опоры распознаются', () => {
    const one: RodProblem = { ...ROD_PRESETS.det2.problem, rods: [newRod({ ang: 90 })], loads: [newLoad({ F: 10, ang: 0 })] };
    expect(solveRods(one).ok).toBe(false);
    const two: RodProblem = { ...ROD_PRESETS.bar2.problem, supports: [newSupport({ x: 0 }), newSupport({ x: 3 })] };
    expect(solveRods(two).ok).toBe(false);
  });
});

describe('файл проекта и правка', () => {
  it('каждая готовая задача сохраняется и открывается без потерь', async () => {
    const { RodsStore, parseRods } = await import('../src/modules/rods/ui/store');
    for (const k of Object.keys(ROD_PRESETS) as (keyof typeof ROD_PRESETS)[]) {
      const s = new RodsStore({ preset: k });
      const { text } = s.exportProject(new Date(2026, 0, 1));
      const t = new RodsStore();
      expect(t.importProject(text), k).toBe(true);
      expect(t.get().problem).toEqual(ROD_PRESETS[k].problem);
      expect(parseRods(JSON.parse(text).problem).ok).toBe(true);
    }
  });
  it('узел ↔ брус, добавление стержня, отмена', async () => {
    const { RodsStore } = await import('../src/modules/rods/ui/store');
    const s = new RodsStore({ preset: 'a44' });
    s.addRod();
    expect(s.get().problem.rods.length).toBe(4);
    expect(solveRods(s.get().problem).degree).toBe(2);
    s.setBody('bar');
    expect(s.get().problem.supports.length).toBe(1);
    s.undo();
    s.undo();
    expect(s.get().problem).toEqual(ROD_PRESETS.a44.problem);
  });
});
