/**
 * Пункт 31: равновесие системы при связях (Мещерский 52.7–52.9, 52.12) — множители Лагранжа.
 *
 * Координаты q₁ … qₙ (декартовы координаты точек), потенциальная энергия Π(q) и m связей φₖ(q) = 0. В связи может
 * входить «произвольная функция» f(·, ·): кривая f(x, y) = 0, на которой лежит точка, — f(x1, y1). Тогда:
 *  - уравнения равновесия ∂Π/∂qⱼ + Σλₖ ∂φₖ/∂qⱼ = 0 выводятся в общем виде — частные производные f остаются
 *    буквами ∂f/∂x₁, ∂f/∂y₁ (так дан ответ 52.7);
 *  - при n = m + 1 множители исключаются: ∇Π лежит в линейной оболочке ∇φₖ ⇔ det[∇Π; ∇φ₁; …; ∇φₘ] = 0;
 *  - с конкретной f (поле «f(x, y) =») положения находятся численно: метод Ньютона для системы
 *    ∇Π + Jᵀλ = 0, φ = 0 из многих начальных точек; устойчивость — по второй вариации Π на связях:
 *    Zᵀ(∇²Π + Σλₖ∇²φₖ)Z (Z — базис касательного пространства связей) положительно определена — минимум Π,
 *    положение устойчиво (теорема Лагранжа — Дирихле); есть отрицательное собственное число — не минимум, неустойчиво.
 */
import { add, d, mul, normName, parseSym, prettyName, subst, variable, type Sym } from '../../../shared/sym';
import { gauss } from '../../../shared/gauss';
import { compile, type Num } from './symfn';
import { detSym } from './stability';

export interface ConstrIn {
  coords: string[];
  params: Record<string, number>;
  Pi: string;
  cons: string[];
  /** Кривая f(x, y) — конкретная функция; пусто — f только в общем виде (численного решения нет). */
  fdef: string;
  /** Отбор решений: формулы через «;», каждая должна быть > 0. */
  keep: string;
  /** Область поиска: |qᵢ| ≤ box. */
  box: number;
}
export type Kind = 'stable' | 'unstable' | 'doubtful';
export interface ConstrSol {
  q: number[];
  lam: number[];
  /** Собственные числа второй вариации на связях. */
  eig: number[];
  kind: Kind;
  Pi: number;
}
export interface ConstrOut {
  ok: true;
  names: string[];
  usesF: boolean;
  /** В общем виде (f — буквами): уравнения равновесия и определитель (при n = m + 1). */
  general: { eqs: Sym[]; det: Sym | null; grads: Sym[][]; gradPi: Sym[] };
  /** С конкретной f. */
  concrete: { Pi: Sym; cons: Sym[]; eqs: Sym[]; det: Sym | null } | null;
  sols: ConstrSol[];
  /** Решения, отброшенные условием отбора. */
  dropped: number;
  /** Число свободных координат n − m. */
  dof: number;
  fSym: Sym | null;
}
export type ConstrRes = ConstrOut | { ok: false; error: string };

const PH = 'ϝ';

