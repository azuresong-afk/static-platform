/**
 * Интегралы движения, функция Рауса и канонические уравнения Гамильтона (Мещерский §49), стационарные движения
 * и их устойчивость (§55). Система задаётся как в «Уравнениях Лагранжа»: координаты, параметры, T, Π и
 * непотенциальные обобщённые силы.
 *
 *   обобщённые импульсы       pⱼ = ∂T/∂q̇ⱼ;
 *   циклическая координата    qₐ не входит в T и Π, Qₐ = 0  ⇒  pₐ = nₐ = const;
 *   функция Рауса             R = L − Σ nₐq̇ₐ, скорости q̇ₐ выражены через nₐ;  d/dt(∂R/∂q̇ᵢ) − ∂R/∂qᵢ = Qᵢ;
 *   функция Гамильтона        H = Σ pⱼq̇ⱼ − L = ½(p − b)ᵀA⁻¹(p − b) − T₀ + Π  при  T = ½q̇ᵀAq̇ + bᵀq̇ + T₀;
 *   канонические уравнения    q̇ⱼ = ∂H/∂pⱼ,  ṗⱼ = −∂H/∂qⱼ + Qⱼ.
 * Стационарное движение — равновесие приведённой системы: приведённая потенциальная энергия W = −R₀ (часть R без
 * скоростей) стационарна; устойчиво (по Раусу), если W имеет минимум. Частоты малых колебаний около него — из
 * M·δq̈ + G·δq̇ + K·δq = 0 (M — по R₂, K = ∂²W/∂q², G — гироскопические силы из R₁).
 */
import {
  d,
  div,
  evalSym,
  expand,
  mul,
  neg,
  normName,
  parseSym,
  scale,
  sub,
  subst,
  trigSimplify,
  usesTime,
  variable,
  add,
  commonFactor,
  hasVel,
  varsOf,
  type Sym,
  type SymContext,
  type Term,
  type Wrt,
} from '../../../shared/sym';
import { solveLagrange, type LagProblem } from '../../lagrange/model/lagrange';
import { charPoly, classify, firstOrder, polyRoots, type Cx, type StabVerdict } from './stability';

export interface ReducedEq {
  name: string;
  E: Sym;
  factor: Term;
  Ered: Sym;
}

export interface Steady {
  /** Положение (стационарное движение): координаты, невязка ∂W/∂q. */
  q: number[];
  residual: number;
  M: number[][];
  K: number[][];
  G: number[][];
  roots: Cx[];
  verdict: StabVerdict;
  /** Частоты малых колебаний (при устойчивости). */
  freqs: number[];
}

export interface RouthSolution {
  ok: true;
  ctx: SymContext;
  T: Sym;
  P: Sym;
  Q: Sym[];
  /** Обобщённые импульсы pⱼ = ∂T/∂q̇ⱼ. */
  p: Sym[];
  cyclic: number[];
  /** Имена постоянных циклических импульсов и их значения по начальным условиям. */
  nNames: string[];
  nVal: number[];
  /** Обобщённый интеграл энергии (Якоби), если он есть, и его значение. */
  energy: Sym | null;
  energyVal: number;
  /** Функция Рауса: скорости циклических координат, R и её части по степеням скоростей. */
  routh: { vel: Sym[]; R: Sym; R2: Sym; R1: Sym; R0: Sym; eqs: ReducedEq[]; gyro: Sym[][] | null } | null;
  /** Функция Гамильтона и канонические уравнения. */
  ham: { pNames: string[]; A: Sym[][]; b: Sym[]; T0: Sym; H: Sym; dq: Sym[]; dp: Sym[] } | null;
  hamError: string | null;
  /** Интегрирование канонических уравнений и сравнение с уравнениями Лагранжа. */
  sim: { t: number[]; q: number[][]; p: number[][]; H: number[] } | null;
  lagDiff: number | null;
  hamDrift: number | null;
  steady: Steady | null;
}
export type RouthResult = RouthSolution | { ok: false; field: string; error: string };

