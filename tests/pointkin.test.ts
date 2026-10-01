/** Кинематика точки: ответы Мещерского §11–12. */
import { describe, expect, it } from 'vitest';
import { solveKin, type KinProblem } from '../src/modules/pointkin/model/kin';
import { KIN_PRESETS, type KinPresetKey } from '../src/modules/pointkin/presets';
import { renderKin } from '../src/modules/pointkin/draw/kin';
import { kinDoc } from '../src/modules/pointkin/text/solution';
import { KinStore, parseKin } from '../src/modules/pointkin/ui/store';

const tol = (v: number) => {
  const s = String(Math.abs(v));
  const d = s.includes('.') ? s.split('.')[1].length : 0;
  return d > 6 ? 1e-9 * Math.max(1, Math.abs(v)) : 2 * Math.pow(10, -d);
};

describe('Мещерский §11–12', () => {
  for (const [key, p] of Object.entries(KIN_PRESETS))
    it(p.title, () => {
      const r = solveKin(p.problem as KinProblem);
      expect(r.ok, key + r.errors.join()).toBe(true);
      const got: Record<string, number> = { v: r.v, a: r.a, at: r.at, an: r.an, rho: r.rho ?? Infinity, alphaV: r.vAngles?.[0] ?? NaN, alphaA: r.aAngles?.[0] ?? NaN };
      for (const [k, book] of Object.entries((p as { book: Record<string, number> }).book)) expect(Math.abs(got[k] - book), `${k}: ${got[k]} против ${book}`).toBeLessThanOrEqual(tol(book));
    });
  it('12.29: ρ₀ = ∞', () => expect(solveKin(KIN_PRESETS.k1229.problem as KinProblem).rho).toBeNull());
  it('12.32: радиус кривизны кардиоиды при t = 0 равен 4a/3', () => {
    expect(solveKin({ ...(KIN_PRESETS.k1230.problem as KinProblem), t: 0 }).rho).toBeCloseTo((4 * 0.5) / 3, 10);
  });
  it('полярный и координатный способы совпадают', () => {
    const p = solveKin({ ...(KIN_PRESETS.k1227.problem as KinProblem) });
    const c = solveKin({ mode: 'coord', x: 'exp(0,5t)cos(0,5t)', y: 'exp(0,5t)sin(0,5t)', z: '', s: '', rho: 0, r: '', phi: '', t: 1, t1: 0, t2: 0 });
    expect(c.v).toBeCloseTo(p.v, 10);
    expect(c.a).toBeCloseTo(p.a, 10);
    expect(c.rho!).toBeCloseTo(p.rho!, 9);
  });
});

describe('кинематика точки: файл проекта, чертёж и текст', () => {
  for (const key of Object.keys(KIN_PRESETS) as KinPresetKey[])
    it(`${key}: файл туда-обратно, чертёж и решение без NaN`, () => {
      const s = new KinStore({ preset: key });
      const { text } = s.exportProject(new Date(2026, 0, 1));
      const s2 = new KinStore();
      expect(s2.importProject(text)).toBe(true);
      expect(s2.get().problem).toEqual(s.get().problem);
      const p = s.get().problem,
        r = solveKin(p);
      for (const x of [renderKin(p, r).svg, JSON.stringify(kinDoc(p, r, { explain: true }))]) expect(x).not.toMatch(/NaN|undefined|Infinity/);
    });
  it('ошибки и чужой файл', () => {
    expect(solveKin({ ...(KIN_PRESETS.k1228.problem as KinProblem), x: 'sin(' }).ok).toBe(false);
    expect(new KinStore().importProject(JSON.stringify({ format: 'statika-project', version: 2, module: 'pointdyn', problem: {} }))).toBe(false);
    expect(parseKin({ mode: 'coord' }).ok).toBe(false);
  });
});
