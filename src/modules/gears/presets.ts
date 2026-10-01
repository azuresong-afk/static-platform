/** Готовые задачи: Мещерский §13 (вращение тела) и §14 (передачи). */
import type { GearProblem, Wheel } from './model/gears';

export interface GearPreset {
  title: string;
  problem: GearProblem;
  /** Ответ: omega (|ω_k|), eps, n (об/мин), phi (φ₁), turns, i (ω₁/ω_k), v, at, an, a, t (найденный момент). */
  book?: Record<string, number>;
  note?: string;
}

const W = (r: number, z = 0, link: Wheel['link'] = 'shaft'): Wheel => ({ r, z, link });
const g = (o: Partial<GearProblem>): GearProblem => ({ drive: 'phi', law: 't', wheels: [W(1)], k: 0, rho: 0, t: 1, find: false, target: 0, unit: 'rpm', tMax: 0, ...o });
const PI = Math.PI;

export const GEAR_PRESETS = {
  g1315: {
    title: 'Мещерский 13.15: маховик разгоняется равноускоренно',
    problem: g({ law: '2,5t^2', wheels: [W(2)], t: 15, tMax: 20 }),
    book: { v: 150, an: 11250, at: 10 },
    note: 'R = 2 м, через 10 с скорость обода 100 м/с ⇒ ε = 5 рад/с², φ = 2,5t²; при t = 15 с v = 150 м/с, w_n = 11 250 м/с², w_τ = 10 м/с².',
  },
  g132: {
    title: 'Мещерский 13.2: пуск турбины, φ = πt³',
    problem: g({ law: 'πt^3', t: 3, tMax: 4 }),
    book: { n: 810 },
    note: 'Угол поворота пропорционален кубу времени, при t = 3 с n = 810 об/мин ⇒ φ = πt³ рад.',
  },
  g133: {
    title: 'Мещерский 13.3: маятник регулятора, 120 об/мин',
    problem: g({ law: 'π/6 + 4πt', t: 0.5, tMax: 1 }),
    book: { phi: (13 * PI) / 6, turns: 1 },
    note: 'φ₀ = π/6, ω = 4π рад/с; за t = 1/2 с: φ = 13π/6, Δφ = 2π (один оборот).',
  },
  g136: {
    title: 'Мещерский 13.6: число оборотов маховика за 10 мин',
    problem: g({ law: 'πt^2/300', t: 600, tMax: 700 }),
    book: { turns: 600, n: 120 },
    note: 'Из покоя равноускоренно до 120 об/мин за 10 мин: ε = 4π/600 рад/с², 600 оборотов.',
  },
  g1310: {
    title: 'Мещерский 13.10: крутильные колебания балансира',
    problem: g({ law: 'π/2·sin(4πt)', t: 2, tMax: 1 }),
    book: { omega: 2 * PI * PI, eps: 0 },
    note: 'T = 1/2 с, амплитуда π/2: φ = (π/2) sin 4πt; через 2 с ω = 2π² с⁻¹, ε = 0.',
  },
  g1311: {
    title: 'Мещерский 13.11: гармонические колебания маятника',
    problem: g({ law: 'π/16·sin(3πt/4)', t: 0, tMax: 6 }),
    book: { omega: (3 * PI * PI) / 64 },
    note: 'α = π/16 через 2/3 с ⇒ φ = (π/16) sin(3πt/4); наибольшая ω = 3π²/64 с⁻¹ — в отвесном положении (t = 0).',
  },
  g1320: {
    title: 'Мещерский 13.20: стрелка гальванометра в крайнем положении',
    problem: g({ law: 'π/30·sin(5πt)', wheels: [W(3)], t: 0.1, tMax: 0.8 }),
    book: { a: 77.5, omega: 0 },
    note: 'Длина 3 см, T = 0,4 с, φ₀ = π/30: в крайнем положении (t = 0,1 с) w = 77,5 см/с², в среднем (t = 0) — 8,1 см/с².',
  },
  g1318: {
    title: 'Мещерский 13.18: вал приводится гирей на нити, x = 100t²',
    problem: g({ drive: 'x', law: '100t^2', wheels: [W(10)], t: 1, tMax: 2 }),
    book: { omega: 20, eps: 20, a: 200 * Math.sqrt(401) },
    note: 'R = 10 см: ω = 20t с⁻¹, ε = 20 с⁻², w = 200√(1 + 400t⁴) см/с² (при t = 1 с).',
  },
  g1313: {
    title: 'Мещерский 13.13: скорость обода 2 м/с — обороты в минуту',
    problem: g({ drive: 'x', law: '2t', wheels: [W(0.5)], t: 1, tMax: 2 }),
    book: { n: 38.2 },
    note: 'R = 0,5 м, v = 2 м/с: n = 38,2 об/мин.',
  },
  g1312: {
    title: 'Мещерский 13.12: точка на поверхности Земли в Ленинграде',
    problem: g({ law: '2πt/86400', wheels: [W(0)], rho: 3185000, t: 0, tMax: 86400 }),
    book: { v: 232, a: 0.0169 },
    note: 'Широта 60°, R = 6370 км ⇒ расстояние до оси R cos 60° = 3185 км; сутки — 24 ч: v = 0,232 км/с, w = 0,0169 м/с².',
  },
  g142: {
    title: 'Мещерский 14.2: редуктор из четырёх шестерён',
    problem: g({ wheels: [W(0, 10), W(0, 60, 'ext'), W(0, 12), W(0, 70, 'ext')], k: 3, tMax: 1 }),
    book: { i: 35 },
    note: 'z₁ = 10, z₂ = 60, z₃ = 12, z₄ = 70: i = ω_I/ω_II = 35.',
  },
  g145: {
    title: 'Мещерский 14.5: домкрат — скорость зубчатой рейки',
    problem: g({ law: 'πt', wheels: [W(0, 6), W(0, 24, 'ext'), W(0, 8), W(0, 32, 'ext'), W(4)], k: 4, tMax: 2 }),
    book: { v: 0.78 },
    note: 'Рукоятка 30 об/мин; z₁ = 6, z₂ = 24, z₃ = 8, z₄ = 32, r₅ = 4 см: v_B = 7,8 мм/с (0,78 см/с).',
  },
  g144: {
    title: 'Мещерский 14.4: стрелочный индикатор, рейка x = a sin kt',
    problem: g({ drive: 'x', law: '0,5sin(2t)', wheels: [W(1), W(3), W(1.5, 0, 'ext')], k: 2, t: 0.4, tMax: 4 }),
    book: { omega: (3 / (1 * 1.5)) * 0.5 * 2 * Math.cos(0.8) },
    note: 'Численный пример: a = 0,5, k = 2, r₂ = 1, r₃ = 3, r₄ = 1,5; ответ книги ω₄ = r₃ak cos kt/(r₂r₄).',
  },
  g143: {
    title: 'Мещерский 14.3: ремённая передача — когда станок наберёт 300 об/мин',
    problem: g({ law: '0,2πt^2', wheels: [W(75), W(30, 0, 'belt')], k: 1, find: true, target: 300, unit: 'rpm', tMax: 20 }),
    book: { t: 10 },
    note: 'Шкив мотора B (r = 75 см) разгоняется с ε = 0,4π с⁻²; шкив станка A (r = 30 см): 300 об/мин через 10 с.',
  },
  g149: {
    title: 'Мещерский 14.9: коническая передача — время разгона',
    problem: g({ law: '2πt^2', wheels: [W(15), W(10, 0, 'bevel')], k: 1, find: true, target: 4320, unit: 'rpm', tMax: 40 }),
    book: { t: 24 },
    note: 'Ведущее колесо O₂ (r₂ = 15 см) из покоя с ε = 2 об/с² = 4π с⁻²; колесо O₁ (r₁ = 10 см) наберёт 4320 об/мин через 24 с.',
  },
} satisfies Record<string, GearPreset>;

export type GearPresetKey = keyof typeof GEAR_PRESETS;
