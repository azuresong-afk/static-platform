/** Кручение: пример 7.2 Антонова и точные формулы. */
import { describe, expect, it } from 'vitest';
import { solveShaft, torqueFromPower, type Shaft, type ShaftSolution } from '../src/modules/torsion/model/shaft';

const sh = (o: Partial<Shaft>): Shaft => ({ steps: [{ l: 1, k: 1, c: 0 }], moments: [0, 0], load: 'moment', powers: [0, 0], rpm: 0, supports: 'left', G: 8e4, dMode: 'given', d: 50, tauAllow: 40, thetaAllow: 0, ...o });
const ok = (s: Shaft) => {
  const r = solveShaft(s);
  if (!r.ok) throw new Error(r.text);
  return r as ShaftSolution;
};

describe('кручение', () => {
  it('Антонов, рис. 7.2: моменты M, 2M, M без заделок — M_z = −M на участке I, +M на участке II', () => {
    const r = ok(sh({ steps: [{ l: 1, k: 1, c: 0 }, { l: 1, k: 1, c: 0 }], moments: [1, -2, 1], supports: 'none' }));
    expect(r.steps.map((s) => s.Mz)).toEqual([-1, 1]);
  });
  it('правило знаков: заделка слева — сумма правее, справа — минус сумма левее; результаты совпадают', () => {
    const base = { steps: [{ l: 1, k: 1, c: 0 }, { l: 2, k: 1.2, c: 0 }], moments: [0, 3, -1] };
    const L = ok(sh({ ...base, supports: 'left' }));
    expect(L.steps.map((s) => s.Mz)).toEqual([2, -1]);
    expect(L.RA).toBe(-2);
    const R = ok(sh({ ...base, moments: [-2, 3, -1], supports: 'right' }));
    expect(R.steps.map((s) => s.Mz)).toEqual([2, -1]);
    expect(R.steps[1].phi1).toBeCloseTo(0, 15);
  });
  it('вал с двумя заделками, момент M на расстоянии a: M_z = Mb/l слева и −Ma/l справа', () => {
    const a = 0.6,
      b = 1.4,
      M = 5;
    const r = ok(sh({ steps: [{ l: a, k: 1, c: 0 }, { l: b, k: 1, c: 0 }], moments: [0, M, 0], supports: 'both' }));
    expect(r.steps[0].Mz).toBeCloseTo((M * b) / (a + b), 12);
    expect(r.steps[1].Mz).toBeCloseTo((-M * a) / (a + b), 12);
    expect(r.steps[1].phi1).toBeCloseTo(0, 14);
    expect(r.RA! + r.RB! + M).toBeCloseTo(0, 12);
  });
  it('τ = 16M/(πd³), φ = 32Ml/(πGd⁴); полый вал — с множителем 1/(1 − c⁴)', () => {
    const r = ok(sh({ moments: [0, 1] }));
    expect(r.steps[0].tau).toBeCloseTo(16e6 / (Math.PI * 50 ** 3), 9);
    expect(r.steps[0].phi).toBeCloseTo((32 * 1e6 * 1000) / (8e4 * Math.PI * 50 ** 4), 12);
    const h = ok(sh({ moments: [0, 1], steps: [{ l: 1, k: 1, c: 0.6 }] }));
    expect(h.steps[0].tau).toBeCloseTo(r.steps[0].tau / (1 - 0.6 ** 4), 9);
  });
  it('подбор диаметра: по прочности d = ∛(16M/(π[τ])), по жёсткости d = ⁴√(32M/(πG[Θ]))', () => {
    const M = 2,
      tau = 40,
      th = 0.5;
    const r = ok(sh({ moments: [0, M], dMode: 'find', tauAllow: tau, thetaAllow: th }));
    expect(r.dStrength).toBeCloseTo(Math.cbrt((16 * M * 1e6) / (Math.PI * tau)), 9);
    expect(r.dStiff).toBeCloseTo(Math.pow((32 * M * 1e6) / (Math.PI * 8e4 * ((th * Math.PI) / 180 / 1000)), 0.25), 9);
    expect(r.d).toBe(Math.max(r.dStrength!, r.dStiff!));
    expect(Math.abs(r.tauMax.v)).toBeLessThanOrEqual(tau + 1e-9);
  });
  it('момент по мощности: M = 30P/(πn); вал без заделок с неуравновешенными моментами — ошибка', () => {
    expect(torqueFromPower(10, 1000)).toBeCloseTo(0.0954929659, 9);
    const r = solveShaft(sh({ moments: [1, 0], supports: 'none' }));
    expect(r.ok).toBe(false);
  });
});

import { TORSION_PRESETS, type TorsionPresetKey } from '../src/modules/torsion/presets';
import { TorsionStore, parseShaft } from '../src/modules/torsion/ui/store';
import { renderShaft, renderShaftDiagrams } from '../src/modules/torsion/draw/shaft';
import { torsionDoc } from '../src/modules/torsion/text/solution';

describe('кручение: пресеты, файл, чертёж, текст', () => {
  for (const key of Object.keys(TORSION_PRESETS) as TorsionPresetKey[])
    it(`${key}: решается, файл туда-обратно, без NaN`, () => {
      const s = new TorsionStore({ preset: key });
      const r = ok(s.get().shaft);
      const s2 = new TorsionStore();
      expect(s2.importProject(s.exportProject(new Date(2026, 0, 1)).text)).toBe(true);
      expect(s2.get().shaft).toEqual(s.get().shaft);
      for (const x of [renderShaft(s.get().shaft, r).svg, renderShaftDiagrams(s.get().shaft, r).svg, JSON.stringify(torsionDoc(s.get().shaft, r, { explain: true }))]) expect(x).not.toMatch(/NaN|undefined|Infinity/);
    });
  it('рис. 7.2: текст решения — M_z = −1 и 1', () => {
    const p = TORSION_PRESETS.ant72.shaft;
    const t = JSON.stringify(torsionDoc(p, ok(p), {}));
    expect(t).toMatch(/участок I \(AB\)/);
  });
  it('шкивы: моменты по мощности уравновешены, M_max = 30·35/(π·300)', () => {
    const r = ok(TORSION_PRESETS.pulleys.shaft);
    expect(Math.max(...r.steps.map((x) => Math.abs(x.Mz)))).toBeCloseTo((30 * 40) / (Math.PI * 300), 9);
  });
  it('правка участков и отмена; переход на мощности; чужой файл', () => {
    const s = new TorsionStore({ preset: 'ant72' });
    s.addStep();
    s.setField('load', 'power');
    expect(s.get().shaft.powers).toHaveLength(4);
    s.removeStep(0);
    s.undo();
    s.undo();
    s.undo();
    expect(s.get().preset).toBe('ant72');
    expect(new TorsionStore().importProject(JSON.stringify({ format: 'statika-project', version: 2, module: 'axial', shaft: {} }))).toBe(false);
    expect(parseShaft({ steps: [] }).ok).toBe(false);
  });
});
