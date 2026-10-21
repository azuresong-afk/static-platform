/** Готовые задачи пункта 26 для «Центра тяжести»: обратные задачи Мещерского §9. */
import { extraProblem, findAsk, type ExtraProblem } from '../../shared/extra';
import { CENTROID_ASKS } from './model/extra';

export interface CentroidExtraPreset {
  title: string;
  problem: ExtraProblem;
  /** Ответ книги: числа, которые считает вопрос (vals). */
  book: Record<string, number>;
  relTol: number;
  note: string;
}
const xp = (id: string, n: Record<string, number>) => extraProblem(findAsk(CENTROID_ASKS, id), n);

export const CENTROID_EXTRA_PRESETS = {
  x913: {
    title: 'Мещерский 9.13: прямая DE — трапеция висит на вершине E, AD горизонтальна',
    problem: xp('hang', { a: 1, h: 1.5 }),
    book: { BE: 0.366 },
    relTol: 0.001,
    note: 'BE = a(√3 − 1)/2 = 0,366a.',
  },
  x914: {
    title: 'Мещерский 9.14: вырез AEB — вершина E в центре тяжести остатка квадрата',
    problem: xp('notch', { a: 1, H: 1 }),
    book: { xE: 0.5, yE: 0.634 },
    relTol: 0.001,
    note: 'y_E = a(3 − √3)/2 = 0,634a.',
  },
  x915: {
    title: 'Мещерский 9.15: четверо несут треугольную пластину поровну',
    problem: xp('carry', { xA: 0, yA: 3, xB: 0, yB: 0, xC: 4, yC: 0 }),
    book: { t: 1 / 3 },
    relTol: 1e-9,
    note: 'Ответ книги — 1/3 длины стороны от третьей вершины; треугольник — любой.',
  },
  x925: {
    title: 'Мещерский 9.25: половины цилиндра на нити с гирями',
    problem: xp('halves', { Q: 1, r: 1 }),
    book: { P: 2 / (3 * Math.PI) },
    relTol: 1e-9,
    note: 'P = 2Q/(3π).',
  },
} satisfies Record<string, CentroidExtraPreset>;
export type CentroidExtraKey = keyof typeof CENTROID_EXTRA_PRESETS;
