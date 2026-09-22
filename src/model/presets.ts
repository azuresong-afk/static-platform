import { r3 } from './format';
import { createIdGen, type IdGen } from './ids';
import type { Dir, DistItem, Item, Structure } from './types';

type DistPresetItem<T> = T extends DistItem ? Omit<T, 'id' | 'from' | 'to'> & { from: number; to: number } : never;
type PointPresetItem<T> = T extends { at: string } ? Omit<T, 'id' | 'at'> & { at: number } : never;
/** Элемент готовой задачи: узлы заданы индексом точки в pts. */
export type PresetItem = PointPresetItem<Item> | DistPresetItem<Item>;

export interface Preset {
  /** Точки ломаной по порядку; соседние соединяются участками. */
  pts: [number, number][];
  items: PresetItem[];
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
  blank: { pts: [[0, 0], [4, 0]], items: [] },
};

/** Конструкция из описания готовой задачи (как loadPreset в прототипе). */
export function presetStructure(p: Preset, ids: IdGen = createIdGen()): Structure {
  const nodes = p.pts.map(() => ({ id: ids.node() }));
  const segs = p.pts.slice(1).map((q, i) => {
    const P = p.pts[i],
      dx = q[0] - P[0],
      dy = q[1] - P[1];
    const dir: Dir = Math.abs(dx) > 1e-9 ? (dx > 0 ? 'r' : 'l') : dy > 0 ? 'u' : 'd';
    return { id: ids.seg(), a: nodes[i].id, b: nodes[i + 1].id, dir, len: r3(Math.abs(dx) + Math.abs(dy)) };
  });
  const N = (i: number) => nodes[i].id;
  const items = p.items.map((it) => {
    const id = ids.item();
    return it.type === 'dist' ? { id, ...it, from: N(it.from), to: N(it.to) } : { id, ...it, at: N(it.at) };
  }) as Item[];
  return { nodes, segs, items };
}

export const loadPreset = (k: PresetKey, ids?: IdGen): Structure => presetStructure(PRESETS[k], ids);
