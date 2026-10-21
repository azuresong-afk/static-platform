/** Пункт 26, «Центр тяжести»: усечённая пирамида, поверхности в пространстве, обратные задачи §9. */
import { describe, expect, it } from 'vitest';
import { docHTML } from '../src/shared/doc';
import { plotSvg, solveExtra } from '../src/shared/extra';
import { CENTROID_ASKS } from '../src/modules/centroid/model/extra';
import { CENTROID_EXTRA_PRESETS, type CentroidExtraKey } from '../src/modules/centroid/extraPresets';
import { partProps, solveCentroid, type CPart } from '../src/modules/centroid/model/centroid';
import { renderCentroid } from '../src/modules/centroid/draw/centroid';
import { CENTROID_PRESETS } from '../src/modules/centroid/presets';
import { CentroidStore } from '../src/modules/centroid/ui/store';

const near = (got: number, book: number, rel: number) => Math.abs(got - book) <= rel * Math.abs(book) + 1e-12;
const part = (kind: CPart['kind'], p: Record<string, number>): CPart => ({ kind, p, s: 1, k: 1 });

describe('обратные задачи §9 (пункт 26)', () => {
  for (const [key, ps] of Object.entries(CENTROID_EXTRA_PRESETS))
    it(ps.title, () => {
      const out = solveExtra(CENTROID_ASKS, ps.problem, true);
      expect(out.ok, key + out.errors.join()).toBe(true);
      for (const [k, book] of Object.entries(ps.book)) expect(near(out.vals[k], book, ps.relTol), `${key} ${k}: ${out.vals[k]} против ${book}`).toBe(true);
      expect(docHTML({ steps: out.steps })).not.toContain('NaN');
      expect(plotSvg(out.plot, out.ok).svg).not.toContain('NaN');
    });
  it('9.13, 9.14: найденная точка действительно на вертикали центра тяжести (проверка по разбиению)', () => {
    const a = solveExtra(CENTROID_ASKS, CENTROID_EXTRA_PRESETS.x913.problem, false);
    expect(a.vals.xC).toBeCloseTo(1 - a.vals.BE, 10);
    const b = solveExtra(CENTROID_ASKS, CENTROID_EXTRA_PRESETS.x914.problem, false);
    expect(b.vals.yC).toBeCloseTo(b.vals.yE, 10);
  });
  it('9.15: в произвольном треугольнике центр четырёх точек опоры совпадает с центром пластины', () => {
    const out = solveExtra(CENTROID_ASKS, { ask: 'carry', n: { xA: 1, yA: 5, xB: -2, yB: 0.5, xC: 6, yC: -1 }, s: {} }, false);
    expect(Math.hypot(out.vals.dx, out.vals.dy)).toBeLessThan(1e-12);
  });
});

describe('новые части', () => {
  it('усечённая пирамида при b → 0 — пирамида (h/4), при a = b — призма (h/2)', () => {
    expect(partProps(part('frustum', { x: 0, y: 0, z: 0, a: 4, b: 1e-12, h: 2, ax: 2, dir: 1 })).c[2]).toBeCloseTo(0.5, 5);
    const pr = partProps(part('frustum', { x: 0, y: 0, z: 0, a: 4, b: 4, h: 2, ax: 2, dir: 1 }));
    expect(pr.c[2]).toBeCloseTo(1, 12);
    expect(pr.m).toBeCloseTo(8, 12);
  });
  it('сферический сегмент высотой r — полусфера: площадь 2πr², центр на r/2', () => {
    const pr = partProps(part('capsurf', { x: 0, y: 0, z: 0, r: 2, h: 2, ax: 2, dir: 1 }));
    expect(pr.m).toBeCloseTo(8 * Math.PI, 12);
    expect(pr.c[2]).toBeCloseTo(1, 12);
  });
  it('плоский четырёхугольник в пространстве: квадрат в плоскости xz', () => {
    const pr = partProps(part('quad3', { x1: 0, y1: 0, z1: 0, x2: 2, y2: 0, z2: 0, x3: 2, y3: 0, z3: 2, x4: 0, y4: 0, z4: 2 }));
    expect(pr.m).toBeCloseTo(4, 12);
    expect(pr.c).toEqual([1, 0, 1]);
  });
  it('чертёж поверхностей и пирамиды без NaN', () => {
    for (const k of ['m923', 'm924', 'm928'] as const) {
      const p = CENTROID_PRESETS[k].problem;
      expect(renderCentroid(p, solveCentroid(p)).svg).not.toContain('NaN');
    }
  });
});

describe('экран и файл проекта', () => {
  it('готовая задача открывает экран обратных задач и сохраняется в файл', () => {
    const st = new CentroidStore();
    for (const k of Object.keys(CENTROID_EXTRA_PRESETS) as CentroidExtraKey[]) {
      st.loadPreset(k);
      expect(st.get().view).toBe('extra');
      const st2 = new CentroidStore();
      expect(st2.importProject(st.exportProject().text)).toBe(true);
      expect(st2.get().extra).toEqual(st.get().extra);
      expect(st2.get().view).toBe('extra');
    }
    st.loadPreset('m928');
    expect(st.get().view).toBe('main');
    const st3 = new CentroidStore();
    expect(st3.importProject(st.exportProject().text)).toBe(true);
    expect(st3.get().problem.mode).toBe('surface');
  });
});
