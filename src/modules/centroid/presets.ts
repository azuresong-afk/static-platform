/**
 * Готовые задачи: Мещерский §9 (изд. 1975). Ответы — в системе координат книги; если книга даёт
 * координату вдоль особой оси (9.6 — по диагонали), это сказано в note и проверяется в тестах.
 */
import type { CPart, CProblem } from './model/centroid';

export interface CentroidPreset {
  title: string;
  problem: CProblem;
  /** Ответ книги: x, y, z центра тяжести (что дано). */
  book?: Partial<Record<'x' | 'y' | 'z' | 'diag', number>>;
  note?: string;
}

const part = (kind: CPart['kind'], p: Record<string, number>, s: 1 | -1 = 1, k = 1, pts?: [number, number][]): CPart => ({ kind, p, s, k, ...(pts ? { pts } : {}) });

export const CENTROID_PRESETS = {
  m97: {
    title: 'Мещерский 9.7: сечение плотины (бетон и грунт)',
    problem: {
      mode: 'area',
      parts: [
        part('tri', { x1: 0, y1: 0, x2: 8, y2: 0, x3: 8, y3: 4 }, 1, 1.6),
        part('poly', {}, 1, 2.4, [
          [8, 0],
          [13, 0],
          [10, 5],
          [8, 5],
        ]),
        part('rect', { x: 9, y: 0, w: 1, h: 2 }, -1, 2.4),
      ],
    },
    book: { y: 1.9 },
    note: 'Удельный вес грунта 1,6 т/м³, бетона — 2,4 т/м³; галерея 1 × 2 м — вырез в бетоне. В книге x_C = 8,19 м, по расчёту 8,04 м: при любом положении галереи внутри бетона x_C не больше 8,14 (это значение без галереи), а y_C = 1,9 совпадает — вероятно, опечатка в книге.',
  },
  m912: {
    title: 'Мещерский 9.12: квадратная доска с отверстием',
    problem: {
      mode: 'area',
      parts: [part('rect', { x: -1, y: -1, w: 2, h: 2 }), part('rect', { x: 0.15, y: 0.15, w: 0.7, h: 0.7 }, -1)],
    },
    book: { x: -0.07, y: -0.07 },
    note: 'Начало координат — центр доски O, центр отверстия O₁ — в точке (0,5; 0,5).',
  },
  m93: {
    title: 'Мещерский 9.3: круговой сегмент, угол 60°',
    problem: { mode: 'area', parts: [part('segment', { cx: 0, cy: 0, r: 30, a1: 60, a2: 120 })] },
    book: { x: 0, y: 27.7 },
    note: 'Центр O — начало координат, сегмент симметричен относительно оси y: OC = y_C.',
  },
  m95: {
    title: 'Мещерский 9.5: четверть кольца',
    problem: {
      mode: 'area',
      parts: [part('sector', { cx: 0, cy: 0, r: 3, a1: 0, a2: 90 }), part('sector', { cx: 0, cy: 0, r: 1, a1: 0, a2: 90 }, -1)],
    },
    book: { x: 1.38, y: 1.38 },
  },
  m96: {
    title: 'Мещерский 9.6: квадрат без четверти круга, a = 1',
    problem: {
      mode: 'area',
      parts: [part('rect', { x: 0, y: 0, w: 1, h: 1 }), part('sector', { cx: 1, cy: 1, r: 0.5, a1: 180, a2: 270 }, -1)],
    },
    book: { diag: 0.61 },
    note: 'В книге ось x — диагональ квадрата из O: x книги = (x + y)/√2.',
  },
  m916: {
    title: 'Мещерский 9.16: грузы в вершинах параллелепипеда',
    problem: {
      mode: 'mass',
      parts: [
        part('point', { x: 0, y: 0, z: 0, w: 1 }),
        part('point', { x: 0, y: 20, z: 0, w: 2 }),
        part('point', { x: 0, y: 0, z: 10, w: 3 }),
        part('point', { x: 5, y: 0, z: 0, w: 4 }),
        part('point', { x: 5, y: 0, z: 10, w: 5 }),
        part('point', { x: 0, y: 20, z: 10, w: 3 }),
        part('point', { x: 5, y: 20, z: 10, w: 4 }),
        part('point', { x: 5, y: 20, z: 0, w: 3 }),
      ],
    },
    book: { x: 3.2, y: 9.6, z: 6 },
    note: 'AB = 20 см по y, AC = 10 см по z, AD = 5 см по x; грузы A…H — 1, 2, 3, 4, 5, 3, 4, 3 кГ.',
  },
  m920: {
    title: 'Мещерский 9.20: деревянный молоток',
    problem: {
      mode: 'volume',
      parts: [part('box', { x: -5, y: 0, z: -9, a: 10, b: 8, c: 18 }), part('box', { x: -1.5, y: 8, z: -1.5, a: 3, b: 40, c: 3 })],
    },
    book: { x: 0, y: 8.8, z: 0 },
    note: 'Головка a × b × c = 10 × 8 × 18 см, ручка 3 × 3 × 40 см вдоль y.',
  },
  m926: {
    title: 'Мещерский 9.26: цилиндр на полушаре, h = r/√2',
    problem: {
      mode: 'volume',
      parts: [part('hemi', { x: 0, y: 0, z: 0, r: 1, ax: 2, dir: -1 }), part('cyl', { x: 0, y: 0, z: 0, r: 1, h: Math.SQRT1_2, ax: 2, dir: 1 })],
    },
    book: { z: 0 },
    note: 'Предельная высота: центр тяжести тела — в центре полушара (z = 0).',
  },
  m927: {
    title: 'Мещерский 9.27: конус на полушаре, h = r√3',
    problem: {
      mode: 'volume',
      parts: [part('hemi', { x: 0, y: 0, z: 0, r: 1, ax: 2, dir: -1 }), part('cone', { x: 0, y: 0, z: 0, r: 1, h: Math.sqrt(3), ax: 2, dir: 1 })],
    },
    book: { z: 0 },
  },
  m923: {
    title: 'Мещерский 9.23: усечённый тетраэдр — расстояние центра тяжести от основания',
    problem: { mode: 'volume', parts: [part('frustum', { x: 0, y: 0, z: 0, a: 4, b: 1, h: 3, ax: 2, dir: 1 })] },
    book: { z: (3 * (4 + 2 * Math.sqrt(4) + 3 * 1)) / (4 * (4 + Math.sqrt(4) + 1)) },
    note: 'Ответ книги — z = h(a + 2√(ab) + 3b)/(4(a + √(ab) + b)); числа — для a = 4, b = 1, h = 3. Формула не зависит от формы основания.',
  },
  m924: {
    title: 'Мещерский 9.24: корпус мины — центр тяжести поверхности',
    problem: {
      mode: 'surface',
      parts: [
        part('capsurf', { x: 0, y: 0, z: 0.08, r: 0.4, h: 0.08, ax: 2, dir: -1 }),
        part('cylsurf', { x: 0, y: 0, z: 0.08, r: 0.4, h: 0.8, ax: 2, dir: 1 }),
        part('capsurf', { x: 0, y: 0, z: 0.88, r: 0.4, h: 0.2, ax: 2, dir: 1 }),
      ],
    },
    book: { x: 0, y: 0, z: 0.507 },
    note: 'r = 0,4 м, пояс высотой 2r, сегменты 0,5r (сверху) и 0,2r (снизу); начало координат — в нижней точке корпуса (так получается ответ книги z = 1,267r).',
  },
  m928: {
    title: 'Мещерский 9.28: лист, согнутый в виде двух треугольников и квадрата',
    problem: {
      mode: 'surface',
      parts: [
        part('tri3', { x1: 0, y1: 0, z1: 0, x2: 4, y2: 4, z2: 0, x3: 8, y3: 0, z3: 0 }),
        part('quad3', { x1: 0, y1: 0, z1: 0, x2: 8, y2: 0, z2: 0, x3: 8, y3: 0, z3: 8, x4: 0, y4: 0, z4: 8 }),
        part('tri3', { x1: 0, y1: 0, z1: 0, x2: 0, y2: 4, z2: 8, x3: 0, y3: 0, z3: 8 }),
      ],
    },
    book: { x: 3.33, y: 0.444, z: 3.55 },
    note: 'OAB — в плоскости xy (OB = 8 см, высота 4 см), квадрат OBKE — в горизонтальной плоскости xz, ODE — в плоскости yz, прямой угол при E. Точно z = 3,556 см: книга не округляет, а отбрасывает (3,55).',
  },
  arc: {
    title: 'Проволока: полуокружность и диаметр',
    problem: {
      mode: 'line',
      parts: [part('arc', { cx: 0, cy: 0, r: 1, a1: 0, a2: 180 }), part('line', { x1: -1, y1: 0, z1: 0, x2: 1, y2: 0, z2: 0 })],
    },
    note: 'y_C = (πr·2r/π)/(πr + 2r) = 2r/(π + 2).',
  },
} satisfies Record<string, CentroidPreset>;

export type CentroidPresetKey = keyof typeof CENTROID_PRESETS;