const S = (s: Sym) => trigSimplify(expand(s));
const vel = (name: string): Wrt => ({ k: 'var', name, ord: 1 });
const pos = (name: string): Wrt => ({ k: 'var', name, ord: 0 });
/** Степень члена по скоростям. */
const velDeg = (t: Term) => t.f.reduce((s, [a, p]) => s + (a.k === 'var' && a.ord === 1 ? p : 0), 0);
const byDeg = (s: Sym, k: number): Sym => add(s.filter((t) => velDeg(t) === k));
/** Короче из двух записей. */
const shorter = (a: Sym) => {
  const x = S(a);
  return x.length <= a.length ? x : a;
};

/** Символьное обращение матрицы 1–3 через присоединённую; null, если определитель тождественно нуль. */
export function invSym(A: Sym[][]): Sym[][] | null {
  const n = A.length;
  if (n === 1) return A[0][0].length ? [[div([{ c: 1, f: [] }], A[0][0])]] : null;
  const minor = (i: number, j: number) => A.filter((_, r) => r !== i).map((row) => row.filter((_, c) => c !== j));
  const det2 = (M: Sym[][]) => S(sub(mul(M[0][0], M[1][1]), mul(M[0][1], M[1][0])));
  const cof = (i: number, j: number) => {
    const m = minor(i, j);
    const v = m.length === 1 ? m[0][0] : det2(m);
    return (i + j) % 2 ? neg(v) : v;
  };
  const C = A.map((_, i) => A.map((__, j) => cof(i, j)));
  const det = S(add(...A[0].map((a, j) => mul(a, C[0][j]))));
  if (!det.length) return null;
  // Общий множитель определителя выносим, чтобы дроби сокращались.
  const { factor, rest } = commonFactor(det);
  const inv = div([{ c: 1, f: [] }], mul([factor], rest));
  return A.map((_, i) => A.map((__, j) => shorter(mul(C[j][i], inv))));
}

/** Решение линейной системы M·x = r (символьно, 1–3 неизвестных) по Крамеру через обратную матрицу. */
function solveSym(M: Sym[][], r: Sym[]): Sym[] | null {
  const inv = invSym(M);
  if (!inv) return null;
  return inv.map((row) => shorter(add(...row.map((a, j) => mul(a, r[j])))));
}

