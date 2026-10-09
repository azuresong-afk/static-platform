/**
 * Упругий элемент колебательной системы: жёсткость c (сила на единицу перемещения груза вдоль оси движения).
 *
 * Элементы: пружина (жёсткость c), стержень при растяжении-сжатии (c = EA/l) и балка с грузом в характерной точке
 * (c = 1/δ₁₁, δ₁₁ — прогиб под единичной силой; Антонов, п. 10.2; Мещерский §53). Элементы собираются в ступени:
 * внутри ступени элементы работают параллельно (одинаковое перемещение, жёсткости складываются), ступени
 * соединены последовательно (одинаковая сила, складываются податливости 1/c).
 *
 * Пружина под углом α к оси движения (точка движется в гладких направляющих, пружина не напряжена в равновесии,
 * колебания малые) даёт c·cos²α (Мещерский 32.31–32.33). Пружина на невесомом рычаге: пружина на плече a,
 * груз (или следующая ступень) на плече b — приведённая жёсткость c·(a/b)² (Мещерский 32.34, 32.45–32.46).
 *
 * Масса упругого элемента учитывается приближённо (способ Рэлея): к массе груза добавляется β·m_эл, где β = 1/3
 * для пружины и стержня, 17/35 для балки на двух опорах с грузом посередине, 33/140 для консоли с грузом на конце,
 * 13/35 для балки с заделанными концами (Антонов, п. 10.7; Мещерский 53.27, 53.30).
 */

export type BeamScheme = 'ss-mid' | 'ss-a' | 'cant' | 'ff-mid' | 'fp-mid' | 'overhang';
export type ElemKind = 'spring' | 'rod' | 'beam';

export const BEAM_SCHEMES: { id: BeamScheme; label: string; formula: string }[] = [
  { id: 'ss-mid', label: 'на двух опорах, груз посередине', formula: 'δ₁₁ = l³/(48EJ)' },
  { id: 'ss-a', label: 'на двух опорах, груз на расстоянии a от опоры', formula: 'δ₁₁ = a²b²/(3EJl), b = l − a' },
  { id: 'cant', label: 'консоль, груз на конце', formula: 'δ₁₁ = l³/(3EJ)' },
  { id: 'ff-mid', label: 'оба конца заделаны, груз посередине', formula: 'δ₁₁ = l³/(192EJ)' },
  { id: 'fp-mid', label: 'заделка и шарнир, груз посередине', formula: 'δ₁₁ = 7l³/(768EJ)' },
  { id: 'overhang', label: 'пролёт l и консоль a, груз на конце консоли', formula: 'δ₁₁ = a²(l + a)/(3EJ)' },
];

export interface Elem {
  kind: ElemKind;
  /** Пружина: жёсткость. */
  c: number;
  /** Пружина: угол оси пружины с осью движения, градусы (0 — вдоль оси). */
  ang: number;
  /** Пружина на рычаге: плечо пружины a и плечо груза b (b = 0 — рычага нет). */
  la: number;
  lb: number;
  /** Стержень и балка: модуль упругости, длина (пролёт). */
  E: number;
  l: number;
  /** Стержень: площадь сечения. */
  A: number;
  /** Балка: момент инерции сечения, схема, расстояние a (для ss-a и overhang). */
  J: number;
  scheme: BeamScheme;
  a: number;
}

export interface Stage {
  items: Elem[];
}

export const newElem = (kind: ElemKind): Elem => ({ kind, c: 1, ang: 0, la: 0, lb: 0, E: 2e5, l: 1, A: 1, J: 1, scheme: 'ss-mid', a: 0.5 });

/** Коэффициент приведения массы элемента (null — для схемы не задан). */
export function massCoef(e: Elem): number | null {
  if (e.kind !== 'beam') return 1 / 3;
  switch (e.scheme) {
    case 'ss-mid':
      return 17 / 35;
    case 'cant':
      return 33 / 140;
    case 'ff-mid':
      return 13 / 35;
    default:
      return null;
  }
}
export const MASS_COEF_TEXT: Record<string, string> = { spring: '1/3', rod: '1/3', 'ss-mid': '17/35', cant: '33/140', 'ff-mid': '13/35' };

