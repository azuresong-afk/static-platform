/**
 * Сходящиеся силы (Мещерский §1–2, 6) и приведение системы сил к простейшему виду (§7).
 *
 * Узел: силы приложены в одной точке O. Известные силы — модуль и направление; неизвестные — только модуль
 * (нить, стержень, гладкая опора). Направление задаётся вектором (к другому концу нити, стержня) или углом
 * к оси x в плоскости. Положительное усилие направлено вдоль заданного вектора (у нити и стержня — от узла:
 * растяжение). На плоскости — два уравнения проекций, в пространстве — три.
 *
 * Приведение: силы в точках и пары → главный вектор R и главный момент M_O; инвариант R·M_O определяет
 * простейший вид: равновесие, пара, равнодействующая или динамический винт (динама).
 */
import { gauss } from '../../../shared/gauss';
import { rankOf } from '../../../shared/rank';

export type V3 = [number, number, number];
const rad = (a: number) => (a * Math.PI) / 180;
const clean = (v: number) => (Math.abs(v) < 1e-12 ? 0 : v);
export const norm = (a: V3) => Math.hypot(a[0], a[1], a[2]);
export const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const unit = (a: V3): V3 => {
  const L = norm(a) || 1;
  return [clean(a[0] / L), clean(a[1] / L), clean(a[2] / L)];
};

/** Сила в узле. kind: known — известна; rope — нить (только растяжение); rod — стержень; normal — гладкая опора (только давит). */
export interface NodeForce {
  name: string;
  kind: 'known' | 'rope' | 'rod' | 'normal';
  /** Модуль известной силы. */
  F: number;
  /** Направление: вектор (vec) или угол к оси x в плоскости xy (ang). */
  dirMode: 'vec' | 'ang';
  v: V3;
  ang: number;
}
export interface NodeProblem {
  forces: NodeForce[];
}

export const dirOf = (f: NodeForce): V3 => (f.dirMode === 'ang' ? [clean(Math.cos(rad(f.ang))), clean(Math.sin(rad(f.ang))), 0] : unit(f.v));

export type NodeStatus = 'ok' | 'indeterminate' | 'mechanism' | 'noequilibrium' | 'nounknown';
export interface NodeResult {
  status: NodeStatus;
  /** Плоская задача (все направления в плоскости xy). */
  plane: boolean;
  dirs: V3[];
  /** Найденные модули неизвестных (по индексу силы). */
  vals: Record<number, number>;
  /** Неизвестные, у которых знак противоречит виду связи (сжатая нить, «тянущая» опора). */
  bad: number[];
}

export function solveNode(pr: NodeProblem): NodeResult {
  const dirs = pr.forces.map(dirOf);
  const plane = dirs.every((d) => Math.abs(d[2]) < 1e-12);
  const axes = plane ? [0, 1] : [0, 1, 2];
  const unk = pr.forces.map((f, i) => (f.kind === 'known' ? -1 : i)).filter((i) => i >= 0);
  const base = { plane, dirs, vals: {}, bad: [] as number[] };
  if (!unk.length) {
    const sum = axes.map((a) => pr.forces.reduce((s, f, i) => s + f.F * dirs[i][a], 0));
    return { ...base, status: sum.every((v) => Math.abs(v) < 1e-9) ? 'nounknown' : 'noequilibrium' };
  }
  const A = axes.map((a) => unk.map((i) => dirs[i][a]));
  const b = axes.map((a) => -pr.forces.reduce((s, f, i) => s + (f.kind === 'known' ? f.F * dirs[i][a] : 0), 0));
  if (unk.length > axes.length) return { ...base, status: rankOf(A) === axes.length ? 'indeterminate' : 'mechanism' };
  const rk = rankOf(A);
  if (rk < unk.length) return { ...base, status: 'mechanism' };
  // Неизвестных меньше, чем уравнений: решаем по независимым строкам и проверяем остальные.
  const rows: number[][] = [],
    rhs: number[] = [];
  A.forEach((r, j) => {
    if (rows.length < unk.length && rankOf([...rows, r]) > rows.length) {
      rows.push(r);
      rhs.push(b[j]);
    }
  });
  const x = gauss(rows, rhs).map(clean);
  const vals: Record<number, number> = {};
  unk.forEach((i, j) => (vals[i] = x[j]));
  const ok = A.every((r, j) => Math.abs(r.reduce((s, c, k) => s + c * x[k], 0) - b[j]) < 1e-7 * Math.max(1, ...b.map(Math.abs)));
  if (!ok) return { ...base, vals, status: 'noequilibrium' };
  const bad = unk.filter((i) => (pr.forces[i].kind === 'rope' || pr.forces[i].kind === 'normal') && vals[i] < -1e-9);
  return { ...base, status: 'ok', vals, bad };
}

