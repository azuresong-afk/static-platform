/**
 * Пункт 24, «Переменная масса»: §45 — уравнение Мещерского в общем виде, обратные и оптимизационные задачи, ротор,
 * притяжение к центру переменной массы (Мещерский).
 *
 *  - pend   45.1  — маятник переменной массы (отделение с нулевой относительной скоростью): φ̈ + β/(m(t)l)·φ̇ + (g/l)sin φ = 0;
 *  - rocket 45.2  — вертикальный подъём по закону сгорания m = m₀f(t): ẍ = −g − (ḟ/f)v_e − R(x, ẋ)/(m₀f);
 *  - aero   45.29–45.30 — аэростат поднимает канат со склада: (Q + γx)ẍ/g + γẋ²/g = P − Q − γx − βẋ²;
 *  - height 45.5–45.7 — высота подъёма при m = m₀e^(−αt): H = αv_e(αv_e − g)t₀²/(2g), оптимальное α, перегрузка k;
 *  - moon   45.8  — время сгорания до заданной скорости: v = v_e ln z − g·t;
 *  - work   45.19–45.20 — работа силы тяги A = m₁v_e²(z − 1 − ln z), к.п.д. η = ln²z/(z − 1), наибольший при ln z = 2(z − 1)/z (z = 4,92);
 *  - soft   45.25 — мягкая посадка: v dv = (αv_e − gR²/(R + x)²)dx ⇒ α = v₀²/(2v_eH) + gR/(v_e(R + H));
 *  - slope  45.27 — подъём вдоль наклонной прямой с ускорением w: z = exp(|Φ|·t/(v_e m)), t = √(2H/(w sin α));
 *  - rotor  45.36–45.37 — реактивный запуск ротора: J(t)·ω̇ = qv_eR − M (или − bω), J = J_p + m₀r² − qr²t;
 *  - center 45.35 — притяжение к центру массы M₀/(1 + αt): ξ = x/(1 + αt), τ = t/(1 + αt) — обычная задача Кеплера.
 */
import { diff, evalExpr, parseExpr } from '../../../shared/expr';
import { ansB, bisect, bold, eqB, fail, rk4, sample, sg, stepB, stepEx, type AskDef, type ExtraOut } from '../../../shared/extra';

const pos = (...x: number[]) => x.every((v) => v > 0 && Number.isFinite(v));
const nn = (...x: number[]) => x.every((v) => v >= 0 && Number.isFinite(v));
const sqrt = Math.sqrt;
const D2R = Math.PI / 180;
const done = (o: Omit<ExtraOut, 'ok' | 'errors'>): ExtraOut => ({ ok: true, errors: [], ...o });

/* ---------- 45.1 ---------- */
export function pendulum(mLaw: string, g: number, l: number, beta: number, phi0: number, w0: number, T: number) {
  const pe = parseExpr(mLaw);
  if (!pe.ok) return { error: `Закон массы m(t): ${pe.error}.` };
  const m = (t: number) => evalExpr(pe.e, t);
  if (!(m(0) > 0) || !(m(T) > 0)) return { error: 'Масса m(t) должна быть положительной на всём промежутке.' };
  const r = rk4((t, y) => [y[1], -((beta / (m(t) * l)) * y[1]) - (g / l) * Math.sin(y[0])], [phi0, w0], 0, T, 4000);
  return { m, r };
}
const A_PEND: AskDef = {
  id: 'pend',
  title: '45.1: маятник переменной массы в среде с сопротивлением',
  hint: 'Частицы отделяются с нулевой относительной скоростью, поэтому реактивной силы нет: меняется только отношение сопротивления к массе.',
  n: { g: 9.81, l: 1, beta: 0.2, phi0: 30, w0: 0, T: 10 },
  s: { m: '2 - 0,1t' },
  fields: [
    { k: 'm', label: 'закон массы m(t), кг', text: true, vars: [] },
    { k: 'g', label: 'g, м/с²' },
    { k: 'l', label: 'длина нити l, м' },
    { k: 'beta', label: 'сопротивление R = −β·φ̇: β, Н·с' },
    { k: 'phi0', label: 'начальный угол φ₀, °', neg: true },
    { k: 'w0', label: 'начальная ω₀, рад/с', neg: true },
    { k: 'T', label: 'время расчёта T, с' },
  ],
  solve: (q, ex) => {
    const { g, l, beta, phi0, w0, T } = q.n;
    if (!pos(g, l, T) || !nn(beta)) return fail(['g, l, T — положительные, β ≥ 0.']);
    const c = pendulum(q.s.m, g, l, beta, phi0 * D2R, w0, T);
    if ('error' in c) return fail([c.error!]);
    const { m, r } = c;
    const end = r[r.length - 1];
    const steps = [
      stepEx(
        ex,
        'Уравнение Мещерского',
        'При отделении частиц с нулевой относительной скоростью реактивная сила равна нулю, и уравнение движения имеет обычный вид — масса стоит в левой части и зависит от времени. Моменты относительно оси подвеса: сопротивление R·l = β·φ̇·l.',
        eqB('d(m·l²·φ̇)/dt − ṁ l² φ̇ = −m g l sin φ − β l φ̇   (частицы уносят момент m·l²·φ̇ — он учтён в −ṁl²φ̇)', 'm l² φ̈ = −m g l sin φ − β l φ̇'),
      ),
      stepB('Дифференциальное уравнение', eqB('φ̈ + β/(m(t)·l)·φ̇ + (g/l)·sin φ = 0', `при t = 0: β/(ml) = ${sg(beta / (m(0) * l))} с⁻¹;  при t = T: ${sg(beta / (m(T) * l))} с⁻¹`)),
      stepB('Численное решение (Рунге — Кутта)', eqB(`φ(T) = ${sg((end.y[0] * 180) / Math.PI)}°,  φ̇(T) = ${sg(end.y[1])} рад/с`, `для малых колебаний и m = const: период 2π√(l/g) = ${sg(2 * Math.PI * sqrt(l / g))} с`)),
      stepB('Ответ', ansB([[bold('φ̈ + β/(m(t)l)·φ̇ + (g/l)·sin φ = 0')], 'уравнение движения маятника переменной массы'])),
    ];
    return done({ vals: { phiEnd: (end.y[0] * 180) / Math.PI, k0: beta / (m(0) * l) }, steps, plot: { xl: 't, с', yl: 'φ, °', series: [{ name: 'φ(t)', pts: r.filter((_p, i) => i % 20 === 0).map((p) => [p.t, (p.y[0] * 180) / Math.PI] as [number, number]) }] } });
  },
};