/** Вызовы f(a, b) в тексте: имя-заглушка и тексты аргументов. */
function splitCalls(src: string): { text: string; calls: [string, string][] } | string {
  const calls: [string, string][] = [];
  let out = '';
  let i = 0;
  while (i < src.length) {
    const prev = i > 0 ? src[i - 1] : ' ';
    if (src[i] === 'f' && !/[\p{L}\p{N}_]/u.test(prev) && /^f\s*\(/.test(src.slice(i))) {
      let j = src.indexOf('(', i) + 1;
      let depth = 1;
      const start = j;
      const commas: number[] = [];
      for (; j < src.length && depth > 0; j++) {
        if (src[j] === '(') depth++;
        else if (src[j] === ')') depth--;
        else if (src[j] === ',' && depth === 1 && !(/[0-9]/.test(src[j - 1]) && /[0-9]/.test(src[j + 1] ?? ''))) commas.push(j);
      }
      if (depth) return 'не хватает закрывающей скобки после f(';
      if (commas.length !== 1) return 'f(·, ·) — два аргумента через запятую с пробелом: f(x1, y1)';
      calls.push([src.slice(start, commas[0]).trim(), src.slice(commas[0] + 1, j - 1).trim()]);
      out += ` ${PH}${calls.length} `;
      i = j;
      continue;
    }
    out += src[i];
    i++;
  }
  return { text: out, calls };
}

function argName(a: Sym, coords: string[]): string | null {
  if (a.length !== 1 || a[0].c !== 1 || a[0].f.length !== 1) return null;
  const [at, p] = a[0].f[0];
  return at.k === 'var' && p === 1 && at.ord === 0 && coords.includes(at.name) ? at.name : null;
}

interface Parsed {
  /** Выражение с заглушками ϝk вместо f(aₖ, bₖ). */
  e: Sym;
  args: [Sym, Sym][];
}

export function solveConstr(pr: ConstrIn): ConstrRes {
  const names = pr.coords.map(normName);
  const pnames = Object.keys(pr.params).map(normName);
  if (pnames.some((p) => names.includes(p))) return { ok: false, error: 'Имя параметра совпадает с координатой.' };
  // Разбор выражений со ссылками на f.
  const parse = (src: string, what: string): Parsed | string => {
    const sp = splitCalls(src);
    if (typeof sp === 'string') return `${what}: ${sp}`;
    const phs = sp.calls.map((_, k) => PH + (k + 1));
    const r = parseSym(sp.text, { coords: names, params: [...pnames, ...phs] });
    if (!r.ok) return `${what}: ${r.error}`;
    const args: [Sym, Sym][] = [];
    for (const [a, b] of sp.calls) {
      const ra = parseSym(a, { coords: names, params: pnames }),
        rb = parseSym(b, { coords: names, params: pnames });
      if (!ra.ok || !rb.ok) return `${what}: аргумент f — ${(!ra.ok ? ra : (rb as { error: string })).error}`;
      args.push([ra.s, rb.s]);
    }
    return { e: r.s, args };
  };
  if (!pr.Pi.trim()) return { ok: false, error: 'Задайте потенциальную энергию Π.' };
  const piP = parse(pr.Pi, 'Π');
  if (typeof piP === 'string') return { ok: false, error: piP };
  const consP: Parsed[] = [];
  for (const [k, c] of pr.cons.entries()) {
    if (!c.trim()) continue;
    const r = parse(c, `связь ${k + 1}`);
    if (typeof r === 'string') return { ok: false, error: r };
    consP.push(r);
  }
  const n = names.length,
    m = consP.length;
  if (m >= n) return { ok: false, error: `Связей (${m}) должно быть меньше, чем координат (${n}).` };
  const usesF = piP.args.length > 0 || consP.some((c) => c.args.length > 0);
  let fSym: Sym | null = null;
  if (pr.fdef.trim()) {
    const r = parseSym(pr.fdef, { coords: ['x', 'y'], params: pnames });
    if (!r.ok) return { ok: false, error: `f(x, y): ${r.error}` };
    fSym = r.s;
  } else if (usesF) fSym = null;

  // Частные производные с f в общем виде: d/dq [e(q, ϝ)] = ∂e/∂q + Σ ∂e/∂ϝₖ·(fₓ(aₖ, bₖ)·∂aₖ/∂q + f_y(aₖ, bₖ)·∂bₖ/∂q).
  const fxName = (a: Sym, b: Sym, k: number, which: 0 | 1): string => {
    const an = argName(a, names),
      bn = argName(b, names);
    if (an && bn) return `∂f/∂${prettyName(which ? bn : an)}`;
    return which ? `f_y(${k})` : `f_x(${k})`;
  };
  const gradGeneral = (p: Parsed): Sym[] =>
    names.map((q) => {
      const parts: Sym[] = [d(p.e, { k: 'var', name: q, ord: 0 })];
      p.args.forEach(([a, b], k) => {
        const de = d(p.e, { k: 'var', name: PH + (k + 1), ord: 0 });
        if (!de.length) return;
        const fx = variable(fxName(a, b, k + 1, 0)),
          fy = variable(fxName(a, b, k + 1, 1));
        parts.push(mul(de, add(mul(fx, d(a, { k: 'var', name: q, ord: 0 })), mul(fy, d(b, { k: 'var', name: q, ord: 0 })))));
      });
      return add(...parts);
    });
  const lam = consP.map((_, k) => variable('λ' + (k + 1)));
  const gPi = gradGeneral(piP);
  const gCons = consP.map(gradGeneral);
  const eqsOf = (gp: Sym[], gc: Sym[][]) => names.map((_, j) => add(gp[j], ...gc.map((g, k) => mul(lam[k], g[j]))));
  const general = { eqs: eqsOf(gPi, gCons), det: n === m + 1 ? detSym([gPi, ...gCons]) : null, grads: gCons, gradPi: gPi };

  // Конкретная f: подстановка.
  const concreteOf = (p: Parsed): Sym | null => {
    if (!p.args.length) return p.e;
    if (!fSym) return null;
    const f = fSym;
    return subst(p.e, (a) => {
      const m2 = a.name.startsWith(PH) ? Number(a.name.slice(PH.length)) : 0;
      if (!m2) return null;
      const [x, y] = p.args[m2 - 1];
      return subst(f, (b) => (b.name === 'x' ? x : b.name === 'y' ? y : null));
    });
  };
  const PiC = concreteOf(piP);
  const consC = consP.map(concreteOf);
  if (!PiC || consC.some((c) => !c)) return { ok: true, names, usesF, general, concrete: null, sols: [], dropped: 0, dof: n - m, fSym };
  const cons = consC as Sym[];
  const dq = (s: Sym, q: string) => d(s, { k: 'var', name: q, ord: 0 });
  const gPiC = names.map((q) => dq(PiC, q));
  const gConsC = cons.map((c) => names.map((q) => dq(c, q)));
  const concrete = { Pi: PiC, cons, eqs: eqsOf(gPiC, gConsC), det: n === m + 1 ? detSym([gPiC, ...gConsC]) : null };

  // Численно.
  const slot = (name: string, ord: number) => {
    if (ord) return -1;
    const i = names.indexOf(name);
    if (i >= 0) return i;
    const j = pnames.indexOf(name);
    return j >= 0 ? n + j : -1;
  };
  const pv = Object.values(pr.params);
  let C: { Pi: Num; g: Num[]; H: Num[][]; c: Num[]; J: Num[][]; Hc: Num[][][] };
  try {
    C = {
      Pi: compile(PiC, slot),
      g: gPiC.map((s) => compile(s, slot)),
      H: gPiC.map((s) => names.map((q) => compile(dq(s, q), slot))),
      c: cons.map((s) => compile(s, slot)),
      J: gConsC.map((r) => r.map((s) => compile(s, slot))),
      Hc: gConsC.map((r) => r.map((s) => names.map((q) => compile(dq(s, q), slot)))),
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const keepF: Num[] = [];
  for (const part of pr.keep.split(';')) {
    if (!part.trim()) continue;
    const r = parseSym(part, { coords: names, params: pnames });
    if (!r.ok) return { ok: false, error: `Условие отбора: ${r.error}` };
    keepF.push(compile(r.s, slot));
  }
  const V = (q: number[]) => [...q, ...pv];
  const resid = (q: number[], l: number[]): number[] => {
    const v = V(q);
    return [...C.g.map((g, j) => g(v, 0) + C.J.reduce((s, row, k) => s + l[k] * row[j](v, 0), 0)), ...C.c.map((c) => c(v, 0))];
  };
  const jac = (q: number[], l: number[]): number[][] => {
    const v = V(q);
    const J = C.J.map((r) => r.map((f) => f(v, 0)));
    const HL = C.H.map((r, i) => r.map((f, j) => f(v, 0) + C.Hc.reduce((s, Hk, k) => s + l[k] * Hk[i][j](v, 0), 0)));
    return [...HL.map((r, i) => [...r, ...J.map((Jr) => Jr[i])]), ...J.map((Jr) => [...Jr, ...Array(m).fill(0)])];
  };
  const norm = (x: number[]) => Math.sqrt(x.reduce((s, y) => s + y * y, 0));
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648) * 2 - 1;
  const box = pr.box > 0 ? pr.box : 1;
  const found: ConstrSol[] = [];
  const droppedQ: number[][] = [];
  for (let s = 0; s < 160; s++) {
    let q = names.map(() => rnd() * box);
    let l: number[] = Array(m).fill(0);
    // Начальные множители — по методу наименьших квадратов.
    if (m) {
      const v = V(q);
      const J = C.J.map((r) => r.map((f) => f(v, 0)));
      const g = C.g.map((f) => f(v, 0));
      const A = J.map((a) => J.map((b) => a.reduce((x, y, i) => x + y * b[i], 0)));
      const b = J.map((a) => -a.reduce((x, y, i) => x + y * g[i], 0));
      const sol = gauss(A, b);
      if (sol.every(Number.isFinite)) l = sol;
    }
    let F = resid(q, l);
    let ok = false;
    for (let it = 0; it < 80; it++) {
      const fn = norm(F);
      if (!Number.isFinite(fn)) break;
      const D = gauss(jac(q, l), F.map((x) => -x));
      if (!D.every(Number.isFinite)) break;
      let a = 1,
        q2 = q,
        l2 = l,
        F2 = F;
      for (let h = 0; h < 30; h++) {
        q2 = q.map((x, i) => x + a * D[i]);
        l2 = l.map((x, k) => x + a * D[n + k]);
        F2 = resid(q2, l2);
        if (norm(F2) < fn || !(fn > 0)) break;
        a /= 2;
      }
      const stepQ = norm(q2.map((x, i) => x - q[i]));
      q = q2;
      l = l2;
      F = F2;
      if (stepQ <= 1e-13 * (1 + norm(q)) || norm(F) < 1e-14) {
        ok = true;
        break;
      }
    }
    if (!ok || !q.every(Number.isFinite) || Math.max(...q.map(Math.abs)) > 10 * box) continue;
    const sc = 1 + Math.max(...C.g.map((g) => Math.abs(g(V(q), 0))));
    if (norm(F) > 1e-8 * sc) continue;
    if (found.some((f) => norm(f.q.map((x, i) => x - q[i])) < 1e-6 * (1 + box))) continue;
    const v = V(q);
    if (keepF.some((k) => !(k(v, 0) > 0))) {
      if (!droppedQ.some((f) => norm(f.map((x, i) => x - q[i])) < 1e-6 * (1 + box))) droppedQ.push(q);
      continue;
    }
    const J = C.J.map((r) => r.map((f) => f(v, 0)));
    const HL = C.H.map((r, i) => r.map((f, j) => f(v, 0) + C.Hc.reduce((s2, Hk, k) => s2 + l[k] * Hk[i][j](v, 0), 0)));
    const Z = nullBasis(J, n);
    const Hr = Z.map((a) => Z.map((b) => a.reduce((s2, ai, i) => s2 + ai * HL[i].reduce((t2, hij, j) => t2 + hij * b[j], 0), 0)));
    const eig = symEig(Hr);
    const scale = Math.max(1e-300, ...HL.flat().map(Math.abs));
    const tol = 1e-9 * scale;
    const kind: Kind = eig.some((e) => e < -tol) ? 'unstable' : eig.every((e) => e > tol) ? 'stable' : 'doubtful';
    found.push({ q, lam: l, eig, kind, Pi: C.Pi(v, 0) });
  }
  const sols = found.sort((a, b) => a.Pi - b.Pi || a.q[0] - b.q[0]);
  return { ok: true, names, usesF, general, concrete, sols, dropped: droppedQ.length, dof: n - m, fSym };
}

/** Ортонормированный базис ядра матрицы J (m×n): дополнение к её строкам. */
export function nullBasis(J: number[][], n: number): number[][] {
  const rows: number[][] = [];
  const orth = (v: number[], basis: number[][]) => {
    let w = v.slice();
    for (const b of basis) {
      const p = w.reduce((s, x, i) => s + x * b[i], 0);
      w = w.map((x, i) => x - p * b[i]);
    }
    return w;
  };
  const len = (v: number[]) => Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  const sc = Math.max(1e-300, ...J.flat().map(Math.abs));
  for (const r of J) {
    const w = orth(r, rows);
    const L = len(w);
    if (L > 1e-10 * sc) rows.push(w.map((x) => x / L));
  }
  const Z: number[][] = [];
  for (let i = 0; i < n && rows.length + Z.length < n; i++) {
    const e = Array.from({ length: n }, (_, j) => (j === i ? 1 : 0));
    const w = orth(orth(e, rows), Z);
    const L = len(w);
    if (L > 1e-8) Z.push(w.map((x) => x / L));
  }
  return Z;
}

/** Собственные числа симметричной матрицы (метод вращений Якоби), по возрастанию. */
export function symEig(A0: number[][]): number[] {
  const n = A0.length;
  const A = A0.map((r) => r.slice());
  for (let sweep = 0; sweep < 60; sweep++) {
    let off = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += A[i][j] ** 2;
    if (off < 1e-30) break;
    for (let p = 0; p < n; p++)
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(A[p][q]) < 1e-300) continue;
        const th = (A[q][q] - A[p][p]) / (2 * A[p][q]);
        const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1));
        const c = 1 / Math.sqrt(t * t + 1),
          s = t * c;
        for (let k = 0; k < n; k++) {
          const akp = A[k][p],
            akq = A[k][q];
          A[k][p] = c * akp - s * akq;
          A[k][q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = A[p][k],
            aqk = A[q][k];
          A[p][k] = c * apk - s * aqk;
          A[q][k] = s * apk + c * aqk;
        }
      }
  }
  return A.map((r, i) => r[i]).sort((a, b) => a - b);
}
