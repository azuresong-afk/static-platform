/**
 * Равнопеременное движение точки (Мещерский 12.1–12.10; Яблонский К.2): из пяти величин v₀, v, a, t, s известны
 * любые три — те же формулы, что у равнопеременного вращения («Вращение и передачи»):
 *   v = v₀ + at,   s = v₀t + at²/2,   v² − v₀² = 2as,   s = (v₀ + v)t/2.
 * a — касательное ускорение. Если задан радиус закругления ρ, нормальное ускорение a_n = v²/ρ и полное
 * a = √(a_τ² + a_n²) — в начале, в конце и в заданный момент t′.
 */
import { solveUniform, type UniKey } from '../../gears/model/uniform';

export type LinKey = 'v0' | 'v' | 'a' | 't' | 's';
export const LIN_KEYS: LinKey[] = ['v0', 'v', 'a', 't', 's'];
export interface LinUni {
  v0: number;
  v: number;
  a: number;
  t: number;
  s: number;
  known: LinKey[];
  /** Скорости в км/ч (иначе м/с). */
  kmh: boolean;
  /** Радиус закругления (0 — прямая). */
  rho: number;
  /** Момент t′ для промежуточного состояния (0 — не нужен). */
  tq: number;
}
/** Равнопеременное движение по умолчанию — Мещерский 12.1. */
export const DEF_UNI: LinUni = { v0: 72, v: 0, a: -0.4, t: 0, s: 0, known: ['v0', 'v', 'a'], kmh: true, rho: 0, tq: 0 };
export interface LinState {
  t: number;
  v: number;
  s: number;
  an: number;
  a: number;
}
export interface LinResult {
  ok: boolean;
  errors: string[];
  /** Величины в м/с, м/с², с, м. */
  v0: number;
  v: number;
  a: number;
  t: number;
  s: number;
  how: string;
  start: LinState | null;
  end: LinState | null;
  mid: LinState | null;
}

const MAP: Record<LinKey, UniKey> = { v0: 'w0', v: 'w', a: 'eps', t: 't', s: 'phi' };
const KMH = 1 / 3.6;
/** Обозначения и слова вращения → поступательного движения. */
export function linText(s: string): string {
  return s
    .replace(/ω₀/g, 'v₀')
    .replace(/ω/g, 'v')
    .replace(/ε/g, 'a')
    .replace(/φ/g, 's')
    .replace('тело не повернётся на заданный угол', 'точка не пройдёт заданный путь')
    .replace('угловая скорость не меняется', 'скорость не меняется')
    .replace('угловая скорость ω не достигается', 'скорость v не достигается')
    .replace('угловая скорость', 'скорость');
}

export function solveLin(u: LinUni): LinResult {
  const k = u.kmh ? KMH : 1;
  const r = solveUniform({ w0: u.v0 * k, w: u.v * k, eps: u.a, t: u.t, phi: u.s, known: u.known.map((x) => MAP[x]), wUnit: 'rad', phiUnit: 'rad' });
  const errors = r.errors.map(linText);
  if (u.rho < 0) errors.push('Радиус закругления — неотрицательное число (0 — прямая).');
  if (u.tq < 0) errors.push('Момент t′ — неотрицательное число.');
  const empty: LinResult = { ok: false, errors, v0: 0, v: 0, a: 0, t: 0, s: 0, how: '', start: null, end: null, mid: null };
  if (!r.ok || errors.length) return empty;
  const st = (t: number): LinState => {
    const v = r.w0 + r.eps * t;
    const an = u.rho > 0 ? (v * v) / u.rho : 0;
    return { t, v, s: r.w0 * t + (r.eps * t * t) / 2, an, a: Math.hypot(r.eps, an) };
  };
  return {
    ok: true,
    errors: [],
    v0: r.w0,
    v: r.w,
    a: r.eps,
    t: r.t,
    s: r.phi,
    how: linText(r.how),
    start: st(0),
    end: st(r.t),
    mid: u.tq > 0 ? st(u.tq) : null,
  };
}
