/**
 * Уравнения сложного движения точки и её траектории (Мещерский §21).
 *
 * Подвижные оси ξηζ: начало движется по x = X₀(t), y = Y₀(t), z = Z₀(t), оси поворачиваются на угол φ(t) вокруг
 * оси, параллельной z (φ = 0 — поступательное движение). Положение точки задано в одной системе — находим в другой:
 *   x = X₀ + ξ cos φ − η sin φ,  y = Y₀ + ξ sin φ + η cos φ,  z = Z₀ + ζ;
 *   ξ = (x − X₀) cos φ + (y − Y₀) sin φ,  η = −(x − X₀) sin φ + (y − Y₀) cos φ,  ζ = z − Z₀.
 * Уравнение траектории — исключение t в найденных формулах (поиск многочлена P(x, y) — как в «Кинематике точки»);
 * если алгебраического уравнения нет, но одна координата линейна по t, траектория записывается явно подстановкой t.
 * Если точка идёт по подвижной оси ξ с линейным законом, а оси вращаются равномерно (η ≡ 0, ζ ≡ 0, начало в точке O),
 * абсолютная траектория — спираль Архимеда r = kφ + r₀.
 */
import { evalExpr, parseExpr, printExpr, simplify, type Expr } from '../../../shared/expr';
import { lin } from '../../../shared/integ';
import { solveKin, type KinProblem, type KinResult } from '../../pointkin/model/kin';
import { trajEquation, type TrajEq } from '../../pointkin/model/traj';

export interface EqProblem {
  /** abs: задано относительное движение ξ, η, ζ — ищем абсолютное; rel: задано абсолютное x, y, z — ищем относительное. */
  dir: 'abs' | 'rel';
  X0: string;
  Y0: string;
  Z0: string;
  phi: string;
  /** Заданное движение: ξ, η, ζ (dir = abs) или x, y, z (dir = rel). */
  u: string;
  v: string;
  w: string;
  t: number;
  t1: number;
  t2: number;
}
export const EQ_STR = ['X0', 'Y0', 'Z0', 'phi', 'u', 'v', 'w'] as const;
export type EqStrKey = (typeof EQ_STR)[number];

type S3 = [string, string, string];
export interface EqResult {
  ok: boolean;
  errors: string[];
  /** Формулы заданного и найденного движений (после упрощения) и их значения при t. */
  given: S3;
  found: S3;
  givenAt: [number, number, number];
  foundAt: [number, number, number];
  /** Найденное движение как координатный закон — траектория, скорость, ускорение. */
  kp: KinProblem;
  kin: KinResult;
  traj: TrajEq | null;
  /** Явное уравнение траектории подстановкой t (если нет алгебраического). */
  explicit: string | null;
  /** Спираль Архимеда r = kφ + r₀ (абсолютная траектория, точка по подвижной оси). */
  polar: { k: number; r0: number; text: string } | null;
  phiAt: number;
}

const par = (s: string) => `(${s.trim() === '' ? '0' : s.trim()})`;
const pr = (e: Expr) => printExpr(simplify(e));
const NUM = (v: number): Expr => ({ k: 'num', v });

/** Подстановка вместо t выражения r. */
function subst(e: Expr, r: Expr): Expr {
  switch (e.k) {
    case 't':
      return r;
    case 'num':
    case 'var':
      return e;
    case 'neg':
      return { k: 'neg', a: subst(e.a, r) };
    case 'fn':
      return { k: 'fn', f: e.f, a: subst(e.a, r) };
    default:
      return { k: e.k, a: subst(e.a, r), b: subst(e.b, r) };
  }
}

