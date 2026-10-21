/**
 * Готовые фермы: задачи Мещерского (§5, изд. 1975). Нумерация стержней — как в книге, узлы с опорами — A и B.
 * Единицы книги (т) сохранены числами: расчёт линеен, приложение подписывает кН.
 */
import type { Truss } from './model/truss';

const R3 = Math.sqrt(3);

export interface TrussPreset {
  title: string;
  truss: Truss;
  /** Стержень для проверки методом Риттера (номер с нуля). */
  ritter: number | null;
  /** Ответ книги: реакции и усилия по номерам стержней (растяжение «+»). */
  book?: { reactions: Record<string, number>; bars: number[] };
  note?: string;
}

const down = (node: number, F: number) => ({ node, F, angle: 270 });
const right = (node: number, F: number) => ({ node, F, angle: 0 });
const bars = (...p: [number, number][]) => p.map(([a, b]) => ({ a, b }));

export const TRUSS_PRESETS = {
  m57: {
    title: 'Мещерский 5.7: стропильная ферма',
    truss: {
      nodes: [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 1, y: R3 },
        { x: 2, y: 0 },
        { x: 2.5, y: R3 / 2 },
      ],
      // 1 A–D, 2 D–B, 3 E–B, 4 C–E, 5 A–C, 6 C–D, 7 D–E
      bars: bars([0, 3], [3, 1], [4, 1], [2, 4], [0, 2], [2, 3], [3, 4]),
      supports: [
        { node: 0, kind: 'pin', angle: 90 },
        { node: 1, kind: 'roller', angle: 90 },
      ],
      loads: [down(0, 1), down(2, 2), down(4, 2), down(1, 1)],
    },
    ritter: 5,
    book: { reactions: { X_A: 0, Y_A: 3.25, R_B: 2.75 }, bars: [1.3, 3.03, -3.5, -2.5, -2.6, 1.73, -1.73] },
    note: 'Вершина C книги — узел C (угол ACB прямой), узел на скате, где сходятся стержни 3, 4, 7, — E. Силы 1 т в опорах включены в реакции.',
  },
  m511: {
    title: 'Мещерский 5.11: ферма с горизонтальной силой',
    truss: {
      nodes: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 5, y: 3 },
        { x: 5, y: 0 },
        { x: 0, y: 1.5 },
        { x: 10, y: 1.5 },
      ],
      // 1 D–F, 2 C–F, 3 D–C, 4 E–C, 5 E–D, 6 A–D, 7 D–B, 8 F–B, 9 A–E
      bars: bars([3, 5], [2, 5], [3, 2], [4, 2], [4, 3], [0, 3], [3, 1], [5, 1], [0, 4]),
      supports: [
        { node: 0, kind: 'pin', angle: 90 },
        { node: 1, kind: 'roller', angle: 90 },
      ],
      loads: [down(3, 4), right(2, 2)],
    },
    ritter: 3,
    book: { reactions: { X_A: -2, Y_A: 1.4, R_B: 2.6 }, bars: [4.5, -4.5, 2, -2.44, 2.44, 2, 0, -2.6, -1.4] },
  },
  m512: {
    title: 'Мещерский 5.12: подвесная ферма, a = 1 м',
    truss: {
      nodes: [
        { x: 0, y: 0 },
        { x: 3, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 1, y: -1 },
        { x: 2, y: -1 },
      ],
      // 1 A–C, 2 C–D, 3 D–B, 4 H–B, 5 E–H, 6 A–E, 7 C–E, 8 E–D, 9 D–H
      bars: bars([0, 2], [2, 3], [3, 1], [5, 1], [4, 5], [0, 4], [2, 4], [4, 3], [3, 5]),
      supports: [
        { node: 0, kind: 'pin', angle: 90 },
        { node: 1, kind: 'roller', angle: 90 },
      ],
      loads: [down(2, 4), right(5, 1)],
    },
    ritter: 1,
    book: { reactions: { X_A: -1, Y_A: 3, R_B: 1 }, bars: [-2, -2, -1, 1.41, 2, 4.24, -4, 1.41, -1] },
  },
  m513: {
    title: 'Мещерский 5.13: мостовая ферма',
    truss: {
      nodes: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 3, y: 0 },
        { x: 7, y: 0 },
        { x: 3, y: 3 },
        { x: 7, y: 3 },
      ],
      // 1 A–E, 2 A–C, 3 C–E, 4 E–H, 5 C–H, 6 C–D, 7 D–H, 8 H–B, 9 D–B
      bars: bars([0, 4], [0, 2], [2, 4], [4, 5], [2, 5], [2, 3], [3, 5], [5, 1], [3, 1]),
      supports: [
        { node: 0, kind: 'roller', angle: 90 },
        { node: 1, kind: 'pin', angle: 90 },
      ],
      loads: [down(2, 3), down(5, 2), right(5, 2)],
    },
    ritter: 3,
    book: { reactions: { R_A: 2.1, X_B: -2, Y_B: 2.9 }, bars: [-2.97, 2.1, 2.1, -2.1, 1.5, 0.9, 0, -4.1, 0.9] },
  },
  m514: {
    title: 'Мещерский 5.14: перекрещивающиеся стержни',
    truss: {
      nodes: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 3, y: 2.5 },
        { x: 7, y: 2.5 },
      ],
      // 1 A–C, 2 C–D, 3 A–D, 4 C–B, 5 D–B; стержни 3 и 4 перекрещиваются без шарнира
      bars: bars([0, 2], [2, 3], [0, 3], [2, 1], [3, 1]),
      supports: [
        { node: 0, kind: 'roller', angle: 90 },
        { node: 1, kind: 'pin', angle: 90 },
      ],
      loads: [down(2, 3), down(3, 2), right(3, 2)],
    },
    ritter: 1,
    book: { reactions: { R_A: 2.2, X_B: -2, Y_B: 2.8 }, bars: [-6, -7, 4.9, 2.53, -5.7] },
    note: 'Стержни 3 и 4 пересекаются, но в точке пересечения не соединены.',
  },
  m515: {
    title: 'Мещерский 5.15: навесная ферма у стены',
    truss: {
      nodes: [
        { x: 0, y: 0 },
        { x: 0, y: 7.5 },
        { x: 4.5, y: 0 },
        { x: 9, y: 0 },
        { x: 13.5, y: 0 },
        { x: 4.5, y: 5 },
        { x: 9, y: 2.5 },
      ],
      // 1 A–C, 2 C–D, 3 D–E, 4 E–K, 5 K–H, 6 H–B, 7 A–B, 8 B–C, 9 H–C, 10 H–D, 11 K–D
      bars: bars([0, 2], [2, 3], [3, 4], [4, 6], [6, 5], [5, 1], [0, 1], [1, 2], [5, 2], [5, 3], [6, 3]),
      supports: [
        { node: 0, kind: 'pin', angle: 90 },
        { node: 1, kind: 'roller', angle: 0 },
      ],
      loads: [down(1, 1), down(5, 2), down(6, 2), down(4, 1)],
    },
    ritter: 4,
    book: { reactions: { X_A: 5.4, Y_A: 6, R_B: -5.4 }, bars: [-5.4, -3.6, -1.8, 2.06, 2.06, 4.1, -6, 3.5, -3, 2.7, -2] },
    note: 'Узел B прижат к стене катком: реакция горизонтальна (X_B книги = R_B).',
  },
} satisfies Record<string, TrussPreset>;

export type TrussPresetKey = keyof typeof TRUSS_PRESETS;
