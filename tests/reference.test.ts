/** Эталонные ответы готовых задач (кН, кН·м; точность 1e-3). */
import { describe, expect, it } from 'vitest';
import { analyze } from '../src/core';
import { loadPreset, type PresetKey } from '../src/model/presets';

const REF: Record<Exclude<PresetKey, 'indet' | 'blank'>, Record<string, number>> = {
  simple: { X_A: 5, Y_A: 6.274, R_E: 8.387 },
  cantilever: { X_A: 0, Y_A: 12, M_A: 29.667 },
  rod: { X_A: 2.057, Y_A: 8.437, S_D: 10.114 },
  lever: { X_B: 0, Y_B: 26.667, F: 6.667 },
  gframe: { X_A: -8, Y_A: 10, M_A: 50 },
  pframe: { X_A: -9, Y_A: 3.464, R_E: 15.464 },
  post: { X_A: 2.4, Y_A: 4, R_C: 3.6 },
  bracket: { X_A: -5, Y_A: 5, S_C: 7.071 },
};

describe('эталонные ответы', () => {
  for (const [key, ref] of Object.entries(REF)) {
    it(key, () => {
      const { solution, model } = analyze(loadPreset(key as PresetKey));
      expect(solution.status).toBe('ok');
      expect(Object.keys(solution.vals).sort()).toEqual(Object.keys(ref).sort());
      expect(model.unknowns.map((u) => u.key).sort()).toEqual(Object.keys(ref).sort());
      for (const [k, v] of Object.entries(ref)) expect(Math.abs(solution.vals[k] - v), k).toBeLessThan(1e-3);
      // Проверочное уравнение сходится.
      expect(solution.check).not.toBeNull();
      expect(Math.abs(solution.check!.r)).toBeLessThan(1e-9);
    });
  }

  it('indet: статически неопределима, степень 1', () => {
    const { solution, html } = analyze(loadPreset('indet'));
    expect(solution.status).toBe('indeterminate');
    expect(solution.n - 3).toBe(1);
    expect(html).toContain('Степень статической неопределимости: 1.');
  });

  it('blank: нет опор', () => {
    expect(analyze(loadPreset('blank')).solution.status).toBe('nosupport');
  });
});
