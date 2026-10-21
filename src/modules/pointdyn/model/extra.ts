/**
 * Пункт 24, «Динамика точки»: §27 — сила по зависимости пути от скорости, несколько центров притяжения (в том числе
 * движущихся), постоянная сила, баллистика с табличным законом сопротивления, установившееся движение по наклонной
 * плоскости (Мещерский).
 *
 *  - law     27.39 — x = X(v): F = m·v/X′(v), время dt = X′(v)dv/v;
 *  - ball    27.41 — снаряд при сопротивлении, заданном таблицей a_c(v) (замедление в м/с²): сравнение с пустотой;
 *  - centers 27.59–27.60, 27.65–27.66 — силы k_i·m·(r_i − r), центры движутся равномерно, плюс постоянная сила:
 *            r̈ = −K(r − c(t)), K = Σk_i, c(t) = c₀ + u·t ⇒ r(t) = c₀ + ut + (r₀ − c₀)cos ωt + ((v₀ − u)/ω) sin ωt, ω = √K;
 *  - incline 27.64 — равномерное движение тела по шероховатой плоскости под действием тяжести и горизонтальной нити:
 *            tg α/f = v₁/v, T = f·G·cos α·v₂/v.
 */
import { evalExpr, parseExpr } from '../../../shared/expr';
import { parseNum } from '../../../shared/format';
import { ansB, bisect, bold, eqB, fail, rk4, sample, sg, simpson, stepB, stepEx, type AskDef, type ExtraOut, type ExtraProblem } from '../../../shared/extra';

const G = 9.81;
const pos = (...x: number[]) => x.every((v) => v > 0 && Number.isFinite(v));
const sqrt = Math.sqrt;
const D2R = Math.PI / 180;
const done = (o: Omit<ExtraOut, 'ok' | 'errors'>): ExtraOut => ({ ok: true, errors: [], ...o });

/* ---------- 27.39 ---------- */
const A_LAW: AskDef = {
  id: 'law',
  title: '27.39: сила по зависимости пути от скорости x = X(v)',
  hint: 'Прямолинейное движение; формула пути как функция скорости (переменная v, параметры a и b); найти силу и время изменения скорости.',
  n: { a: 2, b: 1, m: 1, v0: 2, v1: 4 },
  s: { X: 'a*sqrt(v-b)' },
  fields: [
    { k: 'X', label: 'путь x = X(v)', text: true, vars: ['v', 'a', 'b'] },
    { k: 'a', label: 'параметр a', neg: true },
    { k: 'b', label: 'параметр b', neg: true },
    { k: 'm', label: 'масса m (для силы)' },
    { k: 'v0', label: 'начальная скорость v₀, м/с' },
    { k: 'v1', label: 'конечная скорость v₁, м/с (в 27.39 — 2v₀)' },
  ],
  solve: (q, ex) => {
    const { a, b, m, v0, v1 } = q.n;
    if (!pos(m, v0, v1) || v1 === v0) return fail(['m, v₀, v₁ — положительные, v₁ ≠ v₀.']);
    const e = parseExpr(q.s.X, { vars: ['v', 'a', 'b'] });
    if (!e.ok) return fail([`Формула X(v): ${e.error}.`]);
    const X = (v: number) => evalExpr(e.e, 0, { v, a, b });
    const dX = (v: number) => {
      const h = 1e-6 * Math.max(1, Math.abs(v));
      return (X(v + h) - X(v - h)) / (2 * h);
    };
    const lo = Math.min(v0, v1),
      hi = Math.max(v0, v1);
    for (const v of sample((s) => s, lo, hi, 20).map((p) => p[0])) if (!Number.isFinite(X(v)) || !(dX(v) > 0)) return fail([`На промежутке скоростей от ${sg(lo)} до ${sg(hi)} функция X(v) должна быть определена и возрастать (dX/dv > 0): иначе v не может расти вместе с путём.`]);
    const F = (v: number) => (m * v) / dX(v);
    const t = simpson((v) => dX(v) / v, v0, v1, 4000) * (v1 > v0 ? 1 : -1);
    const path = X(v1) - X(v0);
    const steps = [
      stepEx(ex, 'Ускорение через v и x', 'v̇ = v·dv/dx, а dv/dx = 1/(dx/dv): производная пути по скорости обратна производной скорости по пути.', eqB('F = m·v̇ = m·v·(dv/dx) = m·v/X′(v)', `X′(v) = dX/dv (численно) — например, X′(v₀) = ${sg(dX(v0))}, X′(v₁) = ${sg(dX(v1))}`)),
      stepB('Сила', eqB(`F(v₀) = ${sg(F(v0))} Н,  F(v₁) = ${sg(F(v1))} Н`, ...(q.s.X.replace(/\s/g, '') === 'a*sqrt(v-b)' ? ['для x = a√(v − b): X′ = a/(2√(v − b)),  F = 2mv√(v − b)/a'] : []))),
      stepEx(ex, 'Время', 'dt = dx/v = X′(v)dv/v, интегрируем по скорости от v₀ до v₁.', eqB('t = ∫ X′(v)/v dv', ...(q.s.X.replace(/\s/g, '') === 'a*sqrt(v-b)' && b > 0 ? [`для x = a√(v − b), v = b + u²:  t = (a/√b)[arctg√((v₁ − b)/b) − arctg√((v₀ − b)/b)]`] : []), `t = ${sg(t)} с,  пройденный путь ${sg(path)} м`)),
      stepB('Ответ', ansB([[bold(`t = ${sg(t)} с`)], `время изменения скорости от ${sg(v0)} до ${sg(v1)} м/с`], [`F(v) = ${sg(F(v0))} … ${sg(F(v1))} Н`, 'сила в начале и в конце', 'aux'])),
    ];
    return done({ vals: { t, F0: F(v0), F1: F(v1), path }, steps, plot: { xl: 'v, м/с', yl: 'F, Н', series: [{ name: 'F(v)', pts: sample(F, lo, hi, 80) }] } });
  },
};

