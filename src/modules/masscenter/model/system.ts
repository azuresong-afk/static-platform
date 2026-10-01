/**
 * Движение центра масс системы (Мещерский §35–36).
 *
 * 1. Система точек (центров масс тел) с заданными законами движения x_i(t), y_i(t):
 *    центр масс, его скорость и ускорение; количество движения Q = M·v_C;
 *    главный вектор внешних сил R = M·a_C, а за вычетом силы тяжести (вдоль −y) — внешние силы,
 *    кроме тяжести (реакция опоры): R − M·g. Наибольшие и наименьшие значения на отрезке времени.
 * 2. Сохранение положения центра масс: внешних горизонтальных сил нет, система вначале покоилась.
 *    Части перемещаются относительно основания на s_i под углом θ_i к оси x; основание смещается на
 *    Δx = −Σm_i·s_i·cos θ_i / Σm (с основанием). Можно найти перемещение одной части, при котором основание
 *    остаётся на месте.
 */
import { diff, evalExpr, parseExpr, type Expr } from '../../../shared/expr';

export const G = 9.81;

export interface MPoint {
  name: string;
  m: number;
  x: string;
  y: string;
}
export interface PointsProblem {
  byWeight: boolean;
  g: number;
  gravity: boolean;
  pts: MPoint[];
  t: number;
  t1: number;
  t2: number;
}

export interface PointsResult {
  ok: boolean;
  errors: string[];
  masses: number[];
  M: number;
  ex: { x: Expr; y: Expr; vx: Expr; vy: Expr; ax: Expr; ay: Expr }[];
  /** В момент t. */
  C: [number, number];
  vC: [number, number];
  aC: [number, number];
  Q: [number, number];
  /** Главный вектор внешних сил и внешние силы без тяжести. */
  R: [number, number];
  N: [number, number];
  /** Наибольшие и наименьшие значения N_x, N_y на отрезке. */
  range: { Nx: [number, number]; Ny: [number, number] } | null;
}

const clean = (v: number) => (Math.abs(v) < 1e-12 ? 0 : v);

export function solvePoints(pr: PointsProblem): PointsResult {
  const errors: string[] = [];
  if (!pr.pts.length) errors.push('Нет ни одной точки.');
  if (!(pr.g > 0)) errors.push('g — положительное число.');
  const ex = pr.pts.map((p, i) => {
    const px = parseExpr(p.x),
      py = parseExpr(p.y);
    if (!px.ok) errors.push(`Точка ${i + 1}, x(t): ${px.error}.`);
    if (!py.ok) errors.push(`Точка ${i + 1}, y(t): ${py.error}.`);
    if (!(p.m > 0)) errors.push(`Точка ${i + 1}: масса (вес) — положительное число.`);
    const x = px.ok ? px.e : ({ k: 'num', v: 0 } as Expr),
      y = py.ok ? py.e : ({ k: 'num', v: 0 } as Expr);
    const vx = diff(x),
      vy = diff(y);
    return { x, y, vx, vy, ax: diff(vx), ay: diff(vy) };
  });
  const masses = pr.pts.map((p) => (pr.byWeight ? p.m / (pr.g || G) : p.m));
  const M = masses.reduce((s, m) => s + m, 0);
  const z: [number, number] = [0, 0];
  const empty: PointsResult = { ok: false, errors, masses, M, ex, C: z, vC: z, aC: z, Q: z, R: z, N: z, range: null };
  if (errors.length) return empty;
  const sum = (t: number, k: 'x' | 'y' | 'vx' | 'vy' | 'ax' | 'ay') => ex.reduce((s, e, i) => s + masses[i] * evalExpr(e[k], t), 0);
  const at = (t: number) => {
    const C: [number, number] = [sum(t, 'x') / M, sum(t, 'y') / M];
    const Q: [number, number] = [sum(t, 'vx'), sum(t, 'vy')];
    const R: [number, number] = [sum(t, 'ax'), sum(t, 'ay')];
    const N: [number, number] = [R[0], R[1] + (pr.gravity ? M * pr.g : 0)];
    return { C, Q, R, N };
  };
  const s = at(pr.t);
  if (![...s.C, ...s.Q, ...s.R].every(Number.isFinite)) return { ...empty, errors: [`В момент t = ${pr.t} формулы не определены.`] };
  let range: PointsResult['range'] = null;
  if (pr.t2 > pr.t1) {
    let nx0 = Infinity,
      nx1 = -Infinity,
      ny0 = Infinity,
      ny1 = -Infinity;
    for (let i = 0; i <= 4000; i++) {
      const { N } = at(pr.t1 + ((pr.t2 - pr.t1) * i) / 4000);
      if (!N.every(Number.isFinite)) continue;
      nx0 = Math.min(nx0, N[0]);
      nx1 = Math.max(nx1, N[0]);
      ny0 = Math.min(ny0, N[1]);
      ny1 = Math.max(ny1, N[1]);
    }
    range = { Nx: [clean(nx0), clean(nx1)], Ny: [clean(ny0), clean(ny1)] };
  }
  const c2 = (v: [number, number]) => v.map(clean) as [number, number];
  return { ok: true, errors: [], masses, M, ex, C: c2(s.C), vC: c2([s.Q[0] / M, s.Q[1] / M]), aC: c2([s.R[0] / M, s.R[1] / M]), Q: c2(s.Q), R: c2(s.R), N: c2(s.N), range };
}

