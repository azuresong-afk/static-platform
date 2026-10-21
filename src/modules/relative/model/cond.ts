/**
 * Сложение скоростей с условием (Мещерский 21.6, 21.12, 22.1–22.2, 22.4, 22.7, 22.8, 22.10): вымпел с самолёта, встреча
 * катера с кораблём, самолёт и ветер (по прямой и по треугольному полигону), переправа через реку, лента самописца,
 * дифференциальный винт. Параметры лежат в CondProblem.p (числа или формулы без t: «π/6», «9,81»).
 */
import { evalExpr, parseExpr } from '../../../shared/expr';

export type CondKind = 'flag' | 'meet' | 'wind' | 'poly' | 'river' | 'tape' | 'screw';
export const COND_KINDS: [CondKind, string][] = [
  ['flag', 'вымпел с самолёта на корабль (22.1–22.2)'],
  ['meet', 'встреча катера с кораблём (22.3–22.4)'],
  ['wind', 'самолёт и ветер по прямой (22.7)'],
  ['poly', 'самолёт и ветер по треугольному полигону (22.8)'],
  ['river', 'переправа через реку (22.10)'],
  ['tape', 'лента самописца и колебания (21.6)'],
  ['screw', 'дифференциальный винт (21.12)'],
];
/** Поля вида: ключ, подпись, значение по умолчанию. */
export const COND_FIELDS: Record<CondKind, [string, string, string][]> = {
  flag: [
    ['v', 'скорость корабля v', '10'],
    ['v1', 'скорость самолёта v₁', '50'],
    ['h', 'высота полёта h', '500'],
    ['g', 'g', '9,81'],
    ['dir', 'курс самолёта: same — тот же, opp — навстречу', 'same'],
  ],
  meet: [
    ['v0', 'скорость корабля v₀', '10'],
    ['v1', 'скорость катера v₁', '20'],
    ['psi', 'угол ψ₀ линии AB с перпендикуляром к курсу, °', '30'],
    ['l', 'расстояние AB = l', '100'],
  ],
  wind: [
    ['l', 'длина отмеченной прямой l', '1000'],
    ['t1', 'время по ветру t₁', '8'],
    ['t2', 'время против ветра t₂', '12,5'],
  ],
  poly: [
    ['a', 'сторона BC', '11'],
    ['b', 'сторона CA', '12'],
    ['c', 'сторона AB', '13'],
    ['t1', 'время полёта по BC', '0,28'],
    ['t2', 'время полёта по CA', '0,3'],
    ['t3', 'время полёта по AB', '0,32'],
  ],
  river: [
    ['t1', 'время при курсе перпендикулярно берегам', '10'],
    ['s', 'снос по течению', '120'],
    ['t2', 'время при курсе против течения (прямо на B)', '12,5'],
  ],
  tape: [
    ['A', 'наибольшая ордината синусоиды A', '2,5'],
    ['lam', 'длина волны (одного периода) на ленте', '8'],
    ['v', 'скорость ленты v', '200'],
  ],
  screw: [
    ['h1', 'шаг нарезки части A, h₁', '0,5'],
    ['h2', 'шаг нарезки части B, h₂', '0,4'],
    ['n', 'поворот на 1/n оборота: n', '200'],
    ['dir', 'нарезки: same — одинаковые, opp — разного направления', 'same'],
  ],
};
export const condDefaults = (kind: CondKind): Record<string, string> => Object.fromEntries(COND_FIELDS[kind].map(([k, , d]) => [k, d]));

export interface CondProblem {
  kind: CondKind;
  p: Record<string, string>;
}

export interface CondResult {
  ok: boolean;
  errors: string[];
  kind: CondKind;
  /** Результаты по именам (для ответа книги и текста). */
  out: Record<string, number>;
  /** Для poly: три конца векторов путевых скоростей, центр и радиус окружности. */
  pts: [number, number][];
}

const blank = (kind: CondKind, errors: string[]): CondResult => ({ ok: false, errors, kind, out: {}, pts: [] });

/** Число из поля параметров. */
function num(pr: CondProblem, k: string, label: string, errors: string[]): number {
  const raw = (pr.p[k] ?? '').trim();
  const e = parseExpr(raw);
  const v = raw && e.ok ? evalExpr(e.e, 0) : NaN;
  if (!Number.isFinite(v)) errors.push(`${label}: ${raw ? 'не число' : 'пусто'}.`);
  return v;
}