export function solveRouth(pr: LagProblem): RouthResult {
  // Проверки и уравнения Лагранжа — общие с разделом «Уравнения Лагранжа».
  const lag = solveLagrange(pr);
  if (!lag.ok) return lag;
  const { ctx, T, P } = lag;
  const names = ctx.coords;
  const params = pr.params.map((p) => normName(p.name.trim()));
  const pv = new Map(pr.params.map((p) => [normName(p.name.trim()), p.value]));
  const Q: Sym[] = [];
  for (const c of pr.coords) {
    const r = parseSym(c.Q, ctx);
    Q.push(r.ok ? r.s : []);
  }
  const p = names.map((n) => trigSimplify(d(T, vel(n))));
  const free = (n: string) => !varsOf(T).has(n) && !varsOf(P).has(n);
  const cyclic = names.map((_, i) => i).filter((i) => free(names[i]) && !Q[i].length);
  // Имена постоянных: n (одна циклическая) или n₁, n₂…; при совпадении с параметром — ν, κ.
  const used = new Set([...names, ...params]);
  const base = ['n', 'ν', 'κ', 'N'].find((b) => (cyclic.length === 1 ? !used.has(b) : cyclic.every((_, k) => !used.has(b + (k + 1))))) ?? 'n';
  const nNames = cyclic.map((_, k) => (cyclic.length === 1 ? base : base + (k + 1)));
  const q0 = pr.coords.map((c) => c.q0),
    v0 = pr.coords.map((c) => c.v0);
  const at = (qq: number[], vv: number[], extra?: Map<string, number>) => (name: string, ord: number) => {
    const i = names.indexOf(name);
    if (i >= 0) return ord === 0 ? qq[i] : vv[i];
    return extra?.get(name) ?? pv.get(name) ?? NaN;
  };
  const nVal = cyclic.map((i) => evalSym(p[i], at(q0, v0)));
  const conservative = Q.every((q) => !q.length) && !usesTime(T) && !usesTime(P);
  const energy = conservative ? lag.H : null;
  const energyVal = energy ? evalSym(energy, at(q0, v0)) : NaN;
  const nMap = new Map(nNames.map((n, k) => [n, nVal[k]]));
  const isCoord = (n: string) => names.includes(n);

  // Функция Рауса.
  let routh: RouthSolution['routh'] = null;
  const L = sub(T, P);
  const nonCyc = names.map((_, i) => i).filter((i) => !cyclic.includes(i));
  {
    let R = L;
    let vels: Sym[] = [];
    let okR = true;
    if (cyclic.length) {
      const Mc = cyclic.map((a) => cyclic.map((b) => d(p[a], vel(names[b]))));
      const rhs = cyclic.map((a, k) =>
        sub(
          variable(nNames[k]),
          subst(p[a], (x) => (x.ord === 1 && cyclic.some((b) => names[b] === x.name) ? [] : null)),
        ),
      );
      const sol = solveSym(Mc, rhs);
      if (!sol || Mc.flat().some(hasVel)) okR = false;
      else {
        vels = sol;
        const put = (s: Sym) =>
          subst(s, (x) => (x.ord === 1 ? (cyclic.map((b) => names[b]).indexOf(x.name) >= 0 ? sol[cyclic.map((b) => names[b]).indexOf(x.name)] : null) : null));
        R = shorter(sub(put(L), add(...cyclic.map((_, k) => mul(variable(nNames[k]), sol[k])))));
      }
    }
    if (okR && nonCyc.length) {
      R = shorter(R);
      const R2 = byDeg(R, 2),
        R1 = byDeg(R, 1),
        R0 = byDeg(R, 0);
      const time: Wrt = { k: 'time', isCoord };
      const eqs: ReducedEq[] = nonCyc.map((i) => {
        const n = names[i];
        const dp = d(d(R, vel(n)), time);
        let E = trigSimplify(sub(sub(dp, d(R, pos(n))), Q[i]));
        const Ex = trigSimplify(expand(E));
        if (Ex.length < E.length) E = Ex;
        const { factor, rest } = commonFactor(E);
        return { name: n, E, factor, Ered: rest };
      });
      // Гироскопические коэффициенты Gᵢⱼ = ∂aᵢ/∂qⱼ − ∂aⱼ/∂qᵢ, R₁ = Σ aⱼq̇ⱼ.
      const a = nonCyc.map((i) => d(R1, vel(names[i])));
      const gyro = nonCyc.map((_, i) => nonCyc.map((__, j) => S(sub(d(a[i], pos(names[nonCyc[j]])), d(a[j], pos(names[nonCyc[i]]))))));
      routh = { vel: vels, R, R2, R1, R0, eqs, gyro: gyro.some((r) => r.some((x) => x.length)) ? gyro : null };
    } else if (okR) routh = { vel: vels, R, R2: [], R1: [], R0: R, eqs: [], gyro: null };
  }

  // Функция Гамильтона.
  let ham: RouthSolution['ham'] = null;
  let hamError: string | null = null;
  {
    const zeroV = (s: Sym) => subst(s, (x) => (x.ord === 1 ? [] : null));
    const A = names.map((a) => names.map((b) => trigSimplify(d(d(T, vel(a)), vel(b)))));
    const b = names.map((a) => trigSimplify(zeroV(d(T, vel(a)))));
    const T0 = trigSimplify(zeroV(T));
    const quad = add(
      scale(add(...names.flatMap((a, i) => names.map((c, j) => mul(A[i][j], variable(a, 1), variable(c, 1))))), 0.5),
      ...names.map((a, i) => mul(b[i], variable(a, 1))),
      T0,
    );
    if (A.flat().some(hasVel) || S(sub(T, quad)).length)
      hamError = 'Кинетическая энергия не квадратична по скоростям — функцию Гамильтона в явном виде не строим.';
    else {
      const inv = invSym(A);
      if (!inv) hamError = 'Матрица инерции вырождена (det A = 0) — скорости не выражаются через импульсы.';
      else {
        const pNames = names.map((n) => 'p_' + n);
        const pb = names.map((_, i) => sub(variable(pNames[i]), b[i]));
        const H2: Sym[] = [];
        names.forEach((_, i) =>
          names.forEach((__, j) => {
            if (j < i || !inv[i][j].length) return;
            H2.push(mul(scale(inv[i][j], i === j ? 0.5 : 1), pb[i], pb[j]));
          }),
        );
        const H = shorter(add(...H2, neg(T0), P));
        const dq = pNames.map((pn) => shorter(d(H, pos(pn))));
        const dp = names.map((n, i) => shorter(add(neg(d(H, pos(n))), Q[i])));
        ham = { pNames, A, b, T0, H, dq, dp };
      }
    }
  }

  // Интегрирование канонических уравнений (Рунге — Кутта) и сравнение с уравнениями Лагранжа.
  let sim: RouthSolution['sim'] = null;
  let lagDiff: number | null = null;
  let hamDrift: number | null = null;
  if (ham && pr.tEnd > 0 && lag.sim) {
    const hm = ham;
    const n = names.length;
    const valQP = (q: number[], pp: number[], t: number, v?: number[]) => (name: string, ord: number) => {
      const i = names.indexOf(name);
      if (i >= 0) return ord === 0 ? q[i] : (v?.[i] ?? NaN);
      const k = hm.pNames.indexOf(name);
      if (k >= 0) return pp[k];
      void t;
      return pv.get(name) ?? NaN;
    };
    const f = (q: number[], pp: number[], t: number) => {
      const dq = hm.dq.map((s) => evalSym(s, valQP(q, pp, t), t));
      // Непотенциальные силы могут зависеть от скоростей: q̇ = ∂H/∂p.
      const dpp = hm.dp.map((s) => evalSym(s, valQP(q, pp, t, dq), t));
      return { dq, dp: dpp };
    };
    const steps = 2000,
      h = pr.tEnd / steps;
    let q = q0.slice(),
      pp = names.map((_, i) => evalSym(p[i], at(q0, v0))),
      t = 0;
    const Hval = (qq: number[], ppp: number[], tt: number) => evalSym(hm.H, valQP(qq, ppp, tt), tt);
    const ts = [0],
      qs = q.map((x) => [x]),
      ps = pp.map((x) => [x]),
      Hs = [Hval(q, pp, 0)];
    for (let s = 1; s <= steps; s++) {
      const k1 = f(q, pp, t);
      const k2 = f(
        q.map((x, i) => x + (h / 2) * k1.dq[i]),
        pp.map((x, i) => x + (h / 2) * k1.dp[i]),
        t + h / 2,
      );
      const k3 = f(
        q.map((x, i) => x + (h / 2) * k2.dq[i]),
        pp.map((x, i) => x + (h / 2) * k2.dp[i]),
        t + h / 2,
      );
      const k4 = f(
        q.map((x, i) => x + h * k3.dq[i]),
        pp.map((x, i) => x + h * k3.dp[i]),
        t + h,
      );
      q = q.map((x, i) => x + (h / 6) * (k1.dq[i] + 2 * k2.dq[i] + 2 * k3.dq[i] + k4.dq[i]));
      pp = pp.map((x, i) => x + (h / 6) * (k1.dp[i] + 2 * k2.dp[i] + 2 * k3.dp[i] + k4.dp[i]));
      t = s * h;
      if (!q.every(Number.isFinite) || !pp.every(Number.isFinite)) break;
      if (s % 4 === 0) {
        ts.push(t);
        for (let i = 0; i < n; i++) {
          qs[i].push(q[i]);
          ps[i].push(pp[i]);
        }
        Hs.push(Hval(q, pp, t));
      }
    }
    sim = { t: ts, q: qs, p: ps, H: Hs };
    const L0 = lag.sim;
    const m = Math.min(L0.t.length, ts.length);
    let diff = 0,
      sc = 1e-12;
    for (let i = 0; i < n; i++)
      for (let k = 0; k < m; k++) {
        diff = Math.max(diff, Math.abs(L0.q[i][k] - qs[i][k]));
        sc = Math.max(sc, Math.abs(L0.q[i][k]));
      }
    lagDiff = diff / sc;
    if (conservative) hamDrift = Math.max(...Hs.map((x) => Math.abs(x - Hs[0]))) / Math.max(1e-12, ...Hs.map(Math.abs));
  }

  // Стационарное движение (равновесие приведённой системы): Ньютон от q* по ∂W/∂q = 0.
  let steady: Steady | null = null;
  if (routh && nonCyc.length && Q.every((x) => !x.length) && !usesTime(routh.R)) {
    const W = neg(routh.R0);
    const vars = nonCyc.map((i) => names[i]);
    const grad = vars.map((v) => d(W, pos(v)));
    const hess = vars.map((_, i) => vars.map((v) => d(grad[i], pos(v))));
    const Mx = vars.map((a) => vars.map((b) => d(d(routh.R2, vel(a)), vel(b))));
    const qq = names.map((_, i) => pr.coords[i].eq);
    const val = () =>
      at(
        qq,
        names.map(() => 0),
        nMap,
      );
    for (let it = 0; it < 60; it++) {
      const g = grad.map((s) => evalSym(s, val()));
      const Hn = hess.map((r) => r.map((s) => evalSym(s, val())));
      if (!g.every(Number.isFinite) || !Hn.flat().every(Number.isFinite)) break;
      if (Math.max(...g.map(Math.abs)) < 1e-13) break;
      let dx: number[];
      if (vars.length === 1) dx = [g[0] / Hn[0][0]];
      else {
        const inv = invNum(Hn);
        if (!inv) break;
        dx = inv.map((r) => r.reduce((s, a, k) => s + a * g[k], 0));
      }
      if (!dx.every(Number.isFinite)) break;
      nonCyc.forEach((i, k) => (qq[i] -= dx[k]));
      if (Math.max(...dx.map(Math.abs)) < 1e-14) break;
    }
    const g = grad.map((s) => evalSym(s, val()));
    const K = hess.map((r) => r.map((s) => evalSym(s, val())));
    const M = Mx.map((r) => r.map((s) => evalSym(s, val())));
    const G = routh.gyro ? routh.gyro.map((r) => r.map((s) => evalSym(s, val()))) : vars.map(() => vars.map(() => 0));
    const fo = firstOrder(M, G, K);
    if (fo && [...K.flat(), ...M.flat(), ...G.flat()].every(Number.isFinite)) {
      const roots = polyRoots(charPoly(fo));
      const cl = classify(roots, fo);
      const freqs = [...new Set(cl.verdict !== 'unstable' ? roots.filter((r) => r[1] > 1e-9).map((r) => +r[1].toPrecision(12)) : [])].sort((x, y) => x - y);
      steady = { q: qq.slice(), residual: Math.max(...g.map(Math.abs)), M, K, G, roots, verdict: cl.verdict, freqs };
    }
  }
  return { ok: true, ctx, T, P, Q, p, cyclic, nNames, nVal, energy, energyVal, routh, ham, hamError, sim, lagDiff, hamDrift, steady };
}

function invNum(M: number[][]): number[][] | null {
  const n = M.length;
  const A = M.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < n; c++) {
    let pi = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[pi][c])) pi = r;
    if (Math.abs(A[pi][c]) < 1e-300) return null;
    [A[c], A[pi]] = [A[pi], A[c]];
    const dv = A[c][c];
    A[c] = A[c].map((x) => x / dv);
    for (let r = 0; r < n; r++) if (r !== c) A[r] = A[r].map((x, k) => x - A[r][c] * A[c][k]);
  }
  return A.map((r) => r.slice(n));
}
