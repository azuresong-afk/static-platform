/** Готовые задачи: Мещерский §16 (скорости, МЦС) и §18 (ускорения). */
import type { MBody, MCons, MDrive, MechProblem, MPoint, PtDef } from './model/mech';

export interface MechPreset {
  title: string;
  problem: MechProblem;
  /**
   * Ответ: «v.B», «a.B» — модули скорости и ускорения точки B; «w.AB», «e.AB» — модули ω и ε звена AB;
   * «icrx.AB», «icry.AB» — координаты МЦС; «K.AB.B» — расстояние от мгновенного центра ускорений звена AB до точки B.
   */
  book?: Record<string, number>;
  note?: string;
}

const pt = (name: string, def: PtDef): MPoint => ({ name, def });
const xy = (name: string, x: string, y: string) => pt(name, { k: 'xy', x, y });
const polar = (name: string, from: string, L: string, ang: string) => pt(name, { k: 'polar', from, L, ang });
const onLine = (name: string, from: string, L: string, through: string, ang: string, side: 1 | -1 = 1) => pt(name, { k: 'line', from, L, through, ang, side });
const two = (name: string, p1: string, L1: string, p2: string, L2: string, side: 1 | -1 = 1) => pt(name, { k: 'two', p1, L1, p2, L2, side });
const seg = (name: string, p1: string, p2: string, t: string) => pt(name, { k: 'seg', p1, p2, t });
const body = (name: string, ...pts: string[]): MBody => ({ name, pts });
const fixed = (...ps: string[]): MCons[] => ps.map((p) => ({ k: 'fixed', p }));
const slider = (p: string, ang: string): MCons => ({ k: 'slider', p, ang });
const omega = (b: string, w: string, e = '0'): MDrive => ({ k: 'omega', b, w, e });
const proj = (p: string, ang: string, v: string, a = '0'): MDrive => ({ k: 'proj', p, ang, v, a });

/** Кривошипно-шатунный механизм: OA = r под углом φ, ползун B на оси x справа, M — середина AB. */
const crank = (r: string, l: string, phi: string, w: string, e = '0'): MechProblem => ({
  points: [xy('O', '0', '0'), polar('A', 'O', r, phi), onLine('B', 'A', l, 'O', '0'), seg('M', 'A', 'B', '1/2')],
  bodies: [body('OA', 'O', 'A'), body('AB', 'A', 'B', 'M')],
  cons: [...fixed('O'), slider('B', '0')],
  drives: [omega('OA', w, e)],
});
const PI = Math.PI;
const r13 = { r: 10, l: 40, h: 15, w: 2 };