/* ---------- 27.41 ---------- */
export function parseTable(src: string): [number, number][] | string {
  const rows = src
    .split(/[;\n]/)
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => x.split(':').map((y) => parseNum(y.trim())));
  if (rows.length < 2 || rows.some((r) => r.length !== 2 || !r.every(Number.isFinite))) return 'таблица: пары «скорость:замедление» через «;», не менее двух';
  for (let i = 1; i < rows.length; i++) if (!(rows[i][0] > rows[i - 1][0])) return 'скорости в таблице должны возрастать';
  if (rows.some((r) => r[0] < 0 || r[1] < 0)) return 'скорости и замедления — неотрицательные';
  return rows as [number, number][];
}
export function shell(v0: number, alpha: number, g: number, tab: [number, number][] | null) {
  const drag = (v: number) => {
    if (!tab) return 0;
    if (v <= tab[0][0]) return tab[0][1];
    for (let i = 1; i < tab.length; i++) if (v <= tab[i][0]) return tab[i - 1][1] + ((tab[i][1] - tab[i - 1][1]) * (v - tab[i - 1][0])) / (tab[i][0] - tab[i - 1][0]);
    return tab[tab.length - 1][1];
  };
  const a = alpha * D2R;
  const dt = 0.02;
  const pts: [number, number][] = [[0, 0]];
  let y = [0, 0, v0 * Math.cos(a), v0 * Math.sin(a)];
  let t = 0,
    H = 0;
  while (t < 2000) {
    const f = (_t: number, s: number[]) => {
      const sp = Math.hypot(s[2], s[3]) || 1;
      const k = drag(sp) / sp;
      return [s[2], s[3], -k * s[2], -g - k * s[3]];
    };
    const [, nxt] = rk4(f, y, t, t + dt, 1);
    if (nxt.y[1] < 0) {
      const w = y[1] / (y[1] - nxt.y[1]);
      const xl = y[0] + (nxt.y[0] - y[0]) * w;
      pts.push([xl, 0]);
      return { L: xl, H, T: t + dt * w, pts };
    }
    y = nxt.y;
    t += dt;
    H = Math.max(H, y[1]);
    pts.push([y[0], y[1]]);
  }
  return { L: NaN, H, T: NaN, pts };
}
const A_BALL: AskDef = {
  id: 'ball',
  title: '27.41: снаряд при табличном законе сопротивления воздуха',
  hint: 'Замедление от сопротивления a_c(v) задано таблицей (кусочно-линейная интерполяция), направлено против скорости; сравнение с полётом в пустоте.',
  n: { v0: 700, alpha: 45, g: G },
  s: { tab: '0:0; 100:0,5; 200:2; 300:4,5; 400:8; 500:12,5; 600:18; 700:24,5' },
  fields: [
    { k: 'tab', label: 'таблица «v : a_c» (м/с : м/с²) через «;»', text: true },
    { k: 'v0', label: 'начальная скорость v₀, м/с' },
    { k: 'alpha', label: 'угол к горизонту α, °' },
    { k: 'g', label: 'g, м/с²' },
  ],
  solve: (q, ex) => {
    const { v0, alpha, g } = q.n;
    if (!pos(v0, g) || !(alpha > 0 && alpha < 90)) return fail(['v₀ и g — положительные, 0 < α < 90°.']);
    const tab = parseTable(q.s.tab);
    if (typeof tab === 'string') return fail([tab]);
    const real = shell(v0, alpha, g, tab),
      vac = shell(v0, alpha, g, null);
    if (!Number.isFinite(real.L)) return fail(['Снаряд не вернулся на землю за разумное время — проверьте таблицу.']);
    const Hv = (v0 * Math.sin(alpha * D2R)) ** 2 / (2 * g),
      Lv = (v0 * v0 * Math.sin(2 * alpha * D2R)) / g;
    const steps = [
      stepEx(ex, 'Уравнения движения', 'Сила сопротивления направлена против скорости, замедление a_c(v) берётся из таблицы по модулю скорости.', eqB('ẍ = −a_c(v)·ẋ/v,  ÿ = −g − a_c(v)·ẏ/v', 'v = √(ẋ² + ẏ²)')),
      stepB('В пустоте', eqB(`H = v₀²sin²α/(2g) = ${sg(Hv / 1000)} км,  L = v₀²sin 2α/g = ${sg(Lv / 1000)} км,  T = 2v₀sin α/g = ${sg(vac.T)} с`)),
      stepB('С сопротивлением (Рунге — Кутта, шаг 0,02 с)', eqB(`H = ${sg(real.H / 1000)} км,  L = ${sg(real.L / 1000)} км,  T = ${sg(real.T)} с`)),
      stepB('Ответ', ansB([[bold(`ΔH = ${sg((Hv - real.H) / 1000)} км`)], 'на сколько увеличилась бы высота без сопротивления'], [bold(`ΔL = ${sg((Lv - real.L) / 1000)} км`), 'на сколько увеличилась бы дальность'])),
    ];
    return done({
      vals: { H: real.H, L: real.L, T: real.T, Hvac: Hv, Lvac: Lv, dH: Hv - real.H, dL: Lv - real.L },
      steps,
      plot: { xl: 'x, м', yl: 'y, м', equal: true, series: [{ name: 'с сопротивлением', pts: real.pts.filter((_p, i) => i % 5 === 0 || i === real.pts.length - 1) }, { name: 'в пустоте', pts: vac.pts.filter((_p, i) => i % 5 === 0 || i === vac.pts.length - 1) }] },
    });
  },
};

