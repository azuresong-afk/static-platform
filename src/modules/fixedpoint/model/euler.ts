/**
 * Ориентация тела тремя (двумя) последовательными поворотами и кинематические формулы Эйлера (Мещерский §20;
 * Яблонский К.5). Неподвижные оси Oξηζ, связанные с телом — Oxyz; поворот на угол q₁ вокруг оси a₁ неподвижной
 * системы, затем на q₂ вокруг оси a₂ повёрнутой, затем на q₃ вокруг оси a₃ тела: R = R_a₁(q₁)·R_a₂(q₂)·R_a₃(q₃),
 * столбцы R — орты x, y, z в осях ξ, η, ζ (направляющие косинусы).
 *
 * Угловая скорость: ω = q̇₁u₁ + q̇₂u₂ + q̇₃u₃, u₁ = e_a₁, u₂ = R₁e_a₂, u₃ = R₁R₂e_a₃ (оси поворотов в данный момент);
 * в осях тела Rᵀu₁ = R₃ᵀR₂ᵀe_a₁, Rᵀu₂ = R₃ᵀe_a₂, Rᵀu₃ = e_a₃. Угловое ускорение ε = dω/dt:
 * ε = Σ q̈ᵢuᵢ + q̇₂(q̇₁u₁) × u₂ + q̇₃(q̇₁u₁ + q̇₂u₂) × u₃. Точка M тела: r = R·r_M, v = ω × r, a = ε × r + ω × (ω × r).
 */
import { diff, evalExpr, parseExpr, printExpr, simplify, type Expr } from '../../../shared/expr';
import type { LenUnit } from './scheme';
import { angleDeg, cross, norm, vadd, vmul, type V3 } from './vec';

export type Ax = 1 | 2 | 3;
export type Seq = 'zxz' | 'zyz' | 'plane' | 'ship' | 'cardan1' | 'cardan2' | 'custom';
export interface SeqInfo {
  title: string;
  axes: Ax[];
  names: string[];
}
export const SEQS: Record<Exclude<Seq, 'custom'>, SeqInfo> = {
  zxz: { title: 'углы Эйлера z–x–z: ψ вокруг ζ, θ вокруг линии узлов x′, φ вокруг z', axes: [3, 1, 3], names: ['ψ', 'θ', 'φ'] },
  zyz: { title: 'углы Эйлера z–y–z: ψ вокруг ζ, θ вокруг y′, φ вокруг z (ответы Мещерского 20.3–20.4)', axes: [3, 2, 3], names: ['ψ', 'θ', 'φ'] },
  plane: { title: 'самолётные углы: рыскание ψ вокруг η, тангаж θ вокруг z′, крен φ вокруг x (20.5)', axes: [2, 3, 1], names: ['ψ', 'θ', 'φ'] },
  ship: {
    title: 'корабельные углы А. Н. Крылова: дифферент ψ вокруг η, крен θ вокруг x′, рыскание φ вокруг z (20.7)',
    axes: [2, 1, 3],
    names: ['ψ', 'θ', 'φ'],
  },
  cardan1: { title: 'карданов подвес: β — внешнее кольцо вокруг η, α — внутреннее вокруг x (20.1)', axes: [2, 1], names: ['β', 'α'] },
  cardan2: { title: 'карданов подвес: α — внешнее кольцо вокруг ξ, β — внутреннее вокруг y (20.2)', axes: [1, 2], names: ['α', 'β'] },
};
export const FIXED = ['ξ', 'η', 'ζ'];
export const BODY = ['x', 'y', 'z'];

export interface EulerProblem {
  seq: Seq;
  /** Оси своей последовательности (seq = custom). */
  a1: Ax;
  a2: Ax;
  a3: Ax;
  /** Законы углов, рад: формулы от t. */
  q1: string;
  q2: string;
  q3: string;
  t1: number;
  /** Точка M в осях тела. */
  mx: number;
  my: number;
  mz: number;
  unit: LenUnit;
}

export function seqOf(pr: EulerProblem): SeqInfo {
  if (pr.seq !== 'custom') return SEQS[pr.seq];
  return { title: `своя последовательность: ${BODY[pr.a1 - 1]}–${BODY[pr.a2 - 1]}–${BODY[pr.a3 - 1]}`, axes: [pr.a1, pr.a2, pr.a3], names: ['ψ', 'θ', 'φ'] };
}

/* ---------- символьные тригонометрические одночлены ---------- */