export const MECH_PRESETS = {
  m1615: {
    title: 'Мещерский 16.15: кривошипно-шатунный механизм, кривошип в положении I (∠AOB = 0)',
    problem: crank('40', '200', '0', '6π'),
    book: { 'w.AB': 1.2 * PI, 'v.M': 377 },
    note: 'OA = 40 см, AB = 2 м, 180 об/мин: ω = −6π/5 с⁻¹ (шатун вращается против кривошипа), v_M = 377 см/с. В положении II (∠AOB = π/2) ω = 0, v_M = 754 см/с.',
  },
  m168: {
    title: 'Мещерский 16.8: стержень скользит концами по осям — мгновенный центр скоростей',
    problem: {
      points: [xy('A', '0', 'cos(π/3)'), xy('B', 'sin(π/3)', '0')],
      bodies: [body('AB', 'A', 'B')],
      cons: [slider('A', '90'), slider('B', '0')],
      drives: [proj('A', '-90', '1')],
    },
    book: { 'icrx.AB': 0.866, 'icry.AB': 0.5 },
    note: 'AB = 1 м, ∠OAB = 60°: МЦС x = 0,866 м, y = 0,5 м (скорость конца A — любая).',
  },
  m1611: {
    title: 'Мещерский 16.11: теорема о проекциях скоростей',
    problem: {
      points: [xy('A', '0', '0'), xy('B', '10', '0')],
      bodies: [body('AB', 'A', 'B')],
      cons: [slider('B', '0')],
      drives: [{ k: 'vec', p: 'A', v: '180', vang: '30', a: '0', aang: '0' }],
    },
    book: { 'v.B': 156 },
    note: 'v_A = 180 см/с под 30° к AB, скорость B направлена по AB: v_B = 180 cos 30° = 156 см/с.',
  },
  m1621: {
    title: 'Мещерский 16.21: шарнирный четырёхзвенник, AB и BC на одной прямой',
    problem: {
      points: [xy('A', '0', '0'), xy('B', '10', '0'), xy('C', '40', '0'), xy('D', '55', '-25')],
      bodies: [body('AB', 'A', 'B'), body('BC', 'B', 'C'), body('CD', 'C', 'D')],
      cons: fixed('A', 'D'),
      drives: [omega('AB', '6π')],
    },
    book: { 'w.BC': 2 * PI, 'w.CD': 0 },
    note: 'ω₀ = 6π с⁻¹, BC = 3AB: ω_BC = 2π с⁻¹, ω_CD = 0 (положение D — любое).',
  },
  m1624: {
    title: 'Мещерский 16.24: гидравлический пресс — скорость поршня',
    problem: {
      points: [xy('O', '0', '0'), polar('A', 'O', '15', '30'), polar('B', 'O', '15/cos(π/6)', '0'), polar('D', 'B', '10', '-90')],
      bodies: [body('OL', 'O', 'A'), body('AB', 'A', 'B'), body('BD', 'B', 'D')],
      cons: [...fixed('O'), slider('B', '90'), slider('D', '90')],
      drives: [omega('OL', '-2')],
    },
    book: { 'v.D': 34.6, 'w.AB': 2 },
    note: 'OA = 15 см, ω = 2 с⁻¹, AB ⊥ OL, рычаг под 30°: v_D = 34,6 см/с, ω_AB = 2 с⁻¹. Поршень D со штоком BD движется по вертикали.',
  },
  m1636: {
    title: 'Мещерский 16.36: механизм Уатта (планетарная передача)',
    problem: {
      points: [xy('B', '0', '0'), xy('A', '0', '150'), polar('O1', 'A', '75', '-30'), xy('O', '60sqrt(3)', '0')],
      bodies: [body('O1A', 'O1', 'A'), body('AB', 'A', 'B'), body('OB', 'O', 'B'), body('I', 'O')],
      cons: [...fixed('O1', 'O'), { k: 'gear', b1: 'AB', c1: 'B', r1: '30sqrt(3)', b2: 'I', c2: 'O', r2: '30sqrt(3)', int: false }],
      drives: [omega('O1A', '6')],
    },
    book: { 'w.OB': 3.75, 'w.I': 6 },
    note: 'α = 60°, β = 90°, r₁ = r₂ = 30√3 см, O₁A = 75 см, AB = 150 см, ω₀ = 6 с⁻¹: ω_OB = 3,75 с⁻¹, ω_I = 6 с⁻¹. Колесо II наглухо связано с шатуном AB.',
  },
  m1812: {
    title: 'Мещерский 18.12: шатун перпендикулярен кривошипу — ε шатуна и ускорение ползуна',
    problem: {
      points: [xy('O', '0', '0'), polar('A', 'O', '20', '45'), polar('B', 'A', '100', '135')],
      bodies: [body('OA', 'O', 'A'), body('AB', 'A', 'B')],
      cons: [...fixed('O'), slider('B', '90')],
      drives: [omega('OA', '10')],
    },
    book: { 'w.AB': 2, 'e.AB': 16, 'a.B': 565.6 },
    note: 'OA = 20 см, AB = 1 м, ω₀ = 10 с⁻¹ = const, α = β = 45°: ω = 2 с⁻¹, ε = 16 с⁻², w_B = 565,6 см/с².',
  },
  m189: {
    title: 'Мещерский 18.9: ускорение ползуна и мгновенный центр ускорений шатуна (φ = 90°)',
    problem: crank('40', '200', '90', '15'),
    book: { 'a.B': 1837, 'K.AB.B': 40, 'K.AB.A': 196 },
    note: 'OA = 40 см, AB = 2 м, ω₀ = 15 с⁻¹: при φ = 90° w_B = 18,37 м/с², BK = 40 см, AK = 196 см; при φ = 0 w_B = 108 м/с², BK = 12 м; при φ = 180° w_B = 72 м/с², BK = 8 м.',
  },
  m1813: {
    title: 'Мещерский 18.13: нецентральный кривошипно-шатунный механизм, кривошип горизонтален',
    problem: {
      points: [xy('O', '0', '0'), xy('C', '0', '-15'), xy('A', '10', '0'), onLine('B', 'A', '40', 'C', '0')],
      bodies: [body('OA', 'O', 'A'), body('AB', 'A', 'B')],
      cons: [...fixed('O'), slider('B', '0')],
      drives: [omega('OA', '2')],
    },
    book: {
      'w.AB': (r13.r * r13.w) / Math.sqrt(r13.l ** 2 - r13.h ** 2),
      'e.AB': (r13.h * r13.r ** 2 * r13.w ** 2) / (r13.l ** 2 - r13.h ** 2) ** 1.5,
      'v.B': (r13.h * r13.r * r13.w) / Math.sqrt(r13.l ** 2 - r13.h ** 2),
      'a.B': r13.r * r13.w ** 2 * (1 + (r13.r * r13.l ** 2) / (r13.l ** 2 - r13.h ** 2) ** 1.5),
    },
    note: 'Ответ книги в общем виде; здесь r = 10, l = 40, h = 15, ω₀ = 2: ω = rω₀/√(l² − h²), ε = hr²ω₀²/(l² − h²)^{3/2}, v_B = hrω₀/√(l² − h²), w_B = rω₀²[1 + rl²/(l² − h²)^{3/2}].',
  },
  m1814: {
    title: 'Мещерский 18.14: четырёхзвенник OABO₁, AB = 2OA — шатун движется поступательно',
    problem: {
      points: [xy('O', '0', '0'), xy('A', '0', '10'), polar('B', 'A', '20', '30'), xy('O1', '10sqrt(3)', '0')],
      bodies: [body('OA', 'O', 'A'), body('AB', 'A', 'B'), body('O1B', 'O1', 'B')],
      cons: fixed('O', 'O1'),
      drives: [omega('OA', '3')],
    },
    book: { 'w.AB': 0, 'e.AB': (Math.sqrt(3) / 6) * 9, 'a.B': (Math.sqrt(3) / 3) * 10 * 9 },
    note: 'a = 10 см, ω₀ = 3 с⁻¹: ω = 0, ε = (√3/6)ω₀², w_B = (√3/3)aω₀².',
  },
  m1817: {
    title: 'Мещерский 18.17: ползун на дуговой направляющей',
    problem: {
      points: [xy('O', '0', '0'), xy('A', '10', '0'), xy('B', '30', '0'), xy('O1', '30', '-25')],
      bodies: [body('OA', 'O', 'A'), body('AB', 'A', 'B'), body('O1B', 'O1', 'B')],
      cons: fixed('O', 'O1'),
      drives: [omega('OA', '1')],
    },
    book: { 'a.B': 15 },
    note: 'OA = 10 см, AB = 20 см, ω = 1 с⁻¹, ε = 0: w_Bτ = 15 см/с², w_Bn = 0. Дуга направляющей задана радиусом-«стержнем» O₁B (её радиус на ответ не влияет).',
  },
  m1819: {
    title: 'Мещерский 18.19: антипараллелограмм',
    problem: {
      points: [xy('A', '0', '0'), xy('D', '20', '0'), xy('C', '20', '40'), two('B', 'A', '40', 'C', '20', -1)],
      bodies: [body('AB', 'A', 'B'), body('BC', 'B', 'C'), body('CD', 'C', 'D')],
      cons: fixed('A', 'D'),
      drives: [omega('AB', '1')],
    },
    book: { 'w.BC': 8 / 3, 'e.BC': 20 / 9 },
    note: 'AB = CD = 40 см, BC = AD = 20 см, ∠ADC = 90°, ω₀ = 1 с⁻¹: ω_BC = (8/3)ω₀, ε_BC = (20/9)ω₀² (вращение замедленное).',
  },
  m1822: {
    title: 'Мещерский 18.22: колесо вагона трамвая тормозит',
    problem: {
      points: [xy('O', '0', '0.5'), polar('M1', 'O', '0.25', '-45'), polar('M2', 'O', '0.25', '45'), polar('M3', 'O', '0.25', '135'), polar('M4', 'O', '0.25', '-135')],
      bodies: [body('колесо', 'O', 'M1', 'M2', 'M3', 'M4')],
      cons: [{ k: 'roll', b: 'колесо', c: 'O', r: '0.5', ang: '0' }],
      drives: [proj('O', '0', '1', '-2')],
    },
    book: { 'a.M1': 2.449, 'a.M2': 3.414, 'a.M3': 2.449, 'a.M4': 0.586 },
    note: 'R = 0,5 м, r = 0,25 м, v₀ = 1 м/с, замедление 2 м/с²: w₁ = 2,449, w₂ = 3,414, w₃ = 2,449, w₄ = 0,586 м/с².',
  },
  m1823: {
    title: 'Мещерский 18.23: колесо катится по наклонному пути',
    problem: {
      points: [xy('O', '0', '0'), polar('M1', 'O', '0.5', '240'), polar('M2', 'O', '0.5', '-30'), polar('M3', 'O', '0.5', '60'), polar('M4', 'O', '0.5', '150')],
      bodies: [body('колесо', 'O', 'M1', 'M2', 'M3', 'M4')],
      cons: [{ k: 'roll', b: 'колесо', c: 'O', r: '0.5', ang: '-30' }],
      drives: [proj('O', '-30', '1', '3')],
    },
    book: { 'a.M1': 2, 'a.M2': 3.16, 'a.M3': 6.32, 'a.M4': 5.83 },
    note: 'R = 0,5 м, v₀ = 1 м/с, w₀ = 3 м/с²: w₁ = 2, w₂ = 3,16, w₃ = 6,32, w₄ = 5,83 м/с².',
  },
} satisfies Record<string, MechPreset>;

export type MechPresetKey = keyof typeof MECH_PRESETS;
