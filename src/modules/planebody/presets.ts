/** Готовые задачи вкладки «Реакции при плоском движении»: Мещерский §39, 41, 43. Ответы — по книге или по её формулам. */
import { G } from '../rotation/model/rotation';
import type { BodyProblem, Constr, Load } from './model/body';

export interface BodyPreset {
  title: string;
  problem: BodyProblem;
  /**
   * Ответ: ax, ay, eps (м/с², рад/с²); реакции — «номер связи.имя» (например, «0.T», «1.N»); along/perp — проекции
   * реакции связи 0 на направление CO и перпендикуляр к нему (43.10).
   */
  book?: Record<string, number>;
  relTol?: number;
  /** Допуск для ответа «0». */
  absTol?: number;
  note?: string;
}
const rad = (a: number) => (a * Math.PI) / 180;
/** Вычисленные исходные данные — с шестью знаками после запятой, как их ввёл бы студент. */
const q = (x: number) => Math.round(x * 1e6) / 1e6;
const c = (o: Partial<Constr>): Constr => ({ kind: 'pin', at: 'A', ang: 90, one: true, f: 0, qx: 0, qy: 0, ...o });
export const body = (o: Partial<BodyProblem>): BodyProblem => ({
  byWeight: true,
  m: 1,
  g: G,
  gravity: true,
  shape: 'rod',
  L: 2,
  theta: 0,
  R: 0.2,
  a: 1,
  b: 0.5,
  rho: 0.2,
  J: 1,
  points: [],
  constr: [],
  loads: [] as Load[],
  omega: 0,
  vx: 0,
  vy: 0,
  mode: 'dyn',
  ax: 0,
  ay: 0,
  eps: 0,
  ...o,
});
// 39.21: α = 30°, f = 0,1, r = 0,2 м; нормаль к плоскости n = (sin α, cos α).
const s21 = { al: 30, f: 0.1, r: 0.2 };
const n21 = [Math.sin(rad(s21.al)), Math.cos(rad(s21.al))];
// 43.5: длина a = 1 м, φ₀ = 60°; отход от стены при sin φ₁ = (2/3) sin φ₀, φ̇² = (3g/a)(sin φ₀ − sin φ).
const s5 = { a: 1, ph0: 60 };
const ph1 = (Math.asin((2 / 3) * Math.sin(rad(s5.ph0))) * 180) / Math.PI;
const w5 = Math.sqrt((3 * G * (Math.sin(rad(s5.ph0)) - Math.sin(rad(ph1)))) / s5.a);
// 43.10: a = 0,4 м, ρ = 0,25 м, φ₀ = 60°, φ = 20°; ω² = 2ga(cos φ − cos φ₀)/(ρ² + a²).
const s10 = { a: 0.4, rho: 0.25, ph0: 60, ph: 20 };
const w10 = Math.sqrt((2 * G * s10.a * (Math.cos(rad(s10.ph)) - Math.cos(rad(s10.ph0)))) / (s10.rho ** 2 + s10.a ** 2));
// 41.15: m = 1000 кг, h = 0,6 м, a = 1,2 м (до передней оси), b = 1,4 м (до задней), w = 2 м/с².
const s15 = { m: 1000, h: 0.6, a: 1.2, b: 1.4, w: 2 };

