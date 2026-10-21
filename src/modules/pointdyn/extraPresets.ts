/** Готовые задачи пункта 24 для «Динамики точки»: §27. Числа ответов — по формулам книги, где в условии даны буквы. */
import { extraProblem, findAsk, type ExtraProblem } from '../../shared/extra';
import { POINT_EXTRA_ASKS } from './model/extra';

export interface PointExtraPreset {
  title: string;
  problem: ExtraProblem;
  /** Ответ книги: числа, которые считает вопрос (vals). */
  book: Record<string, number>;
  relTol: number;
  note: string;
}
const xp = (id: string, n: Record<string, number>, s: Record<string, string> = {}) => extraProblem(findAsk(POINT_EXTRA_ASKS, id), n, s);

export const POINT_EXTRA_PRESETS = {
  x2739: {
    title: 'Мещерский 27.39: время удвоения скорости при x = a√(v − b)',
    problem: xp('law', { a: 2, b: 1, m: 1, v0: 2, v1: 4 }, { X: 'a*sqrt(v-b)' }),
    book: { t: 0.5235988 },
    relTol: 1e-5,
    note: 'Книга: t = (a/√b)[arctg√((2v₀ − b)/b) − arctg√((v₀ − b)/b)]; для a = 2, b = 1, v₀ = 2 м/с получается π/6.',
  },
  x2759: {
    title: 'Мещерский 27.59: притяжение к двум неподвижным центрам силами, пропорциональными расстоянию',
    problem: xp('centers', { k1: 1, x1: 0, y1: 0, k2: 3, x2: 4, y2: 2, x0: 1, y0: 0, vx0: 0, vy0: 2 }, { nc: '2' }),
    book: { cx: 3, cy: 1.5, T: 3.14159265 },
    relTol: 1e-8,
    note: 'Книга: эллипс с центром (a, b) = (Σkᵢxᵢ/K, Σkᵢyᵢ/K), K = Σkᵢ; период 2π/√K. Числа — для примера.',
  },
  x2760: {
    title: 'Мещерский 27.60: два центра, один из них движется равномерно по оси Ox',
    problem: xp('centers', { k1: 1, x1: 0, y1: 0, k2: 1, x2: 2, y2: 0, wx2: 1, x0: 1, y0: 1, vx0: 0.5, vy0: 0 }, { nc: '2' }),
    book: { w: 1.414214, cx: 1, cy: 0, t1: 1.1107207, x1: 1.5553604 },
    relTol: 1e-6,
    note: 'Книга (a = 1, b = 0,5, k = 1): x = a + bt, y = a·cos(√(2k)·t) — синусоида, снесённая вдоль Ox. Центр C₂: x₂ = 2(a + bt).',
  },
  x2764: {
    title: 'Мещерский 27.64: равномерное движение по шероховатой плоскости с горизонтальной нитью',
    problem: xp('incline', { tga: 1 / 30, f: 0.1, G: 300, v2: 12 }),
    book: { v1: 4.24, T: 28.3 },
    relTol: 0.005,
    note: 'Книга: v₁ = 4,24 см/с, T = 28,3 Н (tg α = 1/30, f = 0,1, G = 300 Н, v₂ = 12 см/с).',
  },
  x2765: {
    title: 'Мещерский 27.65: два центра притяжения — траектория и моменты пересечения оси Ox',
    problem: xp('centers', { k1: 1, x1: -1, y1: 0, k2: 1, x2: 1, y2: 0, x0: -2, y0: 0, vx0: 0, vy0: 3 }, { nc: '2' }),
    book: { w: 1.414214, T: 4.442883, t1: 2.221441, x1: 2, t2: 4.442883, x2: -2 },
    relTol: 1e-6,
    note: 'Книга (c/m = 1, a = 1): эллипс x²/(2a)² + y²/(v₀/k)² = 1, k = √(2c/m); пересечения линии O₁O₂ при t = π/k (x = 2a) и 2π/k (x = −2a).',
  },
  x2766: {
    title: 'Мещерский 27.66: притяжение к центру и постоянная сила — условие прохода через центр',
    problem: xp('centers', { k1: 2, x1: 0, y1: 0, fx: 1, x0: 1, y0: 0, vx0: 0, vy0: 1.5 }, { nc: '1' }),
    book: { tmin: 2.221441, vmin: 1.5 },
    relTol: 1e-3,
    note: 'Книга: траектория проходит через O при c₁/c = 2; скорость в центре равна v₀ (здесь c = 1, r₀ = 1, v₀ = 1,5; расстояние до O в этот момент равно нулю).',
  },
  xball: {
    title: 'Баллистика с табличным законом сопротивления (пример к 27.41)',
    problem: xp('ball', { v0: 700, alpha: 45, g: 9.81 }),
    book: { Hvac: 12487.26, Lvac: 49949.03 },
    relTol: 1e-4,
    note: 'В задаче 27.41 действительная траектория дана графиком, которого в книге нет в виде чисел: заданные здесь замедления — пример; проверяются величины в пустоте.',
  },
} satisfies Record<string, PointExtraPreset>;
export type PointExtraKey = keyof typeof POINT_EXTRA_PRESETS;
