/**
 * Решение системы уравнений равновесия (как solve() прототипа):
 * 1) проверка определимости по числу неизвестных и рангу системы кандидатов;
 * 2) жадно — уравнения, где осталось одно неизвестное;
 * 3) остальное — совместно (Гаусс) по независимым уравнениям;
 * 4) все кандидаты подставляются для проверки совместности; выбирается проверочное уравнение.
 */
import { known, type Eq } from './equations';
import { firstViolated, pickCheck, residual } from './check';
import { gauss } from '../../../shared/gauss';
import { eqCount, oneSidedKeys, type Model } from './model';
import { rankOf } from '../../../shared/rank';
import { isFrictionModel, solveFriction, type FrictionResult } from './friction';

/** friction — равновесие с трением или односторонними связями: ответ — условия (интервал), а не одно решение. */
/** unsupported — расчёт не выполняется: трение в шарнире вместе со связями-неравенствами (см. solve). */
export type Status = 'ok' | 'indeterminate' | 'mechanism' | 'noequilibrium' | 'nosupport' | 'friction' | 'unsupported';

export interface SolveStep {
  e: Eq;
  /** Неизвестное, найденное из этого уравнения. */
  key: string;
  /** Значения, найденные до этого шага. */
  before: Record<string, number>;
}

export interface Solution {
  status: Status;
  /** Число неизвестных. */
  n: number;
  rank?: number;
  steps: SolveStep[];
  joint: { eqs: Eq[]; keys: string[]; before: Record<string, number> } | null;
  vals: Record<string, number>;
  check: { e: Eq; r: number } | null;
  badEq?: Eq;
  badR?: number;
  /** Расчёт с трением и односторонними связями. */
  friction?: FrictionResult;
  /**
   * Односторонние связи между телами, которые по расчёту должны были бы тянуть (давление или натяжение < 0):
   * равновесие при такой нагрузке невозможно — тела расходятся, нить провисает.
   */
  slack?: string[];
  /** Перебор случаев: какие односторонние связи работают (см. analyze). */
  cases?: CaseTry[];
  /** Трение в шарнирах: число итераций метода Ньютона (система нелинейна: M_тр = ρ·√(X² + Y²)). */
  pinIters?: number;
}

/** Один случай перебора: работают связи work, остальные односторонние (off) не работают. */
export interface CaseTry {
  work: string[];
  off: string[];
  /** Статус решения в этом случае и неизвестное, оказавшееся отрицательным (если есть). */
  status: Status;
  neg: { key: string; val: number } | null;
  ok: boolean;
}

/** Допуск знака односторонней связи. */
export const signTol = (vals: Record<string, number>): number => 1e-7 * Math.max(1, ...Object.values(vals).map(Math.abs));

export function solve(m: Model): Solution {
  const keys = m.unknowns.map((u) => u.key),
    n = keys.length;
  const out: Solution = { status: 'ok', n, steps: [], joint: null, vals: {}, check: null };
  if (!m.supports.length && !n) return { ...out, status: 'nosupport' };
  if (n === 0) return { ...out, status: 'nosupport' };
  // Момент трения в шарнире M_тр = ρ·√(X² + Y²) нелинеен — в расчёт с неравенствами (линейное программирование) не входит.
  if (m.pinFr.length && isFrictionModel(m)) return { ...out, status: 'unsupported' };
  if (isFrictionModel(m)) {
    const fr = solveFriction(m);
    return { ...out, status: fr.feasible && !fr.tooMany ? 'friction' : 'noequilibrium', friction: fr };
  }
  out.rank = rankOf(m.cands.map((e) => keys.map((k) => e.coeffs[k] || 0)));
  if (m.pinFr.length) return solvePinFriction(m, out);
  // Независимых уравнений столько, каков ранг. Если неизвестных больше:
  // ранг 3 — связи закрепляют тело, но лишние (неопределимость степени n − 3);
  // ранг < 3 — какое-то перемещение не закреплено (изменяемая система), даже если связей больше трёх.
  // (Прототип ставил «неопределима» при любом n > 3 до проверки ранга — баг №1.)
  // Для составной конструкции независимых уравнений 3 на каждую часть.
  // Тело-точка даёт два уравнения проекций, остальные части — по три.
  if (out.rank < n) return { ...out, status: out.rank === eqCount(m) ? 'indeterminate' : 'mechanism' };

  const used = new Set<string>(),
    vals: Record<string, number> = {};
  let progress = true;
  while (Object.keys(vals).length < n && progress) {
    progress = false;
    for (const e of m.cands) {
      if (used.has(e.id)) continue;
      const rem = keys.filter((k) => !(k in vals) && Math.abs(e.coeffs[k] || 0) > 1e-12);
      if (rem.length !== 1) continue;
      const k = rem[0],
        before = { ...vals };
      vals[k] = -known(e, vals) / e.coeffs[k];
      out.steps.push({ e, key: k, before });
      used.add(e.id);
      progress = true;
      break;
    }
  }
  const R = keys.filter((k) => !(k in vals));
  if (R.length) {
    const before = { ...vals },
      rows: number[][] = [],
      eqs: Eq[] = [];
    for (const e of m.cands) {
      if (used.has(e.id)) continue;
      const row = R.map((k) => e.coeffs[k] || 0);
      if (rankOf([...rows, row]) > rows.length) {
        rows.push(row);
        eqs.push(e);
      }
      if (rows.length === R.length) break;
    }
    if (rows.length < R.length) return { ...out, status: 'mechanism' };
    const x = gauss(
      rows,
      eqs.map((e) => -known(e, vals)),
    );
    R.forEach((k, i) => (vals[k] = x[i]));
    eqs.forEach((e) => used.add(e.id));
    out.joint = { eqs, keys: R, before };
  }
  out.vals = vals;
  const bad = firstViolated(m.cands, vals);
  if (bad) return { ...out, status: 'noequilibrium', badEq: bad, badR: residual(bad, vals) };
  const best = pickCheck(m.cands, used);
  if (best) out.check = { e: best, r: residual(best, vals) };
  out.status = 'ok';
  // Касание может только давить, нить — только тянуть.
  const tol = signTol(vals);
  const slack = oneSidedKeys(m).filter((k) => vals[k] < -tol);
  if (slack.length) return { ...out, status: 'noequilibrium', slack };
  return out;
}

