/**
 * Ориентация тела тремя последовательными поворотами вокруг подвижных осей (Мещерский §20; Яблонский К.5).
 *
 * Последовательность — три буквы из x, y, z: первый поворот (угол q₁) — вокруг оси неподвижного трёхгранника Oξηζ,
 * второй и третий — вокруг осей, повёрнутых предыдущими поворотами. Классические углы Эйлера у Мещерского (20.3) —
 * z, y, z: прецессия ψ вокруг Oζ, нутация θ вокруг линии узлов, собственное вращение φ вокруг Oz; самолётные (20.5) —
 * y, z, x (рыскание, тангаж, крен); карданов подвес (20.1, 20.2) — два поворота (третий угол равен нулю).
 *
 * Матрица R = R₁(q₁)·R₂(q₂)·R₃(q₃): столбцы — орты осей тела в неподвижных осях; таблица направляющих косинусов
 * (строки — оси тела, столбцы — ξ, η, ζ) — Rᵀ. Угловая скорость ω = q̇₁a₁ + q̇₂a₂′ + q̇₃a₃″ (кинематические формулы
 * Эйлера): в неподвижных осях ω = q̇₁a₁ + q̇₂R₁a₂ + q̇₃R₁R₂a₃, в осях тела ω = q̇₃a₃ + q̇₂R₃ᵀa₂ + q̇₁R₃ᵀR₂ᵀa₁.
 * Формулы строятся в буквах символьным движком «Уравнений Лагранжа»; по законам qᵢ(t) — ω(t) и ε = dω/dt
 * (в неподвижных осях), скорость и ускорение точки тела, аксоиды регулярной прецессии.
 */
import { add, d, evalSym, fn, mul, neg, normName, num, parseSym, subst, trigSimplify, variable, type Sym } from '../../../shared/sym';
import { cross, norm, type V3 } from '../../converging/model/forces';
import { add3, angle } from './compose';

export type Axis = 'x' | 'y' | 'z';
export interface EulerProblem {
  /** Последовательность осей поворотов, например «zyz». */
  seq: string;
  /** Обозначения углов. */
  names: [string, string, string];
  /** Законы углов от времени (рад). */
  laws: [string, string, string];
  t1: number;
  /** Точка тела в осях тела. */
  point: V3;
}
type SMat = Sym[][];
export interface EulerSym {
  R: SMat;
  /** ω в неподвижных осях и в осях тела (формулы от углов и их производных). */
  wFixed: Sym[];
  wBody: Sym[];
}
export interface EulerResult {
  ok: true;
  sym: EulerSym;
  names: string[];
  q: number[];
  dq: number[];
  R: number[][];
  w: V3;
  wBody: V3;
  eps: V3;
  epsBody: V3;
  /** ω(t) в неподвижных осях — формулы от t (если коротки). */
  wOfT: Sym[] | null;
  point: { rho: V3; r: V3; v: V3; aE: V3; aW: V3; a: V3 } | null;
  /** Регулярная прецессия (q̇₁, q₂, q̇₃ постоянны, a₁ = a₃): полууглы аксоидов, рад. */
  precession: { fixed: number; moving: number } | null;
}
export type EulerOut = EulerResult | { ok: false; field: string; error: string };

const AX: Record<Axis, number> = { x: 0, y: 1, z: 2 };
const one = () => num(1);
/** Поворот вокруг оси на угол q (символьно). */
function rot(ax: Axis, q: string): SMat {
  const c = fn('cos', variable(q)),
    s = fn('sin', variable(q));
  const Z: Sym = [];
  if (ax === 'x')
    return [
      [one(), Z, Z],
      [Z, c, neg(s)],
      [Z, s, c],
    ];
  if (ax === 'y')
    return [
      [c, Z, s],
      [Z, one(), Z],
      [neg(s), Z, c],
    ];
  return [
    [c, neg(s), Z],
    [s, c, Z],
    [Z, Z, one()],
  ];
}
const mm = (A: SMat, B: SMat): SMat => A.map((row) => B[0].map((_, j) => trigSimplify(add(...row.map((a, k) => mul(a, B[k][j]))))));
const mv = (A: SMat, v: Sym[]): Sym[] => A.map((row) => trigSimplify(add(...row.map((a, k) => mul(a, v[k])))));
const tr = (A: SMat): SMat => A[0].map((_, j) => A.map((r) => r[j]));
const unitS = (ax: Axis): Sym[] => [0, 1, 2].map((i) => (i === AX[ax] ? num(1) : []));
const scaleV = (v: Sym[], s: Sym): Sym[] => v.map((x) => mul(x, s));

