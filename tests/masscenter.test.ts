/** Движение центра масс, количество движения, давление струи, работа и мощность, плоское движение: ответы Мещерского §29, §35–36, §39. */
import { describe, expect, it } from 'vitest';
import { solveJet, solveMomentum, solvePower } from '../src/modules/masscenter/model/dynamics';
import { solvePoints, solveShift } from '../src/modules/masscenter/model/system';
import { solveWheel, type WheelProblem } from '../src/modules/masscenter/model/wheel';
import { MC_PRESETS, type McPresetKey, type McTask } from '../src/modules/masscenter/presets';
import { renderJet, renderMomentum, renderPower } from '../src/modules/masscenter/draw/dynamics';
import { renderPoints, renderShift, renderWheel } from '../src/modules/masscenter/draw/mc';
import { jetDoc, momentumDoc, powerDoc } from '../src/modules/masscenter/text/dynamics';
import { pointsDoc, shiftDoc, wheelDoc } from '../src/modules/masscenter/text/solution';
import { McStore, parseMc } from '../src/modules/masscenter/ui/store';

const tol = (v: number) => {
  const s = String(Math.abs(v));
  const d = s.includes('.') ? s.split('.')[1].length : 0;
  return d > 6 ? 1e-7 * Math.max(1, Math.abs(v)) : 2 * Math.pow(10, -d);
};

describe('Мещерский §29, §35–36, §39', () => {
  for (const [key, p] of Object.entries(MC_PRESETS))
    it(p.title, () => {
      const t = p.problem as McTask;
      const got: Record<string, number> = {};
      if (t.mode === 'wheel') {
        const r = solveWheel(t.wheel);
        expect(r.ok, key + r.errors.join()).toBe(true);
        Object.assign(got, { a: r.a, slip: Math.abs(r.slip), x: r.x, limit: r.limit?.value ?? NaN, tgLimit: r.limit?.what === 'tgα' ? r.limit.value : NaN });
      } else if (t.mode === 'points') {
        const r = solvePoints(t.points);
        expect(r.ok, key + r.errors.join()).toBe(true);
        Object.assign(got, { Ny: r.N[1], Q: Math.hypot(...r.Q), NyMin: r.range?.Ny[0] ?? NaN, NyMax: r.range?.Ny[1] ?? NaN });
      } else if (t.mode === 'momentum') {
        const r = solveMomentum(t.momentum);
        expect(r.ok, key + r.errors.join()).toBe(true);
        Object.assign(got, { answer: r.answer, s: r.brake?.s ?? NaN, tau: r.brake?.tau ?? NaN });
      } else if (t.mode === 'jet') {
        const r = solveJet(t.jet);
        expect(r.ok, key + r.errors.join()).toBe(true);
        Object.assign(got, { Rx: Math.abs(r.R[0]), R: Math.hypot(...r.R), Ny: r.N ? Math.max(0, r.N[1]) : NaN });
      } else if (t.mode === 'power') {
        const r = solvePower(t.power);
        expect(r.ok, key + r.errors.join()).toBe(true);
        Object.assign(got, { answer: r.answer, t: r.t, Al: r.Al ?? NaN, hp: (r.N ?? NaN) / r.hp, kW: (r.N ?? NaN) / r.kW });
      } else {
        const r = solveShift(t.shift);
        expect(r.ok, key + r.errors.join()).toBe(true);
        got.answer = r.answer;
      }
      const rel = (p as { relTol?: number }).relTol;
      for (const [k, book] of Object.entries((p as { book: Record<string, number> }).book)) expect(Math.abs(got[k] - book), `${k}: ${got[k]} против ${book}`).toBeLessThanOrEqual(rel ? rel * Math.abs(book) : tol(book));
    });
  it('39.5: трение качения увеличивает предельный момент на Pδ', () => {
    const w = (MC_PRESETS.m394.problem as { wheel: WheelProblem }).wheel;
    const a = solveWheel(w).limit!.value,
      b = solveWheel({ ...w, fk: 0.01 }).limit!.value;
    expect(b - a).toBeCloseTo(500 * 0.01, 9);
  });
  it('39.11: при скольжении и без него — непрерывность на пределе', () => {
    const w = (MC_PRESETS.m3511.problem as { wheel: WheelProblem }).wheel;
    const alpha = (Math.atan(0.9) * 180) / Math.PI;
    const a1 = solveWheel({ ...w, alpha: alpha - 1e-6 }).a,
      a2 = solveWheel({ ...w, alpha: alpha + 1e-6 }).a;
    expect(Math.abs(a1 - a2)).toBeLessThan(1e-5);
  });
  it('35.18: призма сдвигается на (a − b)/4', () => {
    const r = solveShift({ M0: 3, parts: [{ name: 'B', m: 1, s: 0.6, theta: 0 }], unknown: -1 });
    expect(r.answer).toBeCloseTo(-0.15, 12);
  });
});

