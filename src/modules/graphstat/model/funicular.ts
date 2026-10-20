/**
 * Силовой и верёвочный многоугольники (Мещерский §5).
 *
 * Балка (твёрдое тело) с шарниром A и катком B (направление реакции R_B известно), нагрузки — сосредоточенные силы
 * в точках оси балки. Построение:
 *  1. силовой многоугольник нагрузок P₀P₁…Pₙ (Pₖ = Pₖ₋₁ + Fₖ), произвольный полюс O;
 *  2. верёвочный многоугольник: сторона s₀ идёт из точки A параллельно OP₀, сторона sₖ — параллельно OPₖ из точки на линии
 *     силы Fₖ (где пересеклись sₖ₋₁ и линия Fₖ); последняя сторона sₙ пересекает линию действия R_B в точке K;
 *  3. замыкающая AK; луч из полюса параллельно AK пересекает прямую, проведённую из Pₙ параллельно R_B, в точке Q:
 *     R_B = Q − Pₙ (вектор силы, действующей на балку), R_A = P₀ − Q.
 * Цепь (цепной мост): равномерная нагрузка q на пролёте L заменяется n равными силами в серединах участков; полюсное расстояние
 * H (горизонтальная составляющая натяжения) находят из условия: стрела провисания в середине пролёта равна f.
 * H = M(L/2)/f, для равномерной нагрузки M(L/2) = qL²/8, поэтому H = qL²/(8f); натяжение в середине T = H, у опор
 * T = √(H² + (qL/2)²). Если нагрузка поровну воспринимается k цепями, на одну цепь приходится q/k.
 */
export type V2 = [number, number];

export interface BeamLoad {
  /** Абсцисса точки приложения на оси балки. */
  x: number;
  /** Модуль силы и угол к оси x, град (270 — вниз). */
  F: number;
  angle: number;
}

export interface FunicularInput {
  /** Шарнир A и каток B на оси балки (y = 0). */
  xA: number;
  xB: number;
  /** Направление реакции катка к оси x, град (90 — вверх). */
  angleB: number;
  loads: BeamLoad[];
  /** Полюсное расстояние H: масштаб силового многоугольника по x; 0 или не задано — выбирается само. */
  pole?: number;
}

export interface FunicularResult {
  ok: boolean;
  error?: string;
  /** Вершины силового многоугольника P₀…Pₙ (n — число нагрузок). */
  P: V2[];
  /** Полюс O и точка Q (конец вектора R_B). */
  O: V2;
  Q: V2;
  /** Вершины верёвочного многоугольника: A, V₁…Vₙ, K. */
  V: V2[];
  /** Реакции, действующие на балку: векторы. */
  RA: V2;
  RB: V2;
  /** Реакции из уравнений равновесия (проверка). */
  RAeq: V2;
  RBeq: V2;
  /** Наибольшее расхождение графического решения с аналитическим. */
  maxErr: number;
}

const rad = (a: number) => (a * Math.PI) / 180;
export const unit = (a: number): V2 => [Math.cos(rad(a)), Math.sin(rad(a))];
const cleanV = (v: V2): V2 => [Math.abs(v[0]) < 1e-12 ? 0 : v[0], Math.abs(v[1]) < 1e-12 ? 0 : v[1]];
const cross = (a: V2, b: V2) => a[0] * b[1] - a[1] * b[0];

/** Пересечение прямых p + s·a и q + r·b; null, если параллельны. */
export function lineCross(p: V2, a: V2, q: V2, b: V2): V2 | null {
  const den = cross(a, b);
  if (Math.abs(den) < 1e-12 * Math.max(1, Math.hypot(...a) * Math.hypot(...b))) return null;
  const s = cross([q[0] - p[0], q[1] - p[1]], b) / den;
  return [p[0] + s * a[0], p[1] + s * a[1]];
}

/** Реакции из уравнений равновесия: ΣM_A = 0 даёт R_B, затем X_A, Y_A. */
export function beamEquilibrium(inp: FunicularInput): { RA: V2; RB: V2 } | null {
  const u = unit(inp.angleB);
  // Момент R_B относительно A: (xB − xA)·u_y·R (сила приложена на оси).
  const arm = (inp.xB - inp.xA) * u[1];
  if (Math.abs(arm) < 1e-12) return null;
  let mom = 0;
  let sx = 0,
    sy = 0;
  for (const l of inp.loads) {
    const [ux, uy] = unit(l.angle);
    mom += (l.x - inp.xA) * l.F * uy;
    sx += l.F * ux;
    sy += l.F * uy;
  }
  const R = -mom / arm;
  const RB: V2 = [R * u[0], R * u[1]];
  return { RB: cleanV(RB), RA: cleanV([-sx - RB[0], -sy - RB[1]]) };
}

