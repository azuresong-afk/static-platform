/**
 * Положения равновесия и их устойчивость (Мещерский §52, 47, 31; Яблонский Д.22).
 *
 * Равновесие — покой: q̇ = q̈ = 0. Из уравнений Лагранжа ∂W/∂qⱼ = Qⱼ^н(q, 0), где W = Π − T₀ — приведённая потенциальная
 * энергия (T₀ — часть кинетической энергии без скоростей: во вращающейся системе −T₀ — потенциал центробежных сил
 * инерции, так находится и относительное равновесие). Обобщённая сила покоя Fⱼ = −∂W/∂qⱼ + Qⱼ^н(q, 0).
 *
 * Одна степень свободы: корни F на отрезке — перемена знака (уточнение делением пополам) и касание (минимум |F|),
 * изломы W (F меняет знак скачком), полюсы отбрасываются. Устойчивость — по жёсткости K = −dF/dq (= W″ без
 * непотенциальных сил): K > 0 — минимум W, устойчиво (теорема Лагранжа — Дирихле); K < 0 — максимум, неустойчиво;
 * K = 0 — по первой ненулевой высшей производной W: нечётного порядка — перегиб (неустойчиво), чётного — по знаку;
 * все нули — безразличное равновесие. На изломе — по знакам F слева и справа.
 * Несколько степеней свободы: метод Ньютона от заданного приближения q*, устойчивость — по собственным значениям K.
 * T можно не задавать: тогда только статика (без частот малых колебаний).
 */
import { gauss } from '../../../shared/gauss';
import { add, d, evalSym, neg, normName, parseSym, sub, subst, usesTime, varsOf, type Sym, type SymContext } from '../../../shared/sym';
import { eigenGeneral, type LagProblem } from './lagrange';

export interface EqPoint {
  q: number[];
  kind: 'smooth' | 'kink';
  /** Жёсткость K (одна степень) или собственные значения матрицы K. */
  k: number[];
  /** При K = 0 (одна степень): порядок и значение первой ненулевой производной W. */
  higher: { order: number; value: number } | null;
  /** На изломе: обобщённая сила покоя слева и справа. */
  jump: [number, number] | null;
  stable: 'stable' | 'unstable' | 'neutral';
  /** Квадраты частот малых колебаний (если задана T и положение устойчиво). */
  w2: number[] | null;
  /** Невязка |F| в найденной точке. */
  residual: number;
}
export interface EquilResult {
  ok: true;
  ctx: SymContext;
  W: Sym;
  T0: Sym;
  /** Обобщённые силы покоя Fⱼ и матрица жёсткости K = −∂F/∂q. */
  F: Sym[];
  K: Sym[][];
  /** Непотенциальные силы в покое есть (входят в условие равновесия). */
  nonPot: boolean;
  /** В T есть члены, линейные по скоростям (гироскопические). */
  gyro: boolean;
  points: EqPoint[];
  mode: 'scan' | 'newton';
  range: [number, number] | null;
  /** Метод Ньютона не сошёлся. */
  failed: boolean;
  /** Обобщённая сила покоя тождественно равна нулю: любое положение — безразличное равновесие. */
  indifferent: boolean;
}
export type EquilOut = EquilResult | { ok: false; field: string; error: string };

const N_SCAN = 2400;

