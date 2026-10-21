/** Готовые задачи пункта 28 для «Удара»: Мещерский §44 (обратные задачи). Числа — по формулам книги, где в условии буквы. */
import { extraProblem, findAsk, type ExtraProblem } from '../../shared/extra';
import { IMPACT_ASKS } from './model/extra';

export interface ImpExtraPreset {
  title: string;
  problem: ExtraProblem;
  /** Ответ книги: числа, которые считает вопрос (vals). */
  book: Record<string, number>;
  relTol: number;
  note: string;
}
const xp = (id: string, n: Record<string, number>, s: Record<string, string> = {}) => extraProblem(findAsk(IMPACT_ASKS, id), n, s);

export const IMP_EXTRA_PRESETS = {
  x4408a: {
    title: 'Мещерский 44.8: отношение масс шаров — первый покоится, второй после удара останавливается',
    problem: xp('stop', { v1: 0, v2: -1, k: 0.5 }),
    book: { ratio: 0.5 },
    relTol: 1e-9,
    note: 'Задача в буквах; k = 0,5 — для примера. Книга: m₂/m₁ = k.',
  },
  x4408b: {
    title: 'Мещерский 44.8: отношение масс шаров — встречаются с равными скоростями, второй останавливается',
    problem: xp('stop', { v1: 1, v2: -1, k: 0.5 }),
    book: { ratio: 2 },
    relTol: 1e-9,
    note: 'Задача в буквах; k = 0,5 — для примера. Книга: m₂/m₁ = 1 + 2k.',
  },
  x4409: {
    title: 'Мещерский 44.9: масса среднего из трёх упругих шаров, при которой третий получит наибольшую скорость',
    problem: xp('chain', { m1: 1, m3: 4, v: 1, k: 1 }),
    book: { m2: 2 },
    relTol: 1e-9,
    note: 'Задача в буквах; m₁ = 1, m₃ = 4 — для примера. Книга: m₂ = √(m₁m₃).',
  },
  x4413: {
    title: 'Мещерский 44.13: углы падения и отражения шарика по отношению скоростей и коэффициенту восстановления',
    problem: xp('oblique', { ratio: Math.SQRT1_2, k: 1 / Math.sqrt(3) }, { given: 'ratio' }),
    book: { alpha: 30, beta: 45 },
    relTol: 1e-9,
    note: 'v₁ = v√2/2, k = √3/3. Книга: α = π/6, β = π/4.',
  },
  x4415: {
    title: 'Мещерский 44.15: прямая, по которой должен двигаться третий шар, чтобы после удара о второй ударить первый',
    problem: xp('aim', { R: 1, a: 6 }),
    book: { d: 4 / 6 },
    relTol: 1e-9,
    note: 'Задача в буквах; R = 1, a = 6 — для примера. Книга: BC₂ = 4R²/a.',
  },
} satisfies Record<string, ImpExtraPreset>;
export type ImpExtraKey = keyof typeof IMP_EXTRA_PRESETS;
