/**
 * Поиск положения равновесия (пункт 17): неизвестен параметр положения p (угол, длина, коэффициент), а поля
 * конструкции заданы формулами от него (model/search.ts).
 *
 * Без трения. Неизвестных реакций на одно меньше, чем независимых уравнений равновесия: система A(p)·x = b(p)
 * переопределена и совместна только при особых p. Берём по каждому телу уравнения ΣX, ΣY и одно уравнение
 * моментов, отбрасываем строки, тождественно равные нулю, и ищем нули определителя D(p) = det[A | b] (строки
 * нормированы — знак D от этого не меняется): по смене знака на сетке, затем делением отрезка пополам. Каждый
 * корень проверяется полным решением: реакции односторонних связей не отрицательны, система не изменяема.
 * Устойчивость — по обобщённой силе Q(p) = Σ F·dr/dp известных сил (если p — координата движения, в положении
 * равновесия Q = 0): dQ/dp < 0 — устойчиво (потенциальная энергия минимальна), > 0 — неустойчиво.
 *
 * С трением и односторонними связями. Для каждого p проверяется, возможно ли равновесие (линейное
 * программирование, solver/friction.ts); ищутся промежутки, где оно возможно, и их границы — предельные положения.
 */
import { compileSearch, instantiate, type CompiledBind } from '../model/search';
import type { Structure } from '../model/types';
import { buildModel, type Model } from './model';
import { frictionFeasible, isFrictionModel } from './friction';
import { rankOf } from '../../../shared/rank';

export interface SearchPoint {
  p: number;
  /** root — корень уравнения (без трения), bound — граница промежутка, где равновесие возможно (с трением). */
  kind: 'root' | 'bound';
  /** Корень подходит: реакции односторонних связей не отрицательны, система не изменяема. */
  ok: boolean;
  /** Почему корень не подходит (заполняет analyze по полному решению). */
  why?: string;
  /** Устойчивость: true — устойчиво, false — неустойчиво, null — безразлично, undefined — не определяется. */
  stable?: boolean | null;
  /** Обобщённая сила и её производная в положении равновесия (для текста решения). */
  dQ?: number;
}

export interface SearchResult {
  mode: 'exact' | 'friction';
  errors: string[];
  fns: CompiledBind[];
  points: SearchPoint[];
  /** С трением: промежутки параметра, где равновесие возможно. */
  ranges: [number, number][];
  /** Без трения: число неизвестных и независимых уравнений (после отбрасывания нулевых строк). */
  n?: number;
  eqs?: number;
}

const GRID = 600;

/** Строки системы по каждому телу: ΣX, ΣY и одно уравнение моментов (у тела-точки — только проекции). */
function basicRows(m: Model): number[][] {
  const keys = m.unknowns.map((u) => u.key);
  const rows: number[][] = [];
  for (let p = 0; p < m.parts.count; p++) {
    const own = m.cands.filter((e) => (m.parts.count === 1 ? e.part == null : e.part === p));
    const pick = [own.find((e) => e.type === 'x'), own.find((e) => e.type === 'y')];
    if (!(p in m.parts.points)) pick.push(own.find((e) => e.type === 'm'));
    for (const e of pick) if (e) rows.push([...keys.map((k) => e.coeffs[k] || 0), e.cst]);
  }
  return rows;
}

/** Определитель квадратной матрицы (Гаусс с выбором главного элемента). */
function det(A0: number[][]): number {
  const A = A0.map((r) => [...r]),
    n = A.length;
  let d = 1;
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    if (Math.abs(A[p][c]) < 1e-300) return 0;
    if (p !== c) {
      [A[c], A[p]] = [A[p], A[c]];
      d = -d;
    }
    d *= A[c][c];
    for (let r = c + 1; r < n; r++) {
      const f = A[r][c] / A[c][c];
      for (let k = c; k < n; k++) A[r][k] -= f * A[c][k];
    }
  }
  return d;
}

