/** Динамика точки: ответы Мещерского §27 (прямолинейное движение). */
import { describe, expect, it } from 'vitest';
import { solvePoint, type PointProblem } from '../src/modules/pointdyn/model/point';
import { POINT_PRESETS, type PointPresetKey } from '../src/modules/pointdyn/presets';
import { renderEq } from '../src/modules/rotation/draw/rotation';
import { pointDoc } from '../src/modules/pointdyn/text/solution';
import { PointStore, parsePoint } from '../src/modules/pointdyn/ui/store';

const tol = (v: number) => {
  const s = String(Math.abs(v));
  const d = s.includes('.') ? s.split('.')[1].length : 0;
  return d > 6 ? 1e-6 * Math.max(1, Math.abs(v)) : 2 * Math.pow(10, -d);
};

describe('Мещерский §27', () => {
  for (const [key, p] of Object.entries(POINT_PRESETS))
    it(p.title, () => {
      const r = solvePoint(p.problem as PointProblem);
      expect(r.ok, key + r.errors.join()).toBe(true);
      expect(r.eq.note, key).toBe('ok');
      const got: Record<string, number> = { t: r.eq.t, v: r.eq.w, x: r.eq.phi, a: r.eq.eps, vLim: r.vLim ?? NaN, vLimKmh: (r.vLim ?? NaN) * 3.6 };
      for (const [k, book] of Object.entries((p as { book: Record<string, number> }).book)) expect(Math.abs(got[k] - book), `${k}: ${got[k]} против ${book}`).toBeLessThanOrEqual(tol(book));
    });
  it('27.20: путь 237 м по формуле s = (m/k)[(F/k)ln(F/(F − kv)) − v]; в книге 245 — расхождение', () => {
    const r = solvePoint(POINT_PRESETS.m2720.problem as PointProblem);
    const m = 40000 / 9.81,
      v = 12 / 3.6;
    expect(r.eq.phi).toBeCloseTo((m / 2) * (50 * Math.log(100 / (100 - 2 * v)) - v), 6);
    expect(Math.abs(r.eq.phi - 245)).toBeGreaterThan(5);
  });
  it('27.11: при f = 0,05 предельная скорость 111 км/ч', () => {
    const r = solvePoint({ ...(POINT_PRESETS.m2711.problem as PointProblem), f: 0.05 });
    expect(Math.abs(r.vLim! * 3.6 - 111)).toBeLessThanOrEqual(2);
  });
  it('скорость при разгоне стремится к предельной', () => {
    const r = solvePoint({ ...(POINT_PRESETS.m279.problem as PointProblem), t: 200 });
    expect(r.eq.w).toBeCloseTo(r.vLim!, 6);
  });
  it('поиск по пути: обратная задача к состоянию в момент t', () => {
    const pr = POINT_PRESETS.m278.problem as PointProblem;
    const x = solvePoint(pr).eq.phi;
    expect(solvePoint({ ...pr, ask: 'x', x1: x }).eq.t).toBeCloseTo(20, 8);
  });
});

describe('динамика точки: файл проекта, графики и текст', () => {
  for (const [key, p] of Object.entries(POINT_PRESETS)) {
    it(`${key}: файл туда-обратно, графики и решение без NaN`, () => {
      const s = new PointStore({ preset: key as PointPresetKey });
      const { text } = s.exportProject(new Date(2026, 0, 1));
      const s2 = new PointStore();
      expect(s2.importProject(text)).toBe(true);
      expect(s2.get().problem.line).toEqual(p.problem);
      expect(s2.get().problem.mode).toBe('line');
      const r = solvePoint(p.problem as PointProblem);
      for (const t of [renderEq(r.eq).svg, JSON.stringify(pointDoc(p.problem as PointProblem, r, { explain: true }))]) expect(t).not.toMatch(/NaN|undefined|Infinity/);
    });
  }
  it('файл первой версии раздела (только прямолинейное движение) открывается', () => {
    const r = parsePoint(POINT_PRESETS.m277.problem);
    expect(r.ok && r.problem.mode === 'line' && r.problem.line.v0 === 15).toBe(true);
  });
  it('чужой и испорченный файл', () => {
    expect(new PointStore().importProject(JSON.stringify({ format: 'statika-project', version: 2, module: 'rotation', problem: {} }))).toBe(false);
    expect(parsePoint({ m: 1 }).ok).toBe(false);
  });
});
