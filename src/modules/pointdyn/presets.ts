/** Готовые задачи: Мещерский §27 (прямолинейное движение). Ответы — по книге или по её формулам. */
import { G } from '../rotation/model/rotation';
import type { FirstProblem } from './model/first';
import type { PlaneProblem } from './model/plane';
import type { PointProblem } from './model/point';

export interface PointPreset {
  title: string;
  problem: PointProblem;
  /** Ответ книги: t, v, x (в найденном состоянии), a, vLim (м/с) или vLimKmh (км/ч). */
  book?: Record<string, number>;
  note?: string;
}

const rad = (a: number) => (a * Math.PI) / 180;
const pt = (o: Partial<PointProblem>): PointProblem => ({ byWeight: false, m: 1, alpha: 0, up: false, f: 0, F0: 0, at: 0, F1: 0, p: 0, c: 0, kv: 0, kq: 0, x0: 0, v0: 0, ask: 't', t: 1, v1: 0, x1: 1, ...o });

const k16 = 0.05,
  v16 = 20;
const sub = { M: 1000, p: 500, kS: 200, T: 4 };

export const POINT_PRESETS = {
  m277: {
    title: 'Мещерский 27.7: точка поднимается по шероховатой наклонной плоскости до остановки',
    problem: pt({ alpha: 30, up: true, f: 0.1, v0: 15, ask: 'v', v1: 0 }),
    book: { x: 19.55, t: 2.61 },
    note: 'α = 30°, f = 0,1, v₀ = 15 м/с; ось x — вверх по плоскости.',
  },
  m272: {
    title: 'Мещерский 27.2: тело скользит по гладкой наклонной плоскости',
    problem: pt({ alpha: 30, v0: 2, ask: 'x', x1: 9.6 }),
    book: { t: 1.61 },
    note: 'α = 30°, v₀ = 2 м/с, путь 9,6 м; ось x — вниз по плоскости.',
  },
  m274: {
    title: 'Мещерский 27.4: тело после толчка скользит по горизонтали и останавливается',
    problem: pt({ byWeight: true, m: 10, f: 0.2, v0: 9.8, ask: 'v', v1: 0 }),
    book: { t: 5, x: 24.5 },
    note: 'В книге по пути 24,5 м за 5 с ищется f = 0,2; здесь обратная проверка: при f = 0,2 и v₀ = 2s/t = 9,8 м/с тело останавливается через 5 с на 24,5 м.',
  },
  m278: {
    title: 'Мещерский 27.8: вагон скатывается под уклон с трением',
    problem: pt({ alpha: 15, f: Math.tan(rad(10)), t: 20 }),
    book: { a: 0.87, v: 17.4, x: 174 },
    note: 'Коэффициент трения — из условия равномерного движения на уклоне 10°: f = tg 10°; уклон β = 15°, t = 20 с.',
  },
  m279: {
    title: 'Мещерский 27.9: наибольшая скорость падения шара в воздухе',
    problem: pt({ byWeight: true, m: 10, alpha: 90, kq: 0.024 * Math.PI * 0.08 ** 2, t: 30 }),
    book: { vLim: 144 },
    note: 'P = 10 кГ, r = 8 см, сопротивление kσv², k = 0,024 кГ·с²/м⁴, σ = πr².',
  },
  m2711: {
    title: 'Мещерский 27.11: лыжник на склоне 45° — предельная скорость',
    problem: pt({ byWeight: true, m: 90, alpha: 45, f: 0.1, kq: 0.0635, t: 30 }),
    book: { vLimKmh: 108 },
    note: 'Вес 90 кГ, f = 0,1, сопротивление воздуха 0,0635v² кГ. При f = 0,05 книга даёт 111 км/ч.',
  },
  m2712: {
    title: 'Мещерский 27.12: корабль — сила упора винтов убывает со скоростью',
    problem: pt({ byWeight: true, m: 1500, F0: 120, kv: 120 / 33, kq: 0.12, t: 60 }),
    book: { vLim: 20 },
    note: 'T = T₀(1 − v/v_s), T₀ = 120 т, v_s = 33 м/с — это F₀ = 120 и k₁ = T₀/v_s; сопротивление 0,12v² т. Вес корабля на ответ (предельную скорость) не влияет — взят 1500 т.',
  },
  m2713: {
    title: 'Мещерский 27.13: наибольшая скорость самолёта',
    problem: pt({ byWeight: true, m: 5000, F0: 3080 * Math.cos(rad(10)), kq: 0.05, t: 60 }),
    book: { vLim: 246 },
    note: 'Тяга 3080 кГ под углом 10° к направлению полёта, сопротивление 0,05v² кГ.',
  },
  m2716: {
    title: 'Мещерский 27.16: тело брошено вверх, сопротивление k²pv²',
    problem: pt({ alpha: 90, up: true, kq: G * k16 ** 2, v0: v16, ask: 'v', v1: 0 }),
    book: { x: Math.log(v16 ** 2 * k16 ** 2 + 1) / (2 * G * k16 ** 2), t: Math.atan(k16 * v16) / (k16 * G) },
    note: 'm = 1 кг, k = 0,05 с/м, v₀ = 20 м/с: H = ln(v₀²k² + 1)/(2gk²), T = arctg(kv₀)/(kg).',
  },
  m2717: {
    title: 'Мещерский 27.17: тело брошено вверх, сопротивление 0,04v',
    problem: pt({ byWeight: true, m: 2, alpha: 90, up: true, kv: 0.04, v0: 20, ask: 'v', v1: 0 }),
    book: { t: 1.7 },
    note: 'Вес 2 кГ, v₀ = 20 м/с, сопротивление 0,04v кГ.',
  },
  m2718: {
    title: 'Мещерский 27.18–27.19: погружение подводной лодки',
    problem: pt({ m: sub.M, F0: sub.p, kv: sub.kS, t: sub.T }),
    book: {
      v: (sub.p / sub.kS) * (1 - Math.exp((-sub.kS / sub.M) * sub.T)),
      x: (sub.p / sub.kS) * (sub.T - (sub.M / sub.kS) * (1 - Math.exp((-sub.kS / sub.M) * sub.T))),
    },
    note: 'M = 1000 кг, отрицательная плавучесть p = 500 Н, сопротивление kSv, kS = 200 Н·с/м, T = 4 с; ось x — вниз.',
  },
  m2720: {
    title: 'Мещерский 27.20: поезд разгоняется до 12 км/ч',
    problem: pt({ byWeight: true, m: 40000, F0: 200 - 100, kv: 0.05 * 40, ask: 'v', v1: 12 / 3.6 }),
    book: { t: 141 },
    note: 'Q = 40 т, сопротивление (2,5 + 0,05v)Q кГ = 100 + 2v кГ, тяга F = 200 кГ: F₀ = 100, k₁ = 2. Время 141 с совпадает с книгой; путь по расчёту 237 м, в книге 245 м — по формуле s = (m/k)[(F/k)ln(F/(F − kv)) − v] получается 237 м (при g = 9,8 тоже), считаем это опечаткой книги.',
  },
} satisfies Record<string, PointPreset>;

