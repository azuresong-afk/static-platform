/**
 * Кручение ступенчатого вала (Антонов, гл. 7).
 *
 * Вал горизонтальный, ось z — слева направо, начало — левый торец. Ступени длиной l_i, наружный диаметр
 * D_i = k_i·d, внутренний — c_i·D_i (c = 0 — сплошной вал). Внешние моменты приложены в узлах (границах ступеней и
 * торцах); значение «+» — вектор момента направлен по оси z (вращение против часовой стрелки, если смотреть
 * с правого конца вала на левый).
 *
 * Правило знаков (Антонов, п. 7.2): внутренний момент M_z положителен, если со стороны сечения он виден против
 * часовой стрелки; M_z равен алгебраической сумме внешних моментов по одну сторону от сечения, причём момент,
 * видимый со стороны сечения по часовой стрелке, берётся со знаком «+». В векторной записи это M_z = Σ m_j
 * по моментам правее сечения (m_j — проекции векторов на z), что равно −Σ m_j по моментам левее.
 *
 * Закрепление: без заделок (подшипники кручению не препятствуют — моменты должны быть уравновешены), заделка слева,
 * справа или с обеих сторон (один раз статически неопределимый вал: полный угол закручивания равен нулю).
 *
 * Единицы: моменты — кН·м, длины — м, диаметры — мм, G и τ — МПа, Θ — рад/м (и °/м), φ — рад (и °).
 *   τ = M_z/W_p: M_z·10⁶ Н·мм / мм³;  φ = M_z·l/(G·I_p) = M_z·10⁶·l·10³/(G·I_p) рад.
 */

export interface ShaftStep {
  /** Длина, м. */
  l: number;
  /** Наружный диаметр в долях d. */
  k: number;
  /** Отношение внутреннего диаметра к наружному (0 — сплошной). */
  c: number;
}
export interface Shaft {
  steps: ShaftStep[];
  /** Внешние моменты в узлах 0…n, кН·м («+» — вектор вдоль z). */
  moments: number[];
  /** Нагрузка задана моментами или мощностями на шкивах (кВт, ведущий «+», ведомые «−») и частотой вращения. */
  load: 'moment' | 'power';
  powers: number[];
  /** Частота вращения вала, об/мин. */
  rpm: number;
  supports: 'none' | 'left' | 'right' | 'both';
  /** Модуль сдвига, МПа. */
  G: number;
  /** Диаметр d: найти по условиям прочности и жёсткости или задан. */
  dMode: 'find' | 'given';
  /** Заданный диаметр d, мм. */
  d: number;
  /** Допускаемое касательное напряжение, МПа. */
  tauAllow: number;
  /** Допускаемый относительный угол закручивания, °/м (0 — не проверять). */
  thetaAllow: number;
}

export interface ShaftStepResult {
  z0: number;
  z1: number;
  Mz: number;
  /** Наружный и внутренний диаметры, мм. */
  D: number;
  dIn: number;
  /** Полярные момент инерции, мм⁴, и момент сопротивления, мм³. */
  Ip: number;
  Wp: number;
  tau: number;
  /** Относительный угол закручивания, рад/м. */
  theta: number;
  /** Угол закручивания участка, рад, и углы поворота сечений на концах (от неподвижного сечения), рад. */
  phi: number;
  phi0: number;
  phi1: number;
}

export interface ShaftSolution {
  ok: true;
  d: number;
  /** Диаметры d из условия прочности и жёсткости (при подборе), мм. */
  dStrength: number | null;
  dStiff: number | null;
  /** Реактивные моменты заделок, кН·м (проекции на z, действующие на вал). */
  RA: number | null;
  RB: number | null;
  steps: ShaftStepResult[];
  tauMax: { v: number; i: number };
  thetaMax: { v: number; i: number };
  /** Наибольший по модулю угол поворота сечения, рад, и координата. */
  phiMax: { v: number; z: number };
  /** Для вала с двумя заделками: угол поворота правого торца от внешних моментов при отброшенной правой заделке и податливость. */
  indet: { phiF: number; flex: number } | null;
  /** Сумма внешних моментов (для вала без заделок должна быть 0). */
  sum: number;
}
export type ShaftError = 'nosteps' | 'unbalanced' | 'data';
export type ShaftResult = ShaftSolution | { ok: false; error: ShaftError; text: string };

const ipOf = (D: number, c: number) => (Math.PI * D ** 4 * (1 - c ** 4)) / 32;
const wpOf = (D: number, c: number) => (Math.PI * D ** 3 * (1 - c ** 4)) / 16;

/** Момент в узле по мощности и частоте вращения: M = P/ω = 30P/(πn), кН·м при P в кВт и n в об/мин. */
export const torqueFromPower = (P: number, n: number) => (30 * P) / (Math.PI * n);

/** Внешние моменты, кН·м: заданные или по мощностям. */
export function shaftMoments(s: Shaft): number[] {
  return s.load === 'power' ? s.powers.map((P) => (s.rpm > 0 ? torqueFromPower(P, s.rpm) : NaN)) : s.moments;
}