/* ---------- 27.59–27.60, 27.65–27.66 ---------- */
export interface CentersP {
  nc: number;
  k: number[];
  cx: number[];
  cy: number[];
  wx: number[];
  wy: number[];
  fx: number;
  fy: number;
  x0: number;
  y0: number;
  vx0: number;
  vy0: number;
}
export function centers(p: CentersP) {
  const K = p.k.reduce((s, v) => s + v, 0);
  const c0 = [(p.k.reduce((s, ki, i) => s + ki * p.cx[i], 0) + p.fx) / K, (p.k.reduce((s, ki, i) => s + ki * p.cy[i], 0) + p.fy) / K];
  const u = [p.k.reduce((s, ki, i) => s + ki * p.wx[i], 0) / K, p.k.reduce((s, ki, i) => s + ki * p.wy[i], 0) / K];
  const A = [p.x0 - c0[0], p.y0 - c0[1]];
  const w = sqrt(K);
  const B = [(p.vx0 - u[0]) / w, (p.vy0 - u[1]) / w];
  const pos = (t: number): [number, number] => [c0[0] + u[0] * t + A[0] * Math.cos(w * t) + B[0] * Math.sin(w * t), c0[1] + u[1] * t + A[1] * Math.cos(w * t) + B[1] * Math.sin(w * t)];
  const vel = (t: number): [number, number] => [u[0] - A[0] * w * Math.sin(w * t) + B[0] * w * Math.cos(w * t), u[1] - A[1] * w * Math.sin(w * t) + B[1] * w * Math.cos(w * t)];
  // полуоси эллипса c + A cos θ + B sin θ
  const sxx = A[0] * A[0] + B[0] * B[0],
    syy = A[1] * A[1] + B[1] * B[1],
    sxy = A[0] * A[1] + B[0] * B[1];
  const tr = sxx + syy,
    dt = sqrt(Math.max(0, ((sxx - syy) / 2) ** 2 + sxy * sxy));
  const a = sqrt(Math.max(0, tr / 2 + dt)),
    b = sqrt(Math.max(0, tr / 2 - dt));
  return { K, c0, u, A, B, w, T: (2 * Math.PI) / w, pos, vel, a, b, moving: Math.hypot(u[0], u[1]) > 1e-12 };
}
const CK = (i: number) => String(i);
const A_CENTERS: AskDef = {
  id: 'centers',
  title: '27.59–27.60, 27.65–27.66: притяжение к нескольким центрам и постоянная сила',
  hint: 'Силы k_i·m·(r_i − r) (на единицу массы k_i·(r_i − r)); центры могут двигаться равномерно; добавлена постоянная сила на единицу массы F₀.',
  n: {
    k1: 1,
    x1: 0,
    y1: 0,
    wx1: 0,
    wy1: 0,
    k2: 1,
    x2: 0,
    y2: 0,
    wx2: 0,
    wy2: 0,
    k3: 1,
    x3: 0,
    y3: 0,
    wx3: 0,
    wy3: 0,
    fx: 0,
    fy: 0,
    x0: 1,
    y0: 0,
    vx0: 0,
    vy0: 1,
    px: 0,
    py: 0,
  },
  s: { nc: '1' },
  selects: [
    {
      k: 'nc',
      label: 'Число центров',
      options: [
        ['1', 'один центр'],
        ['2', 'два центра'],
        ['3', 'три центра'],
      ],
    },
  ],
  fields: [
    ...[1, 2, 3].flatMap((i) => [
      { k: `k${i}`, label: `центр ${i}: коэффициент k${i}`, show: (q: ExtraProblem) => +q.s.nc >= i },
      { k: `x${i}`, label: `x${i}`, neg: true, show: (q: ExtraProblem) => +q.s.nc >= i },
      { k: `y${i}`, label: `y${i}`, neg: true, show: (q: ExtraProblem) => +q.s.nc >= i },
      { k: `wx${i}`, label: `скорость центра ${i}: wₓ`, neg: true, show: (q: ExtraProblem) => +q.s.nc >= i },
      { k: `wy${i}`, label: `w_y`, neg: true, show: (q: ExtraProblem) => +q.s.nc >= i },
    ]),
    { k: 'fx', label: 'постоянная сила на единицу массы: F₀ₓ', neg: true },
    { k: 'fy', label: 'F₀_y', neg: true },
    { k: 'x0', label: 'начальная точка x₀', neg: true },
    { k: 'y0', label: 'y₀', neg: true },
    { k: 'vx0', label: 'начальная скорость ẋ₀', neg: true },
    { k: 'vy0', label: 'ẏ₀', neg: true },
    { k: 'px', label: 'точка P для наименьшего расстояния: x', neg: true },
    { k: 'py', label: 'y', neg: true },
  ],
  solve: (q, ex) => {
    const n = q.n;
    const nc = +q.s.nc;
    const ks = [1, 2, 3].slice(0, nc);
    const p: CentersP = {
      nc,
      k: ks.map((i) => n[`k${i}`]),
      cx: ks.map((i) => n[`x${i}`]),
      cy: ks.map((i) => n[`y${i}`]),
      wx: ks.map((i) => n[`wx${i}`]),
      wy: ks.map((i) => n[`wy${i}`]),
      fx: n.fx,
      fy: n.fy,
      x0: n.x0,
      y0: n.y0,
      vx0: n.vx0,
      vy0: n.vy0,
    };
    if (!p.k.every((v) => v > 0 && Number.isFinite(v))) return fail(['Коэффициенты притяжения — положительные числа.']);
    const c = centers(p);
    const per = c.T;
    const Tshow = c.moving ? 3 * per : 2.05 * per;
    // нули y(t) (пересечение оси Ox) и наименьшее расстояние до точки P
    const zy: number[] = [];
    const N = 4000;
    let prev = c.pos(1e-9)[1];
    for (let i = 1; i <= N && zy.length < 4; i++) {
      const t = (Tshow * i) / N;
      const cur = c.pos(t)[1];
      if (prev * cur < 0) zy.push(bisect((s) => c.pos(s)[1], (Tshow * (i - 1)) / N, t));
      prev = cur;
    }
    let tm = 0,
      dm = Infinity;
    for (let i = 0; i <= 20000; i++) {
      const t = (Tshow * i) / 20000;
      const [x, y] = c.pos(t);
      const d = Math.hypot(x - n.px, y - n.py);
      if (d < dm) (dm = d), (tm = t);
    }
    const sm = Math.hypot(...c.vel(tm));
    const steps = [
      stepEx(
        ex,
        'Равнодействующая — сила притяжения к одной точке',
        'Сумма сил, пропорциональных расстояниям, — тоже сила, пропорциональная расстоянию, до «центра сил» c с коэффициентом K = Σkᵢ. Постоянная сила смещает центр на F₀/K; равномерное движение центров — равномерное движение c.',
        eqB('r̈ = −Σkᵢ(r − rᵢ) + F₀ = −K(r − c(t)),  K = Σkᵢ = ' + sg(c.K), `c(t) = (Σkᵢrᵢ(t) + F₀)/K = (${sg(c.c0[0])}; ${sg(c.c0[1])})${c.moving ? ` + (${sg(c.u[0])}; ${sg(c.u[1])})·t` : ''}`),
      ),
      stepB(
        'Решение',
        eqB('ρ = r − c(t):  ρ̈ = −Kρ  (c(t) линейна по t, поэтому c̈ = 0)', `ω = √K = ${sg(c.w)} с⁻¹,  период T = 2π/ω = ${sg(per)} с`, 'r(t) = c(t) + (r₀ − c₀)cos ωt + ((v₀ − u)/ω)·sin ωt', `r₀ − c₀ = (${sg(c.A[0])}; ${sg(c.A[1])}),  (v₀ − u)/ω = (${sg(c.B[0])}; ${sg(c.B[1])})`),
      ),
      stepB(c.moving ? 'Траектория (центры движутся)' : 'Траектория — эллипс', c.moving ? eqB(`точка описывает «волнистую» кривую, смещающуюся со скоростью u; за время ${sg(Tshow)} с`) : eqB(`центр эллипса c = (${sg(c.c0[0])}; ${sg(c.c0[1])}),  полуоси a = ${sg(c.a)}, b = ${sg(c.b)}`)),
      stepB('Моменты пересечения оси Ox и наименьшее расстояние до точки P', eqB(...(zy.length ? zy.map((t, i) => `y = 0 при t${i + 1} = ${sg(t)} с:  x = ${sg(c.pos(t)[0])}`) : ['ось Ox траектория не пересекает за это время']), `до точки P(${sg(n.px)}; ${sg(n.py)}) ближе всего в t = ${sg(tm)} с: расстояние ${sg(dm)}, скорость ${sg(sm)}`)),
      stepB('Ответ', ansB([[bold(c.moving ? `ω = ${sg(c.w)} с⁻¹` : `эллипс с полуосями ${sg(c.a)} и ${sg(c.b)}`)], `центр ${c.moving ? 'смещается' : `(${sg(c.c0[0])}; ${sg(c.c0[1])})`}, период ${sg(per)} с`])),
    ];
    const pts = sample((t) => c.pos(t)[0], 0, Tshow, 240).map(([t, x]) => [x, c.pos(t)[1]] as [number, number]);
    const marks = [
      { x: p.x0, y: p.y0, label: 'A₀' },
      ...ks.map((i, j) => ({ x: p.cx[j], y: p.cy[j], label: `C${CK(i)}` })),
    ];
    return done({
      vals: { K: c.K, w: c.w, T: per, cx: c.c0[0], cy: c.c0[1], a: c.a, b: c.b, t1: zy[0] ?? NaN, x1: zy[0] != null ? c.pos(zy[0])[0] : NaN, t2: zy[1] ?? NaN, x2: zy[1] != null ? c.pos(zy[1])[0] : NaN, dmin: dm, vmin: sm, tmin: tm },
      steps,
      plot: { xl: 'x', yl: 'y', equal: true, series: [{ name: 'траектория', pts }], marks },
    });
  },
};