export function eulerSymbolic(seq: Axis[], names: string[]): EulerSym {
  const [R1, R2, R3] = seq.map((a, i) => rot(a, names[i]));
  const R12 = mm(R1, R2);
  const R = mm(R12, R3);
  const dq = names.map((n) => variable(n, 1));
  const [a1, a2, a3] = seq.map(unitS);
  const wFixed = [0, 1, 2].map((i) => trigSimplify(add(scaleV(a1, dq[0])[i], mv(R1, scaleV(a2, dq[1]))[i], mv(R12, scaleV(a3, dq[2]))[i])));
  const R3t = tr(R3),
    R23t = mm(R3t, tr(R2));
  const wBody = [0, 1, 2].map((i) => trigSimplify(add(scaleV(a3, dq[2])[i], mv(R3t, scaleV(a2, dq[1]))[i], mv(R23t, scaleV(a1, dq[0]))[i])));
  return { R, wFixed, wBody };
}

export function solveEuler(pr: EulerProblem): EulerOut {
  const seq = pr.seq.split('') as Axis[];
  if (seq.length !== 3 || !seq.every((a) => a in AX)) return { ok: false, field: 'seq', error: 'Последовательность — три буквы из x, y, z.' };
  if (seq[0] === seq[1] || seq[1] === seq[2])
    return { ok: false, field: 'seq', error: 'Два поворота подряд вокруг одной оси — это один поворот: соседние буквы должны различаться.' };
  const names = pr.names.map((n) => normName(n.trim()));
  if (names.some((n) => !/^[\p{L}][\p{L}\p{N}_]*$/u.test(n)) || new Set(names).size !== 3 || names.includes('t'))
    return { ok: false, field: 'names', error: 'Углы обозначаются разными буквами (не t).' };
  const laws: Sym[] = [];
  for (const [i, src] of pr.laws.entries()) {
    const r = parseSym(src.trim() || '0', { coords: [], params: [] });
    if (!r.ok) return { ok: false, field: 'law' + i, error: `${names[i]}(t): ${r.error}` };
    laws.push(r.s);
  }
  const sym = eulerSymbolic(seq, names);
  const time = { k: 'time' as const, isCoord: () => false };
  const dl = laws.map((l) => d(l, time));
  const sub = (s: Sym) =>
    subst(s, (a) => {
      const i = names.indexOf(a.name);
      if (i < 0) return null;
      return a.ord === 0 ? laws[i] : a.ord === 1 ? dl[i] : null;
    });
  const wt = sym.wFixed.map((s) => trigSimplify(sub(s)));
  const et = wt.map((s) => d(s, time));
  const ev = (s: Sym) => evalSym(s, () => NaN, pr.t1);
  const q = laws.map(ev),
    dq = dl.map(ev);
  const w = wt.map(ev) as V3,
    eps = et.map(ev) as V3;
  const val = (name: string, ord: number) => {
    const i = names.indexOf(name);
    return i < 0 ? NaN : ord === 0 ? q[i] : dq[i];
  };
  const R = sym.R.map((row) => row.map((s) => evalSym(s, val)));
  if (![...q, ...dq, ...w, ...eps, ...R.flat()].every(Number.isFinite))
    return { ok: false, field: 'law0', error: 'Законы углов или их производные в момент t₁ не вычисляются.' };
  const Rt = (v: V3): V3 => [0, 1, 2].map((j) => R[0][j] * v[0] + R[1][j] * v[1] + R[2][j] * v[2]) as V3;
  let point: EulerResult['point'] = null;
  if (norm(pr.point) > 0) {
    const r = [0, 1, 2].map((i) => R[i][0] * pr.point[0] + R[i][1] * pr.point[1] + R[i][2] * pr.point[2]) as V3;
    const v = cross(w, r),
      aE = cross(eps, r),
      aW = cross(w, v);
    point = { rho: pr.point, r, v, aE, aW, a: add3(aE, aW) };
  }
  // Регулярная прецессия: q̇₁, q̇₃ и q₂ постоянны, первая и третья оси совпадают (собственно углы Эйлера).
  const isConst = (s: Sym) => d(s, time).every((t) => Math.abs(t.c) < 1e-14);
  let precession: EulerResult['precession'] = null;
  if (seq[0] === seq[2] && isConst(dl[0]) && isConst(laws[1]) && isConst(dl[2])) {
    const a1: V3 = [0, 0, 0];
    a1[AX[seq[0]]] = 1;
    const a3 = [R[0][AX[seq[2]]], R[1][AX[seq[2]]], R[2][AX[seq[2]]]] as V3;
    precession = { fixed: angle(w, a1), moving: angle(w, a3) };
  }
  const short = wt.every((s) => s.length <= 4);
  return { ok: true, sym, names, q, dq, R, w, wBody: Rt(w), eps, epsBody: Rt(eps), wOfT: short ? wt : null, point, precession };
}
