/**
 * Готовые задачи вкладки «Пространственный брус» — по мотивам схем задачи 3 Антонова (с. 166–170).
 * Данные группы 20: P = 5Z кН (Z = 5 → 25 кН), M = 10 кН·м, q = 10 кН/м, l = 1 м, [σ] = 160 МПа.
 * Направления сил на мелких рисунках читаются неоднозначно — сверьте с вашим вариантом.
 * Оси: x — вправо, y — вглубь рисунка, z — вверх.
 */
import type { Frame3 } from './model/frame3d';

const base = { c: 0.8, sigma: 160, hyp: 3 as const };

export const SPACE_PRESETS = {
  s16: {
    title: 'Антонов, задача 3, по мотивам схемы 16 (А, круг): P в середине, q на втором участке',
    frame: {
      segs: [
        { axis: 'y', sign: -1, l: 1 },
        { axis: 'y', sign: -1, l: 1 },
        { axis: 'x', sign: -1, l: 2 },
      ],
      loads: [
        { kind: 'P', node: 1, axis: 'x', v: 25 },
        { kind: 'q', seg: 2, axis: 'z', v: -10 },
      ],
      section: 'circle',
      ...base,
    } as Frame3,
  },
  s9: {
    title: 'Антонов, задача 3, по мотивам схемы 9 (Б, кольцо): q вверх, P на конце',
    frame: {
      segs: [
        { axis: 'y', sign: -1, l: 2 },
        { axis: 'x', sign: 1, l: 2 },
      ],
      loads: [
        { kind: 'q', seg: 1, axis: 'z', v: 10 },
        { kind: 'P', node: 2, axis: 'y', v: -25 },
      ],
      section: 'ring',
      ...base,
    } as Frame3,
  },
  lpair: {
    title: 'Г-образный брус: сила и пара на конце',
    frame: {
      segs: [
        { axis: 'x', sign: 1, l: 1.5 },
        { axis: 'y', sign: -1, l: 1 },
      ],
      loads: [
        { kind: 'P', node: 2, axis: 'z', v: -20 },
        { kind: 'M', node: 2, axis: 'x', v: 10 },
      ],
      section: 'circle',
      ...base,
    } as Frame3,
  },
} satisfies Record<string, { title: string; frame: Frame3 }>;

export type SpacePresetKey = keyof typeof SPACE_PRESETS;