export type PointPresetKey = keyof typeof POINT_PRESETS;

/* ---------- первая задача: силы по заданному движению (§26) ---------- */

export interface FirstPreset {
  title: string;
  problem: FirstProblem;
  /** Ответ: Fx, Fy (в момент t), Fmax; kX, kY — коэффициенты X = kX·x, Y = kY·y (x, y в см); kR — F/(m·v). */
  book?: Record<string, number>;
  relTol?: number;
  note?: string;
}
const first = (o: Partial<FirstProblem>): FirstProblem => ({ byWeight: false, m: 1, g: G, x: '', y: '', z: '', gravity: 'none', t: 1, t1: 0, t2: 0, ...o });

export const FIRST_PRESETS = {
  f2615: {
    title: 'Мещерский 26.15: колебания s = 10 sin(πt/2) — сила и её наибольшее значение',
    problem: first({ byWeight: true, m: 20, x: '10 sin(πt/2)', t: 1, t1: 0, t2: 4 }),
    book: { Fx: -50.3, Fmax: 50.3 },
    note: 'Вес 20 Н. Книга: P = −5,03s, P_max = 50,3 Н (при s = 10 м, t = 1 с).',
  },
  f2616: {
    title: 'Мещерский 26.16: движение по эллипсу x = 3 cos 2πt, y = 4 sin πt (см)',
    problem: first({ byWeight: true, m: 2, x: '0,03 cos(2πt)', y: '0,04 sin(πt)', t: 0.1 }),
    book: { kX: -0.08, kY: -0.02 },
    note: 'Вес 2 Н; координаты в метрах. Книга: X = −0,08x Н, Y = −0,02y Н (x, y — в см).',
  },
  f2617: {
    title: 'Мещерский 26.17: шарик падает с сопротивлением воздуха',
    problem: first({ m: 0.001, g: 9.8, x: '4,9t − 2,45(1 − exp(−2t))', gravity: '+x', t: 0.5, t1: 0, t2: 3 }),
    book: { kR: -2 },
    note: 'm = 1 г, ось x — вниз, g = 9,8 м/с² (как в книге). Книга: R = 2mv — сила сопротивления против скорости.',
  },
  f261: {
    title: 'Мещерский 26.1: натяжение каната опускающегося лифта',
    problem: first({ byWeight: true, m: 280, x: '0,35t^2', gravity: '+x', t: 5 }),
    book: { Fx: -260 },
    note: 'Вес 280 кГ, 35 м за 10 с равноускоренно: x = 0,35t² (ось x — вниз). Сила каната −260 кГ — направлена вверх.',
  },
  f2613: {
    title: 'Мещерский 26.13: сила, действующая на поршень',
    problem: first({ byWeight: true, m: 2, x: '0,1(cos 50t + 0,0625 cos 100t)', t: 0, t1: 0, t2: 0.13 }),
    book: { Fmax: (2 / G) * 0.1 * 50 ** 2 * (1 + 0.1 / 0.4) },
    note: 'r = 0,1 м, l = 0,4 м (r/4l = 0,0625), ω = 50 рад/с, Q = 2 кГ: P = (Q/g)rω²(1 + r/l).',
  },
} satisfies Record<string, FirstPreset>;
export type FirstPresetKey = keyof typeof FIRST_PRESETS;

