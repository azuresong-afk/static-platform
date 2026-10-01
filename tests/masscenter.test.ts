/** Движение центра масс и плоское движение: ответы Мещерского §35–36, §39. */
import { describe, expect, it } from 'vitest';
import { solvePoints, solveShift } from '../src/modules/masscenter/model/system';
import { solveWheel, type WheelProblem } from '../src/modules/masscenter/model/wheel';
import { MC_PRESETS, type McPresetKey, type McTask } from '../src/modules/masscenter/presets';
import { renderPoints, renderShift, renderWheel } from '../src/modules/masscenter/draw/mc';
import { pointsDoc, shiftDoc, wheelDoc } from '../src/modules/masscenter/text/solution';
import { McStore, parseMc } from '../src/modules/masscenter/ui/store';

const tol = (v: number) => {
  const s = String(Math.abs(v));
  const d = s.includes('.') ? s.split('.')[1].length : 0;
  return d > 6 ? 1e-7 * Math.max(1, Math.abs(v)) : 2 * Math.pow(10, -d);
};

describe('Мещерский §35–36, §39', () => {
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
      } else {
        const r = solveShift(t.shift);
        expect(r.ok, key + r.errors.join()).toBe(true);
        got.answer = r.answer;
      }
      for (const [k, book] of Object.entries((p as { book: Record<string, number> }).book)) expect(Math.abs(got[k] - book), `${k}: ${got[k]} против ${book}`).toBeLessThanOrEqual(tol(book));
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
      const out =
        p.mode === 'points'
          ? [renderPoints(p.points, solvePoints(p.points)).svg, JSON.stringify(pointsDoc(p.points, solvePoints(p.points), { explain: true }))]
          : p.mode === 'shift'
            ? [renderShift(p.shift, solveShift(p.shift)).svg, JSON.stringify(shiftDoc(p.shift, solveShift(p.shift), { explain: true }))]
            : [renderWheel(p.wheel, solveWheel(p.wheel)).svg, JSON.stringify(wheelDoc(p.wheel, solveWheel(p.wheel), { explain: true }))];
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
  });
});