/* ---------- 45.2 ---------- */
export function rocketLaw(fLaw: string, Rlaw: string, ve: number, g: number, m0: number, x0: number, v0: number, T: number) {
  const fe = parseExpr(fLaw);
  if (!fe.ok) return { error: `Закон сгорания f(t): ${fe.error}.` };
  const Re = parseExpr(Rlaw, { vars: ['x', 'v'] });
  if (!Re.ok) return { error: `Сопротивление R(x, v): ${Re.error}.` };
  const df = diff(fe.e);
  const f = (t: number) => evalExpr(fe.e, t),
    fd = (t: number) => evalExpr(df, t);
  if (!(f(0) > 0) || !(f(T) > 0)) return { error: 'Закон f(t) должен быть положительным на промежутке (ракета не должна терять всю массу).' };
  const r = rk4((t, y) => [y[1], -g - (fd(t) / f(t)) * ve - evalExpr(Re.e, t, { x: y[0], v: y[1] }) / (m0 * f(t))], [x0, v0], 0, T, 4000);
  return { f, fd, r };
}
const A_ROCKET: AskDef = {
  id: 'rocket',
  title: '45.2: уравнение восходящего движения ракеты по закону сгорания',
  hint: 'Масса m = m₀·f(t), скорость истечения v_e постоянна; сила сопротивления R(x, v) — формула от x и v (v — скорость ẋ).',
  n: { ve: 2000, g: 9.81, m0: 1000, x0: 0, v0: 0, T: 30 },
  s: { f: '1 - t/100', R: '0' },
  fields: [
    { k: 'f', label: 'закон сгорания f(t), m = m₀f(t)', text: true, vars: [] },
    { k: 'R', label: 'сопротивление R(x, v), Н', text: true, vars: ['x', 'v'] },
    { k: 've', label: 'скорость истечения v_e, м/с' },
    { k: 'g', label: 'g, м/с²' },
    { k: 'm0', label: 'начальная масса m₀, кг' },
    { k: 'x0', label: 'начальная высота x₀, м', neg: true },
    { k: 'v0', label: 'начальная скорость v₀, м/с', neg: true },
    { k: 'T', label: 'время T, с' },
  ],
  solve: (q, ex) => {
    const { ve, g, m0, x0, v0, T } = q.n;
    if (!pos(ve, g, m0, T)) return fail(['v_e, g, m₀, T — положительные числа.']);
    const c = rocketLaw(q.s.f, q.s.R, ve, g, m0, x0, v0, T);
    if ('error' in c) return fail([c.error!]);
    const e = c.r[c.r.length - 1];
    const steps = [
      stepEx(ex, 'Уравнение Мещерского', 'Реактивная сила Φ = −ṁ·v_e направлена вверх (газ вылетает вниз со скоростью v_e относительно ракеты); ṁ = m₀ḟ.', eqB('m·ẍ = −m g + Φ − R(x, ẋ),  Φ = −ṁ v_e = −m₀ ḟ(t) v_e', 'm = m₀ f(t)')),
      stepB('Дифференциальное уравнение', eqB('ẍ = −g − [ḟ(t)/f(t)]·v_e − R(x, ẋ)/(m₀ f(t))', `при t = T: ḟ/f = ${sg(c.fd(T) / c.f(T))} с⁻¹, тяга на единицу массы −(ḟ/f)v_e = ${sg((-c.fd(T) / c.f(T)) * ve)} м/с²`)),
      stepB('Интегрирование (Рунге — Кутта)', eqB(`t = ${sg(T)} с:  x = ${sg(e.y[0])} м,  ẋ = ${sg(e.y[1])} м/с`)),
      stepB('Ответ', ansB([[bold('ẍ = −g − (ḟ/f)·v_e − R(x, ẋ)/(m₀f)')], 'дифференциальное уравнение движения'], [`x(${sg(T)} с) = ${sg(e.y[0])} м`, 'численное решение для заданных данных', 'aux'])),
    ];
    return done({ vals: { x: e.y[0], v: e.y[1] }, steps, plot: { xl: 't, с', yl: 'x, м', series: [{ name: 'x(t)', pts: c.r.filter((_p, i) => i % 40 === 0).map((p) => [p.t, p.y[0]] as [number, number]) }] } });
  },
};

