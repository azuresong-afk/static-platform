/**
 * Равновесие и устойчивость в общем виде (Мещерский §52, 55, 49.12; Яблонский Д.23).
 *
 * Система задаётся как в «Уравнениях Лагранжа» (координаты, параметры, T, Π, непотенциальные силы), а положение
 * равновесия (относительного равновесия, стационарного движения приведённой системы) q* — формулами от параметров.
 *
 *   W = Π − T₀ (T₀ — часть T без скоростей),  Fⱼ = −∂W/∂qⱼ + Qⱼ(q, 0)  — обобщённые силы покоя;
 *   q* — равновесие, если Fⱼ(q*) = 0 тождественно; иначе это уравнения равновесия в буквах.
 * Обратные задачи: неизвестный параметр X (момент, вес противовеса) — из Fⱼ(q*) = 0 (линейно по X); безразличное
 * равновесие — из Fⱼ(q) ≡ 0 при всех q (отношение −B/A не зависит от q).
 * Линеаризация около q*: M·δq̈ + (D + G)·δq̇ + K·δq = 0,
 *   M = ∂²T/∂q̇∂q̇,  G — гироскопические коэффициенты (T₁ = Σaⱼq̇ⱼ: Gᵢⱼ = ∂aᵢ/∂qⱼ − ∂aⱼ/∂qᵢ),
 *   D = −∂Q/∂q̇ (сопротивление),  K = −∂F/∂q.
 * Консервативная система (G = D = 0, K симметрична): критерий Сильвестра для K в буквах (теорема Лагранжа — Дирихле),
 * иначе — характеристическое уравнение det(Mλ² + (D + G)λ + K) = 0 и условия Гурвица (или, без диссипации, условия
 * вещественности корней λ²). Каждое условие решается относительно выбранного параметра, если он входит в одной
 * степени: ω² < g·c/a². Граница по параметру — перебором при заданных числах.
 * Малые колебания: частоты; для одной координаты k² = K/M в буквах, закон δq = δq₀ cos kt + (δq̇₀/k) sin kt и амплитуда.
 * Канонические переменные (49.12): p = M·δq̇ + N·δq + p*, N = ∂a/∂q;
 *   δq̇ = M⁻¹(δp − Nδq),  δṗ = NᵀM⁻¹(δp − Nδq) − K·δq.
 */
import { gauss } from '../../../shared/gauss';
import {
  add,
  d,
  div,
  evalSym,
  expand,
  hasVel,
  mul,
  neg,
  normName,
  parseSym,
  scale,
  sub,
  subst,
  trigSimplify,
  usesTime,
  varsOf,
  type Sym,
  type SymContext,
  type Term,
  type Wrt,
} from '../../../shared/sym';
import { eigenGeneral, type LagParam } from '../../lagrange/model/lagrange';
import { invSym } from './routh';
import { analyzeBuilt, buildSecond, reduceBy, type StabSolution, type StabVerdict } from './stability';

export interface LetCoord {
  name: string;
  /** Положение равновесия q* — формула от параметров. */
  at: string;
  /** Непотенциальная обобщённая сила (может зависеть от скоростей). */
  Q: string;
  /** Начальные отклонение и скорость (для закона малых колебаний). */
  dq0: number;
  dv0: number;
}
export interface LetProblem {
  coords: LetCoord[];
  params: LagParam[];
  T: string;
  P: string;
  /** Искомый параметр обратной задачи ('' — нет) и вид: равновесие в q* или безразличное равновесие. */
  unknown: string;
  indifferent: boolean;
  /** Параметр, относительно которого решаются условия устойчивости ('' — нет), и отрезок перебора. */
  cond: string;
  scan: { from: number; to: number } | null;
}

export interface LetCond {
  label: string;
  D: Sym;
  factor: Term;
  rest: Sym;
  value: number;
  /** Условие, решённое относительно параметра: p^pow rel rhs. */
  solved: { p: string; pow: number; rel: '>' | '<'; rhs: Sym; value: number } | null;
}