export function solveEq(p: EqProblem): EqResult {
  const errors: string[] = [];
  const names = ['X₀', 'Y₀', 'Z₀', 'φ', 'u', 'v', 'w'];
  const src = [p.X0, p.Y0, p.Z0, p.phi, p.u, p.v, p.w];
  const parsed = src.map((s, i) => {
    const r = parseExpr(s);
    if (!r.ok) errors.push(`${names[i]}: ${r.error}.`);
    return r.ok ? r.e : NUM(0);
  });
  const cos = `cos${par(p.phi)}`,
    sin = `sin${par(p.phi)}`;
  const [X, Y, Z, u, v, w] = [par(p.X0), par(p.Y0), par(p.Z0), par(p.u), par(p.v), par(p.w)];
  const comp: S3 =
    p.dir === 'abs'
      ? [`${X}+${u}*${cos}-${v}*${sin}`, `${Y}+${u}*${sin}+${v}*${cos}`, `${Z}+${w}`]
      : [`(${u}-${X})*${cos}+(${v}-${Y})*${sin}`, `-(${u}-${X})*${sin}+(${v}-${Y})*${cos}`, `${w}-${Z}`];
  const ce = comp.map((q) => parseExpr(q));
  for (const q of ce) if (!q.ok) errors.push(q.error + '.');
  const kp: KinProblem = { mode: 'coord', x: comp[0], y: comp[1], z: comp[2], s: '', rho: 0, r: '', phi: '', t: p.t, t1: p.t1, t2: p.t2 };
  const kin = solveKin(kp);
  const ok = errors.length === 0 && kin.ok;
  const fx = ce.map((q) => (q.ok ? q.e : NUM(0)));
  const show = (e: Expr[]): S3 => [pr(e[0]), pr(e[1]), pr(e[2])];
  const at = (e: Expr[]): [number, number, number] => [evalExpr(e[0], p.t), evalExpr(e[1], p.t), evalExpr(e[2], p.t)];
  const g = parsed.slice(4);
  const res: EqResult = {
    ok,
    errors: errors.concat(kin.ok ? [] : kin.errors),
    given: show(g),
    found: show(fx),
    givenAt: at(g),
    foundAt: at(fx),
    kp,
    kin,
    traj: null,
    explicit: null,
    polar: null,
    phiAt: ok ? evalExpr(parsed[3], p.t) : 0,
  };
  if (!ok) return res;
  res.traj = trajEquation(kp, kin);
  // Явная запись y(x) подстановкой t = (x − β)/α, если x(t) линейна.
  const lx = lin(simplify(fx[0]));
  if (lx && Math.abs(lx.a) > 1e-12 && (!res.traj || res.traj.none.length > 0)) {
    const tx: Expr = { k: 'div', a: { k: 'sub', a: { k: 'var', n: 'x' }, b: NUM(lx.b) }, b: NUM(lx.a) };
    res.explicit = pr(subst(fx[1], tx)).replace(/\bt\b/g, 'x');
  }
  // Спираль Архимеда: абсолютное движение, точка на оси ξ.
  if (p.dir === 'abs') {
    const zero = (e: Expr, ...t: number[]) => t.every((x) => Math.abs(evalExpr(e, x)) < 1e-12);
    const lu = lin(simplify(parsed[4])),
      lf = lin(simplify(parsed[3]));
    if (
      zero(parsed[0], 0, 1, 2) &&
      zero(parsed[1], 0, 1, 2) &&
      zero(parsed[5], 0, 1, 2) &&
      zero(parsed[6], 0, 1, 2) &&
      zero(parsed[2], 0, 1, 2) &&
      lu &&
      lf &&
      Math.abs(lf.a) > 1e-12 &&
      Math.abs(lu.a) > 1e-12
    ) {
      const k = lu.a / lf.a,
        r0 = lu.b - k * lf.b;
      const n = (x: number) => printExpr({ k: 'num', v: x });
      res.polar = { k, r0, text: `r = ${n(k)}·φ${r0 === 0 ? '' : r0 > 0 ? ` + ${n(r0)}` : ` − ${n(-r0)}`}` };
    }
  }
  return res;
}