/* ---------- 45.29–45.30 ---------- */
export function aeroV2(Q: number, P: number, gam: number, beta: number, g: number, H0: number, x: number) {
  const u = (Q + gam * H0) / (Q + gam * x);
  const e1 = 2 * (1 + (beta * g) / gam),
    e2 = 3 + (2 * beta * g) / gam;
  return ((P * g) / (beta * g + gam)) * (1 - Math.pow(u, e1)) - ((2 * g) / (2 * beta * g + 3 * gam)) * (1 - Math.pow(u, e2)) * (Q + gam * x);
}
const A_AERO: AskDef = {
  id: 'aero',
  title: '45.29–45.30: аэростат поднимает сложенный на земле канат',
  hint: 'Вес аэростата Q, подъёмная сила P, вес метра каната γ, сопротивление R = −β·ẋ²; x — высота (длина поднятого каната).',
  n: { Q: 1000, P: 1500, gam: 5, beta: 0.01, g: 9.81, H0: 0, x: 50 },
  fields: [
    { k: 'Q', label: 'вес аэростата Q, Н' },
    { k: 'P', label: 'подъёмная сила P, Н' },
    { k: 'gam', label: 'вес метра каната γ, Н/м' },
    { k: 'beta', label: 'коэффициент сопротивления β, Н·с²/м²' },
    { k: 'g', label: 'g, м/с²' },
    { k: 'H0', label: 'начальная высота H₀ (аэростат неподвижен), м' },
    { k: 'x', label: 'высота x для скорости, м' },
  ],
  solve: (q, ex) => {
    const { Q, P, gam, beta, g, H0, x } = q.n;
    if (!pos(Q, P, gam, beta, g) || !nn(H0, x) || x < H0) return fail(['Q, P, γ, β, g — положительные; 0 ≤ H₀ ≤ x.']);
    if (P <= Q + gam * H0) return fail(['Подъёмная сила не больше веса аэростата с поднятой частью каната: P ≤ Q + γH₀ — подъёма нет.']);
    const v2 = aeroV2(Q, P, gam, beta, g, H0, x);
    if (v2 < 0) return fail(['Аэростат не поднимется на такую высоту (v² < 0): подъём прекращается раньше.']);
    const a0 = -g + (P * g) / (Q + gam * H0);
    const steps = [
      stepEx(
        ex,
        'Уравнение Мещерского',
        'Канат со склада присоединяется к аэростату с нулевой скоростью: на поднятый груз действует «реактивная» сила −ẋ·dm/dt, m = (Q + γx)/g, dm/dt = γẋ/g.',
        eqB('d[(Q + γx)ẋ/g]/dt = P − Q − γx − βẋ²', '(Q + γx)ẍ/g + γẋ²/g = P − Q − γx − βẋ²'),
      ),
      stepB('Дифференциальное уравнение', eqB('ẍ = −g + Pg/(Q + γx) − [(βg + γ)/(Q + γx)]·ẋ²', `начальное ускорение (H₀ = ${sg(H0)}): ${sg(a0)} м/с²`)),
      stepEx(
        ex,
        'Скорость подъёма',
        'Замена ẋ² = z(x), dz/dx = 2ẍ превращает уравнение в линейное; ответ — по ходу интегрирования от высоты H₀ (v = 0).',
        eqB('ẋ² = Pg/(βg + γ)·[1 − u^(2(1 + βg/γ))] − 2g/(2βg + 3γ)·[1 − u^(3 + 2βg/γ)]·(Q + γx),  u = (Q + γH₀)/(Q + γx)', `x = ${sg(x)} м:  ẋ² = ${sg(v2)},  ẋ = ${sg(sqrt(v2))} м/с`),
      ),
      stepB('Ответ', ansB([[bold(`ẋ = ${sg(sqrt(v2))} м/с`)], `скорость на высоте x = ${sg(x)} м`])),
    ];
    return done({ vals: { v: sqrt(v2), a0 }, steps, plot: { xl: 'x, м', yl: 'ẋ, м/с', series: [{ name: 'ẋ(x)', pts: sample((s) => sqrt(Math.max(0, aeroV2(Q, P, gam, beta, g, H0, s))), H0, Math.max(x * 1.4, H0 + 1), 100) }], marks: [{ x, y: sqrt(v2), label: sg(sqrt(v2), 3) }] } });
  },
};

