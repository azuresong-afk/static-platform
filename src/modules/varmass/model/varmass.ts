/**
 * Динамика тела переменной массы (Мещерский §45).
 *
 * Прямолинейное движение вдоль оси x, наклонённой под углом α к горизонту (α = 90° — вертикально вверх). Уравнение
 * Мещерского: m·dv/dt = ΣF + (u − v)·dm/dt, где u — абсолютная скорость отделяющихся (присоединяющихся) частиц.
 *   истечение со скоростью v_e относительно тела под углом β к оси — реактивная сила Φ = v_e·q, q = −dm/dt,
 *     составляющая вдоль оси Φ cos β, поперёк (от направляющей) Φ sin β — она уменьшает нормальное давление;
 *   частицы с нулевой абсолютной скоростью (присоединяются из покоя: цепь, капля, обледенение) — сила −v·dm/dt;
 *   частицы с нулевой относительной скоростью — реактивной силы нет.
 * Силы: тяжесть −m·g·sin α (g постоянно или ∝ 1/(R + h)²), трение −f·N·sign v, N = m·g·cos α − Φ sin β,
 * сопротивление −k₁v − k₂v|v| и сила-формула F(t, x, v). Масса — формула m(t, x) или (обратная задача) находится по
 * заданному постоянному ускорению w. Интегрирование — Рунге — Кутта с контролем шага, конец — по времени, массе,
 * скорости, пути или остановке; затем, по желанию, движение с постоянной массой до остановки (наибольшая высота).
 *
 * Многоступенчатая ракета вне поля тяготения: скорость после i-й ступени v_i = v_{i−1} + v_e,i·ln z_i (формула
 * Циолковского, z — число Циолковского субракеты); веса субракет, топлива и сухие веса ступеней — формулы Фертрегта;
 * наименьший стартовый вес — z_i = s_i(1 − 1/(λ·v_e,i)) (условие Лагранжа).
 */
import { evalExpr, parseExpr, usesVar, type Expr } from '../../../shared/expr';
import { fmt } from '../../../shared/format';

export type Particles = 'jet' | 'zeroAbs' | 'zeroRel';
export type StopKind = 'time' | 'mass' | 'speed' | 'dist' | 'rest';
export interface VarLine {
  g: number;
  /** Угол оси x к горизонту, °. */
  alpha: number;
  grav: 'uniform' | 'inverse' | 'none';
  /** Радиус планеты для g ∝ 1/(R + h)². */
  Rg: number;
  massMode: 'law' | 'accel';
  /** Закон массы m(t, x). */
  mLaw: string;
  /** Обратная задача: постоянное ускорение и начальная масса. */
  w: number;
  m0: number;
  part: Particles;
  ve: number;
  beta: number;
  f: number;
  k1: number;
  k2: number;
  /** Сила-формула F(t, x, v). */
  force: string;
  x0: number;
  v0: number;
  stop: StopKind;
  t1: number;
  m1: number;
  v1: number;
  s1: number;
  /** После активного участка — движение с постоянной массой до остановки. */
  coast: boolean;
}
export interface Sample {
  t: number;
  x: number;
  v: number;
  m: number;
}
export interface LineEnd {
  t: number;
  x: number;
  v: number;
  m: number;
  a: number;
  /** Реактивная сила вдоль оси и полная, dm/dt. */
  R: number;
  Phi: number;
  dm: number;
  N: number;
}
export interface LineResult {
  ok: boolean;
  errors: string[];
  notes: string[];
  /** Начало и конец активного участка. */
  start: LineEnd | null;
  end: LineEnd | null;
  /** Почему закончился активный участок. */
  reason: StopKind | 'stuck' | 'empty' | 'limit';
  /** Работа реактивной силы на активном участке. */
  A: number;
  /** Движение с постоянной массой до остановки: время, координата, подъём. */
  coast: { t: number; x: number; dx: number } | null;
  curve: Sample[];
  /** Проверка формулой Циолковского (истечение вдоль оси, без трения и сопротивления, g постоянно). */
  tsiol: number | null;
  /** Закон массы при заданном ускорении — в замкнутом виде (силы ∝ m): показатель экспоненты. */
  expRate: number | null;
  mExpr: Expr | null;
}

