/**
 * Уравнение траектории — исключение t (Мещерский §10; Яблонский К.1).
 *
 * Ищется многочлен P(x, y) наименьшей степени (до четвёртой), равный нулю во всех точках траектории: значения
 * одночленов xⁱyʲ в двух сотнях моментов времени образуют матрицу, её нуль-пространство (сингулярное разложение
 * методом Якоби) даёт коэффициенты; найденное уравнение проверяется в других точках. Так находятся прямые, параболы,
 * эллипсы, окружности, гиперболы, фигуры Лиссажу; у циклоиды, спирали, винтовой линии алгебраического уравнения нет.
 * Пространственная траектория описывается уравнениями её проекций на координатные плоскости — цилиндров, на
 * пересечении которых она лежит.
 */
import type { KinProblem, KinResult } from './kin';
import { cartesian, trajInterval } from './kin';

export type Axis = 'x' | 'y' | 'z';
export interface TrajRel {
  /** Переменные: P(a, b) = 0. */
  a: Axis;
  b: Axis;
  deg: number;
  /** Слагаемые c·aⁱ·bʲ (нормированы: первый коэффициент положителен; целые, если это удалось). */
  terms: { i: number; j: number; c: number }[];
  int: boolean;
  /** Уравнение в виде «4x² + 9y − 18 = 0». */
  text: string;
  /** Явный вид «y = …» (если переменная входит линейно). */
  explicit: string | null;
  /** Вид кривой и параметры (для кривых второго порядка — центр, полуоси, радиус). */
  kind: string;
  detail: string | null;
}
export interface TrajEq {
  /** Плоская (z ≡ 0) или пространственная траектория. */
  dims: 2 | 3;
  rels: TrajRel[];
  /** Пары переменных, между которыми алгебраической связи степени ≤ 4 нет. */
  none: [Axis, Axis][];
  /** Начальная точка (t = t₁) и пределы координат на отрезке времени. */
  start: [number, number, number];
  range: [number, number][];
}

const SUP = ['', '', '²', '³', '⁴'];
/** Число: 4 знака после запятой, у малых чисел — 4 значащие цифры. */
const num = (v: number) => {
  const d = v === 0 ? 4 : Math.min(12, Math.max(4, 3 - Math.floor(Math.log10(Math.abs(v)))));
  const s = (+v.toFixed(d)).toString().replace('.', ',');
  return s === '-0' ? '0' : s.replace('-', '−');
};

/** Нуль-вектор матрицы A (N×M) одностороннего метода Якоби; σ_min/σ_max — признак линейной зависимости столбцов. */
function nullVec(A: number[][], M: number): { ratio: number; v: number[] } {
  const N = A.length;
  const U = A.map((row) => row.slice());
  const V: number[][] = Array.from({ length: M }, (_, i) => Array.from({ length: M }, (__, j) => (i === j ? 1 : 0)));
  for (let sweep = 0; sweep < 80; sweep++) {
    let rot = 0;
    for (let p = 0; p < M - 1; p++)
      for (let q = p + 1; q < M; q++) {
        let al = 0,
          be = 0,
          ga = 0;
        for (let i = 0; i < N; i++) {
          al += U[i][p] * U[i][p];
          be += U[i][q] * U[i][q];
          ga += U[i][p] * U[i][q];
        }
        if (Math.abs(ga) <= 1e-15 * Math.sqrt(al * be) || ga === 0) continue;
        rot++;
        const ze = (be - al) / (2 * ga);
        const t = (ze >= 0 ? 1 : -1) / (Math.abs(ze) + Math.sqrt(1 + ze * ze));
        const c = 1 / Math.sqrt(1 + t * t),
          s = c * t;
        for (let i = 0; i < N; i++) {
          const up = U[i][p],
            uq = U[i][q];
          U[i][p] = c * up - s * uq;
          U[i][q] = s * up + c * uq;
        }
        for (let i = 0; i < M; i++) {
          const vp = V[i][p],
            vq = V[i][q];
          V[i][p] = c * vp - s * vq;
          V[i][q] = s * vp + c * vq;
        }
      }
    if (!rot) break;
  }
  const sig = Array.from({ length: M }, (_, k) => Math.sqrt(U.reduce((s, row) => s + row[k] * row[k], 0)));
  let kMin = 0;
  for (let k = 1; k < M; k++) if (sig[k] < sig[kMin]) kMin = k;
  const sMax = Math.max(...sig);
  return { ratio: sMax > 0 ? sig[kMin] / sMax : 1, v: V.map((row) => row[kMin]) };
}