/* ---------- 45.5–45.7 ---------- */
const A_HEIGHT: AskDef = {
  id: 'height',
  title: '45.5–45.7: высота подъёма ракеты, оптимальное α и перегрузка',
  hint: 'Масса m = m₀e^(−αt) до t₀ (весь заряд сгорел), затем свободный полёт вверх; без сопротивления, g постоянно.',
  n: { ve: 2000, g: 9.81, alpha: 0.05, t0: 20, mu: 2, k: 3 },
  s: { by: 'alpha' },
  selects: [
    {
      k: 'by',
      label: 'Задано',
      options: [
        ['alpha', 'α и время сгорания t₀ (45.5)'],
        ['overload', 'запас μ = ln(m₀/m₁) и перегрузка k = αv_e/g (45.6–45.7)'],
      ],
    },
  ],
  fields: [
    { k: 've', label: 'скорость истечения v_e, м/с' },
    { k: 'g', label: 'g, м/с²' },
    { k: 'alpha', label: 'α, 1/с', show: (q) => q.s.by === 'alpha' },
    { k: 't0', label: 'время сгорания t₀, с', show: (q) => q.s.by === 'alpha' },
    { k: 'mu', label: 'μ = at₀ = ln(m₀/m₁)', show: (q) => q.s.by === 'overload' },
    { k: 'k', label: 'коэффициент перегрузки k = αv_e/g (> 1)', show: (q) => q.s.by === 'overload' },
  ],
  solve: (q, ex) => {
    const { ve, g } = q.n;
    const by = q.s.by;
    const alpha = by === 'alpha' ? q.n.alpha : (q.n.k * g) / ve;
    const t0 = by === 'alpha' ? q.n.t0 : q.n.mu / alpha;
    const mu = alpha * t0;
    if (!pos(ve, g, alpha, t0)) return fail(['Все данные — положительные числа.']);
    if (alpha * ve <= g) return fail(['Ракета не стартует: αv_e ≤ g (перегрузка k ≤ 1).']);
    const Hburn = ((alpha * ve - g) * t0 * t0) / 2,
      vb = (alpha * ve - g) * t0;
    const H = (alpha * ve * (alpha * ve - g) * t0 * t0) / (2 * g);
    const Hmax = (mu * mu * ve * ve) / (2 * g);
    const kk = (alpha * ve) / g;
    const steps = [
      stepEx(
        ex,
        'Активный участок',
        'При m = m₀e^(−αt): ṁ/m = −α, поэтому тяга на единицу массы αv_e постоянна, и ускорение постоянно.',
        eqB('ẍ = αv_e − g,  v(t₀) = (αv_e − g)t₀ = ' + sg(vb) + ' м/с', `высота в конце горения (αv_e − g)t₀²/2 = ${sg(Hburn)} м`),
      ),
      stepB('Полёт после выгорания', eqB(`h = v²/(2g) = ${sg((vb * vb) / (2 * g))} м`, `H = αv_e(αv_e − g)t₀²/(2g) = ${sg(H)} м`)),
      stepEx(
        ex,
        'Наибольшая возможная высота',
        'Запас топлива μ = αt₀ = ln(m₀/m₁) задан и постоянен; тогда t₀ = μ/α и H(α) = (μv_e)²(αv_e − g)/(2gαv_e) растёт с α и стремится к пределу при α → ∞ (мгновенное сгорание).',
        eqB('H_max = μ²v_e²/(2g) = ' + sg(Hmax) + ' м', `перегрузка k = αv_e/g = ${sg(kk)}:  H = H_max·(k − 1)/k = ${sg(Hmax * (kk - 1) / kk)} м`),
      ),
      stepB('Ответ', ansB([[bold(`H = ${sg(H)} м`)], 'высота подъёма'], [`H_max = ${sg(Hmax)} м, α = ∞`, 'наибольшая возможная высота при том же запасе топлива', 'aux'], [`H/H_max = (k − 1)/k = ${sg((kk - 1) / kk)}`, '45.7', 'aux'])),
    ];
    const Hk = (k: number) => Hmax * ((k - 1) / k);
    return done({ vals: { H, Hmax, ratio: H / Hmax }, steps, plot: { xl: 'k = αv_e/g', yl: 'H/H_max', series: [{ name: '(k − 1)/k', pts: sample((k) => Hk(k) / Hmax, 1, Math.max(8, kk * 1.5), 100) }], marks: [{ x: kk, y: H / Hmax, label: sg(H / Hmax, 3) }] } });
  },
};

/* ---------- 45.8 ---------- */
const A_MOON: AskDef = {
  id: 'moon',
  title: '45.8: время сгорания топлива до заданной скорости (старт с Луны)',
  hint: 'Вертикальный старт, постоянное g, сопротивления нет: v = v_e·ln z − g·t.',
  n: { ve: 2000, z: 5, g: 1.62, v: 3000 },
  fields: [
    { k: 've', label: 'скорость истечения v_e, м/с' },
    { k: 'z', label: 'число Циолковского z = m₀/m₁' },
    { k: 'g', label: 'g, м/с²' },
    { k: 'v', label: 'нужная скорость v, м/с' },
  ],
  solve: (q, ex) => {
    const { ve, z, g, v } = q.n;
    if (!pos(ve, g, v) || !(z > 1)) return fail(['v_e, g, v — положительные, z > 1.']);
    const vi = ve * Math.log(z);
    const t = (vi - v) / g;
    if (t < 0) return fail([`Скорость ${sg(v)} м/с недостижима: идеальная скорость v_e ln z = ${sg(vi)} м/с меньше.`]);
    const steps = [
      stepEx(ex, 'Формула Циолковского с тяжестью', 'Ускорение ракеты ẍ = v_e·|ṁ|/m − g; интеграл от v_e|ṁ|/m — это v_e ln(m₀/m). За время горания t: v = v_e ln z − g t.', eqB(`v_e·ln z = ${sg(ve)}·ln ${sg(z)} = ${sg(vi)} м/с`, `t = (v_e ln z − v)/g = (${sg(vi)} − ${sg(v)})/${sg(g)} = ${sg(t)} с`)),
      stepB('Ответ', ansB([[bold(`t = ${sg(t)} с ≈ ${Math.floor(t / 60)} мин ${sg(t - 60 * Math.floor(t / 60), 3)} с`)], 'время сгорания топлива'])),
    ];
    return done({ vals: { t }, steps });
  },
};

