/**
 * Пункт 31: колебания с одной степенью свободы, которые не укладываются в гладкое ẍ = f(x, ẋ) (Мещерский §56):
 *
 *  - жёсткие упоры x = x_н (нижний) и x = x_в (верхний): при ударе ẋ → −e·ẋ (56.3, 56.4, 56.9);
 *  - сухое трение о поверхность, движущуюся со скоростью u (лента 55.20, 56.8; неподвижное основание — u = 0, 56.9):
 *    при скольжении ẍ = f(x, ẋ, t) − H·sign(ẋ − u); тело «прилипает», когда относительная скорость обращается в нуль и
 *    |f(x, u, t)| ≤ H₁ (трение покоя H₁ ≥ H); пока прилипло, ẋ = u, и срывается, когда |f| > H₁;
 *  - вынуждающая сила — t в формуле f.
 * Интегрирование — Рунге — Кутта 4-го порядка с постоянным шагом; удар, прилипание, срыв и экстремумы x уточняются
 * делением шага пополам (повторным шагом от начала).
 * По движению: период — по последним максимумам x, наибольшее и наименьшее x за последний период, время покоя.
 * Точечное преобразование (56.13): сечение ẋ = 0 (максимумы или минимумы x), функция последования x → P(x),
 * неподвижные точки P(x*) = x* и множитель P′(x*) (|P′| < 1 — предельный цикл устойчив).
 * Субгармоники (56.9): периодическое свободное движение с упорами, период которого 2πs/ω, — по нему работа сухого
 * трения за период H·L (L — путь) и наибольшая работа вынуждающей силы F·|∫ẋ e^{iωt} dt|; субгармоника частоты ω/s
 * невозможна, если H·L больше: H > H* = F·|∫ẋ e^{iωt} dt| / L.
 */

export type Acc = (x: number, v: number, t: number) => number;

export interface SimIn {
  f: Acc;
  /** Упоры (null — нет). */
  lo: number | null;
  hi: number | null;
  /** Коэффициент восстановления. */
  e: number;
  /** Сухое трение (ускорения: сила/масса). */
  fric: { u: number; H: number; Hs: number } | null;
  x0: number;
  v0: number;
  tEnd: number;
  steps: number;
  /** Остановить на первом событии этого вида (после t > 0). */
  stopAt?: 'max' | 'min' | 'upx0';
}
export type EvKind = 'max' | 'min' | 'lo' | 'hi' | 'stick' | 'slip';
export interface SimEv {
  k: EvKind;
  t: number;
  x: number;
  v: number;
}
export interface SimOut {
  t: number[];
  x: number[];
  v: number[];
  ev: SimEv[];
  /** Путь ∫|ẋ|dt и комплексный интеграл ∫ẋ·e^{iωt}dt (если задано omega). */
  path: number;
  I: [number, number];
  ended: 'time' | 'event';
}

const sgn = (x: number) => (x > 0 ? 1 : x < 0 ? -1 : 0);

