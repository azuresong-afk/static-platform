/** Готовые задачи: Мещерский §27 (прямолинейное движение). Ответы — по книге или по её формулам. */
import { G } from '../rotation/model/rotation';
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
