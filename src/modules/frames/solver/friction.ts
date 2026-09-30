/**
 * Равновесие с трением и односторонними связями. Реакции таких опор не находятся из одних уравнений равновесия:
 * их ограничивают неравенства (N ≥ 0, |Fтр| ≤ f·N, |Mк| ≤ k·N, у одностороннего катка R ≥ 0).
 * Если искомая нагрузка одна, находим её наименьшее и наибольшее значения, при которых равновесие возможно
 * (задача линейного программирования), и для каждой границы — какие связи в предельном состоянии.
 * Без искомой нагрузки — проверяем, возможно ли равновесие, и находим наименьший коэффициент трения.
 */
import { linprog } from '../../../shared/lp';
import { rankOf } from '../../../shared/rank';
import type { Eq } from './equations';
import type { Model, SupportInfo, Unknown } from './model';

/** Опоры, из-за которых нужен расчёт с неравенствами. */
export const frictionSupports = (m: Model): SupportInfo[] => m.supports.filter((s) => s.it.type === 'rough' || (s.it.type === 'roller' && s.it.oneSided));
export const isFrictionModel = (m: Model): boolean => frictionSupports(m).length > 0;

/** Что происходит со связью в предельном состоянии. */
export interface Active {
  s: SupportInfo;
  /** slip — трение достигло f·N (sign — знак силы трения); lift — связь отрывается (N = 0); roll — момент качения достиг k·N. */
  kind: 'slip' | 'lift' | 'roll';
  sign: number;
}

export interface Extreme {
  /** ±Infinity, если граница не существует (нагрузка может расти неограниченно). */
  value: number;
  vals: Record<string, number> | null;
  active: Active[];
}

export interface FrictionResult {
  /** Независимые уравнения равновесия. */
  eqs: Eq[];
  keys: string[];
  /** Искомая нагрузка (если ровно одна). */
  param: Unknown | null;
  /** Искомых нагрузок больше одной — задача не решается этим методом. */
  tooMany: boolean;
  feasible: boolean;
  min: Extreme | null;
  max: Extreme | null;
  /** Без искомой нагрузки: во сколько раз можно уменьшить все коэффициенты трения (λ ≤ 1 — равновесие есть). */
  lambda: number | null;
  /** Какое-нибудь допустимое распределение реакций (для проверки). */
  sample: Record<string, number> | null;
}

const key = (s: SupportInfo, L: string) => s.list.find((u) => u.L === L)?.key;

/** Ограничения G·x ≤ h для опор с трением; scale умножает коэффициенты трения. */
function constraints(m: Model, keys: string[], scale: number) {
  const G: number[][] = [],
    h: number[] = [];
  const row = (c: Record<string, number>) => {
    G.push(keys.map((k) => c[k] ?? 0));
    h.push(0);
  };
  for (const s of frictionSupports(m)) {
    const it = s.it;
    if (it.type === 'roller') {
      row({ [key(s, 'R')!]: -1 });
      continue;
    }
    if (it.type !== 'rough') continue;
    const N = key(s, 'N')!,
      T = key(s, 'Fтр')!,
      M = key(s, 'Mк');
    const f = it.f * scale;
    row({ [N]: -1 });
    row({ [T]: 1, [N]: -f });
    row({ [T]: -1, [N]: -f });
    if (M) {
      const k = (it.k ?? 0) * scale;
      row({ [M]: 1, [N]: -k });
      row({ [M]: -1, [N]: -k });
    }
  }
  return { G, h };
}