/** Обобщённая сила известных нагрузок: Σ F·dr/dp (пары сил не учитываются — у них нет точки, которая движется). */
export function genForce(at: (p: number) => Model | null, p: number, h: number): { Q: number; scale: number; couples: boolean } | null {
  const m0 = at(p),
    m1 = at(p + h),
    m2 = at(p - h);
  if (!m0 || !m1 || !m2 || m1.knowns.length !== m0.knowns.length || m2.knowns.length !== m0.knowns.length) return null;
  let Q = 0,
    scale = 0,
    couples = false;
  m0.knowns.forEach((a, i) => {
    if (a.kind === 'm') {
      if (Math.abs(a.val) > 1e-12) couples = true;
      return;
    }
    // Координаты чертежа сдвинуты к началу габарита; отсчитываем их от первой точки (она неподвижна).
    const o1 = m1.g.pos[m1.g.order[0]],
      o2 = m2.g.pos[m2.g.order[0]];
    const vx = (m1.knowns[i].x - o1[0] - (m2.knowns[i].x - o2[0])) / (2 * h),
      vy = (m1.knowns[i].y - o1[1] - (m2.knowns[i].y - o2[1])) / (2 * h);
    Q += a.val * (a.dx * vx + a.dy * vy);
    scale += Math.abs(a.val) * Math.hypot(vx, vy);
  });
  return { Q, scale, couples };
}

