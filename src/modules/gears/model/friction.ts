/**
 * Лобовая фрикционная передача с переменным плечом (Мещерский 14.10).
 *
 * Ведущий ролик радиуса r вращается по закону φ₁(t) и касается диска 2 на расстоянии d(t) от его оси
 * (ролик передвигают вдоль своего вала). Без проскальзывания ω₁r = ω₂d:
 *   ω₂ = ω₁r/d,   ε₂ = dω₂/dt = (ε₁r·d − ω₁r·ḋ)/d²  (символьно).
 * Точка диска 2 на расстоянии R от оси: v = |ω₂|R, a_τ = ε₂R, a_n = ω₂²R, a = R√(ε₂² + ω₂⁴).
 * Момент — заданный t или первый, когда d(t) достигает заданного значения.
 */
import { diff, evalExpr, parseExpr, simplify, type Expr } from '../../../shared/expr';

export interface FrProblem {
  /** Закон поворота ведущего ролика φ₁(t). */
  law: string;
  r: number;
  /** Плечо d(t) — расстояние точки касания от оси диска 2. */
  d: string;
  /** Точка диска 2 (0 — не нужна). */
  R: number;
  t: number;
  /** Искать момент, когда d = dTarget. */
  find: boolean;
  dTarget: number;
  tMax: number;
}

export interface FrResult {
  ok: boolean;
  errors: string[];
  phi1: Expr;
  w1: Expr;
  e1: Expr;
  dE: Expr;
  dd: Expr;
  w2: Expr;
  e2: Expr;
  t: number;
  found: number | null;
  vals: { w1: number; e1: number; d: number; dd: number; w2: number; e2: number };
  point: { R: number; v: number; at: number; an: number; a: number } | null;
}

const ZERO: Expr = { k: 'num', v: 0 };

export function solveFriction(pr: FrProblem): FrResult {
  const errors: string[] = [];
  const p = parseExpr(pr.law),
    q = parseExpr(pr.d);
  if (!p.ok) errors.push(`φ₁(t): ${p.error}.`);
  if (!q.ok) errors.push(`d(t): ${q.error}.`);
  if (!(pr.r > 0)) errors.push('Радиус ведущего ролика — положительное число.');
  if (!(pr.R >= 0)) errors.push('Расстояние точки от оси — неотрицательное число.');
  if (pr.find && !(pr.tMax > 0)) errors.push('Для поиска момента задайте отрезок времени tₘₐₓ > 0.');
  const phi1 = p.ok ? p.e : ZERO,
    dE = q.ok ? q.e : ZERO;
  const w1 = diff(phi1),
    e1 = diff(w1),
    dd = diff(dE);
  const w2 = simplify({ k: 'div', a: { k: 'mul', a: { k: 'num', v: pr.r }, b: w1 }, b: dE });
  const e2 = diff(w2);
  const base: FrResult = { ok: false, errors, phi1, w1, e1, dE, dd, w2, e2, t: pr.t, found: null, vals: { w1: 0, e1: 0, d: 0, dd: 0, w2: 0, e2: 0 }, point: null };
  if (errors.length) return base;
  let t = pr.t,
    found: number | null = null;
  if (pr.find) {
    const g = (s: number) => evalExpr(dE, s) - pr.dTarget;
    const N = 4000;
    let a = 0,
      ga = g(0);
    if (ga === 0) found = 0;
    for (let n = 1; n <= N && found == null; n++) {
      const b = (pr.tMax * n) / N,
        gb = g(b);
      if (gb === 0) found = b;
      else if (Number.isFinite(ga) && Number.isFinite(gb) && ga * gb < 0) {
        let lo = a,
          hi = b;
        for (let it = 0; it < 200; it++) {
          const m = (lo + hi) / 2;
          if (g(m) * ga > 0) lo = m;
          else hi = m;
        }
        found = (lo + hi) / 2;
      }
      (a = b), (ga = gb);
    }
    if (found != null) t = found;
  }
  const v = {
    w1: evalExpr(w1, t),
    e1: evalExpr(e1, t),
    d: evalExpr(dE, t),
    dd: evalExpr(dd, t),
    w2: evalExpr(w2, t),
    e2: evalExpr(e2, t),
  };
  if (Math.abs(v.d) < 1e-12) return { ...base, errors: [`В момент t = ${t} точка касания на оси диска (d = 0): ω₂ не определена.`] };
  if (!Object.values(v).every(Number.isFinite)) return { ...base, errors: [`В момент t = ${t} формулы не определены.`] };
  const point = pr.R > 0 ? { R: pr.R, v: Math.abs(v.w2) * pr.R, at: v.e2 * pr.R * (Math.sign(v.w2) || 1), an: v.w2 * v.w2 * pr.R, a: pr.R * Math.hypot(v.e2, v.w2 * v.w2) } : null;
  return { ...base, ok: true, errors: [], t, found, vals: v, point };
}
