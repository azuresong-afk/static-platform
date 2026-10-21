/**
 * Готовые задачи: Мещерский §8 (изд. 1975). Оси: x — к наблюдателю (на чертеже влево-вниз), y — вправо, z — вверх.
 * Единицы книги (н, кГ, см) сохранены числами: расчёт линеен; в приложении силы подписаны кН, длины — м.
 */
import type { Body } from './model/body';

export interface BodyPreset {
  title: string;
  body: Body;
  /** Ответ книги в правиле знаков приложения. */
  book?: Record<string, number>;
  note?: string;
}

const d = 2; // 8.24: длина диагонали AC — ответ от неё не зависит
const s30 = 0.5,
  c30 = Math.sqrt(3) / 2;
const a26 = 30; // 8.26: сторона пластинки, см

export const BODY_PRESETS = {
  m824: {
    title: 'Мещерский 8.24: рама на шаровом шарнире и петле, верёвка CE',
    body: {
      // A — шаровой шарнир, AB — вдоль y (петля B), AD — вдоль x; ∠BAC = ∠ECA = 30°.
      points: [
        { name: 'A', x: 0, y: 0, z: 0 },
        { name: 'B', x: 0, y: d * c30, z: 0 },
        { name: 'C', x: d * s30, y: d * c30, z: 0 },
        { name: 'D', x: d * s30, y: 0, z: 0 },
        { name: 'E', x: 0, y: 0, z: d * Math.tan(Math.PI / 6) },
        { name: 'O', x: (d * s30) / 2, y: (d * c30) / 2, z: 0 },
      ],
      supports: [
        { kind: 'ball', at: 0 },
        { kind: 'bearing', at: 1, axis: 'y' },
      ],
      forces: [
        { at: 5, mode: 'comp', F: 20, c: [0, 0, -20], name: 'G' },
        { at: 2, mode: 'toward', F: 1, to: 4, unknown: true, name: 'T' },
      ],
      pairs: [],
      edges: [
        [2, 4],
        [0, 4],
      ],
      faces: [[0, 1, 2, 3]],
    },
    book: { X_A: 8.66, Y_A: 15, Z_A: 10, X_B: 0, Z_B: 0, T: 20 },
    note: 'Вес — в центре рамы O. Натяжение верёвки — неизвестная сила T от C к E.',
  },
  m825: {
    title: 'Мещерский 8.25: полка вагона на петлях и стержне ED',
    body: {
      // Ось AB — вдоль y (B в начале координат), AD — вдоль x; E на стене под A, ED = 75 см.
      points: [
        { name: 'B', x: 0, y: 0, z: 0 },
        { name: 'A', x: 0, y: 150, z: 0 },
        { name: 'D', x: 60, y: 150, z: 0 },
        { name: 'C', x: 60, y: 0, z: 0 },
        { name: 'H', x: 0, y: 25, z: 0 },
        { name: 'K', x: 0, y: 125, z: 0 },
        { name: 'E', x: 0, y: 150, z: -45 },
        { name: 'O', x: 30, y: 75, z: 0 },
      ],
      supports: [
        { kind: 'bearing', at: 5, axis: 'y' },
        { kind: 'bearing', at: 4, axis: 'y' },
        { kind: 'rod', at: 2, to: 6 },
      ],
      forces: [{ at: 7, mode: 'comp', F: 80, c: [0, 0, -80], name: 'P' }],
      pairs: [],
      edges: [[2, 6]],
      faces: [[0, 1, 2, 3]],
    },
    book: { S_D: 200 / 3, X_K: -200 / 3, Z_K: -10, X_H: 40 / 3, Z_H: 50 },
    note: 'Петли K и H не мешают сдвигу вдоль оси AB, но сил вдоль неё нет. «+» у стержня — сжатие (усилие от E к D).',
  },
  m826: {
    title: 'Мещерский 8.26: пластинка на шарнирах A, B и острие E',
    body: {
      // AB — вдоль x (B к наблюдателю), AD — в плоскости yz под углом 30° к горизонтали вниз.
      points: [
        { name: 'A', x: 0, y: 0, z: 0 },
        { name: 'B', x: a26, y: 0, z: 0 },
        { name: 'C', x: a26, y: a26 * c30, z: -a26 * s30 },
        { name: 'D', x: 0, y: a26 * c30, z: -a26 * s30 },
        { name: 'E', x: a26 / 2, y: a26 * c30, z: -a26 * s30 },
        { name: 'H', x: a26, y: 10 * c30, z: -10 * s30 },
        { name: 'O', x: a26 / 2, y: (a26 * c30) / 2, z: (-a26 * s30) / 2 },
      ],
      supports: [
        { kind: 'ball', at: 0 },
        { kind: 'bearing', at: 1, axis: 'x' },
        { kind: 'normal', at: 4, n: [0, s30, c30] },
      ],
      forces: [
        { at: 6, mode: 'comp', F: 5, c: [0, 0, -5], name: 'P' },
        { at: 5, mode: 'comp', F: 10, c: [-10, 0, 0], name: 'F' },
      ],
      pairs: [],
      edges: [],
      faces: [[0, 1, 2, 3]],
    },
    book: { X_A: 10, Y_A: 2.35, Z_A: -0.11, Y_B: -3.43, Z_B: 3.23, R_E: 2.17 },
    note: 'Острие E — середина CD, реакция перпендикулярна пластинке. Сила F = 10 в точке H на BC (BH = 10 см) параллельна AB, от B к A.',
  },
  shaft: {
    title: 'Вал со шкивом и зубчатым колесом: найти окружное усилие P',
    body: {
      // Вал вдоль y: подшипник A (ось y) и подпятник B; шкив r = 0,2 м — натяжения ветвей ремня t = 1 и T = 2t вдоль x
      // (как в задании С.7 Яблонского); зубчатое колесо r = 0,1 м — окружное усилие P вверх.
      points: [
        { name: 'A', x: 0, y: 0, z: 0 },
        { name: 'B', x: 0, y: 1, z: 0 },
        { name: 'C', x: 0, y: 0.3, z: 0.2 },
        { name: 'D', x: 0, y: 0.3, z: -0.2 },
        { name: 'E', x: 0.1, y: 0.7, z: 0 },
        { name: 'K', x: 0, y: 0.3, z: 0 },
        { name: 'L', x: 0, y: 0.7, z: 0 },
      ],
      supports: [
        { kind: 'bearing', at: 0, axis: 'y' },
        { kind: 'thrust', at: 1 },
      ],
      forces: [
        { at: 2, mode: 'comp', F: 2, c: [1, 0, 0], name: 'T', link: 1, k: 2 },
        { at: 3, mode: 'comp', F: 1, c: [1, 0, 0], name: 't' },
        { at: 4, mode: 'comp', F: 1, c: [0, 0, 1], unknown: true, name: 'P' },
      ],
      pairs: [],
      edges: [
        [0, 1],
        [2, 3],
        [4, 6],
      ],
      faces: [],
    },
    note: 'Натяжения ветвей ремня связаны: T = 2t. Момент натяжений (T − t)·0,2 уравновешивается моментом P·0,1: P = 2.',
  },
} satisfies Record<string, BodyPreset>;

export type BodyPresetKey = keyof typeof BODY_PRESETS;