/** Одночлен: коэффициент и множители 'c1' (cos q₁), 's2' (sin q₂), 'd3' (q̇₃)… */
export interface Mono {
  c: number;
  f: string[];
}
export type Poly = Mono[];
const key = (f: string[]) => [...f].sort().join('·');
function padd(...ps: Poly[]): Poly {
  const m = new Map<string, Mono>();
  for (const t of ps.flat()) {
    const k = key(t.f);
    const o = m.get(k);
    if (o) o.c += t.c;
    else m.set(k, { c: t.c, f: [...t.f].sort() });
  }
  return [...m.values()].filter((t) => Math.abs(t.c) > 1e-12);
}
const pmul = (a: Poly, b: Poly): Poly => padd(a.flatMap((x) => b.map((y) => ({ c: x.c * y.c, f: [...x.f, ...y.f] }))));
const P1: Poly = [{ c: 1, f: [] }];
const P0: Poly = [];
const sc = (k: number, f: string): Poly => [{ c: k, f: [f] }];
type PMat = Poly[][];
type PVec = Poly[];
/** Матрица поворота вокруг оси ax на угол qᵢ (i — номер угла). */
function rotP(ax: Ax, i: number): PMat {
  const c = sc(1, `c${i}`),
    s = sc(1, `s${i}`),
    ms = sc(-1, `s${i}`);
  if (ax === 1)
    return [
      [P1, P0, P0],
      [P0, c, ms],
      [P0, s, c],
    ];
  if (ax === 2)
    return [
      [c, P0, s],
      [P0, P1, P0],
      [ms, P0, c],
    ];
  return [
    [c, ms, P0],
    [s, c, P0],
    [P0, P0, P1],
  ];
}
const pmm = (A: PMat, B: PMat): PMat => A.map((r) => [0, 1, 2].map((j) => padd(...r.map((x, k) => pmul(x, B[k][j])))));
const pmv = (A: PMat, v: PVec): PVec => A.map((r) => padd(...r.map((x, k) => pmul(x, v[k]))));
const ptr = (A: PMat): PMat => [0, 1, 2].map((i) => [0, 1, 2].map((j) => A[j][i]));
const pe = (ax: Ax): PVec => [0, 1, 2].map((i) => (i === ax - 1 ? P1 : P0));
const PI3: PMat = [0, 1, 2].map((i) => [0, 1, 2].map((j) => (i === j ? P1 : P0)));

/** Запись одночленов: «ψ̇ sin θ sin φ − θ̇ cos φ». */
export function polyText(p: Poly, names: string[]): string {
  if (!p.length) return '0';
  const dotted = (i: number) => names[i] + '̇';
  const parts = p
    .map((t) => {
      const d = t.f.filter((x) => x[0] === 'd').map((x) => dotted(+x[1] - 1));
      const tr = t.f
        .filter((x) => x[0] !== 'd')
        .sort((a, b) => +a[1] - +b[1] || a.localeCompare(b))
        .map((x) => `${x[0] === 'c' ? 'cos' : 'sin'} ${names[+x[1] - 1]}`);
      const body = [...d, ...tr].join(' ');
      const k = Math.abs(t.c);
      return { neg: t.c < 0, s: (Math.abs(k - 1) < 1e-12 ? '' : String(+k.toFixed(6)).replace('.', ',') + (body ? '·' : '')) + body };
    })
    // Сначала члены со скоростью первого угла, затем по порядку.
    .sort((a, b) => Number(a.neg) - Number(b.neg) || 0);
  return parts.map((x, i) => (i === 0 ? (x.neg ? '−' : '') + x.s : (x.neg ? ' − ' : ' + ') + x.s)).join('');
}

export interface EulerSymbolic {
  /** Таблица направляющих косинусов: строка — ось тела (x, y, z), столбец — неподвижная ось (ξ, η, ζ). */
  table: string[][];
  wF: string[];
  wB: string[];
}

