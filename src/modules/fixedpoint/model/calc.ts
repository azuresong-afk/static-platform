/**
 * Задачи §19, 20, 25 по формулам: ω по скоростям двух точек (19.13), трёхгранник Дарбу и вращение Земли (20.9–20.12),
 * гироскоп направления в кардановом подвесе (20.13–20.14), шарнир Кардана — Гука (25.24), дифференциал на повороте
 * (25.14). Каждая задача — набор чисел (CALC_FIELDS) и список строк результата; формулы — как в ответах книги.
 */
import { solveLin } from './linsys';
import { cross, norm, type V3 } from './vec';

export type CalcKind = 'inv' | 'earth' | 'gyro' | 'cardan' | 'turn';
export interface CalcField {
  key: string;
  label: string;
  unit: string;
  /** Целое число (число зубьев и т. п.) — не используется; поле разрешает отрицательные значения. */
  neg?: boolean;
}
export interface CalcProblem {
  kind: CalcKind;
  p: Record<string, number>;
}
export interface CalcRow {
  key: string;
  label: string;
  value: number;
  unit: string;
  /** Формула строки — для текста решения. */
  formula?: string;
}
export interface CalcResult {
  ok: boolean;
  errors: string[];
  kind: CalcKind;
  rows: CalcRow[];
  /** Значения по ключам (для сверки с книгой). */
  get: Record<string, number>;
  /** Дополнительные пояснения (уравнения оси и т. п.). */
  lines: string[];
  /** Кривая (шарнир Кардана): ω₂/ω₁ от угла поворота. */
  curve?: { x: number[]; y: number[] };
}

export const CALC_KINDS: { kind: CalcKind; label: string; hint: string }[] = [
  { kind: 'inv', label: 'ω и мгновенная ось по скоростям двух точек (19.13)', hint: 'Известна скорость точки M₁ и направление скорости M₂.' },
  { kind: 'earth', label: 'Движение по Земле: трёхгранник Дарбу (20.9–20.12)', hint: 'Скорость точки относительно Земли и широта.' },
  { kind: 'gyro', label: 'Гироскоп направления в кардановом подвесе (20.13–20.14)', hint: 'Ориентация оси и угловая скорость трёхгранника xyz.' },
  { kind: 'cardan', label: 'Шарнир Кардана — Гука (25.24)', hint: 'Отношение угловых скоростей валов.' },
  { kind: 'turn', label: 'Дифференциал автомобиля на повороте (25.14)', hint: 'Угловые скорости колёс и сателлита по скорости и радиусу поворота.' },
];

const F = (key: string, label: string, unit: string, neg = true): CalcField => ({ key, label, unit, neg });
export const CALC_FIELDS: Record<CalcKind, CalcField[]> = {
  inv: [
    F('x1', 'M₁ x', ''),
    F('y1', 'M₁ y', ''),
    F('z1', 'M₁ z', ''),
    F('vx1', 'v₁ x', ''),
    F('vy1', 'v₁ y', ''),
    F('vz1', 'v₁ z', ''),
    F('x2', 'M₂ x', ''),
    F('y2', 'M₂ y', ''),
    F('z2', 'M₂ z', ''),
    F('dx2', 'направление v₂, x', ''),
    F('dy2', 'направление v₂, y', ''),
    F('dz2', 'направление v₂, z', ''),
  ],
  earth: [
    F('R', 'радиус Земли R', 'км', false),
    F('U', 'угловая скорость Земли U', '10⁻⁵ с⁻¹', false),
    F('phi', 'широта φ', '°'),
    F('vE', 'скорость на восток v_E', 'м/с'),
    F('vN', 'скорость на север v_N', 'м/с'),
    F('rho', 'радиус геодезической кривизны ρ (0 — ∞)', 'км'),
    F('dvE', 'ускорение на восток', 'м/с²'),
    F('dvN', 'ускорение на север', 'м/с²'),
  ],
  gyro: [
    F('R', 'радиус Земли R', 'км', false),
    F('U', 'угловая скорость Земли U', '10⁻⁵ с⁻¹', false),
    F('phi', 'широта φ', '°'),
    F('alpha', 'поворот внешней рамки α', '°'),
    F('beta', 'подъём оси z, β', '°'),
    F('da', 'α̇', '10⁻⁵ с⁻¹'),
    F('db', 'β̇', '10⁻⁵ с⁻¹'),
    F('vE', 'скорость подвеса на восток v_E', 'м/с'),
    F('vN', 'скорость подвеса на север v_N', 'м/с'),
  ],
  cardan: [F('alpha', 'угол между валами α', '°', false), F('phi', 'поворот вилки ведущего вала φ', '°'), F('w1', 'ω₁ ведущего вала', 'с⁻¹', false)],
  turn: [
    F('v', 'скорость автомобиля v', 'км/ч', false),
    F('rho', 'радиус поворота ρ (до оси)', 'м', false),
    F('l', 'колея l', 'м', false),
    F('R', 'радиус колеса R', 'м', false),
    F('k', 'отношение радиусов колёс и сателлитов R₀/r', '', false),
  ],
};

