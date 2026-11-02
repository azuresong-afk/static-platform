/** Пункт 32: готовые задачи второго экрана «Сходящихся сил» (система тел на шарнирах) — Мещерский §2–4. */
import { extraProblem, findAsk } from '../../shared/extra';
import type { ConvExtraPreset } from './extraPresets';
import { CONV_ASKS } from './model/extra';

const hinge = (pts: string, bodies: string, sups: string, loads: string) => extraProblem(findAsk(CONV_ASKS, 'hinge'), {}, { pts, bodies, sups, loads });

export const CONV_EXTRA_PRESETS32 = {
  x241: {
    title: 'Мещерский 2.41: брус и криволинейный стержень на шарнирах — реакции опор',
    problem: hinge('A 0 0; M 0,5 0,5; B 1 1; C 2 0', 'A-M-B B-C', 'A; C', 'M P 10 270'),
    book: { R_A: (Math.sqrt(10) / 4) * 10, R_C: (Math.SQRT2 / 4) * 10 },
    relTol: 1e-9,
    note: 'Общий вид: R_A = √10·P/4, R_C = √2·P/4. Взят P = 10; AB и BC — под 45° к AC. Невесомый криволинейный стержень BC работает как прямой стержень BC (его ось на ответ не влияет).',
  },
  x243: {
    title: 'Мещерский 2.43: система из четырёх арок — реакции опор',
    problem: hinge(
      'A 0 0; K 0 1; E 1 1; L 2 1; B 2 0; F 3 1; M 4 1; C 4 0; G 5 1; N 6 1; D 6 0',
      'A-K-E E-L-F-B F-M-G-C G-N-D',
      'A; B 90; C 90; D',
      'K P 10 0',
    ),
    book: { R_A: 5 * Math.SQRT2, N_B: 10, N_C: -10, R_D: 5 * Math.SQRT2 },
    relTol: 1e-9,
    note: 'Общий вид: R_A = R_D = P√2/2, R_B = R_C = P. Взяты P = 10, a = 1. Ригель разрезан шарнирами E, F, G; стойки B и C опираются на шарнирные стержни — реакции только вертикальные (N_C = −10: вниз).',
  },
} satisfies Record<string, ConvExtraPreset>;
