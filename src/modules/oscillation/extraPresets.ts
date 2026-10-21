/** Готовые задачи пункта 28 для «Удара и колебаний»: Мещерский §29, 32, 39. Числа — по формулам книги, где в условии буквы. */
import { extraProblem, findAsk, type ExtraProblem } from '../../shared/extra';
import { OSC_ASKS } from './model/extra';

export interface OscExtraPreset {
  title: string;
  problem: ExtraProblem;
  /** Ответ книги: числа, которые считает вопрос (vals). */
  book: Record<string, number>;
  relTol: number;
  note: string;
}
const xp = (id: string, n: Record<string, number>, s: Record<string, string> = {}) => extraProblem(findAsk(OSC_ASKS, id), n, s);
const G = 9.81;
const k3249 = Math.sqrt((((4 * 100 * 200 * 300) / (4 * 100 * 200 + 300 * 300)) * G) / 10);
const A3223 = Math.sqrt((10 / 1000) ** 2 + (10 * 0.2 ** 2) / (1000 * G));

export const OSC_EXTRA_PRESETS = {
  x3210: {
    title: 'Мещерский 32.10: стержень на шкивах — коэффициент трения по периоду колебаний',
    problem: xp('rollers', { l: 0.25, T: 2, x0: 0.05 }, { find: 'f' }),
    book: { f: 0.25 },
    relTol: 0.01,
    note: 'l = 25 см, T = 2 с. Книга: x = x₀ cos √(fg/l)·t, f = 4π²l/(gT²) ≈ 0,25 (по расчёту 0,2515).',
  },
  x3220: {
    title: 'Мещерский 32.20: период колебаний груза на пружине, скользящего по дуге окружности',
    problem: xp('arc', { l: 1.2, a: 1, b: 0.2, phi0: 5, v0: 0 }),
    book: { T: 2 * Math.PI * Math.sqrt(1.2 / G) },
    relTol: 1e-9,
    note: 'Задача в буквах при l = a + b; числа — для примера. Книга: T = 2π√(l/g).',
  },
  x3221: {
    title: 'Мещерский 32.21: уравнение движения груза на дуге при начальном угле и скорости',
    problem: xp('arc', { l: 1.2, a: 1, b: 0.2, phi0: 5, v0: 0.1 }),
    book: { k: Math.sqrt(G / 1.2), B: -0.1 / Math.sqrt(1.2 * G) },
    relTol: 1e-9,
    note: 'Числа — для примера. Книга: φ = φ₀ cos √(g/l)·t − (v₀/√(lg)) sin √(g/l)·t.',
  },
  x3222: {
    title: 'Мещерский 32.22: период малых колебаний тела на пружине с предварительным натягом',
    problem: xp('pretens', { m: 1, c: 100, l0: 0.2, l: 0.3 }),
    book: { T: 2 * Math.PI * Math.sqrt(0.3 / 10) },
    relTol: 1e-9,
    note: 'Числа — для примера: F₀ = c(l − l₀) = 10 Н. Книга: T = 2π√(ml/F₀).',
  },
  x3223: {
    title: 'Мещерский 32.23: сила Q прикладывается в крайнем нижнем положении груза',
    problem: xp('stages', { P: 10, c: 1000, v0: 0.2, Q: 5 }),
    book: { A1: A3223, A2: A3223 - 0.005, T: 2 * Math.PI * Math.sqrt(10 / (1000 * G)) },
    relTol: 1e-9,
    note: 'Числа — для примера. Книга: x = Q/c + (√(P²/c² + Pv₀²/(cg)) − Q/c) cos √(cg/P)·t, T = 2π√(P/(cg)).',
  },
  x3249: {
    title: 'Мещерский 32.49: собственная частота груза на пружине, подвешенной к стержню на двух пружинах',
    problem: xp('three', { c1: 100, c2: 200, c3: 300, P: 10 }),
    book: { k: k3249 },
    relTol: 1e-9,
    note: 'Числа — для примера. Книга: k = √(4c₁c₂c₃·g / (P[4c₁c₂ + c₃(c₁ + c₂)])).',
  },
  x3250: {
    title: 'Мещерский 32.50: полная механическая энергия груза и пружины от положения статического равновесия',
    problem: xp('energy', { P: 10, c: 2, x: 1, v: 10, g: 981 }, { origin: 'static' }),
    book: { W: ((10 / 981) * 100) / 2 + 1 },
    relTol: 1e-9,
    note: 'P = 10 кГ, c = 2 кГ/см; смещение 1 см и скорость 10 см/с — для примера. Книга: W = mẋ²/2 + cx²/2.',
  },
  x2914: {
    title: 'Мещерский 29.14: полная механическая энергия груза на пружине от конца нерастянутой пружины',
    problem: xp('energy', { P: 10, c: 2, x: 6, v: 10, g: 981 }, { origin: 'free' }),
    book: { W: ((10 / 981) * 100) / 2 + 36 - 60 },
    relTol: 1e-9,
    note: 'Числа — для примера (P = 10 кГ, c = 2 кГ/см, x = 6 см, ẋ = 10 см/с). Книга: W = (P/2g)ẋ² + cx²/2 − Px = const.',
  },
  x3923: {
    title: 'Мещерский 39.23: период малых колебаний полукруглого диска на шероховатой плоскости',
    problem: xp('rolling', { R: 0.1 }, { shape: 'halfdisk' }),
    book: { T: Math.PI * Math.sqrt(((9 * Math.PI - 16) * 0.1) / (2 * G)) },
    relTol: 1e-9,
    note: 'Задача в буквах; R = 10 см — для примера. Книга: T = π√((9π − 16)R/(2g)).',
  },
} satisfies Record<string, OscExtraPreset>;
export type OscExtraKey = keyof typeof OSC_EXTRA_PRESETS;
