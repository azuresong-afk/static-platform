/**
 * Обратные задачи: по измеренной величине найти параметр системы (Мещерский 32.41–32.42, 32.62, 32.83, 32.96, 32.100,
 * 53.34, 53.41–53.42) и опыты с эталонной массой (32.47, 37.17–37.19).
 *
 * Подбор — численный: решается прямая задача `solveOsc` и корень уравнения «измеренная величина (параметр) = заданное
 * значение» ищется делением отрезка пополам на сетке с постоянным отношением соседних значений. Корней может быть
 * несколько (амплитуда вынужденных колебаний при заданном моменте инерции — до и после резонанса: 53.42), поэтому
 * возвращаются все. Формулы опытов — замкнутые.
 */
import { solveOsc, type OscProblem, type OscResult } from './osc';

export type InvUnknown = 'c' | 'l' | 'E' | 'J' | 'A' | 'g' | 'b' | 'm' | 'amp' | 'p' | 'h';
export type InvTarget = 'T0' | 'T1' | 'k' | 'B' | 'Bmax' | 'etaMax' | 'eps' | 'pStar' | 'xmax' | 'Kd';
export type InvKind = 'param' | 'jref' | 'jadd' | 'g2' | 'bifilar';

export const INV_UNKNOWN: Record<InvUnknown, string> = {
  c: 'жёсткость c',
  l: 'длина l (пролёт балки, длина стержня)',
  E: 'модуль упругости E',
  J: 'момент инерции сечения J',
  A: 'площадь сечения стержня A',
  g: 'ускорение свободного падения g',
  b: 'коэффициент сопротивления b',
  m: 'вес или масса груза',
  amp: 'амплитуда возмущения (H, a, эксцентриситет e)',
  p: 'частота возмущения p',
  h: 'высота падения h',
};
export const INV_TARGET: Record<InvTarget, string> = {
  T0: 'период свободных колебаний T₀, с',
  T1: 'период затухающих колебаний T₁, с',
  k: 'собственная частота k, с⁻¹',
  B: 'амплитуда вынужденных колебаний B',
  Bmax: 'наибольшая (по p) амплитуда вынужденных колебаний',
  etaMax: 'наибольшая амплитуда в долях статического отклонения H/c',
  eps: 'сдвиг фазы ε, °',
  pStar: 'частота p*, при которой амплитуда наибольшая, с⁻¹',
  xmax: 'наибольшее отклонение x_max',
  Kd: 'коэффициент динамичности K_д',
};

/** Опыты с эталонной массой и бифиляр: ввод по видам. */
export interface InvExp {
  /** Эталон: вес диска и радиус (jref, jadd), периоды (jref: T_эт и T₁ — своё; jadd: T₁ без диска и T₂ с диском). */
  P: number;
  r: number;
  Tr: number;
  T1: number;
  T2: number;
  /** g2: статические удлинения и периоды двух грузов (T1, T2 — общие поля), веса — по желанию. */
  d1: number;
  d2: number;
  P1: number;
  P2: number;
  /** bifilar: вес стержня, полудлина a, полурасстояние b, длина нитей l, измеренный период (0 — не задан). */
  a: number;
  b: number;
  l: number;
  Tm: number;
}

export interface Inverse {
  on: boolean;
  kind: InvKind;
  unknown: InvUnknown;
  target: InvTarget;
  value: number;
  /** Номер корня, который подставляется в задачу. */
  pick: number;
  exp: InvExp;
}

export const INV_BASE: Inverse = {
  on: false,
  kind: 'param',
  unknown: 'c',
  target: 'T0',
  value: 1,
  pick: 0,
  exp: { P: 1.6, r: 15, Tr: 3, T1: 2.4, T2: 3.2, d1: 5, d2: 10, P1: 0, P2: 0, a: 50, b: 10, l: 100, Tm: 0 },
};

/** Элементы единственной ступени (параллельные одинаковые балки, стержни): значение подставляется во все подходящие. */
function stageItems(pr: OscProblem, pred: (e: OscProblem['el']['stages'][0]['items'][0]) => boolean) {
  const st = pr.el.mode === 'elems' && pr.el.stages.length === 1 ? pr.el.stages[0].items.filter(pred) : [];
  return st;
}
const notSpring = (e: { kind: string }) => e.kind !== 'spring';

