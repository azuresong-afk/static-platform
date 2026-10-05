/**
 * Готовые задачи вкладки «Кручение».
 * Антонов, «Прикладная механика», п. 7.2, рис. 7.2: вал без заделок, моменты M, 2M, M (M = 1 кН·м); эпюра M_z = −M, +M.
 * Остальные — типовые постановки для проверки по точным формулам.
 */
import type { Shaft } from './model/shaft';

const steel = { G: 8e4, tauAllow: 40, thetaAllow: 0.5 };
const sh = (o: Partial<Shaft>): Shaft => {
  const nodes = (o.steps?.length ?? 1) + 1;
  const zeros = Array.from({ length: nodes }, () => 0);
  return { steps: [{ l: 1, k: 1, c: 0 }], moments: zeros, load: 'moment', powers: zeros, rpm: 0, supports: 'left', dMode: 'find', d: 50, ...steel, ...o };
};

export const TORSION_PRESETS = {
  ant72: {
    title: 'Антонов, рис. 7.2: моменты M, 2M, M без заделок — эпюра M_z',
    shaft: sh({ steps: [{ l: 1, k: 1, c: 0 }, { l: 1, k: 1, c: 0 }], moments: [1, -2, 1], supports: 'none' }),
    note: 'M = 1 кН·м. Ответ пособия: M_z = −M на участке I и +M на участке II.',
  },
  pulleys: {
    title: 'Трансмиссионный вал: ведущий шкив 50 кВт, три ведомых, 300 об/мин — подбор диаметра',
    shaft: sh({ steps: [{ l: 0.8, k: 1, c: 0 }, { l: 1, k: 1, c: 0 }, { l: 0.8, k: 1, c: 0 }], load: 'power', powers: [-10, 50, -25, -15], rpm: 300, supports: 'none' }),
    note: 'M = 30P/(πn); ведущий шкив — «+», ведомые — «−». Диаметр — по наибольшему из условий прочности и жёсткости.',
  },
  bothfixed: {
    title: 'Вал с двумя заделками: момент 6 кН·м в пролёте (статически неопределимый)',
    shaft: sh({ steps: [{ l: 0.6, k: 1, c: 0 }, { l: 1.4, k: 1, c: 0 }], moments: [0, 6, 0], supports: 'both' }),
    note: 'Точное решение для вала постоянного сечения: M_z = M·b/l слева и −M·a/l справа.',
  },
  stepped: {
    title: 'Ступенчатый вал с полым участком, заделка слева, диаметр задан',
    shaft: sh({ steps: [{ l: 0.5, k: 1.4, c: 0 }, { l: 0.7, k: 1.4, c: 0.6 }, { l: 0.6, k: 1, c: 0 }], moments: [0, 4, -2.5, 1.2], supports: 'left', dMode: 'given', d: 60 }),
    note: 'Наружные диаметры 1,4d, 1,4d (полый, d₀ = 0,6D) и d при d = 60 мм.',
  },
} satisfies Record<string, { title: string; shaft: Shaft; note: string }>;

export type TorsionPresetKey = keyof typeof TORSION_PRESETS;
