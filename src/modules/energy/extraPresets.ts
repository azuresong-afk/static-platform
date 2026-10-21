/** Готовые задачи пункта 24 для «Кинетической энергии»: §38. Числа ответов — по формулам книги (в условии даны буквы). */
import { extraProblem, findAsk, type ExtraProblem } from '../../shared/extra';
import { ENERGY_ASKS } from './model/extra';

export interface ExtraPreset {
  title: string;
  problem: ExtraProblem;
  /** Ответ книги: числа, которые считает вопрос (vals). */
  book: Record<string, number>;
  relTol: number;
  note: string;
}
const xp = (id: string, n: Record<string, number>, s: Record<string, string> = {}) => extraProblem(findAsk(ENERGY_ASKS, id), n, s);

export const ENERGY_EXTRA_PRESETS = {
  x3804: {
    title: 'Мещерский 38.4: кинетическая энергия гусеницы трактора',
    problem: xp('track', { gamma: 1, l: 3, r: 0.5, v0: 2 }),
    book: { T: 3.727459 },
    relTol: 1e-5,
    note: 'Ответ книги: T = 2γ(l + πr)v₀²/g; числа — взятые для примера.',
  },
  x3815: {
    title: 'Мещерский 38.15: наибольшее опускание груза на нити между блоками',
    problem: xp('pulley', { p: 1, p1: 1, l: 1, hq: 0 }),
    book: { h: 1.333333 },
    relTol: 1e-5,
    note: 'Ответ книги: h = 4pp₁l/(4p² − p₁²) при p₁ < 2p; числа — для примера.',
  },
  x3816: {
    title: 'Мещерский 38.16: груз на стержне и груз на нити — скорость от высоты',
    problem: xp('slide', { P: 1, P1: 2, a: 0.5, h: 0.5 }),
    book: { v: 2.494519 },
    relTol: 1e-5,
    note: 'Ответ книги — формула v²(h); числа — для примера.',
  },
  x3817: {
    title: 'Мещерский 38.17: коэффициент трения из остановки груза',
    problem: xp('stop2', { Q: 0.8, P: 0.1, P1: 0.1, s1: 0.5, s2: 0.3 }),
    book: { f: 0.2 },
    relTol: 0.02,
    note: 'Книга: f = 0,2; формула с данными (Q = 0,8; P = P₁ = 0,1 кГ; s₁ = 50, s₂ = 30 см) даёт 0,203 — округление в ответе.',
  },
  x3818: {
    title: 'Мещерский 38.18: время схода весомой нити со стола',
    problem: xp('table', { L: 2, l: 0.5, f: 0 }),
    book: { T: 0.931691, v: 4.288794 },
    relTol: 1e-5,
    note: 'Книга: T = √(L/g)·ln[(L + √(L² − l²))/l]; числа — для примера.',
  },
  x3819: {
    title: 'Мещерский 38.19: скорость нити, сходящей со штифта',
    problem: xp('peg', { a: 1, v0: 1, d: 0 }),
    book: { v: 3.287856 },
    relTol: 1e-5,
    note: 'Книга: v = √(ag + v₀²); числа — для примера.',
  },
  x3834: {
    title: 'Мещерский 38.34: падение стремянки на гладком полу',
    problem: xp('ladder', { l: 1, rho: 0.5, h0: 1.5, hq: 0.75, P: 1 }),
    book: { v1: 6.86207, v2: 4.498125 },
    relTol: 1e-5,
    note: 'Книга: 1) v = 2l√(gh/(l² + ρ²)); 2) v = ½√(gh(16l² − h²)/(2(l² + ρ²))), h — начальная высота; числа — для примера. Реакцию пола книга не спрашивает.',
  },
  x3835: {
    title: 'Мещерский 38.35: скорость центра падающего стержня от высоты',
    problem: xp('rod', { a: 1, h: 0.5, P: 1 }),
    book: { v: 2.606058 },
    relTol: 1e-5,
    note: 'Книга: v = (a − h)√(6g(a + h)/(4a² − 3h²)); реакция пола N — дополнение.',
  },
  x3847: {
    title: 'Мещерский 38.47: скорость груза на тросе, навитом на барабан',
    problem: xp('cable', { P: 10, p: 1, J: 2, R: 0.5, l: 10, x0: 1, x: 5 }),
    book: { v: 3.218675 },
    relTol: 1e-5,
    note: 'Книга: v = R√(g[2P + p(x + x₀)](x − x₀)/(Jg + (P + pl)R²)); числа — для примера.',
  },
  x3848: {
    title: 'Мещерский 38.48: груз и трос через блок к катку с трением качения',
    problem: xp('cable48', { P1: 5, Q: 2, L: 4, P2: 1, r: 0.1, fk: 0.005, l: 0.5, h: 1 }),
    book: { v: 3.451453 },
    relTol: 1e-5,
    note: 'Ответ книги — формула v(h) (в ней h/4L — от интегрирования давления катка); числа — для примера.',
  },
  x3851: {
    title: 'Мещерский 38.51–38.52: разгон эпициклического механизма, J·dω/dt = M₀ − αω',
    problem: xp('jw', { P: 2, Q: 1, R: 0.3, r: 0.1, M0: 10, alpha: 2, Mfr: 0, w0: 20, t: 1 }, { kind: 'epi', unit: 'mass' }),
    book: { J: 0.346667, wInf: 5, w: 4.984389 },
    relTol: 1e-5,
    note: 'Ответ книги: ω = (M₀/α)(1 − e^(−αt/J_пр)), J_пр = (R + r)²(m/3 + 3M/2); с трением на оси сателлита M₀ уменьшается на M_тр·R/r (38.52).',
  },
  x3853: {
    title: 'Мещерский 38.53: торможение гипоциклического механизма трением',
    problem: xp('jw', { P: 2, Q: 1, R: 0.3, r: 0.1, M0: 0, alpha: 0, Mfr: 0.2, w0: 20, t: 0 }, { kind: 'hypo', unit: 'mass' }),
    book: { J: 0.086667, tau: 2.888889, phi: 28.888889 },
    relTol: 1e-5,
    note: 'Книга: τ = J_пр·ω₀·r/(M_тр·R), φ = J_пр·ω₀²·r/(2M_тр·R); числа — для примера.',
  },
} satisfies Record<string, ExtraPreset>;
export type EnergyExtraKey = keyof typeof ENERGY_EXTRA_PRESETS;