export const BODY_PRESETS = {
  m3917: {
    title: 'Мещерский 39.17: стержень на двух нитях — натяжение в момент обрыва другой',
    problem: body({ constr: [c({ kind: 'rope', at: 'A', qx: -1, qy: 1 })] }),
    book: { '0.T': 0.25 },
    relTol: 1e-9,
    note: 'Вес P = 1, длина 2 м; оборвалась нить у конца B. Книга: T = P/4.',
  },
  m3918: {
    title: 'Мещерский 39.18: стержень на двух нитях из одной точки — обрыв одной',
    problem: body({ L: 1, constr: [c({ kind: 'rope', at: 'A', qx: 0, qy: q(Math.sin(rad(60))) })] }),
    book: { '0.T': 0.266 },
    relTol: 0.002,
    note: 'Нити длиной l = AB, треугольник OAB равносторонний; P = 1. Книга: T = 0,266P (по расчёту 0,2665P).',
  },
  m3919: {
    title: 'Мещерский 39.19: давление на опору в момент удаления другой',
    problem: body({ points: [{ name: 'D', x: -0.5, y: 0 }], constr: [c({ kind: 'roller', at: 'D', ang: 90 })] }),
    book: { '0.N': 0.5 + (1 - 3 * 0.25) / (2 * (1 + 3 * 0.25)) },
    relTol: 1e-9,
    note: 'Длина 2l = 2 м, опора D на расстоянии a = 0,5 м от C, P = 1. Книга: давление получает приращение (l² − 3a²)P/(2(l² + 3a²)).',
  },
  m3920: {
    title: 'Мещерский 39.20: цилиндр падает, разматывая нить, — натяжение',
    problem: body({ byWeight: false, shape: 'disk', R: 0.1, points: [{ name: 'K', x: -0.1, y: 0 }], constr: [c({ kind: 'unwind', at: 'K', ang: 90 })] }),
    book: { '0.T': G / 3, ay: (-2 * G) / 3 },
    relTol: 1e-9,
    note: 'm = 1 кг, r = 0,1 м; нить вертикальна, сходит с цилиндра в точке K. Книга: T = mg/3, ускорение оси 2g/3 (v = (2/3)√(3gh)).',
  },
  m3921: {
    title: 'Мещерский 39.21: цилиндр на наклонной плоскости разматывает нити, трение о плоскость',
    problem: body({
      shape: 'disk',
      R: s21.r,
      points: [
        { name: 'K', x: q(-s21.r * n21[0]), y: q(-s21.r * n21[1]) },
        { name: 'D', x: q(s21.r * n21[0]), y: q(s21.r * n21[1]) },
      ],
      constr: [c({ kind: 'roller', at: 'K', ang: 90 - s21.al, f: s21.f }), c({ kind: 'unwind', at: 'D', ang: 180 - s21.al })],
    }),
    book: {
      '1.T': (2 / 6) * (Math.sin(rad(s21.al)) + s21.f * Math.cos(rad(s21.al))),
      aDown: (2 / 3) * G * (Math.sin(rad(s21.al)) - 2 * s21.f * Math.cos(rad(s21.al))),
    },
    relTol: 1e-5,
    note: 'α = 30°, f = 0,1, P = 1; нити параллельны плоскости, сходят с верхней точки D. Книга: s = (1/3)g(sin α − 2f cos α)t², натяжение каждой из двух нитей T = (1/6)P(sin α + f cos α); здесь одна нить — их сумма 2T.',
  },
  m435: {
    title: 'Мещерский 43.5: стержень скользит по стене и полу — угловое ускорение в начале',
    problem: body({ L: s5.a, theta: -s5.ph0, constr: [c({ kind: 'roller', at: 'A', ang: 0 }), c({ kind: 'roller', at: 'B', ang: 90 })] }),
    book: { eps: ((3 * G) / (2 * s5.a)) * Math.cos(rad(s5.ph0)) },
    relTol: 1e-9,
    note: 'a = 1 м, φ₀ = 60°, гладкие стена (конец A) и пол (конец B), без начальной скорости. Книга: φ̈ = (3g/2a) cos φ.',
  },
  m435b: {
    title: 'Мещерский 43.5: в момент отхода стержня от стены давление на стену равно нулю',
    problem: body({
      L: s5.a,
      theta: q(-ph1),
      constr: [c({ kind: 'roller', at: 'A', ang: 0 }), c({ kind: 'roller', at: 'B', ang: 90 })],
      omega: q(w5),
      vx: q((s5.a / 2) * w5 * Math.sin(rad(ph1))),
      vy: q((-s5.a / 2) * w5 * Math.cos(rad(ph1))),
    }),
    book: { '0.N': 0 },
    absTol: 1e-5,
    note: `φ₀ = 60°; книга: sin φ₁ = (2/3) sin φ₀, φ₁ = ${ph1.toFixed(2).replace('.', ',')}°. Скорости в этот момент — из интеграла энергии: φ̇² = (3g/a)(sin φ₀ − sin φ₁), v_C = (a/2)φ̇.`,
  },
  m4310: {
    title: 'Мещерский 43.10: реакции оси физического маятника',
    problem: body({
      shape: 'rho',
      rho: s10.rho,
      points: [{ name: 'O', x: q(-s10.a * Math.sin(rad(s10.ph))), y: q(s10.a * Math.cos(rad(s10.ph))) }],
      constr: [c({ kind: 'pin', at: 'O' })],
      omega: q(w10),
      vx: q(w10 * s10.a * Math.cos(rad(s10.ph))),
      vy: q(w10 * s10.a * Math.sin(rad(s10.ph))),
    }),
    book: {
      along: Math.cos(rad(s10.ph)) + ((2 * s10.a ** 2) / (s10.rho ** 2 + s10.a ** 2)) * (Math.cos(rad(s10.ph)) - Math.cos(rad(s10.ph0))),
      perp: (s10.rho ** 2 / (s10.rho ** 2 + s10.a ** 2)) * Math.sin(rad(s10.ph)),
    },
    relTol: 1e-5,
    note: 'P = 1, OC = a = 0,4 м, ρ = 0,25 м, φ₀ = 60°, в положении φ = 20°; ω — из интеграла энергии. Книга: R = P cos φ + (2Pa²/(ρ² + a²))(cos φ − cos φ₀), N = P(ρ²/(ρ² + a²)) sin φ.',
  },
  m413: {
    title: 'Мещерский 41.3: силы инерции колеса, катящегося с ускорением',
    problem: body({ shape: 'disk', R: 0.5, gravity: false, mode: 'given', ax: 2, eps: -4 }),
    book: { Phix: -2 / G, MPhi: (0.5 * 0.5 ** 2 * 4) / G },
    relTol: 1e-9,
    note: 'Вес P = 1, r = 0,5 м, x_C = at²/2, a = 2 м/с²; без скольжения ε = −a/r (вращение по часовой стрелке). Книга: главный вектор Pa/g против движения, главный момент Pra/(2g).',
  },
  m4115: {
    title: 'Мещерский 41.15: давление колёс автомобиля при разгоне',
    problem: body({
      byWeight: false,
      m: s15.m,
      shape: 'J',
      J: 500,
      points: [
        { name: 'F', x: s15.a, y: -s15.h },
        { name: 'Z', x: -s15.b, y: -s15.h },
      ],
      constr: [c({ kind: 'roller', at: 'F', ang: 90 }), c({ kind: 'roll', at: 'Z', ang: 90 })],
      mode: 'given',
      ax: s15.w,
    }),
    book: { '0.N': (s15.m * (G * s15.b - s15.w * s15.h)) / (s15.a + s15.b), '1.N': (s15.m * (G * s15.a + s15.w * s15.h)) / (s15.a + s15.b) },
    relTol: 1e-9,
    note: 'm = 1000 кг, центр тяжести на высоте h = 0,6 м, до передней оси a = 1,2 м, до задней b = 1,4 м, ускорение w = 2 м/с², ведущие колёса задние. Книга: N₁ = P(b − hw/g)/(a + b), N₂ = P(a + hw/g)/(a + b); давления равны при w = g(b − a)/(2h), то есть при a > b — при торможении с замедлением g(a − b)/(2h) (ответ книги).',
  },
} satisfies Record<string, BodyPreset>;
export type BodyPresetKey = keyof typeof BODY_PRESETS;
