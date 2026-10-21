/**
 * Первая основная задача динамики точки (Мещерский §26): по закону движения x(t), y(t), z(t) найти силу.
 *
 * Скорость и ускорение — символьным дифференцированием формул. По второму закону Ньютона m·a = F + mg,
 * откуда искомая (неизвестная) сила F = m·a − m·g: при учёте силы тяжести её вектор вычитается.
 * Дополнительно — касательная и нормальная составляющие (F_τ = m·dv/dt, F_n = m·v²/ρ) и наибольшее |F| на отрезке.
 */
import { diff, evalExpr, parseExpr, type Expr } from '../../../shared/expr';

export type GravityDir = 'none' | '-y' | '+y' | '-z' | '+x' | '-x';
export interface FirstProblem {
  byWeight: boolean;
  m: number;
  g: number;
  x: string;
  y: string;
  z: string;
  gravity: GravityDir;
  t: number;
  /** Отрезок времени для наибольшей силы. */
  t1: number;
  t2: number;
}

export type V3 = [number, number, number];
export interface FirstResult {
  ok: boolean;
  errors: string[];
  mass: number;
  /** Формулы координат, скоростей и ускорений. */
  r: Expr[];
  v: Expr[];
  a: Expr[];
  /** Значения в момент t. */
  rt: V3;
  vt: V3;
  at: V3;
  /** Вектор m·g. */
  mg: V3;
  /** Искомая сила F = m·a − m·g. */
  F: V3;
  Fn: number;
  Ftau: number;
  /** Нормальная составляющая силы и радиус кривизны. */
  Fnorm: number;
  rho: number | null;
  speed: number;
  /** Наибольшее |F| на отрезке [t1, t2] и момент. */
  Fmax: number | null;
  tMax: number | null;
  /** |F|(t) на отрезке — для графика. */
  curve: { t: number; F: number }[];
}

const clean = (v: number) => (Math.abs(v) < 1e-12 ? 0 : v);
const gVec = (dir: GravityDir, g: number): V3 => {
  switch (dir) {
    case '-y':
      return [0, -g, 0];
    case '+y':
      return [0, g, 0];
    case '-z':
      return [0, 0, -g];
    case '+x':
      return [g, 0, 0];
    case '-x':
      return [-g, 0, 0];
    default:
      return [0, 0, 0];
  }
};

export function solveFirst(pr: FirstProblem): FirstResult {
  const errors: string[] = [];
  const parsed = (['x', 'y', 'z'] as const).map((k) => {
    const p = parseExpr(pr[k]);
    if (!p.ok) errors.push(`${k}(t): ${p.error}.`);
    return p.ok ? p.e : ({ k: 'num', v: 0 } as Expr);
  });
  if (!(pr.m > 0)) errors.push('Масса (вес) точки — положительное число.');
  if (!(pr.g > 0)) errors.push('Ускорение свободного падения g — положительное число.');
  const mass = pr.byWeight ? pr.m / (pr.g || 1) : pr.m;
  const v = parsed.map(diff);
  const a = v.map(diff);
  const at3 = (es: Expr[], t: number) => es.map((e) => evalExpr(e, t)) as V3;
  const mgv = gVec(pr.gravity, pr.g).map((c) => mass * c) as V3;
  const force = (t: number): V3 => at3(a, t).map((c, i) => clean(mass * c - mgv[i])) as V3;
  const zero: V3 = [0, 0, 0];
  const base = { mass, r: parsed, v, a, mg: mgv };
  const fail = (errs: string[]): FirstResult => ({ ok: false, errors: errs, ...base, rt: zero, vt: zero, at: zero, F: zero, Fn: 0, Ftau: 0, Fnorm: 0, rho: null, speed: 0, Fmax: null, tMax: null, curve: [] });
  if (errors.length) return fail(errors);
  const rt = at3(parsed, pr.t).map(clean) as V3,
    vt = at3(v, pr.t).map(clean) as V3,
    att = at3(a, pr.t).map(clean) as V3;
  if (![...rt, ...vt, ...att].every(Number.isFinite)) return fail([`В момент t = ${pr.t} формулы не определены (деление на ноль, корень из отрицательного числа…).`]);
  const F = force(pr.t);
  const speed = Math.hypot(...vt);
  // Составляющие силы F (а не m·a): по касательной и по главной нормали.
  const Ftau = speed > 1e-12 ? clean((F[0] * vt[0] + F[1] * vt[1] + F[2] * vt[2]) / speed) : 0;
  const Fnorm = clean(Math.sqrt(Math.max(0, F[0] ** 2 + F[1] ** 2 + F[2] ** 2 - Ftau ** 2)));
  // Радиус кривизны — по ускорению: a_n = |v × a|/|v|, ρ = v²/a_n.
  const cr = [vt[1] * att[2] - vt[2] * att[1], vt[2] * att[0] - vt[0] * att[2], vt[0] * att[1] - vt[1] * att[0]];
  const an = speed > 1e-12 ? Math.hypot(...cr) / speed : 0;
  const rho = an > 1e-12 ? (speed * speed) / an : null;
  // Наибольшая сила на отрезке: сетка и уточнение.
  let Fmax: number | null = null,
    tMax: number | null = null;
  const curve: { t: number; F: number }[] = [];
  if (pr.t2 > pr.t1) {
    const n = 1200;
    const mag = (t: number) => Math.hypot(...force(t));
    let bestI = 0,
      best = -1;
    for (let i = 0; i <= n; i++) {
      const t = pr.t1 + ((pr.t2 - pr.t1) * i) / n;
      const f = mag(t);
      if (!Number.isFinite(f)) continue;
      curve.push({ t, F: f });
      if (f > best) {
        best = f;
        bestI = i;
      }
    }
    if (best >= 0) {
      // Золотое сечение на соседних узлах.
      let lo = pr.t1 + ((pr.t2 - pr.t1) * Math.max(0, bestI - 1)) / n,
        hi = pr.t1 + ((pr.t2 - pr.t1) * Math.min(n, bestI + 1)) / n;
      for (let it = 0; it < 100; it++) {
        const m1 = lo + (hi - lo) * 0.382,
          m2 = lo + (hi - lo) * 0.618;
        if (mag(m1) > mag(m2)) hi = m2;
        else lo = m1;
      }
      tMax = (lo + hi) / 2;
      Fmax = Math.max(best, mag(tMax));
      if (Fmax === best) tMax = pr.t1 + ((pr.t2 - pr.t1) * bestI) / n;
    }
  }
  return { ok: true, errors: [], ...base, rt, vt, at: att, F, Fn: Math.hypot(...F), Ftau, Fnorm, rho, speed, Fmax, tMax, curve };
}
