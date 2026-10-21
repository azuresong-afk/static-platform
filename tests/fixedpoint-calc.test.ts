/** Режим «по формулам» вкладки «Тело с неподвижной точкой»: свойства решений, ошибки, файл проекта. */
import { describe, expect, it } from 'vitest';
import { calcDefaults, cardanRatio, solveCalc } from '../src/modules/fixedpoint/model/calc';
import { FpStore } from '../src/modules/fixedpoint/ui/store';

describe('19.13: ω по скоростям двух точек', () => {
  it('скорости, восстановленные по найденной ω, совпадают с заданными', () => {
    const pr = calcDefaults('inv');
    const r = solveCalc(pr);
    expect(r.ok).toBe(true);
    const w = [r.get.wx, r.get.wy, r.get.wz];
    const [x, y, z] = [pr.p.x1, pr.p.y1, pr.p.z1];
    const v = [w[1] * z - w[2] * y, w[2] * x - w[0] * z, w[0] * y - w[1] * x];
    expect(v[0]).toBeCloseTo(pr.p.vx1, 9);
    expect(v[1]).toBeCloseTo(pr.p.vy1, 9);
    expect(v[2]).toBeCloseTo(pr.p.vz1, 9);
    expect(r.lines.join('|')).toContain('x + 2y = 0');
    expect(r.lines.join('|')).toContain('3x + z = 0');
  });
  it('несовместные данные — ошибка', () => {
    const r = solveCalc({ kind: 'inv', p: { ...calcDefaults('inv').p, vz1: 5 } });
    expect(r.ok).toBe(false);
  });
});

describe('Земля и Дарбу', () => {
  it('при v = 0 угловая скорость трёхгранника равна скорости Земли', () => {
    const r = solveCalc({ kind: 'earth', p: { ...calcDefaults('earth').p, vE: 0, vN: 0 } });
    expect(r.get.wxi).toBeCloseTo(0, 12);
    expect(Math.hypot(r.get.weta, r.get.wzeta)).toBeCloseTo(7.292, 9);
  });
  it('полюс — ошибка', () => expect(solveCalc({ kind: 'earth', p: { ...calcDefaults('earth').p, phi: 90 } }).ok).toBe(false));
});

describe('гироскоп и Кардан', () => {
  it('|ω| трёхгранника при неподвижном подвесе и α̇ = β̇ = 0 равна U', () => {
    const r = solveCalc(calcDefaults('gyro'));
    expect(Math.hypot(r.get.wx, r.get.wy, r.get.wz)).toBeCloseTo(7.292, 9);
  });
  it('шарнир Кардана: средняя за оборот ω₂ равна ω₁', () => {
    const a = Math.PI / 3;
    let s = 0;
    const n = 3600;
    for (let i = 0; i < n; i++) s += 1 / cardanRatio(a, (i / n) * 2 * Math.PI);
    expect(s / n).toBeCloseTo(1, 6);
  });
});

describe('файл проекта', () => {
  it('режим «по формулам» сохраняется и открывается без потерь', () => {
    const a = new FpStore({ preset: 'm2013' });
    const { text } = a.exportProject(new Date('2026-10-01'));
    const b = new FpStore({ preset: 'm191' });
    expect(b.importProject(text)).toBe(true);
    expect(b.get().problem).toEqual(a.get().problem);
    b.typeCalc('alpha', 45);
    expect(b.get().problem.calc.p.alpha).toBe(45);
    b.undo();
    expect(b.get().problem.calc.p.alpha).toBe(30);
  });
});