/* ---------- 45.19–45.20 ---------- */
/** К.п.д. = кинетическая энергия ракеты ½m₁v² к энергии струи ½(m₀ − m₁)v_e² (энергия топлива в системе ракеты). */
export const effic = (z: number) => Math.log(z) ** 2 / (z - 1);
/** Наибольший к.п.д.: ln z = 2(z − 1)/z. */
export const zOpt = () => bisect((z) => Math.log(z) - (2 * (z - 1)) / z, 2, 20);
const A_WORK: AskDef = {
  id: 'work',
  title: '45.19–45.20: работа силы тяги и механический к.п.д. ракеты',
  hint: 'Вне поля тяготения и атмосферы: v = v_e ln z, работа тяги A = ∫v_e·|ṁ|·v dt; к.п.д. — кинетическая энергия ракеты к энергии струи.',
  n: { ve: 2400, z: 4, m1: 100 },
  fields: [
    { k: 've', label: 'скорость истечения v_e, м/с' },
    { k: 'z', label: 'число Циолковского z = m₀/m₁' },
    { k: 'm1', label: 'конечная масса m₁, кг' },
  ],
  solve: (q, ex) => {
    const { ve, z, m1 } = q.n;
    if (!pos(ve, m1) || !(z > 1)) return fail(['v_e и m₁ — положительные, z > 1.']);
    const A = m1 * ve * ve * (z - 1 - Math.log(z));
    const T = 0.5 * m1 * (ve * Math.log(z)) ** 2;
    const Ej = 0.5 * m1 * (z - 1) * ve * ve;
    const eta = effic(z);
    const zo = zOpt();
    const steps = [
      stepEx(ex, 'Работа силы тяги', 'Мощность тяги Φ·v = v_e·|ṁ|·v, v = v_e ln(m₀/m); интегрируем по массе от m₁ до m₀.', eqB('A = ∫v_e·v·dm = v_e²∫₍m₁₎^₍m₀₎ ln(m₀/m)dm = v_e²[m₀ − m₁ − m₁ ln z]', `A = m₁v_e²(z − 1 − ln z) = ${sg(A)} Дж`)),
      stepEx(
        ex,
        'К.п.д.',
        'Затраченная энергия — энергия струи: каждая порция dm вылетает со скоростью v_e относительно ракеты, ½v_e²dm; всего ½(m₀ − m₁)v_e². Полезная — кинетическая энергия ракеты после выгорания.',
        eqB(`T₁ = ½m₁v² = ½m₁v_e²ln²z = ${sg(T)} Дж,   E = ½(m₀ − m₁)v_e² = ${sg(Ej)} Дж`, `η = T₁/E = ln²z/(z − 1) = ${sg(eta)}`),
      ),
      stepEx(ex, 'Наибольший к.п.д.', 'dη/dz = 0 даёт 2(z − 1) = z·ln z, то есть ln z = 2(z − 1)/z; у уравнения один корень z > 1.', eqB(`z* = ${sg(zo)},  η_max = ${sg(effic(zo))},  v = v_e ln z* = ${sg(Math.log(zo))}·v_e`)),
      stepB('Ответ', ansB([[bold(`A = ${sg(A)} Дж`)], 'работа силы тяги (книга печатает A = m₁v_e²[ln z − (z − 1)] — тот же модуль, знак обратный)'], [bold(`z* = ${sg(zo)}`), 'число Циолковского, при котором к.п.д. наибольший'], [`η(z) = ${sg(eta)}, η_max = ${sg(effic(zo))}`, 'к.п.д. и его наибольшее значение', 'aux'])),
    ];
    return done({ vals: { A, eta, zOpt: zo, etaMax: effic(zo) }, steps, plot: { xl: 'z', yl: 'η', series: [{ name: 'η(z) = ln²z/(z − 1)', pts: sample(effic, 1.05, 14, 120) }], marks: [{ x: zo, y: effic(zo), label: `z* = ${sg(zo, 3)}` }] } });
  },
};

