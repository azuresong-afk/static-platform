/** Вращение тела и передачи: ответы Мещерского §13–14. */
import { describe, expect, it } from 'vitest';
import { ratios, solveGears, type GearProblem } from '../src/modules/gears/model/gears';
import { solveUniform } from '../src/modules/gears/model/uniform';
import { solveEllipse } from '../src/modules/gears/model/ellipse';
import { solveFriction } from '../src/modules/gears/model/friction';
import { GEAR_PRESETS, type GearPresetKey } from '../src/modules/gears/presets';
import { renderGears } from '../src/modules/gears/draw/gears';
import { gearDoc } from '../src/modules/gears/text/solution';
import { ellDoc, frDoc, uniDoc } from '../src/modules/gears/text/extra';
import { renderEll, renderFr, renderUni } from '../src/modules/gears/draw/extra';
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
      let got: Record<string, number>;
      if (pr.mode === 'uniform') {
        const u = solveUniform(pr.uni);
        expect(u.ok, key + u.errors.join()).toBe(true);
        got = { w0: u.w0, w: u.w, eps: u.eps, t: u.t, phi: u.phi };
      } else if (pr.mode === 'ellipse') {
        const e = solveEllipse(pr.ell);
        expect(e.ok, key + e.errors.join()).toBe(true);
        got = { wmin: e.min.w, wmax: e.max.w, w2: e.w2, eps2: e.eps2 };
      } else if (pr.mode === 'friction') {
        const f = solveFriction(pr.fr);
        expect(f.ok, key + f.errors.join()).toBe(true);
        got = { omega: Math.abs(f.vals.w2), eps: f.vals.e2, a: f.point?.a ?? NaN, t: f.found ?? NaN };
      } else {
        const r = solveGears(pr);
        expect(r.ok, key + r.errors.join()).toBe(true);
        const W = r.wheels[pr.k];
        got = { omega: Math.abs(W.omega), eps: W.eps, n: W.n, phi: r.phi1, turns: Math.abs(W.turns), i: Math.abs(r.i1k), v: r.point?.v ?? NaN, at: r.point?.at ?? NaN, an: r.point?.an ?? NaN, a: r.point?.a ?? NaN, t: r.found ?? NaN, size: r.size?.value ?? NaN };
      }
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
  it('14.10 в общем виде: ε₂ = 50π/d²', () => {
    for (const t of [0, 4, 13]) {
      const f = solveFriction({ ...GEAR_PRESETS.f1410.problem.fr, find: false, t });
      expect(f.vals.e2).toBeCloseTo((50 * Math.PI) / (10 - 0.5 * t) ** 2, 9);
    }
  });
  it('14.7: сопряжённый профиль при A = 2a — тот же эллипс', async () => {
    const { conjugate, ellR } = await import('../src/modules/gears/model/ellipse');
    const pr = GEAR_PRESETS.e146.problem.ell;
    const { psi } = conjugate(pr, 50);
    expect(psi(2 * Math.PI)).toBeCloseTo(2 * Math.PI, 6);
    // При повороте колеса 1 на π колесо 2 тоже повернулось на π (симметрия).
    expect(psi(Math.PI)).toBeCloseTo(Math.PI, 6);
    expect(ellR(pr, 0)).toBeCloseTo(45, 12);
  });
  it('равнопеременное: все тройки известных дают одно и то же', async () => {
    const { UNI_KEYS } = await import('../src/modules/gears/model/uniform');
    const ref = { w0: 3, w: 11, eps: 2, t: 4, phi: 28 };
    for (let a = 0; a < 5; a++)
      for (let b = a + 1; b < 5; b++)
        for (let c = b + 1; c < 5; c++) {
          const known = [UNI_KEYS[a], UNI_KEYS[b], UNI_KEYS[c]];
          const r = solveUniform({ ...ref, ...Object.fromEntries(UNI_KEYS.filter((k) => !known.includes(k)).map((k) => [k, 999])), known, wUnit: 'rad', phiUnit: 'rad' });
          expect(r.ok, known.join() + r.errors.join()).toBe(true);
          for (const k of UNI_KEYS) expect(r[k], known.join() + ':' + k).toBeCloseTo(ref[k], 9);
        }
  });
  it('обратная задача: размер паразитного колеса не определить', () => {
    const r = solveGears({ ...(GEAR_PRESETS.g142.problem as GearProblem), find: 'size', target: 1, unit: 'rad', u: 1, uKey: 'z', wheels: [{ r: 0, z: 10, link: 'shaft' }, { r: 0, z: 60, link: 'ext' }, { r: 0, z: 70, link: 'ext' }], k: 2 });
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/не влияет/);
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
      const p = s.get().problem;
      let out: string[];
      if (p.mode === 'uniform') {
        const r = solveUniform(p.uni);
        out = [renderUni(r).svg, JSON.stringify(uniDoc(p.uni, r, { explain: true }))];
      } else if (p.mode === 'ellipse') {
        const r = solveEllipse(p.ell);
        out = [renderEll(p.ell, r).svg, JSON.stringify(ellDoc(p.ell, r, { explain: true }))];
      } else if (p.mode === 'friction') {
        const r = solveFriction(p.fr);
        out = [renderFr(p.fr, r).svg, JSON.stringify(frDoc(p.fr, r, { explain: true }))];
      } else {
        const r = solveGears(p);
        out = [renderGears(p, r).svg, JSON.stringify(gearDoc(p, r, { explain: true }))];
      }
      for (const x of out) expect(x).not.toMatch(/NaN|undefined|Infinity/);
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
  it('файл первой редакции раздела (без mode, find — да/нет) открывается', () => {
    const old = JSON.parse(new GearStore({ preset: 'g143' }).exportProject().text);
    for (const k of ['mode', 'u', 'uKey', 'uni', 'ell', 'fr']) delete old.problem[k];
    old.problem.find = true;
    const s = new GearStore();
    expect(s.importProject(JSON.stringify(old))).toBe(true);
    expect(s.get().problem.mode).toBe('chain');
    expect(s.get().problem.find).toBe('time');
    expect(solveGears(s.get().problem).found).toBeCloseTo(10, 9);
  });
  it('чужой файл и испорченная задача', () => {
    expect(new GearStore().importProject(JSON.stringify({ format: 'statika-project', version: 2, module: 'pointkin', problem: {} }))).toBe(false);
    expect(parseGears({ drive: 'phi' }).ok).toBe(false);
    const ok = JSON.parse(new GearStore().exportProject().text);
    ok.problem.wheels[1].link = 'chain';
    expect(new GearStore().importProject(JSON.stringify(ok))).toBe(false);
  });
});
