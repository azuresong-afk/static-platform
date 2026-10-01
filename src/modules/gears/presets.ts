/** Готовые задачи: Мещерский §13 (вращение тела) и §14 (передачи). */
import type { EllProblem } from './model/ellipse';
import type { FrProblem } from './model/friction';
import type { GearProblem, Wheel } from './model/gears';
import type { UniProblem } from './model/uniform';

export interface GearPreset {
  title: string;
  problem: GearProblem;
  /**
   * Ответ. Цепочка: omega (|ω_k|), eps, n (об/мин), phi (φ₁), turns, i (ω₁/ω_k), v, at, an, a, t (найденный момент), size.
   * Равнопеременное: w0, w, eps, t, phi (рад/с, рад/с², с, рад). Эллипсы: wmin, wmax, w2, eps2. Фрикцион: omega, eps, a, t.
   */
  book?: Record<string, number>;
  note?: string;
}

const W = (r: number, z = 0, link: Wheel['link'] = 'shaft'): Wheel => ({ r, z, link });
export const UNI0: UniProblem = { w0: 0, w: 0, eps: 0, t: 1, phi: 0, known: ['w0', 'eps', 't'], wUnit: 'rpm', phiUnit: 'turn' };
export const ELL0: EllProblem = { a: 25, b: 15, pivot: 'focus', A: 0, w1: 270, unit: 'rpm', phi: 0 };
export const FR0: FrProblem = { law: '20πt', r: 5, d: '10 − 0,5t', R: 15, t: 0, find: true, dTarget: 5, tMax: 20 };
const g = (o: Partial<GearProblem>): GearProblem => ({ mode: 'chain', drive: 'phi', law: 't', wheels: [W(1)], k: 0, rho: 0, t: 1, find: 'none', target: 0, unit: 'rpm', u: 0, uKey: 'r', tMax: 0, uni: UNI0, ell: ELL0, fr: FR0, ...o });
const uni = (o: Partial<UniProblem>) => g({ mode: 'uniform', uni: { ...UNI0, ...o } });
const ell = (o: Partial<EllProblem>) => g({ mode: 'ellipse', ell: { ...ELL0, ...o } });
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
    problem: g({ law: '0,2πt^2', wheels: [W(75), W(30, 0, 'belt')], k: 1, find: 'time', target: 300, unit: 'rpm', tMax: 20 }),
    book: { t: 10 },
    note: 'Шкив мотора B (r = 75 см) разгоняется с ε = 0,4π с⁻²; шкив станка A (r = 30 см): 300 об/мин через 10 с.',
  },
  g149: {
    title: 'Мещерский 14.9: коническая передача — время разгона',
    problem: g({ law: '2πt^2', wheels: [W(15), W(10, 0, 'bevel')], k: 1, find: 'time', target: 4320, unit: 'rpm', tMax: 40 }),
    book: { t: 24 },
    note: 'Ведущее колесо O₂ (r₂ = 15 см) из покоя с ε = 2 об/с² = 4π с⁻²; колесо O₁ (r₁ = 10 см) наберёт 4320 об/мин через 24 с.',
  },
  g141: {
    title: 'Мещерский 14.1: внутреннее зацепление — диаметр второго колеса',
    problem: g({ law: '10πt/3', wheels: [W(180), W(0, 0, 'int')], k: 1, find: 'size', target: 300, unit: 'rpm', u: 1, uKey: 'r', tMax: 1 }),
    book: { size: 60 },
    note: 'D₁ = 360 мм, n₁ = 100 об/мин, n₂ = 300 об/мин: D₂ = 120 мм (r₂ = 60 мм).',
  },
  u134: {
    title: 'Мещерский 13.4: 3600 оборотов за 2 мин из покоя — угловое ускорение',
    problem: uni({ w0: 0, t: 120, phi: 3600, known: ['w0', 't', 'phi'], wUnit: 'rad', phiUnit: 'turn' }),
    book: { eps: PI },
    note: 'Равноускоренно из покоя: ε = π с⁻².',
  },
  u135: {
    title: 'Мещерский 13.5: 12,5 оборота за 5 с из покоя — угловая скорость',
    problem: uni({ w0: 0, t: 5, phi: 12.5, known: ['w0', 't', 'phi'], wUnit: 'rad', phiUnit: 'turn' }),
    book: { w: 10 * PI },
    note: 'ω = 5 об/с = 10π с⁻¹.',
  },
  u136: {
    title: 'Мещерский 13.6: разгон до 120 об/мин за 10 мин — число оборотов',
    problem: uni({ w0: 0, w: 120, t: 600, known: ['w0', 'w', 't'], wUnit: 'rpm', phiUnit: 'turn' }),
    book: { phi: 1200 * PI },
    note: '600 оборотов (φ = 1200π рад).',
  },
  u137: {
    title: 'Мещерский 13.7: остановка после 10 оборотов — угловое ускорение',
    problem: uni({ w0: 2 * PI, w: 0, phi: 10, known: ['w0', 'w', 'phi'], wUnit: 'rad', phiUnit: 'turn' }),
    book: { eps: -0.1 * PI },
    note: 'ω₀ = 2π с⁻¹, остановилось через 10 оборотов: ε = 0,1π с⁻², вращение замедленное.',
  },
  u138: {
    title: 'Мещерский 13.8: пропеллер, 1200 об/мин, 80 оборотов до остановки — время',
    problem: uni({ w0: 1200, w: 0, phi: 80, known: ['w0', 'w', 'phi'], wUnit: 'rpm', phiUnit: 'turn' }),
    book: { t: 8 },
    note: 'Равнозамедленно: t = 8 с.',
  },
  e146: {
    title: 'Мещерский 14.6: эллиптические колёса на фокусах — крайние угловые скорости',
    problem: ell({ a: 25, b: 15, pivot: 'focus', A: 50, w1: 270, unit: 'rpm', phi: 0 }),
    book: { wmin: PI, wmax: 81 * PI },
    note: 'OO₁ = 50 см, полуоси 25 и 15 см, 270 об/мин: ω_min = π с⁻¹, ω_max = 81π с⁻¹.',
  },
  e147: {
    title: 'Мещерский 14.7: закон передачи эллиптических колёс (a = 25, b = 15, φ = 60°)',
    problem: ell({ a: 25, b: 15, pivot: 'focus', A: 0, w1: 1, unit: 'rad', phi: 60 }),
    book: { w2: (25 * 25 - 400) / (625 - 2 * 25 * 20 * 0.5 + 400) },
    note: 'ω₂ = ω₁(a² − c²)/(a² − 2ac cos φ + c²), c = √(a² − b²); численный пример при ω₁ = 1.',
  },
  e148: {
    title: 'Мещерский 14.8: овальные колёса на центрах',
    problem: ell({ a: 40, b: 10, pivot: 'center', A: 50, w1: 240, unit: 'rpm', phi: 0 }),
    book: { wmin: 2 * PI, wmax: 32 * PI },
    note: 'Межосевое 50 см, полуоси 40 и 10 см, 240 об/мин: ω_min = 2π с⁻¹, ω_max = 32π с⁻¹.',
  },
  f1410: {
    title: 'Мещерский 14.10: лобовая фрикционная передача, d = 10 − 0,5t',
    problem: g({ mode: 'friction', fr: FR0 }),
    book: { t: 10, eps: 2 * PI, a: 30 * PI * Math.sqrt(40000 * PI * PI + 1) },
    note: 'Вал I — 600 об/мин, r = 5 см, R = 15 см: ε = 50π/d² с⁻² (при d = r: 2π), w = 30π√(40 000π² + 1) см/с².',
  },
} satisfies Record<string, GearPreset>;

export type GearPresetKey = keyof typeof GEAR_PRESETS;
