/**
 * Обратная задача относительного равновесия (пункт 29; Мещерский 47.17–47.19): при каком значении параметра p
 * (угловой скорости регулятора, жёсткости, веса) заданное положение q* — положение равновесия.
 *
 * Условие равновесия Fⱼ(q*; p) = 0, Fⱼ = −∂W/∂qⱼ + Qⱼ^н, W = Π − T₀ (см. equil.ts). Если p входит в Fⱼ только
 * множителем p^k (как ω² в центробежном потенциале), Fⱼ = A(q) + B(q)·p^k и p^k = −A/B — формула в буквах, корень —
 * p = (−A/B)^(1/k) (при чётном k берётся положительный). Иначе — корни Fⱼ(q*; p) = 0 на отрезке перебором и делением
 * пополам. Для найденного p проверяем: остальные уравнения выполнены (невязка), устойчивость (K = −∂F/∂q в q*),
 * и не равна ли обобщённая сила нулю тождественно по q — тогда при этом p равновесие безразличное в любом положении
 * (47.19).
 */
import { add, div, evalSym, expand, neg, normName, num, subst, type Sym, type Term } from '../../../shared/sym';
import type { EquilResult } from './equil';
import type { LagProblem } from './lagrange';

export interface InverseRoot {
  p: number;
  /** Невязка всех уравнений в q* при найденном p. */
  residual: number;
  /** Собственные значения (одна координата — K) матрицы жёсткости в q*. */
  k: number[];
  stable: 'stable' | 'unstable' | 'neutral';
  /** Обобщённая сила при этом p равна нулю при любом q (проверено на отрезке): безразличное равновесие. */
  anyQ: boolean;
}
export type InverseOut =
  | {
      ok: true;
      param: string;
      q: number[];
      /** Уравнение, по которому ищем p (первое, в которое p входит). */
      j: number;
      /** F_j(q*) с подставленным q* — выражение от параметров. */
      Fq: Sym;
      /** Разложение F_j = A + B·p^k (в буквах, q не подставлено) или null. */
      split: { A: Sym; B: Sym; k: number; rhs: Sym } | null;
      roots: InverseRoot[];
      range: [number, number];
    }
  | { ok: false; error: string };

const N_SCAN = 4000;

/** Разложение s = A + B·p^k по степеням параметра p (p — только множителем верхнего уровня, одна ненулевая степень). */
export function splitPow(s: Sym, p: string): { A: Sym; B: Sym; k: number } | null {
  const e = expand(s);
  const A: Term[] = [],
    B: Term[] = [];
  let k = 0;
  const inside = (t: Term) => t.f.some(([a]) => (a.k === 'fn' || a.k === 'grp') && JSON.stringify(a.a).includes(`"name":"${p}"`));
  for (const t of e) {
    if (inside(t)) return null;
    const hit = t.f.find(([a]) => a.k === 'var' && a.name === p && a.ord === 0);
    if (!hit) {
      A.push(t);
      continue;
    }
    if (k && hit[1] !== k) return null;
    k = hit[1];
    B.push({ c: t.c, f: t.f.filter((x) => x !== hit) });
  }
  if (!k || !B.length) return null;
  return { A: add(A), B: add(B), k };
}