/** Подставить значение неизвестного в задачу; null — если для него в задаче нет места. */
export function applyUnknown(pr: OscProblem, u: InvUnknown, val: number): OscProblem | null {
  const q = structuredClone(pr);
  const set = (pred: Parameters<typeof stageItems>[1], key: 'l' | 'E' | 'J' | 'A') => {
    const t = stageItems(q, pred);
    if (!t.length) return null;
    t.forEach((e) => (e[key] = val));
    return q;
  };
  switch (u) {
    case 'c':
      q.el.mode = 'c';
      q.el.c = val;
      return q;
    case 'l':
      return set(notSpring, 'l');
    case 'E':
      return set(notSpring, 'E');
    case 'J':
      return set((e) => e.kind === 'beam', 'J');
    case 'A':
      return set((e) => e.kind === 'rod', 'A');
    case 'g':
      q.gms = val;
      return q;
    case 'b':
      q.damp.mode = 'b';
      q.damp.b = val;
      return q;
    case 'm':
      q.m = val;
      return q;
    case 'p':
      if (q.exc.mode === 'none') return null;
      q.exc.p = val;
      return q;
    case 'h':
      if (q.init.mode !== 'drop') return null;
      q.init.h = val;
      return q;
    case 'amp': {
      const e = q.exc;
      if (e.mode === 'none') return null;
      if (e.mode === 'base' || e.mode === 'support' || e.mode === 'cam') e.a = val;
      else if (e.mode === 'rotor') e.e = val;
      else if (e.mode === 'two') {
        const k = e.H !== 0 ? val / e.H : 1;
        e.H = val;
        e.H2 *= k;
      } else e.H = val;
      return q;
    }
  }
}

/** Текущее значение неизвестного (для начала поиска). */
export function currentUnknown(pr: OscProblem, u: InvUnknown): number {
  switch (u) {
    case 'c':
      return pr.el.c;
    case 'l':
      return stageItems(pr, notSpring)[0]?.l ?? NaN;
    case 'E':
      return stageItems(pr, notSpring)[0]?.E ?? NaN;
    case 'J':
      return stageItems(pr, (e) => e.kind === 'beam')[0]?.J ?? NaN;
    case 'A':
      return stageItems(pr, (e) => e.kind === 'rod')[0]?.A ?? NaN;
    case 'g':
      return pr.gms;
    case 'b':
      return pr.damp.b;
    case 'm':
      return pr.m;
    case 'p':
      return pr.exc.p;
    case 'h':
      return pr.init.h;
    case 'amp': {
      const e = pr.exc;
      return e.mode === 'base' || e.mode === 'support' || e.mode === 'cam' ? e.a : e.mode === 'rotor' ? e.e : e.H;
    }
  }
}

/** Измеренная величина по решению прямой задачи; NaN — если в этой задаче её нет. */
export function measured(r: OscResult, t: InvTarget): number {
  const f = r.forced;
  switch (t) {
    case 'T0':
      return r.T0;
    case 'T1':
      return r.T1 ?? NaN;
    case 'k':
      return r.k;
    case 'B':
      return f?.B != null ? Math.abs(f.B) : NaN;
    case 'Bmax':
      return f?.Bmax ?? NaN;
    case 'etaMax':
      return f?.Bmax != null && f.H !== 0 ? (Math.abs(f.Bmax) * r.c) / Math.abs(f.H) : NaN;
    case 'eps':
      return f ? (f.eps * 180) / Math.PI : NaN;
    case 'pStar':
      return f?.pStar ?? NaN;
    case 'xmax':
      return Math.max(Math.abs(r.max.x), Math.abs(r.min.x));
    case 'Kd':
      return r.Kd ?? NaN;
  }
}

export interface InvResult {
  ok: boolean;
  errors: string[];
  /** Найденные значения неизвестного по возрастанию. */
  roots: number[];
  /** Выбранный корень и задача с ним. */
  pick: number;
  value: number;
  problem: OscProblem | null;
  /** Решение с найденным значением и проверка: измеренная величина при нём. */
  check: number | null;
}

