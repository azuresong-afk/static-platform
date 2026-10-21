/** Готовые задачи пункта 28 для «Вращения тела»: Мещерский §37, 43, 44. Числа — по формулам книги, где в условии буквы. */
import { extraProblem, findAsk, type ExtraProblem } from '../../shared/extra';
import { ROT_ASKS } from './model/extra';

export interface RotExtraPreset {
  title: string;
  problem: ExtraProblem;
  /** Ответ книги: числа, которые считает вопрос (vals). */
  book: Record<string, number>;
  relTol: number;
  note: string;
}
const xp = (id: string, n: Record<string, number>, s: Record<string, string> = {}) => extraProblem(findAsk(ROT_ASKS, id), n, s);
const G = 9.81;
const W4421 = (0.2 ** 3 * 10 + 0.4 ** 3 * 4) / (0.2 * (0.2 ** 2 + 0.4 ** 2));

export const ROT_EXTRA_PRESETS = {
  x3725: {
    title: 'Мещерский 37.25: период колебаний магнита в магнитном поле Земли',
    problem: xp('magnet', { m: 10, a: 5, b: 0.5, H: 0.2, A: 100 }),
    book: { T: 2 * Math.PI * Math.sqrt((10 * (25 + 0.25)) / (3 * 100 * 0.2)) },
    relTol: 1e-9,
    note: 'Задача в буквах; числа — для примера (CGS). Книга: гармонические колебания с периодом T = 2π√(m(a² + b²)/(3AH)).',
  },
  x3737: {
    title: 'Мещерский 37.37: точечная масса в центре качаний цилиндра не меняет период',
    problem: xp('phys', { m: 1, l: 1, r: 1 / 6, a: 0.5, alpha: 90, m1: 0.3, d: 85 / 72 }, { body: 'cyl' }),
    book: { T: 2 * Math.PI * Math.sqrt((49 / 144 + 0.25) / (0.5 * G)), lr: 85 / 72 },
    relTol: 1e-9,
    note: 'Цилиндр M, длина 2l, r = l/6, ось O на расстоянии l/2 от центра (по ответу книги: OK = 85l/72 — приведённая длина). Числа: M = 1, l = 1, m = 0,3. Книга: период не изменится.',
  },
  x3739: {
    title: 'Мещерский 37.39: период физического маятника сейсмографа с наклонной осью',
    problem: xp('phys', { m: 2, Jc: 0.05, a: 0.3, alpha: 30, m1: 0 }, { body: 'custom' }),
    book: { T: 2 * Math.PI * Math.sqrt(((0.05 + 2 * 0.09) * G) / (2 * G * G * 0.3 * 0.5)) },
    relTol: 1e-9,
    note: 'Задача в буквах; числа — для примера (P = 2g, J₀ = 0,05, a = 0,3, α = 30°). Книга: T = 2π√((J₀g + Pa²)/(P g a sin α)).',
  },
  x3749: {
    title: 'Мещерский 37.49: человек поднимается по канату через невесомый блок',
    problem: xp('monkey', { m1: 1, m2: 1, u: 1 }, { block: 'none' }),
    book: { ratio: 0.5 },
    relTol: 1e-9,
    note: 'Груз того же веса, что человек. Книга: груз поднимается со скоростью u/2.',
  },
  x3750: {
    title: 'Мещерский 37.50: то же, блок весом в четверть веса человека (масса на ободе)',
    problem: xp('monkey', { m1: 1, m2: 1, M: 0.25, u: 1 }, { block: 'rim' }),
    book: { ratio: 4 / 9 },
    relTol: 1e-9,
    note: 'Книга: груз поднимается со скоростью 4u/9.',
  },
  x4308: {
    title: 'Мещерский 43.8: потеря кинетической энергии при соединении дисков фрикционной муфтой',
    problem: xp('couple', { J1: 1, J2: 2, w1: 10, w2: 4 }, { kind: 'clutch' }),
    book: { dT: ((1 * 2) / (2 * 3)) * 36 },
    relTol: 1e-9,
    note: 'Задача в буквах; числа — для примера. Книга: ΔT = J₁J₂(ω₁ − ω₂)²/(2(J₁ + J₂)).',
  },
  x4421: {
    title: 'Мещерский 44.21: угловые скорости шкивов после того, как на них накинут ремень',
    problem: xp('couple', { R1: 0.2, R2: 0.4, w1: 10, w2: 4 }, { kind: 'belt', J: 'radii' }),
    book: { w1: W4421, w2: (0.2 * W4421) / 0.4 },
    relTol: 1e-9,
    note: 'Задача в буквах; числа — для примера. Книга: ω₁ = (R₁³ω₁₀ + R₂³ω₂₀)/(R₁(R₁² + R₂²)), ω₂ = (R₁³ω₁₀ + R₂³ω₂₀)/(R₂(R₁² + R₂²)).',
  },
} satisfies Record<string, RotExtraPreset>;
export type RotExtraKey = keyof typeof ROT_EXTRA_PRESETS;
