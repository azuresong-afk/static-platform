/** Готовые задачи: Мещерский §2, §6 (узел) и §7 (приведение). Ответы — в правиле знаков приложения. */
import type { NodeForce, NodeProblem, ReduceProblem } from './model/forces';

export type ConvProblem = { mode: 'node'; node: NodeProblem } | { mode: 'reduce'; reduce: ReduceProblem };

export interface ConvPreset {
  title: string;
  problem: ConvProblem;
  /** Узел: модули неизвестных по имени. Приведение: R, M*, точка оси в плоскости Oxy. */
  book?: Record<string, number>;
  note?: string;
}

const known = (name: string, F: number, ang: number): NodeForce => ({ name, kind: 'known', F, dirMode: 'ang', v: [0, 0, 0], ang });
const unk = (name: string, kind: NodeForce['kind'], v: [number, number, number]): NodeForce => ({ name, kind, F: 0, dirMode: 'vec', v, ang: 0 });
const unkA = (name: string, kind: NodeForce['kind'], ang: number): NodeForce => ({ name, kind, F: 0, dirMode: 'ang', v: [0, 0, 0], ang });
const s30 = 0.5,
  c30 = Math.sqrt(3) / 2;

export const CONV_PRESETS = {
  m27: {
    title: 'Мещерский 2.7: два стержня у стены, сила P = 1000 в шарнире C',
    problem: {
      mode: 'node',
      node: {
        forces: [known('P', 1000, 270), unk('S_A', 'rod', [-s30, c30, 0]), unk('S_B', 'rod', [-c30, -s30, 0])],
      },
    },
    book: { S_A: 866, S_B: -500 },
    note: 'Стержень CA — к стене вверх под 30° к ней, CB — вниз под 60°. «+» — растяжение: CA растянут (866 н), CB сжат (500 н).',
  },
  m210: {
    title: 'Мещерский 2.10: фонарь на поперечине и подкосе',
    problem: { mode: 'node', node: { forces: [known('G', 30, 270), unk('S_1', 'rod', [-1.2, 0, 0]), unk('S_2', 'rod', [-1.2, -0.9, 0])] } },
    book: { S_1: 40, S_2: -50 },
    note: 'Узел C: поперечина CA = 1,2 м горизонтальна, подкос CB = 1,5 м (B на 0,9 м ниже A).',
  },
  m212: {
    title: 'Мещерский 2.12: мачтовый кран, цепь и стрела',
    problem: {
      mode: 'node',
      node: {
        // Узел B: стрела BA (∠BAC = 15° с мачтой), цепь BC (∠ACB = 135°); AC = 1, AB = sin135°/sin30°.
        forces: [
          known('P', 200, 270),
          unk('T', 'rope', [-Math.SQRT2 * Math.sin(Math.PI / 12), 1 - Math.SQRT2 * Math.cos(Math.PI / 12), 0]),
          unk('Q', 'rod', [-Math.sin(Math.PI / 12), -Math.cos(Math.PI / 12), 0]),
        ],
      },
    },
    book: { T: 104, Q: -283 },
    note: 'Стрела сжата: Q = −283 кГ.',
  },
  m218: {
    title: 'Мещерский 2.18: шар между двумя перпендикулярными плоскостями',
    problem: { mode: 'node', node: { forces: [known('G', 6, 270), unkA('N_D', 'normal', 60), unkA('N_E', 'normal', 150)] } },
    book: { N_D: 5.2, N_E: 3 },
    note: 'Плоскость BC наклонена под 60° к горизонту, AB — под 30°; реакции — по нормалям к плоскостям.',
  },
  m222: {
    title: 'Мещерский 2.22: шар на двух тросах под углом 150°',
    problem: { mode: 'node', node: { forces: [known('G', 10, 270), unkA('T_B', 'rope', 45), unkA('T_C', 'rope', 195)] } },
    book: { T_B: 19.3, T_C: 14.1 },
  },
  m65: {
    title: 'Мещерский 6.5: стержень AB и цепи AC, AD (пространство)',
    problem: { mode: 'node', node: { forces: [{ ...known('Q', 42, 0), dirMode: 'vec', v: [0, 0, -1] }, unk('T_C', 'rope', [0, 80, 0]), unk('T_D', 'rope', [60, 0, 0]), unk('T_B', 'rod', [60, 80, -105])] } },
    book: { T_C: 32, T_D: 24, T_B: -58 },
    note: 'AC = 80 см, AD = 60 см в горизонтальной плоскости, B — под противоположной вершиной E прямоугольника, AB = 145 см.',
  },
  m615: {
    title: 'Мещерский 6.15: тренога, ноги под 30° к вертикали',
    problem: {
      mode: 'node',
      node: {
        forces: [
          { ...known('E', 10, 0), dirMode: 'vec', v: [0, 0, -1] },
          ...[0, 120, 240].map((a, i) => unk(`S_${i + 1}`, 'rod', [s30 * Math.cos((a * Math.PI) / 180), s30 * Math.sin((a * Math.PI) / 180), -c30])),
        ],
      },
    },
    book: { S_1: -3.85, S_2: -3.85, S_3: -3.85 },
    note: 'Ноги сжаты: −3,85 кГ.',
  },
  m76: {
    title: 'Мещерский 7.6: две скрещивающиеся силы — динама',
    problem: {
      mode: 'reduce',
      reduce: {
        forces: [
          { name: 'P_1', r: [0, 0, 0], F: [0, 0, 8] },
          { name: 'P_2', r: [1.3, 0, 0], F: [0, 12, 0] },
        ],
        pairs: [],
        O: [0, 0, 0],
      },
    },
    book: { R: 14.4, Mstar: 8.65, x: 0.9, y: 0 },
  },
  m712: {
    title: 'Мещерский 7.12: радиомачта — нагрузки и динама',
    problem: {
      mode: 'reduce',
      reduce: {
        forces: [
          { name: 'G', r: [0, 0, 0], F: [0, 0, -14] },
          { name: 'F', r: [0, 0, 15], F: [0, 2, 0] },
          { name: 'P', r: [0, 0, 6], F: [5, 0, 0] },
        ],
        pairs: [],
        O: [0, 0, 0],
      },
    },
    book: { R: 15, Mstar: 6, x: 2.2, y: 2 },
    note: 'В книге — реакция грунта, она противоположна нагрузкам; ось динамы та же, модуль момента тот же.',
  },
  plane: {
    title: 'Плоская система: равнодействующая и её линия действия',
    problem: {
      mode: 'reduce',
      reduce: {
        forces: [
          { name: 'F_1', r: [0, 0, 0], F: [3, 0, 0] },
          { name: 'F_2', r: [2, 0, 0], F: [0, 4, 0] },
          { name: 'F_3', r: [4, 3, 0], F: [-1, -1, 0] },
        ],
        pairs: [{ name: 'M', M: [0, 0, 5] }],
        O: [0, 0, 0],
      },
    },
  },
} satisfies Record<string, ConvPreset>;

export type ConvPresetKey = keyof typeof CONV_PRESETS;