export interface LetSolution {
  ok: true;
  ctx: SymContext;
  T: Sym;
  P: Sym;
  T0: Sym;
  W: Sym;
  /** Обобщённые силы покоя Fⱼ(q). */
  F: Sym[];
  at: Sym[];
  /** Fⱼ(q*) — после подстановки (и найденного параметра). */
  Fat: Sym[];
  /** q* — равновесие тождественно, только при заданных числах, или нет (тогда q — корень уравнений от q*). */
  equil: 'identity' | 'numeric' | 'no';
  q: number[];
  residual: number;
  unknown: { name: string; expr: Sym; value: number; indifferent: boolean } | null;
  /** Безразличное равновесие: F ≡ 0. */
  neutralAll: boolean;
  /** Матрицы линеаризации в буквах (в q*, или в общем виде, если q* — не равновесие) и числа. */
  M: Sym[][];
  G: Sym[][];
  D: Sym[][];
  K: Sym[][];
  num: { M: number[][]; G: number[][]; D: number[][]; K: number[][] };
  kind: 'potential' | 'gyro' | 'general';
  /** Условия устойчивости в буквах. */
  conds: LetCond[];
  /** Для непотенциальной системы — характеристическое уравнение и корни. */
  stab: StabSolution | null;
  /** Собственные значения K (потенциальная система). */
  kEig: number[];
  verdict: StabVerdict | 'neutral';
  /** Частоты малых колебаний (числа), для одной координаты — k² в буквах. */
  freqs: number[];
  k2: Sym | null;
  law: { k: number; amp: number; phase: number } | null;
  /** Линеаризованные канонические уравнения. */
  canon: { pStar: Sym[]; N: Sym[][]; Minv: Sym[][]; dq: Sym[][]; dp: Sym[][] } | null;
  scan: { param: string; from: number; to: number; stable: [number, number][]; bounds: number[] } | null;
  /** Значения параметров (с найденным неизвестным). */
  values: Map<string, number>;
}
export type LetResult = LetSolution | { ok: false; field: string; error: string };

const S = (s: Sym) => trigSimplify(expand(s));
const shorter = (a: Sym) => {
  const x = S(a);
  return x.length <= a.length ? x : a;
};
const vel = (name: string): Wrt => ({ k: 'var', name, ord: 1 });
const pos = (name: string): Wrt => ({ k: 'var', name, ord: 0 });
const velDeg = (t: Term) => t.f.reduce((s, [a, p]) => s + (a.k === 'var' && a.ord === 1 ? p : 0), 0);

/** Условие D > 0, решённое относительно параметра p (p входит в одной степени, не внутри функций и скобок). */
export function solveFor(D0: Sym, p: string, pv: Map<string, number>): LetCond['solved'] {
  const D = S(D0);
  if (!D.length) return null;
  const groups = new Map<number, Term[]>();
  for (const t of D) {
    let e = 0;
    const f: Term['f'] = [];
    for (const [a, k] of t.f) {
      if (a.k === 'var' && a.name === p && a.ord === 0) e += k;
      else {
        if ((a.k === 'fn' || a.k === 'grp') && varsOf(a.a).has(p)) return null;
        f.push([a, k]);
      }
    }
    const g = groups.get(e) ?? [];
    g.push({ c: t.c, f });
    groups.set(e, g);
  }
  if (groups.size !== 2) return null;
  const [e1, e2] = [...groups.keys()].sort((a, b) => a - b);
  const A = add(groups.get(e1)!),
    B = add(groups.get(e2)!);
  const ev = (s: Sym) => evalSym(s, (n) => pv.get(n) ?? NaN);
  const pval = pv.get(p) ?? NaN;
  // D = p^e1·(A + B·p^k): знак множителя p^e1 — при заданном p.
  const sOut = e1 === 0 ? 1 : Math.sign(Math.pow(pval, e1));
  const bv = ev(B);
  if (!sOut || !bv || !Number.isFinite(bv)) return null;
  const k = e2 - e1;
  const rhs = shorter(neg(div(A, B)));
  // sOut·(A + B p^k) > 0  ⇔  B p^k > −A (sOut > 0)  ⇔  p^k ≷ rhs по знаку B·sOut.
  const rel: '>' | '<' = bv * sOut > 0 ? '>' : '<';
  return { p, pow: k, rel, rhs, value: ev(rhs) };
}