export function simulate(p: SimIn, omega = 0): SimOut {
  const h0 = p.tEnd / p.steps;
  const fr = p.fric;
  let t = 0,
    x = p.x0,
    v = p.v0;
  let stuck = false;
  let dir = fr ? sgn(v - fr.u) : 0;
  if (fr && dir === 0) {
    const a = p.f(x, v, 0);
    if (Math.abs(a) <= fr.Hs) stuck = true;
    else dir = sgn(a);
  }
  const acc = (xx: number, vv: number, tt: number) => (fr ? p.f(xx, vv, tt) - fr.H * dir : p.f(xx, vv, tt));
  /** Шаг длины h из (t, x, v) без событий. */
  const step = (tt: number, xx: number, vv: number, h: number): [number, number] => {
    if (stuck) return [xx + fr!.u * h, fr!.u];
    const k1x = vv,
      k1v = acc(xx, vv, tt);
    const k2x = vv + (h / 2) * k1v,
      k2v = acc(xx + (h / 2) * k1x, vv + (h / 2) * k1v, tt + h / 2);
    const k3x = vv + (h / 2) * k2v,
      k3v = acc(xx + (h / 2) * k2x, vv + (h / 2) * k2v, tt + h / 2);
    const k4x = vv + h * k3v,
      k4v = acc(xx + h * k3x, vv + h * k3v, tt + h);
    return [xx + (h / 6) * (k1x + 2 * k2x + 2 * k3x + k4x), vv + (h / 6) * (k1v + 2 * k2v + 2 * k3v + k4v)];
  };
  /** Первый момент τ ∈ (0, h], где g(шаг τ) меняет знак по сравнению с g(0) (g0 ≠ 0). */
  const locate = (h: number, g: (x: number, v: number, tt: number) => number): number => {
    const g0 = g(x, v, t);
    let a = 0,
      b = h;
    for (let i = 0; i < 60; i++) {
      const m = (a + b) / 2;
      const [xm, vm] = step(t, x, v, m);
      if (sgn(g(xm, vm, t + m)) === sgn(g0) && g(xm, vm, t + m) !== 0) a = m;
      else b = m;
    }
    return b;
  };
  const T: number[] = [t],
    X: number[] = [x],
    Vv: number[] = [v];
  const ev: SimEv[] = [];
  let path = 0;
  const I: [number, number] = [0, 0];
  const every = Math.max(1, Math.round(p.steps / 3000));
  let count = 0;
  let ended: SimOut['ended'] = 'time';
  const accum = (h: number, v1: number, v2: number, t1: number) => {
    path += (h * (Math.abs(v1) + Math.abs(v2))) / 2;
    if (omega) {
      const c1 = Math.cos(omega * t1),
        s1 = Math.sin(omega * t1),
        c2 = Math.cos(omega * (t1 + h)),
        s2 = Math.sin(omega * (t1 + h));
      I[0] += (h * (v1 * c1 + v2 * c2)) / 2;
      I[1] += (h * (v1 * s1 + v2 * s2)) / 2;
    }
  };
  const push = (k: EvKind) => {
    ev.push({ k, t, x, v });
    if (p.stopAt === k) ended = 'event';
  };
  let guard = 0;
  while (t < p.tEnd - 1e-12 && ended === 'time' && guard++ < p.steps * 4 + 1000) {
    const h = Math.min(h0, p.tEnd - t);
    const vPrev = v;
    let [x1, v1] = step(t, x, v, h);
    // Ближайшее событие в шаге.
    type Cand = { tau: number; k: 'lo' | 'hi' | 'rel' | 'free' | 'ext' | 'up' };
    const cands: Cand[] = [];
    if (p.lo != null && x1 < p.lo && x > p.lo - 1e-12) cands.push({ tau: x <= p.lo ? 0 : locate(h, (xx) => xx - p.lo!), k: 'lo' });
    if (p.hi != null && x1 > p.hi && x < p.hi + 1e-12) cands.push({ tau: x >= p.hi ? 0 : locate(h, (xx) => p.hi! - xx), k: 'hi' });
    if (fr && !stuck && (v1 - fr.u) * dir < 0) cands.push({ tau: locate(h, (_xx, vv) => (vv - fr.u) * dir || 1e-300), k: 'rel' });
    if (fr && stuck && Math.abs(p.f(x1, fr.u, t + h)) > fr.Hs) cands.push({ tau: locate(h, (xx, _vv, tt) => fr.Hs - Math.abs(p.f(xx, fr.u, tt))), k: 'free' });
    if (!stuck && v !== 0 && sgn(v1) !== sgn(v) && !(fr && fr.u === 0)) cands.push({ tau: locate(h, (_xx, vv) => vv), k: 'ext' });
    if (p.stopAt === 'upx0' && x < 0 && x1 >= 0 && t > 0) cands.push({ tau: locate(h, (xx) => xx), k: 'up' });
    cands.sort((a, b) => a.tau - b.tau);
    const c = cands[0];
    const tau = c ? Math.max(c.tau, 0) : h;
    if (c) [x1, v1] = tau > 0 ? step(t, x, v, tau) : [x, v];
    accum(tau, v, v1, t);
    t += tau;
    x = x1;
    v = v1;
    if (c) {
      if (c.k === 'lo') {
        x = p.lo!;
        v = -p.e * v;
        push('lo');
        push('min');
        if (fr) dir = sgn(v - fr.u) || dir;
      } else if (c.k === 'hi') {
        x = p.hi!;
        v = -p.e * v;
        push('hi');
        push('max');
        if (fr) dir = sgn(v - fr.u) || dir;
      } else if (c.k === 'rel') {
        const a = p.f(x, fr!.u, t);
        if (fr!.u === 0) push(vPrev > 0 ? 'max' : 'min');
        if (Math.abs(a) <= fr!.Hs) {
          stuck = true;
          v = fr!.u;
          push('stick');
        } else dir = -dir;
      } else if (c.k === 'free') {
        stuck = false;
        dir = sgn(p.f(x, fr!.u, t)) || 1;
        push('slip');
      } else if (c.k === 'ext') {
        // Скорость — со своим новым знаком (не нуль: разрывная по знаку ẋ сила в нуле не определена).
        if (v === 0 || sgn(v) === sgn(vPrev)) v = -sgn(vPrev) * 1e-300;
        const xv = v;
        v = 0;
        push(vPrev > 0 ? 'max' : 'min');
        v = xv;
      } else if (c.k === 'up') {
        ended = 'event';
      }
    }
    if (++count % every === 0 || c) {
      T.push(t);
      X.push(x);
      Vv.push(v);
    }
  }
  T.push(t);
  X.push(x);
  Vv.push(v);
  return { t: T, x: X, v: Vv, ev, path, I, ended };
}

