/** Кинематика точки: составные задачи («comp») и пересчёт координат («conv») — Мещерский 10.13, 10.19–10.23, 12.3–12.11. */
import { describe, expect, it } from 'vitest';
import { solveComp, solveConv } from '../src/modules/pointkin/model/comp';
import type { KinProblem } from '../src/modules/pointkin/model/kin';
import { KIN_PRESETS } from '../src/modules/pointkin/presets';
import { solveAny } from '../src/modules/pointkin/ui/solve';
import { docText } from './helpers/doctext';

type Preset = { title: string; problem: KinProblem; book?: Record<string, number>; roots?: number[][]; relTol?: number };
const near = (got: number, want: number, k: string, rel?: number) => {
  const s = String(Math.abs(want));
  const d = s.includes('.') ? s.split('.')[1].length : 0;
  const tol = rel ? rel * Math.abs(want) + 1e-12 : d > 6 ? 1e-9 * Math.max(1, Math.abs(want)) : 2 * Math.pow(10, -d);
  expect(Math.abs(got - want), `${k}: ${got} против ${want}`).toBeLessThanOrEqual(tol);
};

describe('Мещерский §10, 12: составные задачи и пересчёт координат', () => {
  for (const [key, p0] of Object.entries(KIN_PRESETS)) {
    const p = p0 as unknown as Preset;
    const pr = p.problem;
    if (pr.mode !== 'comp' && pr.mode !== 'conv') continue;
    it(p.title, () => {
      if (pr.mode === 'comp') {
        const r = solveComp(pr);
        expect(r.ok, key + r.errors.join()).toBe(true);
        for (const [k, v] of Object.entries(p.book ?? {})) near(r.out[k], v, k, p.relTol);
        if (p.roots) {
          expect(r.roots.length).toBe(p.roots.length);
          p.roots.forEach((want, i) => {
            expect(r.roots[i].ts.length, `корней при f = ${r.roots[i].c}: ${r.roots[i].ts}`).toBe(want.length);
            want.forEach((t, j) => near(r.roots[i].ts[j], t, 't', 1e-7));
          });
        }
      } else {
        const r = solveConv(pr);
        expect(r.ok, key + r.errors.join()).toBe(true);
        expect(r.mismatch, `отклонения ${JSON.stringify(r.dev)}`).toEqual([]);
      }
      const { fig, doc } = solveAny(pr, true);
      for (const x of [fig.svg, docText(doc)]) expect(x).not.toMatch(/NaN|undefined|Infinity/);
    });
  }
  it('сверка находит ошибку в формуле', () => {
    const p = KIN_PRESETS.k1019.problem as KinProblem;
    const r = solveConv({ ...p, p: { ...p.p!, pb: '2t' } });
    expect(r.mismatch).toEqual(['φ']);
  });
  it('ошибки: вторая капля ещё не оторвалась, пустая формула', () => {
    const d = KIN_PRESETS.k123.problem as KinProblem;
    expect(solveComp({ ...d, t: 0.05 }).ok).toBe(false);
    const c = KIN_PRESETS.k1019.problem as KinProblem;
    expect(solveConv({ ...c, x: '' }).ok).toBe(false);
  });
});