export function calcDefaults(kind: CalcKind): CalcProblem {
  const D: Record<CalcKind, Record<string, number>> = {
    inv: { x1: 0, y1: 0, z1: 2, vx1: 1, vy1: 2, vz1: 0, x2: 0, y2: 1, z2: 2, dx2: -2, dy2: 2, dz2: -1 },
    earth: { R: 6371, U: 7.292, phi: 55, vE: 200, vN: 100, rho: 0, dvE: 0, dvN: 0 },
    gyro: { R: 6371, U: 7.292, phi: 55, alpha: 30, beta: 20, da: 0, db: 0, vE: 0, vN: 0 },
    cardan: { alpha: 60, phi: 90, w1: 1 },
    turn: { v: 36, rho: 5, l: 2, R: 0.5, k: 2 },
  };
  return { kind, p: { ...D[kind] } };
}

const D2R = Math.PI / 180;
const OK = (kind: CalcKind, rows: CalcRow[], lines: string[] = [], curve?: CalcResult['curve']): CalcResult => ({
  ok: true,
  errors: [],
  kind,
  rows,
  get: Object.fromEntries(rows.map((r) => [r.key, r.value])),
  lines,
  curve,
});
const BAD = (kind: CalcKind, errors: string[]): CalcResult => ({ ok: false, errors, kind, rows: [], get: {}, lines: [] });
const row = (key: string, label: string, value: number, unit: string, formula?: string): CalcRow => ({ key, label, value, unit, formula });

export function solveCalc(pr: CalcProblem): CalcResult {
  const { kind, p } = pr;
  if (!CALC_FIELDS[kind]) return BAD('inv', ['Неизвестный вид задачи.']);
  if (!CALC_FIELDS[kind].every((f) => Number.isFinite(p[f.key]))) return BAD(kind, ['Есть незаполненные числа.']);
  switch (kind) {
    case 'inv':
      return solveInv(p);
    case 'earth':
      return solveEarth(p);
    case 'gyro':
      return solveGyro(p);
    case 'cardan':
      return solveCardan(p);
    default:
      return solveTurn(p);
  }
}

/* ---------- 19.13: ω по скоростям двух точек ---------- */

