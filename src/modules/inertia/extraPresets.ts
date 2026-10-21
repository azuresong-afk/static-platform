/** Готовые задачи пункта 28 для «Геометрии масс»: Мещерский 34.33. */
import { extraProblem, findAsk, type ExtraProblem } from '../../shared/extra';
import { INERTIA_ASKS } from './model/extra';

export interface InertiaExtraPreset {
  title: string;
  problem: ExtraProblem;
  /** Ответ книги: числа, которые считает вопрос (vals). */
  book: Record<string, number>;
  relTol: number;
  note: string;
}
const xp = (id: string, n: Record<string, number>, s: Record<string, string> = {}) => extraProblem(findAsk(INERTIA_ASKS, id), n, s);

export const INERTIA_EXTRA_PRESETS = {
  x3433: {
    title: 'Мещерский 34.33: эллипсоид инерции тетраэдра с равными рёбрами относительно вершины O',
    problem: xp('ellipsoid', { M: 1, a: 1, b: 1, c: 1 }, { body: 'tetra' }),
    book: { J1: 0.25, J2: 0.25, J3: 0.1, c3: 1 / Math.sqrt(3) },
    relTol: 1e-9,
    note: 'a = b = c = 1, M = 1. Книга: (Ma²/4)(x₁² + y₁²) + (Ma²/10)z₁² = 1; ось z₁ составляет с осями x, y, z равные углы.',
  },
} satisfies Record<string, InertiaExtraPreset>;
export type InertiaExtraKey = keyof typeof INERTIA_EXTRA_PRESETS;
