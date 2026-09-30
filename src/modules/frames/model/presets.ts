import { r3 } from '../../../shared/format';
import { createIdGen, type IdGen } from '../../../shared/ids';
import { axisDir, normAng } from './constants';
import type { Dir, DistItem, Item, Seg, Structure } from './types';

type DistPresetItem<T> = T extends DistItem ? Omit<T, 'id' | 'from' | 'to'> & { from: number; to: number } : never;
type PointPresetItem<T> = T extends { at: string } ? Omit<T, 'id' | 'at'> & { at: number } : never;
/** Элемент готовой задачи: узлы заданы индексом точки в pts. */
export type PresetItem = PointPresetItem<Item> | DistPresetItem<Item>;

/**
 * Точка ломаной: координаты [x, y] или участок от предыдущей точки — длина l и угол a к оси x, град
 * (так наклонные участки задаются точно, без округления координат).
 */
export type PresetPt = [number, number] | { l: number; a: number };

export interface Preset {
  /** Точки ломаной по порядку; соседние соединяются участками. Первая — всегда координаты. */
  pts: PresetPt[];
  items: PresetItem[];
  /** Индексы точек с внутренним шарниром. */
  hinges?: number[];
}

export const PRESET_TITLES = {
  simple: 'Балка на двух опорах',
  cantilever: 'Консоль с жёсткой заделкой',
  rod: 'Балка на стержне под углом',
  lever: 'Рычаг: найти силу F',
  gframe: 'Г-образная рама с заделкой',
  pframe: 'П-образная рама',
  post: 'Стойка с катком у стены',
  bracket: 'Кронштейн: шарнир на стене и подкос',
  indet: 'Статически неопределимая балка',
  gerber: 'Составная балка с шарниром',
  arch3: 'Трёхшарнирная рама (арка)',
  ladder: 'Лестница у гладкой стены (наклонная)',
  rafter: 'Стропила: ветер перпендикулярно скату',
  incline: 'Брус на наклонной плоскости: трение',
  crane: 'Кран на рельсах: груз, при котором не опрокинется',
  blank: 'Пустой шаблон — собрать по шагам',
} as const;

export type PresetKey = keyof typeof PRESET_TITLES;

