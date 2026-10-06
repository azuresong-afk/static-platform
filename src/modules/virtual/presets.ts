/**
 * Готовые задачи вкладки «Возможные перемещения» (Мещерский §46). Схема загружается в «Балки и рамы».
 * Размеры a, h, l в задачах буквенные — здесь взяты a = 1, h = 1, l = 2 (ответы приведены к этим числам).
 */
import type { IdGen } from '../../shared/ids';
import { loadPreset, PRESET_TITLES, presetStructure, type Preset, type PresetKey } from '../frames/model/presets';
import type { Structure } from '../frames/model/types';

interface VirtualPreset {
  title: string;
  build: (ids?: IdGen) => Structure;
}

const own = (title: string, p: Preset): VirtualPreset => ({ title, build: (ids) => presetStructure(p, ids) });
const frames = (k: PresetKey): VirtualPreset => ({ title: PRESET_TITLES[k], build: (ids) => loadPreset(k, ids) });
const down = (at: number, F: number) => ({ type: 'force' as const, at, F, ref: 'down' as const, rot: 'cw' as const, alpha: 0, unknown: false });

/** Мещерский 46.19: составная балка AD на трёх опорах, шарнир C; силы 2, 6, 3 т. Ответ: R_A = 1, R_B = 10,5, R_D = −0,5. */
export const M4619: Preset = {
  pts: [
    [0, 0],
    [1, 0],
    [2, 0],
    [3, 0],
    [4, 0],
    [6, 0],
    [8, 0],
  ],
  hinges: [2],
  items: [
    { type: 'pin', at: 0, side: 'below' },
    down(1, 2),
    down(3, 6),
    { type: 'roller', at: 4, side: 'below' },
    down(5, 3),
    { type: 'roller', at: 6, side: 'below' },
  ],
};
/** Мещерский 46.20: та же балка без опоры D — какая пара на участке BD нужна, чтобы R_D = 0. Ответ: M = 2a. */
export const M4620: Preset = { ...M4619, items: [...M4619.items.slice(0, 5), { type: 'moment', at: 6, M: 1, dir: 'ccw', unknown: true }] };
/** Мещерский 46.21–46.22: балка AE из трёх частей, опоры A и C, заделка E, четыре силы P = 1. Ответ: R_E = 0,5P, m_E = 0. */
export const M4621: Preset = {
  pts: [
    [0, 0],
    [1, 0],
    [2, 0],
    [3, 0],
    [4, 0],
    [5, 0],
    [6, 0],
    [7, 0],
    [8, 0],
  ],
  hinges: [2, 6],
  items: [
    { type: 'roller', at: 0, side: 'below' },
    down(1, 1),
    down(3, 1),
    { type: 'roller', at: 4, side: 'below' },
    down(5, 1),
    down(7, 1),
    { type: 'fixed', at: 8, side: 'right' },
  ],
};
/** Мещерский 46.25: Г-образная рама, защемлённая в стене, шарнир C, каток внизу; P1 = 4, P2 = 2, l = 2, h = 1. Ответ: Y_A = P1 − P2·h/l = 3. */
export const M4625: Preset = {
  pts: [
    [0, 3],
    [0.5, 3],
    [1, 3],
    [3, 3],
    [3, 2],
    [3, 0],
  ],
  hinges: [2],
  items: [
    { type: 'fixed', at: 0, side: 'left' },
    down(1, 4),
    { type: 'force', at: 4, F: 2, ref: 'left', rot: 'cw', alpha: 0, unknown: false },
    { type: 'roller', at: 5, side: 'below' },
  ],
};
/** Мещерский 46.26–46.27: стойка AB в заделке, балки BC и CD, шарнир D на полу; P1 = 3, P2 = 2, h = 1. Ответ: R = P1 + P2/2 = 4, m_A = 4. */
export const M4626: Preset = {
  pts: [
    [0, 0],
    [0, 1],
    [1, 1.5],
    [2, 2],
    [2, 1],
    [2, 0],
  ],
  hinges: [1, 3],
  items: [
    { type: 'fixed', at: 0, side: 'below' },
    { type: 'force', at: 2, F: 3, ref: 'right', rot: 'cw', alpha: 0, unknown: false },
    { type: 'force', at: 4, F: 2, ref: 'right', rot: 'cw', alpha: 0, unknown: false },
    { type: 'pin', at: 5, side: 'below' },
  ],
};

export const VIRTUAL_PRESETS = {
  m4619: own('Мещерский 46.19: составная балка на трёх опорах', M4619),
  m4620: own('Мещерский 46.20: пара, при которой реакция в D равна нулю', M4620),
  m4621: own('Мещерский 46.21–46.22: балка из трёх частей с заделкой', M4621),
  m4625: own('Мещерский 46.25: Г-образная рама с шарниром', M4625),
  m4626: own('Мещерский 46.26–46.27: стойка в заделке и две балки', M4626),
  lever: frames('lever'),
  arch3: frames('arch3'),
} satisfies Record<string, VirtualPreset>;

export type VirtualPresetKey = keyof typeof VIRTUAL_PRESETS;