function activeOf(m: Model, vals: Record<string, number>): Active[] {
  const out: Active[] = [];
  for (const s of frictionSupports(m)) {
    const it = s.it;
    if (it.type === 'roller') {
      if (Math.abs(vals[key(s, 'R')!]) < 1e-7) out.push({ s, kind: 'lift', sign: 0 });
      continue;
    }
    if (it.type !== 'rough') continue;
    const N = vals[key(s, 'N')!],
      T = vals[key(s, 'Fтр')!];
    const M = key(s, 'Mк') ? vals[key(s, 'Mк')!] : 0;
    const tol = 1e-7 * Math.max(1, Math.abs(N));
    if (Math.abs(N) < 1e-7) {
      out.push({ s, kind: 'lift', sign: 0 });
      continue;
    }
    if (Math.abs(Math.abs(T) - it.f * N) < tol && it.f * N > 1e-9) out.push({ s, kind: 'slip', sign: Math.sign(T) });
    if ((it.k ?? 0) > 0 && Math.abs(Math.abs(M) - (it.k ?? 0) * N) < tol) out.push({ s, kind: 'roll', sign: Math.sign(M) });
  }
  return out;
}

export function solveFriction(m: Model): FrictionResult {
  const keys = m.unknowns.map((u) => u.key);
  // Независимые уравнения: жадно по рангу из кандидатов (моменты, проекции).
  const eqs: Eq[] = [],
    rows: number[][] = [];
  for (const e of m.cands) {
    const r = keys.map((k) => e.coeffs[k] || 0);
    if (rankOf([...rows, r]) > rows.length) {
      rows.push(r);
      eqs.push(e);
    }
  }
  // Совместность «пустых» уравнений (без неизвестных) — иначе равновесие невозможно в принципе.
  const b = eqs.map((e) => -e.cst);
  const loose = m.cands.filter((e) => !eqs.includes(e));
  const base: FrictionResult = { eqs, keys, param: null, tooMany: m.unkLoads.length > 1, feasible: false, min: null, max: null, lambda: null, sample: null };
  if (base.tooMany) return base;
  const { G, h } = constraints(m, keys, 1);
  const zero = keys.map(() => 0);
  const feas = linprog(zero, rows, b, G, h);
  const consistent = (vals: Record<string, number>) =>
    loose.every((e) => Math.abs(e.cst + Object.entries(e.coeffs).reduce((s, [k, c]) => s + c * (vals[k] ?? 0), 0)) < 1e-6 * Math.max(1, Math.abs(e.cst)));
  const toVals = (x: number[]) => Object.fromEntries(keys.map((k, i) => [k, Math.abs(x[i]) < 1e-12 ? 0 : x[i]]));
  if (feas.status !== 'optimal' || !consistent(toVals(feas.x))) {
    // Без искомой нагрузки ищем, при каком запасе по трению равновесие стало бы возможным.
    return { ...base, param: m.unkLoads[0] ?? null, lambda: m.unkLoads.length ? null : minLambda(m, keys, rows, b) };
  }
  const sample = toVals(feas.x);
  if (!m.unkLoads.length) return { ...base, feasible: true, sample, lambda: minLambda(m, keys, rows, b) };
  const param = m.unkLoads[0];
  const pi = keys.indexOf(param.key);
  const ext = (dir: 1 | -1): Extreme => {
    const c = keys.map((_, i) => (i === pi ? dir : 0));
    const r = linprog(c, rows, b, G, h);
    if (r.status !== 'optimal') return { value: dir > 0 ? -Infinity : Infinity, vals: null, active: [] };
    const vals = toVals(r.x);
    return { value: vals[param.key], vals, active: activeOf(m, vals) };
  };
  return { ...base, param, feasible: true, sample, min: ext(1), max: ext(-1) };
}

/** Наименьший множитель λ к коэффициентам трения, при котором равновесие возможно (бисекция), или null — не поможет никакой. */
function minLambda(m: Model, keys: string[], rows: number[][], b: number[]): number | null {
  if (!m.supports.some((s) => s.it.type === 'rough')) return null;
  const ok = (lam: number) => {
    const { G, h } = constraints(m, keys, lam);
    return linprog(keys.map(() => 0), rows, b, G, h).status === 'optimal';
  };
  if (!ok(1e6)) return null;
  if (ok(0)) return 0;
  let lo = 0,
    hi = 1e6;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (ok(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}
