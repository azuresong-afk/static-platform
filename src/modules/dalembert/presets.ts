/** Готовые задачи: Мещерский §42 — давления вращающегося тела на ось. Ответы книги — давления (обратны реакциям). */
import { G, type IPart, type V3 } from '../inertia/model/inertia';
import type { ShaftProblem } from './model/shaft';

export interface ShaftPreset {
  title: string;
  problem: ShaftProblem;
  /**
   * Ответ книги. d… — динамические давления (dXA, dYA, dXB, dYB, dNA, dNB — модуль радиального давления),
   * s… — статические (sNA, sNB), p… — полные (pZA).
   */
  book?: Record<string, number>;
  /** Относительный допуск, если ответ книги округлён сильнее печатных знаков. */
  relTol?: number;
  note?: string;
}

const rad = (a: number) => (a * Math.PI) / 180;
const part = (kind: IPart['kind'], m: number, c: V3, u: V3, p: Record<string, number> = {}): IPart => ({ kind, m, c, u, p, s: 1 });
const shaft = (o: Partial<ShaftProblem> & Pick<ShaftProblem, 'parts'>): ShaftProblem => ({ byWeight: false, zA: -0.5, zB: 0.5, gravity: 'none', omega: 0, eps: 0, ...o });

const d423 = { P: 10, r: 0.5, h: 0.4, e: 2, t: 1.5 };
const d424 = { P: 5, l: 0.5, al: 30, a: 0.4, b: 0.6, w: 4 };
const d425 = { P: 40, Q: 8, a: 0.6, l: 0.3, b: 0.4, w: 10 };
const d426 = { m: 2, l: 0.4, a: 0.2, w: 10 };
const d427 = { m: 1, l: 0.5, a: 0.6, phi: 40, w: 6 };
const d429 = { P: 20, l: 0.5, al: 30, h: 1.2, e: 3, t: 2 };
const d4210 = { P: 50, l: 0.4, r: 0.1, al: 15, h: 1, w: 20 };

