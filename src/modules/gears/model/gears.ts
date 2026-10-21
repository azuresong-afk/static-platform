/**
 * Вращение тела вокруг неподвижной оси и передачи вращения (Мещерский §13–14).
 *
 * Ведущее звено — колесо 1: задан закон поворота φ₁(t) или закон x(t) нити (рейки), сходящей с колеса радиуса r₁
 * без проскальзывания (тогда φ₁ = x/r₁). Остальные колёса — цепочка, каждое связано с предыдущим:
 *   на одном валу — ω одинаковы;
 *   внешнее зацепление — ω_j = −ω_{j−1}·s_{j−1}/s_j (s — радиус или число зубьев);
 *   внутреннее зацепление и открытый ремень — то же без смены знака; перекрёстный ремень — со сменой знака;
 *   коническая пара — передаточное отношение то же, направление определяется по чертежу (знак не меняем).
 * Точка на колесе k на расстоянии ρ от оси: v = |ω|ρ, a_τ = ερ, a_n = ω²ρ, a = ρ√(ε² + ω⁴), tg μ = |ε|/ω².
 * Обратная задача (14.1): размер одного колеса неизвестен, задана угловая скорость колеса k. ω_k зависит от этого
 * размера как s^p (p = ±1; p = 0 — размер не влияет, например у паразитного колеса), откуда s = (ω/ω_k(1))^{1/p}.
 * Производные закона — символьные (src/shared/expr.ts).
 */
import { diff, evalExpr, parseExpr, type Expr } from '../../../shared/expr';
import type { EllProblem } from './ellipse';
import type { FrProblem } from './friction';
import type { UniProblem } from './uniform';

export type GearMode = 'chain' | 'uniform' | 'ellipse' | 'friction';
export type FindKind = 'none' | 'time' | 'size';

export type Link = 'shaft' | 'ext' | 'int' | 'belt' | 'cross' | 'bevel';
export const LINKS: [Link, string][] = [
  ['shaft', 'на одном валу с предыдущим'],
  ['ext', 'внешнее зацепление'],
  ['int', 'внутреннее зацепление'],
  ['belt', 'открытый ремень'],
  ['cross', 'перекрёстный ремень'],
  ['bevel', 'коническая пара'],
];

export interface Wheel {
  /** Радиус (0 — не задан). */
  r: number;
  /** Число зубьев (0 — не задано). */
  z: number;
  /** Связь с предыдущим колесом (у первого не используется). */
  link: Link;
}

export interface GearProblem {
  /** Вид задачи: цепочка колёс, равнопеременное вращение, эллиптические колёса, фрикционная передача. */
  mode: GearMode;
  /** Что задано: закон поворота колеса 1 или закон движения нити (рейки) на колесе 1. */
  drive: 'phi' | 'x';
  law: string;
  wheels: Wheel[];
  /** Номер колеса (с нуля), на котором ищем точку и угловую скорость. */
  k: number;
  /** Расстояние точки от оси (0 — радиус колеса). */
  rho: number;
  t: number;
  /** Что ищем по заданной |ω_k| = target: ничего, момент времени или неизвестный размер колеса u. */
  find: FindKind;
  target: number;
  unit: 'rad' | 'rpm';
  u: number;
  uKey: 'r' | 'z';
  /** Отрезок времени для графика и поиска [0; tMax]. */
  tMax: number;
  uni: UniProblem;
  ell: EllProblem;
  fr: FrProblem;
}

export interface WheelState {
  /** ω_j / ω_1 со знаком. */
  i: number;
  omega: number;
  eps: number;
  /** Обороты в минуту (по модулю). */
  n: number;
  /** Угол поворота за [0; t], рад, и число оборотов. */
  dphi: number;
  turns: number;
}

export interface GearResult {
  ok: boolean;
  errors: string[];
  law: { e: Expr; d1: Expr; d2: Expr };
  /** Для каждой связи — чем считали отношение: радиусами или числами зубьев. */
  by: ('r' | 'z' | null)[];
  /** Момент, в который считаем (заданный или найденный). */
  t: number;
  /** Найденный момент (при поиске) или null, если цель не достигается на отрезке. */
  found: number | null;
  phi1: number;
  wheels: WheelState[];
  /** Передаточное отношение i₁ₖ = ω₁/ω_k. */
  i1k: number;
  point: { rho: number; v: number; at: number; an: number; a: number; mu: number } | null;
  hasBevel: boolean;
  /** Найденный размер колеса u (при find = 'size') и показатель p в ω_k ∝ s^p. */
  size: { u: number; key: 'r' | 'z'; value: number; p: number } | null;
}

