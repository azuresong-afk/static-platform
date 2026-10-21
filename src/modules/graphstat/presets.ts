/**
 * Готовые задачи графической статики (Мещерский §5): фермы — диаграмма Максвелла–Кремоны, балки — силовой и верёвочный
 * многоугольники, цепной мост. Единицы книги (т) сохранены числами; ответ книги — book.
 */
import { TRUSS_PRESETS, type TrussPreset } from '../truss/presets';
import type { Truss } from '../truss/model/truss';
import type { ChainInput, FunicularInput } from './model/funicular';

export interface TrussGraphPreset {
  kind: 'truss';
  title: string;
  truss: Truss;
  /** Ответ книги: реакции и усилия по номерам стержней (растяжение «+»). */
  book?: { reactions: Record<string, number>; bars: number[] };
  note?: string;
}
export interface BeamGraphPreset {
  kind: 'beam';
  title: string;
  beam: FunicularInput;
  /** Ответ книги: модули реакций. */
  book: { RA: number; RB: number };
  note?: string;
}
export interface ChainGraphPreset {
  kind: 'chain';
  title: string;
  chain: ChainInput;
  /** Ответ книги: натяжение цепи в средней точке. */
  book: { T: number };
  note?: string;
}
export type GraphPreset = TrussGraphPreset | BeamGraphPreset | ChainGraphPreset;

const down = (node: number, F: number) => ({ node, F, angle: 270 });
const bars = (...p: [number, number][]) => p.map(([a, b]) => ({ a, b }));
const fromTruss = (title: string, k: keyof typeof TRUSS_PRESETS): TrussGraphPreset => {
  const p: TrussPreset = TRUSS_PRESETS[k];
  return { kind: 'truss', title, truss: p.truss, book: p.book, note: p.note };
};

export const GRAPH_PRESETS = {
  m51: {
    kind: 'beam',
    title: 'Мещерский 5.1: балка, три груза — реакции графически',
    beam: {
      xA: 0,
      xB: 8,
      angleB: 90,
      loads: [
        { x: 1.5, F: 2, angle: 270 },
        { x: 4, F: 3, angle: 270 },
        { x: 7, F: 1, angle: 270 },
      ],
    },
    book: { RA: 3.25, RB: 2.75 },
    note: 'Пролёт 8 м; грузы 2, 3 и 1 т на расстояниях 1,5; 4 и 7 м от A (по рисунку книги: 1,5 + 2,5 + 3 + 1 м).',
  },
  m52: {
    kind: 'beam',
    title: 'Мещерский 5.2: консольная балка, грузы на концах — реакции графически',
    beam: {
      xA: 2,
      xB: 7,
      angleB: 90,
      loads: [
        { x: 0, F: 2, angle: 270 },
        { x: 8, F: 3, angle: 270 },
      ],
    },
    book: { RA: 2.2, RB: 2.8 },
    note: 'Длина балки 8 м, пролёт AB = 5 м; опоры на расстояниях 2 и 7 м от левого конца, грузы 2 и 3 т на концах.',
  },
  m53: {
    kind: 'beam',
    title: 'Мещерский 5.3: консольная балка, три груза — реакции графически',
    beam: {
      xA: 0,
      xB: 6,
      angleB: 90,
      loads: [
        { x: 2, F: 1, angle: 270 },
        { x: 4, F: 0.8, angle: 270 },
        { x: 8, F: 0.6, angle: 270 },
      ],
    },
    book: { RA: 0.73, RB: 1.67 },
    note: 'Длина 8 м, пролёт 6 м; грузы 1; 0,8 и 0,6 т на расстояниях 2; 4 и 8 м от A.',
  },
  m54: {
    kind: 'beam',
    title: 'Мещерский 5.4: балка с вертикальной и наклонной силой — реакции графически',
    beam: {
      xA: 0,
      xB: 7,
      angleB: 90,
      loads: [
        { x: 2, F: 2, angle: 270 },
        { x: 5, F: 2, angle: 240 },
      ],
    },
    book: { RA: 2.17, RB: 1.81 },
    note: 'Пролёт 2 + 3 + 2 м; сила 2 т в 2 м от A вертикальна, сила 2 т в 5 м от A направлена вниз и влево под 60° к балке. A — шарнир, B — каток.',
  },
  m55: {
    kind: 'truss',
    title: 'Мещерский 5.5: кран — реакции и усилия в стержнях',
    truss: {
      nodes: [
        { x: 2, y: 0 },
        { x: 0, y: 0 },
        { x: 1, y: 3 },
        { x: 6.5, y: 5.36 },
      ],
      // 1 A–D, 2 C–D, 3 A–C, 4 B–A, 5 B–C
      bars: bars([0, 3], [2, 3], [0, 2], [1, 0], [1, 2]),
      supports: [
        { node: 0, kind: 'roller', angle: 90 },
        { node: 1, kind: 'pin', angle: 90 },
      ],
      loads: [down(3, 8)],
    },
    book: { reactions: { R_A: 26, X_B: 0, Y_B: -18 }, bars: [-16.4, 11.5, -14.3, -6, 19] },
    note: 'Узлы: A (2; 0), B (0; 0), C (1; 3) — вершина левой стойки (в книге D), D (6,5; 5,36) — конец стрелы (в книге E), груз 8 т. Положение конца стрелы снято с рисунка: R_A = 4·6,5 = 26 т по ответу книги, AD ≈ 7 м. Опоры: A — каток (вертикальная реакция), B — шарнир; по ответу книги R_B = 18 т направлена вниз.',
  },
  m57: fromTruss('Мещерский 5.7: стропильная ферма — диаграмма Кремоны', 'm57'),
  m511: fromTruss('Мещерский 5.11: ферма с горизонтальной силой — диаграмма Кремоны', 'm511'),
  m512: fromTruss('Мещерский 5.12: раскосная ферма — диаграмма Кремоны', 'm512'),
  m514: fromTruss('Мещерский 5.14: перекрещивающиеся стержни — силовые многоугольники узлов', 'm514'),
  m513: fromTruss('Мещерский 5.13: мостовая ферма — диаграмма Кремоны', 'm513'),
  m515: fromTruss('Мещерский 5.15: навесная ферма — диаграмма Кремоны', 'm515'),
  m516: {
    kind: 'chain',
    title: 'Мещерский 5.16: цепной мост — натяжение цепи в средней точке',
    chain: { L: 20, f: 2, q: 1.6, chains: 2, n: 10 },
    book: { T: 20 },
    note: 'AB = 20 м, стрела CK = 2 м, нагрузка 1,6 т/м на две цепи (по 0,8 т/м на цепь): H = qL²/(8f) = 20 т. Вершины верёвочного многоугольника лежат на параболе.',
  },
} satisfies Record<string, GraphPreset>;

export type GraphPresetKey = keyof typeof GRAPH_PRESETS;