const NG = 3000;

export function solveInverse(pr: OscProblem, inv: Pick<Inverse, 'unknown' | 'target' | 'value' | 'pick'>): InvResult {
  const bad = (errors: string[]): InvResult => ({ ok: false, errors, roots: [], pick: 0, value: NaN, problem: null, check: null });
  if (!Number.isFinite(inv.value)) return bad(['Измеренное значение — число.']);
  const v0 = currentUnknown(pr, inv.unknown);
  if (applyUnknown(pr, inv.unknown, 1) == null) {
    const why: Partial<Record<InvUnknown, string>> = {
      l: 'длина — у стержней и балок единственной ступени: соберите упругий элемент из них (параллельные одинаковые элементы получают одно значение)',
      E: 'модуль упругости — у стержней и балок единственной ступени',
      J: 'момент инерции сечения — у балок единственной ступени',
      A: 'площадь сечения — у стержней единственной ступени',
      p: 'в задаче нет возмущения',
      amp: 'в задаче нет возмущения',
      h: 'высота падения — только при начальном условии «груз падает с высоты h»',
    };
    return bad([`Неизвестную величину нельзя подставить: ${why[inv.unknown] ?? 'нет места в задаче'}.`]);
  }
  const f = (x: number): number => {
    const q = applyUnknown(pr, inv.unknown, x);
    if (!q) return NaN;
    const r = solveOsc(q, { light: true });
    if (!r.ok) return NaN;
    return measured(r, inv.target) - inv.value;
  };
  // Область поиска: вокруг заданного значения (если его нет — вокруг единицы), на 5 порядков в обе стороны.
  const mid = Number.isFinite(v0) && v0 > 0 ? v0 : 1;
  const lo = mid * 1e-5,
    hi = mid * 1e5;
  const roots: number[] = [];
  let xp = lo,
    fp = f(lo);
  for (let i = 1; i <= NG; i++) {
    const x = lo * (hi / lo) ** (i / NG);
    const fx = f(x);
    if (Number.isFinite(fp) && Number.isFinite(fx) && fp * fx <= 0 && !(fp === 0 && fx === 0)) {
      let a = xp,
        bb = x,
        fa = fp;
      for (let it = 0; it < 200; it++) {
        const mm = Math.sqrt(a * bb);
        const fm = f(mm);
        if (!Number.isFinite(fm)) break;
        if (fa * fm <= 0) bb = mm;
        else ((a = mm), (fa = fm));
        if (Math.abs(bb / a - 1) < 1e-14) break;
      }
      const root = Math.sqrt(a * bb);
      // Разрывы (скачок знака без нуля) отсеиваем: на корне невязка мала по сравнению с масштабом задачи.
      const scale = Math.max(Math.abs(inv.value), 1e-300);
      if (Math.abs(f(root)) < 1e-6 * scale && !roots.some((q) => Math.abs(q / root - 1) < 1e-9)) roots.push(root);
    }
    xp = x;
    fp = fx;
  }
  if (!roots.length)
    return bad([
      'Такого значения нет ни при каком положительном значении неизвестной (в пределах 10⁻⁵…10⁵ от заданного): проверьте, что измеренная величина достижима, и единицы.',
    ]);
  roots.sort((a, b2) => a - b2);
  const pick = Math.min(Math.max(0, Math.round(inv.pick)), roots.length - 1);
  const problem = applyUnknown(pr, inv.unknown, roots[pick])!;
  const rr = solveOsc(problem, { light: true });
  return { ok: true, errors: [], roots, pick, value: roots[pick], problem, check: rr.ok ? measured(rr, inv.target) : null };
}

/* ---------- опыты ---------- */

export interface ExpResult {
  ok: boolean;
  errors: string[];
  /** Пары «название — значение» для текста; значения — в единицах задачи. */
  vals: Record<string, number>;
}