/** Входные данные готовых задач — дословно из прототипа. */
export const PRESETS: Record<PresetKey, Preset> = {
  simple: {
    pts: [[0, 0], [2, 0], [3, 0], [4, 0], [6, 0]],
    items: [
      { type: 'pin', at: 0, side: 'below' },
      { type: 'roller', at: 4, side: 'below' },
      { type: 'force', at: 1, F: 10, ref: 'left', rot: 'ccw', alpha: 60, unknown: false },
      { type: 'moment', at: 3, M: 6, dir: 'cw', unknown: false },
      { type: 'dist', from: 2, to: 4, q1: 2, q2: 2, dir: 'down' },
    ],
  },
  cantilever: {
    pts: [[0, 0], [2, 0], [3, 0], [4, 0]],
    items: [
      { type: 'fixed', at: 0, side: 'left' },
      { type: 'dist', from: 0, to: 1, q1: 4, q2: 0, dir: 'down' },
      { type: 'moment', at: 2, M: 5, dir: 'ccw', unknown: false },
      { type: 'force', at: 3, F: 8, ref: 'down', rot: 'cw', alpha: 0, unknown: false },
    ],
  },
  rod: {
    pts: [[0, 0], [1.5, 0], [3, 0], [5, 0]],
    items: [
      { type: 'pin', at: 0, side: 'below' },
      { type: 'rod', at: 3, angle: 120 },
      { type: 'weight', at: 2, G: 12 },
      { type: 'force', at: 1, F: 6, ref: 'right', rot: 'cw', alpha: 60, unknown: false },
    ],
  },
  lever: {
    pts: [[0, 0], [1, 0], [4, 0]],
    items: [
      { type: 'pin', at: 1, side: 'below' },
      { type: 'weight', at: 0, G: 20 },
      { type: 'force', at: 2, F: 10, ref: 'down', rot: 'cw', alpha: 0, unknown: true },
    ],
  },
  gframe: {
    pts: [[0, 0], [0, 2], [0, 4], [3, 4]],
    items: [
      { type: 'fixed', at: 0, side: 'below' },
      { type: 'dist', from: 0, to: 2, q1: 2, q2: 2, dir: 'right' },
      { type: 'force', at: 3, F: 10, ref: 'down', rot: 'cw', alpha: 0, unknown: false },
      { type: 'moment', at: 2, M: 4, dir: 'cw', unknown: false },
    ],
  },
  pframe: {
    pts: [[0, 0], [0, 4], [3, 4], [6, 4], [6, 0]],
    items: [
      { type: 'pin', at: 0, side: 'below' },
      { type: 'roller', at: 4, side: 'below' },
      { type: 'force', at: 1, F: 5, ref: 'right', rot: 'ccw', alpha: 0, unknown: false },
      { type: 'dist', from: 1, to: 3, q1: 2, q2: 2, dir: 'down' },
      { type: 'force', at: 2, F: 8, ref: 'down', rot: 'ccw', alpha: 30, unknown: false },
    ],
  },
  post: {
    pts: [[0, 0], [0, 3], [0, 5]],
    items: [
      { type: 'pin', at: 0, side: 'below' },
      { type: 'roller', at: 2, side: 'left' },
      { type: 'force', at: 1, F: 6, ref: 'left', rot: 'cw', alpha: 0, unknown: false },
      { type: 'weight', at: 2, G: 4 },
    ],
  },
  bracket: {
    pts: [[0, 0], [1.5, 0], [3, 0]],
    items: [
      { type: 'pin', at: 0, side: 'left' },
      { type: 'rod', at: 2, angle: 45 },
      { type: 'weight', at: 1, G: 10 },
    ],
  },
  indet: {
    pts: [[0, 0], [6, 0]],
    items: [
      { type: 'fixed', at: 0, side: 'left' },
      { type: 'roller', at: 1, side: 'below' },
      { type: 'dist', from: 0, to: 1, q1: 3, q2: 3, dir: 'down' },
    ],
  },
  // Мещерский 4.32: составная балка, шарнир D.
  gerber: {
    pts: [[0, 0], [8, 0], [10, 0], [15, 0], [20, 0]],
    hinges: [3],
    items: [
      { type: 'pin', at: 0, side: 'below' },
      { type: 'force', at: 1, F: 4, ref: 'right', rot: 'cw', alpha: 45, unknown: false },
      { type: 'roller', at: 2, side: 'below' },
      { type: 'roller', at: 4, side: 'below' },
      { type: 'dist', from: 2, to: 4, q1: 2, q2: 2, dir: 'down' },
    ],
  },
  // Мещерский 4.34: трёхшарнирная арка, заменённая рамой с теми же точками опор, шарнира и нагрузок.
  arch3: {
    pts: [[0, 0], [0, 4], [1, 4], [4, 4], [5, 4], [9, 4], [10, 4], [10, 0]],
    hinges: [4],
    items: [
      { type: 'pin', at: 0, side: 'below' },
      { type: 'pin', at: 7, side: 'below' },
      { type: 'weight', at: 2, G: 4 },
      { type: 'weight', at: 3, G: 2 },
      { type: 'weight', at: 5, G: 4 },
    ],
  },
  // Мещерский 4.13: лестница под 45°, человек на трети длины, гладкая стена.
  ladder: {
    pts: [[0, 0], { l: 1, a: 45 }, { l: 0.5, a: 45 }, { l: 1.5, a: 45 }],
    items: [
      { type: 'pin', at: 0, side: 'below' },
      { type: 'weight', at: 1, G: 60 },
      { type: 'weight', at: 2, G: 20 },
      { type: 'roller', at: 3, side: 'right' },
    ],
  },
  // Мещерский 4.21: стропильная ферма как одно тело, ветер перпендикулярен скату AC (равнодействующая 0,8).
  rafter: {
    pts: [[0, 0], { l: 2 * Math.sqrt(3), a: 30 }, { l: 2 * Math.sqrt(3), a: 330 }],
    items: [
      { type: 'pin', at: 0, side: 'below' },
      { type: 'roller', at: 2, side: 'below' },
      { type: 'weight', at: 1, G: 10 },
      { type: 'dist', from: 0, to: 1, q1: 0.4 / Math.sqrt(3), q2: 0.4 / Math.sqrt(3), dir: 'nd' },
    ],
  },
  // Брус весом 10 на плоскости под 30°, f = 0,2; сила вдоль плоскости — в каких пределах держит брус.
  incline: {
    pts: [[0, 0], { l: 0.5, a: 30 }],
    items: [
      { type: 'rough', at: 0, side: 'tilt', angle: 120, f: 0.2 },
      { type: 'weight', at: 0, G: 10 },
      // Сила приложена в B, но её линия действия идёт вдоль AB и проходит через A — как у силы в точке A.
      { type: 'force', at: 1, F: 5, ref: 'right', rot: 'ccw', alpha: 30, unknown: true },
    ],
  },
  // Мещерский 3.23: рельсы — односторонние связи; наибольший груз Q на вылете.
  crane: {
    pts: [[0, 0], [0.25, 0], [0.9, 0], [1, 0], [1.75, 0], [2, 0], [3, 0]],
    items: [
      { type: 'weight', at: 0, G: 2 },
      { type: 'roller', at: 1, side: 'below', oneSided: true },
      { type: 'weight', at: 2, G: 1 },
      { type: 'weight', at: 3, G: 3 },
      { type: 'roller', at: 4, side: 'below', oneSided: true },
      { type: 'weight', at: 5, G: 0.5 },
      { type: 'force', at: 6, F: 1, ref: 'down', rot: 'cw', alpha: 0, unknown: true },
    ],
  },
  blank: { pts: [[0, 0], [4, 0]], items: [] },
};