export function findInverse(pr: LagProblem, er: EquilResult): InverseOut | null {
  const inv = pr.inverse;
  if (!inv) return null;
  const pname = normName(inv.param.trim());
  const params = pr.params.map((x) => ({ name: normName(x.name.trim()), value: x.value }));
  if (!params.some((x) => x.name === pname)) return { ok: false, error: `Параметра «${inv.param}» нет в таблице параметров.` };
  if (!(inv.to > inv.from)) return { ok: false, error: 'Отрезок поиска параметра: нужно «от» < «до».' };
  if (er.indifferent) return { ok: false, error: 'Обобщённая сила покоя тождественно равна нулю — любое положение равновесно при любом параметре.' };
  const names = er.ctx.coords;
  const q = pr.coords.map((c) => c.eq);
  const atQ = (s: Sym) =>
    subst(s, (a) => {
      const i = names.indexOf(a.name);
      return i >= 0 && a.ord === 0 ? num(q[i]) : null;
    });
  const pv = new Map(params.map((x) => [x.name, x.value]));
  const val = (qv: number[], p: number) => (name: string, ord: number) => {
    const i = names.indexOf(name);
    if (i >= 0) return ord === 0 ? qv[i] : 0;
    return name === pname ? p : (pv.get(name) ?? NaN);
  };
  const uses = (s: Sym) => JSON.stringify(s).includes(`"name":"${pname}"`);
  const j = er.F.findIndex(uses);
  if (j < 0) return { ok: false, error: `Параметр ${inv.param} не входит в условие равновесия — его не найти по положению.` };
  const Fq = atQ(er.F[j]);
  const sp = splitPow(er.F[j], pname);
  const split = sp ? { ...sp, rhs: div(neg(sp.A), sp.B) } : null;
  const f = (p: number) => evalSym(er.F[j], val(q, p));
  const cands: number[] = [];
  if (split) {
    const r = evalSym(split.rhs, val(q, NaN));
    if (Number.isFinite(r)) {
      const k = split.k;
      if (Number.isInteger(k) && k % 2 === 0) {
        if (r >= 0) cands.push(Math.pow(r, 1 / k));
      } else if (r >= 0 || (Number.isInteger(k) && k % 2 === 1)) cands.push(Math.sign(r) * Math.pow(Math.abs(r), 1 / k));
    }
  } else {
    const { from, to } = inv;
    let x0 = from,
      f0 = f(from);
    for (let i = 1; i <= N_SCAN; i++) {
      const x1 = from + ((to - from) * i) / N_SCAN,
        f1 = f(x1);
      if (Number.isFinite(f0) && Number.isFinite(f1)) {
        if (f0 === 0) cands.push(x0);
        else if (f0 * f1 < 0) {
          let a = x0,
            b = x1,
            fa = f0;
          for (let it = 0; it < 100; it++) {
            const m = (a + b) / 2,
              fm = f(m);
            if (fa * fm <= 0) b = m;
            else {
              a = m;
              fa = fm;
            }
          }
          // Полюс (смена знака через бесконечность) — не корень.
          const m = (a + b) / 2;
          if (Math.abs(f(m)) < 1e-6 * Math.max(1, Math.abs(f0), Math.abs(f1))) cands.push(m);
        }
      }
      x0 = x1;
      f0 = f1;
    }
  }
  const roots: InverseRoot[] = cands
    .filter((p) => (split ? true : p >= inv.from && p <= inv.to))
    .map((p) => {
      const residual = Math.max(...er.F.map((Fi) => Math.abs(evalSym(Fi, val(q, p)))));
      const K = er.K.map((row) => row.map((kk) => evalSym(kk, val(q, p))));
      const scale = Math.max(1e-300, ...K.flat().map(Math.abs));
      const ev = K.length === 1 ? [K[0][0]] : sym2eig(K);
      // Тождественно ли нуль F при этом p: значения на отрезке вокруг q*.
      const lo = pr.eqSearch && names.length === 1 ? pr.eqSearch.from : q[0] - 1,
        hi = pr.eqSearch && names.length === 1 ? pr.eqSearch.to : q[0] + 1;
      let anyQ = true;
      let fScale = 0;
      for (let i = 0; i <= 40 && anyQ; i++) {
        const qq = q.slice();
        qq[0] = lo + ((hi - lo) * i) / 40;
        const vals = er.F.map((Fi) => evalSym(Fi, val(qq, p)));
        // Масштаб — по частям обобщённой силы (каждое слагаемое), чтобы отличить тождественный нуль от малой силы.
        fScale = Math.max(fScale, ...er.F.flatMap((Fi) => Fi.map((t) => Math.abs(evalSym([t], val(qq, p))))));
        if (vals.some((v) => !Number.isFinite(v))) continue;
        if (vals.some((v) => Math.abs(v) > 1e-9 * Math.max(fScale, 1e-300))) anyQ = false;
      }
      const stable: InverseRoot['stable'] = anyQ
        ? 'neutral'
        : ev.some((e) => e < -1e-9 * scale)
          ? 'unstable'
          : ev.every((e) => e > 1e-9 * scale)
            ? 'stable'
            : 'neutral';
      return { p, residual, k: ev, stable, anyQ };
    });
  return { ok: true, param: pname, q, j, Fq, split, roots, range: [inv.from, inv.to] };
}

/** Собственные значения симметричной матрицы 2×2 или 3×3 (Якоби). */
function sym2eig(K: number[][]): number[] {
  const n = K.length;
  const a = K.map((r) => r.slice());
  for (let s = 0; s < 60; s++) {
    let p = 0,
      qn = 1,
      mx = 0;
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++)
        if (Math.abs(a[i][j]) > mx) {
          mx = Math.abs(a[i][j]);
          p = i;
          qn = j;
        }
    if (mx < 1e-14) break;
    const th = 0.5 * Math.atan2(2 * a[p][qn], a[qn][qn] - a[p][p]);
    const c = Math.cos(th),
      sn = Math.sin(th);
    for (let k = 0; k < n; k++) {
      const x = a[k][p],
        y = a[k][qn];
      a[k][p] = c * x - sn * y;
      a[k][qn] = sn * x + c * y;
    }
    for (let k = 0; k < n; k++) {
      const x = a[p][k],
        y = a[qn][k];
      a[p][k] = c * x - sn * y;
      a[qn][k] = sn * x + c * y;
    }
  }
  return a.map((r, i) => r[i]);
}