export function findEquilibria(pr: LagProblem): EquilOut | null {
  if (!pr.eqSearch) return null;
  const coords = pr.coords.map((c) => ({ ...c, name: normName(c.name.trim()) }));
  const params = pr.params.map((p) => ({ ...p, name: normName(p.name.trim()) }));
  if (!coords.length) return { ok: false, field: 'coords', error: 'Нужна хотя бы одна обобщённая координата.' };
  const ctx: SymContext = { coords: coords.map((c) => c.name), params: params.map((p) => p.name) };
  const parse = (src: string, field: string): Sym | { ok: false; field: string; error: string } => {
    const r = parseSym(src, ctx);
    return r.ok ? r.s : { ok: false, field, error: r.error };
  };
  const T = parse(pr.T, 'T');
  if (!Array.isArray(T)) return T;
  const P = parse(pr.P, 'P');
  if (!Array.isArray(P)) return P;
  const Q: Sym[] = [];
  for (const [j, c] of coords.entries()) {
    const q = parse(c.Q, 'Q' + j);
    if (!Array.isArray(q)) return q;
    Q.push(q);
  }
  const atRest = (s: Sym) => subst(s, (a) => (a.ord >= 1 ? [] : null));
  const T0 = atRest(T);
  const W = sub(P, T0);
  const Qr = Q.map(atRest);
  if (usesTime(W) || Qr.some(usesTime)) return { ok: false, field: 'P', error: 'Π, T или силы явно зависят от времени — положений равновесия (покоя) нет.' };
  if (!W.length && Qr.every((q) => !q.length)) return { ok: false, field: 'P', error: 'Задайте потенциальную энергию Π: по ней ищутся положения равновесия.' };
  const nonPot = Qr.some((q) => q.length > 0);
  // Члены T, линейные по скоростям, — гироскопические.
  const gyro = T.some((t) => t.f.reduce((s, [a, p]) => s + (a.k === 'var' && a.ord === 1 ? p : 0), 0) === 1);
  const F = coords.map((c, j) => add(neg(d(W, { k: 'var', name: c.name, ord: 0 })), Qr[j]));
  if (F.every((f) => !f.length))
    return {
      ok: true,
      ctx,
      W,
      T0,
      F,
      K: F.map(() => F.map(() => [])),
      nonPot,
      gyro,
      points: [],
      mode: coords.length === 1 ? 'scan' : 'newton',
      range: coords.length === 1 ? [pr.eqSearch.from, pr.eqSearch.to] : null,
      failed: false,
      indifferent: true,
    };
  const K = F.map((Fi) => coords.map((c) => neg(d(Fi, { k: 'var', name: c.name, ord: 0 }))));
  const pv = new Map(params.map((p) => [p.name, p.value]));
  const valAt = (q: number[]) => (name: string, ord: number) => {
    const i = ctx.coords.indexOf(name);
    if (i >= 0) return ord === 0 ? q[i] : 0;
    return pv.get(name) ?? NaN;
  };
  const Fv = (q: number[]) => F.map((f) => evalSym(f, valAt(q)));
  const Kv = (q: number[]) => K.map((row) => row.map((k) => evalSym(k, valAt(q))));
  // Матрица инерции (для частот): ∂²T/∂q̇ᵢ∂q̇ⱼ в покое.
  const hasT = [...varsOf(T).values()].some((v) => v.ord === 1);
  const Msym = hasT ? coords.map((ci) => coords.map((cj) => atRest(d(d(T, { k: 'var', name: ci.name, ord: 1 }), { k: 'var', name: cj.name, ord: 1 })))) : null;
  const freq = (q: number[], k: number[][]): number[] | null => {
    if (!Msym) return null;
    const M = Msym.map((row) => row.map((m) => evalSym(m, valAt(q))));
    if (!M.flat().every(Number.isFinite)) return null;
    const w = eigenGeneral(M, k);
    return w.every(Number.isFinite) ? w : null;
  };

  if (coords.length === 1) {
    const { from, to } = pr.eqSearch;
    if (!(to > from)) return { ok: false, field: 'eq', error: 'Отрезок поиска задан неверно: нужно «от» < «до».' };
    const f = (x: number) => Fv([x])[0];
    const xs: number[] = [],
      fs: number[] = [];
    for (let i = 0; i <= N_SCAN; i++) {
      const x = from + ((to - from) * i) / N_SCAN;
      xs.push(x);
      fs.push(f(x));
    }
    const fin = fs.filter(Number.isFinite).map(Math.abs);
    const scale = Math.max(1e-300, ...fin);
    const zeroF = 1e-12 * scale;
    const step = (to - from) / N_SCAN;
    const found: { x: number; kind: 'smooth' | 'kink'; jump: [number, number] | null }[] = [];
    // Корни ближе двух шагов сетки — одно положение (у пологого корня |F| мал в нескольких узлах подряд).
    const push = (x: number, kind: 'smooth' | 'kink', jump: [number, number] | null = null) => {
      if (!found.some((p) => Math.abs(p.x - x) < 2 * step)) found.push({ x, kind, jump });
    };
    /** Уточнение корня-кандидата: минимум |F| на соседних шагах сетки (золотое сечение). */
    const refine = (x: number) => {
      let lo = Math.max(from, x - step),
        hi = Math.min(to, x + step);
      const g = (z: number) => {
        const v = Math.abs(f(z));
        return Number.isFinite(v) ? v : Infinity;
      };
      for (let it = 0; it < 200; it++) {
        const m1 = lo + (hi - lo) * 0.382,
          m2 = lo + (hi - lo) * 0.618;
        if (g(m1) < g(m2)) hi = m2;
        else lo = m1;
      }
      const z = (lo + hi) / 2;
      return g(z) <= g(x) ? z : x;
    };
    for (let i = 0; i < N_SCAN; i++) {
      const a = xs[i],
        b = xs[i + 1],
        fa = fs[i],
        fb = fs[i + 1];
      if (!Number.isFinite(fa) || !Number.isFinite(fb)) continue;
      if (Math.abs(fa) <= zeroF) {
        push(refine(a), 'smooth');
        continue;
      }
      if (fa * fb < 0) {
        let lo = a,
          hi = b,
          flo = fa;
        for (let it = 0; it < 200 && hi - lo > 1e-15 * Math.max(1, Math.abs(lo)); it++) {
          const m = (lo + hi) / 2,
            fm = f(m);
          if (!Number.isFinite(fm)) break;
          if (fm === 0) {
            lo = hi = m;
            break;
          }
          if (Math.sign(fm) === Math.sign(flo)) ((lo = m), (flo = fm));
          else hi = m;
        }
        const fl = f(lo),
          fh = f(hi);
        const big = Math.max(Math.abs(fa), Math.abs(fb));
        if (Math.min(Math.abs(fl), Math.abs(fh)) <= 1e-6 * scale) push((lo + hi) / 2, 'smooth');
        else if (Math.max(Math.abs(fl), Math.abs(fh)) > 10 * big)
          continue; // полюс: |F| растёт неограниченно
        else push((lo + hi) / 2, 'kink', [fl, fh]);
        continue;
      }
      // Касание: локальный минимум |F| без перемены знака.
      if (i > 0 && Number.isFinite(fs[i - 1]) && Math.abs(fa) < Math.abs(fs[i - 1]) && Math.abs(fa) < Math.abs(fb) && Math.sign(fs[i - 1]) === Math.sign(fb)) {
        let lo = xs[i - 1],
          hi = b;
        const g = (x: number) => Math.abs(f(x));
        for (let it = 0; it < 200; it++) {
          const m1 = lo + (hi - lo) * 0.382,
            m2 = lo + (hi - lo) * 0.618;
          if (g(m1) < g(m2)) hi = m2;
          else lo = m1;
        }
        const x = (lo + hi) / 2;
        if (g(x) <= 1e-9 * scale) push(x, 'smooth');
      }
    }
    if (Number.isFinite(fs[N_SCAN]) && Math.abs(fs[N_SCAN]) <= zeroF) push(refine(xs[N_SCAN]), 'smooth');
    found.sort((p, q) => p.x - q.x);
    // Масштаб жёсткости — по всей сетке (для признака «K = 0»).
    const kGrid = xs.map((x) => Math.abs(Kv([x])[0][0])).filter(Number.isFinite);
    const kScale = Math.max(1e-300, ...kGrid);
    const points: EqPoint[] = found.map(({ x, kind, jump }) => {
      if (kind === 'kink') {
        // F слева > 0 и справа < 0 — W убывает, затем растёт: минимум.
        const st = jump![0] > 0 && jump![1] < 0 ? 'stable' : 'unstable';
        return { q: [x], kind, k: [NaN], higher: null, jump, stable: st, w2: null, residual: Math.abs(f(x)) };
      }
      const k = Kv([x])[0][0];
      let higher: EqPoint['higher'] = null;
      let stable: EqPoint['stable'];
      if (Math.abs(k) > 1e-6 * kScale) stable = k > 0 ? 'stable' : 'unstable';
      else {
        // K = 0: вид экстремума — по знакам F по обе стороны (так надёжно для любого порядка касания).
        const h = 1e-3 * (to - from);
        const fl = f(x - h),
          fr = f(x + h);
        const tiny = 1e-14 * scale;
        stable = Math.abs(fl) <= tiny && Math.abs(fr) <= tiny ? 'neutral' : fl > 0 && fr < 0 ? 'stable' : 'unstable';
        // Порядок первой ненулевой производной W: W^(n) = −d^(n−1)F/dq^(n−1); «нуль» — по масштабу этой производной на отрезке.
        let g = K[0][0];
        for (let n = 3; n <= 8 && stable !== 'neutral'; n++) {
          g = d(g, { k: 'var', name: ctx.coords[0], ord: 0 });
          const gs = g;
          const v = evalSym(gs, valAt([x]));
          const sc = Math.max(
            1e-300,
            ...xs
              .filter((_, i) => i % 12 === 0)
              .map((z) => Math.abs(evalSym(gs, valAt([z]))))
              .filter(Number.isFinite),
          );
          if (Number.isFinite(v) && Math.abs(v) > 1e-6 * sc) {
            higher = { order: n, value: v };
            break;
          }
        }
      }
      const w2 = stable === 'stable' && Math.abs(k) > 1e-8 * kScale ? freq([x], [[k]]) : null;
      return { q: [x], kind, k: [k], higher, jump: null, stable, w2, residual: Math.abs(f(x)) };
    });
    return { ok: true, ctx, W, T0, F, K, nonPot, gyro, points, mode: 'scan', range: [from, to], failed: false, indifferent: false };
  }

  // Несколько степеней свободы: метод Ньютона от приближения q*.
  let q = coords.map((c) => c.eq);
  let failed = true;
  const scale0 = Math.max(1e-300, ...Fv(q).map(Math.abs));
  for (let it = 0; it < 100; it++) {
    const fv = Fv(q);
    if (!fv.every(Number.isFinite)) break;
    if (Math.max(...fv.map(Math.abs)) <= 1e-12 * Math.max(1, scale0)) {
      failed = false;
      break;
    }
    const kv = Kv(q);
    const dq = gauss(kv, fv);
    if (!dq.every(Number.isFinite)) break;
    q = q.map((x, i) => x + dq[i]);
  }
  const fv = Fv(q);
  const kv = Kv(q);
  const ev = eigenGeneral(
    coords.map((_, i) => coords.map((__, j) => (i === j ? 1 : 0))),
    kv,
  );
  const kScale = Math.max(1e-300, ...kv.flat().map(Math.abs));
  const stable: EqPoint['stable'] = ev.some((e) => e < -1e-9 * kScale) ? 'unstable' : ev.every((e) => e > 1e-9 * kScale) ? 'stable' : 'neutral';
  const points: EqPoint[] = failed
    ? []
    : [{ q, kind: 'smooth', k: ev, higher: null, jump: null, stable, w2: stable === 'stable' ? freq(q, kv) : null, residual: Math.max(...fv.map(Math.abs)) }];
  return { ok: true, ctx, W, T0, F, K, nonPot, gyro, points, mode: 'newton', range: null, failed, indifferent: false };
}
