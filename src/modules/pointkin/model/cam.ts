/**
 * Кулачки (Мещерский §14.15–14.19).
 *
 * Вращающийся кулак: ось толкателя проходит через ось вращения O, конец толкателя (остриё или центр ролика)
 * касается контура r(φ). При равномерном вращении φ = ωt закон движения толкателя x(t) = r(ωt): профиль и закон —
 * одна и та же кусочная функция, заданная в разных переменных. Задают либо закон x(t) за один оборот (период T) —
 * тогда ищут контур r(φ), φ = 2πt/T, либо контур r(φ) и число оборотов в минуту — тогда ищут закон x(t).
 *
 * Поступательно движущийся круговой кулак радиуса r: центр круга сдвинут от начального положения на u(t) =
 * u₀ + vt + wt²/2, толкатель вертикален и касается круга сверху; опускание h = r − √(r² − u²) (начало отсчёта —
 * наивысшее положение, когда центр круга на оси толкателя).
 */
import { diff, evalExpr, parseExpr, printExpr, simplify, type Expr } from '../../../shared/expr';
import { fmtPi } from '../../../shared/integ';
import { pnum, pstr } from './ext';
import type { KinProblem } from './kin';

const clean = (v: number) => (Math.abs(v) < 1e-12 ? 0 : v);
/** В формулах контура угол пишут φ (или phi) — для разбора он заменяется на t. */
export const camPrep = (s: string) => s.replace(/φ|phi/gi, 't');

export interface CamSeg {
  /** Границы участка (время в секундах или угол в радианах — по способу ввода). */
  a: number;
  b: number;
  src: string;
  e: Expr;
  d1: Expr;
}
export interface CamRot {
  ok: boolean;
  errors: string[];
  input: 'law' | 'profile';
  /** Период одного оборота T, с; угловая скорость ω, рад/с; число оборотов в минуту. */
  T: number;
  omega: number;
  rpm: number;
  segs: CamSeg[];
  /** Закон x(t) и контур r(φ) по участкам — в записи для ответа. */
  lawText: string[];
  profText: string[];
  /** Наименьшее и наибольшее расстояние конца толкателя от оси, ход. */
  rMin: number;
  rMax: number;
  stroke: number;
  /** Скачки контура (мгновенный возврат) и поверхности: «в φ = …». */
  jumps: { phi: number; from: number; to: number }[];
  /** Состояние в момент t: положение, скорость и ускорение толкателя. */
  at: { t: number; phi: number; x: number; v: number; a: number };
  curve: { t: number; x: number }[];
  prof: { phi: number; r: number }[];
  /** Контур r(φ) и закон x(t) — функции (для проверок). */
  rAt: (phi: number) => number;
  xAt: (t: number) => number;
}

const SEGS = [1, 2, 3, 4];
function readSegs(pr: KinProblem, errors: string[], period: number | null): CamSeg[] {
  const segs: CamSeg[] = [];
  for (const i of SEGS) {
    const src = (pr.p?.[`f${i}`] ?? '').trim();
    if (!src) continue;
    const a = pnum(pr, `a${i}`, `участок ${i}: от`, errors);
    const b = pnum(pr, `b${i}`, `участок ${i}: до`, errors);
    const p = parseExpr(camPrep(src));
    if (!p.ok) {
      errors.push(`участок ${i}: ${p.error}.`);
      continue;
    }
    segs.push({ a, b, src, e: p.e, d1: diff(p.e) });
  }
  if (!segs.length) errors.push('Задайте хотя бы один участок.');
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    if (!(s.b > s.a)) errors.push(`участок ${i + 1}: «до» должно быть больше «от».`);
    if (i === 0 && Math.abs(s.a) > 1e-9) errors.push('Первый участок начинается с 0.');
    if (i > 0 && Math.abs(s.a - segs[i - 1].b) > 1e-9) errors.push(`Участки должны идти подряд: участок ${i + 1} начинается не там, где кончается предыдущий.`);
  }
  if (period != null && segs.length && Math.abs(segs[segs.length - 1].b - period) > 1e-9)
    errors.push(`Участки должны покрывать весь оборот: последний кончается в ${fmtPi(segs[segs.length - 1].b)}, а оборот — ${fmtPi(period)}.`);
  return segs;
}

function seg(segs: CamSeg[], u: number): CamSeg {
  const P = segs[segs.length - 1].b;
  const w = ((u % P) + P) % P;
  return segs.find((s) => w >= s.a - 1e-12 && w < s.b - 1e-12) ?? segs[segs.length - 1];
}
function segVal(segs: CamSeg[], u: number, d = false): number {
  const P = segs[segs.length - 1].b;
  const w = ((u % P) + P) % P;
  const s = seg(segs, u);
  return evalExpr(d ? s.d1 : s.e, w);
}

