/** Сила-формула F(t, x, v) в «Динамике точки»: разбор переменных, интегрирование, файл; Мещерский 27.35, 27.40, Яблонский Д.2. */
import { describe, expect, it } from 'vitest';
import { evalExpr, parseExpr, printExpr, simplify, usesVar } from '../src/shared/expr';
import { solvePlane, type PlaneProblem } from '../src/modules/pointdyn/model/plane';
import { solvePoint, type PointProblem } from '../src/modules/pointdyn/model/point';
import { PLANE_PRESETS, POINT_PRESETS } from '../src/modules/pointdyn/presets';
import { planeDoc } from '../src/modules/pointdyn/text/extra';
import { pointDoc } from '../src/modules/pointdyn/text/solution';
import { PointStore, parsePoint } from '../src/modules/pointdyn/ui/store';
import { taskInfo } from '../src/shared/tasks';
import { docText } from './helpers/doctext';

describe('формулы с переменными x, v', () => {
  it('разбор и вычисление; без vars x и v — неизвестные обозначения', () => {
    const r = parseExpr('-2v^2/(3 + x) + 0,5t', { vars: ['x', 'v'] });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(evalExpr(r.e, 2, { x: 1, v: 4 })).toBeCloseTo(-8 + 1, 12);
      expect(usesVar(r.e, 'x') && usesVar(r.e, 'v') && usesVar(r.e, 't')).toBe(true);
      expect(printExpr(simplify(r.e))).toBe('−2v²/(3 + x) + 0,5t');
    }
    expect(parseExpr('2x').ok).toBe(false);
    expect(parseExpr('2xv', { vars: ['x', 'v'] }).ok).toBe(true);
  });
  it('«vx» — одна переменная, а не v·x; функции не путаются с переменными', () => {
    const r = parseExpr('-4x - 2vx + exp(-y)', { vars: ['x', 'y', 'vx', 'vy', 'v'] });
    expect(r.ok && evalExpr(r.e, 0, { x: 1, y: 0, vx: 3, vy: 0, v: 3 })).toBeCloseTo(-4 - 6 + 1, 12);
  });
});