/**
 * jref (37.17): диск (J = Pr²/2g) на проволоке даёт период T_эт, тело — T₁; жёсткость одна и та же:
 *   c = J_эт(2π/T_эт)², J = cT₁²/(4π²) = J_эт(T₁/T_эт)².
 * jadd (37.18): тело без диска — T₁, с диском на нём — T₂: c = J(2π/T₁)² = (J + J_д)(2π/T₂)², J = J_д·T₁²/(T₂² − T₁²).
 * g2 (32.47): два груза на пружине, статические удлинения δ₁, δ₂ и периоды T₁, T₂ (масса пружины — добавочная m_a):
 *   T_i² = 4π²(δ_i/g + m_a/c) ⇒ g = 4π²(δ₁ − δ₂)/(T₁² − T₂²).
 * bifilar (37.19): c = Pb²/l, J = Pa²/(3g) (стержень длиной 2a), T = 2π√(J/c) = (2πa/b)√(l/3g); по измеренному T_м — J = cT_м²/4π².
 */
export function solveExperiment(pr: OscProblem, inv: Inverse): ExpResult {
  const e = inv.exp;
  const g = pr.gms / ({ m: 1, cm: 0.01, mm: 0.001 } as const)[pr.len];
  const fail = (m: string): ExpResult => ({ ok: false, errors: [m], vals: {} });
  const pos = (...v: number[]) => v.every((x) => x > 0 && Number.isFinite(x));
  const w2 = (T: number) => (2 * Math.PI) ** 2 / (T * T);
  if (!(g > 0)) return fail('g — положительное число.');
  if (inv.kind === 'jref') {
    if (!pos(e.P, e.r, e.Tr, e.T1)) return fail('Вес и радиус диска и оба периода — положительные числа.');
    const Jr = (e.P * e.r * e.r) / (2 * g);
    const c = Jr * w2(e.Tr);
    return { ok: true, errors: [], vals: { Jr, c, J: c / w2(e.T1) } };
  }
  if (inv.kind === 'jadd') {
    if (!pos(e.P, e.r, e.T1, e.T2) || !(e.T2 > e.T1))
      return fail('Вес и радиус диска и периоды — положительные числа, период с диском больше периода без него.');
    const Jd = (e.P * e.r * e.r) / (2 * g);
    const J = (Jd * e.T1 * e.T1) / (e.T2 * e.T2 - e.T1 * e.T1);
    return { ok: true, errors: [], vals: { Jd, J, c: J * w2(e.T1) } };
  }
  if (inv.kind === 'g2') {
    if (!pos(e.d1, e.d2, e.T1, e.T2)) return fail('Статические удлинения и периоды — положительные числа.');
    if (e.d1 === e.d2 || e.T1 === e.T2) return fail('Опыты должны различаться: δ₁ ≠ δ₂ и T₁ ≠ T₂.');
    const gg = ((2 * Math.PI) ** 2 * (e.d1 - e.d2)) / (e.T1 * e.T1 - e.T2 * e.T2);
    if (!(gg > 0)) return fail('По этим данным g получается отрицательным: больший груз должен иметь и большие δ, и больший период.');
    const out: Record<string, number> = { g: gg };
    // Жёсткость и добавочная масса — если известны веса: c = (P₁ − P₂)/(δ₁ − δ₂), m_a = c·T₁²/4π² − P₁/g.
    if (e.P1 > 0 && e.P2 > 0 && e.P1 !== e.P2) {
      const c = (e.P1 - e.P2) / (e.d1 - e.d2);
      out.c = c;
      out.ma = c / w2(e.T1) - e.P1 / gg;
    }
    return { ok: true, errors: [], vals: out };
  }
  if (inv.kind === 'bifilar') {
    if (!pos(e.P, e.a, e.b, e.l)) return fail('Вес, полудлина стержня, полурасстояние между нитями и длина нитей — положительные числа.');
    const c = (e.P * e.b * e.b) / e.l;
    const J = (e.P * e.a * e.a) / (3 * g);
    const out: Record<string, number> = { c, J, T: (2 * Math.PI) / Math.sqrt(c / J) };
    if (e.Tm > 0) out.Jm = c / w2(e.Tm);
    return { ok: true, errors: [], vals: out };
  }
  return fail('Неизвестный вид опыта.');
}