/**
 * Трение в шарнирах: к линейным уравнениям равновесия добавляются нелинейные M_тр = ρ·√(X² + Y²) — по одному
 * на шарнир. Независимых уравнений равновесия должно быть на столько меньше неизвестных, сколько шарниров с трением.
 * Начальное приближение — решение без трения (M_тр = 0), затем метод Ньютона.
 */
function solvePinFriction(m: Model, out: Solution): Solution {
  const keys = m.unknowns.map((u) => u.key),
    n = keys.length,
    k = m.pinFr.length;
  const rows: number[][] = [],
    eqs: Eq[] = [];
  for (const e of m.cands) {
    const row = keys.map((kk) => e.coeffs[kk] || 0);
    if (rankOf([...rows, row]) > rows.length) {
      rows.push(row);
      eqs.push(e);
    }
  }
  if (rows.length + k < n) return { ...out, status: rows.length === eqCount(m) ? 'indeterminate' : 'mechanism' };
  if (rows.length + k > n) return { ...out, status: 'noequilibrium', badEq: eqs[eqs.length - 1] };
  const b = eqs.map((e) => -e.cst);
  const idx = (kk: string) => keys.indexOf(kk);
  const scale = Math.max(1, ...b.map(Math.abs));
  // Начальное приближение: давление на ось — против суммы известных сил (M_тр = ρ·(c·X + s·Y)), затем Ньютон.
  let fx = 0,
    fy = 0;
  for (const a of m.knowns)
    if (a.kind === 'f') {
      fx += a.val * a.dx;
      fy += a.val * a.dy;
    }
  const fl = Math.hypot(fx, fy);
  const [c0, s0] = fl > 1e-12 ? [-fx / fl, -fy / fl] : [0, 1];
  const extra0 = m.pinFr.map((p) => keys.map((kk) => (kk === p.M ? 1 : kk === p.X ? -p.rho * c0 : kk === p.Y ? -p.rho * s0 : 0)));
  let x = gauss([...rows, ...extra0], [...b, ...m.pinFr.map(() => 0)]);
  if (x.some((v) => !Number.isFinite(v))) return { ...out, status: 'mechanism' };
  let it = 0;
  for (; it < 60; it++) {
    const J = rows.map((r) => [...r]),
      F = rows.map((r, i) => r.reduce((s, c, j) => s + c * x[j], 0) - b[i]);
    for (const p of m.pinFr) {
      const X = x[idx(p.X)],
        Y = x[idx(p.Y)],
        R = Math.hypot(X, Y) || 1e-300;
      const row = keys.map(() => 0);
      row[idx(p.M)] = 1;
      if (R > 1e-300) {
        row[idx(p.X)] = (-p.rho * X) / R;
        row[idx(p.Y)] = (-p.rho * Y) / R;
      }
      J.push(row);
      F.push(x[idx(p.M)] - p.rho * R);
    }
    const dx = gauss(
      J,
      F.map((v) => -v),
    );
    if (dx.some((v) => !Number.isFinite(v))) return { ...out, status: 'mechanism' };
    x = x.map((v, i) => v + dx[i]);
    if (Math.max(...dx.map(Math.abs)) < 1e-13 * scale) break;
  }
  const vals: Record<string, number> = {};
  keys.forEach((kk, i) => (vals[kk] = x[i]));
  out.vals = vals;
  out.pinIters = it + 1;
  out.joint = { eqs, keys, before: {} };
  const bad = firstViolated(m.cands, vals);
  if (bad) return { ...out, status: 'noequilibrium', badEq: bad, badR: residual(bad, vals) };
  const used = new Set(eqs.map((e) => e.id));
  const best = pickCheck(m.cands, used);
  if (best) out.check = { e: best, r: residual(best, vals) };
  out.status = 'ok';
  return out;
}
