/** Сложное движение: сложение скоростей с условием (Мещерский 21.6, 21.12, 22.1–22.2, 22.4, 22.7, 22.8, 22.10). */
import { describe, expect, it } from 'vitest';
import { solveCond } from '../src/modules/relative/model/cond';
import { renderCond } from '../src/modules/relative/draw/cond';
import { COND_PRESETS } from '../src/modules/relative/presets-cond';
import { condDoc } from '../src/modules/relative/text/cond';
import { RelStore } from '../src/modules/relative/ui/store';
import { docText } from './helpers/doctext';

const tol = (v: number) => {
  const s = String(Math.abs(v));
  const d = s.includes('.') ? s.split('.')[1].length : 0;
  return d > 6 ? 1e-9 * Math.max(1, Math.abs(v)) : 2 * Math.pow(10, -d);
};

describe('Мещерский 21.6, 21.12, 22.1–22.10: задачи с условием', () => {
  for (const [key, p0] of Object.entries(COND_PRESETS)) {
    const p = p0 as { title: string; problem: Parameters<typeof solveCond>[0]; book?: Record<string, number> };
    it(p.title, () => {
      const r = solveCond(p.problem);
      expect(r.ok, key + r.errors.join()).toBe(true);
      for (const [k, v] of Object.entries(p.book ?? {})) expect(Math.abs(r.out[k] - v), `${k}: ${r.out[k]} против ${v}`).toBeLessThanOrEqual(tol(v));
      for (const x of [renderCond(p.problem, r).svg, docText(condDoc(p.problem, r, { explain: true }))]) expect(x).not.toMatch(/NaN|undefined|Infinity/);
    });
  }
  it('22.4: T по трём формулам книги совпадает', () => {
    const r = solveCond(COND_PRESETS.c224.problem);
    expect(r.out.Tsine).toBeCloseTo(r.out.T, 10);
    const [psi, , v1, l, b] = [Math.PI / 6, 10, 20, 100, (r.out.beta * Math.PI) / 180];
    expect((l / v1) * (Math.cos(psi) / Math.cos(psi - b))).toBeCloseTo(r.out.T, 10);
  });
  it('22.8: окружность через три путевые скорости — каждая отстоит от ветра на v', () => {
    const r = solveCond(COND_PRESETS.c228.problem);
    const [p1, p2, p3, w] = r.pts;
    for (const q of [p1, p2, p3]) expect(Math.hypot(q[0] - w[0], q[1] - w[1])).toBeCloseTo(r.out.v, 9);
    expect(r.out.W).toBeCloseTo(Math.hypot(w[0], w[1]), 12);
  });
  it('ошибки: катер медленнее, вырожденный полигон, река', () => {
    expect(solveCond({ ...COND_PRESETS.c224.problem, p: { ...COND_PRESETS.c224.problem.p, v1: '3' } }).ok).toBe(false);
    expect(solveCond({ ...COND_PRESETS.c228.problem, p: { ...COND_PRESETS.c228.problem.p, a: '1' } }).ok).toBe(false);
    expect(solveCond({ ...COND_PRESETS.c2210.problem, p: { ...COND_PRESETS.c2210.problem.p, t2: '5' } }).ok).toBe(false);
  });
  it('экран: режим, смена вида, файл туда-обратно', () => {
    const st = new RelStore({ preset: 'c228' });
    expect(st.get().mode).toBe('cond');
    st.setCondKind('river');
    expect(st.get().cond.p.t2).toBe('12,5');
    st.typeCond('s', '60');
    st.endSession('c:s');
    const back = new RelStore();
    expect(back.importProject(st.exportProject().text)).toBe(true);
    expect(back.get().mode).toBe('cond');
    expect(back.get().cond).toEqual(st.get().cond);
    st.undo();
    st.undo();
    expect(st.get().cond.kind).toBe('poly');
  });
});
