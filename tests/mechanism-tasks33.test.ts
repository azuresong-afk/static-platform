/** Пункт 33: ответы книги §16, 18, которые не умещаются в поле `book` готовой задачи. */
import { describe, expect, it } from 'vitest';
import { solveMech } from '../src/modules/mechanism/model/solve';
import type { MechProblem } from '../src/modules/mechanism/model/mech';
import { MECH_PRESETS } from '../src/modules/mechanism/presets';

const P = (k: keyof typeof MECH_PRESETS) => MECH_PRESETS[k].problem as MechProblem;

describe('Мещерский §16, 18: дополнения', () => {
  it('18.10: ускорение точки на l/4 от ползуна направлено вдоль шатуна, у других точек — нет', () => {
    const cross = (t: string) => {
      const p = P('m1810');
      const r = solveMech({ ...p, points: p.points.map((q) => (q.name === 'M' ? { ...q, def: { ...(q.def as { k: 'seg'; p1: string; p2: string; t: string }), t } } : q)) });
      const M = r.points.find((q) => q.name === 'M')!;
      const A = r.points.find((q) => q.name === 'A')!;
      const B = r.points.find((q) => q.name === 'B')!;
      const ab = [B.pos[0] - A.pos[0], B.pos[1] - A.pos[1]];
      return (M.a[0] * ab[1] - M.a[1] * ab[0]) / Math.hypot(ab[0], ab[1]);
    };
    expect(Math.abs(cross('3/4'))).toBeLessThan(1e-9);
    expect(Math.abs(cross('1/2'))).toBeGreaterThan(1);
    expect(Math.abs(cross('1/4'))).toBeGreaterThan(1);
  });
  it('22.19: относительная скорость центра A — vd/r, перпендикулярно AB, вниз', () => {
    const r = solveMech(P('m2219'));
    const A = r.points.find((q) => q.name === 'A2')!;
    // Центр A движется со скоростью (v; 0): относительная = (v; 0) − v_A2.
    const rel = [10 - A.v[0], 0 - A.v[1]];
    expect(rel[0]).toBeCloseTo(0, 9);
    expect(rel[1]).toBeCloseTo(-10 * (2 / 0.5), 9);
  });
  it('22.20: экстремумы ω₁ и v_r, ω₁ = ω при O₁B ⊥ O₁O', () => {
    const run = (deg: number) => {
      const p = P('m2220');
      const r = solveMech({ ...p, points: p.points.map((q) => (q.name === 'A' ? { ...q, def: { k: 'polar', from: 'O', L: '80', ang: String(deg) } } : q)) });
      return { w: Math.abs(r.bodies.find((b) => b.name === 'O1B')!.omega), vr: Math.abs(r.guides[0].vr) };
    };
    const [a, l, w] = [60, 80, 2];
    expect(run(0).w).toBeCloseTo((w * l) / (l - a), 9);
    expect(run(180).w).toBeCloseTo((w * l) / (l + a), 9);
    expect(run(0).vr).toBeCloseTo(0, 9);
    // v_r наибольшая = aω при s = √(l² − a²)… в положении O₁B ⊥ O₁O (ω₁ = ω).
    const th = (Math.acos(a / l) * 180) / Math.PI; // cos θ = a/l: O₁A ⊥ OO₁
    expect(run(th).w).toBeCloseTo(w, 9);
    expect(run(th).vr).toBeCloseTo(a * w, 9);
  });
});
