/** Готовые задачи пункта 28 для «Тяготения и орбит»: Мещерский §28, 50 (выводы формул — на числах). */
import { extraProblem, findAsk, type ExtraProblem } from '../../shared/extra';
import { ORBIT_ASKS } from './model/extra';

export interface OrbExtraPreset {
  title: string;
  problem: ExtraProblem;
  /** Ответ книги: числа, которые считает вопрос (vals). */
  book: Record<string, number>;
  relTol: number;
  note: string;
}
const xp = (id: string, n: Record<string, number>, s: Record<string, string> = {}) => extraProblem(findAsk(ORBIT_ASKS, id), n, s);
const MU = 398600;
const st = { mu: MU, R: 6371, r0: 7000, v0: 8, theta: 10 };
const c0 = 7000 * 8 * Math.cos((10 * Math.PI) / 180);
const h0 = 64 - (2 * MU) / 7000;

export const ORB_EXTRA_PRESETS = {
  x5007: {
    title: 'Мещерский 50.7: интеграл энергии в поле всемирного тяготения',
    problem: xp('laws', st),
    book: { h: h0 },
    relTol: 1e-12,
    note: 'Вывод формулы; начальное состояние (r₀ = 7000 км, v₀ = 8 км/с, θ = 10°) — для примера. Книга: v² − 2μ/r = h.',
  },
  x5008: {
    title: 'Мещерский 50.8: высота круговой орбиты, на которой кинетическая энергия равна потенциальной',
    problem: xp('laws', st),
    book: { HR: 0.5 },
    relTol: 1e-12,
    note: 'Потенциальная энергия — относительно поверхности планеты. Книга: H = R/2.',
  },
  x5014: {
    title: 'Мещерский 50.14: траектория в поле всемирного тяготения — коническое сечение',
    problem: xp('laws', st),
    book: { p: (c0 * c0) / MU, e: Math.sqrt(1 + (h0 * c0 * c0) / (MU * MU)) },
    relTol: 1e-12,
    note: 'Вывод формулы на числах. Книга: r = p/(1 + e cos(φ − ε)), p = c²/μ.',
  },
  x5019: {
    title: 'Мещерский 50.19: постоянная энергии через элементы траектории',
    problem: xp('laws', st),
    book: { hEl: h0 },
    relTol: 1e-9,
    note: 'Книга: h = −μ/a (эллипс), 0 (парабола), μ/a (гипербола); проверяется совпадение −μ/a с h, найденной по начальному состоянию.',
  },
  x5026: {
    title: 'Мещерский 50.26: третий закон Кеплера',
    problem: xp('laws', st),
    book: { kepler: (4 * Math.PI ** 2) / MU },
    relTol: 1e-9,
    note: 'Книга: T²/a³ = 4π²/μ для любых планет.',
  },
  x5029: {
    title: 'Мещерский 50.29: апогей орбиты после стыковки спутников с круговой и эллиптической орбит',
    problem: xp('dock', { mu: MU, r0: 7000, n: 8, m1: 1, m2: 1 }),
    book: { ratio: 49 / 23 },
    relTol: 1e-9,
    note: 'Массы равны; перигей и апогей эллипса r₀ и 8r₀. Книга: r_a = (49/23) r₀.',
  },
  x5040: {
    title: 'Мещерский 50.40: радиус круговой орбиты, с которой выход на гиперболу требует наименьшего импульса',
    problem: xp('escape', { mu: MU, vinf: 3, r0: 7000 }),
    book: { r0: (2 * MU) / 9 },
    relTol: 1e-12,
    note: 'Задача в буквах; v∞ = 3 км/с — для примера. Книга: r₀ = 2μ/v∞².',
  },
  x2810: {
    title: 'Мещерский 28.10: расстояние между двумя метеоритами в афелии',
    problem: xp('meteor', { R1: 1, R2: 3, a: 1 }),
    book: { d: 1 / 3 },
    relTol: 1e-12,
    note: 'Задача в буквах; числа — для примера. Книга: M₁M₂ = (R₁/R₂)·a.',
  },
} satisfies Record<string, OrbExtraPreset>;
export type OrbExtraKey = keyof typeof ORB_EXTRA_PRESETS;
