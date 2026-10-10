/** Готовые задачи: Мещерский §16, 18 (скорости, ускорения), §22–23 (кулисы), §38 (кинетическая энергия), §46 (равновесие). */
import type { MBody, MCons, MDrive, MechProblem, MLoad, MMass, MPoint, PtDef } from './model/mech';

export interface MechPreset {
  title: string;
  problem: MechProblem;
  /**
   * Ответ: «v.B», «a.B» — модули скорости и ускорения точки B; «w.AB», «e.AB» — модули ω и ε звена AB;
   * «icrx.AB», «icry.AB» — координаты МЦС; «K.AB.B» — расстояние от мгновенного центра ускорений звена AB до точки B;
   * «rho.B» — радиус кривизны траектории точки B; «vr.A», «ar.A» — модули относительных скорости и ускорения кулисного
   * камня A; «X» — неизвестная сила или пара из условия равновесия; «T» — кинетическая энергия; «W» — скорость ведущего
   * по теореме об изменении кинетической энергии.
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
const toward = (name: string, from: string, L: string, to: string, ang = '0') => pt(name, { k: 'polar', from, L, ang, to });
/** Пересечение прямой через p1 (и q1 или под углом a1) с прямой через p2 (и q2 или под углом a2). */
const cross = (name: string, p1: string, q1: string, a1: string, p2: string, q2: string, a2: string) => pt(name, { k: 'cross', p1, q1, a1, p2, q2, a2 });
const guide = (p: string, b: string, g1: string, g2: string): MCons => ({ k: 'guide', p, b, g1, g2 });
const trans = (b: string): MCons => ({ k: 'trans', b });
const force = (p: string, F: string, ang: string, o: { ref?: [string, string]; unknown?: boolean } = {}): MLoad => ({ k: 'force', p, F, ang, ref: o.ref?.[0] ?? '', ref2: o.ref?.[1] ?? '', unknown: !!o.unknown });
const couple = (b: string, M: string, unknown = false): MLoad => ({ k: 'couple', b, M, unknown });
const pmass = (p: string, m: string): MMass => ({ k: 'point', p, m });
const rod = (p1: string, p2: string, m: string): MMass => ({ k: 'rod', p1, p2, m });
const disk = (b: string, c: string, m: string, r: string): MMass => ({ k: 'body', b, c, m, shape: 'disk', r, J: '0' });
const param = (val: string, from = '0', to = '360') => ({ val, from, to });
/** Эллипсограф: OC = AC = CB = l, кривошип под углом φ к оси x; ползун A — на оси yA (90°) или x (0°), B — на другой. */
const ellipso = (l: string, aOnY: boolean): Pick<MechProblem, 'points' | 'bodies' | 'cons'> => ({
  points: [xy('O', '0', '0'), polar('C', 'O', l, 'φ'), onLine('A', 'C', l, 'O', aOnY ? '90' : '0'), onLine('B', 'C', l, 'O', aOnY ? '0' : '90')],
  bodies: [body('OC', 'O', 'C'), body('AB', 'A', 'C', 'B')],
  cons: [...fixed('O'), slider('A', aOnY ? '90' : '0'), slider('B', aOnY ? '0' : '90')],
});

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
  m2322: {
    title: 'Мещерский 23.22–23.23: вращающаяся кулиса — угловое ускорение кулисы и относительное ускорение камня',
    problem: {
      points: [xy('O1', '0', '0'), xy('O', '0', '30'), polar('A', 'O', '40', '90-φ'), toward('B', 'O1', '90', 'A')],
      bodies: [body('OA', 'O', 'A'), body('O1B', 'O1', 'B')],
      cons: [...fixed('O', 'O1'), guide('A', 'O1B', 'O1', 'B')],
      drives: [omega('OA', '-3')],
      param: param('90'),
      plot: 'e:O1B',
    },
    book: { 'e.O1B': 1.21, 'ar.A': 103.7 },
    note: 'l = OA = 40 см, a = OO₁ = 30 см, ω = 3 с⁻¹ = const; φ — угол кривошипа от вертикали (по часовой стрелке). При φ = 90°: ε = 1,21 с⁻², w_r = 103,7 см/с²; при φ = 0: ε = 0, w_r = 154,3 см/с²; при φ = 180°: w_r = −1080 см/с²; при φ = 270°: ε = 1,21 с⁻² (вращение замедленное). Остальные положения — меняя φ.',
  },
  m2221: {
    title: 'Мещерский 22.21: качающаяся кулиса строгального станка с зубчатой передачей',
    problem: {
      points: [xy('O1', '0', '0'), xy('D', '450', '0'), polar('A', 'O1', '300', 'φ'), xy('B', '0', '-700'), toward('K', 'B', '1200', 'A')],
      bodies: [body('E', 'O1', 'A'), body('Dк', 'D'), body('кулиса', 'B', 'K')],
      cons: [...fixed('O1', 'D', 'B'), { k: 'gear', b1: 'Dк', c1: 'D', r1: '100', b2: 'E', c2: 'O1', r2: '350', int: false }, guide('A', 'кулиса', 'B', 'K')],
      drives: [omega('Dк', '7')],
      param: param('90'),
      plot: 'w:кулиса',
    },
    book: { 'w.кулиса': 0.6 },
    note: 'R = 100 мм, R₁ = 350 мм, O₁A = 300 мм, O₁B = 700 мм, ω зубчатки D = 7 с⁻¹: в верхнем положении (φ = 90°) ω = 0,6 с⁻¹, в нижнем (φ = 270°) — 1,5 с⁻¹, когда O₁A ⊥ кулисе (sin φ = −3/7) — 0. Палец A на зубчатке E скользит в прорези кулисы.',
  },
  m1627: {
    title: 'Мещерский 16.27: машина с качающимся цилиндром — скорость поршня',
    problem: {
      points: [xy('O', '0', '0'), xy('O1', '60', '0'), polar('A', 'O', '12', 'φ'), toward('B', 'A', '60', 'O1')],
      bodies: [body('OA', 'O', 'A'), body('AB', 'A', 'B')],
      cons: [...fixed('O'), guide('O1', 'AB', 'A', 'B')],
      drives: [omega('OA', '5')],
      param: param('0'),
      plot: 'v:B',
    },
    book: { 'v.B': 15 },
    note: 'OA = 12 см, OO₁ = 60 см, AB = 60 см, ω = 5 с⁻¹: v_I = 15 см/с (φ = 0), v_III = 10 см/с (φ = 180°), v_II = v_IV = 58,84 см/с (φ = 90°, 270°; в книге 58,88 — по-видимому, округление: v = 60·60/√(60² + 12²)). Шток AB скользит в цилиндре, качающемся на цапфах O₁ (неподвижная точка O₁ — камень, по которому скользит звено AB).',
  },
  m1628: {
    title: 'Мещерский 16.28: качающийся цилиндр — кривошип перпендикулярен шатуну',
    problem: {
      points: [xy('O', '0', '0'), xy('O1', '60', '0'), polar('A', 'O', '15', 'arccos(15/60)·180/π'), toward('B', 'A', '60', 'O1')],
      bodies: [body('OA', 'O', 'A'), body('AB', 'A', 'B')],
      cons: [...fixed('O'), guide('O1', 'AB', 'A', 'B')],
      drives: [omega('OA', '15')],
    },
    book: { 'w.AB': 0, 'v.B': 225 },
    note: 'OA = 15 см, ω₀ = 15 с⁻¹ (OO₁ = 60 см, AB = 60 см — по чертежу к 16.27): ω цилиндра = 0, v = 225 см/с.',
  },
  m1820: {
    title: 'Мещерский 18.20: качающийся цилиндр — ускорение поршня и радиус кривизны траектории',
    problem: {
      points: [xy('O', '0', '0'), xy('O1', '60', '0'), polar('A', 'O', '12', 'φ'), toward('B', 'A', '60', 'O1')],
      bodies: [body('OA', 'O', 'A'), body('AB', 'A', 'B')],
      cons: [...fixed('O'), guide('O1', 'AB', 'A', 'B')],
      drives: [omega('OA', '5')],
      param: param('180'),
      plot: 'a:B',
    },
    book: { 'a.B': 258.3, 'rho.B': 0.39 },
    note: 'OA = 12 см, AB = 60 см, OO₁ = 60 см, ω₀ = 5 с⁻¹: в положении III (φ = 180°) w = 258,3 см/с², ρ = 0,39 см. В положении 1 (кривошип ⊥ шатуну, φ = arccos(1/5) = 78,46°) точный расчёт даёт w = 6,19 см/с², ρ = 582 см, в книге 6,12 и 589: результат очень чувствителен к округлению AO₁ = √(60² − 12²) = 58,79 см (с 58,8 получается 6,12).',
  },
  m2325: {
    title: 'Мещерский 23.24–23.25: строгальный станок с качающейся кулисой — ускорение резца',
    problem: {
      points: [xy('O1', '0', '0'), xy('O', '0', '30'), xy('G', '0', '70'), polar('A', 'O', '10', '90-φ'), toward('B', 'O1', '60', 'A'), cross('M', 'B', '', '90', 'G', '', '0'), polar('M2', 'M', '15', '90')],
      bodies: [body('OA', 'O', 'A'), body('O1B', 'O1', 'B'), body('суппорт', 'M', 'M2')],
      cons: [...fixed('O', 'O1'), guide('A', 'O1B', 'O1', 'B'), slider('M', '0'), trans('суппорт'), guide('B', 'суппорт', 'M', 'M2')],
      drives: [omega('OA', '-4')],
      param: param('90'),
      plot: 'ax:M',
    },
    book: { 'a.M': 221 },
    note: 'r = 10 см, a = 30 см, l = O₁B = 60 см, ω = 4 с⁻¹ = const; φ — от вертикали. При φ = 0 и 180° w_x = 0; при φ = 90° и 270° w_x = ∓221 см/с² (точно 221,6). Ползун B на конце кулисы скользит в вертикальной направляющей суппорта M, суппорт движется горизонтально.',
  },
  m468: {
    title: 'Мещерский 46.8: эллипсограф — вращающий момент, уравновешивающий силу на ползуне (числа — пример)',
    problem: {
      ...ellipso('0.5', true),
      drives: [omega('OC', '1')],
      acc: false,
      loads: [force('A', '100', '-90'), couple('OC', '0', true)],
      param: param('30', '0', '90'),
      plot: 'X',
    },
    book: { X: 2 * 100 * 0.5 * Math.cos(Math.PI / 6) },
    note: 'Ответ книги M = 2Pl cos φ; здесь l = 0,5 м, P = 100 Н, φ = 30°: M = 86,6 Н·м. Угол φ — между кривошипом и осью x (направляющей ползуна B), как на чертеже и в ответе; в тексте задачи — «с направляющей ползуна» (A), с ним получилось бы 2Pl sin φ.',
  },
  m4610: {
    title: 'Мещерский 46.10: кулисный механизм — сила, уравновешивающая силу на стержне (числа — пример)',
    problem: {
      points: [xy('O', '0', '0'), polar('C', 'O', '0.5', 'φ'), xy('K', '0.3', '0'), cross('A', 'O', 'C', '0', 'K', '', '90'), polar('B', 'A', '0.3', '-90')],
      bodies: [body('OC', 'O', 'C'), body('AB', 'A', 'B')],
      cons: [...fixed('O'), slider('A', '90'), trans('AB'), guide('A', 'OC', 'O', 'C')],
      drives: [omega('OC', '1')],
      acc: false,
      loads: [force('B', '100', '90'), force('C', '0', '-90', { ref: ['O', 'C'], unknown: true })],
      param: param('30', '0', '75'),
      plot: 'X',
    },
    book: { X: (100 * 0.3) / (0.5 * Math.cos(Math.PI / 6) ** 2) },
    note: 'Ответ книги Q = Pl/(R cos²φ); здесь R = OC = 0,5 м, l = OK = 0,3 м, P = 100 Н, φ = 30°: Q = 80 Н. Q перпендикулярна рычагу OC (угол −90° от направления O→C), P направлена вдоль стержня AB вверх.',
  },
  m4613: {
    title: 'Мещерский 46.13: антипараллелограмм — сила в шарнире B',
    problem: {
      points: [xy('A', '-1', '0'), xy('D', '0', '0'), xy('C', '0', 'sqrt(3)'), two('B', 'A', 'sqrt(3)', 'C', '1', -1)],
      bodies: [body('AB', 'A', 'B'), body('BC', 'B', 'C'), body('CD', 'C', 'D')],
      cons: fixed('A', 'D'),
      drives: [omega('AB', '1')],
      acc: false,
      loads: [force('C', '1', '180'), force('B', '0', '0', { ref: ['C', 'B'], unknown: true })],
    },
    book: { X: 2 },
    note: 'AD = BC, AB = CD, ∠ABC = ∠ADC = 90°, ∠DCB = 30° (отсюда AB = √3·AD; размер AD = 1 на ответ не влияет), F_C = 1: F_B = 2F_C.',
  },
  m4614: {
    title: 'Мещерский 46.14: кривошипно-шатунный механизм со стержнями CD и DE',
    problem: {
      points: [xy('O', '0', '0'), xy('A', '1', '0'), xy('C', '2', '0'), xy('B', '3', '0'), polar('D', 'C', '0.6', '210'), cross('E', 'D', '', '-60', 'B', '', '90')],
      bodies: [body('OA', 'O', 'A'), body('AB', 'A', 'C', 'B'), body('CD', 'C', 'D'), body('DE', 'D', 'E')],
      cons: [...fixed('O', 'E'), slider('B', '0')],
      drives: [omega('OA', '1')],
      acc: false,
      loads: [force('A', '1', '90'), force('D', '0', '0', { ref: ['C', 'D'], unknown: true })],
    },
    book: { X: 4 },
    note: '∠DCB = 150°, ∠CDE = 90°, C — середина шатуна AB; кривошип и шатун на одной прямой с направляющей ползуна B, E — под B (по чертежу). F_A = 1: F_D = 4F_A. Длины на ответ не влияют.',
  },
  m381: {
    title: 'Мещерский 38.1: кинетическая энергия шарнирного параллелограмма (числа — пример)',
    problem: {
      points: [xy('A', '0', '0'), xy('D', '1', '0'), polar('B', 'A', '0.5', '-60'), polar('C', 'D', '0.5', '-60')],
      bodies: [body('AB', 'A', 'B'), body('BC', 'B', 'C'), body('CD', 'C', 'D')],
      cons: fixed('A', 'D'),
      drives: [omega('AB', '4')],
      acc: false,
      masses: [rod('A', 'B', '2'), rod('C', 'D', '2'), rod('B', 'C', '3')],
    },
    book: { T: (0.25 * 16 * (2 * 2 + 3 * 3)) / 6 },
    note: 'Ответ книги T = (l²ω²/6g)(2P₁ + 3P₂); здесь l = 0,5 м, ω = 4 с⁻¹, массы m₁ = 2 кг (AB и CD), m₂ = 3 кг (BC): T = 8,67 Дж. Звено BC движется поступательно.',
  },
  m383: {
    title: 'Мещерский 38.3: кинетическая энергия кулисного механизма — наибольшая и наименьшая (числа — пример)',
    problem: {
      points: [xy('O', '0', '0'), polar('A', 'O', '0.2', 'φ'), xy('G', '0', '-0.35'), cross('K', 'A', '', '90', 'G', '', '0'), polar('K2', 'K', '0.7', '90')],
      bodies: [body('OA', 'O', 'A'), body('кулиса', 'K', 'K2')],
      cons: [...fixed('O'), slider('K', '0'), trans('кулиса'), guide('A', 'кулиса', 'K', 'K2')],
      drives: [omega('OA', '10')],
      acc: false,
      masses: [{ k: 'body', b: 'OA', c: 'O', m: '0', shape: 'J', r: '0', J: '0.1' }, pmass('K', '5')],
      param: param('30'),
      plot: 'T',
    },
    book: { T: 7.5 },
    note: 'Ответ книги T = ½(J₀ + ma² sin²φ)ω²; здесь J₀ = 0,1 кг·м², a = 0,2 м, m = 5 кг, ω = 10 с⁻¹, φ = 30°: T = 7,5 Дж. Наименьшая энергия (5 Дж) — в крайних положениях кулисы (φ = 0, 180°), наибольшая (15 Дж) — в среднем (φ = 90°, 270°).',
  },
  m386: {
    title: 'Мещерский 38.5–38.6: кинетическая энергия кривошипно-шатунного механизма (числа — пример)',
    problem: {
      ...crank('0.2', '0.8', 'φ', '10'),
      acc: false,
      masses: [rod('O', 'A', '3'), pmass('B', '5'), rod('A', 'B', '4')],
      param: param('90'),
      plot: 'T',
    },
    book: { T: 20 },
    note: 'Ответ 38.6 (кривошип ⊥ направляющей): T = ½(m₁/3 + m₂ + m₃)r²ω²; здесь r = 0,2 м, l = 0,8 м, ω = 10 с⁻¹, m₁ = 3, m₂ = 5, m₃ = 4 кг: T = 20 Дж. График показывает T(φ) за оборот.',
  },
  m387: {
    title: 'Мещерский 38.7: кинетическая энергия планетарного механизма из трёх колёс (числа — пример)',
    problem: {
      points: [xy('O', '0', '0'), xy('O2', '0.2', '0'), xy('O3', '0.4', '0')],
      bodies: [body('OA', 'O', 'O2', 'O3'), body('II', 'O2'), body('III', 'O3')],
      cons: [...fixed('O'), { k: 'gear', b1: 'II', c1: 'O2', r1: '0.1', b2: '', c2: 'O', r2: '0.1', int: false }, { k: 'gear', b1: 'III', c1: 'O3', r1: '0.1', b2: 'II', c2: 'O2', r2: '0.1', int: false }],
      drives: [omega('OA', '10')],
      acc: false,
      masses: [rod('O', 'O3', '3'), disk('II', 'O2', '2', '0.1'), disk('III', 'O3', '2', '0.1')],
    },
    book: { T: ((0.01 * 100) / 3) * (33 * 2 + 8 * 3) },
    note: 'Ответ книги T = (r²ω²/3g)(33P + 8Q); здесь r = 0,1 м, ω = 10 с⁻¹, массы колёс 2 кг, кривошипа 3 кг: T = 30 Дж. Колесо III движется поступательно — работа пары, приложенной к нему, равна нулю.',
  },
  m3849: {
    title: 'Мещерский 38.49: эллипсограф разгоняется постоянным моментом — угловая скорость через четверть оборота (числа — пример)',
    problem: {
      ...ellipso('0.5', false),
      drives: [omega('OC', '1')],
      acc: false,
      loads: [couple('OC', '10')],
      masses: [rod('A', 'B', '4'), pmass('A', '2'), pmass('B', '2')],
      param: param('90', '0', '90'),
      energy: { phi0: '0', w0: '0' },
      plot: 'W',
    },
    book: { W: Math.sqrt(3 * Math.PI) },
    note: 'Ответ в общем виде: ω = (1/2l)√(3πm₀/(M + 3m)); здесь l = 0,5 м, M = 4 кг, m = 2 кг, m₀ = 10 Н·м: ω = √(3π) = 3,07 с⁻¹. J_пр = (4/3)l²(M + 3m) от положения не зависит.',
  },
  m3850: {
    title: 'Мещерский 38.50: то же с моментом сопротивления в шарнире C (числа — пример)',
    problem: {
      ...ellipso('0.5', false),
      drives: [omega('OC', '1')],
      acc: false,
      loads: [couple('OC', '10'), { k: 'hinge', b1: 'OC', b2: 'AB', M: '1' }],
      masses: [rod('A', 'B', '4'), pmass('A', '2'), pmass('B', '2')],
      param: param('90', '0', '90'),
      energy: { phi0: '0', w0: '0' },
      plot: 'W',
    },
    book: { W: Math.sqrt(2.4 * Math.PI) },
    note: 'В шарнире C кривошип и линейка вращаются в разные стороны с одинаковой скоростью — относительная угловая скорость 2ω, работа момента сопротивления за четверть оборота −πm_c. ω = (1/2l)√(3π(m₀ − 2m_c)/(M + 3m)); при m_c = 1 Н·м: ω = 2,75 с⁻¹.',
  },
} satisfies Record<string, MechPreset>;

export type MechPresetKey = keyof typeof MECH_PRESETS;