/* ---------- 27.64 ---------- */
const A_INCLINE: AskDef = {
  id: 'incline',
  title: '27.64: равномерное движение по шероховатой плоскости и горизонтальная нить',
  hint: 'Тело весом G тянут нитью горизонтально вдоль AB; v₂ — составляющая скорости вдоль AB, v₁ — вдоль линии наибольшего ската.',
  n: { tga: 1 / 30, f: 0.1, G: 300, v2: 12 },
  fields: [
    { k: 'tga', label: 'tg α (уклон плоскости)' },
    { k: 'f', label: 'коэффициент трения f' },
    { k: 'G', label: 'вес тела G' },
    { k: 'v2', label: 'составляющая v₂ вдоль AB' },
  ],
  solve: (q, ex) => {
    const { tga, f, G: W, v2 } = q.n;
    if (!pos(tga, f, W, v2)) return fail(['Все данные — положительные числа.']);
    const r = tga / f;
    if (r >= 1) return fail(['Равномерное движение невозможно: tg α ≥ f — тело скользит вниз ускоренно.']);
    const c = 1 / sqrt(1 + tga * tga);
    const F = f * W * c;
    const v1 = (v2 * r) / sqrt(1 - r * r),
      T = F * sqrt(1 - r * r),
      v = v2 / sqrt(1 - r * r);
    const steps = [
      stepEx(ex, 'Условие равномерного движения', 'Сила трения F = fG cos α направлена против скорости v. Её составляющие вдоль скорости v₁ (вниз по скату) и v₂ (вдоль AB) уравновешивают соответственно составляющую тяжести G sin α и натяжение нити T.', eqB(`G sin α = F·v₁/v,  T = F·v₂/v,  v₁² + v₂² = v²`, `F = fG cos α = ${sg(F)}`)),
      stepB('Составляющие скорости', eqB(`v₁/v = tg α/f = ${sg(r)},  v₂/v = √(1 − (tg α/f)²) = ${sg(sqrt(1 - r * r))}`, `v = ${sg(v)},  v₁ = ${sg(v1)}`)),
      stepB('Натяжение нити', eqB(`T = fG cos α·√(1 − (tg α/f)²) = ${sg(T)}`)),
      stepB('Ответ', ansB([[bold(`v₁ = ${sg(v1)}`)], 'составляющая скорости вдоль линии наибольшего ската (в тех же единицах, что и v₂)'], [bold(`T = ${sg(T)}`), 'натяжение нити (в единицах веса)'])),
    ];
    return done({ vals: { v1, T, v }, steps });
  },
};

export const POINT_EXTRA_ASKS: AskDef[] = [A_LAW, A_CENTERS, A_INCLINE, A_BALL];
