/**
 * Угловая скорость и угловое ускорение тела по ускорениям двух его точек (Мещерский 18.29–18.36).
 *
 * Для точек A и B одного твёрдого тела a_B = a_A + ε × AB − ω²·AB. Проекции на AB и на перпендикуляр (n = AB,
 * повёрнутый на 90° против часовой стрелки; L = |AB|): (a_B − a_A)·e = −ω²L, (a_B − a_A)·n = εL — ω² и ε находятся
 * из двух линейных уравнений; знак ω по ускорениям не определяется. Остальные точки: a_C = a_A + ε × AC − ω²·AC.
 * Мгновенный центр ускорений Q (a_Q = 0): AQ = −M⁻¹a_A, M = [[−ω², −ε], [ε, −ω²]]; угол μ между ускорением точки
 * и направлением на Q: tg μ = |ε|/ω².
 */
import { evalExpr, parseExpr } from '../../../shared/expr';

export interface Acc2Problem {
  /** Точки тела в его плоскости: первые две — с заданными ускорениями. */
  pts: { name: string; x: string; y: string }[];
  /** Ускорения первых двух точек: модуль и угол с осью x (градусы, против часовой стрелки). */
  a: { mag: string; ang: string }[];
}

export interface Acc2Point {
  name: string;
  pos: [number, number];
  acc: [number, number];
  mag: number;
  /** Угол вектора ускорения с осью x, градусы (−180; 180]. */
  ang: number;
  given: boolean;
}
export interface Acc2Result {
  ok: boolean;
  errors: string[];
  /** Вектор AB, его длина, разность ускорений. */
  ab: [number, number];
  L: number;
  d: [number, number];
  /** Проекции разности ускорений на AB и на перпендикуляр. */
  dAlong: number;
  dPerp: number;
  eps: number;
  w2: number;
  w: number;
  pts: Acc2Point[];
  /** Мгновенный центр ускорений (null — ω = ε = 0, ускорения всех точек равны). */
  ica: [number, number] | null;
  /** Угол между ускорением точки и направлением на МЦУ, градусы (0…90). */
  mu: number | null;
}

const num = (s: string, label: string, errors: string[]): number => {
  const e = parseExpr(s);
  const v = e.ok ? evalExpr(e.e, 0) : NaN;
  if (!Number.isFinite(v)) errors.push(`${label}: ${e.ok ? 'не число' : e.error}.`);
  return v;
};
const clean = (v: number) => (Math.abs(v) < 1e-10 ? 0 : v);

export function solveAcc2(pr: Acc2Problem): Acc2Result {
  const errors: string[] = [];
  const empty: Acc2Result = { ok: false, errors, ab: [0, 0], L: 0, d: [0, 0], dAlong: 0, dPerp: 0, eps: 0, w2: 0, w: 0, pts: [], ica: null, mu: null };
  if (pr.pts.length < 2) return { ...empty, errors: ['Нужно хотя бы две точки: A и B.'] };
  const pos = pr.pts.map((p) => [num(p.x, `${p.name}: x`, errors), num(p.y, `${p.name}: y`, errors)] as [number, number]);
  const ang = [0, 1].map((i) => num(pr.a[i]?.ang ?? '0', `ускорение ${pr.pts[i].name}: угол`, errors));
  const mag = [0, 1].map((i) => num(pr.a[i]?.mag ?? '0', `ускорение ${pr.pts[i].name}: модуль`, errors));
  if (errors.length) return empty;
  if (mag.some((m) => m < 0)) return { ...empty, errors: ['Модуль ускорения — неотрицательное число; направление задаёт угол.'] };
  const names = pr.pts.map((p) => p.name.trim());
  if (names.some((n) => !n) || new Set(names).size !== names.length) return { ...empty, errors: ['Названия точек должны быть непустыми и разными.'] };
  const rad = Math.PI / 180;
  const aA: [number, number] = [mag[0] * Math.cos(ang[0] * rad), mag[0] * Math.sin(ang[0] * rad)];
  const aB: [number, number] = [mag[1] * Math.cos(ang[1] * rad), mag[1] * Math.sin(ang[1] * rad)];
  const ab: [number, number] = [pos[1][0] - pos[0][0], pos[1][1] - pos[0][1]];
  const L = Math.hypot(ab[0], ab[1]);
  if (!(L > 1e-12)) return { ...empty, errors: ['Точки A и B совпадают.'] };
  const e: [number, number] = [ab[0] / L, ab[1] / L];
  const n: [number, number] = [-e[1], e[0]];
  const d: [number, number] = [aB[0] - aA[0], aB[1] - aA[1]];
  const dAlong = d[0] * e[0] + d[1] * e[1];
  const dPerp = d[0] * n[0] + d[1] * n[1];
  const scale = Math.max(1e-12, Math.hypot(...aA), Math.hypot(...aB));
  let w2 = -dAlong / L;
  const eps = dPerp / L;
  if (w2 < -1e-9 * scale / L) return { ...empty, errors: [`Такие ускорения невозможны у твёрдого тела: ω² = −(a_B − a_A)·AB/AB² = ${w2} < 0.`] };
  if (w2 < 0) w2 = 0;
  const w = Math.sqrt(w2);
  const acc = pos.map((p, i): [number, number] => {
    if (i === 0) return aA;
    if (i === 1) return aB;
    const rx = p[0] - pos[0][0],
      ry = p[1] - pos[0][1];
    return [aA[0] - eps * ry - w2 * rx, aA[1] + eps * rx - w2 * ry];
  });
  const pts: Acc2Point[] = pos.map((p, i) => ({
    name: names[i],
    pos: p,
    acc: [clean(acc[i][0]), clean(acc[i][1])],
    mag: clean(Math.hypot(...acc[i])),
    ang: clean(Math.atan2(acc[i][1], acc[i][0]) / rad),
    given: i < 2,
  }));
  // МЦУ: (−ω²)x − ε y = −a_Ax, ε x − ω² y = −a_Ay (x, y — от точки A).
  const det = w2 * w2 + eps * eps;
  let ica: [number, number] | null = null;
  let mu: number | null = null;
  if (det > 1e-18) {
    const qx = (aA[0] * w2 - aA[1] * eps) / det,
      qy = (aA[0] * eps + aA[1] * w2) / det;
    // M⁻¹ = (1/det)·[[−ω², ε], [−ε, −ω²]]; AQ = −M⁻¹a_A.
    ica = [clean(pos[0][0] + qx), clean(pos[0][1] + qy)];
    mu = (Math.atan2(Math.abs(eps), w2) * 180) / Math.PI;
  }
  return { ok: true, errors: [], ab, L, d, dAlong: clean(dAlong), dPerp: clean(dPerp), eps: clean(eps), w2: clean(w2), w: clean(w), pts, ica, mu };
}
