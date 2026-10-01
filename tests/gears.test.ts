/** Вращение тела и передачи: ответы Мещерского §13–14. */
import { describe, expect, it } from 'vitest';
import { ratios, solveGears, type GearProblem } from '../src/modules/gears/model/gears';
import { GEAR_PRESETS, type GearPresetKey } from '../src/modules/gears/presets';
import { renderGears } from '../src/modules/gears/draw/gears';
import { gearDoc } from '../src/modules/gears/text/solution';
import { GearStore, parseGears } from '../src/modules/gears/ui/store';

const tol = (v: number) => {
  const s = String(Math.abs(v));
  const d = s.includes('.') ? s.split('.')[1].length : 0;
  return d > 6 ? 1e-9 * Math.max(1, Math.abs(v)) : 2 * Math.pow(10, -d);
};

describe('Мещерский §13–14', () => {
  for (const [key, p] of Object.entries(GEAR_PRESETS))
    it(p.title, () => {
      const pr = p.problem as GearProblem;
      const r = solveGears(pr);
      expect(r.ok, key + r.errors.join()).toBe(true);
      const W = r.wheels[pr.k];
      const got: Record<string, number> = { omega: Math.abs(W.omega), eps: W.eps, n: W.n, phi: r.phi1, turns: Math.abs(W.turns), i: Math.abs(r.i1k), v: r.point?.v ?? NaN, at: r.point?.at ?? NaN, an: r.point?.an ?? NaN, a: r.point?.a ?? NaN, t: r.found ?? NaN };
      for (const [k, book] of Object.entries((p as { book: Record<string, number> }).book)) expect(Math.abs(got[k] - book), `${k}: ${got[k]} против ${book}`).toBeLessThanOrEqual(tol(book));
    });
  it('13.20: в среднем положении w = 8,1 см/с²', () => {
    const r = solveGears({ ...(GEAR_PRESETS.g1320.problem as GearProblem), t: 0 });
    expect(r.point!.a).toBeCloseTo(8.1, 1);
    expect(r.point!.at).toBe(0);
  });
  it('знаки: внешнее зацепление и перекрёстный ремень меняют направление', () => {
    const { i } = ratios([
      { r: 2, z: 0, link: 'shaft' },
      { r: 1, z: 0, link: 'ext' },
      { r: 3, z: 0, link: 'int' },
      { r: 3, z: 0, link: 'belt' },
      { r: 1, z: 0, link: 'cross' },
      { r: 9, z: 0, link: 'shaft' },
    ]);
    expect(i).toEqual([1, -2, -2 / 3, -2 / 3, 2, 2]);
  });
  it('ошибки данных', () => {
    const base = GEAR_PRESETS.g142.problem as GearProblem;
    expect(solveGears({ ...base, wheels: [{ r: 1, z: 0, link: 'shaft' }, { r: 0, z: 20, link: 'ext' }] }).ok).toBe(false);
    expect(solveGears({ ...base, law: '2*' }).ok).toBe(false);
    expect(solveGears({ ...base, drive: 'x' }).ok).toBe(false);
    expect(solveGears({ ...base, wheels: [{ r: 0, z: 10, link: 'shaft' }, { r: 0, z: 20, link: 'belt' }] }).ok).toBe(false);
  });
  it('поиск: цель не достигается — момент не найден', () => {
    const r = solveGears({ ...(GEAR_PRESETS.g143.problem as GearProblem), tMax: 5 });
    expect(r.ok).toBe(true);
    expect(r.found).toBeNull();
  });
});

describe('передачи: файл проекта, чертёж и текст', () => {
  for (const key of Object.keys(GEAR_PRESETS) as GearPresetKey[])
    it(`${key}: файл туда-обратно, чертёж и решение без NaN`, () => {
      const s = new GearStore({ preset: key });
      const { text } = s.exportProject(new Date(2026, 0, 1));
      const s2 = new GearStore();
      expect(s2.importProject(text)).toBe(true);
      expect(s2.get().problem).toEqual(s.get().problem);
      const p = s.get().problem,
        r = solveGears(p);
      for (const x of [renderGears(p, r).svg, JSON.stringify(gearDoc(p, r, { explain: true }))]) expect(x).not.toMatch(/NaN|undefined|Infinity/);
    });
  it('правка цепочки и отмена', () => {
    const s = new GearStore({ preset: 'g142' });
    s.addWheel();
    expect(s.get().problem.wheels).toHaveLength(5);
    s.setK(4);
    s.removeWheel(4);
    expect(s.get().problem.k).toBe(3);
    s.undo();
    s.undo();
    s.undo();
    expect(s.get().problem.wheels).toHaveLength(4);
    expect(s.get().preset).toBe('g142');
  });
  it('чужой файл и испорченная задача', () => {
    expect(new GearStore().importProject(JSON.stringify({ format: 'statika-project', version: 2, module: 'pointkin', problem: {} }))).toBe(false);
    expect(parseGears({ drive: 'phi' }).ok).toBe(false);
    const ok = JSON.parse(new GearStore().exportProject().text);
    ok.problem.wheels[1].link = 'chain';
    expect(new GearStore().importProject(JSON.stringify(ok))).toBe(false);
  });
});
