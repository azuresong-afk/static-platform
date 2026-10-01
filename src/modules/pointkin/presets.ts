/** Готовые задачи: Мещерский §11–12 (скорость и ускорение точки). */
import type { KinProblem } from './model/kin';

export interface KinPreset {
  title: string;
  problem: KinProblem;
  /** Ответ: v, a, at, an, rho, alphaV, alphaA (углы с осью x, °). */
  book?: Record<string, number>;
  note?: string;
}

const kin = (o: Partial<KinProblem>): KinProblem => ({ mode: 'coord', x: '', y: '', z: '', s: '', rho: 0, r: '', phi: '', t: 1, t1: 0, t2: 0, ...o });
const g25 = { al: 3, be: 4, g: 9.81, t: 0.2 };

export const KIN_PRESETS = {
  k1228: {
    title: 'Мещерский 12.28: x = 2t, y = t² — скорость и ускорение',
    problem: kin({ x: '2t', y: 't^2', t: 1, t1: 0, t2: 2 }),
    book: { v: 2 * Math.SQRT2, a: 2, alphaV: 45, alphaA: 90 },
    note: 'Координаты в сантиметрах, t = 1 с: v = 2√2 см/с под 45° к оси x, a = 2 см/с² вдоль y.',
  },
  k1226: {
    title: 'Мещерский 12.26: винтовая линия — радиус кривизны',
    problem: kin({ x: '2cos(4t)', y: '2sin(4t)', z: '2t', t: 0.3, t1: 0, t2: 1.6 }),
    book: { rho: 2.125 },
    note: 'x = 2 cos 4t, y = 2 sin 4t, z = 2t: ρ = 2⅛ м.',
  },
  k1225: {
    title: 'Мещерский 12.25: полёт без сопротивления — касательное и нормальное ускорения',
    problem: kin({ x: '3t', y: '4t − 9,81t^2/2', t: g25.t, t1: 0, t2: 0.8 }),
    book: {
      at: (-g25.g * (g25.be - g25.g * g25.t)) / Math.hypot(g25.al, g25.be - g25.g * g25.t),
      an: (g25.g * g25.al) / Math.hypot(g25.al, g25.be - g25.g * g25.t),
    },
    note: 'x = αt, y = βt − gt²/2, α = 3, β = 4 м/с, t = 0,2 с: w_τ = −g(β − gt)/v, w_n = gα/v.',
  },
  k1229: {
    title: 'Мещерский 12.29: кубическая парабола — радиус кривизны в начале',
    problem: kin({ x: '4t', y: 't^3', t: 0, t1: -2, t2: 2 }),
    book: { an: 0 },
    note: 'x = 4t, y = t³: при t = 0 точка перегиба, a_n = 0, ρ₀ = ∞.',
  },
  k129: {
    title: 'Мещерский 12.9: поезд на закруглении радиуса 800 м',
    problem: kin({ mode: 'natural', s: 't^2/18', rho: 800, t: 120 }),
    book: { at: 1 / 9, an: 2 / 9, a: 0.25 },
    note: 'Равноускоренно до 72 км/ч за 3 мин: a_τ = 20/180 = 1/9 м/с², s = t²/18; через 2 мин a_n = 2/9, a = 0,25 м/с².',
  },
  k128: {
    title: 'Мещерский 12.8: поезд на закруглении радиуса 1 км',
    problem: kin({ mode: 'natural', s: '15t + t^2/6', rho: 1000, t: 30 }),
    book: { v: 25, a: 0.708 },
    note: 'v₀ = 54 км/ч, 600 м за 30 с равнопеременно: a_τ = 1/3 м/с²; в конце 30-й секунды v = 25 м/с, w = 0,708 м/с².',
  },
  k1227: {
    title: 'Мещерский 12.27: логарифмическая спираль r = ae^{kt}, φ = kt',
    problem: kin({ mode: 'polar', r: 'exp(0,5t)', phi: '0,5t', t: 1, t1: 0, t2: 6 }),
    book: { v: 0.5 * Math.exp(0.5) * Math.SQRT2, a: 2 * 0.25 * Math.exp(0.5), rho: Math.exp(0.5) * Math.SQRT2 },
    note: 'a = 1, k = 0,5, t = 1: v = kr√2, w = 2k²r, ρ = r√2.',
  },
  k1230: {
    title: 'Мещерский 12.30–12.32: точка линейки кривошипного механизма — кардиоида',
    problem: kin({ mode: 'polar', r: '0,5(1 + cos(t))', phi: 't', t: 0.7, t1: 0, t2: 6.3 }),
    book: { v: 0.5 * 2 * Math.cos((2 * 0.7) / 4), a: ((0.5 * 4) / 4) * Math.sqrt(5 + 4 * Math.cos((2 * 0.7) / 2)) },
    note: 'a = 0,5 м, ω = 2 рад/с: r = a(1 + cos(ωt/2)), φ = ωt/2; v = aω cos(ωt/4), w = (aω²/4)√(5 + 4 cos(ωt/2)). При t = 0 ρ = 4a/3 (12.32).',
  },
} satisfies Record<string, KinPreset>;

export type KinPresetKey = keyof typeof KIN_PRESETS;