/** Конструкция из описания готовой задачи (как loadPreset в прототипе). */
export function presetStructure(p: Preset, ids: IdGen = createIdGen()): Structure {
  const nodes = p.pts.map((_, i) => (p.hinges?.includes(i) ? { id: ids.node(), hinge: true } : { id: ids.node() }));
  // Координаты точек, заданных участком, нужны следующей точке, заданной координатами.
  const xy: [number, number][] = [];
  const segs = p.pts.slice(1).map((q, i): Seg => {
    const P = i ? xy[i - 1] : (p.pts[0] as [number, number]);
    const base = { id: ids.seg(), a: nodes[i].id, b: nodes[i + 1].id };
    if (!Array.isArray(q)) {
      const t = (q.a * Math.PI) / 180;
      xy.push([P[0] + q.l * Math.cos(t), P[1] + q.l * Math.sin(t)]);
      const ax = axisDir(q.a);
      return ax ? { ...base, dir: ax, len: r3(q.l) } : { ...base, dir: 'a', len: q.l, ang: normAng(q.a) };
    }
    xy.push(q);
    const dx = q[0] - P[0],
      dy = q[1] - P[1];
    if (Math.abs(dx) > 1e-9 && Math.abs(dy) > 1e-9) return { ...base, dir: 'a', len: Math.hypot(dx, dy), ang: normAng((Math.atan2(dy, dx) * 180) / Math.PI) };
    const dir: Dir = Math.abs(dx) > 1e-9 ? (dx > 0 ? 'r' : 'l') : dy > 0 ? 'u' : 'd';
    return { ...base, dir, len: r3(Math.abs(dx) + Math.abs(dy)) };
  });
  const N = (i: number) => nodes[i].id;
  const items = p.items.map((it) => {
    const id = ids.item();
    return it.type === 'dist' ? { id, ...it, from: N(it.from), to: N(it.to) } : { id, ...it, at: N(it.at) };
  }) as Item[];
  return { nodes, segs, items };
}

export const loadPreset = (k: PresetKey, ids?: IdGen): Structure => presetStructure(PRESETS[k], ids);