const ZERO: Expr = { k: 'num', v: 0 };
const clean = (v: number) => (Math.abs(v) < 1e-12 ? 0 : v);

/** Отношения ω_j/ω_1 со знаком и способ их вычисления. */
export function ratios(ws: Wheel[]): { i: number[]; by: ('r' | 'z' | null)[]; errors: string[] } {
  const i = [1],
    by: ('r' | 'z' | null)[] = [null],
    errors: string[] = [];
  for (let j = 1; j < ws.length; j++) {
    const a = ws[j - 1],
      b = ws[j],
      L = b.link;
    if (L === 'shaft') {
      i.push(i[j - 1]);
      by.push(null);
      continue;
    }
    let s: [number, number] | null = null;
    if (a.z > 0 && b.z > 0) (s = [a.z, b.z]), by.push('z');
    else if (a.r > 0 && b.r > 0) (s = [a.r, b.r]), by.push('r');
    else by.push(null);
    if (!s) {
      errors.push(`Колёса ${j} и ${j + 1}: задайте у обоих радиусы или числа зубьев.`);
      i.push(i[j - 1]);
      continue;
    }
    if ((L === 'belt' || L === 'cross') && by[j] === 'z') errors.push(`Ремень между колёсами ${j} и ${j + 1}: нужны радиусы шкивов.`);
    const sign = L === 'ext' || L === 'cross' ? -1 : 1;
    i.push((sign * i[j - 1] * s[0]) / s[1]);
  }
  return { i, by, errors };
}

