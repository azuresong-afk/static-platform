/** Вращение тела: ответы Мещерского §37 (уравнение вращения и сохранение кинетического момента). */
import { describe, expect, it } from 'vitest';
import { solveEq, solveK, type RotProblem } from '../src/modules/rotation/model/rotation';
import { ROT_PRESETS, type RotPresetKey } from '../src/modules/rotation/presets';
import { renderEq, renderK } from '../src/modules/rotation/draw/rotation';
import { eqDoc, kDoc } from '../src/modules/rotation/text/solution';
import { RotStore, parseRot } from '../src/modules/rotation/ui/store';

const tol = (v: number) => {
  const s = String(Math.abs(v));
  const d = s.includes('.') ? s.split('.')[1].length : 0;
  return d > 6 ? 1e-7 * Math.max(1, Math.abs(v)) : 2 * Math.pow(10, -d);
};

describe('Мещерский §37', () => {
  for (const [key, p] of Object.entries(ROT_PRESETS).filter(([, x]) => 'book' in x))
    it(p.title, () => {
      const pr = p.problem as RotProblem;
      const got: Record<string, number> = {};
      if (pr.mode === 'eq') {
        const r = solveEq(pr.eq, pr.byWeight);
        expect(r.ok, key + r.errors.join()).toBe(true);
        expect(r.note, key).toBe('ok');
        Object.assign(got, { w: r.w, phi: r.phi, t: r.t, period: r.period ?? NaN });
      } else {
        const r = solveK(pr.K, pr.byWeight);
        expect(r.ok, key + r.errors.join()).toBe(true);
        Object.assign(got, { w2: r.w2, n2: (r.w2 * 30) / Math.PI });
      }
      for (const [k, book] of Object.entries((p as { book: Record<string, number> }).book)) expect(Math.abs(got[k] - book), `${k}: ${got[k]} против ${book}`).toBeLessThanOrEqual(tol(book));
    });
});

describe('уравнение вращения: свойства', () => {
  it('сухое трение: остановившись, тело стоит', () => {
    const pr = ROT_PRESETS.m377.problem as RotProblem;
    const stop = solveEq({ ...pr.eq, ask: 'omega', omega1: 0 }, false).t;
    const r = solveEq({ ...pr.eq, ask: 't', t: stop * 2 }, false);
    expect(r.w).toBe(0);
    expect(r.tStop).toBeCloseTo(stop, 6);
  });
  it('колебания: энергия сохраняется (Jω²/2 + cφ²/2)', () => {
    const e = (ROT_PRESETS.m3715.problem as RotProblem).eq;
    for (const t of [0.1, 0.9, 3.3]) {
      const r = solveEq({ ...e, t }, false);
      expect(r.J * r.w ** 2 + e.c * r.phi ** 2).toBeCloseTo(e.c * e.phi0 ** 2, 9);
    }
  });
  it('недостижимая скорость: «никогда»', () => {
    const e = (ROT_PRESETS.m379.problem as RotProblem).eq;
    expect(solveEq({ ...e, ask: 'omega', omega1: 25 }, false).note).toBe('never');
  });
  it('37.52: люди идут в разные стороны — скорость платформы не меняется', () => {
    const items = structuredClone((ROT_PRESETS.m3753.problem as RotProblem).K);
    items[3].u2 = items[4].u2 = -2 * 0.5;
    expect(solveK(items, false).w2).toBeCloseTo(1, 12);
  });
  it('37.53: платформа остановится при u = 9Rω₀/8', () => {
    const items = structuredClone((ROT_PRESETS.m3753.problem as RotProblem).K);
    const u = (9 * 2 * 1) / 8;
    items.forEach((it, i) => i > 0 && (it.u2 = i < 3 ? u : 2 * u));
    expect(solveK(items, false).w2).toBeCloseTo(0, 12);
  });
});

describe('вращение: файл проекта, графики и текст', () => {
  for (const [key, p] of Object.entries(ROT_PRESETS)) {
    it(`${key}: файл туда-обратно, чертёж и решение без NaN`, () => {
      const s = new RotStore({ preset: key as RotPresetKey });
      const { text } = s.exportProject(new Date(2026, 0, 1));
      const s2 = new RotStore();
      expect(s2.importProject(text)).toBe(true);
      expect(s2.get().problem).toEqual(p.problem);
      const pr = p.problem as RotProblem;
      const out =
        pr.mode === 'eq'
          ? (() => {
              const r = solveEq(pr.eq, pr.byWeight);
              return [renderEq(r).svg, JSON.stringify(eqDoc(pr.eq, pr.byWeight, r, { explain: true }))];
            })()
          : (() => {
              const r = solveK(pr.K, pr.byWeight);
              return [renderK(pr.K, r).svg, JSON.stringify(kDoc(pr.K, pr.byWeight, r, { explain: true }))];
            })();
      for (const t of out) expect(t).not.toMatch(/NaN|undefined|Infinity/);
    });
  }
  it('чужой и испорченный файл', () => {
    const s = new RotStore();
    expect(s.importProject(JSON.stringify({ format: 'statika-project', version: 2, module: 'energy', problem: {} }))).toBe(false);
    expect(parseRot({ mode: 'eq', eq: {}, K: [] }).ok).toBe(false);
  });
  it('редактирование: груз, режим, отмена', () => {
    const s = new RotStore();
    s.addLoad();
    expect(s.get().problem.eq.loads.length).toBe(2);
    s.setMode('K');
    expect(s.get().problem.mode).toBe('K');
    s.undo();
    s.undo();
    expect(s.get().problem.eq.loads.length).toBe(1);
  });
  it('кривая для вопроса «когда ω = …» подробная', () => {
    const r = solveEq((ROT_PRESETS.m377.problem as RotProblem).eq, false);
    expect(r.curve.length).toBeGreaterThan(300);
  });
});