/** Рациональное приближение p/q (цепная дробь, q ≤ qMax). */
function rational(x: number, qMax: number, tol: number): [number, number] | null {
  let h0 = 1,
    h1 = 0,
    k0 = 0,
    k1 = 1,
    b = x;
  for (let it = 0; it < 40; it++) {
    const a = Math.floor(b);
    [h0, h1] = [a * h0 + h1, h0];
    [k0, k1] = [a * k0 + k1, k0];
    if (k0 > qMax) return null;
    if (Math.abs(h0 / k0 - x) <= tol) return [h0, k0];
    const fr = b - a;
    if (Math.abs(fr) < 1e-15) break;
    b = 1 / fr;
  }
  return Math.abs(h0 / k0 - x) <= tol ? [h0, k0] : null;
}
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));

/** Целые коэффициенты (если все отношения — простые дроби). */
function integerize(c: number[]): number[] | null {
  const nz = c.filter((v) => v !== 0);
  const order = nz.slice().sort((p, q) => Math.abs(p) - Math.abs(q));
  for (const piv of order) {
    const r = c.map((v) => v / piv);
    let L = 1,
      ok = true;
    for (const v of r) {
      if (v === 0) continue;
      const pq = rational(v, 1000, 1e-9 * Math.max(1, Math.abs(v)));
      if (!pq) {
        ok = false;
        break;
      }
      L = (L * pq[1]) / gcd(L, pq[1]);
      if (L > 1e5) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    const ints = r.map((v) => Math.round(v * L));
    if (ints.some((v, k) => Math.abs(v - r[k] * L) > 1e-6 * Math.max(1, Math.abs(v)))) continue;
    const g = ints.reduce((s, v) => gcd(s, v), 0) || 1;
    return ints.map((v) => v / g);
  }
  return null;
}

const mono = (a: Axis, b: Axis, i: number, j: number) => (i ? a + SUP[i] : '') + (j ? b + SUP[j] : '');

/** «c·xⁱyʲ + …» с правильными знаками; коэффициент 1 не пишется. */
function poly(terms: { c: number; m: string }[]): string {
  const out: string[] = [];
  terms.forEach(({ c, m }, k) => {
    const abs = Math.abs(c);
    const cs = m && Math.abs(abs - 1) < 1e-12 ? '' : num(abs);
    const body = cs + m || '0';
    out.push(k === 0 ? (c < 0 ? '−' : '') + body : (c < 0 ? ' − ' : ' + ') + body);
  });
  return out.join('') || '0';
}

/** Связь P(a, b) = 0 по точкам; null — алгебраической связи степени ≤ maxDeg нет. */
export function implicit(A: number[], B: number[], a: Axis, b: Axis, check: [number, number][], maxDeg = 4): TrajRel | null {
  const n = A.length;
  const rng = (v: number[]) => Math.max(...v) - Math.min(...v);
  const big = (v: number[]) => Math.max(1e-300, ...v.map(Math.abs));
  // Постоянная координата: a = const или b = const.
  for (const [vals, name] of [
    [A, a],
    [B, b],
  ] as const)
    if (rng(vals) <= 1e-10 * Math.max(1, big(vals))) {
      const c0 = vals.reduce((s, v) => s + v, 0) / n;
      const terms = [
        { i: name === a ? 1 : 0, j: name === b ? 1 : 0, c: 1 },
        { i: 0, j: 0, c: -c0 },
      ].filter((t) => t.c !== 0);
      return { a, b, deg: 1, terms, int: Number.isInteger(c0), text: `${name} = ${num(c0)}`, explicit: `${name} = ${num(c0)}`, kind: 'прямая', detail: null };
    }
  const Sa = big(A),
    Sb = big(B);
  for (let d = 1; d <= maxDeg; d++) {
    const monos: [number, number][] = [];
    for (let s = d; s >= 0; s--) for (let i = s; i >= 0; i--) monos.push([i, s - i]);
    const M = monos.length;
    if (n < 3 * M) return null;
    const rows = A.map((x, k) => monos.map(([i, j]) => (x / Sa) ** i * (B[k] / Sb) ** j));
    const norms = monos.map((_, c) => Math.sqrt(rows.reduce((s, r) => s + r[c] * r[c], 0)) || 1);
    const scaled = rows.map((r) => r.map((v, c) => v / norms[c]));
    const { ratio, v } = nullVec(scaled, M);
    if (!(ratio < 1e-9)) continue;
    // Коэффициенты в исходных единицах.
    let c = v.map((w, k) => w / norms[k] / Sa ** monos[k][0] / Sb ** monos[k][1]);
    // Пренебрежимо малые слагаемые (по величине на траектории) — нули.
    const mag = monos.map(([i, j], k) => Math.max(...A.map((x, q) => Math.abs(c[k] * x ** i * B[q] ** j))));
    const mMax = Math.max(...mag);
    c = c.map((x, k) => (mag[k] < 1e-9 * mMax ? 0 : x));
    // Проверка в других точках.
    const okCheck = check.every(([x, y]) => {
      const terms = monos.map(([i, j], k) => c[k] * x ** i * y ** j);
      const sumAbs = terms.reduce((s, t) => s + Math.abs(t), 0);
      return Math.abs(terms.reduce((s, t) => s + t, 0)) <= 1e-7 * Math.max(sumAbs, 1e-300);
    });
    if (!okCheck) continue;
    const ints = integerize(c);
    const first = c.find((x) => x !== 0)!;
    const cc = ints ?? c.map((x) => x / first);
    const sgn = Math.sign(cc.find((x) => x !== 0)!);
    const terms = monos.map(([i, j], k) => ({ i, j, c: cc[k] * sgn })).filter((t) => t.c !== 0);
    const deg = Math.max(...terms.map((t) => t.i + t.j));
    const text = `${poly(terms.map((t) => ({ c: t.c, m: mono(a, b, t.i, t.j) })))} = 0`;
    return { a, b, deg, terms, int: !!ints, text, explicit: explicitOf(a, b, terms), ...conic(a, b, terms, deg) };
  }
  return null;
}

/** Явный вид, если одна из переменных входит только в первой степени с постоянным коэффициентом. */
function explicitOf(a: Axis, b: Axis, terms: TrajRel['terms']): string | null {
  for (const [lin, isA] of [
    [b, false],
    [a, true],
  ] as const) {
    const withLin = terms.filter((t) => (isA ? t.i : t.j) > 0);
    if (withLin.length !== 1) continue;
    const t0 = withLin[0];
    if ((isA ? t0.i : t0.j) !== 1 || (isA ? t0.j : t0.i) !== 0) continue;
    const rest = terms.filter((t) => t !== t0).map((t) => ({ c: -t.c / t0.c, m: mono(a, b, t.i, t.j) }));
    return `${lin} = ${poly(rest)}`;
  }
  return null;
}

/** Вид кривой; для кривых второго порядка — центр, полуоси или радиус. */
function conic(a: Axis, b: Axis, terms: TrajRel['terms'], deg: number): { kind: string; detail: string | null } {
  if (deg === 1) return { kind: 'прямая', detail: null };
  if (deg > 2) return { kind: `алгебраическая кривая ${deg}-го порядка`, detail: null };
  const g = (i: number, j: number) => terms.find((t) => t.i === i && t.j === j)?.c ?? 0;
  const A = g(2, 0),
    B = g(1, 1),
    C = g(0, 2),
    D = g(1, 0),
    E = g(0, 1),
    F = g(0, 0);
  const disc = B * B - 4 * A * C;
  const sc = Math.max(Math.abs(A), Math.abs(B), Math.abs(C));
  if (Math.abs(disc) <= 1e-12 * sc * sc) return { kind: 'парабола', detail: null };
  // Центр: ∂P/∂a = ∂P/∂b = 0.
  const x0 = (B * E - 2 * C * D) / -disc,
    y0 = (B * D - 2 * A * E) / -disc;
  const K = -(A * x0 * x0 + B * x0 * y0 + C * y0 * y0 + D * x0 + E * y0 + F);
  const sh = (v: Axis, c0: number) => (Math.abs(c0) < 1e-12 ? v : `(${v} ${c0 > 0 ? '−' : '+'} ${num(Math.abs(c0))})`);
  const centre = `центр (${num(x0)}; ${num(y0)})`;
  if (Math.abs(B) > 1e-12 * sc) return { kind: disc < 0 ? 'эллипс' : 'гипербола', detail: `${centre}, оси повёрнуты относительно осей координат` };
  if (Math.abs(K) <= 1e-12 * sc) return { kind: disc < 0 ? 'точка' : 'пара прямых', detail: centre };
  const p = K / A,
    q = K / C;
  if (disc < 0 && p > 0 && q > 0) {
    if (Math.abs(p - q) <= 1e-9 * p)
      return { kind: 'окружность', detail: `${sh(a, x0)}² + ${sh(b, y0)}² = ${num(p)};  ${centre}, радиус ${num(Math.sqrt(p))}` };
    return { kind: 'эллипс', detail: `${sh(a, x0)}²/${num(p)} + ${sh(b, y0)}²/${num(q)} = 1;  ${centre}, полуоси ${num(Math.sqrt(p))} и ${num(Math.sqrt(q))}` };
  }
  if (disc > 0)
    return {
      kind: 'гипербола',
      detail: `${p > 0 ? `${sh(a, x0)}²/${num(p)} − ${sh(b, y0)}²/${num(-q)}` : `${sh(b, y0)}²/${num(q)} − ${sh(a, x0)}²/${num(-p)}`} = 1;  ${centre}`,
    };
  return { kind: 'пустое множество', detail: null };
}

/** Уравнение траектории по закону движения (координатный, полярный, цилиндрический, сферический способы). */
export function trajEquation(pr: KinProblem, r: KinResult): TrajEq | null {
  if (!r.ok || pr.mode === 'natural' || pr.mode === 'uni') return null;
  const [ta, tb] = trajInterval(pr);
  const L = Math.max(tb - ta, 1e-6);
  // Отбор точек — на расширенном отрезке (уравнение верно при всех t), проверка — в других точках.
  const sample = (n: number, shift: number): [number, number, number][] => {
    const out: [number, number, number][] = [];
    for (let k = 0; k < n; k++) {
      const p = cartesian(pr, r, ta - L + (3 * L * (k + shift)) / n);
      if (p.every(Number.isFinite)) out.push(p);
    }
    return out;
  };
  const pts = sample(240, 0),
    chk = sample(37, 0.37);
  if (pts.length < 60) return null;
  const inner: [number, number, number][] = [];
  for (let k = 0; k <= 200; k++) {
    const p = cartesian(pr, r, ta + (L * k) / 200);
    if (p.every(Number.isFinite)) inner.push(p);
  }
  const range = [0, 1, 2].map((i) => [Math.min(...inner.map((p) => p[i])), Math.max(...inner.map((p) => p[i]))] as [number, number]);
  const start = cartesian(pr, r, ta);
  const flat = pts.every((p) => Math.abs(p[2]) <= 1e-12 * Math.max(1, Math.abs(p[0]), Math.abs(p[1])));
  const pairs: [Axis, Axis][] = flat
    ? [['x', 'y']]
    : [
        ['x', 'y'],
        ['x', 'z'],
        ['y', 'z'],
      ];
  const ix = { x: 0, y: 1, z: 2 };
  const rels: TrajRel[] = [],
    none: [Axis, Axis][] = [];
  for (const [a, b] of pairs) {
    const rel = implicit(
      pts.map((p) => p[ix[a]]),
      pts.map((p) => p[ix[b]]),
      a,
      b,
      chk.map((p) => [p[ix[a]], p[ix[b]]]),
    );
    if (rel) rels.push(rel);
    else none.push([a, b]);
  }
  return { dims: flat ? 2 : 3, rels, none, start, range };
}
