/** Пункт 33: проверки ответов книги, которые не умещаются в поле `book` готовой задачи (§10–12). */
import { describe, expect, it } from 'vitest';
import { solveKin, type KinProblem } from '../src/modules/pointkin/model/kin';
import { KIN_PRESETS } from '../src/modules/pointkin/presets';

const P = (k: keyof typeof KIN_PRESETS) => KIN_PRESETS[k].problem as KinProblem;

describe('Мещерский §10–12: дополнения к готовым задачам', () => {
  it('11.2: годограф скорости — эллипс (v_x/(30ω))² + (v_y/(10ω))² = 1', () => {
    for (const t of [0, 0.3, 1.1, 2.4]) {
      const r = solveKin({ ...P('k112'), t });
      expect((r.vel[0] / 60) ** 2 + (r.vel[1] / 20) ** 2).toBeCloseTo(1, 12);
    }
  });
  it('11.5: скорость ползуна B — v_B = 2aω |sin ωt|', () => {
    const p = { ...P('k115'), x: '2cos(2t)', y: '0' };
    for (const t of [0.2, 0.5, 1.3]) expect(solveKin({ ...p, t }).v).toBeCloseTo(4 * Math.abs(Math.sin(2 * t)), 12);
  });
  it('11.8: скорости трёх пуль при падении — 53,71; 77,52 и 101,91 (в книге 101,95)', () => {
    const v = (vx: number) => solveKin({ ...P('k118'), x: `${vx}t` }).v;
    expect(v(50)).toBeCloseTo(53.71, 2);
    expect(v(75)).toBeCloseTo(77.52, 2);
    expect(v(100)).toBeCloseTo(101.91, 2);
    expect(Math.abs(v(100) - 101.95)).toBeLessThan(0.05);
  });
  it('12.37: решение тороидальных координат содержит x, y, z и коэффициенты Ляме', async () => {
    const { kinDoc } = await import('../src/modules/pointkin/text/solution');
    const p = P('t1239');
    const txt = JSON.stringify(kinDoc(p, solveKin(p)));
    expect(txt).toContain('коэффициенты Ляме');
    expect(txt).toContain('a + r cos φ');
  });
});
