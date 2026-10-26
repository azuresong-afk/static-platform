/** Готовые задачи пункта 30 для «Удара и колебаний»: Мещерский §53, Яблонский Д.25. Числа — для примера, где в условии буквы. */
import { extraProblem, findAsk } from '../../shared/extra';
import { OSC_ASKS } from './model/extra';
import type { OscExtraPreset } from './extraPresets';

const xp = (id: string, n: Record<string, number>, s: Record<string, string> = {}) => extraProblem(findAsk(OSC_ASKS, id), n, s);
const G = 9.81;

// 53.48: подвес ξ = a sin pt — закрытая форма (частное решение + свободная часть по нулевым начальным условиям)
const l5348 = 1,
  a5348 = 0.01,
  p5348 = 2,
  T5348 = 10;
const k5348 = Math.sqrt(G / l5348);
const phi5348 = ((a5348 * p5348 * p5348) / (l5348 * (k5348 * k5348 - p5348 * p5348))) * (Math.sin(p5348 * T5348) - (p5348 / k5348) * Math.sin(k5348 * T5348));

// 53.50: x(T/2) по формуле книги x = F/(m(k² − ω²))[sin ωt − (ω/k) sin kt − (ω/k) ctg(πk/2ω) cos kt] при t = π/(2ω)
const m5350 = 1,
  c5350 = 100,
  F5350 = 10,
  w5350 = 4;
const k5350 = Math.sqrt(c5350 / m5350);
const x5350 =
  (F5350 / (m5350 * (k5350 * k5350 - w5350 * w5350))) *
  (1 -
    (w5350 / k5350) * Math.sin((Math.PI * k5350) / (2 * w5350)) -
    (w5350 / k5350) * (Math.cos((Math.PI * k5350) / (2 * w5350)) / Math.sin((Math.PI * k5350) / (2 * w5350))) * Math.cos((Math.PI * k5350) / (2 * w5350)));

export const OSC_EXTRA_PRESETS2 = {
  x5345: {
    title: 'Мещерский 53.45: противовес в желобе коленчатого вала — частота малых колебаний',
    problem: xp('crank', { r: 0.1, l: 0.02, w: 100, phi0: 5 }),
    book: { k: 100 * Math.sqrt(0.2) },
    relTol: 1e-9,
    note: 'Задача в буквах; r = 10 см, l = 2 см, ω = 100 1/с — для примера. Книга: k = ω√(l/r). Дополнительно — точный период при амплитуде φ₀.',
  },
  x5348: {
    title: 'Мещерский 53.48: маятник с подвесом, движущимся по закону ξ(t) — закон движения',
    problem: xp('swing', { l: l5348, g: G, phi0: 0, w0: 0, a: a5348, p: p5348, T: T5348 }, { kind: 'harm' }),
    book: { k: k5348, phiEnd: phi5348, phiClosed: phi5348 },
    relTol: 1e-4,
    note: 'Задача в буквах; ξ = 0,01 sin 2t, l = 1 м — для примера. Книга: φ = C₁ sin kt + C₂ cos kt − (1/(lk))∫ξ̈(τ) sin k(t − τ) dτ. Интеграл вычислен численно и сверен с замкнутой формулой для ξ = a sin pt.',
  },
  x5350: {
    title: 'Мещерский 53.50: колебания груза на пружине под действием силы F|sin ωt|',
    problem: xp('absin', { m: m5350, c: c5350, F: F5350, w: w5350, nper: 3 }),
    book: { k: k5350, xHalf: x5350 },
    relTol: 1e-6,
    note: 'Числа — для примера: m = 1 кг, c = 100 Н/м, F = 10 Н, ω = 4 1/с. Книга: при 0 ≤ t ≤ π/ω x = F/(m(k² − ω²))[sin ωt − (ω/k) sin kt − (ω/k) ctg(πk/2ω) cos kt]; далее повторяется с периодом π/ω.',
  },
  x5353: {
    title: 'Мещерский 53.53: критическая скорость тяжёлого вала — шарнир на одном конце, заделка на другом',
    problem: xp('shaft', { EJ: 1e5, q: 200, l: 3, g: G }, { sup: 'pc' }),
    book: { coef: 15.4 },
    relTol: 0.005,
    note: 'Задача в буквах; числа — для примера. Книга: ω_кр = 15,4√(EJg/(ql⁴)) (в скане «15,…»); по расчёту λ² = 15,418, λ = 3,9266 — корень tg λ = th λ.',
  },
  yD25: {
    title: 'Яблонский, Д.25: вынужденные колебания системы с одной степенью свободы — приведение системы тел к одной координате (пример)',
    problem: xp('reduce', {}, { by: 'eta' }),
    book: { k: 10.2, n: 2.55, alpha: 104.5, A: 0.00325, p1: 9.53, Amax: 0.00537, Avel: 0.0531, p3: 10.9, Aacc: 0.559, h: 0.271 },
    relTol: 0.025,
    note: 'Пример книги (рис. 241): m₁ = 20, m₂ = 5, m₃ = 2, m₄ = 18 кг, R = 0,3, l = 0,9 м, c₁ = 40, c₂ = 70 Н/см, P = 20 Н, A = 0,1 м, p = 4π 1/с, η = 0,812. a = [3m₁/2 + 4m₂ + 4m₃ + 4m₄/3]R² = 7,38 кг·м², c = [2c₁ + c₂/9 − 2(G₃ + G₄)/l]R². Расхождение: k по формулам книги 10,09 против 10,2 в книге (≈ 1 %), отсюда 1–2 % в n, p₁, A_max.',
  },
} satisfies Record<string, OscExtraPreset>;
export type OscExtraKey2 = keyof typeof OSC_EXTRA_PRESETS2;