const rad = (a: number) => (a * Math.PI) / 180;

/** Масса и её производная по закону m(t, x). */
function massFns(e: Expr) {
  const m = (t: number, x: number) => evalExpr(e, t, { x });
  const dm = (t: number, x: number, v: number) => {
    const ht = 1e-6 * Math.max(1, Math.abs(t)),
      hx = 1e-6 * Math.max(1, Math.abs(x));
    const mt = (m(t + ht, x) - m(t - ht, x)) / (2 * ht);
    const mx = usesVar(e, 'x') ? (m(t, x + hx) - m(t, x - hx)) / (2 * hx) : 0;
    return mt + mx * v;
  };
  return { m, dm };
}

export function solveLine(pr: VarLine): LineResult {
  const errors: string[] = [];
  const notes: string[] = [];
  const base: LineResult = {
    ok: false,
    errors,
    notes,
    start: null,
    end: null,
    reason: 'limit',
    A: 0,
    coast: null,
    curve: [],
    tsiol: null,
    expRate: null,
    mExpr: null,
  };
  if (!(pr.g >= 0)) errors.push('Ускорение свободного падения g — неотрицательное число.');
  if (pr.part === 'jet' && !(pr.ve > 0)) errors.push('Скорость истечения v_e — положительное число.');
  if (!(pr.f >= 0) || !(pr.k1 >= 0) || !(pr.k2 >= 0)) errors.push('Коэффициенты трения и сопротивления — неотрицательные.');
  if (pr.grav === 'inverse' && !(pr.Rg > 0)) errors.push('Радиус планеты R — положительное число.');
  const fp = parseExpr(pr.force, { vars: ['x', 'v'] });
  if (!fp.ok) errors.push(`Сила F(t, x, v): ${fp.error}.`);
  let law: ReturnType<typeof massFns> | null = null;
  let mExpr: Expr | null = null;
  if (pr.massMode === 'law') {
    const mp = parseExpr(pr.mLaw, { vars: ['x'] });
    if (!mp.ok) errors.push(`Закон массы m(t, x): ${mp.error}.`);
    else {
      mExpr = mp.e;
      law = massFns(mp.e);
    }
  } else {
    if (!(pr.m0 > 0)) errors.push('Начальная масса m₀ — положительное число.');
    if (pr.part === 'zeroRel') errors.push('При нулевой относительной скорости частиц масса не влияет на движение — по ускорению её не найти.');
  }
  if (pr.stop === 'time' && !(pr.t1 > 0)) errors.push('Время t₁ — положительное число.');
  if (pr.stop === 'dist' && !(pr.s1 > 0)) errors.push('Путь s₁ — положительное число.');
  if (pr.stop === 'mass' && !(pr.m1 > 0)) errors.push('Конечная масса m₁ — положительное число.');
  if (errors.length) return base;
  const F = fp.ok ? fp.e : null;
  const sa = Math.sin(rad(pr.alpha)),
    ca = Math.cos(rad(pr.alpha));
  const sb = Math.sin(rad(pr.beta)),
    cb = Math.cos(rad(pr.beta));
  const gAt = (x: number) => (pr.grav === 'none' ? 0 : pr.grav === 'uniform' ? pr.g : (pr.g * pr.Rg * pr.Rg) / (pr.Rg + x * sa) ** 2);
  let lifted = false;
  /** Ускорение и сопутствующие величины; m, dm/dt заданы. */
  const dyn = (t: number, x: number, v: number, m: number, dm: number, active: boolean) => {
    const g = gAt(x);
    const q = active ? -dm : 0;
    let R = 0,
      Phi = 0;
    if (active) {
      if (pr.part === 'jet') {
        Phi = pr.ve * q;
        R = Phi * cb;
      } else if (pr.part === 'zeroAbs') R = -v * dm;
    }
    const Ff = F ? evalExpr(F, t, { x, v }) : 0;
    let N = m * g * ca - (pr.part === 'jet' ? Phi * sb : 0);
    if (N < 0) {
      if (pr.f > 0) lifted = true;
      N = 0;
    }
    const D = R - m * g * sa - pr.k1 * v - pr.k2 * v * Math.abs(v) + Ff;
    const fr = pr.f * N;
    let a: number;
    if (Math.abs(v) > 1e-12) a = (D - Math.sign(v) * fr) / m;
    else if (Math.abs(D) <= fr) a = 0;
    else a = (D - Math.sign(D) * fr) / m;
    return { a, R, Phi, N, D, fr };
  };
  // Состояние: x, v, m (в обратной задаче), работа реактивной силы A.
  type Y = [number, number, number, number];
  const accel = pr.massMode === 'accel';
  const deriv = (t: number, y: Y, active: boolean): Y => {
    const [x, v] = y;
    if (!accel) {
      const m = active ? law!.m(t, x) : y[2];
      const dm = active ? law!.dm(t, x, v) : 0;
      const d = dyn(t, x, v, m, dm, active);
      return [v, d.a, 0, d.R * v];
    }
    // Масса по заданному ускорению: из уравнения движения выражаем dm/dt.
    const m = y[2];
    if (!active) return [v, dyn(t, x, v, m, 0, false).a, 0, 0];
    const g = gAt(x);
    const s = Math.abs(v) > 1e-12 ? Math.sign(v) : Math.sign(pr.w) || 1;
    const Ff = F ? evalExpr(F, t, { x, v }) : 0;
    const need = m * pr.w + m * g * sa + pr.k1 * v + pr.k2 * v * Math.abs(v) - Ff + s * pr.f * m * g * ca;
    let dm: number;
    if (pr.part === 'jet') dm = -need / (pr.ve * (cb + s * pr.f * sb));
    else dm = Math.abs(v) > 1e-12 ? -need / v : 0;
    const R = pr.part === 'jet' ? -pr.ve * dm * cb : -v * dm;
    return [v, pr.w, dm, R * v];
  };
  const massOf = (t: number, y: Y) => (accel ? y[2] : law!.m(t, y[0]));
  const step = (t: number, y: Y, h: number, active: boolean): Y => {
    const k1 = deriv(t, y, active);
    const y2 = y.map((c, i) => c + (h / 2) * k1[i]) as Y;
    const k2 = deriv(t + h / 2, y2, active);
    const y3 = y.map((c, i) => c + (h / 2) * k2[i]) as Y;
    const k3 = deriv(t + h / 2, y3, active);
    const y4 = y.map((c, i) => c + h * k3[i]) as Y;
    const k4 = deriv(t + h, y4, active);
    return y.map((c, i) => c + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i])) as Y;
  };
  const endOf = (t: number, y: Y, active: boolean): LineEnd => {
    const m = active ? massOf(t, y) : y[2];
    const dm = active ? (accel ? deriv(t, y, true)[2] : law!.dm(t, y[0], y[1])) : 0;
    const d = dyn(t, y[0], y[1], m, dm, active);
    return { t, x: y[0], v: y[1], m, a: accel && active ? pr.w : d.a, R: d.R, Phi: d.Phi, dm, N: d.N };
  };
  /** Интегрирование до события ev (смена знака) с контролем шага. */
  const run = (t0: number, y0: Y, active: boolean, ev: (t: number, y: Y) => number, tCap: number) => {
    let t = t0,
      y = y0;
    const out: Sample[] = [{ t, x: y[0], v: y[1], m: active ? massOf(t, y) : y[2] }];
    let h = Math.min(1e-3, tCap / 100);
    const e0 = ev(t, y);
    let n = 0;
    while (n++ < 200000) {
      // Шаг не больше 2 % прошедшего времени — чтобы графики были гладкими.
      h = Math.min(h, 0.02 * Math.max(1, t));
      if (t + h > tCap) h = tCap - t;
      // Трение: если тело останавливается внутри шага, шаг укорачивается до остановки (этапы Рунге — Кутты
      // с разными знаками трения иначе «гасят» ускорение), а в момент остановки проверяется, удержит ли трение.
      if (pr.f > 0 && y[1] !== 0) {
        const a0 = deriv(t, y, active)[1];
        if (a0 * y[1] < 0) {
          const tStop = Math.abs(y[1] / a0);
          if (tStop < 1e-10 * Math.max(1, t)) {
            y = [y[0], 0, y[2], y[3]];
            const m = active ? massOf(t, y) : y[2];
            const dmz = active ? (accel ? 0 : law!.dm(t, y[0], 0)) : 0;
            const d = dyn(t, y[0], 0, m, dmz, active);
            if (Math.abs(d.D) <= d.fr && pr.stop === 'rest' && active) {
              out.push({ t, x: y[0], v: 0, m });
              return { t, y, out, hit: true, bad: false };
            }
            continue;
          }
          if (tStop < h) h = tStop;
        }
      }
      const full = step(t, y, h, active);
      const half = step(t + h / 2, step(t, y, h / 2, active), h / 2, active);
      // Покомпонентная относительная погрешность: координата бывает 10⁷ м, а масса — доли килограмма.
      const err = Math.max(...half.slice(0, 3).map((c, i) => Math.abs(c - full[i]) / (Math.abs(c) + 1e-3)));
      if (err > 1e-11 && h > 1e-9) {
        h /= 2;
        continue;
      }
      const yn = half;
      const tn = t + h;
      if (!yn.every(Number.isFinite)) return { t, y, out, hit: false, bad: true };
      const m = active ? massOf(tn, yn) : yn[2];
      if (!(m > 0)) return { t, y, out, hit: false, bad: true, empty: true };
      const en = ev(tn, yn);
      if (Math.sign(en) !== Math.sign(e0) && e0 !== 0) {
        // Уточнение момента события делением шага пополам.
        let lo = 0,
          hi = h;
        for (let q = 0; q < 60; q++) {
          const mid = (lo + hi) / 2;
          const ym = step(t, y, mid, active);
          if (Math.sign(ev(t + mid, ym)) === Math.sign(e0)) lo = mid;
          else hi = mid;
        }
        const yh = step(t, y, hi, active);
        out.push({ t: t + hi, x: yh[0], v: yh[1], m: active ? massOf(t + hi, yh) : yh[2] });
        return { t: t + hi, y: yh, out, hit: true, bad: false };
      }
      t = tn;
      y = yn;
      out.push({ t, x: y[0], v: y[1], m });
      if (t >= tCap) return { t, y, out, hit: false, bad: false };
      if (err < 1e-13) h *= 1.5;
    }
    return { t, y, out, hit: false, bad: false };
  };
  const m0 = accel ? pr.m0 : law!.m(0, pr.x0);
  if (!(m0 > 0)) return { ...base, errors: [`Масса в начальный момент m₀ = ${fmt(m0, 4)} — должна быть положительной.`] };
  const y0: Y = [pr.x0, pr.v0, m0, 0];
  const start = endOf(0, y0, true);
  if (pr.part === 'jet' && start.dm > 1e-12 * Math.max(1, m0))
    notes.push('Масса растёт, а частицы «вылетают» с относительной скоростью v_e — реактивная сила направлена против тяги; проверьте закон массы.');
  // Событие окончания активного участка.
  const ev = (t: number, y: Y): number => {
    switch (pr.stop) {
      case 'time':
        return t - pr.t1;
      case 'mass':
        return massOf(t, y) - pr.m1;
      case 'speed':
        return y[1] - pr.v1;
      case 'dist':
        return Math.abs(y[0] - pr.x0) - pr.s1;
      default:
        // Остановка: скорость меняет знак (в начальный момент при v₀ = 0 — «до остановки»).
        return t < 1e-12 && Math.abs(y[1]) < 1e-15 ? 1 : Math.sign(pr.v0 || start.a || 1) * y[1] - 1e-9 * Math.max(1, Math.abs(pr.v0));
    }
  };
  if (pr.stop === 'mass' && !(pr.m1 < m0)) return { ...base, errors: [`Конечная масса m₁ должна быть меньше начальной m₀ = ${fmt(m0, 4)}.`] };
  // Застревание трением на месте.
  if (Math.abs(pr.v0) < 1e-15 && Math.abs(start.a) < 1e-15 && pr.stop !== 'time') {
    return { ...base, ok: true, errors: [], start, end: start, reason: 'stuck', curve: [{ t: 0, x: pr.x0, v: 0, m: m0 }], mExpr };
  }
  const tCap = pr.stop === 'time' ? pr.t1 : 1e6;
  const r = run(0, y0, true, ev, tCap);
  if (r.bad) {
    const why = (r as { empty?: boolean }).empty
      ? `масса стала неположительной (t ≈ ${fmt(r.t, 4)} с) — топливо кончилось раньше`
      : `решение перестало быть определённым (t ≈ ${fmt(r.t, 4)} с)`;
    return { ...base, errors: [`Активный участок не доведён до конца: ${why}.`], curve: r.out };
  }
  let reason: LineResult['reason'] = r.hit ? pr.stop : pr.stop === 'time' ? 'time' : 'limit';
  if (!r.hit && pr.stop !== 'time') notes.push('Условие окончания не наступило за 10⁶ с — проверьте данные.');
  const end = endOf(r.t, r.y, true);
  if (pr.stop === 'rest' && r.hit) reason = 'rest';
  // Движение с постоянной массой до остановки.
  let coast: LineResult['coast'] = null;
  let curve = r.out;
  if (pr.coast && reason !== 'rest' && Math.abs(end.v) > 1e-12) {
    const yc: Y = [end.x, end.v, end.m, 0];
    const evc = (_t: number, y: Y) => Math.sign(end.v) * y[1];
    const c = run(end.t, yc, false, evc, end.t + 1e6);
    if (c.hit) coast = { t: c.t, x: c.y[0], dx: c.y[0] - end.x };
    else notes.push('После окончания активного участка тело не останавливается.');
    curve = [...curve, ...c.out.slice(1)];
  }
  if (lifted) notes.push('Поперечная составляющая тяги больше веса — тело отрывается от направляющих (трение принято равным нулю).');
  // Формула Циолковского.
  let tsiol: number | null = null;
  const plain =
    pr.part === 'jet' &&
    Math.abs(pr.beta) < 1e-12 &&
    (pr.f === 0 || Math.abs(ca) < 1e-12) &&
    pr.k1 === 0 &&
    pr.k2 === 0 &&
    (!F || (F.k === 'num' && F.v === 0)) &&
    pr.grav !== 'inverse';
  if (plain) tsiol = pr.v0 + pr.ve * Math.log(m0 / end.m) - (pr.grav === 'none' ? 0 : pr.g * sa * end.t);
  // Закон массы в замкнутом виде при заданном ускорении: силы пропорциональны массе.
  let expRate: number | null = null;
  if (accel && pr.part === 'jet' && pr.k1 === 0 && pr.k2 === 0 && (!F || (F.k === 'num' && F.v === 0)) && pr.grav !== 'inverse') {
    const s = Math.sign(pr.v0) || Math.sign(pr.w) || 1;
    const g = pr.grav === 'none' ? 0 : pr.g;
    expRate = (pr.w + g * sa + s * pr.f * g * ca) / (pr.ve * (cb + s * pr.f * sb));
  }
  return { ok: true, errors: [], notes, start, end, reason, A: r.y[3], coast, curve, tsiol, expRate, mExpr };
}