export const SHAFT_PRESETS = {
  m427: {
    title: 'Мещерский 42.7: вертикальный вал с двумя шарами на стержнях',
    problem: shaft({
      parts: [part('point', d427.m, [d427.l, 0, 0], [0, 0, 1]), part('point', d427.m, [0, d427.l * Math.sin(rad(d427.phi)), d427.l * Math.cos(rad(d427.phi))], [0, 0, 1])],
      zA: -d427.a,
      zB: d427.a,
      omega: d427.w,
    }),
    book: {
      dXA: (d427.m * d427.l * d427.w ** 2) / 2,
      dXB: (d427.m * d427.l * d427.w ** 2) / 2,
      dYA: (d427.m * d427.l * d427.w ** 2 * (d427.a - d427.l * Math.cos(rad(d427.phi))) * Math.sin(rad(d427.phi))) / (2 * d427.a),
      dYB: (d427.m * d427.l * d427.w ** 2 * (d427.a + d427.l * Math.cos(rad(d427.phi))) * Math.sin(rad(d427.phi))) / (2 * d427.a),
    },
    note: 'Шары D (на стержне OD ⟂ оси) и E (на стержне OE под углом φ = 40° к оси), m = 1 кг, l = 0,5 м; AB = 2a = 1,2 м; ω = 6 рад/с.',
  },
  m421: {
    title: 'Мещерский 42.1: маховик с эксцентриситетом 1 мм',
    problem: shaft({ parts: [part('disk', 3000, [0.001, 0, 0], [0, 0, 1], { R: 0.5, h: 0 })], byWeight: true, zA: -1, zB: 1, gravity: 'y', omega: (1200 * Math.PI) / 30 }),
    book: { sNA: 1500, sNB: 1500, dNA: 2400, dNB: 2400 },
    relTol: 0.01,
    note: 'Вес 3000 кГ, центр тяжести в 1 мм от оси, 1200 об/мин, вал горизонтален, подшипники на равных расстояниях. По расчёту динамическое давление 2415 кГ; в книге округлено до 2400 кГ.',
  },
  m422: {
    title: 'Мещерский 42.2: диск на оси, лежащей в его плоскости',
    problem: shaft({ parts: [part('disk', 10, [0, 0.3, 0], [1, 0, 0], { R: 0.4, h: 0 })], omega: 5 }),
    book: { dXA: 0, dXB: 0, dYA: (10 * 0.3 * 25) / 2, dYB: (10 * 0.3 * 25) / 2 },
    note: 'M = 10 кг, OC = a = 0,3 м, ω = 5 рад/с, OA = OB = 0,5 м: Y = Maω²/2.',
  },
  m423: {
    title: 'Мещерский 42.3: два груза на взаимно перпендикулярных стержнях, ε = const',
    problem: shaft({
      parts: [part('point', d423.P, [d423.r, 0, 0], [0, 0, 1]), part('point', d423.P, [0, d423.r, 0], [0, 0, 1])],
      byWeight: true,
      zA: -d423.h,
      zB: d423.h,
      omega: d423.e * d423.t,
      eps: d423.e,
    }),
    book: {
      dXA: (d423.P / (2 * G)) * d423.r * d423.e * (d423.e * d423.t ** 2 + 1),
      dXB: (d423.P / (2 * G)) * d423.r * d423.e * (d423.e * d423.t ** 2 + 1),
      dYA: (d423.P / (2 * G)) * d423.r * d423.e * (d423.e * d423.t ** 2 - 1),
      dYB: (d423.P / (2 * G)) * d423.r * d423.e * (d423.e * d423.t ** 2 - 1),
    },
    note: 'P = 10 кГ, r = 0,5 м, ε = 2 рад/с², t = 1,5 с (ω = εt = 3 рад/с), опоры на ±0,4 м.',
  },
  m424: {
    title: 'Мещерский 42.4: стержень с грузами под углом к оси',
    problem: shaft({
      parts: [-1, 1].map((k) => part('point', d424.P, [0, k * d424.l * Math.sin(rad(d424.al)), k * d424.l * Math.cos(rad(d424.al))], [0, 0, 1])),
      byWeight: true,
      zA: -d424.b,
      zB: d424.a,
      gravity: 'z',
      omega: d424.w,
    }),
    book: {
      dXA: 0,
      dXB: 0,
      dYB: (d424.P * d424.l ** 2 * d424.w ** 2 * Math.sin(rad(2 * d424.al))) / (G * (d424.a + d424.b)),
      dYA: -(d424.P * d424.l ** 2 * d424.w ** 2 * Math.sin(rad(2 * d424.al))) / (G * (d424.a + d424.b)),
      pZA: -2 * d424.P,
    },
    note: 'Грузы P = 5 кГ на концах стержня 2l = 1 м под углом α = 30° к оси; подшипник C (у нас B) на a = 0,4 м выше O, подпятник D (у нас A) на b = 0,6 м ниже; ω = 4 рад/с.',
  },
  m425: {
    title: 'Мещерский 42.5: вал с двумя кривошипами',
    problem: shaft({
      parts: [
        part('rod', d425.P, [0, 0, 0], [0, 0, 1], { l: 2 * d425.a }),
        part('rod', d425.Q, [0, d425.l / 2, d425.a], [0, 1, 0], { l: d425.l }),
        part('rod', d425.Q, [0, -d425.l / 2, -d425.a], [0, 1, 0], { l: d425.l }),
      ],
      byWeight: true,
      zA: -d425.b,
      zB: d425.b,
      gravity: 'y',
      omega: d425.w,
    }),
    book: { pYB: -(d425.P / 2 + d425.Q - ((d425.a * d425.l * d425.w ** 2) / (2 * d425.b * G)) * d425.Q), pYA: -(d425.P / 2 + d425.Q + ((d425.a * d425.l * d425.w ** 2) / (2 * d425.b * G)) * d425.Q) },
    note: 'Вал 2a = 1,2 м, P = 40 кГ; кривошипы l = 0,3 м, Q = 8 кГ (AC — вверх); подшипники E (у нас B) и F на ±0,4 м; ω = 10 рад/с. Давления N_E, N_F направлены вниз — у нас со знаком «−» по оси y.',
  },
  m426: {
    title: 'Мещерский 42.6: горизонтальный вал с шарами на перпендикулярных стержнях',
    problem: shaft({
      parts: [part('point', d426.m, [0, d426.l, d426.a], [0, 0, 1]), part('point', d426.m, [d426.l, 0, -d426.a], [0, 0, 1])],
      zA: 3 * d426.a,
      zB: -3 * d426.a,
      omega: d426.w,
    }),
    book: { dNA: (Math.sqrt(5) / 3) * d426.m * d426.l * d426.w ** 2, dNB: (Math.sqrt(5) / 3) * d426.m * d426.l * d426.w ** 2 },
    note: 'm = 2 кг, l = 0,4 м, a = 0,2 м (A — на 3a, стержни — на ±a, B — на −3a), ω = 10 рад/с.',
  },
  m429: {
    title: 'Мещерский 42.9: наклонный стержень разгоняется с ε = const',
    problem: shaft({
      parts: [part('rod', d429.P, [0, 0, 0], [0, Math.sin(rad(d429.al)), Math.cos(rad(d429.al))], { l: 2 * d429.l })],
      byWeight: true,
      zA: -d429.h / 2,
      zB: d429.h / 2,
      omega: d429.e * d429.t,
      eps: d429.e,
    }),
    book: {
      dXB: ((d429.P * d429.l ** 2) / (6 * G * d429.h)) * d429.e * Math.sin(rad(2 * d429.al)),
      dXA: -((d429.P * d429.l ** 2) / (6 * G * d429.h)) * d429.e * Math.sin(rad(2 * d429.al)),
      dYB: ((d429.P * d429.l ** 2) / (6 * G * d429.h)) * d429.e ** 2 * d429.t ** 2 * Math.sin(rad(2 * d429.al)),
      dYA: -((d429.P * d429.l ** 2) / (6 * G * d429.h)) * d429.e ** 2 * d429.t ** 2 * Math.sin(rad(2 * d429.al)),
    },
    note: 'P = 20 кГ, 2l = 1 м, α = 30°, OA = OB = h/2 = 0,6 м, ε = 3 рад/с², t = 2 с.',
  },
  m4210: {
    title: 'Мещерский 42.10: цилиндр, ось которого наклонена к оси вращения',
    problem: shaft({
      parts: [part('disk', d4210.P, [0, 0, 0], [0, Math.sin(rad(d4210.al)), Math.cos(rad(d4210.al))], { R: d4210.r, h: 2 * d4210.l })],
      byWeight: true,
      zA: -d4210.h / 2,
      zB: d4210.h / 2,
      omega: d4210.w,
    }),
    book: {
      dNA: ((d4210.P * d4210.w ** 2 * Math.sin(rad(2 * d4210.al))) / (2 * G * d4210.h)) * (d4210.l ** 2 / 3 - d4210.r ** 2 / 4),
      dNB: ((d4210.P * d4210.w ** 2 * Math.sin(rad(2 * d4210.al))) / (2 * G * d4210.h)) * (d4210.l ** 2 / 3 - d4210.r ** 2 / 4),
    },
    note: 'P = 50 кГ, 2l = 0,8 м, r = 0,1 м, α = 15°, H₁H₂ = h = 1 м, ω = 20 рад/с.',
  },
  m4211: {
    title: 'Мещерский 42.11: перекошенный диск паровой турбины',
    problem: shaft({
      parts: [part('disk', 3.27, [0, 0, 0], [Math.sin(0.02), 0, Math.cos(0.02)], { R: 0.2, h: 0 })],
      byWeight: true,
      zA: -0.5,
      zB: 0.3,
      gravity: 'y',
      omega: (30000 * Math.PI) / 30,
    }),
    book: { sNA: 1.23, sNB: 2.04, dNA: 822, dNB: 822 },
    note: 'Вес 3,27 кГ, R = 20 см, 30 000 об/мин, AO = 50 см, OB = 30 см, перекос α = 0,02 рад.',
  },
} satisfies Record<string, ShaftPreset>;

export type ShaftPresetKey = keyof typeof SHAFT_PRESETS;
