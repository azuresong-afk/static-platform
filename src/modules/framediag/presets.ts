/**
 * Готовые задачи вкладки «Рамы: эпюры N, Q, M». Схема загружается в «Балки и рамы» (там же её можно править).
 */
import type { IdGen } from '../../shared/ids';
import { loadPreset, PRESET_TITLES, presetStructure, type Preset, type PresetKey } from '../frames/model/presets';
import type { Structure } from '../frames/model/types';

interface FramePreset {
  title: string;
  build: (ids?: IdGen) => Structure;
}

const own = (title: string, p: Preset): FramePreset => ({ title, build: (ids) => presetStructure(p, ids) });
const frames = (k: PresetKey): FramePreset => ({ title: PRESET_TITLES[k], build: (ids) => loadPreset(k, ids) });

export const FRAME_PRESETS = {
  gframe: frames('gframe'),
  pframe: frames('pframe'),
  /** Консольная рама: заделка внизу стойки, ригель, сила под углом и пара на конце. */
  console: own('Консольная рама: сила под углом и пара на конце ригеля', {
    pts: [[0, 0], [0, 3], [2, 3]],
    items: [
      { type: 'fixed', at: 0, side: 'below' },
      { type: 'dist', from: 1, to: 2, q1: 4, q2: 4, dir: 'down' },
      { type: 'force', at: 2, F: 6, ref: 'right', rot: 'cw', alpha: 30, unknown: false },
      { type: 'moment', at: 2, M: 5, dir: 'ccw', unknown: false },
    ],
  }),
  /** Рама с наклонным ригелем (уклон 3:4): шарнир под стойкой, каток под правым концом, нагрузка по нормали к ригелю. */
  inclined: own('Рама с наклонным ригелем: нагрузка перпендикулярно ригелю', {
    pts: [[0, 0], [0, 3], [4, 6], [6, 6]],
    items: [
      { type: 'pin', at: 0, side: 'below' },
      { type: 'roller', at: 3, side: 'below' },
      { type: 'dist', from: 1, to: 2, q1: 2, q2: 2, dir: 'nd' },
      { type: 'force', at: 1, F: 5, ref: 'right', rot: 'ccw', alpha: 0, unknown: false },
    ],
  }),
  arch3: frames('arch3'),
  post: frames('post'),
  rafter: frames('rafter'),
} satisfies Record<string, FramePreset>;

export type FramePresetKey = keyof typeof FRAME_PRESETS;