/* ---------- 45.25 ---------- */
export function softLanding(H: number, v0: number, ve: number, g: number, R: number) {
  const alpha = (v0 * v0) / (2 * ve * H) + (g * R) / (ve * (R + H));
  const r = rk4((_t, y) => [y[1], -((g * R * R) / ((R + y[0]) ** 2)) + alpha * ve], [H, -v0], 0, 1, 1);
  return { alpha, r };
}
const A_SOFT: AskDef = {
  id: 'soft',
  title: '45.25: мягкая посадка на Луну с торможением ракетой',
  hint: 'Корабль на высоте H со скоростью v₀ к центру; m = m₀e^(−αt), тяготение ∝ 1/(R + x)², v_e постоянна.',
  n: { H: 100000, v0: 2000, ve: 3000, g: 1.62, R: 1737000 },
  fields: [
    { k: 'H', label: 'высота H, м' },
    { k: 'v0', label: 'скорость v₀ (к центру), м/с' },
    { k: 've', label: 'скорость истечения v_e, м/с' },
    { k: 'g', label: 'g на поверхности, м/с²' },
    { k: 'R', label: 'радиус Луны R, м' },
  ],
  solve: (q, ex) => {
    const { H, v0, ve, g, R } = q.n;
    if (!pos(H, ve, g, R) || !nn(v0)) return fail(['H, v_e, g, R — положительные, v₀ ≥ 0.']);
    const { alpha } = softLanding(H, v0, ve, g, R);
    // длительность торможения и конечная масса — интегрированием x″ = αv_e − gR²/(R + x)²
    const T = 5 * (H / Math.max(v0, 1)) * 2;
    const run = rk4((_t, y) => [y[1], -((g * R * R) / ((R + y[0]) ** 2)) + alpha * ve], [H, -v0], 0, T, 20000);
    const i = run.findIndex((p) => p.y[0] <= 0 || p.y[1] >= 0);
    const tL = i > 0 ? run[i].t : NaN;
    const steps = [
      stepEx(ex, 'Ускорение зависит только от высоты', 'Масса m = m₀e^(−αt) даёт постоянную тягу на единицу массы αv_e; тяготение зависит от x. Поэтому ẍ = f(x) и можно писать v·dv = f(x)dx — без времени.', eqB('ẍ = αv_e − gR²/(R + x)²', 'v dv = [αv_e − gR²/(R + x)²]dx')),
      stepB('Условие мягкой посадки', eqB(`x = H, v = −v₀  →  x = 0, v = 0:   ½v₀² = αv_e·H − gR·H/(R + H)`, `α = v₀²/(2v_eH) + gR/(v_e(R + H)) = ${sg(alpha)} с⁻¹`)),
      stepB('Проверка интегрированием', eqB(Number.isFinite(tL) ? `время торможения ≈ ${sg(tL)} с,  m/m₀ = e^(−αt) = ${sg(Math.exp(-alpha * tL))}` : 'торможение не закончилось за расчётное время')),
      stepB('Ответ', ansB([[bold(`α = ${sg(alpha)} с⁻¹`)], 'показатель закона массы для мягкой посадки'])),
    ];
    return done({ vals: { alpha, t: tL }, steps, plot: { xl: 't, с', yl: 'x, м', series: [{ name: 'x(t)', pts: run.filter((p, k) => k % 400 === 0 && (!Number.isFinite(tL) || p.t <= tL * 1.02)).map((p) => [p.t, p.y[0]] as [number, number]) }] } });
  },
};

/* ---------- 45.27 ---------- */
export function slopeRocket(w: number, alpha: number, H: number, ve: number, g: number) {
  const a = alpha * D2R;
  const t = sqrt((2 * H) / (w * Math.sin(a)));
  const Fm = sqrt(w * w + g * g + 2 * g * w * Math.sin(a));
  const beta = Math.acos((w * Math.cos(a)) / Fm);
  return { t, Fm, beta, z: Math.exp((Fm * t) / ve) };
}
const A_SLOPE: AskDef = {
  id: 'slope',
  title: '45.27: ракета с постоянным ускорением вдоль наклонной прямой',
  hint: 'Прямая под углом α к горизонту, ускорение w постоянно, скорость истечения v_e постоянна по величине и направлению.',
  n: { w: 20, alpha: 45, H: 10000, ve: 2500, g: 9.81 },
  fields: [
    { k: 'w', label: 'ускорение w, м/с²' },
    { k: 'alpha', label: 'угол α прямой к горизонту, °' },
    { k: 'H', label: 'высота H к концу сгорания, м' },
    { k: 've', label: 'скорость истечения v_e, м/с' },
    { k: 'g', label: 'g, м/с²' },
  ],
  solve: (q, ex) => {
    const { w, alpha, H, ve, g } = q.n;
    if (!pos(w, alpha, H, ve, g) || alpha > 90) return fail(['Все данные положительные, 0 < α ≤ 90°.']);
    const r = slopeRocket(w, alpha, H, ve, g);
    const a = alpha * D2R;
    const steps = [
      stepEx(
        ex,
        'Сила тяги',
        'Вдоль прямой ускорение w, поперёк — нуль. Тяга должна уравновесить поперечную составляющую тяжести и дать w вдоль прямой.',
        eqB('тяга Φ раскладывается на горизонтальную и вертикальную части:', 'Φ_x = m·w·cos α,  Φ_y = m(g + w·sin α)', `Φ/m = √(w² + g² + 2gw sin α) = ${sg(r.Fm)} м/с²`),
      ),
      stepB('Направление истечения', eqB(`угол β скорости v_e с горизонтом: cos β = w cos α/√(w² + g² + 2gw sin α)`, `β = ${sg((r.beta * 180) / Math.PI)}°`)),
      stepB('Время горения', eqB(`H = (w t²/2)·sin α  ⇒  t = √(2H/(w sin α)) = ${sg(r.t)} с`)),
      stepEx(ex, 'Число Циолковского', 'Реактивная сила Φ = |ṁ|·v_e ⇒ |ṁ|/m = (Φ/m)/v_e = const, масса убывает по закону e^(−(Φ/m)t/v_e).', eqB(`z = m₀/m₁ = exp[(Φ/m)·t/v_e] = exp[(cos α/(v_e cos β))·√(2wH/sin α)] = ${sg(r.z)}`)),
      stepB('Ответ', ansB([[bold(`z = ${sg(r.z)}`)], 'отношение начальной массы к массе без топлива'], [`β = ${sg((r.beta * 180) / Math.PI)}°`, 'угол скорости истечения с горизонтом', 'aux'])),
    ];
    void a;
    return done({ vals: { z: r.z, beta: (r.beta * 180) / Math.PI, t: r.t }, steps });
  },
};