describe('центр масс: файл проекта, чертёж и текст', () => {
  for (const key of Object.keys(MC_PRESETS) as McPresetKey[])
    it(`${key}: файл туда-обратно, чертёж и решение без NaN`, () => {
      const s = new McStore({ preset: key });
      const { text } = s.exportProject(new Date(2026, 0, 1));
      const s2 = new McStore();
      expect(s2.importProject(text)).toBe(true);
      expect(s2.get().problem).toEqual(s.get().problem);
      const p = s.get().problem;
      const draw = {
        points: () => [renderPoints(p.points, solvePoints(p.points)).svg, JSON.stringify(pointsDoc(p.points, solvePoints(p.points), { explain: true }))],
        shift: () => [renderShift(p.shift, solveShift(p.shift)).svg, JSON.stringify(shiftDoc(p.shift, solveShift(p.shift), { explain: true }))],
        wheel: () => [renderWheel(p.wheel, solveWheel(p.wheel)).svg, JSON.stringify(wheelDoc(p.wheel, solveWheel(p.wheel), { explain: true }))],
        momentum: () => [renderMomentum(p.momentum, solveMomentum(p.momentum)).svg, JSON.stringify(momentumDoc(p.momentum, solveMomentum(p.momentum), { explain: true }))],
        jet: () => [renderJet(p.jet, solveJet(p.jet)).svg, JSON.stringify(jetDoc(p.jet, solveJet(p.jet), { explain: true }))],
        power: () => [renderPower(p.power, solvePower(p.power)).svg, JSON.stringify(powerDoc(p.power, solvePower(p.power), { explain: true }))],
      };
      const out = draw[p.mode]();
      expect(out[1]).not.toMatch(/проверьте данные/);
      for (const x of out) expect(x).not.toMatch(/NaN|undefined|Infinity/);
    });
  it('чужой файл и редактирование', () => {
    const s = new McStore();
    expect(s.importProject(JSON.stringify({ format: 'statika-project', version: 2, module: 'pointdyn', problem: {} }))).toBe(false);
    expect(parseMc({ mode: 'wheel', wheel: {} }).ok).toBe(false);
    s.loadPreset('m3521');
    s.removePart(0);
    expect(s.get().problem.shift.parts.length).toBe(2);
    s.undo();
    expect(s.get().problem.shift.parts.length).toBe(3);
    s.loadPreset('m3610');
    s.removeBody(0);
    expect(s.get().problem.momentum.bodies[0].ref1).toBe(-1);
    s.loadPreset('m2915');
    s.setPower('unknown', 1);
    s.removeLoad(1);
    expect(s.get().problem.power.unknown).toBe('N');
  });
});

describe('количество движения, струя, мощность: независимые проверки', () => {
  it('упругий удар двух шаров: энергия сохраняется', () => {
    // Равные массы: первый шар останавливается, второй получает его скорость.
    const r = solveMomentum({ byWeight: false, g: 9.81, F: 0, bodies: [{ name: '', m: 1, v0: 2, ref0: -1, v1: 0, ref1: -1 }, { name: '', m: 1, v0: 0, ref0: -1, v1: 0, ref1: -1 }], unknown: { i: 1, when: 1 } });
    expect(r.answer).toBeCloseTo(2, 12);
    expect(r.T1).toBeCloseTo(r.T0, 12);
  });
  it('скорости по кругу — ошибка', () => {
    const r = solveMomentum({ byWeight: false, g: 9.81, F: 0, bodies: [{ name: '', m: 1, v0: 0, ref0: 1, v1: 0, ref1: -1 }, { name: '', m: 1, v0: 0, ref0: 0, v1: 0, ref1: -1 }], unknown: { i: 1, when: 1 } });
    expect(r.ok).toBe(false);
  });
  it('струя: поворот на 180° даёт 2ṁv', () => {
    const r = solveJet({ byWeight: false, g: 9.81, rho: 1000, W: 0, streams: [{ name: '', out: false, A: 0.01, v: 10, ang: 0 }, { name: '', out: true, A: 0, v: 10, ang: 180 }] });
    expect(r.R[0]).toBeCloseTo(2 * 1000 * 0.01 * 10 * 10, 9);
    expect(r.R[1]).toBeCloseTo(0, 9);
  });
  it('мощность: найденная сила возвращает ту же мощность', () => {
    const t = (MC_PRESETS.m299.problem as McTask & { mode: 'power' }).power;
    const r = solvePower(t);
    const back = solvePower({ ...t, unknown: 'N', loads: t.loads.map((l) => ({ ...l, F: r.answer })) });
    expect(back.N! / back.hp).toBeCloseTo(5144, 6);
  });
  it('время и мощность согласованы (29.3)', () => {
    const t = (MC_PRESETS.m293.problem as McTask & { mode: 'power' }).power;
    const r = solvePower(t);
    const back = solvePower({ ...t, unknown: 'N', t: r.t });
    expect(back.N! / back.hp).toBeCloseTo(2, 9);
  });
});