describe('прямолинейное движение', () => {
  it('сила-формула совпадает со встроенными силами: −k₁v − cx + a·t', () => {
    const base: PointProblem = { ...(POINT_PRESETS.m277.problem as PointProblem), alpha: 0, f: 0, v0: 3, x0: 0.5, ask: 't', t: 2 };
    const a = solvePoint({ ...base, kv: 0.7, c: 2, at: 1.5 });
    const b = solvePoint({ ...base, form: '-0,7v - 2x + 1,5t' });
    expect(b.ok).toBe(true);
    expect(b.eq.phi).toBeCloseTo(a.eq.phi, 9);
    expect(b.eq.w).toBeCloseTo(a.eq.w, 9);
    expect(b.eq.kind).toBe('general');
    expect(b.vLim).toBeNull();
  });
  it('Мещерский 27.35: падение с высоты h при тяготении ∝ 1/r² — время и скорость по формулам книги', () => {
    const R = 6.37e6,
      h = 2e6,
      g = 9.81,
      r0 = R + h;
    const r = solvePoint({
      ...(POINT_PRESETS.m277.problem as PointProblem),
      alpha: 0,
      f: 0,
      up: false,
      v0: 0,
      x0: 0,
      form: `9,81·${R}^2/(${r0} - x)^2`,
      ask: 'x',
      x1: h,
    });
    expect(r.ok).toBe(true);
    const T = Math.sqrt(r0 ** 3 / (2 * g * R ** 2)) * (Math.sqrt((R / r0) * (1 - R / r0)) + Math.acos(Math.sqrt(R / r0)));
    expect(r.eq.t / T - 1).toBeLessThan(1e-7);
    expect(r.eq.w / Math.sqrt((2 * g * R * h) / r0) - 1).toBeLessThan(1e-7);
  });
  it('текст: сила в списке и в уравнении, решение численное', () => {
    const p = POINT_PRESETS.m2740.problem as PointProblem;
    const t = docText(pointDoc(p, solvePoint(p), { explain: true }));
    expect(t).toMatch(/сила, заданная формулой: F\(t, x, v\) = −2v²\/\(3 \+ x\)/);
    expect(t).toMatch(/= \(−2v²\/\(3 \+ x\)\)/);
    expect(t).toMatch(/численно/);
  });
  it('ошибки: неверная формула; сила не определена (корень из отрицательного)', () => {
    const base = POINT_PRESETS.m2740.problem as PointProblem;
    const bad = solvePoint({ ...base, form: '2y' });
    expect(bad.ok).toBe(false);
    expect(bad.errors.join()).toMatch(/Сила F\(t, x, v\)/);
    const nan = solvePoint({ ...base, form: '-3sqrt(v)', v0: 2, t: 5 });
    expect(nan.ok).toBe(false);
    expect(nan.errors.join()).toMatch(/не определена при t = .*x = .*v = /);
  });
  it('файл и редактор: формула сохраняется, пустая строка убирает силу, отмена', () => {
    const s = new PointStore({ preset: 'm277' });
    s.typeForm('-v');
    s.endSession('n:form');
    expect(s.get().problem.line.form).toBe('-v');
    const { text } = s.exportProject(new Date(2026, 0, 1));
    const s2 = new PointStore();
    expect(s2.importProject(text)).toBe(true);
    expect(s2.get().problem.line.form).toBe('-v');
    s.typeForm('');
    expect('form' in s.get().problem.line).toBe(false);
    s.undo();
    expect(s.get().problem.line.form).toBe('-v');
    expect(parsePoint({ ...(POINT_PRESETS.m277.problem as PointProblem), form: 5 }).ok).toBe(false);
  });
});

describe('движение в плоскости', () => {
  it('Яблонский, Д.2: составляющие формулами дают то же, что встроенные притяжение к центру и сопротивление', () => {
    const p = PLANE_PRESETS.yd2.problem as PlaneProblem;
    const a = solvePlane(p);
    const b = solvePlane({ ...p, formX: undefined, formY: undefined, c: 4, kv: 2 });
    expect(a.ok).toBe(true);
    expect(a.x).toBeCloseTo(b.x, 9);
    expect(a.y).toBeCloseTo(b.y, 9);
    expect(taskInfo(PLANE_PRESETS.yd2.title)).toMatchObject({ book: 'yab', group: 'yab:Д.2' });
    const t = docText(planeDoc(p, a, { explain: true }));
    expect(t).toMatch(/Fx = −4x − 2vx, Fy = −4y − 2vy/);
  });
  it('сила, зависящая от времени: F_x = 6t даёт x = t³ при m = 1 без начальной скорости', () => {
    const r = solvePlane({ ...(PLANE_PRESETS.yd2.problem as PlaneProblem), gravity: false, formX: '6t', formY: '', y0: 0, v0: 0, t: 1.5 });
    expect(r.x).toBeCloseTo(1.5 ** 3, 9);
    expect(r.y).toBeCloseTo(0, 12);
  });
  it('ошибки и файл', () => {
    const p = PLANE_PRESETS.yd2.problem as PlaneProblem;
    expect(solvePlane({ ...p, formX: '2z' }).errors.join()).toMatch(/F_x/);
    expect(solvePlane({ ...p, formY: 'ln(y - 9,5)', ask: 'land', y1: 0 }).errors.join()).toMatch(/не определена/);
    const s = new PointStore({ preset: 'yd2' });
    const s2 = new PointStore();
    expect(s2.importProject(s.exportProject(new Date(2026, 0, 1)).text)).toBe(true);
    expect(s2.get().problem.plane).toEqual(p);
  });
});
