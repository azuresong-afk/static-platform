/**
 * Готовые задачи вкладки «Растяжение-сжатие».
 * Антонов и др., «Прикладная механика», задачи 1.1 и 1.2, схема 1: ступени 3A, 2A, A длиной L, 2L, L;
 * сила F2 — в начале ступени 2A, F1 — в начале ступени A (обе вправо). Данные группы 20 (2004/05):
 * F1 = 100 кН, F2 = 40Z кН при Z = 5; L = 0,1 м; E = 2·10⁵ МПа; [σ] = 150 МПа; σт = 240 МПа; α = 125·10⁻⁷ 1/К;
 * в задаче 1.2 утолщённый участок нагрет на ΔT = +10 К, площадь A — из решения задачи 1.1.
 */
import type { Bar } from './model/bar';

const antonovSteps = (dT: number): Bar['steps'] => [
  { l: 0.1, c: 3, dT },
  { l: 0.2, c: 2, dT: 0 },
  { l: 0.1, c: 1, dT: 0 },
];
const steel = { E: 2e5, alpha: 125e-7, sigmaAllow: 150, sigmaT: 240 };

export const AXIAL_PRESETS = {
  antonov11: {
    title: 'Антонов, задача 1.1, схема 1 (группа 20, Z = 5): найти A',
    bar: { steps: antonovSteps(0), forces: [0, 200, 100, 0], supports: 'left', areaMode: 'find', A: 1, ...steel } as Bar,
  },
  antonov12: {
    title: 'Антонов, задача 1.2, схема 1: две заделки, нагрев +10 К',
    bar: { steps: antonovSteps(10), forces: [0, 200, 100, 0], supports: 'both', areaMode: 'given', A: 6.67, ...steel } as Bar,
  },
  hanging: {
    title: 'Брус с заделкой справа: две ступени, сжатие и растяжение',
    bar: {
      steps: [
        { l: 0.4, c: 1, dT: 0 },
        { l: 0.6, c: 2, dT: 0 },
      ],
      forces: [-30, 80, 0],
      supports: 'right',
      areaMode: 'given',
      A: 4,
      ...steel,
    } as Bar,
  },
} satisfies Record<string, { title: string; bar: Bar }>;

export type AxialPresetKey = keyof typeof AXIAL_PRESETS;
