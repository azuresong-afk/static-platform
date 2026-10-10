/** Принцип Даламбера: давления вращающегося тела на ось — ответы Мещерского §42 и проверка по точкам. */
import { describe, expect, it } from 'vitest';
import { solveShaft, type ShaftProblem } from '../src/modules/dalembert/model/shaft';
import { SHAFT_PRESETS, type ShaftPresetKey } from '../src/modules/dalembert/presets';
import { renderShaft } from '../src/modules/dalembert/draw/shaft';
import { shaftDoc } from '../src/modules/dalembert/text/solution';
import { ShaftStore, parseShaft } from '../src/modules/dalembert/ui/store';
import { docText } from './helpers/doctext';

const tol = (v: number, rel?: number) => {
  if (rel) return rel * Math.abs(v) + 1e-9;
  const s = String(Math.abs(v));
  const d = s.includes('.') ? s.split('.')[1].length : 0;
  return d > 6 ? 1e-9 * Math.max(1, Math.abs(v)) : 2 * Math.pow(10, -d);
};

describe('Мещерский §42, Яблонский Д.17', () => {
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
        rXA: total.XA,
        rYA: total.YA,
        rZA: total.ZA,
        rXB: total.XB,
        rYB: total.YB,
        eps: r.eps,
        omega: r.omega,
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

describe('вращение под действием пары (Яблонский, Д.17)', () => {
  const base = SHAFT_PRESETS.yd17.problem as ShaftProblem;
  it('ε = M/J_z, ω = ω₀ + ετ; с найденными ω и ε реакции те же, что при их прямом задании', () => {
    const r = solveShaft(base);
    expect(r.eps).toBeCloseTo(60 / 7.65, 12);
    expect(r.omega).toBeCloseTo((2 * 60) / 7.65, 12);
    expect(r.Mz).toBeCloseTo(60, 12);
    const { drive: _drive, ...given } = base;
    const g = solveShaft({ ...given, omega: r.omega, eps: r.eps });
    for (const k of ['XA', 'YA', 'ZA', 'XB', 'YB'] as const) expect(g.total[k]).toBeCloseTo(r.total[k], 9);
    expect(solveShaft({ ...base, drive: { M: 60, t: 2, omega0: 3 } }).omega).toBeCloseTo(3 + r.omega, 12);
  });
  it('уравнение моментов относительно оси x через A (как в книге): 3Y_B + G·y_C + J_yz·ω² = 0, а относительно y: 3X_B + J_yz·ε = 0', () => {
    const r = solveShaft(base);
    expect(3 * r.total.YB + r.M * 9.81 * r.C[1] + r.Jyz * r.omega ** 2).toBeCloseTo(0, 8);
    expect(3 * r.total.XB + r.Jyz * r.eps).toBeCloseTo(0, 9);
  });
  it('текст: шаг углового ускорения, в ответе ε и ω вместо вращающего момента', () => {
    const t = docText(shaftDoc(base, solveShaft(base)));
    expect(t).toMatch(/ε = M\/Jz = 60\/7,65 = 7,8431 рад\/с²/);
    expect(t).toMatch(/ω = ω0 \+ ετ = 0 \+ 7,8431·2 = 15,6863 рад\/с/);
    expect(t).toMatch(/из этого уравнения найдено ε/);
    expect(t).not.toMatch(/Mвр/);
  });
  it('ошибки: горизонтальный вал с центром масс вне оси (ε не постоянно), J_z = 0, τ < 0', () => {
    const off = solveShaft({ ...base, gravity: 'y' });
    expect(off.ok).toBe(false);
    expect(off.errors.join()).toMatch(/ε не постоянно/);
    const onAxis: ShaftProblem = { ...base, gravity: 'y', parts: [{ kind: 'disk', m: 10, c: [0, 0, 1], u: [0, 0, 1], p: { R: 0.2, h: 0.1 }, s: 1 }] };
    expect(solveShaft(onAxis).ok).toBe(true);
    expect(solveShaft(onAxis).eps).toBeCloseTo(60 / (10 * 0.02), 9);
    expect(solveShaft({ ...base, parts: [{ kind: 'point', m: 1, c: [0, 0, 1], u: [0, 0, 1], p: {}, s: 1 }] }).errors.join()).toMatch(/Момент инерции/);
    expect(solveShaft({ ...base, drive: { M: 1, t: -1, omega0: 0 } }).ok).toBe(false);
  });
  it('редактор и файл: переключение режима с отменой; неверный drive в файле — ошибка', () => {
    const s = new ShaftStore({ preset: 'm427' });
    s.setDriven(true);
    expect(s.get().problem.drive).toEqual({ M: 1, t: 1, omega0: 0 });
    s.typeDrive('M', 5);
    s.endSession('d:M');
    expect(solveShaft(s.get().problem).eps).toBeCloseTo(5 / solveShaft(s.get().problem).Jz, 12);
    s.undo();
    expect(s.get().problem.drive?.M).toBe(1);
    s.undo();
    expect(s.get().problem.drive).toBeUndefined();
    const raw = { ...JSON.parse(JSON.stringify(base)) };
    expect(parseShaft(raw).ok).toBe(true);
    expect(parseShaft({ ...raw, drive: { M: 1, t: -2, omega0: 0 } }).ok).toBe(false);
    expect(parseShaft({ ...raw, drive: { M: 'x', t: 1, omega0: 0 } }).ok).toBe(false);
  });
});
