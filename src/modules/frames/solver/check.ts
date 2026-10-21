import { known, type Eq } from './equations';

/** Невязка уравнения при найденных значениях. */
export const residual = (e: Eq, vals: Record<string, number>): number => known(e, vals);

/** Масштаб уравнения — наибольшее по модулю слагаемое; нужен для относительного допуска. */
export function eqScale(e: Eq, vals: Record<string, number>): number {
  let s = Math.abs(e.cst);
  e.terms.forEach((t) => (s = Math.max(s, Math.abs(t.key ? t.c * vals[t.key] : t.c * (t.val as number)))));
  return s;
}

/** Первое уравнение, которое не выполняется (равновесие невозможно), или null. */
export function firstViolated(cands: Eq[], vals: Record<string, number>): Eq | null {
  for (const e of cands) if (Math.abs(residual(e, vals)) > 1e-6 * Math.max(1, eqScale(e, vals))) return e;
  return null;
}

/**
 * Проверочное уравнение: из неиспользованных — с наибольшим числом слагаемых с неизвестными,
 * при равенстве предпочитается уравнение моментов; первое по порядку кандидатов.
 */
export function pickCheck(cands: Eq[], used: Set<string>): Eq | null {
  let best: Eq | null = null,
    bs = -1;
  for (const e of cands) {
    if (used.has(e.id)) continue;
    const s = e.terms.filter((t) => t.key).length * 2 + (e.type === 'm' ? 1 : 0);
    if (s > bs) {
      bs = s;
      best = e;
    }
  }
  return best;
}

/** Сходится ли проверка (как в тексте решения прототипа). */
export function checkPasses(r: number, vals: Record<string, number>): boolean {
  return Math.abs(r) < 1e-6 * Math.max(1, ...Object.values(vals).map(Math.abs));
}