export function searchPositions(s: Structure): SearchResult {
  const sr = s.search!;
  const out: SearchResult = { mode: 'exact', errors: [], fns: [], points: [], ranges: [] };
  const c = compileSearch(s, sr);
  if (!c.ok) return { ...out, errors: c.errors };
  out.fns = c.fns;
  if (!c.fns.length) return { ...out, errors: ['Задайте хотя бы одно поле формулой от параметра.'] };
  const cache = new Map<number, Model | null>();
  const at = (p: number): Model | null => {
    if (cache.has(p)) return cache.get(p)!;
    const s2 = instantiate(s, c.fns, p);
    let m: Model | null = null;
    if (s2)
      try {
        m = buildModel(s2);
      } catch {
        m = null;
      }
    if (cache.size > 5000) cache.clear();
    cache.set(p, m);
    return m;
  };
  const { min, max } = sr;
  const grid = Array.from({ length: GRID + 1 }, (_, i) => min + ((max - min) * i) / GRID);
  const models = grid.map(at);
  const ref = models.find((m) => m) ?? null;
  if (!ref) return { ...out, errors: ['При всех значениях параметра из промежутка схема не строится (длины не положительны или формулы не вычисляются).'] };
  if (s.items.some((it) => it.type === 'pin' && it.fr))
    return { ...out, errors: ['Поиск положения с трением в шарнирах не выполняется: уберите трение в шарнире или поиск.'] };
  const tol = (max - min) * 1e-10;

  if (isFrictionModel(ref)) {
    out.mode = 'friction';
    if (ref.unkLoads.length)
      return { ...out, errors: ['С трением ищутся положения, в которых равновесие возможно, — искомых нагрузок быть не должно: задайте нагрузки числами.'] };
    const feas = (p: number) => {
      const m = at(p);
      return !!m && frictionFeasible(m);
    };
    const f = grid.map(feas);
    const edge = (a: number, b: number, fa: boolean) => {
      for (let i = 0; i < 80 && b - a > tol; i++) {
        const mid = (a + b) / 2;
        if (feas(mid) === fa) a = mid;
        else b = mid;
      }
      return fa ? a : b;
    };
    let start: number | null = f[0] ? min : null;
    for (let i = 1; i <= GRID; i++) {
      if (f[i] === f[i - 1]) continue;
      const x = edge(grid[i - 1], grid[i], f[i - 1]);
      out.points.push({ p: x, kind: 'bound', ok: true });
      if (f[i]) start = x;
      else if (start != null) {
        out.ranges.push([start, x]);
        start = null;
      }
    }
    if (start != null) out.ranges.push([start, max]);
    return out;
  }

  // Без трения: нули определителя D(p).
  const n = ref.unknowns.length;
  // Независимые строки выбираем при «общем» значении параметра (не на сетке, чтобы не попасть в корень): строки,
  // тождественно равные нулю или зависимые (например, ΣX для груза на нити), отбрасываем.
  const pg = [0.381966, 0.618034, 0.2763932].map((t) => min + (max - min) * t).find((p) => at(p)?.unknowns.length === n);
  const base = pg != null ? basicRows(at(pg)!) : null;
  const live: number[] = [];
  if (base) {
    const kept: number[][] = [];
    base.forEach((r, j) => {
      if (rankOf([...kept, r]) > kept.length) {
        kept.push(r);
        live.push(j);
      }
    });
  }
  const eqs = live.length;
  // Масштаб строк — по «общему» значению параметра (постоянный, чтобы D(p) оставался непрерывным).
  const scale = live.map((j) => Math.hypot(...base![j]) || 1);
  out.n = n;
  out.eqs = eqs;
  if (eqs !== n + 1)
    return {
      ...out,
      errors: [
        eqs <= n
          ? `Независимых уравнений (${eqs}) не больше, чем неизвестных (${n}): равновесие возможно при любом значении параметра или система изменяема — параметр так не найти. Уберите лишнюю связь или искомую нагрузку.`
          : `Независимых уравнений (${eqs}) больше, чем неизвестных (${n}), на ${eqs - n}: один параметр положения их не уравновесит. Добавьте связь или сделайте нагрузку искомой.`,
      ],
    };
  const D = (p: number): number => {
    const m = at(p);
    if (!m || m.unknowns.length !== n) return NaN;
    const all = basicRows(m);
    const rows = live.map((j) => all[j]).filter(Boolean);
    if (rows.length !== n + 1) return NaN;
    return det(rows.map((r, i) => r.map((v) => v / scale[i])));
  };
  const d = grid.map(D);
  const roots: number[] = [];
  const add = (x: number) => {
    if (!roots.some((r) => Math.abs(r - x) < (max - min) * 1e-6)) roots.push(x);
  };
  for (let i = 0; i <= GRID; i++) {
    if (!Number.isFinite(d[i])) continue;
    if (Math.abs(d[i]) < 1e-12) {
      add(grid[i]);
      continue;
    }
    if (i > 0 && Number.isFinite(d[i - 1]) && Math.abs(d[i - 1]) >= 1e-12 && Math.sign(d[i]) !== Math.sign(d[i - 1])) {
      let a = grid[i - 1],
        b = grid[i],
        fa = d[i - 1];
      for (let k = 0; k < 100 && b - a > tol; k++) {
        const mid = (a + b) / 2,
          fm = D(mid);
        if (!Number.isFinite(fm)) break;
        if (Math.sign(fm) === Math.sign(fa)) {
          a = mid;
          fa = fm;
        } else b = mid;
      }
      const x = (a + b) / 2;
      // Смена знака через разрыв (не через нуль) — не корень.
      const fx = Math.abs(D(x));
      if (fx < 1e-6 * Math.max(Math.abs(d[i - 1]), Math.abs(d[i]), 1e-3)) add(x);
    }
    // Касание нуля без смены знака: локальный минимум |D|, близкий к нулю.
    if (
      i > 0 &&
      i < GRID &&
      Number.isFinite(d[i - 1]) &&
      Number.isFinite(d[i + 1]) &&
      Math.abs(d[i]) < Math.abs(d[i - 1]) &&
      Math.abs(d[i]) < Math.abs(d[i + 1]) &&
      Math.sign(d[i - 1]) === Math.sign(d[i + 1])
    ) {
      let a = grid[i - 1],
        b = grid[i + 1];
      for (let k = 0; k < 100 && b - a > tol; k++) {
        const m1 = a + (b - a) / 3,
          m2 = b - (b - a) / 3;
        if (Math.abs(D(m1)) < Math.abs(D(m2))) b = m2;
        else a = m1;
      }
      const x = (a + b) / 2;
      if (Math.abs(D(x)) < 1e-9) add(x);
    }
  }
  roots.sort((a, b) => a - b);
  const h = (max - min) * 1e-5;
  for (const p of roots) {
    const pt: SearchPoint = { p, kind: 'root', ok: true };
    const g0 = genForce(at, p, h);
    if (g0 && !g0.couples && g0.scale > 1e-12 && Math.abs(g0.Q) < 1e-5 * g0.scale) {
      const g1 = genForce(at, p + h, h),
        g2 = genForce(at, p - h, h);
      if (g1 && g2) {
        const dQ = (g1.Q - g2.Q) / (2 * h);
        pt.dQ = dQ;
        pt.stable = Math.abs(dQ) * (max - min) < 1e-6 * g0.scale ? null : dQ < 0;
      }
    }
    out.points.push(pt);
  }
  return out;
}
