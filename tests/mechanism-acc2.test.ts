/** Плоский механизм: ω и ε по ускорениям двух точек (Мещерский 18.29–18.36). */
import { describe, expect, it } from 'vitest';
import { solveAcc2 } from '../src/modules/mechanism/model/acc2';
import type { MechProblem } from '../src/modules/mechanism/model/mech';
import { MECH_PRESETS } from '../src/modules/mechanism/presets';
import { acc2Doc } from '../src/modules/mechanism/text/acc2';
import { renderAcc2 } from '../src/modules/mechanism/draw/acc2';
import { MechStore } from '../src/modules/mechanism/ui/store';
import { docText } from './helpers/doctext';

const tol = (v: number) => {
  const s = String(Math.abs(v));
  const d = s.includes('.') ? s.split('.')[1].length : 0;
  return d > 6 ? 1e-9 * Math.max(1, Math.abs(v)) : 2 * Math.pow(10, -d);
};

describe('Мещерский 18.29–18.36: ускорения двух точек', () => {
  for (const [key, p] of Object.entries(MECH_PRESETS)) {
    const pr = p.problem as MechProblem;
    if (!pr.acc2) continue;
    it(p.title, () => {
      const r = solveAcc2(pr.acc2!);
      expect(r.ok, key + r.errors.join()).toBe(true);
      const get = (k: string): number => {
        const [q, n] = k.split('.');
        const P = r.pts.find((x) => x.name === n);
        if (q === 'w') return r.w;
        if (q === 'e') return Math.abs(r.eps);
        if (q === 'a') return P!.mag;
        if (q === 'ang') return P!.ang;
        if (q === 'Qx') return r.ica![0];
        if (q === 'Qy') return r.ica![1];
        return NaN;
      };
      for (const [k, book] of Object.entries((p as { book: Record<string, number> }).book)) {
        const got = get(k);
        expect(Math.abs(got - book), `${k}: ${got} против ${book}`).toBeLessThanOrEqual(tol(book));
      }
      const text = docText(acc2Doc(pr.acc2!, r, { explain: true })) + renderAcc2(r).svg;
      expect(text).not.toMatch(/NaN|undefined|Infinity/);
    });
  }
  it('невозможные ускорения: ω² < 0', () => {
    const r = solveAcc2({ pts: [{ name: 'A', x: '0', y: '0' }, { name: 'B', x: '10', y: '0' }], a: [{ mag: '20', ang: '0' }, { mag: '10', ang: '180' }].reverse() });
    expect(r.ok).toBe(false);
  });
  it('экран: режим, файл туда-обратно', () => {
    const st = new MechStore({ preset: 'm1833' });
    expect(st.get().problem.acc2?.pts.length).toBe(4);
    const back = new MechStore();
    expect(back.importProject(st.exportProject().text)).toBe(true);
    expect(back.get().problem.acc2).toEqual(st.get().problem.acc2);
    back.setAcc2(false);
    expect(back.get().problem.acc2).toBeUndefined();
    back.setAcc2(true);
    back.addAcc2Pt();
    expect(back.get().problem.acc2!.pts.length).toBe(3);
    back.removeAcc2Pt(2);
    expect(back.get().problem.acc2!.pts.length).toBe(2);
  });
});
