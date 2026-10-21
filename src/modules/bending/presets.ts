/**
 * Готовые задачи вкладки «Изгиб». Схема загружается в «Балки и рамы» (там же её можно править):
 * эпюры строятся по той же конструкции и найденным реакциям.
 */
import type { IdGen } from '../../shared/ids';
import { loadPreset, PRESET_TITLES, presetStructure, type Preset, type PresetKey } from '../frames/model/presets';
import type { Structure } from '../frames/model/types';

interface BendingPreset {
  title: string;
  build: (ids?: IdGen) => Structure;
}

const own = (title: string, p: Preset): BendingPreset => ({ title, build: (ids) => presetStructure(p, ids) });
const frames = (k: PresetKey): BendingPreset => ({ title: PRESET_TITLES[k], build: (ids) => loadPreset(k, ids) });

export const BENDING_PRESETS = {
  /** Антонов и др., «Прикладная механика», рис. 8.5: l = 1, q = 3. Ответ: Q = 2 и −4; M(l) = 2; M_max = 8/3. */
  antonov85: own('Антонов, рис. 8.5: пролёт 3l, нагрузка q на 2l', {
    pts: [[0, 0], [1, 0], [3, 0]],
    items: [
      { type: 'pin', at: 0, side: 'below' },
      { type: 'roller', at: 2, side: 'below' },
      { type: 'dist', from: 1, to: 2, q1: 3, q2: 3, dir: 'down' },
    ],
  }),
  /**
   * Антонов, задача 2, схема 7: шарнир слева, q на 3a, пара через 5a, каток через 6,5a, сила P на конце консоли.
   * Данные группы 10: P = 40 кН, q = 10 кН/м, a = 2 м; M = 10Z кН·м при Z = 5.
   */
  antonov7: own('Антонов, задача 2, схема 7 (группа 10, Z = 5)', {
    pts: [[0, 0], [6, 0], [10, 0], [13, 0], [16, 0]],
    items: [
      { type: 'pin', at: 0, side: 'below' },
      { type: 'dist', from: 0, to: 1, q1: 10, q2: 10, dir: 'down' },
      { type: 'moment', at: 2, M: 50, dir: 'cw', unknown: false },
      { type: 'roller', at: 3, side: 'below' },
      { type: 'force', at: 4, F: 40, ref: 'down', rot: 'cw', alpha: 0, unknown: false },
    ],
  }),
  cantileverQP: own('Консоль: равномерная нагрузка и сила на конце', {
    pts: [[0, 0], [2, 0], [3, 0]],
    items: [
      { type: 'fixed', at: 0, side: 'left' },
      { type: 'dist', from: 0, to: 1, q1: 4, q2: 4, dir: 'down' },
      { type: 'force', at: 2, F: 6, ref: 'down', rot: 'cw', alpha: 0, unknown: false },
    ],
  }),
  simple: frames('simple'),
  cantilever: frames('cantilever'),
  gerber: frames('gerber'),
} satisfies Record<string, BendingPreset>;

export type BendingPresetKey = keyof typeof BENDING_PRESETS;
