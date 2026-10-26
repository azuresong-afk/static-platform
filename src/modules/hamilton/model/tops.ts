/**
 * Пункт 31: устойчивость вертикального вращения стопки симметричных волчков (Мещерский 55.19).
 *
 * Волчки нумеруются снизу: острие первого — в неподвижном гнезде, острие (i+1)-го — в гнезде на оси i-го на
 * расстоянии hᵢ от острия i-го. У i-го волчка масса Mᵢ, моменты инерции Aᵢ (относительно горизонтальной оси через
 * острие) и Cᵢ (относительно оси симметрии), cᵢ — расстояние от острия до центра тяжести, Ωᵢ — угловая скорость
 * собственного вращения. Малые наклоны оси i-го волчка — комплексная координата ζᵢ = αᵢ + iβᵢ. Острие j-го волчка
 * смещено на rⱼ = Σ_{i<j} hᵢζᵢ, его центр тяжести — на rⱼ + cⱼζⱼ; поэтому
 *   T = ½Σ Mᵢⱼ Re(ζ̇ᵢ*ζ̇ⱼ) + гироскопические члены,  Π = const − ½Σ Kᵢ|ζᵢ|²,
 *   Mᵢᵢ = Aᵢ + hᵢ²·Σ_{k>i}Mₖ,  Mᵢⱼ = hᵢ(Mⱼcⱼ + hⱼ·Σ_{k>j}Mₖ) (i < j),  Kᵢ = g(Mᵢcᵢ + hᵢ·Σ_{k>i}Mₖ),
 * гироскопические силы −iCᵢΩᵢζ̇ᵢ. Уравнения M·ζ̈ − iG·ζ̇ − K·ζ = 0, G = diag(CᵢΩᵢ); при ζ = a·e^{−iλt}
 *   det(λ²M + λG + K) = 0 — уравнение степени 2n с вещественными коэффициентами (как в ответе книги).
 * Консервативная система с гироскопическими силами: движение устойчиво, если все корни λ вещественны и различны
 * (каждому — прецессия с частотой λ); комплексный корень — наклон растёт экспоненциально.
 */
import { add, evalSym, mul, pow, variable, type Sym } from '../../../shared/sym';
import { collect, detSym, LAMBDA, polyRoots } from './stability';

export interface TopIn {
  M: number;
  A: number;
  C: number;
  c: number;
  h: number;
  W: number;
}
export interface TopsIn {
  g: number;
  tops: TopIn[];
}
export type TopsVerdict = 'stable' | 'unstable' | 'boundary';
export interface TopsOut {
  ok: true;
  M: Sym[][];
  G: Sym[];
  K: Sym[];
  /** Коэффициенты уравнения при λ^{2n} … λ⁰ — в буквах и числами. */
  coef: Sym[];
  coefNum: number[];
  roots: [number, number][];
  verdict: TopsVerdict;
  /** Наибольшая мнимая часть корня (мера неустойчивости). */
  im: number;
  /** Ω верхнего волчка, начиная с которой (при остальных данных) движение устойчиво; NaN — не найдено. */
  Wcrit: number;
  scan: { W: number; im: number }[];
}
export type TopsRes = TopsOut | { ok: false; error: string };

const v = (s: string, i: number) => variable(s + (i + 1));

/** Матрицы в буквах для n волчков. */
export function topsLetters(n: number): { M: Sym[][]; G: Sym[]; K: Sym[] } {
  const above = (i: number): Sym => add(...Array.from({ length: n - i - 1 }, (_, k) => v('M', i + 1 + k)));
  const M: Sym[][] = Array.from({ length: n }, () => Array<Sym>(n).fill([]));
  for (let i = 0; i < n; i++) {
    M[i][i] = add(v('A', i), mul(pow(v('h', i), 2), above(i)));
    for (let j = i + 1; j < n; j++) M[i][j] = M[j][i] = mul(v('h', i), add(mul(v('M', j), v('c', j)), mul(v('h', j), above(j))));
  }
  const G = Array.from({ length: n }, (_, i) => mul(v('C', i), v('Ω', i)));
  const K = Array.from({ length: n }, (_, i) => mul(variable('g'), add(mul(v('M', i), v('c', i)), mul(v('h', i), above(i)))));
  return { M, G, K };
}