/** −[r]× — матрица, для которой (−[r]×)·ω = ω × r. */
const crossMat = (r: V3): number[][] => [
  [0, r[2], -r[1]],
  [-r[2], 0, r[0]],
  [r[1], -r[0], 0],
];
function solveInv(p: Record<string, number>): CalcResult {
  const r1: V3 = [p.x1, p.y1, p.z1],
    v1: V3 = [p.vx1, p.vy1, p.vz1],
    r2: V3 = [p.x2, p.y2, p.z2],
    d2: V3 = [p.dx2, p.dy2, p.dz2];
  if (norm(r1) < 1e-12 || norm(r2) < 1e-12 || norm(d2) < 1e-12)
    return BAD('inv', ['Точки не должны совпадать с неподвижной точкой, направление v₂ не нулевое.']);
  // ω × r₁ = v₁ (3 уравнения); ω × r₂ = k·d₂ (3 уравнения); неизвестные ω₁, ω₂, ω₃ и k.
  const A1 = crossMat(r1),
    A2 = crossMat(r2);
  const M = [...A1.map((r) => [...r, 0]), ...A2.map((r, i) => [...r, -d2[i]])];
  const rhs = [...v1, 0, 0, 0];
  const s = solveLin(M, [rhs]);
  if (s.rank < 4 || s.inconsistent.length) {
    return BAD('inv', [
      s.rank < 4
        ? 'Направления v₁, v₂ и точки не определяют ω однозначно (точки лежат на одной прямой с O).'
        : 'Данные несовместны: скорость v₁ должна быть перпендикулярна OM₁, а v₂ — OM₂ и ω.',
    ]);
  }
  const [wx, wy, wz, k] = s.x[0];
  const w: V3 = [wx, wy, wz];
  const W = norm(w);
  if (W < 1e-12) return BAD('inv', ['Угловая скорость тела равна нулю.']);
  const v2 = cross(w, r2);
  const lines = [
    `мгновенная ось проходит через неподвижную точку O параллельно ω: x/${f(wx)} = y/${f(wy)} = z/${f(wz)}`,
    `плоскости: ${plane(wy, -wx, 0)}; ${plane(wz, 0, -wx)}`,
  ];
  const rows = [
    row('wx', 'ω_x', wx, 'с⁻¹'),
    row('wy', 'ω_y', wy, 'с⁻¹'),
    row('wz', 'ω_z', wz, 'с⁻¹'),
    row('w', '|ω|', W, 'с⁻¹', 'ω = √(ω_x² + ω_y² + ω_z²)'),
    row('k', 'v₂ (по заданному направлению)', k, 'ед. скорости'),
    row('v2', '|v₂|', norm(v2), 'ед. скорости', 'v₂ = ω × OM₂'),
  ];
  return OK('inv', rows, lines);
}
const f = (x: number) => String(Math.round(x * 1e4) / 1e4).replace('.', ',');
/** a·x + b·y + c·z = 0 с целыми коэффициентами, если отношение рациональное с малыми числами. */
function plane(a: number, b: number, c: number): string {
  const co = [a, b, c];
  const nz = co.filter((x) => Math.abs(x) > 1e-12);
  const m = Math.min(...nz.map(Math.abs));
  let k = 1;
  for (const t of [1, 2, 3, 4, 5, 6, 8, 10]) {
    if (co.every((x) => Math.abs((x / m) * t - Math.round((x / m) * t)) < 1e-6)) {
      k = t;
      break;
    }
  }
  const sc = co.map((x) => Math.round((x / m) * k));
  const names = ['x', 'y', 'z'];
  const sg = (nz0: number) => (nz0 < 0 ? '−' : '+');
  let out = '';
  sc.forEach((x, i) => {
    if (!x) return;
    out += (out ? ` ${sg(x)} ` : x < 0 ? '−' : '') + (Math.abs(x) === 1 ? '' : Math.abs(x)) + names[i];
  });
  return out + ' = 0';
}

/* ---------- 20.9–20.12: Земля ---------- */

