/** Пункт 32: готовые задачи «Сходящихся сил» (Мещерский §1, 2, 6, 7) — приведение системы сил; узлы проверяет converging.test.ts. */
import { describe, expect, it } from 'vitest';
import { reduceSystem } from '../src/modules/converging/model/forces';
import { CONV_PRESETS32 } from '../src/modules/converging/presets32';
import type { ConvPreset } from '../src/modules/converging/presets';

const tolOf = (book: number, relTol = 0) => {
  const s = String(Math.abs(book));
  const d = s.includes('.') ? s.split('.')[1].length : 0;
  return Math.max(d > 6 ? 1e-9 : 2 * Math.pow(10, -d), relTol * Math.abs(book));
};
const deg = (r: number) => (r * 180) / Math.PI;

describe('пункт 32: приведение системы сил — ответы книги', () => {
  for (const [key, p] of Object.entries(CONV_PRESETS32 as Record<string, ConvPreset>)) {
    if (p.problem.mode !== 'reduce') continue;
    it(p.title, () => {
      const r = reduceSystem(p.problem.mode === 'reduce' ? p.problem.reduce : (undefined as never));
      const R = Math.hypot(...r.R);
      const got: Record<string, number> = {
        R,
        ang: ((deg(Math.atan2(r.R[1], r.R[0])) % 360) + 360) % 360,
        M: Math.hypot(...r.M),
        Mx: r.M[0],
        My: r.M[1],
        Mz: r.M[2],
        Rx: r.R[0],
        Ry: r.R[1],
        Rz: r.R[2],
        Mstar: Math.abs(r.Mstar),
        x: r.xyPoint?.[0] ?? NaN,
        y: r.xyPoint?.[1] ?? NaN,
      };
      for (const [k, book] of Object.entries(p.book ?? {}))
        expect(Math.abs(got[k] - book), `${key} ${k}: ${got[k]} против ${book}`).toBeLessThanOrEqual(tolOf(book, p.relTol) + 1e-9);
    });
  }
});
