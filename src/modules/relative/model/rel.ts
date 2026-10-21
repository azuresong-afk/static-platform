/**
 * Сложное движение точки (Мещерский §22–23).
 *
 * Подвижная система ξηζ связана с телом. Переносное движение — вращение тела вокруг неподвижной оси ζ (через начало)
 * по закону φ(t) или поступательное движение по законам x(t), y(t), z(t). Относительное движение — положение точки
 * в осях тела ρ(t): по формулам ξ(t), η(t), ζ(t), по прямой (s(t) от начальной точки) или по окружности (дуга s(t)
 * или угол θ(t)). Производные — символьные.
 *
 * Векторы в осях тела, ω = ωk, ε = εk:
 *   v_e = ω × ρ,  v_r = ρ̇,  v = v_e + v_r;
 *   a_e^τ = ε × ρ,  a_e^n = −ω²ρ⊥ (к оси),  a_r = ρ̈,  a_c = 2ω × v_r,  a = a_e^τ + a_e^n + a_r + a_c.
 * При поступательном переносном движении v_e = Ṙ, a_e = R̈, a_c = 0.
 */
import { diff, evalExpr, parseExpr, simplify, type Expr } from '../../../shared/expr';

export type Plane = 'xy' | 'xz' | 'yz';
export interface RelProblem {
  carrier: 'rot' | 'trans';
  /** Закон вращения тела вокруг оси ζ (против часовой стрелки, если смотреть с конца ζ). */
  phi: string;
  /** Поступательное переносное движение: законы движения тела. */
  xe: string;
  ye: string;
  ze: string;
  path: 'xyz' | 'line' | 'circle';
  /** Относительное движение по формулам. */
  x: string;
  y: string;
  z: string;
  /** Плоскость, в которой лежит прямая или окружность; начальная точка прямой или центр окружности. */
  plane: Plane;
  p0: [string, string, string];
  /** Угол прямой к первой оси плоскости или начальный угол на окружности, градусы. */
  ang: string;
  R: string;
  /** Закон по окружности: дуговая координата s(t) или угол θ(t) (рад). */
  law: 's' | 'theta';
  s: string;
  t: number;
}

type V3 = [number, number, number];
export interface RelResult {
  ok: boolean;
  errors: string[];
  /** Положение точки в осях тела как функции t. */
  rho: [Expr, Expr, Expr];
  d1: [Expr, Expr, Expr];
  d2: [Expr, Expr, Expr];
  /** Переносное движение: φ, ω, ε (или законы поступательного движения и их производные). */
  carrier: { e: Expr[]; d1: Expr[]; d2: Expr[] };
  omega: number;
  eps: number;
  pos: V3;
  ve: V3;
  vr: V3;
  v: V3;
  aet: V3;
  aen: V3;
  ar: V3;
  ac: V3;
  a: V3;
  /** Относительное движение: касательное и нормальное ускорения, радиус кривизны относительной траектории. */
  arT: number;
  arN: number;
  rhoR: number | null;
  /** Проекции абсолютного ускорения на касательную и нормаль относительной траектории (если определены). */
  aT: number | null;
  aN: number | null;
}

const N = (v: number): Expr => ({ k: 'num', v });
const add = (a: Expr, b: Expr): Expr => ({ k: 'add', a, b });
const mul = (a: Expr, b: Expr): Expr => ({ k: 'mul', a, b });
const fn = (f: 'sin' | 'cos', a: Expr): Expr => ({ k: 'fn', f, a });
export const PLANE_AXES: Record<Plane, [number, number]> = { xy: [0, 1], xz: [0, 2], yz: [1, 2] };
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const plus = (...vs: V3[]): V3 => vs.reduce((s, v) => [s[0] + v[0], s[1] + v[1], s[2] + v[2]], [0, 0, 0]);
const scale = (k: number, v: V3): V3 => [k * v[0], k * v[1], k * v[2]];
export const norm = (v: V3) => Math.hypot(v[0], v[1], v[2]);
const ZERO = N(0);

