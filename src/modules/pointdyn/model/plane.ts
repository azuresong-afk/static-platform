/**
 * Криволинейное движение точки в плоскости xy (Мещерский §27 б): вторая задача динамики.
 *
 * m·r̈ = F: сила тяжести (вдоль −y), постоянная сила (F_x, F_y), сопротивление −k₁v и −k₂|v|·v,
 * сила к центру C: −c·(r − r_C) (c > 0 — притяжение, c < 0 — отталкивание), сила, перпендикулярная скорости,
 * q·(v_y, −v_x) (как сила Лоренца в магнитном поле). Интегрирование — Рунге — Кутта с контролем шага;
 * события (падение на уровень y₁, высшая точка, достижение x₁) уточняются делением отрезка пополам.
 */
export interface PlaneProblem {
  byWeight: boolean;
  m: number;
  g: number;
  gravity: boolean;
  Fx: number;
  Fy: number;
  kv: number;
  kq: number;
  c: number;
  cx: number;
  cy: number;
  q: number;
  x0: number;
  y0: number;
  v0: number;
  /** Угол начальной скорости к оси x, градусы. */
  ang: number;
  ask: 't' | 'land' | 'apex' | 'x';
  t: number;
  y1: number;
  x1: number;
}

type S4 = [number, number, number, number];
export interface PlaneResult {
  ok: boolean;
  errors: string[];
  mass: number;
  /** Найденное состояние. */
  t: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  note: 'ok' | 'never';
  /** Высшая точка (если пройдена). */
  apex: { t: number; x: number; y: number } | null;
  path: { t: number; x: number; y: number }[];
  /** Ускорение (с учётом всех сил) в найденном состоянии. */
  ax: number;
  ay: number;
}

const rad = (a: number) => (a * Math.PI) / 180;

