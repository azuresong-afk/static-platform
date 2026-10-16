/** Приближённая теория гироскопов (Мещерский §40). */
import { describe, expect, it } from 'vitest';
import { solveGyro, type GyroProblem, type GyroResult } from '../src/modules/gyro/model/gyro';
import { gyro, GYRO_PRESETS } from '../src/modules/gyro/presets';
import { taskInfo } from '../src/shared/tasks';
import { renderGyro } from '../src/modules/gyro/draw/gyro';
import { gyroDoc } from '../src/modules/gyro/text/solution';
import { GyroStore, parseGyro } from '../src/modules/gyro/ui/store';
import { docText } from './helpers/doctext';

export function gotGyro(pr: GyroProblem, r: GyroResult): Record<string, number> {
  const g: Record<string, number> = { M: r.M, dN: r.dN, wp: r.wp, Tp: r.Tp, alpha: r.alpha };
  if (r.NA != null) g[pr.sup === 'roller' ? 'N' : 'NA'] = r.NA;
  if (r.NB != null) g.NB = r.NB;
  if (r.ratio != null) g.ratio = r.ratio;
  return g;
}

describe('готовые задачи: ответы книги', () => {
  for (const [key, p] of Object.entries(GYRO_PRESETS))
    it(p.title, () => {
      const r = solveGyro(p.problem);
      expect(r.ok, key + r.errors.join()).toBe(true);
      const got = gotGyro(p.problem, r);
      const rel = (p as { relTol?: number }).relTol ?? 0.005;
      for (const [k, book] of Object.entries(p.book ?? {})) {
        expect(got[k], `${key}: нет ${k}`).toBeDefined();
        expect(Math.abs(got[k] - book), `${key} ${k}: ${got[k]} против ${book}`).toBeLessThanOrEqual(rel * Math.abs(book));
      }
      expect(taskInfo(p.title)).toMatchObject({ book: 'mesh', group: 'mesh:40' });
    });
});

describe('гироскоп: свойства и файл', () => {
  it('давления: сумма добавок равна нулю, отношение — к статическому', () => {
    const r = solveGyro(gyro({ jMode: 'J', J: 2, spin: 'rate', om: 100, prec: 'rate', w1: -0.5, beta: 60, sup: 'rotor', l: 2, stat: 'split', P: 300, c: 0.5 }));
    expect(r.ok).toBe(true);
    expect(r.M).toBeCloseTo(2 * 100 * 0.5 * Math.sin(Math.PI / 3), 10);
    expect(r.NA! + r.NB!).toBeCloseTo(300, 10);
    expect(r.sA).toBe(-1);
    expect(r.NA).toBeCloseTo(225 - r.dN, 10);
  });
  it('ошибки: нулевое расстояние между опорами, H без режима прецессии', () => {
    expect(solveGyro(gyro({ l: 0 })).errors.join()).toMatch(/Расстояние между опорами/);
    expect(solveGyro(gyro({ jMode: 'H' })).errors.join()).toMatch(/Кинетический момент сразу/);
  });
  it('текст и чертёж всех готовых задач без NaN; файл проекта без потерь', () => {
    for (const [k, p] of Object.entries(GYRO_PRESETS)) {
      const r = solveGyro(p.problem);
      expect(docText(gyroDoc(p.problem, r, { explain: true }))).not.toMatch(/NaN|undefined|Infinity/);
      expect(renderGyro(p.problem, r).svg, k).not.toMatch(/NaN|undefined|Infinity/);
      const a = new GyroStore({ preset: k as keyof typeof GYRO_PRESETS });
      const b = new GyroStore();
      expect(b.importProject(a.exportProject().text)).toBe(true);
      expect(b.get().problem).toEqual(a.get().problem);
    }
    expect(parseGyro({ mode: 'forced' }).ok).toBe(false);
  });
  it('смена режима не оставляет несовместимых настроек', () => {
    const s = new GyroStore({ preset: 'm405' });
    s.setSel('mode', 'forced');
    expect(s.get().problem.jMode).toBe('J');
    s.setSel('sup', 'prec');
    s.setSel('stat', 'lever');
    s.setSel('sup', 'rotor');
    expect(s.get().problem.stat).toBe('none');
    s.undo();
    expect(s.get().problem.stat).toBe('lever');
  });
});
