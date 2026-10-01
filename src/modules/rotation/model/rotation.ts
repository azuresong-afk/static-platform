/**
 * Вращение тела вокруг неподвижной оси (Мещерский §37; Антонов п. 9.2–9.5).
 *
 * 1. Дифференциальное уравнение вращения J·dω/dt = ΣM(t, φ, ω). Моменты: постоянный, a·t, m₀ sin pt,
 *    упругий −cφ, сила тяжести физического маятника −Pa sin φ, вязкое сопротивление −kω, квадратичное −kω|ω|,
 *    сухое трение −M_тр sign ω; грузы на тросах, намотанных на барабан, добавляют m r² к моменту инерции
 *    и ±P r к моменту. Интегрируем методом Рунге — Кутты с контролем шага; для типовых случаев текст
 *    решения даёт и формулу.
 * 2. Сохранение кинетического момента: K = Σ(J_i ω_i + m_i r_i u_i) до = после, все тела после вращаются вместе.
 *
 * Знак «+» — направление вращения, принятое положительным; ω, φ, моменты — со знаком.
 */
export const G = 9.81;

export type InertiaKind = 'J' | 'disk' | 'ring' | 'rho';
export interface InertiaSpec {
  kind: InertiaKind;
  /** Масса (вес) тела — для disk, ring, rho. */
  m: number;
  /** Радиус (или радиус инерции ρ). */
  R: number;
  /** Момент инерции — для kind = J. */
  J: number;
}
/** Груз на тросе, намотанном на барабан радиуса r; down — опускается при вращении в «+». */
export interface DrumLoad {
  m: number;
  r: number;
  down: boolean;
}
export interface RotEq {
  body: InertiaSpec;
  loads: DrumLoad[];
  M0: number;
  /** M = a·t. */
  at: number;
  /** M = m₀ sin(p t). */
  m0: number;
  p: number;
  /** Упругий момент −cφ. */
  c: number;
  /** Сила тяжести маятника −Pa·sin φ (P·a — статический момент). */
  Pa: number;
  /** Вязкое сопротивление −kω. */
  kv: number;
  /** Квадратичное сопротивление −kω|ω|. */
  kq: number;
  /** Сухое трение −M_тр·sign ω. */
  Mf: number;
  phi0: number;
  omega0: number;
  /** Что ищем: состояние в момент t или когда ω станет равной omega1. */
  ask: 't' | 'omega' | 'phi';
  t: number;
  omega1: number;
  /** Целевой угол (координата) — для ask = 'phi'. */
  phi1?: number;
}
export interface KItem {
  name: string;
  /** Тело (момент инерции до и после) или точечная масса (m на радиусе r). */
  kind: 'body' | 'point';
  J1: number;
  J2: number;
  m: number;
  r1: number;
  r2: number;
  /** Угловая скорость тела до (для точки — несущего тела). */
  w1: number;
  /** Относительная линейная скорость точки по окружности до и после, «+» — в сторону вращения. */
  u1: number;
  u2: number;
}
export interface RotProblem {
  mode: 'eq' | 'K';
  byWeight: boolean;
  eq: RotEq;
  K: KItem[];
}

const clean = (v: number) => (Math.abs(v) < 1e-12 ? 0 : v);
const massOf = (m: number, byWeight: boolean) => (byWeight ? m / G : m);

export function bodyInertia(b: InertiaSpec, byWeight: boolean): number {
  const m = massOf(b.m, byWeight);
  switch (b.kind) {
    case 'J':
      return b.J;
    case 'disk':
      return (m * b.R ** 2) / 2;
    case 'ring':
      return m * b.R ** 2;
    case 'rho':
      return m * b.R ** 2;
  }
}

/* ---------- уравнение вращения ---------- */

export interface EqResult {
  ok: boolean;
  errors: string[];
  /** Приведённый момент инерции (с грузами). */
  J: number;
  Jbody: number;
  /** Постоянная часть момента (M₀ и грузы). */
  Mconst: number;
  /** Момент как функция состояния (без сухого трения). */
  M: (t: number, phi: number, w: number) => number;
  /** Ответ: момент времени, угол, угловая скорость, угловое ускорение. */
  t: number;
  phi: number;
  w: number;
  eps: number;
  /** Особые случаи. */
  note: 'ok' | 'never' | 'stuck';
  /** Остановка сухим трением (ω = 0 и дальше не трогается). */
  tStop: number | null;
  /** Период малых колебаний (если есть восстанавливающий момент). */
  period: number | null;
  /** Кривые ω(t), φ(t) для графика. */
  curve: { t: number; phi: number; w: number }[];
  /** Вид уравнения для текста. */
  kind: 'const' | 'viscous' | 'quadratic' | 'omega' | 'harmonic' | 'time' | 'general';
}