export function solveRel(pr: RelProblem): RelResult {
  const errors: string[] = [];
  const P = (s: string, what: string): Expr => {
    if (!s.trim()) return ZERO;
    const r = parseExpr(s);
    if (!r.ok) errors.push(`${what}: ${r.error}.`);
    return r.ok ? r.e : ZERO;
  };
  const C = (s: string, what: string): number => {
    const e = P(s, what);
    const v = evalExpr(e, 0);
    if (!Number.isFinite(v)) errors.push(`${what} — не число.`);
    return v;
  };
  // Относительное положение ρ(t) в осях тела.
  let rho: [Expr, Expr, Expr] = [ZERO, ZERO, ZERO];
  if (pr.path === 'xyz') rho = [P(pr.x, 'ξ(t)'), P(pr.y, 'η(t)'), P(pr.z, 'ζ(t)')];
  else {
    const p0 = pr.p0.map((s, i) => C(s, ['ξ₀', 'η₀', 'ζ₀'][i])) as V3;
    const [i1, i2] = PLANE_AXES[pr.plane];
    const a = (C(pr.ang, 'угол') * Math.PI) / 180;
    const s = P(pr.s, pr.path === 'circle' && pr.law === 'theta' ? 'θ(t)' : 's(t)');
    const r = rho.slice() as [Expr, Expr, Expr];
    if (pr.path === 'line') {
      const u: V3 = [0, 0, 0];
      u[i1] = Math.cos(a);
      u[i2] = Math.sin(a);
      for (let i = 0; i < 3; i++) r[i] = add(N(p0[i]), mul(N(u[i]), s));
    } else {
      const R = C(pr.R, 'радиус');
      if (!(R > 0)) errors.push('Радиус окружности — положительное число.');
      const th = add(N(a), pr.law === 'theta' ? s : mul(N(1 / (R || 1)), s));
      for (let i = 0; i < 3; i++) r[i] = N(p0[i]);
      r[i1] = add(N(p0[i1]), mul(N(R), fn('cos', th)));
      r[i2] = add(N(p0[i2]), mul(N(R), fn('sin', th)));
    }
    rho = r.map(simplify) as [Expr, Expr, Expr];
  }
  const carrierE = pr.carrier === 'rot' ? [P(pr.phi, 'φ(t)')] : [P(pr.xe, 'x(t)'), P(pr.ye, 'y(t)'), P(pr.ze, 'z(t)')];
  const cd1 = carrierE.map(diff),
    cd2 = cd1.map(diff);
  const d1 = rho.map(diff) as [Expr, Expr, Expr],
    d2 = d1.map(diff) as [Expr, Expr, Expr];
  const z3: V3 = [0, 0, 0];
  const base: RelResult = { ok: false, errors, rho, d1, d2, carrier: { e: carrierE, d1: cd1, d2: cd2 }, omega: 0, eps: 0, pos: z3, ve: z3, vr: z3, v: z3, aet: z3, aen: z3, ar: z3, ac: z3, a: z3, arT: 0, arN: 0, rhoR: null, aT: null, aN: null };
  if (errors.length) return base;
  const t = pr.t;
  const ev = (es: Expr[]) => es.map((e) => evalExpr(e, t)) as V3;
  const pos = ev(rho),
    vr = ev(d1),
    ar = ev(d2);
  let omega = 0,
    eps = 0,
    ve: V3,
    aet: V3,
    aen: V3,
    ac: V3;
  if (pr.carrier === 'rot') {
    omega = evalExpr(cd1[0], t);
    eps = evalExpr(cd2[0], t);
    const k: V3 = [0, 0, 1];
    ve = scale(omega, cross(k, pos));
    aet = scale(eps, cross(k, pos));
    aen = [-omega * omega * pos[0], -omega * omega * pos[1], 0];
    ac = scale(2 * omega, cross(k, vr));
  } else {
    ve = ev(cd1);
    aet = ev(cd2);
    aen = [0, 0, 0];
    ac = [0, 0, 0];
  }
  const v = plus(ve, vr),
    a = plus(aet, aen, ar, ac);
  if (![...pos, ...v, ...a, omega, eps].every(Number.isFinite)) return { ...base, errors: [`В момент t = ${t} формулы не определены.`] };
  const sv = norm(vr);
  const arT = sv > 1e-12 ? dot(ar, vr) / sv : 0;
  const arN = sv > 1e-12 ? norm(cross(vr, ar)) / sv : norm(ar);
  const rhoR = arN > 1e-12 && sv > 1e-12 ? (sv * sv) / arN : null;
  // Касательная и нормаль относительной траектории: по окружности — к центру, иначе — главная нормаль.
  let aT: number | null = null,
    aN: number | null = null;
  const tau = sv > 1e-12 ? scale(1 / sv, vr) : null;
  let nrm: V3 | null = null;
  if (pr.path === 'circle') {
    const p0 = pr.p0.map((s) => evalExpr(parseExpr(s).ok ? (parseExpr(s) as { e: Expr }).e : ZERO, 0)) as V3;
    const d = plus(p0, scale(-1, pos));
    nrm = scale(1 / (norm(d) || 1), d);
  } else if (tau && arN > 1e-12) {
    const an = plus(ar, scale(-arT, tau));
    nrm = scale(1 / norm(an), an);
  }
  if (tau) aT = dot(a, tau);
  if (nrm) aN = dot(a, nrm);
  const c = (x: V3, s: number) => x.map((q) => (Math.abs(q) < 1e-11 * Math.max(1, s) ? 0 : q)) as V3;
  const S = Math.max(1, norm(a), norm(v));
  return { ...base, ok: true, errors: [], omega, eps, pos, ve: c(ve, S), vr: c(vr, S), v: c(v, S), aet: c(aet, S), aen: c(aen, S), ar: c(ar, S), ac: c(ac, S), a: c(a, S), arT, arN, rhoR, aT, aN };
}

/** Число из поля без t (пустое или неверное — 0). */
export function num0(s: string): number {
  const p = parseExpr(s);
  const v = p.ok ? evalExpr(p.e, 0) : 0;
  return Number.isFinite(v) ? v : 0;
}
