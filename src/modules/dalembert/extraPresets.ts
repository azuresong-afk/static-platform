/** Готовые задачи пункта 28 для «Принципа Даламбера»: Мещерский 42.12–42.13. */
import { extraProblem, findAsk, type ExtraProblem } from '../../shared/extra';
import { SHAFT_ASKS } from './model/extra';

export interface ShaftExtraPreset {
  title: string;
  problem: ExtraProblem;
  /** Ответ книги: числа, которые считает вопрос (vals). */
  book: Record<string, number>;
  relTol: number;
  note: string;
}
const xp = (id: string, n: Record<string, number>, s: Record<string, string> = {}) => extraProblem(findAsk(SHAFT_ASKS, id), n, s);
const G = 9.81;

export const SHAFT_EXTRA_PRESETS = {
  x4212: {
    title: 'Мещерский 42.12: динамические давления прямоугольной пластинки, вращающейся вокруг диагонали',
    problem: xp('lamina', { P: 1, zA: 0, zB: Math.sqrt(5), w: 1 }, { V: '0:0; 0,894427:1,788854; 0:2,236068; -0,894427:0,447214', gravity: 'none', find: 'react' }),
    book: { absXB: (2 * 1 * 3) / (12 * G * Math.pow(5, 1.5)) },
    relTol: 1e-5,
    note: 'Задача в буквах; числа — для примера: a = 2, b = 1 (вершины прямоугольника в осях, где диагональ AB — ось z), P = 1, ω = 1. Книга: X = 0, Y_A = −Y_B = Pabω²(a² − b²)/(12g(a² + b²)^{3/2}) по модулю.',
  },
  x4213: {
    title: 'Мещерский 42.13: угловая скорость треугольной пластинки, при которой боковое давление на нижнюю опору равно нулю',
    problem: xp('lamina', { P: 1, zA: 1, zB: 0 }, { V: '0:0; 0:1; 1:1', gravity: 'z', find: 'zeroB' }),
    book: { w: 2 * Math.sqrt(G) },
    relTol: 1e-9,
    note: 'Равнобедренный прямоугольный треугольник ABD вращается вокруг катета AB = a = 1 (прямой угол — у верхней опоры A), расстояние между опорами a. Книга: ω = 2√(g/a).',
  },
} satisfies Record<string, ShaftExtraPreset>;
export type ShaftExtraKey = keyof typeof SHAFT_EXTRA_PRESETS;