export function validateEq(e: RotEq, byWeight: boolean): string[] {
  const er: string[] = [];
  if (!(bodyInertia(e.body, byWeight) >= 0)) er.push('Момент инерции тела не может быть отрицательным.');
  if (e.body.kind !== 'J' && !(e.body.m >= 0 && e.body.R >= 0)) er.push('Масса и радиус тела — неотрицательные числа.');
  e.loads.forEach((l, i) => {
    if (!(l.m >= 0 && l.r > 0)) er.push(`Груз ${i + 1}: масса неотрицательна, радиус барабана положителен.`);
  });
  if (e.kv < 0 || e.kq < 0 || e.Mf < 0) er.push('Коэффициенты сопротивления и момент трения не могут быть отрицательными.');
  if (e.ask === 't' && !(e.t > 0)) er.push('Время t — положительное число.');
  return er;
}

export function solveEq(e: RotEq, byWeight: boolean): EqResult {
  const errors = validateEq(e, byWeight);
  const Jbody = bodyInertia(e.body, byWeight);
  const J = Jbody + e.loads.reduce((s, l) => s + massOf(l.m, byWeight) * l.r ** 2, 0);
  const Mconst = e.M0 + e.loads.reduce((s, l) => s + (l.down ? 1 : -1) * (byWeight ? l.m : l.m * G) * l.r, 0);
  const M = (t: number, phi: number, w: number) => Mconst + e.at * t + e.m0 * Math.sin(e.p * t) - e.c * phi - e.Pa * Math.sin(phi) - e.kv * w - e.kq * w * Math.abs(w);
  const restoring = e.c + e.Pa;
  const period = restoring > 0 && J > 0 ? 2 * Math.PI * Math.sqrt(J / restoring) : null;
  const timeDep = e.at !== 0 || (e.m0 !== 0 && e.p !== 0);
  const phiDep = e.c !== 0 || e.Pa !== 0;
  const kind: EqResult['kind'] =
    !timeDep && !phiDep && e.kv === 0 && e.kq === 0
      ? 'const'
      : !timeDep && !phiDep && e.kq === 0
        ? 'viscous'
        : !timeDep && !phiDep && e.kv === 0
          ? 'quadratic'
          : !timeDep && !phiDep
            ? 'omega'
            : !timeDep && e.Pa === 0 && e.kv === 0 && e.kq === 0 && e.Mf === 0
              ? 'harmonic'
              : !phiDep && e.kv === 0 && e.kq === 0 && e.m0 === 0
                ? 'time'
                : 'general';
  const empty: EqResult = { ok: false, errors, J, Jbody, Mconst, M, t: 0, phi: 0, w: 0, eps: 0, note: 'ok', tStop: null, period, curve: [], kind };
  if (errors.length) return empty;
  if (!(J > 0)) return { ...empty, errors: ['Момент инерции системы равен нулю.'] };
  // Правая часть с сухим трением: при ω = 0 тело стоит, если |M| ≤ M_тр.
  // dir — направление трения на весь шаг (знак ω в начале шага): внутри шага правая часть гладкая.
  const acc = (t: number, phi: number, w: number, dir?: number) => {
    const m = M(t, phi, w);
    if (e.Mf === 0) return m / J;
    const d = dir ?? (Math.abs(w) > 1e-12 ? Math.sign(w) : 0);
    if (d !== 0) return (m - e.Mf * d) / J;
    return Math.abs(m) <= e.Mf ? 0 : (m - e.Mf * Math.sign(m)) / J;
  };
  // Масштаб времени для шага.
  const scales = [e.kv > 0 ? J / e.kv : Infinity, restoring > 0 ? Math.sqrt(J / restoring) : Infinity, e.p ? 1 / Math.abs(e.p) : Infinity];
  const tScale = Math.min(...scales);
  const tEnd = e.ask === 't' ? e.t : Infinity;
  // Наибольший шаг: не крупнее 1/400 интервала (для гладкого графика) и доли характерного времени.
  const hMax = Math.min(e.ask === 't' ? e.t / 400 : Infinity, Number.isFinite(tScale) ? tScale / 20 : Infinity);
  let h = Math.min(Number.isFinite(tScale) ? tScale / 200 : 1e-2, e.ask === 't' ? e.t / 400 : Infinity);
  if (!(h > 0)) h = 1e-3;
  let t = 0,
    phi = e.phi0,
    w = e.omega0;
  const curve = [{ t, phi, w }];
  const step = (t0: number, p0: number, w0: number, dt: number): [number, number] => {
    // Направление трения: по ω в начале шага; если тело стоит — по моменту, который его сдвигает.
    const m0 = M(t0, p0, w0);
    const dir = Math.abs(w0) > 1e-12 ? Math.sign(w0) : Math.abs(m0) <= e.Mf ? 0 : Math.sign(m0);
    const a = (tt: number, pp: number, ww: number) => (dir === 0 && Math.abs(w0) <= 1e-12 && e.Mf > 0 ? acc(tt, pp, ww) : acc(tt, pp, ww, dir));
    const k1p = w0,
      k1w = a(t0, p0, w0);
    const k2p = w0 + (dt / 2) * k1w,
      k2w = a(t0 + dt / 2, p0 + (dt / 2) * k1p, w0 + (dt / 2) * k1w);
    const k3p = w0 + (dt / 2) * k2w,
      k3w = a(t0 + dt / 2, p0 + (dt / 2) * k2p, w0 + (dt / 2) * k2w);
    const k4p = w0 + dt * k3w,
      k4w = a(t0 + dt, p0 + dt * k3p, w0 + dt * k3w);
    return [p0 + (dt / 6) * (k1p + 2 * k2p + 2 * k3p + k4p), w0 + (dt / 6) * (k1w + 2 * k2w + 2 * k3w + k4w)];
  };
  const byPhi = e.ask === 'phi';
  const target = byPhi ? (e.phi1 ?? 0) : e.omega1;
  const crossed = (a: number, b: number) => (a - target) * (b - target) <= 0 && a !== b;
  /** Величина, по которой ищем момент: ω или φ. */
  const val = (p: number, ww: number) => (byPhi ? p : ww);
  let tStop: number | null = null;
  let found = e.ask !== 't' && Math.abs(val(phi, w) - target) < 1e-15;
  for (let n = 0; n < 2_000_000 && !found; n++) {
    let dt = Math.min(h, tEnd - t);
    if (dt <= 0) break;
    // Контроль шага: два полушага против одного шага.
    for (let tries = 0; tries < 30; tries++) {
      const [p1, w1] = step(t, phi, w, dt);
      const [pa, wa] = step(t, phi, w, dt / 2);
      const [p2, w2] = step(t + dt / 2, pa, wa, dt / 2);
      const err = Math.max(Math.abs(p2 - p1) / (1 + Math.abs(p2)), Math.abs(w2 - w1) / (1 + Math.abs(w2)));
      // Сухое трение: смена знака ω — останавливаемся точно в нуле (до контроля шага: на изломе он не сходится).
      if (e.Mf > 0 && w !== 0 && ((Math.sign(w2) !== Math.sign(w) && w2 !== 0) || (Math.sign(w1) !== Math.sign(w) && w1 !== 0))) {
        let lo = 0,
          hi = dt;
        for (let it = 0; it < 80; it++) {
          const mid = (lo + hi) / 2;
          const [, wm] = step(t, phi, w, mid);
          if (Math.sign(wm) === Math.sign(w)) lo = mid;
          else hi = mid;
        }
        const [pm] = step(t, phi, w, lo);
        if (byPhi && crossed(phi, pm)) {
          let a = 0,
            bb = lo;
          for (let it = 0; it < 100; it++) {
            const mid = (a + bb) / 2;
            const [pp] = step(t, phi, w, mid);
            if (crossed(phi, pp)) bb = mid;
            else a = mid;
          }
          const [pp, ww] = step(t, phi, w, bb);
          t += bb;
          phi = pp;
          w = ww;
          found = true;
          break;
        }
        if (e.ask === 'omega' && crossed(w, 0)) {
          t += lo;
          phi = pm;
          w = 0;
          found = true;
          break;
        }
        t += lo;
        phi = pm;
        w = 0;
        if (Math.abs(M(t, phi, 0)) <= e.Mf && !timeDep) tStop = t;
        break;
      }
      if (err > 1e-11 && dt > 1e-9) {
        dt /= 2;
        continue;
      }
      if (e.ask !== 't' && crossed(val(phi, w), val(p2, w2))) {
        let lo = 0,
          hi = dt;
        for (let it = 0; it < 100; it++) {
          const mid = (lo + hi) / 2;
          const [pmid, wmid] = step(t, phi, w, mid);
          if (crossed(val(phi, w), val(pmid, wmid))) hi = mid;
          else lo = mid;
        }
        const [pm, wm] = step(t, phi, w, hi);
        t += hi;
        phi = pm;
        w = wm;
        found = true;
        break;
      }
      t += dt;
      phi = p2;
      w = w2;
      if (err < 1e-13) h = Math.min(dt * 2, hMax);
      break;
    }
    if (curve.length < 4000 && (curve.length === 0 || t - curve[curve.length - 1].t > 0)) curve.push({ t, phi, w });
    if (tStop != null) {
      if (e.ask === 't') {
        curve.push({ t: e.t, phi, w: 0 });
        t = e.t;
      }
      break;
    }
    if (e.ask !== 't' && t > 1e7) break;
    // Установившийся режим (момент зависит только от ω): скорость больше не меняется — цель недостижима
    // (для поиска по углу — только если тело при этом стоит).
    if (e.ask !== 't' && !timeDep && !phiDep && Math.abs(acc(t, phi, w)) < 1e-10 * (1 + Math.abs(w)) && (!byPhi || Math.abs(w) < 1e-12)) break;
  }
  if (e.ask !== 't' && !found) return { ...empty, ok: true, errors: [], t, phi, w, eps: acc(t, phi, w), note: tStop != null ? 'stuck' : 'never', tStop, curve };
  curve.push({ t, phi, w });
  // Для вопроса «когда ω = …» кривую строим повторным проходом до найденного момента — с равномерным шагом.
  const fine = e.ask !== 't' && t > 0 && curve.length < 300 ? solveEq({ ...e, ask: 't', t }, byWeight).curve : curve;
  return { ...empty, ok: true, errors: [], t, phi: clean(phi), w: clean(w), eps: clean(acc(t, phi, w)), note: 'ok', tStop, curve: fine };
}