/* ---------- сохранение положения центра масс ---------- */

export interface ShiftPart {
  name: string;
  m: number;
  /** Перемещение относительно основания и его угол к оси x, градусы. */
  s: number;
  theta: number;
}
export interface ShiftProblem {
  /** Масса основания (лодки, платформы, клина). */
  M0: number;
  parts: ShiftPart[];
  /** Найти перемещение части с этим номером, чтобы основание осталось на месте (−1 — найти перемещение основания). */
  unknown: number;
}
export interface ShiftResult {
  ok: boolean;
  errors: string[];
  /** Горизонтальные перемещения частей относительно основания. */
  dx: number[];
  total: number;
  /** Σ m_i·Δx_i. */
  moment: number;
  /** Перемещение основания (unknown = −1) или найденное s части. */
  answer: number;
}

export function solveShift(pr: ShiftProblem): ShiftResult {
  const errors: string[] = [];
  if (!(pr.M0 >= 0)) errors.push('Масса основания не может быть отрицательной.');
  pr.parts.forEach((p, i) => {
    if (!(p.m > 0)) errors.push(`Часть ${i + 1}: масса (вес) — положительное число.`);
  });
  const dx = pr.parts.map((p) => clean(p.s * Math.cos((p.theta * Math.PI) / 180)));
  const total = pr.M0 + pr.parts.reduce((s, p) => s + p.m, 0);
  if (!(total > 0)) errors.push('Масса системы равна нулю.');
  const u = pr.unknown;
  if (u >= 0) {
    if (u >= pr.parts.length) errors.push('Нет части с таким номером.');
    else if (Math.abs(Math.cos((pr.parts[u].theta * Math.PI) / 180)) < 1e-12) errors.push('Искомая часть движется вертикально — она не может компенсировать смещение.');
  }
  if (errors.length) return { ok: false, errors, dx, total, moment: 0, answer: 0 };
  if (u < 0) {
    const moment = pr.parts.reduce((s, p, i) => s + p.m * dx[i], 0);
    return { ok: true, errors: [], dx, total, moment, answer: clean(-moment / total) };
  }
  // Основание на месте: Σ m_i·Δx_i = 0.
  const rest = pr.parts.reduce((s, p, i) => (i === u ? s : s + p.m * dx[i]), 0);
  const dxu = -rest / pr.parts[u].m;
  const s = dxu / Math.cos((pr.parts[u].theta * Math.PI) / 180);
  return { ok: true, errors: [], dx: dx.map((v, i) => (i === u ? clean(dxu) : v)), total, moment: rest, answer: clean(s) };
}