export function funicular(inp: FunicularInput): FunicularResult {
  const nil: FunicularResult = { ok: false, P: [], O: [0, 0], Q: [0, 0], V: [], RA: [0, 0], RB: [0, 0], RAeq: [0, 0], RBeq: [0, 0], maxErr: 0 };
  const loads = inp.loads.filter((l) => Math.abs(l.F) > 1e-12);
  if (!loads.length) return { ...nil, error: 'Нагрузок нет.' };
  if (Math.abs(inp.xB - inp.xA) < 1e-9) return { ...nil, error: 'Опоры A и B совпадают.' };
  const eq = beamEquilibrium(inp);
  if (!eq) return { ...nil, error: 'Реакция катка идёт вдоль оси балки: момент относительно A не уравновесить.' };
  const P: V2[] = [[0, 0]];
  for (const l of loads) {
    const [ux, uy] = unit(l.angle);
    const p = P[P.length - 1];
    P.push([p[0] + l.F * ux, p[1] + l.F * uy]);
  }
  const xs = P.map((p) => p[0]),
    ys = P.map((p) => p[1]);
  const ext = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 1e-9);
  const H = inp.pole && inp.pole > 0 ? inp.pole : 1.2 * ext;
  const O: V2 = [Math.min(...xs) - H, (Math.max(...ys) + Math.min(...ys)) / 2];
  const A: V2 = [inp.xA, 0];
  const V: V2[] = [A];
  for (let k = 1; k <= loads.length; k++) {
    const d: V2 = [P[k - 1][0] - O[0], P[k - 1][1] - O[1]];
    const Vk = lineCross(V[k - 1], d, [loads[k - 1].x, 0], unit(loads[k - 1].angle));
    if (!Vk) return { ...nil, P, O, V, error: `Сторона верёвочного многоугольника параллельна линии силы ${k}: сдвиньте полюс.` };
    V.push(Vk);
  }
  const uB = unit(inp.angleB);
  const dn: V2 = [P[loads.length][0] - O[0], P[loads.length][1] - O[1]];
  const K = lineCross(V[loads.length], dn, [inp.xB, 0], uB);
  if (!K) return { ...nil, P, O, V, error: 'Последняя сторона параллельна линии реакции катка: сдвиньте полюс.' };
  V.push(K);
  const close: V2 = [K[0] - A[0], K[1] - A[1]];
  const Q = lineCross(O, close, P[loads.length], uB);
  if (!Q) return { ...nil, P, O, V, error: 'Замыкающая параллельна реакции катка: сдвиньте полюс.' };
  const RB = cleanV([Q[0] - P[loads.length][0], Q[1] - P[loads.length][1]]);
  const RA = cleanV([P[0][0] - Q[0], P[0][1] - Q[1]]);
  const maxErr = Math.max(Math.abs(RB[0] - eq.RB[0]), Math.abs(RB[1] - eq.RB[1]), Math.abs(RA[0] - eq.RA[0]), Math.abs(RA[1] - eq.RA[1]));
  return { ok: true, P, O, Q, V, RA, RB, RAeq: eq.RA, RBeq: eq.RB, maxErr };
}

/* ---------- цепь под равномерной нагрузкой ---------- */

export interface ChainInput {
  /** Пролёт, м. */
  L: number;
  /** Стрела провисания в середине, м. */
  f: number;
  /** Нагрузка на пролёт, т/м (всеми цепями вместе). */
  q: number;
  /** Число цепей, поровну воспринимающих нагрузку. */
  chains: number;
  /** Число участков, на которые разбита нагрузка (чётное). */
  n: number;
}

export interface ChainResult {
  ok: boolean;
  error?: string;
  /** Нагрузка на одну цепь, т/м, и сила на каждом участке, т. */
  qc: number;
  w: number;
  /** Абсциссы сил (середины участков). */
  xs: number[];
  /** Горизонтальное усилие H (полюсное расстояние) и натяжения: в середине, у опор. */
  H: number;
  Tmid: number;
  Tsup: number;
  /** Вершины верёвочного многоугольника: x, y (y вниз от хорды AB — отрицательно). */
  V: V2[];
  /** Силовой многоугольник (одна цепь): вертикальный ряд вершин с абсциссой 0 и полюс O = (−H, …). */
  P: V2[];
  O: V2;
  /** Реакции опор: вертикальная и горизонтальная составляющие (одна цепь). */
  Vsup: number;
}

export function chain(inp: ChainInput): ChainResult {
  const nil: ChainResult = { ok: false, qc: 0, w: 0, xs: [], H: 0, Tmid: 0, Tsup: 0, V: [], P: [], O: [0, 0], Vsup: 0 };
  const { L, f, q } = inp;
  const n = Math.max(2, Math.round(inp.n / 2) * 2);
  const k = Math.max(1, Math.round(inp.chains));
  if (!(L > 0) || !(f > 0) || !(q > 0)) return { ...nil, error: 'Пролёт, стрела и нагрузка должны быть положительными.' };
  const qc = q / k;
  const w = (qc * L) / n;
  const xs = Array.from({ length: n }, (_, i) => ((i + 0.5) * L) / n);
  const H = (qc * L * L) / (8 * f);
  // Верёвочный многоугольник: ордината вершины i = −M(x)/H, M — изгибающий момент балки на двух опорах от тех же сил.
  const Vsup = (qc * L) / 2;
  const mom = (x: number) => Vsup * x - xs.filter((xi) => xi < x).reduce((s, xi) => s + w * (x - xi), 0);
  const V: V2[] = [[0, 0]];
  xs.forEach((x) => V.push([x, -mom(x) / H]));
  V.push([L, 0]);
  const P: V2[] = [[0, 0]];
  for (let i = 0; i < n; i++) P.push([0, P[i][1] - w]);
  return { ok: true, qc, w, xs, H, Tmid: H, Tsup: Math.hypot(H, Vsup), V, P, O: [-H, -(qc * L) / 2], Vsup };
}
