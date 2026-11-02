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
});