/** Податливость δ₁₁ балки (прогиб в точке груза от единичной силы) и изгибающий момент от единичной силы. */
export function beamUnit(e: Elem): { d: number; M: number } {
  const { E, J, l, a } = e;
  const EJ = E * J;
  switch (e.scheme) {
    case 'ss-mid':
      return { d: l ** 3 / (48 * EJ), M: l / 4 };
    case 'ss-a': {
      const b = l - a;
      return { d: (a * a * b * b) / (3 * EJ * l), M: (a * b) / l };
    }
    case 'cant':
      return { d: l ** 3 / (3 * EJ), M: l };
    case 'ff-mid':
      return { d: l ** 3 / (192 * EJ), M: l / 8 };
    case 'fp-mid':
      return { d: (7 * l ** 3) / (768 * EJ), M: (3 * l) / 16 };
    case 'overhang':
      return { d: (a * a * (l + a)) / (3 * EJ), M: a };
  }
}

export interface ElemStiff {
  /** Жёсткость самого элемента (без угла и рычага). */
  c0: number;
  /** Множитель приведения: cos²α или (a/b)². */
  factor: number;
  /** Приведённая жёсткость. */
  c: number;
}

export function elemStiff(e: Elem): ElemStiff {
  let c0: number;
  if (e.kind === 'spring') c0 = e.c;
  else if (e.kind === 'rod') c0 = (e.E * e.A) / e.l;
  else c0 = 1 / beamUnit(e).d;
  let factor = 1;
  if (e.kind === 'spring') {
    const ca = Math.cos((e.ang * Math.PI) / 180);
    factor *= ca * ca;
    if (e.lb > 0) factor *= (e.la / e.lb) ** 2;
  }
  return { c0, factor, c: c0 * factor };
}

export interface StiffResult {
  ok: boolean;
  errors: string[];
  items: ElemStiff[][];
  /** Жёсткость каждой ступени (сумма параллельных). */
  stages: number[];
  c: number;
}

export function validateElem(e: Elem, where: string): string[] {
  const er: string[] = [];
  const pos = (v: number, name: string) => {
    if (!(v > 0)) er.push(`${where}: ${name} — положительное число.`);
  };
  if (e.kind === 'spring') {
    pos(e.c, 'жёсткость c');
    if (!(Math.abs(e.ang) < 90)) er.push(`${where}: угол пружины с осью движения — от −90° до 90° (не включая).`);
    if (e.lb < 0 || e.la < 0) er.push(`${where}: плечи рычага не могут быть отрицательными.`);
    if (e.lb > 0 && !(e.la > 0)) er.push(`${where}: задайте плечо пружины a > 0 (или уберите рычаг: b = 0).`);
  } else {
    pos(e.E, 'модуль упругости E');
    pos(e.l, e.kind === 'beam' ? 'длина пролёта l' : 'длина l');
    if (e.kind === 'rod') pos(e.A, 'площадь A');
    else {
      pos(e.J, 'момент инерции J');
      if (e.scheme === 'ss-a' && !(e.a > 0 && e.a < e.l)) er.push(`${where}: расстояние a — от 0 до l (не включая).`);
      if (e.scheme === 'overhang') pos(e.a, 'длина консоли a');
    }
  }
  return er;
}

/** Жёсткость системы элементов: ступени последовательно, элементы ступени параллельно. */
export function stiffness(stages: Stage[]): StiffResult {
  const errors: string[] = [];
  if (!stages.length || stages.some((s) => !s.items.length)) errors.push('В каждой ступени упругого элемента должен быть хотя бы один элемент.');
  stages.forEach((s, i) =>
    s.items.forEach((e, j) =>
      errors.push(...validateElem(e, stages.length > 1 || s.items.length > 1 ? `Ступень ${i + 1}, элемент ${j + 1}` : 'Упругий элемент')),
    ),
  );
  if (stages.length > 1 && stages.some((s) => s.items.some((e) => e.kind === 'spring' && e.ang !== 0)))
    errors.push('Угол пружины с осью движения учитывается, только когда все элементы включены параллельно (одна ступень).');
  if (errors.length) return { ok: false, errors, items: [], stages: [], c: NaN };
  const items = stages.map((s) => s.items.map(elemStiff));
  const st = items.map((row) => row.reduce((t, x) => t + x.c, 0));
  const c = 1 / st.reduce((t, x) => t + 1 / x, 0);
  return { ok: true, errors, items, stages: st, c };
}