export function solvePlane(pr: PlaneProblem): PlaneResult {
  const errors: string[] = [];
  if (!(pr.m > 0)) errors.push('Масса (вес) точки — положительное число.');
  if (!(pr.g > 0)) errors.push('Ускорение свободного падения g — положительное число.');
  if (pr.kv < 0 || pr.kq < 0) errors.push('Коэффициенты сопротивления не могут быть отрицательными.');
  if (pr.ask === 't' && !(pr.t > 0)) errors.push('Время t — положительное число.');
  const mass = pr.byWeight ? pr.m / (pr.g || 1) : pr.m;
  const empty: PlaneResult = { ok: false, errors, mass, t: 0, x: pr.x0, y: pr.y0, vx: 0, vy: 0, note: 'ok', apex: null, path: [], ax: 0, ay: 0 };
  if (errors.length) return empty;
  const W = pr.gravity ? mass * pr.g : 0;
  const acc = (s: S4): [number, number] => {
    const [x, y, vx, vy] = s;
    const sp = Math.hypot(vx, vy);
    const fx = pr.Fx - pr.kv * vx - pr.kq * sp * vx - pr.c * (x - pr.cx) + pr.q * vy;
    const fy = pr.Fy - W - pr.kv * vy - pr.kq * sp * vy - pr.c * (y - pr.cy) - pr.q * vx;
    return [fx / mass, fy / mass];
  };
  const f = (s: S4): S4 => {
    const [ax, ay] = acc(s);
    return [s[2], s[3], ax, ay];
  };
  const step = (s: S4, h: number): S4 => {
    const k1 = f(s);
    const k2 = f(s.map((v, i) => v + (h / 2) * k1[i]) as S4);
    const k3 = f(s.map((v, i) => v + (h / 2) * k2[i]) as S4);
    const k4 = f(s.map((v, i) => v + h * k3[i]) as S4);
    return s.map((v, i) => v + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i])) as S4;
  };
  let s: S4 = [pr.x0, pr.y0, pr.v0 * Math.cos(rad(pr.ang)), pr.v0 * Math.sin(rad(pr.ang))];
  // Масштаб времени: по скорости и ускорению, по жёсткости центральной силы и вязкости.
  const a0 = Math.hypot(...acc(s));
  const scales = [Math.abs(pr.c) > 0 ? Math.sqrt(mass / Math.abs(pr.c)) : Infinity, pr.kv > 0 ? mass / pr.kv : Infinity, pr.q ? mass / Math.abs(pr.q) : Infinity, a0 > 0 && pr.v0 > 0 ? pr.v0 / a0 : Infinity];
  const tScale = Math.min(...scales);
  const tEnd = pr.ask === 't' ? pr.t : Infinity;
  const tLimit = 1000 * (Number.isFinite(tScale) ? tScale : 1);
  const hMax = Math.min(pr.ask === 't' ? pr.t / 600 : Infinity, Number.isFinite(tScale) ? tScale / 30 : 1);
  let h = Math.min(hMax, Number.isFinite(tScale) ? tScale / 300 : 1e-3);
  let t = 0;
  const path = [{ t, x: s[0], y: s[1] }];
  let apex: PlaneResult['apex'] = null;
  // Функция события: меняет знак в искомый момент.
  const ev = (st: S4): number => (pr.ask === 'land' ? st[1] - pr.y1 : pr.ask === 'apex' ? st[3] : pr.ask === 'x' ? st[0] - pr.x1 : 0);
  const evOk = (a: S4, b: S4) => (pr.ask === 'land' ? b[3] < 0 && ev(a) > 0 && ev(b) <= 0 : pr.ask === 'apex' ? ev(a) > 0 && ev(b) <= 0 : pr.ask === 'x' ? (ev(a) - 0) * ev(b) <= 0 && ev(a) !== ev(b) : false);
  let found = false;
  for (let n = 0; n < 3_000_000; n++) {
    let dt = Math.min(h, tEnd - t);
    if (dt <= 1e-15) break;
    let next: S4 | null = null;
    for (let tries = 0; tries < 40; tries++) {
      const one = step(s, dt);
      const two = step(step(s, dt / 2), dt / 2);
      const err = Math.max(...two.map((v, i) => Math.abs(v - one[i]) / (1 + Math.abs(v))));
      if (err > 1e-11 && dt > 1e-10) {
        dt /= 2;
        continue;
      }
      next = two;
      if (err < 1e-13) h = Math.min(dt * 2, hMax);
      break;
    }
    if (!next) break;
    // Высшая точка: v_y меняет знак с «+» на «−».
    if (!apex && s[3] > 0 && next[3] <= 0) {
      let lo = 0,
        hi = dt;
      for (let it = 0; it < 100; it++) {
        const mid = (lo + hi) / 2;
        if (step(s, mid)[3] > 0) lo = mid;
        else hi = mid;
      }
      const sa = step(s, hi);
      apex = { t: t + hi, x: sa[0], y: sa[1] };
    }
    if (pr.ask !== 't' && evOk(s, next)) {
      let lo = 0,
        hi = dt;
      const sgn = Math.sign(ev(s));
      for (let it = 0; it < 100; it++) {
        const mid = (lo + hi) / 2;
        if (Math.sign(ev(step(s, mid))) === sgn && sgn !== 0) lo = mid;
        else hi = mid;
      }
      s = step(s, hi);
      t += hi;
      found = true;
      path.push({ t, x: s[0], y: s[1] });
      break;
    }
    s = next;
    t += dt;
    if (path.length < 6000) path.push({ t, x: s[0], y: s[1] });
    // Поиск события ограничен разумным временем: тысяча характерных времён задачи.
    if (pr.ask !== 't' && t > tLimit) break;
    if (!s.every(Number.isFinite)) break;
  }
  const [ax, ay] = acc(s);
  if (pr.ask !== 't' && !found) return { ...empty, ok: true, errors: [], t, x: s[0], y: s[1], vx: s[2], vy: s[3], note: 'never', apex, path, ax, ay };
  if (pr.ask === 't') path.push({ t, x: s[0], y: s[1] });
  return { ok: true, errors: [], mass, t, x: s[0], y: s[1], vx: s[2], vy: s[3], note: 'ok', apex, path, ax, ay };
}
