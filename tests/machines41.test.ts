import { describe, expect, it } from 'vitest';
import { defaults } from '../src/shared/machines/types';
import { KINETO_MACHINES, KINETO_PRESETS, stickAt } from '../src/modules/dalembert/machines';
import { machineDoc } from '../src/shared/machines/solution';

describe('Мещерский §41: каталог машин', () => {
  for (const [key, p] of Object.entries(KINETO_PRESETS)) {
    it(`${key}: ${p.title}`, () => {
      const m = KINETO_MACHINES.find((x) => x.id === p.machine)!;
      const s = m.solve({ ...defaults(m), ...p.vals });
      expect(s.ok).toBe(true);
      if (!s.ok) return;
      for (const [k, b] of Object.entries(p.book ?? {})) {
        const r = s.rows.find((x) => x.key === k)!;
        expect(r, k).toBeTruthy();
        expect(Math.abs(r.val - b), `${k}: ${r.val} vs ${b}`).toBeLessThanOrEqual((p.relTol ?? 0.005) * Math.abs(b) + 1e-12);
      }
      expect(JSON.stringify(machineDoc(s, p, { explain: true }))).toContain('совпадает с ответом книги');
    });
  }
  it('41.5: силы инерции стержня совпадают с численным дифференцированием кинематики', () => {
    const G = 20,
      l = 0.5,
      H = 0.4,
      v = 2;
    const m = G / 9.81;
    const phiAt = (t: number) => Math.atan2(H, 1 - v * t); // x_D − x_A = 1 − v·t
    const C = (t: number): [number, number] => {
      const f = phiAt(t);
      return [v * t + l * Math.cos(f), l * Math.sin(f)];
    };
    const t0 = 0.2,
      d = 1e-4;
    const acc = [0, 1].map((i) => (C(t0 + d)[i] - 2 * C(t0)[i] + C(t0 - d)[i]) / (d * d));
    const phi = (phiAt(t0) * 180) / Math.PI;
    const o = stickAt(G, l, H, v, phi);
    expect(o.Jx).toBeCloseTo(-m * acc[0], 2);
    expect(o.Jy).toBeCloseTo(-m * acc[1], 2);
    const eps = (phiAt(t0 + d) - 2 * phiAt(t0) + phiAt(t0 - d)) / (d * d);
    expect(o.eps).toBeCloseTo(eps, 2);
  });
  it('41.11: точное значение отличается от разложения в ряд на малую долю', () => {
    const m = KINETO_MACHINES.find((x) => x.id === 'crank')!;
    const s = m.solve(defaults(m));
    if (!s.ok) throw new Error('no');
    const a = s.rows.find((r) => r.key === 'Smax')!.val,
      b = s.rows.find((r) => r.key === 'Smaxx')!.val;
    expect(Math.abs(a - b) / b).toBeLessThan(0.02);
  });
  it('неверные данные — сообщение, не падение', () => {
    for (const m of KINETO_MACHINES) {
      const v = { ...defaults(m), ...Object.fromEntries(m.params.filter((p) => !p.zero).map((p) => [p.k, 0])) };
      expect(m.solve(v).ok).toBe(false);
    }
  });
});