function solveEarth(p: Record<string, number>): CalcResult {
  const R = p.R * 1e3,
    U = p.U * 1e-5,
    ph = p.phi * D2R;
  if (!(R > 0) || !(U >= 0)) return BAD('earth', ['Радиус и угловая скорость Земли должны быть положительными.']);
  if (Math.abs(p.phi) >= 90 - 1e-9) return BAD('earth', ['На полюсе долгота не определена: |φ| < 90°.']);
  const { vE, vN } = p;
  const dphi = vN / R;
  const dlam = vE / (R * Math.cos(ph));
  const v = Math.hypot(vE, vN);
  const e5 = (x: number) => x * 1e5;
  const rows: CalcRow[] = [
    row('dphi', 'φ̇ (скорость изменения широты)', e5(dphi), '10⁻⁵ с⁻¹', 'φ̇ = v_N/R'),
    row('dlam', 'λ̇ (скорость изменения долготы)', e5(dlam), '10⁻⁵ с⁻¹', 'λ̇ = v_E/(R cos φ)'),
    row('wxi', 'ω_ξ (трёхгранник Дарбу, география)', e5(-dphi), '10⁻⁵ с⁻¹', 'ω_ξ = −φ̇ = −v_N/R'),
    row('weta', 'ω_η', e5((U + dlam) * Math.cos(ph)), '10⁻⁵ с⁻¹', 'ω_η = (U + λ̇) cos φ'),
    row('wzeta', 'ω_ζ', e5((U + dlam) * Math.sin(ph)), '10⁻⁵ с⁻¹', 'ω_ζ = (U + λ̇) sin φ'),
  ];
  if (v > 1e-12) {
    const psi = Math.atan2(vE, vN);
    const rho = p.rho * 1e3;
    const vr = rho > 0 || rho < 0 ? v / rho : 0;
    rows.push(
      row('psi', 'курс ψ (от севера к востоку)', psi / D2R, '°', 'tg ψ = v_E/v_N'),
      row('wx', 'ω_x (ось x по скорости относительно Земли)', e5(U * Math.cos(ph) * Math.cos(psi)), '10⁻⁵ с⁻¹', 'ω_x = U cos φ cos ψ'),
      row('wy', 'ω_y', e5(U * Math.cos(ph) * Math.sin(psi) + v / R), '10⁻⁵ с⁻¹', 'ω_y = U cos φ sin ψ + v/R'),
      row('wz', 'ω_z', e5(U * Math.sin(ph) + vr), '10⁻⁵ с⁻¹', 'ω_z = (U + λ̇) sin φ + ψ̇ = U sin φ + v/ρ'),
    );
    // 20.12: ось x⁰ — по абсолютной скорости.
    const a = vE + R * U * Math.cos(ph);
    const V = Math.hypot(a, vN);
    const th = Math.atan2(vN, a);
    const dth = (a * p.dvN - vN * (p.dvE - R * U * Math.sin(ph) * dphi)) / (V * V);
    rows.push(
      row('Vabs', 'абсолютная скорость V', V, 'м/с', 'V = √((v_E + RU cos φ)² + v_N²)'),
      row('theta', 'направление V: θ (от востока к северу)', th / D2R, '°', 'tg θ = v_N/(v_E + RU cos φ)'),
      row('wx0', 'ω_x⁰', 0, '10⁻⁵ с⁻¹', 'ω_x⁰ = 0'),
      row('wy0', 'ω_y⁰', e5(V / R), '10⁻⁵ с⁻¹', 'ω_y⁰ = V/R'),
      row('wz0', 'ω_z⁰', e5((U + dlam) * Math.sin(ph) + dth), '10⁻⁵ с⁻¹', 'ω_z⁰ = (U + λ̇) sin φ + θ̇'),
    );
  }
  return OK('earth', rows);
}

/* ---------- 20.13–20.14: гироскоп направления ---------- */

function solveGyro(p: Record<string, number>): CalcResult {
  const R = p.R * 1e3,
    U = p.U * 1e-5,
    ph = p.phi * D2R,
    a = p.alpha * D2R,
    b = p.beta * D2R;
  if (!(R > 0) || !(U >= 0)) return BAD('gyro', ['Радиус и угловая скорость Земли должны быть положительными.']);
  if (Math.abs(p.phi) >= 90 - 1e-9) return BAD('gyro', ['|φ| < 90°.']);
  const da = p.da * 1e-5,
    db = p.db * 1e-5;
  const Ue = U + p.vE / (R * Math.cos(ph)); // U + λ̇
  const vNR = p.vN / R;
  const e5 = (x: number) => x * 1e5;
  const wx = db - Ue * Math.cos(ph) * Math.sin(a) - vNR * Math.cos(a);
  const wy = da * Math.cos(b) + Ue * (Math.cos(ph) * Math.cos(a) * Math.sin(b) - Math.sin(ph) * Math.cos(b)) - vNR * Math.sin(a) * Math.sin(b);
  const wz = da * Math.sin(b) + Ue * (Math.cos(ph) * Math.cos(a) * Math.cos(b) + Math.sin(ph) * Math.sin(b));
  const rows = [
    row('cxi', 'cos(z, ξ) — на восток', Math.sin(a) * Math.cos(b), '', 'sin α cos β'),
    row('ceta', 'cos(z, η) — на север', Math.cos(a) * Math.cos(b), '', 'cos α cos β'),
    row('czeta', 'cos(z, ζ) — вверх', Math.sin(b), '', 'sin β'),
    row('wx', 'ω_x', e5(wx), '10⁻⁵ с⁻¹', 'ω_x = β̇ − (U + λ̇) cos φ sin α − (v_N/R) cos α'),
    row('wy', 'ω_y', e5(wy), '10⁻⁵ с⁻¹', 'ω_y = α̇ cos β + (U + λ̇)(cos φ cos α sin β − sin φ cos β) − (v_N/R) sin α sin β'),
    row('wz', 'ω_z', e5(wz), '10⁻⁵ с⁻¹', 'ω_z = α̇ sin β + (U + λ̇)(cos φ cos α cos β + sin φ sin β)'),
  ];
  return OK('gyro', rows);
}