/** Запись g(u) = e(scale·u) на участке [a; b] (u — новая переменная): линейная — «c₀ + c₁φ», иначе подстановкой. */
function conv(s: CamSeg, scale: number, name: string, a: number, b: number): string {
  const g = (u: number) => evalExpr(s.e, scale * u);
  const c1 = (g(b) - g(a)) / (b - a),
    c0 = g(a) - c1 * a;
  const lin = [0.25, 0.5, 0.75].every(
    (q) => Math.abs(g(a + q * (b - a)) - (c0 + c1 * (a + q * (b - a)))) <= 1e-9 * Math.max(1, Math.abs(c0), Math.abs(c1 * b)),
  );
  if (lin) {
    const p0 = Math.abs(c0) < 1e-12 ? '' : fmtPi(c0);
    const cf = (x: number) => {
      const t = fmtPi(x);
      return /\//.test(t) && !t.startsWith('(') && !t.startsWith('−(') ? (t.startsWith('−') ? `−(${t.slice(1)})` : `(${t})`) : t;
    };
    const p1 = Math.abs(c1) < 1e-12 ? '' : `${Math.abs(c1 - 1) < 1e-12 ? '' : Math.abs(c1 + 1) < 1e-12 ? '−' : cf(c1)}${name}`;
    if (!p1) return p0 || '0';
    return p0 ? (p1.startsWith('−') ? `${p0} − ${p1.slice(1)}` : `${p0} + ${p1}`.replace('+ −', '− ')) : p1;
  }
  const sub = (e: Expr): Expr =>
    e.k === 't'
      ? { k: 'mul', a: { k: 'num', v: scale }, b: { k: 'var', n: name } }
      : e.k === 'num' || e.k === 'var'
        ? e
        : e.k === 'neg' || e.k === 'fn'
          ? { ...e, a: sub(e.a) }
          : { ...e, a: sub(e.a), b: sub(e.b) };
  return printExpr(simplify(sub(s.e)), 0, fmtPi);
}

export function solveCamRot(pr: KinProblem): CamRot {
  const errors: string[] = [];
  const input: 'law' | 'profile' = pstr(pr, 'in', 'law') === 'profile' ? 'profile' : 'law';
  let T = NaN,
    rpm = NaN;
  if (input === 'law') T = pnum(pr, 'T', 'время оборота T, с', errors);
  else {
    rpm = pnum(pr, 'rpm', 'число оборотов в минуту', errors);
    if (rpm > 0) T = 60 / rpm;
  }
  if (errors.length || !(T > 0)) {
    if (!errors.length) errors.push('Время оборота и число оборотов — положительные.');
    return {
      ok: false,
      errors,
      input,
      T: 0,
      omega: 0,
      rpm: 0,
      segs: [],
      lawText: [],
      profText: [],
      rMin: 0,
      rMax: 0,
      stroke: 0,
      jumps: [],
      at: { t: pr.t, phi: 0, x: 0, v: 0, a: 0 },
      curve: [],
      prof: [],
      rAt: () => NaN,
      xAt: () => NaN,
    };
  }
  const omega = (2 * Math.PI) / T;
  const segs = readSegs(pr, errors, input === 'law' ? T : 2 * Math.PI);
  const base: CamRot = {
    ok: false,
    errors,
    input,
    T,
    omega,
    rpm: 60 / T,
    segs,
    lawText: [],
    profText: [],
    rMin: 0,
    rMax: 0,
    stroke: 0,
    jumps: [],
    at: { t: pr.t, phi: 0, x: 0, v: 0, a: 0 },
    curve: [],
    prof: [],
    rAt: () => NaN,
    xAt: () => NaN,
  };
  if (errors.length) return base;
  // Закон по времени и контур по углу: φ = ωt.
  const lawOf = (t: number) => (input === 'law' ? segVal(segs, t) : segVal(segs, omega * t));
  const speedOf = (t: number) => (input === 'law' ? segVal(segs, t, true) : omega * segVal(segs, omega * t, true));
  const profOf = (phi: number) => (input === 'law' ? segVal(segs, phi / omega) : segVal(segs, phi));
  const lawText = segs.map((s) => {
    const [ta, tb] = input === 'law' ? [s.a, s.b] : [s.a / omega, s.b / omega];
    const body = input === 'law' ? printExpr(s.e, 0, fmtPi) : conv(s, omega, 't', ta, tb);
    return `x = ${body},  ${fmtPi(ta)} ≤ t ≤ ${fmtPi(tb)}`;
  });
  const profText = segs.map((s) => {
    const [pa, pb] = input === 'law' ? [s.a * omega, s.b * omega] : [s.a, s.b];
    const body = input === 'law' ? conv(s, 1 / omega, 'φ', pa, pb) : printExpr(s.e, 0, fmtPi).replace(/\bt\b/g, 'φ');
    return `r = ${body},  ${fmtPi(pa)} ≤ φ ≤ ${fmtPi(pb)}`;
  });
  const N = 720;
  const prof = Array.from({ length: N + 1 }, (_, i) => {
    const phi = (2 * Math.PI * i) / N;
    return { phi, r: i === N ? segVal(segs, 2 * Math.PI - 1e-9 * 2 * Math.PI) : profOf(phi) };
  });
  const curve = Array.from({ length: N + 1 }, (_, i) => ({ t: (T * i) / N, x: i === N ? lawOf(T * (1 - 1e-9)) : lawOf((T * i) / N) }));
  const rs = prof.map((p) => p.r);
  if (!rs.every(Number.isFinite)) return { ...base, errors: ['Формулы контура неопределены на части оборота.'] };
  // Скачки: значения слева и справа от границ участков и на стыке оборота.
  const jumps: CamRot['jumps'] = [];
  const bounds = [...segs.map((s) => s.b)];
  const P = segs[segs.length - 1].b;
  segs.forEach((s, i) => {
    const nxt = segs[(i + 1) % segs.length];
    const left = evalExpr(s.e, s.b),
      right = evalExpr(nxt.e, nxt.a);
    if (Math.abs(left - right) > 1e-9 * Math.max(1, Math.abs(left)))
      jumps.push({ phi: input === 'law' ? (bounds[i] / P) * 2 * Math.PI : bounds[i], from: left, to: right });
  });
  const tq = pr.t;
  const x = lawOf(tq),
    v = speedOf(tq);
  // Ускорение — вторая производная по t на участке.
  const s = seg(segs, input === 'law' ? tq : omega * tq);
  const w = (((input === 'law' ? tq : omega * tq) % P) + P) % P;
  const d2 = evalExpr(diff(s.d1), w) * (input === 'law' ? 1 : omega * omega);
  const out: CamRot = {
    ...base,
    ok: true,
    errors: [],
    lawText,
    profText,
    rMin: Math.min(...rs),
    rMax: Math.max(...rs),
    stroke: Math.max(...rs) - Math.min(...rs),
    jumps,
    at: { t: tq, phi: omega * tq, x: clean(x), v: clean(v), a: clean(d2) },
    curve,
    prof,
    rAt: profOf,
    xAt: lawOf,
  };
  return out;
}