export function solveGears(pr: GearProblem): GearResult {
  const errors: string[] = [];
  const p = parseExpr(pr.law);
  if (!p.ok) errors.push(`${pr.drive === 'phi' ? 'φ₁' : 'x'}(t): ${p.error}.`);
  const e = p.ok ? p.e : ZERO;
  const d1 = diff(e);
  const law = { e, d1, d2: diff(d1) };
  const ws = pr.wheels;
  if (!ws.length) errors.push('Нужно хотя бы одно колесо.');
  if (ws.some((w) => !(w.r >= 0) || !(w.z >= 0))) errors.push('Радиусы и числа зубьев — неотрицательные числа.');
  // При поиске размера неизвестное значение временно равно 1 — чтобы проверить остальные данные.
  const uu = Math.min(Math.max(0, Math.round(pr.u)), Math.max(0, ws.length - 1));
  const rt = ratios(pr.find === 'size' && ws.length ? ws.map((w, j) => (j === uu ? { ...w, [pr.uKey]: 1 } : w)) : ws);
  errors.push(...rt.errors);
  if (pr.drive === 'x' && !(ws[0]?.r > 0) && !(pr.find === 'size' && uu === 0 && pr.uKey === 'r')) errors.push('Нить (рейка) сходит с колеса 1 — задайте его радиус.');
  const k = Math.min(Math.max(0, Math.round(pr.k)), Math.max(0, ws.length - 1));
  if (pr.find !== 'none' && !(pr.target > 0)) errors.push('Заданная угловая скорость — положительное число.');
  if (pr.find === 'time' && !(pr.tMax > 0)) errors.push('Для поиска момента задайте отрезок времени tₘₐₓ > 0.');
  const empty: GearResult = { ok: false, errors, law, by: rt.by, t: pr.t, found: null, phi1: 0, wheels: [], i1k: 0, point: null, hasBevel: false, size: null };
  if (pr.find === 'size') {
    const u = uu;
    const at = (v: number) => {
      const w2 = ws.map((w) => ({ ...w }));
      w2[u][pr.uKey] = v;
      const rr = ratios(w2);
      if (rr.errors.length) return NaN;
      const r1 = pr.drive === 'x' ? w2[0].r : 1;
      return Math.abs((rr.i[k] * evalExpr(d1, pr.t)) / r1);
    };
    if (!errors.length) {
      const f1 = at(1),
        f2 = at(2);
      const p = Math.round(Math.log2(f2 / f1));
      if (!Number.isFinite(f1) || !Number.isFinite(f2) || f1 === 0) errors.push('Угловая скорость колеса при этих данных не определена или равна нулю — размер не найти.');
      else if (p === 0) errors.push(`${pr.uKey === 'r' ? 'Радиус' : 'Число зубьев'} колеса ${u + 1} не влияет на ω колеса ${k + 1} — найти его нельзя.`);
      else {
        const target = pr.unit === 'rpm' ? (pr.target * Math.PI) / 30 : pr.target;
        const value = Math.pow(target / f1, 1 / p);
        const ws2 = ws.map((w) => ({ ...w }));
        ws2[u][pr.uKey] = value;
        const r = solveGears({ ...pr, wheels: ws2, find: 'none' });
        return r.ok ? { ...r, size: { u, key: pr.uKey, value, p } } : r;
      }
    }
    return { ...empty, errors };
  }
  if (errors.length) return empty;
  const r1 = pr.drive === 'x' ? ws[0].r : 1;
  const w1 = (t: number) => evalExpr(d1, t) / r1;
  const target = pr.unit === 'rpm' ? (pr.target * Math.PI) / 30 : pr.target;
  let t = pr.t,
    found: number | null = null;
  if (pr.find === 'time') {
    const g = (s: number) => Math.abs(rt.i[k] * w1(s)) - target;
    const N = 4000;
    let a = 0,
      ga = g(0);
    for (let n = 1; n <= N && found == null; n++) {
      const b = (pr.tMax * n) / N,
        gb = g(b);
      if (!Number.isFinite(gb)) {
        (a = b), (ga = gb);
        continue;
      }
      if (gb === 0) found = b;
      else if (Number.isFinite(ga) && ga < 0 && gb > 0) {
        let lo = a,
          hi = b;
        for (let it = 0; it < 200; it++) {
          const m = (lo + hi) / 2;
          if (g(m) < 0) lo = m;
          else hi = m;
        }
        found = (lo + hi) / 2;
      }
      (a = b), (ga = gb);
    }
    if (found != null) t = found;
  }
  const phi = (s: number) => evalExpr(e, s) / r1;
  const om1 = w1(t),
    ep1 = evalExpr(law.d2, t) / r1,
    dphi1 = phi(t) - phi(0);
  const wheels = rt.i.map((i) => {
    const omega = i * om1;
    return { i, omega: clean(omega), eps: clean(i * ep1), n: clean((Math.abs(omega) * 30) / Math.PI), dphi: clean(i * dphi1), turns: clean((i * dphi1) / (2 * Math.PI)) };
  });
  const W = wheels[k];
  const rho = pr.rho > 0 ? pr.rho : ws[k].r;
  let point: GearResult['point'] = null;
  if (rho > 0) {
    const w = W.omega,
      ep = W.eps;
    const an = w * w * rho,
      at = ep * rho * (Math.sign(w) || 1);
    point = { rho, v: clean(Math.abs(w) * rho), at: clean(at), an: clean(an), a: clean(rho * Math.hypot(ep, w * w)), mu: (Math.atan2(Math.abs(ep), w * w) * 180) / Math.PI };
  }
  const phi1 = phi(t);
  if (![om1, ep1, dphi1, phi1, ...(point ? [point.a] : [])].every(Number.isFinite)) return { ...empty, errors: [`В момент t = ${t} закон движения не определён.`] };
  return { ok: true, errors: [], law, by: rt.by, t, found, phi1: clean(phi1), wheels, i1k: W.i !== 0 ? 1 / W.i : Infinity, point, hasBevel: ws.slice(1).some((w) => w.link === 'bevel'), size: null };
}

/** ω_k(t) на отрезке [0; T] для графика. */
export function omegaCurve(pr: GearProblem, r: GearResult, T: number, n = 400): [number, number][] {
  if (!r.ok) return [];
  const k = Math.min(Math.max(0, Math.round(pr.k)), pr.wheels.length - 1);
  const r1 = pr.drive === 'x' ? pr.wheels[0].r : 1;
  const out: [number, number][] = [];
  for (let j = 0; j <= n; j++) {
    const t = (T * j) / n,
      w = (r.wheels[k].i * evalExpr(r.law.d1, t)) / r1;
    if (Number.isFinite(w)) out.push([t, w]);
  }
  return out;
}
