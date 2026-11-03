/** Пункт 33: дополнительные ответы книги к готовым задачам §23 (то, что не умещается в поле book). */
import { describe, expect, it } from 'vitest';
import { norm, solveRel, type RelProblem } from '../src/modules/relative/model/rel';
import { REL_PRESETS } from '../src/modules/relative/presets';

describe('Мещерский §23: дополнения', () => {
  it('23.61: касательное и нормальное ускорения равны ak²e^{kt}√2', () => {
    const r = solveRel(REL_PRESETS.r2361.problem as RelProblem);
    const wt = (r.v[0] * r.a[0] + r.v[1] * r.a[1] + r.v[2] * r.a[2]) / norm(r.v);
    expect(wt).toBeCloseTo(Math.SQRT2 * Math.E, 9);
    expect(Math.sqrt(norm(r.a) ** 2 - wt ** 2)).toBeCloseTo(Math.SQRT2 * Math.E, 9);
  });
  it('23.60: ускорение направлено вертикально (вниз при отрицательном выражении)', () => {
    const r = solveRel(REL_PRESETS.r2360.problem as RelProblem);
    expect(r.a[0]).toBeCloseTo(0, 9);
    expect(r.a[1]).toBeCloseTo(-2.66, 9);
  });
});
