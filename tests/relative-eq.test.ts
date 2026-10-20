/** Сложное движение: уравнения движения и траектория, Мещерский §21. */
import { describe, expect, it } from 'vitest';
import { cartesian } from '../src/modules/pointkin/model/kin';
import { solveEq } from '../src/modules/relative/model/eq';
import { EQ_PRESETS, type EqPreset } from '../src/modules/relative/presets';
import { RelStore } from '../src/modules/relative/ui/store';
import { eqDoc } from '../src/modules/relative/text/eq';

describe('Мещерский §21: уравнения и траектория', () => {
  for (const [key, p] of Object.entries(EQ_PRESETS) as [string, EqPreset][])
    it(p.title, () => {
      const r = solveEq(p.problem);
      expect(r.ok, key + r.errors.join()).toBe(true);
      if (p.bookF) {
        // Уравнение книги выполняется на всей траектории.
        let scale = 0;
        for (let k = 0; k <= 40; k++) {
          const t = p.problem.t1 + ((p.problem.t2 - p.problem.t1) * k) / 40;
          const q = cartesian(r.kp, r.kin, t);
          scale = Math.max(scale, Math.abs(q[0]), Math.abs(q[1]));
          expect(Math.abs(p.bookF(q[0], q[1], q[2])), `${key} t=${t}`).toBeLessThan(2e-3 * Math.max(1, scale) * Math.max(1, scale));
        }
      }
      if (p.bookK != null) {
        expect(r.polar).not.toBeNull();
        expect(r.polar!.k).toBeCloseTo(p.bookK, 10);
        expect(r.polar!.r0).toBeCloseTo(0, 10);
      }
      expect(eqDoc(p.problem, r, { explain: true }).steps.length).toBeGreaterThan(2);
    });

  it('21.7: явная запись y(x) подстановкой t', () => {
    const r = solveEq(EQ_PRESETS.e217.problem);
    expect(r.explicit).toMatch(/sin/);
    expect(r.explicit).toMatch(/2,5133/);
  });
  it('21.10: парабола — алгебраическое уравнение найдено', () => {
    const r = solveEq(EQ_PRESETS.e2110.problem);
    expect(r.traj?.rels[0].kind).toMatch(/парабола/);
  });
  it('21.8: эллипс', () => {
    expect(solveEq(EQ_PRESETS.e218.problem).traj?.rels[0].kind).toMatch(/эллипс/);
  });
  it('21.13: ξ = √(a² + r² + 2ar cos ωt), η = 0', () => {
    const p = EQ_PRESETS.e2113.problem;
    for (const t of [0, 1, 2, 3, 5]) {
      const r = solveEq({ ...p, t });
      expect(r.foundAt[0]).toBeCloseTo(Math.sqrt(5 + 4 * Math.cos(t)), 9);
      expect(r.foundAt[1]).toBeCloseTo(0, 9);
    }
  });
  it('обратный переход туда и обратно возвращает исходные координаты', () => {
    const base = { X0: '1 + t', Y0: '2t', Z0: '', phi: '0,3t^2', t: 1.7, t1: 0, t2: 3 };
    const a = solveEq({ ...base, dir: 'abs', u: '2sin(t)', v: 't', w: '' });
    const b = solveEq({ ...base, dir: 'rel', u: String(a.foundAt[0]).replace(',', '.'), v: String(a.foundAt[1]), w: '' });
    expect(b.foundAt[0]).toBeCloseTo(a.givenAt[0], 9);
    expect(b.foundAt[1]).toBeCloseTo(a.givenAt[1], 9);
  });
  it('ошибка в формуле не роняет решение', () => {
    const r = solveEq({ ...EQ_PRESETS.e212.problem, u: '2t +' });
    expect(r.ok).toBe(false);
    expect(eqDoc(EQ_PRESETS.e212.problem, r).steps[0].blocks.length).toBeGreaterThan(0);
  });
  it('файл проекта: режим eq сохраняется и открывается', () => {
    const a = new RelStore({ preset: 'e2111' });
    const file = a.exportProject();
    const b = new RelStore();
    expect(b.importProject(file.text)).toBe(true);
    expect(b.get().mode).toBe('eq');
    expect(b.get().eq).toEqual(a.get().eq);
  });
});