/* ---------- 45.36–45.37 ---------- */
export function rotorOmega(Jp: number, m0: number, r: number, R: number, qq: number, ve: number, M: number, b: number, t: number) {
  const J0 = Jp + m0 * r * r;
  const J = J0 - qq * r * r * t;
  if (b > 0) return ((R * ve * qq) / b) * (1 - Math.pow(J / J0, b / (r * r * qq)));
  return ((R * qq * ve - M) / (r * r * qq)) * Math.log(J0 / J);
}
const A_ROTOR: AskDef = {
  id: 'rotor',
  title: '45.36–45.37: реактивный запуск ротора гироскопа пороховыми шашками',
  hint: 'Шашки — точки на расстоянии r от оси; сопла на ободе радиуса R, касательная скорость истечения v_e; расход пороха q.',
  n: { Jp: 0.02, m0: 0.1, r: 0.05, R: 0.1, q: 0.01, ve: 2000, M: 0.05, b: 0.001 },
  s: { drag: 'const' },
  selects: [
    {
      k: 'drag',
      label: 'Сопротивление',
      options: [
        ['const', 'постоянный момент M (45.36)'],
        ['lin', 'момент, пропорциональный ω: M = bω (45.37)'],
      ],
    },
  ],
  fields: [
    { k: 'Jp', label: 'момент инерции ротора J_p, кг·м²' },
    { k: 'm0', label: 'масса пороха m₀, кг' },
    { k: 'r', label: 'расстояние шашек от оси r, м' },
    { k: 'R', label: 'радиус ротора R, м' },
    { k: 'q', label: 'расход пороха q, кг/с' },
    { k: 've', label: 'касательная скорость истечения v_e, м/с' },
    { k: 'M', label: 'момент сопротивления M, Н·м', show: (p) => p.s.drag === 'const' },
    { k: 'b', label: 'коэффициент b, Н·м·с', show: (p) => p.s.drag === 'lin' },
  ],
  solve: (p, ex) => {
    const { Jp, m0, r, R, q: qq, ve, M, b } = p.n;
    const lin = p.s.drag === 'lin';
    if (!pos(Jp, m0, r, R, qq, ve) || !nn(M, b) || (lin && !(b > 0))) return fail(['Данные положительные; в 45.37 b > 0.']);
    const J0 = Jp + m0 * r * r;
    if (!lin && R * qq * ve <= M) return fail(['Ротор не тронется: момент реактивной силы qv_eR не больше момента сопротивления.']);
    const tb = m0 / qq;
    const w = rotorOmega(Jp, m0, r, R, qq, ve, lin ? 0 : M, lin ? b : 0, tb);
    const steps = [
      stepEx(
        ex,
        'Уравнение вращения ротора переменного состава',
        'Шашки вращаются вместе с ротором на расстоянии r, поэтому момент инерции J(t) = J_p + m(t)r² убывает; продукты сгорания уходят с касательной скоростью v_e относительно ротора — реактивная сила Φ = q·v_e даёт момент ΦR.',
        eqB(`J(t)·ω̇ = qv_eR − ${lin ? 'bω' : 'M'},  J(t) = J_p + (m₀ − qt)r²,  J₀ = J_p + m₀r² = ${sg(J0)}`),
      ),
      stepB(
        'Интегрирование',
        lin ? eqB('dJ = −qr²dt  ⇒  dω/(qv_eR − bω) = −dJ/(qr²J)', 'ω = (Rv_eq/b)·[1 − (J_p/J₀)^(b/(r²q))]') : eqB('dω = (qv_eR − M)/(qr²)·(−dJ/J)', 'ω = (Rqv_e − M)/(r²q)·ln(J₀/J_p)'),
      ),
      stepB('Ответ', ansB([[bold(`ω = ${sg(w)} рад/с`)], `угловая скорость ротора к моменту сгорания пороха (t = m₀/q = ${sg(tb)} с)`], [`n = ${sg((w * 60) / (2 * Math.PI))} об/мин`, 'то же в оборотах в минуту', 'aux'])),
    ];
    return done({ vals: { w, n: (w * 60) / (2 * Math.PI), J0, tb }, steps, plot: { xl: 't, с', yl: 'ω, рад/с', series: [{ name: 'ω(t)', pts: sample((t) => rotorOmega(Jp, m0, r, R, qq, ve, lin ? 0 : M, lin ? b : 0, t), 0, tb, 100) }] } });
  },
};

