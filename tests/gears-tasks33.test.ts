/** Пункт 33: ответы книги §13, которые не умещаются в поле `book` готовой задачи. */
import { describe, expect, it } from 'vitest';
import { solveGears, type GearProblem } from '../src/modules/gears/model/gears';
import { GEAR_PRESETS } from '../src/modules/gears/presets';

const P = (k: keyof typeof GEAR_PRESETS) => GEAR_PRESETS[k].problem as GearProblem;

describe('Мещерский §13: дополнения', () => {
  it('13.9: смена направления при t = 45 и 135 с, период 180 с', () => {
    for (const t of [45, 135]) expect(solveGears({ ...P('g139'), t }).wheels[0].omega).toBeCloseTo(0, 12);
    const a = solveGears({ ...P('g139'), t: 10 }).wheels[0].omega;
    expect(solveGears({ ...P('g139'), t: 190 }).wheels[0].omega).toBeCloseTo(a, 12);
    expect(solveGears({ ...P('g139'), t: 90 }).wheels[0].omega).toBeLessThan(0);
  });
  it('13.14: по v_A = 50, v_B = 10 см/с и AB = 20 см — ω = 2 с⁻¹, d = 50 см', () => {
    const vA = solveGears(P('g1314')).point!.v;
    const vB = solveGears({ ...P('g1314'), rho: 5 }).point!.v;
    expect(vB).toBeCloseTo(10, 12);
    const w = (vA - vB) / 20;
    expect(w).toBeCloseTo(2, 12);
    expect((2 * vA) / w).toBeCloseTo(50, 12);
  });
  it('13.16: период обращения T = 2π/ω ≈ 1,4 ч', () => {
    const w = solveGears(P('g1316')).wheels[0].omega;
    expect(((2 * Math.PI) / w / 3600)).toBeCloseTo(1.4, 1);
  });
  it('13.17: угол полного ускорения обода с радиусом 60°', () => {
    const r = solveGears({ ...P('g1317'), rho: 1 });
    expect(Math.atan2(r.point!.at, r.point!.an) * (180 / Math.PI)).toBeCloseTo(60, 9);
    expect(r.point!.at).toBeCloseTo(10 * Math.sqrt(3), 9);
  });
});