/* ---------- 25.24: шарнир Кардана — Гука ---------- */

/** ω₁/ω₂ при повороте вилки ведущего вала на угол φ от плоскости осей валов. */
export const cardanRatio = (alpha: number, phi: number): number => (1 - Math.sin(alpha) ** 2 * Math.cos(phi) ** 2) / Math.cos(alpha);
function solveCardan(p: Record<string, number>): CalcResult {
  const a = p.alpha * D2R;
  if (!(p.alpha > 0 && p.alpha < 90)) return BAD('cardan', ['Угол между валами должен быть в пределах 0°…90°.']);
  const ph = p.phi * D2R;
  const q = cardanRatio(a, ph);
  const xs: number[] = [],
    ys: number[] = [];
  for (let d = 0; d <= 360; d += 5) {
    xs.push(d);
    ys.push(1 / cardanRatio(a, d * D2R));
  }
  const rows = [
    row('c1', 'ω₁/ω₂, плоскость вилки ABF ⟂ плоскости осей, CDG — в ней (случай 1)', 1 / Math.cos(a), '', 'ω₁/ω₂ = 1/cos α'),
    row('c2', 'ω₁/ω₂, ABF — в плоскости осей, CDG ⟂ ей (случай 2)', Math.cos(a), '', 'ω₁/ω₂ = cos α'),
    row('c', 'ω₁/ω₂ при заданном φ', q, '', 'ω₁/ω₂ = (1 − sin²α cos²φ)/cos α'),
    row('w2', 'ω₂ при заданных φ и ω₁', p.w1 / q, 'с⁻¹', 'ω₂ = ω₁ cos α/(1 − sin²α cos²φ)'),
    row('w2max', 'наибольшее ω₂/ω₁', 1 / Math.cos(a), '', 'при φ = 90°'),
    row('w2min', 'наименьшее ω₂/ω₁', Math.cos(a), '', 'при φ = 0°'),
    row('irr', 'неравномерность (ω₂max − ω₂min)/ω₁', 1 / Math.cos(a) - Math.cos(a), '', 'sin α tg α'),
  ];
  return OK('cardan', rows, [], { x: xs, y: ys });
}

/* ---------- 25.14: дифференциал на повороте ---------- */

function solveTurn(p: Record<string, number>): CalcResult {
  const v = p.v / 3.6;
  if (!(p.rho > p.l / 2 && p.l > 0 && p.R > 0 && p.k > 0)) return BAD('turn', ['Нужно ρ > l/2, l > 0, R > 0, R₀/r > 0.']);
  const w1 = (v * (p.rho + p.l / 2)) / (p.rho * p.R);
  const w2 = (v * (p.rho - p.l / 2)) / (p.rho * p.R);
  const rows = [
    row('w1', 'ω₁ (внешнее колесо)', w1, 'с⁻¹', 'ω₁ = v(ρ + l/2)/(ρR)'),
    row('w2', 'ω₂ (внутреннее колесо)', w2, 'с⁻¹', 'ω₂ = v(ρ − l/2)/(ρR)'),
    row('wC', 'ω коробки C', (w1 + w2) / 2, 'с⁻¹', 'ω_C = (ω₁ + ω₂)/2'),
    row('wr', 'ω сателлита относительно коробки', (p.k * (w1 - w2)) / 2, 'с⁻¹', 'ω_r = (R₀/r)(ω₁ − ω₂)/2'),
  ];
  return OK('turn', rows);
}