/* ---------- 45.35 ---------- */
export function centerOrbit(mu0: number, alpha: number, x0: number, y0: number, vx: number, vy: number, T: number) {
  const xs = rk4(
    (t, y) => {
      const d = Math.hypot(y[0], y[1]);
      const k = -(mu0 / (1 + alpha * t)) / (d * d * d);
      return [y[2], y[3], k * y[0], k * y[1]];
    },
    [x0, y0, vx, vy],
    0,
    T,
    8000,
  );
  const tau = T / (1 + alpha * T);
  const xi = rk4(
    (_t, y) => {
      const d = Math.hypot(y[0], y[1]);
      const k = -mu0 / (d * d * d);
      return [y[2], y[3], k * y[0], k * y[1]];
    },
    [x0, y0, vx - alpha * x0, vy - alpha * y0],
    0,
    tau,
    8000,
  );
  const r0 = Math.hypot(x0, y0);
  const c0 = [vx - alpha * x0, vy - alpha * y0];
  const E = 0.5 * (c0[0] ** 2 + c0[1] ** 2) - mu0 / r0;
  const Lz = x0 * c0[1] - y0 * c0[0];
  const p = (Lz * Lz) / mu0;
  const e = sqrt(Math.max(0, 1 + (2 * E * Lz * Lz) / (mu0 * mu0)));
  const a = E < 0 ? -mu0 / (2 * E) : Infinity;
  const last = xs[xs.length - 1].y,
    lastXi = xi[xi.length - 1].y;
  const dev = Math.hypot(last[0] - (1 + alpha * T) * lastXi[0], last[1] - (1 + alpha * T) * lastXi[1]);
  return { xs, xi, E, e, a, p, tau, dev, kind: Math.abs(E) < 1e-12 ? 'параболическая' : E < 0 ? 'эллиптическая' : 'гиперболическая' };
}
const A_CENTER: AskDef = {
  id: 'center',
  title: '45.35: притяжение к центру переменной массы M = M₀/(1 + αt)',
  hint: 'Задача Гюльдена — Мещерского: после замены ξ = x/(1 + αt), τ = t/(1 + αt) движение — кеплерово с постоянной массой M₀.',
  n: { mu0: 1, alpha: 0.2, x0: 1, y0: 0, vx: 0, vy: 0.8, T: 8 },
  fields: [
    { k: 'mu0', label: 'fM₀ — гравитационный параметр при t = 0' },
    { k: 'alpha', label: 'α (M = M₀/(1 + αt)), 1/с' },
    { k: 'x0', label: 'x₀', neg: true },
    { k: 'y0', label: 'y₀', neg: true },
    { k: 'vx', label: 'ẋ₀', neg: true },
    { k: 'vy', label: 'ẏ₀', neg: true },
    { k: 'T', label: 'время расчёта T, с' },
  ],
  solve: (q, ex) => {
    const { mu0, alpha, x0, y0, vx, vy, T } = q.n;
    if (!pos(mu0, T) || !nn(alpha) || !(Math.hypot(x0, y0) > 0)) return fail(['fM₀ и T — положительные; α ≥ 0; начальная точка не в центре.']);
    const c = centerOrbit(mu0, alpha, x0, y0, vx, vy, T);
    const steps = [
      stepEx(
        ex,
        'Преобразование координат',
        'Подстановка x = (1 + αt)ξ и приведённое время τ = t/(1 + αt) (dτ = dt/(1 + αt)²) убирает зависимость массы от времени: в новых переменных сила притяжения — обычная ньютоновская.',
        eqB('ξ = x/(1 + αt),  η = y/(1 + αt),  τ = t/(1 + αt)', 'd²ξ/dτ² + fM₀·ξ/ρ³ = 0,  d²η/dτ² + fM₀·η/ρ³ = 0,  ρ = √(ξ² + η²)'),
      ),
      stepB('Начальные условия в новых переменных', eqB(`ξ(0) = (${sg(x0)}; ${sg(y0)}),  dξ/dτ(0) = ẋ₀ − αx₀ = ${sg(vx - alpha * x0)},  dη/dτ(0) = ẏ₀ − αy₀ = ${sg(vy - alpha * y0)}`)),
      stepB('Тип орбиты в плоскости (ξ, η)', eqB(`энергия E = ½|dξ/dτ|² − fM₀/ρ = ${sg(c.E)}  ⇒  орбита ${c.kind}`, `эксцентриситет e = ${sg(c.e)}${Number.isFinite(c.a) ? `,  большая полуось a = ${sg(c.a)}` : ''},  параметр p = ${sg(c.p)}`)),
      stepB('Проверка', eqB(`интегрирование исходных уравнений x″ = −fM₀x/((1 + αt)ρ³) и обратное преобразование x = (1 + αt)ξ(τ) при t = ${sg(T)} дают ту же точку (расхождение ${sg(c.dev, 2)})`)),
      stepB('Ответ', ansB([[bold(`орбита в (ξ, η): ${c.kind}`)], `e = ${sg(c.e)}; по исходным координатам x = (1 + αt)ξ(τ) — витки, «раздувающиеся» с ростом t`])),
    ];
    return done({
      vals: { e: c.e, E: c.E, dev: c.dev, a: Number.isFinite(c.a) ? c.a : 0, kind: c.E < 0 ? -1 : c.E > 0 ? 1 : 0 },
      steps,
      plot: { xl: 'x, ξ', yl: 'y, η', equal: true, series: [{ name: 'x(t), исходное движение', pts: c.xs.filter((_p, i) => i % 40 === 0).map((p) => [p.y[0], p.y[1]] as [number, number]) }, { name: 'ξ(τ), приведённое движение', pts: c.xi.filter((_p, i) => i % 40 === 0).map((p) => [p.y[0], p.y[1]] as [number, number]) }] },
    });
  },
};

export const VARMASS_ASKS: AskDef[] = [A_PEND, A_ROCKET, A_AERO, A_HEIGHT, A_MOON, A_WORK, A_SOFT, A_SLOPE, A_ROTOR, A_CENTER];