/* ---------- криволинейное движение в плоскости (§27 б) ---------- */

export interface PlanePreset {
  title: string;
  problem: PlaneProblem;
  /** Ответ: x, y, t (найденное состояние), apexX, apexY. */
  book?: Record<string, number>;
  relTol?: number;
  note?: string;
}
const plane = (o: Partial<PlaneProblem>): PlaneProblem => ({ byWeight: false, m: 1, g: G, gravity: true, Fx: 0, Fy: 0, kv: 0, kq: 0, c: 0, cx: 0, cy: 0, q: 0, x0: 0, y0: 0, v0: 10, ang: 45, ask: 'land', t: 1, y1: 0, x1: 0, ...o });
const L44 = 100 ** 2 / G;
const v46 = Math.sqrt(16000 * G) / Math.cos(rad(30));
const d52 = { k: 0.01, v0: 50, al: 60 };

export const PLANE_PRESETS = {
  p2744: {
    title: 'Мещерский 27.44: дальность и высота при угле 30°',
    problem: plane({ v0: 100, ang: 30 }),
    book: { x: (Math.sqrt(3) / 2) * L44, apexY: L44 / 8 },
    note: 'v₀ = 100 м/с; наибольшая дальность L = v₀²/g. Книга: l = (√3/2)L, h = L/8.',
  },
  p2742: {
    title: 'Мещерский 27.42: груз, сброшенный с самолёта',
    problem: plane({ y0: 4000, v0: 500 / 3.6, ang: 0 }),
    book: { x: 3960 },
    relTol: 0.005,
    note: 'Высота 4000 м, 500 км/ч. По расчёту 3966 м; в книге — 3960 м (округлено).',
  },
  p2746: {
    title: 'Мещерский 27.46: дальность по радиусу кривизны в высшей точке',
    problem: plane({ v0: v46, ang: 30 }),
    book: { x: 18480 },
    relTol: 0.001,
    note: 'ρ = 16 км в высшей точке, α = 30°: x_max = 2ρ tg α = 18 475 м (в книге 18 480).',
  },
  p2752: {
    title: 'Мещерский 27.52–27.54: полёт с сопротивлением kPv — высшая точка',
    problem: plane({ kv: d52.k * G, v0: d52.v0, ang: d52.al, ask: 'apex' }),
    book: {
      y: (d52.v0 * Math.sin(rad(d52.al))) / (G * d52.k) - Math.log(1 + d52.k * d52.v0 * Math.sin(rad(d52.al))) / (G * d52.k ** 2),
      x: (d52.v0 ** 2 * Math.sin(rad(2 * d52.al))) / (2 * G * (d52.k * d52.v0 * Math.sin(rad(d52.al)) + 1)),
    },
    note: 'm = 1 кг, R = kPv, k = 0,01 с/м (k₁ = kmg), v₀ = 50 м/с, α = 60°.',
  },
  p2756: {
    title: 'Мещерский 27.56: притяжение к центру и сила тяжести',
    problem: plane({ c: 4, x0: 1, v0: 0, ang: 0, ask: 't', t: 0.7 }),
    book: { x: Math.cos(2 * 0.7), y: -(G / 4) * (1 - Math.cos(2 * 0.7)) },
    note: 'm = 1, сила притяжения k²mr, k = 2; x₀ = a = 1, v₀ = 0; ось y — вверх. Книга: x = a cos kt, y = (g/k²)(1 − cos kt) вниз.',
  },
  p2757: {
    title: 'Мещерский 27.57: отталкивание от центра — гипербола',
    problem: plane({ gravity: false, c: -2.25, x0: 1, v0: 2, ang: 90, ask: 't', t: 1 }),
    book: { x: Math.cosh(1.5), y: (2 / 1.5) * Math.sinh(1.5) },
    note: 'F = k²mr от центра, k = 1,5, a = 1, v₀ = 2 м/с вдоль y: x = a ch kt, y = (v₀/k) sh kt.',
  },
  p2762: {
    title: 'Мещерский 27.62: частица в магнитном поле — окружность',
    problem: plane({ gravity: false, q: 2, v0: 3, ang: 0, ask: 't', t: Math.PI / 2 }),
    book: { x: 0, y: -3 },
    note: 'm = 1, v₀ = 3, сила q·(v × ẑ), q = 2: радиус mv₀/q = 1,5; через полпериода точка на расстоянии 2R.',
  },
} satisfies Record<string, PlanePreset>;
export type PlanePresetKey = keyof typeof PLANE_PRESETS;
