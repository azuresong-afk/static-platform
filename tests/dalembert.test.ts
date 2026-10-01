/** Принцип Даламбера: давления вращающегося тела на ось — ответы Мещерского §42 и проверка по точкам. */
import { describe, expect, it } from 'vitest';
import { solveShaft, type ShaftProblem } from '../src/modules/dalembert/model/shaft';
import { SHAFT_PRESETS, type ShaftPresetKey } from '../src/modules/dalembert/presets';
import { renderShaft } from '../src/modules/dalembert/draw/shaft';
import { shaftDoc } from '../src/modules/dalembert/text/solution';
import { ShaftStore, parseShaft } from '../src/modules/dalembert/ui/store';

const tol = (v: number, rel?: number) => {
  if (rel) return rel * Math.abs(v) + 1e-9;
  const s = String(Math.abs(v));
  const d = s.includes('.') ? s.split('.')[1].length : 0;
  return d > 6 ? 1e-9 * Math.max(1, Math.abs(v)) : 2 * Math.pow(10, -d);
};

describe('Мещерский §42', () => {
  for (const [key, p] of Object.entries(SHAFT_PRESETS))
    it(p.title, () => {
      const r = solveShaft(p.problem as ShaftProblem);
      expect(r.ok, key + r.errors.join()).toBe(true);
      const { dyn, stat, total } = r;
      const got: Record<string, number> = {
        dXA: -dyn.XA,
        dYA: -dyn.YA,
        dXB: -dyn.XB,
        dYB: -dyn.YB,
        dNA: Math.hypot(dyn.XA, dyn.YA),
        dNB: Math.hypot(dyn.XB, dyn.YB),
        sNA: Math.hypot(stat.XA, stat.YA),
        sNB: Math.hypot(stat.XB, stat.YB),
        pYA: -total.YA,
        pYB: -total.YB,
        pZA: -total.ZA,
      };
      const rel = (p as { relTol?: number }).relTol;
      for (const [k, book] of Object.entries((p as { book: Record<string, number> }).book)) expect(Math.abs(got[k] - book), `${k}: ${got[k]} против ${book}`).toBeLessThanOrEqual(tol(book, rel));
    });
});

describe('независимая проверка: тело как набор точек', () => {
  it('силы инерции по точкам дают те же реакции (42.10, цилиндр разбит на 40 000 точек)', () => {
    const pr = SHAFT_PRESETS.m4210.problem as ShaftProblem;
    const q = pr.parts[0];
    const u = q.u.map((x) => x / Math.hypot(...q.u));
    const e1 = [1, 0, 0],
      e2 = [u[1] * e1[2] - u[2] * e1[1], u[2] * e1[0] - u[0] * e1[2], u[0] * e1[1] - u[1] * e1[0]];
    const N = 40000,
      mass = q.m / 9.81;
    const pts: number[][] = [];
    // Равномерные точки в цилиндре (детерминированная сетка по r², углу и высоте).
    for (let i = 0; i < 20; i++)
      for (let j = 0; j < 20; j++)
        for (let k = 0; k < 100; k++) {
          const rr = q.p.R * Math.sqrt((i + 0.5) / 20),
            th = (2 * Math.PI * (j + 0.5)) / 20,
            zz = q.p.h * ((k + 0.5) / 100 - 0.5);
          pts.push([0, 1, 2].map((a) => rr * Math.cos(th) * e1[a] + rr * Math.sin(th) * e2[a] + zz * u[a]));
        }
    // Центробежные силы m ω² (x, y, 0) в точках; реакции подшипников.
    const w2 = pr.omega ** 2;
    let Lx = 0,
      Fy = 0;
    for (const p of pts) {
      const f = [(mass / N) * w2 * p[0], (mass / N) * w2 * p[1], 0];
      Fy += f[1];
      Lx += p[1] * f[2] - p[2] * f[1];
    }
    const d = pr.zB - pr.zA;
    const ya = (-Lx - pr.zB * Fy) / d;
    expect(Math.abs(solveShaft(pr).dyn.YA / ya - 1)).toBeLessThan(2e-4);
  });
  it('без вращения — только статика; ε даёт вращающий момент J_z·ε', () => {
    const pr = { ...(SHAFT_PRESETS.m429.problem as ShaftProblem), omega: 0 };
    const r = solveShaft(pr);
    expect(r.dyn.YA).toBe(0);
    expect(r.Mz).toBeCloseTo(r.Jz * pr.eps, 12);
  });
});

describe('принцип Даламбера: файл проекта, чертёж и текст', () => {
  for (const [key, p] of Object.entries(SHAFT_PRESETS)) {
    it(`${key}: файл туда-обратно, чертёж и решение без NaN`, () => {
      const s = new ShaftStore({ preset: key as ShaftPresetKey });
      const { text } = s.exportProject(new Date(2026, 0, 1));
      const s2 = new ShaftStore();
      expect(s2.importProject(text)).toBe(true);
      expect(s2.get().problem).toEqual(p.problem);
      const r = solveShaft(p.problem as ShaftProblem);
      for (const t of [renderShaft(p.problem as ShaftProblem, r).svg, JSON.stringify(shaftDoc(p.problem as ShaftProblem, r, { explain: true }))]) expect(t).not.toMatch(/NaN|undefined|Infinity/);
    });
  }
  it('ошибки: опоры в одной точке, чужой файл', () => {
    const pr = { ...(SHAFT_PRESETS.m427.problem as ShaftProblem), zB: -0.6 };
    expect(solveShaft(pr).ok).toBe(false);
    expect(new ShaftStore().importProject(JSON.stringify({ format: 'statika-project', version: 2, module: 'rotation', problem: {} }))).toBe(false);
    expect(parseShaft({ parts: [], zA: 0, zB: 1, omega: 1, eps: 0, gravity: 'z' }).ok).toBe(false);
  });
});