/* ---------- приведение системы сил ---------- */

export interface SysForce {
  name: string;
  /** Точка приложения. */
  r: V3;
  /** Составляющие силы. */
  F: V3;
}
export interface SysPair {
  name: string;
  /** Вектор момента пары. */
  M: V3;
}
export interface ReduceProblem {
  forces: SysForce[];
  pairs: SysPair[];
  /** Центр приведения. */
  O: V3;
}

export type ReduceKind = 'equilibrium' | 'pair' | 'resultant' | 'dynamo';
export interface ReduceResult {
  R: V3;
  M: V3;
  /** Инвариант R·M_O. */
  inv: number;
  kind: ReduceKind;
  plane: boolean;
  /** Момент динамы (проекция M_O на R); шаг винта p = M* / R. */
  Mstar: number;
  /** Точка центральной оси (линии действия равнодействующей), ближайшая к центру O. */
  axisPoint: V3 | null;
  /** Пересечение центральной оси с плоскостью Oxy (если R_z ≠ 0) — для ответа как в книге. */
  xyPoint: [number, number] | null;
}

export function reduceSystem(pr: ReduceProblem): ReduceResult {
  const R: V3 = [0, 0, 0],
    M: V3 = [0, 0, 0];
  for (const f of pr.forces) {
    const rr: V3 = [f.r[0] - pr.O[0], f.r[1] - pr.O[1], f.r[2] - pr.O[2]];
    const m = cross(rr, f.F);
    for (let i = 0; i < 3; i++) {
      R[i] += f.F[i];
      M[i] += m[i];
    }
  }
  for (const p of pr.pairs) for (let i = 0; i < 3; i++) M[i] += p.M[i];
  for (let i = 0; i < 3; i++) {
    R[i] = clean(R[i]);
    M[i] = clean(M[i]);
  }
  const plane = pr.forces.every((f) => Math.abs(f.F[2]) < 1e-12 && Math.abs(f.r[2] - pr.O[2]) < 1e-12) && pr.pairs.every((p) => Math.abs(p.M[0]) < 1e-12 && Math.abs(p.M[1]) < 1e-12);
  const Rn = norm(R),
    Mn = norm(M);
  const scale = Math.max(1, ...pr.forces.map((f) => norm(f.F) * (1 + norm(f.r))), ...pr.pairs.map((p) => norm(p.M)));
  const inv = clean(dot(R, M));
  if (Rn < 1e-9 * scale) return { R, M, inv, kind: Mn < 1e-9 * scale ? 'equilibrium' : 'pair', plane, Mstar: 0, axisPoint: null, xyPoint: null };
  const Mstar = inv / Rn;
  const c = cross(R, M);
  const axisPoint: V3 = [pr.O[0] + c[0] / Rn ** 2, pr.O[1] + c[1] / Rn ** 2, pr.O[2] + c[2] / Rn ** 2];
  let xyPoint: [number, number] | null = null;
  if (Math.abs(R[2]) > 1e-12) {
    const t = -axisPoint[2] / R[2];
    xyPoint = [clean(axisPoint[0] + t * R[0]), clean(axisPoint[1] + t * R[1])];
  }
  const kind: ReduceKind = Math.abs(Mstar) < 1e-9 * scale ? 'resultant' : 'dynamo';
  return { R, M, inv, kind, plane, Mstar, axisPoint: axisPoint.map(clean) as V3, xyPoint };
}