export function solveShaft(s0: Shaft): ShaftResult {
  const n = s0.steps.length;
  if (!n) return { ok: false, error: 'nosteps', text: 'Добавьте хотя бы один участок.' };
  if (s0.load === 'power' && !(s0.rpm > 0)) return { ok: false, error: 'data', text: 'Частота вращения n — положительная.' };
  if (s0.load === 'power' && s0.powers.length !== n + 1) return { ok: false, error: 'data', text: 'Мощностей должно быть по одной на узел.' };
  const s = { ...s0, moments: shaftMoments(s0) };
  if (s.moments.length !== n + 1 || !s.moments.every(Number.isFinite)) return { ok: false, error: 'data', text: 'Моменты в узлах — числа.' };
  if (s.steps.some((t) => !(t.l > 0) || !(t.k > 0) || !(t.c >= 0 && t.c < 1))) return { ok: false, error: 'data', text: 'Длины и доли диаметров — положительные, отношение c — от 0 до 1 (не включая 1).' };
  if (!(s.G > 0)) return { ok: false, error: 'data', text: 'Модуль сдвига G — положительный.' };
  if (s.dMode === 'given' && !(s.d > 0)) return { ok: false, error: 'data', text: 'Диаметр d — положительный.' };
  if (s.dMode === 'find' && !(s.tauAllow > 0)) return { ok: false, error: 'data', text: 'Для подбора диаметра задайте [τ] > 0.' };
  const sum = s.moments.reduce((a, b) => a + b, 0);
  const scale = Math.max(1, ...s.moments.map(Math.abs));
  if (s.supports === 'none' && Math.abs(sum) > 1e-9 * scale) return { ok: false, error: 'unbalanced', text: `Вал без заделок: внешние моменты должны уравновешиваться, а их сумма ${+sum.toFixed(6)} кН·м. Добавьте заделку или уравновешивающий момент.` };
  // Внутренние моменты от внешних (как если бы заделка была слева): M_z,i = Σ m_j правее участка.
  const right = (i: number) => s.moments.slice(i + 1).reduce((a, b) => a + b, 0);
  let RA: number | null = null,
    RB: number | null = null;
  let Mz = s.steps.map((_, i) => right(i));
  // Податливость участка «в долях»: l/(k⁴(1 − c⁴)) — общий множитель 32/(πGd⁴) сокращается.
  const fl = s.steps.map((t) => t.l / (t.k ** 4 * (1 - t.c ** 4)));
  let indet: ShaftSolution['indet'] = null;
  if (s.supports === 'right') {
    // Заделка справа: M_z = −Σ m_j левее участка.
    Mz = s.steps.map((_, i) => -s.moments.slice(0, i + 1).reduce((a, b) => a + b, 0));
    RB = -sum;
  } else if (s.supports === 'left') RA = -sum;
  else if (s.supports === 'both') {
    // Отбрасываем правую заделку, заменяем моментом X; φ_B = Σ (M_z,i + X)·f_i = 0.
    const phiF = Mz.reduce((a, m, i) => a + m * fl[i], 0);
    const flex = fl.reduce((a, b) => a + b, 0);
    const X = -phiF / flex;
    Mz = Mz.map((m) => m + X);
    RB = X;
    RA = -sum - X;
    indet = { phiF, flex };
  }
  Mz = Mz.map((m) => (Math.abs(m) < 1e-12 * scale ? 0 : m));
  // Диаметр.
  let d = s.d,
    dStrength: number | null = null,
    dStiff: number | null = null;
  if (s.dMode === 'find') {
    dStrength = Math.max(...s.steps.map((t, i) => Math.cbrt((16 * Math.abs(Mz[i]) * 1e6) / (Math.PI * t.k ** 3 * (1 - t.c ** 4) * s.tauAllow))));
    if (s.thetaAllow > 0) {
      const th = (s.thetaAllow * Math.PI) / 180 / 1000; // рад/мм
      dStiff = Math.max(...s.steps.map((t, i) => Math.pow((32 * Math.abs(Mz[i]) * 1e6) / (Math.PI * t.k ** 4 * (1 - t.c ** 4) * s.G * th), 0.25)));
    }
    d = Math.max(dStrength, dStiff ?? 0);
    if (!(d > 0)) return { ok: false, error: 'data', text: 'Внутренние моменты всюду равны нулю — диаметр по прочности не определяется.' };
  }
  // Углы: отсчёт от неподвижного сечения (слева при заделке слева, с обеих сторон и без заделок; справа — от правого торца).
  let z = 0,
    acc = 0;
  const steps: ShaftStepResult[] = s.steps.map((t, i) => {
    const D = t.k * d,
      Ip = ipOf(D, t.c),
      Wp = wpOf(D, t.c);
    const tau = (Mz[i] * 1e6) / Wp;
    const theta = ((Mz[i] * 1e6) / (s.G * Ip)) * 1000;
    const phi = theta * t.l;
    const r = { z0: z, z1: z + t.l, Mz: Mz[i], D, dIn: t.c * D, Ip, Wp, tau, theta, phi, phi0: acc, phi1: acc + phi };
    z += t.l;
    acc += phi;
    return r;
  });
  if (s.supports === 'right') {
    const total = acc;
    for (const r of steps) {
      r.phi0 -= total;
      r.phi1 -= total;
    }
  }
  let tauMax = { v: 0, i: 0 },
    thetaMax = { v: 0, i: 0 },
    phiMax = { v: 0, z: 0 };
  steps.forEach((r, i) => {
    if (Math.abs(r.tau) > Math.abs(tauMax.v)) tauMax = { v: r.tau, i };
    if (Math.abs(r.theta) > Math.abs(thetaMax.v)) thetaMax = { v: r.theta, i };
    for (const [v, zz] of [
      [r.phi0, r.z0],
      [r.phi1, r.z1],
    ])
      if (Math.abs(v) > Math.abs(phiMax.v)) phiMax = { v, z: zz };
  });
  return { ok: true, d, dStrength, dStiff, RA, RB, steps, tauMax, thetaMax, phiMax, indet, sum };
}