const classify = (roots: [number, number][]): { verdict: TopsVerdict; im: number } => {
  const sc = Math.max(1, ...roots.map((r) => Math.hypot(r[0], r[1])));
  const im = Math.max(0, ...roots.map((r) => Math.abs(r[1])));
  if (im > 1e-7 * sc) return { verdict: 'unstable', im };
  const re = roots.map((r) => r[0]).sort((a, b) => a - b);
  for (let i = 1; i < re.length; i++) if (re[i] - re[i - 1] < 1e-6 * sc) return { verdict: 'boundary', im };
  return { verdict: 'stable', im };
};

export function solveTops(pr: TopsIn): TopsRes {
  const n = pr.tops.length;
  if (n < 1 || n > 3) return { ok: false, error: 'Волчков — от одного до трёх.' };
  for (const [i, t] of pr.tops.entries()) {
    if (!(t.M > 0 && t.A > 0 && t.C > 0)) return { ok: false, error: `Волчок ${i + 1}: масса и моменты инерции — положительные.` };
    if (!(t.A >= t.M * t.c * t.c - 1e-12)) return { ok: false, error: `Волчок ${i + 1}: момент инерции относительно оси через острие A ≥ M·c² (теорема Штейнера).` };
    if (i < n - 1 && !(t.h > 0)) return { ok: false, error: `Волчок ${i + 1}: расстояние до гнезда следующего h > 0.` };
  }
  const { M, G, K } = topsLetters(n);
  const lam = variable(LAMBDA);
  const D = detSym(M.map((r, i) => r.map((m, j) => add(mul(pow(lam, 2), m), ...(i === j ? [mul(lam, G[i]), K[i]] : [])))));
  const coef = collect(D, 2 * n);
  const valsOf = (W: number) => (name: string): number => {
    if (name === 'g') return pr.g;
    const m = /^(M|A|C|c|h|Ω)(\d)$/u.exec(name);
    if (!m) return NaN;
    const t = pr.tops[Number(m[2]) - 1];
    if (!t) return NaN;
    const k = m[1] === 'Ω' ? 'W' : (m[1] as 'M' | 'A' | 'C' | 'c' | 'h');
    return Number(m[2]) === n && k === 'W' ? W : t[k];
  };
  const at = (W: number) => {
    const c = coef.map((s) => evalSym(s, valsOf(W)));
    const roots = polyRoots(c) as [number, number][];
    return { c, roots, ...classify(roots) };
  };
  const W0 = pr.tops[n - 1].W;
  const base = at(W0);
  // Перебор Ω верхнего волчка: граница — где корни становятся вещественными.
  const Wmax = Math.max(2 * Math.abs(W0), 1);
  const scan = Array.from({ length: 201 }, (_, i) => {
    const W = (Wmax * i) / 200;
    return { W, im: at(W).im };
  });
  let Wcrit = NaN;
  for (let i = scan.length - 1; i > 0; i--) {
    const stableHere = at(scan[i].W).verdict !== 'unstable';
    const stablePrev = at(scan[i - 1].W).verdict !== 'unstable';
    if (!stableHere) break;
    if (stableHere && !stablePrev) {
      let a = scan[i - 1].W,
        b = scan[i].W;
      for (let k = 0; k < 60; k++) {
        const m = (a + b) / 2;
        if (at(m).verdict === 'unstable') a = m;
        else b = m;
      }
      Wcrit = (a + b) / 2;
      break;
    }
  }
  return { ok: true, M, G, K, coef, coefNum: base.c, roots: base.roots, verdict: base.verdict, im: base.im, Wcrit, scan };
}