function symbolic(info: SeqInfo): EulerSymbolic {
  const ax = info.axes;
  const R = ax.map((a, i) => rotP(a, i + 1));
  const Rall = R.reduce((m, r) => pmm(m, r), PI3);
  const u1 = pe(ax[0]);
  const u2 = ax.length > 1 ? pmv(R[0], pe(ax[1])) : null;
  const u3 = ax.length > 2 ? pmv(pmm(R[0], R[1]), pe(ax[2])) : null;
  const rate = (i: number): Poly => sc(1, `d${i}`);
  const wF = [0, 1, 2].map((k) => padd(pmul(rate(1), u1[k]), u2 ? pmul(rate(2), u2[k]) : P0, u3 ? pmul(rate(3), u3[k]) : P0));
  // В осях тела: Rᵀu₁ = (R₂R₃)ᵀ e_a₁, Rᵀu₂ = R₃ᵀ e_a₂, Rᵀu₃ = e_a₃.
  const tail = (from: number): PMat => R.slice(from).reduce((m, r) => pmm(m, r), PI3);
  const b1 = pmv(ptr(tail(1)), pe(ax[0]));
  const b2 = ax.length > 1 ? pmv(ptr(tail(2)), pe(ax[1])) : null;
  const b3 = ax.length > 2 ? pe(ax[2]) : null;
  const wB = [0, 1, 2].map((k) => padd(pmul(rate(1), b1[k]), b2 ? pmul(rate(2), b2[k]) : P0, b3 ? pmul(rate(3), b3[k]) : P0));
  const names = info.names;
  return {
    table: [0, 1, 2].map((i) => [0, 1, 2].map((j) => polyText(Rall[j][i], names))),
    wF: wF.map((p) => polyText(p, names)),
    wB: wB.map((p) => polyText(p, names)),
  };
}

/* ---------- численный расчёт ---------- */

type M3 = number[][];
function rotN(ax: Ax, q: number): M3 {
  const c = Math.cos(q),
    s = Math.sin(q);
  if (ax === 1)
    return [
      [1, 0, 0],
      [0, c, -s],
      [0, s, c],
    ];
  if (ax === 2)
    return [
      [c, 0, s],
      [0, 1, 0],
      [-s, 0, c],
    ];
  return [
    [c, -s, 0],
    [s, c, 0],
    [0, 0, 1],
  ];
}
const mm = (A: M3, B: M3): M3 => A.map((r) => [0, 1, 2].map((j) => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
const mv = (A: M3, v: V3): V3 => A.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]) as V3;
const mtv = (A: M3, v: V3): V3 => [0, 1, 2].map((j) => A[0][j] * v[0] + A[1][j] * v[1] + A[2][j] * v[2]) as V3;
const I3: M3 = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];
const ev = (ax: Ax): V3 => [0, 1, 2].map((i) => (i === ax - 1 ? 1 : 0)) as V3;

export interface EulerResult {
  ok: boolean;
  errors: string[];
  info: SeqInfo;
  sym: EulerSymbolic;
  laws: Expr[];
  /** Углы, их первые и вторые производные в момент t₁. */
  q: number[];
  qd: number[];
  qdd: number[];
  /** Производные законов (формулы). */
  dLaw: string[];
  ddLaw: string[];
  R: M3;
  /** Оси поворотов в данный момент (в неподвижных осях). */
  u: V3[];
  wF: V3;
  wB: V3;
  eF: V3;
  eB: V3;
  w: number;
  e: number;
  /** Точка M: в неподвижных осях; скорость и ускорение — в неподвижных и в осях тела. */
  point: { rF: V3; vF: V3; aF: V3; vB: V3; aB: V3; rot: V3; cen: V3 } | null;
  /** Регулярная прецессия: острые углы мгновенной оси с осью прецессии и осью собственного вращения. */
  aks: { fix: number; mov: number } | null;
  /** Проекции ω на неподвижные оси как функции t (если запись короткая). */
  wt: string[] | null;
}

