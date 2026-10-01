/** Динамика точки: первая задача (§26) и криволинейное движение (§27 б). */
import { describe, expect, it } from 'vitest';
import { solveFirst, type FirstProblem } from '../src/modules/pointdyn/model/first';
import { solvePlane, type PlaneProblem } from '../src/modules/pointdyn/model/plane';
import { FIRST_PRESETS, PLANE_PRESETS } from '../src/modules/pointdyn/presets';
import { renderFirst, renderPlane } from '../src/modules/pointdyn/draw/extra';
import { firstDoc, planeDoc } from '../src/modules/pointdyn/text/extra';
import { PointStore, type AnyPresetKey } from '../src/modules/pointdyn/ui/store';

const tol = (v: number, rel?: number) => {
  if (rel) return rel * Math.abs(v) + 1e-9;
  const s = String(Math.abs(v));
  const d = s.includes('.') ? s.split('.')[1].length : 0;
  return d > 6 ? 1e-6 * Math.max(1, Math.abs(v)) : 2 * Math.pow(10, -d);
};

describe('Мещерский §26: силы по заданному движению', () => {
  for (const [key, p] of Object.entries(FIRST_PRESETS))
    it(p.title, () => {
      const pr = p.problem as FirstProblem;
      const r = solveFirst(pr);
      expect(r.ok, key + r.errors.join()).toBe(true);
      const got: Record<string, number> = {
        Fx: r.F[0],
        Fy: r.F[1],
        Fmax: r.Fmax ?? NaN,
        kX: r.F[0] / (r.rt[0] * 100),
        kY: r.F[1] / (r.rt[1] * 100),
        kR: r.F[0] / (r.mass * r.vt[0]),
      };
      for (const [k, book] of Object.entries((p as { book: Record<string, number> }).book)) expect(Math.abs(got[k] - book), `${k}: ${got[k]} против ${book}`).toBeLessThanOrEqual(tol(book, (p as { relTol?: number }).relTol));
    });
  it('касательная и нормальная составляющие: равномерное движение по окружности', () => {
    const r = solveFirst({ byWeight: false, m: 2, g: 9.81, x: '3cos(2t)', y: '3sin(2t)', z: '', gravity: 'none', t: 0.4, t1: 0, t2: 0 });
    expect(r.Ftau).toBeCloseTo(0, 9);
    expect(r.Fnorm).toBeCloseTo(2 * 3 * 4, 9);
    expect(r.rho).toBeCloseTo(3, 9);
  });
  it('ошибка в формуле', () => {
    expect(solveFirst({ ...(FIRST_PRESETS.f261.problem as FirstProblem), x: 'sin(' }).ok).toBe(false);
  });
});

describe('Мещерский §27 б: криволинейное движение', () => {
  for (const [key, p] of Object.entries(PLANE_PRESETS))
    it(p.title, () => {
      const r = solvePlane(p.problem as PlaneProblem);
      expect(r.ok, key + r.errors.join()).toBe(true);
      expect(r.note, key).toBe('ok');
      const got: Record<string, number> = { x: r.x, y: r.y, t: r.t, apexX: r.apex?.x ?? NaN, apexY: r.apex?.y ?? NaN };
      for (const [k, book] of Object.entries((p as { book: Record<string, number> }).book)) expect(Math.abs(got[k] - book), `${k}: ${got[k]} против ${book}`).toBeLessThanOrEqual(tol(book, (p as { relTol?: number }).relTol));
    });
  it('без сопротивления энергия сохраняется', () => {
    const pr = { ...(PLANE_PRESETS.p2744.problem as PlaneProblem), ask: 't' as const, t: 7 };
    const r = solvePlane(pr);
    expect((r.vx ** 2 + r.vy ** 2) / 2 + 9.81 * r.y).toBeCloseTo(100 ** 2 / 2, 6);
  });
  it('цель не достигается: «никогда»', () => {
    const r = solvePlane({ ...(PLANE_PRESETS.p2744.problem as PlaneProblem), ask: 'land', y1: 1000 });
    expect(r.note).toBe('never');
  });
});

describe('новые режимы: файл проекта, чертёж и текст', () => {
  const keys = [...Object.keys(FIRST_PRESETS), ...Object.keys(PLANE_PRESETS)] as AnyPresetKey[];
  for (const key of keys)
    it(`${key}: файл туда-обратно, чертёж и решение без NaN`, () => {
      const s = new PointStore({ preset: key });
      const { text } = s.exportProject(new Date(2026, 0, 1));
      const s2 = new PointStore();
      expect(s2.importProject(text)).toBe(true);
      expect(s2.get().problem).toEqual(s.get().problem);
      const t = s.get().problem;
      const out =
        t.mode === 'first'
          ? (() => {
              const r = solveFirst(t.first);
              return [renderFirst(t.first, r).svg, JSON.stringify(firstDoc(t.first, r, { explain: true }))];
            })()
          : (() => {
              const r = solvePlane(t.plane);
              return [renderPlane(t.plane, r).svg, JSON.stringify(planeDoc(t.plane, r, { explain: true }))];
            })();
      for (const x of out) expect(x).not.toMatch(/NaN|undefined|Infinity/);
    });
  it('режим и вес переключаются, отмена возвращает', () => {
    const s = new PointStore({ preset: 'f2615' });
    expect(s.get().problem.mode).toBe('first');
    s.setMode('plane');
    s.typeLaw('x', 't^2');
    expect(s.get().problem.first.x).toBe('t^2');
    s.undo();
    s.undo();
    expect(s.get().problem.mode).toBe('first');
  });
});
