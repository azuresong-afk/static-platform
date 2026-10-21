/** Плоский механизм: сверка с формулами книги (Мещерский 14.11–14.14, 15.6, 16.38). */
import { describe, expect, it } from 'vitest';
import type { MechProblem } from '../src/modules/mechanism/model/mech';
import { solveMech } from '../src/modules/mechanism/model/solve';
import { MECH_PRESETS } from '../src/modules/mechanism/presets';
import { mechDoc } from '../src/modules/mechanism/text/solution';
import { MechStore } from '../src/modules/mechanism/ui/store';
import { docText } from './helpers/doctext';

describe('Мещерский 14.11–14.14, 15.6, 16.38: формулы книги совпадают с расчётом механизма', () => {
  for (const [key, p] of Object.entries(MECH_PRESETS)) {
    const pr = p.problem as MechProblem;
    if (!pr.formulas?.length) continue;
    it(p.title, () => {
      const r = solveMech(pr);
      expect(r.ok, key + r.errors.join()).toBe(true);
      expect(r.checks?.length).toBe(pr.formulas!.length);
      for (const c of r.checks!) {
        expect(c.error, `${key}: ${c.key}`).toBeUndefined();
        expect(c.n).toBeGreaterThan(30);
        expect(c.dev, `${key}: ${c.key} (${c.f}) — отклонение ${c.dev}`).toBeLessThanOrEqual(c.tol * Math.max(1, c.scale));
      }
      expect(r.plot?.formula?.length).toBe(r.plot?.xs.length);
      const text = docText(mechDoc(pr, r, { explain: true }));
      expect(text).toContain('Сверка с формулами');
      expect(text).not.toMatch(/NaN|undefined|Infinity/);
    });
  }
  it('неверная формула обнаруживается', () => {
    const pr = MECH_PRESETS.m1411.problem as MechProblem;
    const r = solveMech({ ...pr, formulas: [{ key: 'x:B', f: '19cos(φ)' }] });
    const c = r.checks![0];
    expect(c.dev).toBeGreaterThan(0.1);
  });
  it('формула из экрана: ввод, файл туда-обратно', () => {
    const st = new MechStore({ preset: 'm1411' });
    st.setPlot('vx:B');
    st.typeFormula('vx:B', '−40sin(φ)');
    st.endSession('formula:vx:B');
    expect(st.get().problem.formulas?.some((q) => q.key === 'vx:B')).toBe(true);
    const back = new MechStore();
    expect(back.importProject(st.exportProject().text)).toBe(true);
    expect(back.get().problem.formulas).toEqual(st.get().problem.formulas);
    st.typeFormula('vx:B', '');
    expect(st.get().problem.formulas?.some((q) => q.key === 'vx:B')).toBe(false);
  });
});
