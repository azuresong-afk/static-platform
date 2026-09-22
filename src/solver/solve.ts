/**
 * Решение системы уравнений равновесия (как solve() прототипа):
 * 1) проверка определимости по числу неизвестных и рангу системы кандидатов;
 * 2) жадно — уравнения, где осталось одно неизвестное;
 * 3) остальное — совместно (Гаусс) по независимым уравнениям;
 * 4) все кандидаты подставляются для проверки совместности; выбирается проверочное уравнение.
 */
import { known, type Eq } from './equations';
import { firstViolated, pickCheck, residual } from './check';
import { gauss } from './gauss';
import type { Model } from './model';
import { rankOf } from './rank';

export type Status = 'ok' | 'indeterminate' | 'mechanism' | 'noequilibrium' | 'nosupport';

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
}

export function solve(m: Model): Solution {
  const keys = m.unknowns.map((u) => u.key),
    n = keys.length;
  const out: Solution = { status: 'ok', n, steps: [], joint: null, vals: {}, check: null };
  if (!m.supports.length && !n) return { ...out, status: 'nosupport' };
  if (n === 0) return { ...out, status: 'nosupport' };
  out.rank = rankOf(m.cands.map((e) => keys.map((k) => e.coeffs[k] || 0)));
  // Прототип: неопределимость — только по числу неизвестных (n > 3), до сравнения с рангом.
  if (n > 3) return { ...out, status: 'indeterminate' };
  if (out.rank < n) return { ...out, status: 'mechanism' };

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
  return out;
}