export function solveEuler(pr: EulerProblem): EulerResult {
  const info = seqOf(pr);
  const sym = symbolic(info);
  const n = info.axes.length;
  const errors: string[] = [];
  const srcs = [pr.q1, pr.q2, pr.q3].slice(0, n);
  const laws: Expr[] = [];
  srcs.forEach((s, i) => {
    const r = parseExpr(s);
    if (!r.ok) errors.push(`Закон ${info.names[i]}(t): ${r.error}.`);
    else laws.push(r.e);
  });
  if (!Number.isFinite(pr.t1) || ![pr.mx, pr.my, pr.mz].every(Number.isFinite)) errors.push('Есть незаполненные числа.');
  const empty = {
    ok: false,
    errors,
    info,
    sym,
    laws,
    q: [],
    qd: [],
    qdd: [],
    dLaw: [],
    ddLaw: [],
    R: I3,
    u: [],
    wF: [0, 0, 0] as V3,
    wB: [0, 0, 0] as V3,
    eF: [0, 0, 0] as V3,
    eB: [0, 0, 0] as V3,
    w: 0,
    e: 0,
    point: null,
    aks: null,
    wt: null,
  };
  if (errors.length) return empty;
  const d1 = laws.map((e) => simplify(diff(e)));
  const d2 = d1.map((e) => simplify(diff(e)));
  const t = pr.t1;
  const q = laws.map((e) => evalExpr(e, t)),
    qd = d1.map((e) => evalExpr(e, t)),
    qdd = d2.map((e) => evalExpr(e, t));
  if (![...q, ...qd, ...qdd].every(Number.isFinite)) return { ...empty, errors: [`В момент t₁ = ${t} закон углов не определён.`] };
  while (q.length < 3) {
    q.push(0);
    qd.push(0);
    qdd.push(0);
  }
  const ax = [...info.axes, 3, 3].slice(0, 3) as Ax[];
  const R1 = rotN(ax[0], q[0]),
    R2 = n > 1 ? rotN(ax[1], q[1]) : I3,
    R3 = n > 2 ? rotN(ax[2], q[2]) : I3;
  const R = mm(mm(R1, R2), R3);
  const u1 = ev(ax[0]),
    u2 = mv(R1, ev(ax[1])),
    u3 = mv(mm(R1, R2), ev(ax[2]));
  const us = [u1, u2, u3].slice(0, n);
  const wF = us.reduce<V3>((s, u, i) => vadd(s, vmul(u, qd[i])), [0, 0, 0]);
  let eF = us.reduce<V3>((s, u, i) => vadd(s, vmul(u, qdd[i])), [0, 0, 0]);
  if (n > 1) eF = vadd(eF, vmul(cross(vmul(u1, qd[0]), u2), qd[1]));
  if (n > 2) eF = vadd(eF, vmul(cross(vadd(vmul(u1, qd[0]), vmul(u2, qd[1])), u3), qd[2]));
  const wB = mtv(R, wF),
    eB = mtv(R, eF);
  const m: V3 = [pr.mx, pr.my, pr.mz];
  let point: EulerResult['point'] = null;
  if (norm(m) > 0) {
    const rF = mv(R, m);
    const vF = cross(wF, rF);
    const rot = cross(eF, rF),
      cen = cross(wF, vF);
    const aF = vadd(rot, cen);
    point = { rF, vF, aF, vB: mtv(R, vF), aB: mtv(R, aF), rot, cen };
  }
  // Регулярная прецессия: θ = const, ψ̇ и φ̇ постоянны (по законам, а не только в момент t₁).
  let aks: EulerResult['aks'] = null;
  const constE = (e: Expr) => [0, 0.37, 1.91, 4.3].every((tt) => Math.abs(evalExpr(e, tt) - evalExpr(e, 0)) < 1e-12);
  if (n === 3 && ax[0] === ax[2] && constE(d1[1]) && Math.abs(qd[1]) < 1e-12 && constE(d1[0]) && constE(d1[2]) && norm(wF) > 0)
    aks = { fix: acute(angleDeg(wF, u1)), mov: acute(angleDeg(wF, u3)) };
  // ω(t) в неподвижных осях — подстановка законов в формулы.
  const wt = [...laws, ...d1].some((e) => printExpr(e).includes('t')) ? wtFormulas(info, laws, d1) : null;
  return {
    ok: true,
    errors: [],
    info,
    sym,
    laws,
    q,
    qd,
    qdd,
    dLaw: d1.map((e) => printExpr(e)),
    ddLaw: d2.map((e) => printExpr(e)),
    R,
    u: us,
    wF,
    wB,
    eF,
    eB,
    w: norm(wF),
    e: norm(eF),
    point,
    aks,
    wt,
  };
}

const acute = (a: number) => (a > 90 ? 180 - a : a);

/** Проекции ω на неподвижные оси как формулы от t: одночлены с подставленными законами. */
function wtFormulas(info: SeqInfo, laws: Expr[], d1: Expr[]): string[] | null {
  const ax = info.axes;
  const R = ax.map((a, i) => rotP(a, i + 1));
  const u = [pe(ax[0]), ax.length > 1 ? pmv(R[0], pe(ax[1])) : null, ax.length > 2 ? pmv(pmm(R[0], R[1]), pe(ax[2])) : null];
  const out: string[] = [];
  for (let k = 0; k < 3; k++) {
    let e: Expr | null = null;
    u.forEach((uu, i) => {
      if (!uu) return;
      for (const t of uu[k]) {
        let term: Expr = { k: 'mul', a: { k: 'num', v: t.c }, b: d1[i] };
        for (const f of t.f) term = { k: 'mul', a: term, b: { k: 'fn', f: f[0] === 'c' ? 'cos' : 'sin', a: laws[+f[1] - 1] } };
        e = e ? { k: 'add', a: e, b: term } : term;
      }
    });
    const s = e ? printExpr(simplify(e)) : '0';
    if (s.length > 140) return null;
    out.push(s);
  }
  return out;
}