/* ---------- сохранение кинетического момента ---------- */

export interface KResult {
  ok: boolean;
  errors: string[];
  /** Кинетический момент до. */
  K: number;
  /** Сумма моментов инерции после. */
  J2: number;
  /** Слагаемое от относительного движения после: Σ m r₂ u₂. */
  Ku2: number;
  w2: number;
  /** Кинетическая энергия до и после. */
  T1: number;
  T2: number;
  items: { J1: number; J2: number; K1: number; mass: number }[];
}

export function solveK(items: KItem[], byWeight: boolean): KResult {
  const errors: string[] = [];
  if (!items.length) errors.push('Нет ни одного тела.');
  items.forEach((it, i) => {
    if (it.kind === 'body' && !(it.J1 >= 0 && it.J2 >= 0)) errors.push(`Тело ${i + 1}: моменты инерции неотрицательны.`);
    if (it.kind === 'point' && !(it.m >= 0 && it.r1 >= 0 && it.r2 >= 0)) errors.push(`Точка ${i + 1}: масса и радиусы неотрицательны.`);
  });
  const rows = items.map((it) => {
    const mass = it.kind === 'point' ? massOf(it.m, byWeight) : 0;
    const J1 = it.kind === 'point' ? mass * it.r1 ** 2 : it.J1;
    const J2 = it.kind === 'point' ? mass * it.r2 ** 2 : it.J2;
    const K1 = J1 * it.w1 + (it.kind === 'point' ? mass * it.r1 * it.u1 : 0);
    return { J1, J2, K1, mass };
  });
  const K = rows.reduce((s, r) => s + r.K1, 0);
  const J2 = rows.reduce((s, r) => s + r.J2, 0);
  const Ku2 = items.reduce((s, it, i) => s + (it.kind === 'point' ? rows[i].mass * it.r2 * it.u2 : 0), 0);
  if (!errors.length && !(J2 > 0)) errors.push('Момент инерции системы после равен нулю.');
  const ok = !errors.length;
  const w2 = ok ? clean((K - Ku2) / J2) : 0;
  // Кинетическая энергия: тела — Jω²/2, точки — m(ωr + u)²/2.
  const T1 = items.reduce((s, it, i) => s + (it.kind === 'point' ? (rows[i].mass * (it.w1 * it.r1 + it.u1) ** 2) / 2 : (it.J1 * it.w1 ** 2) / 2), 0);
  const T2 = items.reduce((s, it, i) => s + (it.kind === 'point' ? (rows[i].mass * (w2 * it.r2 + it.u2) ** 2) / 2 : (it.J2 * w2 ** 2) / 2), 0);
  return { ok, errors, K: clean(K), J2, Ku2: clean(Ku2), w2, T1, T2, items: rows };
}