const ident = (n: number) => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (__, j) => (i === j ? 1 : 0)));

export function solveLetters(pr: LetProblem): LetResult {
  const coords = pr.coords.map((c) => ({ ...c, name: normName(c.name.trim()) }));
  const params = pr.params.map((p) => ({ ...p, name: normName(p.name.trim()) }));
  if (!coords.length) return { ok: false, field: 'coords', error: 'Нужна хотя бы одна обобщённая координата.' };
  if (coords.length > 3) return { ok: false, field: 'coords', error: 'Не больше трёх обобщённых координат.' };
  const names = [...coords.map((c) => c.name), ...params.map((p) => p.name)];
  for (const n of names) if (!/^[\p{L}][\p{L}\p{N}_]*$/u.test(n)) return { ok: false, field: 'names', error: `Имя «${n}» — буква, затем буквы или цифры.` };
  const dup = names.find((n, i) => names.indexOf(n) !== i);
  if (dup) return { ok: false, field: 'names', error: `Обозначение «${dup}» встречается дважды.` };
  if (names.includes('t')) return { ok: false, field: 'names', error: 'Буква t занята под время.' };
  const ctx: SymContext = { coords: coords.map((c) => c.name), params: params.map((p) => p.name) };
  const pctx: SymContext = { coords: [], params: ctx.params };
  const parse = (src: string, field: string, c = ctx): Sym | { ok: false; field: string; error: string } => {
    const r = parseSym(src, c);
    return r.ok ? r.s : { ok: false, field, error: r.error };
  };
  const T = parse(pr.T, 'T');
  if (!Array.isArray(T)) return T;
  const P = parse(pr.P, 'P');
  if (!Array.isArray(P)) return P;
  if ([...varsOf(T).values()].some((v) => v.ord > 1)) return { ok: false, field: 'T', error: 'В кинетическую энергию входят только координаты и скорости.' };
  if (hasVel(P)) return { ok: false, field: 'P', error: 'Потенциальная энергия не зависит от скоростей.' };
  if (usesTime(T) || usesTime(P)) return { ok: false, field: 'T', error: 'T и Π не должны явно зависеть от времени.' };
  const Q: Sym[] = [];
  const at: Sym[] = [];
  for (const [j, c] of coords.entries()) {
    const q = parse(c.Q, 'Q' + j);
    if (!Array.isArray(q)) return q;
    if ([...varsOf(q).values()].some((v) => v.ord > 1) || usesTime(q))
      return { ok: false, field: 'Q' + j, error: 'Обобщённая сила зависит только от координат и скоростей.' };
    Q.push(q);
    const a = parse(c.at, 'at' + j, pctx);
    if (!Array.isArray(a)) return a;
    at.push(a);
  }
  const unk = normName(pr.unknown.trim());
  if (unk && !ctx.params.includes(unk)) return { ok: false, field: 'unknown', error: `Искомый параметр «${unk}» — добавьте его в параметры.` };
  const cnd = normName(pr.cond.trim());
  if (cnd && !ctx.params.includes(cnd)) return { ok: false, field: 'cond', error: `Параметр «${cnd}» — добавьте его в параметры.` };
  if (cnd && cnd === unk) return { ok: false, field: 'cond', error: 'Параметр условия совпадает с искомым параметром.' };

  const cn = ctx.coords;
  const pv = new Map(params.map((p) => [p.name, p.value]));
  const ev = (s: Sym, q?: number[]) =>
    evalSym(s, (n, ord) => {
      const i = cn.indexOf(n);
      if (i >= 0) return ord === 0 ? (q ? q[i] : NaN) : 0;
      return pv.get(n) ?? NaN;
    });
  const atRest = (s: Sym) => subst(s, (a) => (a.ord >= 1 ? [] : null));
  const T0 = trigSimplify(atRest(T));
  const T1 = add(T.filter((t) => velDeg(t) === 1));
  const W = shorter(sub(P, T0));
  let F = cn.map((n, j) => shorter(add(neg(d(W, pos(n))), atRest(Q[j]))));
  const atSub = (s: Sym) => subst(s, (a) => (a.ord === 0 && cn.includes(a.name) ? at[cn.indexOf(a.name)] : null));

  // Обратная задача: искомый параметр X.
  let unknown: LetSolution['unknown'] = null;
  if (unk) {
    const src = pr.indifferent ? F : F.map((f) => shorter(atSub(f)));
    let expr: Sym | null = null;
    for (const f of src) {
      const A = shorter(d(f, pos(unk)));
      if (!A.length) continue;
      if (varsOf(A).has(unk)) return { ok: false, field: 'unknown', error: `Уравнение равновесия нелинейно по ${unk} — найти его в буквах нельзя.` };
      const B = subst(f, (a) => (a.name === unk && a.ord === 0 ? [] : null));
      expr = shorter(neg(div(B, A)));
      break;
    }
    if (!expr) return { ok: false, field: 'unknown', error: `Параметр ${unk} не входит в условия равновесия.` };
    if (pr.indifferent) {
      // −B/A не должно зависеть от q: проверка в нескольких точках около q*.
      const q0 = at.map((a) => ev(a));
      const vals = [-0.7, -0.3, 0.2, 0.5, 0.9].map((h) =>
        ev(
          expr!,
          q0.map((x) => x + h),
        ),
      );
      const fin = vals.filter(Number.isFinite);
      const sc = Math.max(1e-300, ...fin.map(Math.abs));
      if (fin.length < 2 || fin.some((v) => Math.abs(v - fin[0]) > 1e-8 * sc))
        return { ok: false, field: 'unknown', error: `Безразличного равновесия нет ни при каком ${unk}: условие зависит от положения системы.` };
      if ([...varsOf(expr).values()].some((v) => cn.includes(v.name))) expr = subst(expr, (a) => (cn.includes(a.name) ? at[cn.indexOf(a.name)] : null));
    }
    const value = ev(
      expr,
      at.map((a) => ev(a)),
    );
    unknown = { name: unk, expr: shorter(expr), value, indifferent: pr.indifferent };
    pv.set(unk, value);
    const put = (s: Sym) => subst(s, (a) => (a.name === unk && a.ord === 0 ? unknown!.expr : null));
    F = F.map((f) => shorter(put(f)));
  }
  const putX = (s: Sym) => (unknown ? subst(s, (a) => (a.name === unknown!.name && a.ord === 0 ? unknown!.expr : null)) : s);
  const Tx = putX(T),
    Qx = Q.map(putX),
    Wx = putX(W);
  const neutralAll = F.every((f) => !f.length) || (!!unknown && unknown.indifferent);

  // Проверка равновесия в q*.
  let qn = at.map((a) => ev(a));
  if (!qn.every(Number.isFinite)) return { ok: false, field: 'at0', error: 'q* не вычисляется при заданных параметрах.' };
  const Fat = F.map((f) => shorter(atSub(f)));
  const Fn = (q: number[]) => F.map((f) => ev(f, q));
  const fScale = Math.max(1e-12, ...[0.3, -0.3, 0.7].flatMap((h) => Fn(qn.map((x) => x + h)).map(Math.abs)).filter(Number.isFinite));
  let equil: LetSolution['equil'];
  let residual = Math.max(...Fn(qn).map(Math.abs));
  if (Fat.every((f) => !f.length)) equil = 'identity';
  else if (residual <= 1e-9 * fScale) equil = 'numeric';
  else {
    equil = 'no';
    // Корень уравнений равновесия — Ньютон от q*.
    const Kf = F.map((f) => cn.map((n) => neg(d(f, pos(n)))));
    let q = qn.slice();
    for (let it = 0; it < 100; it++) {
      const fv = Fn(q);
      if (!fv.every(Number.isFinite)) break;
      if (Math.max(...fv.map(Math.abs)) <= 1e-13 * fScale) break;
      const kv = Kf.map((r) => r.map((k) => ev(k, q)));
      const dq = cn.length === 1 ? [fv[0] / kv[0][0]] : gauss(kv, fv);
      if (!dq.every(Number.isFinite)) break;
      q = q.map((x, i) => x + dq[i]);
    }
    qn = q;
    residual = Math.max(...Fn(qn).map(Math.abs));
  }

  // Линеаризация.
  const sAt = (s: Sym) => shorter(equil === 'no' ? s : atSub(s));
  const zeroV = (s: Sym) => subst(s, (a) => (a.ord === 1 ? [] : null));
  const M = cn.map((a) => cn.map((b) => sAt(zeroV(d(d(Tx, vel(a)), vel(b))))));
  const aCoef = cn.map((n) => zeroV(d(putX(T1), vel(n))));
  const G = cn.map((_, i) => cn.map((__, j) => sAt(sub(d(aCoef[i], pos(cn[j])), d(aCoef[j], pos(cn[i]))))));
  const Dm = cn.map((_, i) => cn.map((n) => sAt(neg(zeroV(d(Qx[i], vel(n)))))));
  const K = cn.map((_, i) => cn.map((n) => sAt(neg(d(F[i], pos(n))))));
  const numOf = (X: Sym[][]) => X.map((r) => r.map((s) => ev(s, qn)));
  const num = { M: numOf(M), G: numOf(G), D: numOf(Dm), K: numOf(K) };
  if (![...num.M.flat(), ...num.K.flat(), ...num.G.flat(), ...num.D.flat()].every(Number.isFinite))
    return { ok: false, field: 'params', error: 'Коэффициенты линеаризации не вычисляются — проверьте q* и значения параметров.' };
  const n = cn.length;
  const nz = (X: Sym[][]) => X.some((r) => r.some((s) => s.length > 0));
  const symK = cn.every((_, i) => cn.every((__, j) => !S(sub(K[i][j], K[j][i])).length));
  const kind: LetSolution['kind'] = !nz(G) && !nz(Dm) && symK ? 'potential' : !nz(Dm) && symK ? 'gyro' : 'general';

  // Условия устойчивости.
  const conds: LetCond[] = [];
  const pvFor = (extra?: [string, number]) => {
    const m = new Map(pv);
    if (extra) m.set(extra[0], extra[1]);
    return m;
  };
  const mk = (label: string, Dsym: Sym, pvm = pv): LetCond => {
    // Одночлен не сокращаем целиком: условие — знак его множителей (sin α·cos θ > 0); скобку раскрываем.
    const ex = Dsym.length === 1 ? S(Dsym) : Dsym;
    const red = reduceBy(ex, pvm);
    const single = red.rest.length === 1 && !red.rest[0].f.length;
    const factor: Term = single ? { c: Math.abs(ex[0]?.c ?? 1), f: [] } : red.factor;
    const rest = single ? scale(ex, 1 / factor.c) : red.rest;
    const value = evalSym(Dsym, (nm, ord) => {
      const i = cn.indexOf(nm);
      if (i >= 0) return ord === 0 ? qn[i] : 0;
      return pvm.get(nm) ?? NaN;
    });
    return { label, D: Dsym, factor, rest, value, solved: cnd && equil !== 'no' ? solveFor(rest, cnd, pvm) : null };
  };
  let stab: StabSolution | null = null;
  let kEig: number[] = [];
  let verdict: LetSolution['verdict'];
  const potVerdict = (Kn: number[][]): { v: LetSolution['verdict']; e: number[] } => {
    const e = eigenGeneral(ident(n), Kn);
    const sc = Math.max(1e-300, ...Kn.flat().map(Math.abs));
    const v = e.some((x) => !Number.isFinite(x))
      ? 'unstable'
      : e.some((x) => x < -1e-9 * sc)
        ? 'unstable'
        : e.every((x) => x > 1e-9 * sc)
          ? 'linear'
          : 'neutral';
    return { v, e };
  };
  if (neutralAll) verdict = 'neutral';
  else if (kind === 'potential' && equil === 'no') {
    const r = potVerdict(num.K);
    kEig = r.e;
    verdict = r.v;
  } else if (kind === 'potential') {
    for (let k = 1; k <= n; k++) {
      const sub_ = K.slice(0, k).map((r) => r.slice(0, k));
      conds.push(mk(`Δ${'₁₂₃'[k - 1]}`, k === 1 ? sub_[0][0] : detSymLocal(sub_)));
    }
    const r = potVerdict(num.K);
    kEig = r.e;
    verdict = r.v;
  } else {
    const bt = buildSecond(
      M,
      cn.map((_, i) => cn.map((__, j) => shorter(add(Dm[i][j], G[i][j])))),
      K,
    );
    if ('ok' in bt) return bt;
    const sr = analyzeBuilt(bt, pv, null);
    if (!sr.ok) return sr;
    stab = sr;
    verdict = sr.verdict;
    if (sr.even) for (const c of sr.even) conds.push(mk(c.label, c.D));
    else for (const c of sr.conds) conds.push(mk(c.k < 0 ? `a${'₀₁₂₃₄₅₆'[c.idx ?? 0]}` : `Δ${'₀₁₂₃₄₅₆'[c.k]}`, c.D));
  }

  // Частоты.
  let freqs: number[] = [];
  let k2: Sym | null = null;
  let law: LetSolution['law'] = null;
  if (!neutralAll) {
    const hasM = num.M.flat().some((x) => x !== 0);
    if (!hasM) freqs = [];
    else if (kind === 'potential' && verdict === 'linear') {
      const w2 = eigenGeneral(num.M, num.K);
      freqs = w2.filter((x) => x > 0).map(Math.sqrt);
    } else if (stab && (stab.verdict === 'linear' || stab.verdict === 'asym'))
      freqs = [...new Set(stab.roots.filter((r) => r[1] > 1e-9).map((r) => +r[1].toPrecision(12)))].sort((a, b) => a - b);
    if (n === 1 && kind === 'potential' && hasM) {
      k2 = shorter(div(K[0][0], M[0][0]));
      if (verdict === 'linear' && (coords[0].dq0 || coords[0].dv0)) {
        const k = Math.sqrt(num.K[0][0] / num.M[0][0]);
        const d0 = coords[0].dq0,
          v0 = coords[0].dv0;
        law = { k, amp: Math.hypot(d0, v0 / k), phase: Math.atan2(d0, v0 / k) };
      }
    }
  }

  // Канонические переменные: p* = a(q*), N = ∂a/∂q (q*).
  let canon: LetSolution['canon'] = null;
  if (!neutralAll && equil !== 'no') {
    const Minv = invSym(M);
    if (Minv) {
      const pStar = aCoef.map((a) => sAt(a));
      const N = cn.map((_, i) => cn.map((nm) => sAt(d(aCoef[i], pos(nm)))));
      // δq̇ = M⁻¹δp − M⁻¹Nδq;  δṗ = NᵀM⁻¹δp − (NᵀM⁻¹N + K)δq. Строки: коэффициенты при (δq, δp).
      const MinvN = Minv.map((r) => cn.map((_, j) => shorter(add(...r.map((x, k) => mul(x, N[k][j]))))));
      const NtMinv = cn.map((_, i) => cn.map((__, j) => shorter(add(...cn.map((___, k) => mul(N[k][i], Minv[k][j]))))));
      const NtMinvN = cn.map((_, i) => cn.map((__, j) => shorter(add(...cn.map((___, k) => mul(NtMinv[i][k], N[k][j]))))));
      const dq = cn.map((_, i) => [...MinvN[i].map(neg), ...Minv[i]]);
      const dp = cn.map((_, i) => [...cn.map((__, j) => shorter(neg(add(NtMinvN[i][j], K[i][j])))), ...NtMinv[i]]);
      canon = { pStar, N, Minv, dq, dp };
    }
  }

  // Граница по параметру условия.
  let scan: LetSolution['scan'] = null;
  if (cnd && pr.scan && pr.scan.to > pr.scan.from && !neutralAll) {
    const evx = (s: Sym, m: Map<string, number>, q: number[]) =>
      evalSym(s, (nm, ord) => {
        const i = cn.indexOf(nm);
        if (i >= 0) return ord === 0 ? q[i] : 0;
        return m.get(nm) ?? NaN;
      });
    const stableAt = (x: number): boolean => {
      const m = pvFor([cnd, x]);
      const q = at.map((a) => evx(a, m, []));
      if (equil === 'no' || !q.every(Number.isFinite)) return false;
      const Kn = K.map((r) => r.map((s) => evx(s, m, q)));
      if (!Kn.flat().every(Number.isFinite)) return false;
      if (kind === 'potential') return potVerdict(Kn).v === 'linear';
      const Mn = M.map((r) => r.map((s) => evx(s, m, q)));
      const Bn = cn.map((_, i) => cn.map((__, j) => evx(Dm[i][j], m, q) + evx(G[i][j], m, q)));
      const bt = buildSecond(
        Mn.map((r) => r.map((v) => [{ c: v, f: [] }])),
        Bn.map((r) => r.map((v) => [{ c: v, f: [] }])),
        Kn.map((r) => r.map((v) => [{ c: v, f: [] }])),
      );
      if ('ok' in bt) return false;
      const sr = analyzeBuilt(bt, m, null);
      return sr.ok && (sr.verdict === 'asym' || sr.verdict === 'linear');
    };
    const N = 240,
      { from, to } = pr.scan;
    const xs = Array.from({ length: N + 1 }, (_, i) => from + ((to - from) * i) / N);
    const st = xs.map(stableAt);
    const bounds: number[] = [];
    const stable: [number, number][] = [];
    let start: number | null = st[0] ? from : null;
    for (let i = 1; i <= N; i++) {
      if (st[i] === st[i - 1]) continue;
      let lo = xs[i - 1],
        hi = xs[i];
      for (let k = 0; k < 60; k++) {
        const mid = (lo + hi) / 2;
        if (stableAt(mid) === st[i - 1]) lo = mid;
        else hi = mid;
      }
      const x = (lo + hi) / 2;
      bounds.push(x);
      if (st[i]) start = x;
      else if (start != null) {
        stable.push([start, x]);
        start = null;
      }
    }
    if (start != null) stable.push([start, to]);
    scan = { param: cnd, from, to, stable, bounds };
  }

  return {
    ok: true,
    ctx,
    T,
    P,
    T0,
    W: Wx,
    F,
    at,
    Fat,
    equil,
    q: qn,
    residual,
    unknown,
    neutralAll,
    M,
    G,
    D: Dm,
    K,
    num,
    kind,
    conds,
    stab,
    kEig,
    verdict,
    freqs,
    k2,
    law,
    canon,
    scan,
    values: pv,
  };
}

/** Определитель 2×2 или 3×3 в буквах. */
function detSymLocal(X: Sym[][]): Sym {
  if (X.length === 2) return S(sub(mul(X[0][0], X[1][1]), mul(X[0][1], X[1][0])));
  const m = (i: number, j: number) => X.filter((_, r) => r !== i).map((row) => row.filter((__, c) => c !== j));
  const parts = X[0].map((a, j) => {
    const t = mul(a, detSymLocal(m(0, j)));
    return j % 2 ? neg(t) : t;
  });
  return S(add(...parts));
}