/* ---------- многоступенчатая ракета ---------- */

export interface Stage {
  /** Скорость истечения, число Циолковского субракеты, конструктивная характеристика ступени, скорость после ступени. */
  ve: number;
  z: number;
  s: number;
  vt: number;
}
export interface StagesProblem {
  ask: 'speeds' | 'z' | 'weights' | 'optimal';
  stages: Stage[];
  /** Полезный груз и требуемая конечная скорость. */
  q: number;
  v: number;
}
export interface StageRes {
  z: number;
  dv: number;
  v: number;
  /** Вес субракеты, топлива и сухой вес ступени (если задан полезный груз). */
  G: number | null;
  P: number | null;
  Q: number | null;
}
export interface StagesResult {
  ok: boolean;
  errors: string[];
  stages: StageRes[];
  vEnd: number;
  /** Стартовый вес, множитель Лагранжа (оптимизация). */
  G1: number | null;
  lambda: number | null;
}

export function solveStages(pr: StagesProblem): StagesResult {
  const errors: string[] = [];
  const n = pr.stages.length;
  const fail = (e: string[]): StagesResult => ({ ok: false, errors: e, stages: [], vEnd: 0, G1: null, lambda: null });
  if (!n) return fail(['Нужна хотя бы одна ступень.']);
  pr.stages.forEach((st, i) => {
    if (!(st.ve > 0)) errors.push(`Ступень ${i + 1}: скорость истечения — положительное число.`);
    if ((pr.ask === 'speeds' || pr.ask === 'weights') && !(st.z > 1)) errors.push(`Ступень ${i + 1}: число Циолковского z > 1.`);
    if ((pr.ask === 'weights' || pr.ask === 'optimal') && !(st.s > 1)) errors.push(`Ступень ${i + 1}: конструктивная характеристика s > 1.`);
    if (pr.ask === 'weights' && st.z >= st.s) errors.push(`Ступень ${i + 1}: z должно быть меньше s (иначе субракета невозможна).`);
  });
  if ((pr.ask === 'weights' || pr.ask === 'optimal') && !(pr.q > 0)) errors.push('Полезный груз q — положительное число.');
  if (pr.ask === 'optimal' && !(pr.v > 0)) errors.push('Конечная скорость v — положительное число.');
  if (pr.ask === 'z') {
    let prev = 0;
    pr.stages.forEach((st, i) => {
      if (!(st.vt > prev)) errors.push(`Ступень ${i + 1}: скорость после ступени должна быть больше, чем после предыдущей.`);
      prev = st.vt;
    });
  }
  if (errors.length) return fail(errors);
  let zs = pr.stages.map((s) => s.z);
  let lambda: number | null = null;
  if (pr.ask === 'z') {
    let prev = 0;
    zs = pr.stages.map((st) => {
      const z = Math.exp((st.vt - prev) / st.ve);
      prev = st.vt;
      return z;
    });
  }
  if (pr.ask === 'optimal') {
    // z_i = s_i(1 − 1/(λ v_e,i)); Σ v_e,i ln z_i растёт с λ.
    const vAt = (lam: number) => pr.stages.reduce((sum, st) => sum + st.ve * Math.log(st.s * (1 - 1 / (lam * st.ve))), 0);
    const vMax = pr.stages.reduce((sum, st) => sum + st.ve * Math.log(st.s), 0);
    if (!(pr.v < vMax)) return fail([`Скорость ${fmt(pr.v, 4)} недостижима: даже при бесконечном запасе топлива v < Σv_e·ln s = ${fmt(vMax, 4)}.`]);
    let lo = (1 / Math.min(...pr.stages.map((s) => s.ve))) * (1 + 1e-12),
      hi = lo * 2;
    while (vAt(hi) < pr.v) hi *= 2;
    for (let it = 0; it < 200; it++) {
      const mid = (lo + hi) / 2;
      if (!(vAt(mid) >= pr.v)) lo = mid;
      else hi = mid;
    }
    lambda = (lo + hi) / 2;
    zs = pr.stages.map((st) => st.s * (1 - 1 / (lambda! * st.ve)));
    if (zs.some((z) => !(z > 1))) return fail(['Оптимальное распределение даёт z ≤ 1 у какой-то ступени — уменьшите число ступеней.']);
  }
  let v = 0;
  const res: StageRes[] = zs.map((z, i) => {
    const dv = pr.stages[i].ve * Math.log(z);
    v += dv;
    return { z, dv, v, G: null, P: null, Q: null };
  });
  let G1: number | null = null;
  if (pr.ask === 'weights' || pr.ask === 'optimal') {
    // Формулы Фертрегта: G_k = q·Π_{i≥k} z_i(s_i − 1)/(s_i − z_i), P_k = G_k(z_k − 1)/z_k, Q_k = P_k/(s_k − 1).
    let G = pr.q;
    for (let k = n - 1; k >= 0; k--) {
      const s = pr.stages[k].s,
        z = zs[k];
      G *= (z * (s - 1)) / (s - z);
      res[k].G = G;
      res[k].P = (G * (z - 1)) / z;
      res[k].Q = res[k].P! / (s - 1);
    }
    G1 = res[0].G;
  }
  return { ok: true, errors: [], stages: res, vEnd: v, G1, lambda };
}