export function solveCond(pr: CondProblem): CondResult {
  const kind = pr.kind;
  const errors: string[] = [];
  const N = (k: string, label: string) => num(pr, k, label, errors);
  const res: CondResult = { ...blank(kind, []), ok: true };
  const fail = (msg: string) => blank(kind, [msg]);
  if (kind === 'flag') {
    const v = N('v', 'v'),
      v1 = N('v1', 'v₁'),
      h = N('h', 'h'),
      g = N('g', 'g');
    if (errors.length) return blank(kind, errors);
    if (!(h > 0) || !(g > 0) || v < 0 || v1 < 0) return fail('h и g должны быть положительными, скорости — неотрицательными.');
    const opp = (pr.p.dir ?? 'same').trim() === 'opp';
    const T = Math.sqrt((2 * h) / g);
    // Горизонтальное расстояние от самолёта до корабля в момент сброса (вперёд по курсу самолёта).
    const l = opp ? (v1 + v) * T : (v1 - v) * T;
    res.out = { T, l, opp: opp ? 1 : 0, v, v1, h, g, drop: v1 * T };
    return res;
  }
  if (kind === 'meet') {
    const v0 = N('v0', 'v₀'),
      v1 = N('v1', 'v₁'),
      psi = N('psi', 'ψ₀'),
      l = N('l', 'l');
    if (errors.length) return blank(kind, errors);
    if (!(v0 > 0) || !(v1 > 0) || !(l > 0)) return fail('Скорости и расстояние должны быть положительными.');
    const rad = Math.PI / 180;
    const sinB = (v0 / v1) * Math.cos(psi * rad);
    if (Math.abs(sinB) > 1) return fail(`Катер не догонит корабль: sin β = ${sinB.toFixed(3)} по модулю больше 1 (нужно v₁ ≥ v₀|cos ψ₀|).`);
    const R = Math.sqrt(v1 * v1 - v0 * v0 * Math.cos(psi * rad) ** 2);
    const T = l / (v0 * Math.sin(psi * rad) + R);
    if (!(T > 0)) return fail('Встреча невозможна при таких данных: катер не догоняет корабль.');
    const beta = Math.asin(sinB) / rad;
    // Координаты: A — начало, корабль идёт по +y, B = (l cos ψ₀, l sin ψ₀); встреча в M = (0, v₀T).
    const B: [number, number] = [l * Math.cos(psi * rad), l * Math.sin(psi * rad)];
    const M: [number, number] = [0, v0 * T];
    res.out = { beta, T, sinB, Bx: B[0], By: B[1], Mx: M[0], My: M[1], Tsine: ((l / v0) * Math.sin(beta * rad)) / Math.cos((psi - beta) * rad) };
    res.pts = [B, M];
    return res;
  }
  if (kind === 'wind') {
    const l = N('l', 'l'),
      t1 = N('t1', 't₁'),
      t2 = N('t2', 't₂');
    if (errors.length) return blank(kind, errors);
    if (!(l > 0) || !(t1 > 0) || !(t2 > 0)) return fail('Длина и времена должны быть положительными.');
    const v = (l / 2) * (1 / t1 + 1 / t2),
      V = (l / 2) * (1 / t1 - 1 / t2);
    if (Math.abs(V) > v) return fail('Скорость ветра больше собственной скорости — самолёт не мог бы лететь против ветра.');
    res.out = { v, V: Math.abs(V), vkmh: 3.6 * v, Vkmh: 3.6 * Math.abs(V), g1: l / t1, g2: l / t2, tail: V >= 0 ? 1 : 0 };
    return res;
  }
  if (kind === 'poly') {
    const a = N('a', 'BC'),
      b = N('b', 'CA'),
      c = N('c', 'AB'),
      t1 = N('t1', 't₁'),
      t2 = N('t2', 't₂'),
      t3 = N('t3', 't₃');
    if (errors.length) return blank(kind, errors);
    if (![a, b, c, t1, t2, t3].every((x) => x > 0)) return fail('Стороны и времена должны быть положительными.');
    if (a + b <= c || b + c <= a || a + c <= b) return fail('Из таких сторон треугольник не составить.');
    // B = (0, 0), C = (a, 0), A = (xa, ya) по сторонам CA = b, AB = c.
    const xa = (a * a + c * c - b * b) / (2 * a),
      ya = Math.sqrt(Math.max(c * c - xa * xa, 0));
    const P = { B: [0, 0], C: [a, 0], A: [xa, ya] };
    const dir = (p: number[], q: number[], len: number): [number, number] => [(q[0] - p[0]) / len, (q[1] - p[1]) / len];
    // Облёт B → C → A → B: путевые скорости l/t вдоль сторон.
    const g: [number, number][] = [
      [dir(P.B, P.C, a)[0] * (a / t1), dir(P.B, P.C, a)[1] * (a / t1)],
      [dir(P.C, P.A, b)[0] * (b / t2), dir(P.C, P.A, b)[1] * (b / t2)],
      [dir(P.A, P.B, c)[0] * (c / t3), dir(P.A, P.B, c)[1] * (c / t3)],
    ];
    // Окружность через три точки: центр — вектор ветра, радиус — собственная скорость.
    const [p1, p2, p3] = g;
    const D = 2 * (p1[0] * (p2[1] - p3[1]) + p2[0] * (p3[1] - p1[1]) + p3[0] * (p1[1] - p2[1]));
    if (Math.abs(D) < 1e-12) return fail('Путевые скорости лежат на одной прямой — окружность не определена (ветер и скорость найти нельзя).');
    const s = (q: [number, number]) => q[0] * q[0] + q[1] * q[1];
    const ox = (s(p1) * (p2[1] - p3[1]) + s(p2) * (p3[1] - p1[1]) + s(p3) * (p1[1] - p2[1])) / D;
    const oy = (s(p1) * (p3[0] - p2[0]) + s(p2) * (p1[0] - p3[0]) + s(p3) * (p2[0] - p1[0])) / D;
    const v = Math.hypot(p1[0] - ox, p1[1] - oy);
    res.pts = [p1, p2, p3, [ox, oy]];
    res.out = {
      v,
      W: Math.hypot(ox, oy),
      Wx: ox,
      Wy: oy,
      Wdir: (Math.atan2(oy, ox) * 180) / Math.PI,
      g1: Math.hypot(...p1),
      g2: Math.hypot(...p2),
      g3: Math.hypot(...p3),
      Ax: xa,
      Ay: ya,
    };
    return res;
  }
  if (kind === 'river') {
    const t1 = N('t1', 't₁'),
      s = N('s', 'снос'),
      t2 = N('t2', 't₂');
    if (errors.length) return blank(kind, errors);
    if (!(t1 > 0) || !(t2 > t1) || !(s > 0)) return fail('Нужно t₂ > t₁ > 0 и снос s > 0.');
    const v = s / t1;
    const u = (v * t2) / Math.sqrt(t2 * t2 - t1 * t1);
    const l = u * t1;
    const alpha = (Math.asin(v / u) * 180) / Math.PI;
    res.out = { l, u, v, alpha, w2: Math.sqrt(u * u - v * v) };
    return res;
  }
  if (kind === 'tape') {
    const A = N('A', 'A'),
      lam = N('lam', 'длина волны'),
      v = N('v', 'v');
    if (errors.length) return blank(kind, errors);
    if (!(A > 0) || !(lam > 0) || !(v > 0)) return fail('A, длина волны и скорость ленты должны быть положительными.');
    const T = lam / v,
      w = (2 * Math.PI) / T;
    res.out = { A, T, w, f: 1 / T, wOverPi: w / Math.PI, lam, v };
    return res;
  }
  // screw
  const h1 = N('h1', 'h₁'),
    h2 = N('h2', 'h₂'),
    n = N('n', 'n');
  if (errors.length) return blank(kind, errors);
  if (!(n > 0) || !(h1 > 0) || !(h2 > 0)) return fail('Шаги и n должны быть положительными.');
  const opp = (pr.p.dir ?? 'same').trim() === 'opp';
  res.out = { s: opp ? (h1 + h2) / n : Math.abs(h1 - h2) / n, opp: opp ? 1 : 0, per: opp ? h1 + h2 : Math.abs(h1 - h2), h1, h2, n };
  return res;
}
