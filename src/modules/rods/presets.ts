/**
 * Готовые задачи раздела «Стержневые системы»: схемы Антонова (гл. 3, п. 4.5) и типовые задачи курсов
 * сопротивления материалов. book — ответы для тестов.
 */
import type { Load, Rod, RodProblem, Support } from './model/rods';

export const newRod = (o: Partial<Rod> = {}): Rod => ({ x: 0, ang: 90, l: 1, c: 1, E: 2e5, alpha: 1.25e-5, dT: 0, delta: 0, ...o });
export const newLoad = (o: Partial<Load> = {}): Load => ({ kind: 'F', x: 0, x2: 1, F: 10, ang: 270, ...o });
export const newSupport = (o: Partial<Support> = {}): Support => ({ kind: 'pin', x: 0, ang: 90, ...o });

const prob = (o: Partial<RodProblem>): RodProblem => ({
  body: 'node',
  L: 3,
  supports: [],
  rods: [],
  loads: [],
  A: 2,
  ask: 'check',
  sAllow: 160,
  sT: 240,
  n: 1.5,
  ...o,
});

export interface RodPreset {
  title: string;
  problem: RodProblem;
  book?: Record<string, number>;
  note: string;
}

export const ROD_PRESETS = {
  a44: {
    title: 'Антонов, рис. 4.4: три стержня в узле — допускаемая и предельная нагрузки',
    problem: prob({
      body: 'node',
      rods: [newRod({ ang: 150, l: 2 }), newRod({ ang: 90, l: 1 }), newRod({ ang: 30, l: 2 })],
      loads: [newLoad({ F: 100 })],
      A: 2,
      ask: 'limit',
      sAllow: 160,
      sT: 240,
      n: 1.5,
    }),
    book: { N1: 20, N2: 80, N3: 20, Pallow: 40, Plim: 96, PlimN: 64, ratio: 1.6, degree: 1 },
    note: 'α = 60°, средний стержень длиной l, крайние — l/cos α = 2l, EA одинаковы. Пособие: N₁ = N₃ = P/5, N₂ = 4P/5; [P] = (5/4)[σ]A; предельная P = 2σт·A, отношение 8/5. Числа примера: A = 2 см², [σ] = 160 МПа, σт = 240 МПа, n = 1,5. В пособии сказано, что предельная нагрузка «почти в два раза» больше — на деле в 1,6 раза.',
  },
  a37: {
    title: 'Антонов, рис. 3.7: три стержня в узле, средний нагрет (числа — пример)',
    problem: prob({
      body: 'node',
      rods: [newRod({ ang: 135, l: Math.SQRT2 }), newRod({ ang: 90, l: 1, dT: 40 }), newRod({ ang: 45, l: Math.SQRT2 })],
      loads: [newLoad({ F: 60 })],
      A: 3,
      ask: 'check',
      sAllow: 160,
      sT: 240,
    }),
    note: 'Один раз статически неопределимая система: два уравнения равновесия, три усилия. Средний стержень нагрет на 40 К: он хочет удлиниться, крайние ему мешают — в нём появляется сжатие, в крайних — растяжение.',
  },
  a38: {
    title: 'Антонов, рис. 3.8: жёсткий брус на шарнире и трёх стержнях — подбор площади (числа — пример)',
    problem: prob({
      body: 'bar',
      L: 3,
      supports: [newSupport({ kind: 'pin', x: 3 })],
      rods: [newRod({ x: 0.5, l: 1 }), newRod({ x: 1.5, l: 1 }), newRod({ x: 2.5, l: 1 })],
      loads: [newLoad({ x: 0.3, F: 50 })],
      ask: 'design',
      sAllow: 160,
    }),
    note: 'Дважды статически неопределимая система: брус поворачивается вокруг шарнира, удлинения стержней пропорциональны расстояниям до шарнира.',
  },
  a310: {
    title: 'Антонов, рис. 3.10: ступенчатый брус с зазором — монтажные напряжения (числа — пример)',
    problem: prob({
      body: 'node',
      rods: [newRod({ ang: 180, l: 0.4, c: 1 }), newRod({ ang: 0, l: 0.6, c: 2, delta: -0.2 })],
      loads: [],
      A: 4,
      ask: 'check',
    }),
    book: { N1: 22.857, N2: 22.857 },
    note: 'Участок 1 (l₁ = 0,4 м, A) заделан слева, участок 2 (l₂ = 0,6 м, 2A) короче на Δ = 0,2 мм; брус растягивают и крепят к правой заделке. Пособие: P·l₁/(EA) + P·l₂/(2EA) = Δ.',
  },
  bar2: {
    title: 'Жёсткий брус на шарнире и двух стержнях: N₁ = 0,6F, N₂ = 1,2F',
    problem: prob({
      body: 'bar',
      L: 3,
      supports: [newSupport({ kind: 'pin', x: 0 })],
      rods: [newRod({ x: 1, l: 1.5 }), newRod({ x: 2, l: 1.5 })],
      loads: [newLoad({ x: 3, F: 100 })],
      A: 5,
      ask: 'allow',
      sAllow: 160,
    }),
    book: { N1: 60, N2: 120, degree: 1 },
    note: 'Шарнир на левом конце, одинаковые стержни на расстояниях a и 2a, сила F на конце (3a). Совместность: Δl₂ = 2Δl₁ ⇒ N₂ = 2N₁; равновесие: N₁a + N₂·2a = F·3a ⇒ N₁ = 0,6F, N₂ = 1,2F.',
  },
  mix: {
    title: 'Брус на шарнире: стальной и медный стержни, нагрев и неточность изготовления',
    problem: prob({
      body: 'bar',
      L: 2.4,
      supports: [newSupport({ kind: 'pin', x: 0 })],
      rods: [
        newRod({ x: 1.2, ang: 90, l: 1.2, c: 1, E: 2e5, alpha: 1.25e-5, dT: 0 }),
        newRod({ x: 2.4, ang: 135, l: 1.7, c: 2, E: 1e5, alpha: 1.65e-5, dT: 30, delta: 0.3 }),
      ],
      loads: [newLoad({ x: 1.8, F: 40 }), newLoad({ kind: 'q', x: 0, x2: 1.2, F: 10 })],
      A: 4,
      ask: 'check',
      sAllow: 160,
      sT: 240,
    }),
    note: 'Стержень 1 — стальной, вертикальный; стержень 2 — медный (E = 1·10⁵ МПа, α = 1,65·10⁻⁵ 1/К), наклонный, площадь 2A, нагрет на 30 К и изготовлен длиннее на 0,3 мм.',
  },
  det2: {
    title: 'Узел на двух стержнях — статически определимая система',
    problem: prob({ body: 'node', rods: [newRod({ ang: 135, l: 1.5 }), newRod({ ang: 45, l: 1.5 })], loads: [newLoad({ F: 50 })], A: 2, ask: 'check' }),
    book: { N1: 35.355, N2: 35.355, degree: 0 },
    note: 'Два стержня под 45° к горизонту; усилия находятся из двух уравнений равновесия: N = P/(2 sin 45°).',
  },
} satisfies Record<string, RodPreset>;

export type RodPresetKey = keyof typeof ROD_PRESETS;