/* ---------- поступательно движущийся круговой кулак ---------- */

export interface CamTrans {
  ok: boolean;
  errors: string[];
  r: number;
  /** u(t) = u₀ + vt + wt²/2 — сдвиг центра круга; h — опускание толкателя. */
  v: number;
  w: number;
  u0: number;
  t: number;
  u: number;
  h: number;
  /** Режим: искать ускорение кулака по опусканию h* за время t. */
  find: 'h' | 'w';
  hGiven: number | null;
  /** Скорость и ускорение толкателя в момент t (вниз положительны). */
  hv: number;
  ha: number;
  curve: { t: number; h: number }[];
}

export function solveCamTrans(pr: KinProblem): CamTrans {
  const errors: string[] = [];
  const r = pnum(pr, 'r', 'радиус кулака r', errors);
  const u0 = pnum(pr, 'u0', 'начальный сдвиг u₀', errors, 0);
  const v = pnum(pr, 'vc', 'скорость кулака v', errors, 0);
  const find: 'h' | 'w' = pstr(pr, 'find', 'h') === 'w' ? 'w' : 'h';
  let w = pnum(pr, 'wc', 'ускорение кулака w', errors, 0);
  const t = pr.t;
  const hg = find === 'w' ? pnum(pr, 'hg', 'опускание h', errors) : null;
  const blank: CamTrans = { ok: false, errors, r, v, w: 0, u0, t, u: 0, h: 0, find, hGiven: hg, hv: 0, ha: 0, curve: [] };
  if (errors.length) return blank;
  if (!(r > 0)) return { ...blank, errors: ['Радиус кулака — положительное число.'] };
  if (!(t > 0)) return { ...blank, errors: ['Момент t — положительное число.'] };
  if (find === 'w') {
    if (!(hg! >= 0 && hg! <= r)) return { ...blank, errors: ['Опускание h — от 0 до r.'] };
    // r² − (r − h)² = u², u = u₀ + vt + wt²/2.
    const u = Math.sqrt(r * r - (r - hg!) ** 2);
    w = (2 * (u - u0 - v * t)) / (t * t);
  }
  const uOf = (s: number) => u0 + v * s + (w * s * s) / 2;
  const hOf = (s: number) => r - Math.sqrt(Math.max(0, r * r - uOf(s) ** 2));
  const u = uOf(t);
  if (Math.abs(u) > r + 1e-12) return { ...blank, w, u, errors: [`К моменту t сдвиг u = ${fmtPi(u)} больше радиуса: толкатель сошёл с круга (|u| ≤ r).`] };
  const du = v + w * t,
    ddu = w;
  const s = Math.sqrt(r * r - u * u);
  const hv = s > 1e-12 ? (u * du) / s : Infinity;
  const ha = s > 1e-12 ? (du * du + u * ddu) / s + (u * u * du * du) / s ** 3 : Infinity;
  const tEnd = t;
  const curve = Array.from({ length: 201 }, (_, i) => ({ t: (tEnd * i) / 200, h: hOf((tEnd * i) / 200) }));
  return { ok: true, errors: [], r, v, w, u0, t, u, h: clean(hOf(t)), find, hGiven: hg, hv, ha, curve };
}