/** Период и размах по последним максимумам (без переходного процесса). */
export function measure(s: SimOut): { T: number; xmax: number; xmin: number; stick: number; impacts: number } | null {
  const mx = s.ev.filter((e) => e.k === 'max');
  if (mx.length < 3) return null;
  const n = Math.min(4, mx.length - 1);
  const last = mx.slice(-n - 1);
  const T = (last[last.length - 1].t - last[0].t) / n;
  const t0 = last[last.length - 2].t,
    t1 = last[last.length - 1].t;
  let xmax = -Infinity,
    xmin = Infinity;
  s.t.forEach((tt, i) => {
    if (tt >= t0 - 1e-12 && tt <= t1 + 1e-12) {
      xmax = Math.max(xmax, s.x[i]);
      xmin = Math.min(xmin, s.x[i]);
    }
  });
  for (const e of s.ev)
    if (e.t >= t0 - 1e-12 && e.t <= t1 + 1e-12) {
      xmax = Math.max(xmax, e.x);
      xmin = Math.min(xmin, e.x);
    }
  // Время покоя за последний период: от прилипания до срыва.
  let stick = 0;
  const inP = s.ev.filter((e) => e.t >= t0 - 1e-9 && e.t <= t1 + 1e-9 && (e.k === 'stick' || e.k === 'slip'));
  let from: number | null = null;
  const before = s.ev.filter((e) => (e.k === 'stick' || e.k === 'slip') && e.t < t0 - 1e-9).pop();
  if (before?.k === 'stick') from = t0;
  for (const e of inP) {
    if (e.k === 'stick') from = e.t;
    else if (from != null) {
      stick += e.t - from;
      from = null;
    }
  }
  if (from != null) stick += t1 - from;
  const impacts = s.ev.filter((e) => (e.k === 'lo' || e.k === 'hi') && e.t > t0 + 1e-12 && e.t <= t1 + 1e-12).length;
  return { T, xmax, xmin, stick, impacts };
}

/** Точечное преобразование на сечении ẋ = 0: от максимума (или минимума) x к следующему. */
export function poincare(f: Acc, side: 'max' | 'min', x0: number, tMax: number, steps: number): number {
  const eps = 1e-9 * Math.max(1, Math.abs(x0));
  const s = simulate({ f, lo: null, hi: null, e: 1, fric: null, x0, v0: side === 'max' ? -eps : eps, tEnd: tMax, steps, stopAt: side }, 0);
  const e = s.ev.find((q) => q.k === side);
  return e ? e.x : NaN;
}

/** Неподвижные точки P(x) = x на отрезке: перебор и деление пополам; множитель P′ — разностью. */
export function fixedPoints(P: (x: number) => number, a: number, b: number, n = 80): { x: number; mult: number }[] {
  const out: { x: number; mult: number }[] = [];
  const g = (x: number) => P(x) - x;
  let xa = a,
    ga = g(a);
  for (let i = 1; i <= n; i++) {
    const xb = a + ((b - a) * i) / n,
      gb = g(xb);
    if (Number.isFinite(ga) && Number.isFinite(gb) && ga * gb <= 0 && !(ga === 0 && i > 1)) {
      let l = xa,
        r = xb,
        gl = ga;
      for (let k = 0; k < 70; k++) {
        const m = (l + r) / 2,
          gm = g(m);
        if (gl * gm <= 0) r = m;
        else {
          l = m;
          gl = gm;
        }
      }
      const x = (l + r) / 2;
      const dx = 1e-5 * Math.max(1, Math.abs(x));
      out.push({ x, mult: (P(x + dx) - P(x - dx)) / (2 * dx) });
    }
    xa = xb;
    ga = gb;
  }
  return out;
}

/**
 * Свободное периодическое движение с упорами, период которого T* (корень по скорости V прохождения x = 0):
 * путь за период и |∫ẋ e^{iωt}dt|. null — такого движения нет на переборе V.
 */
export function freePeriodic(f: Acc, lo: number | null, hi: number | null, Tstar: number, omega: number, Vmax: number) {
  const run = (V: number) => {
    const s = simulate({ f, lo, hi, e: 1, fric: null, x0: 0, v0: V, tEnd: 20 * Tstar, steps: 20000, stopAt: 'upx0' }, omega);
    return s.ended === 'event' ? s : null;
  };
  const per = (V: number) => run(V)?.t.at(-1) ?? NaN;
  const Vs = Array.from({ length: 81 }, (_, i) => Vmax * Math.pow(10, -4 + (4 * i) / 80));
  let prevV = Vs[0],
    prevT = per(prevV);
  for (const V of Vs.slice(1)) {
    const Tv = per(V);
    if (Number.isFinite(prevT) && Number.isFinite(Tv) && (prevT - Tstar) * (Tv - Tstar) <= 0) {
      let a = prevV,
        b = V,
        ga = prevT - Tstar;
      for (let k = 0; k < 60; k++) {
        const m = (a + b) / 2,
          gm = per(m) - Tstar;
        if (ga * gm <= 0) b = m;
        else {
          a = m;
          ga = gm;
        }
      }
      const Vst = (a + b) / 2;
      const s = run(Vst)!;
      return { V: Vst, T: s.t.at(-1)!, path: s.path, I: Math.hypot(s.I[0], s.I[1]), amp: Math.max(...s.x), xmin: Math.min(...s.x), sim: s };
    }
    prevV = V;
    prevT = Tv;
  }
  return null;
}
