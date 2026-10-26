/**
 * Пункт 24, «Кинетическая энергия»: задачи §38, которые не сводятся к цепочке грузов, блоков и катков (Мещерский).
 *
 *  - pulley  38.15 — груз на нити между двумя блоками: наибольшее опускание p₁h = 2p(√(l² + h²) − l);
 *  - slide   38.16 — груз на гладком стержне тянет нить через блок: связь v и h;
 *  - stop2   38.17 — две стадии (с нагрузкой и без): коэффициент трения из остановки;
 *  - table   38.18 — весомая нить на столе (в том числе с трением): x″ = (g/L)((1 + f)x − fL);
 *  - peg     38.19 — весомая нить на гладком штифте: v² = v₀² + g(a² − d²)/a;
 *  - cable   38.47 — трос навит на барабан: вся масса троса движется со скоростью груза, работа — только свисающей части;
 *  - cable48 38.48 — трос через блок к оси катка с трением качения;
 *  - ladder  38.34 — стремянка на гладком полу (опора B движется по вертикали): θ̇² = g(h₀ − h)/(l² + ρ²), реакции пола;
 *  - rod     38.35 — падающий стержень на гладком полу: v_C² = 6g(a − h)²(a + h)/(4a² − 3h²), реакция пола;
 *  - track   38.4  — кинетическая энергия гусеницы: T = 2γ(l + πr)v₀²/g;
 *  - jw      38.51–38.53 — приведённый момент инерции эпи- и гипоциклического механизма, J·dω/dt = M(ω).
 */
import { ENERGY_ASKS_29 } from './extra29';
import { parB, ansB, bold, eqB, fail, sample, sg, stepB, stepEx, type AskDef, type ExtraOut, type ExtraProblem } from '../../../shared/extra';

const G = 9.81;
const pos = (...x: number[]) => x.every((v) => v > 0 && Number.isFinite(v));
const nn = (...x: number[]) => x.every((v) => v >= 0 && Number.isFinite(v));
const sqrt = Math.sqrt;
const done = (o: Omit<ExtraOut, 'ok' | 'errors'>): ExtraOut => ({ ok: true, errors: [], ...o });

/* ---------- 38.15 ---------- */
export function pulley(p1: number, P: number, l: number, h: number) {
  const hmax = p1 < 2 * P ? (4 * P * p1 * l) / (4 * P * P - p1 * p1) : Infinity;
  const v2 = (2 * G * (p1 * h - 2 * P * (sqrt(l * l + h * h) - l))) / (p1 + (2 * P * h * h) / (h * h + l * l));
  return { hmax, v2 };
}
const A_PULLEY: AskDef = {
  id: 'pulley',
  title: '38.15: груз на нити между двумя блоками — наибольшее опускание',
  hint: 'Нить с равными грузами p перекинута через два блока на одной горизонтали; в середине — груз p₁.',
  n: { p: 1, p1: 1, l: 1, hq: 0.5 },
  fields: [
    { k: 'p', label: 'вес каждого груза p' },
    { k: 'p1', label: 'вес среднего груза p₁' },
    { k: 'l', label: 'половина расстояния между блоками l, м' },
    { k: 'hq', label: 'глубина h для скорости, м (0 — не считать)' },
  ],
  solve: (q, ex) => {
    const { p, p1, l, hq } = q.n;
    if (!pos(p, p1, l) || !nn(hq)) return fail(['Веса и расстояние — положительные числа, глубина — неотрицательная.']);
    const r = pulley(p1, p, l, hq);
    const hmax = r.hmax;
    const steps = [
      stepEx(ex, 'Связь перемещений', 'Каждый из двух грузов p поднимается на удлинение наклонного участка нити: √(l² + h²) − l. Размерами блоков пренебрегаем.', eqB(`h — опускание груза p₁; груз p поднимается на s = √(l² + h²) − l`, `скорость груза p: u = v·h/√(l² + h²)`)),
      stepEx(
        ex,
        'Теорема об изменении кинетической энергии',
        'В наинизшем положении скорости равны нулю, T₂ − T₁ = 0, значит работа всех сил равна нулю.',
        eqB('p₁h − 2p(√(l² + h²) − l) = 0', '(p₁h/2p + l)² = l² + h²  ⇒  h·(1 − p₁²/4p²) = p₁l/p'),
      ),
      stepB('Ответ', p1 < 2 * p ? ansB([[bold(`h = 4pp₁l/(4p² − p₁²) = ${sg(hmax)} м`)], 'наибольшее опускание груза p₁']) : { k: 'badge', tone: 'warn', text: 'p₁ ≥ 2p: груз p₁ опускается без остановки (до пола или конца нити)' }),
    ];
    const vals: Record<string, number> = { h: hmax };
    if (hq > 0) {
      vals.v = sqrt(Math.max(0, r.v2));
      steps.splice(
        2,
        0,
        stepB('Скорость на глубине h', eqB(`½(p₁ + 2p·h²/(h² + l²))·v²/g = p₁h − 2p(√(h² + l²) − l)`, `h = ${sg(hq)} м:  v² = ${sg(r.v2)} м²/с²,  v = ${sg(vals.v)} м/с`)),
      );
    }
    const top = Number.isFinite(hmax) ? hmax * 1.05 : Math.max(2 * l, hq * 1.5);
    return done({
      vals,
      steps,
      plot: { xl: 'h, м', yl: 'v, м/с', series: [{ name: 'v(h)', pts: sample((h) => sqrt(Math.max(0, pulley(p1, p, l, h).v2)), 0, top, 100) }], marks: Number.isFinite(hmax) ? [{ x: hmax, y: 0, label: `h = ${sg(hmax, 3)}` }] : [] },
    });
  },
};

/* ---------- 38.16 ---------- */
const A_SLIDE: AskDef = {
  id: 'slide',
  title: '38.16: груз на вертикальном стержне и груз на нити через блок',
  hint: 'Груз P₁ скользит по гладкому стержню на расстоянии a от блока и тянет нить; на другом конце — груз P.',
  n: { P: 1, P1: 2, a: 0.5, h: 0.5 },
  fields: [
    { k: 'P', label: 'вес груза P' },
    { k: 'P1', label: 'вес груза P₁ (на стержне)' },
    { k: 'a', label: 'расстояние a от стержня до блока, м' },
    { k: 'h', label: 'опускание h груза P₁, м' },
  ],
  solve: (q, ex) => {
    const { P, P1, a, h } = q.n;
    if (!pos(P, P1, a) || !nn(h)) return fail(['Веса и расстояние — положительные числа, опускание — неотрицательное.']);
    const f = (x: number) => (2 * G * (P1 * x - P * (sqrt(a * a + x * x) - a))) / (P1 + (P * x * x) / (a * a + x * x));
    const v2 = f(h);
    if (v2 < 0) return fail([`Груз P₁ не доходит до глубины h = ${sg(h)} м: v² < 0 (нить тянет его назад).`]);
    const v = sqrt(v2);
    const steps = [
      stepEx(ex, 'Связь перемещений и скоростей', 'Длина нити постоянна: когда P₁ опустится на h, участок от блока до P₁ станет √(a² + h²), а груз P поднимется на √(a² + h²) − a.', eqB('s = √(a² + h²) − a', 'u = v·h/√(a² + h²)  (скорость груза P)')),
      stepEx(ex, 'Теорема об изменении кинетической энергии', 'Груз P₁ опускается, груз P поднимается; начальные скорости равны нулю.', eqB('(P₁ + P·h²/(a² + h²))·v²/(2g) = P₁h − P(√(a² + h²) − a)', `v² = 2g[P₁h − P(√(a² + h²) − a)]/(P₁ + P·h²/(a² + h²)) = ${sg(v2)} м²/с²`)),
      stepB('Ответ', ansB([[bold(`v = ${sg(v)} м/с`)], `скорость груза P₁ при опускании на h = ${sg(h)} м`])),
    ];
    let top = 4 * a;
    while (top > h && f(top) < 0) top *= 0.9;
    const hs = sample((x) => (f(x) >= 0 ? sqrt(f(x)) : NaN), 0, Math.max(top, h), 100).filter((pt) => Number.isFinite(pt[1]));
    return done({ vals: { v }, steps, plot: { xl: 'h, м', yl: 'v, м/с', series: [{ name: 'v(h)', pts: hs }], marks: [{ x: h, y: v, label: `v = ${sg(v, 3)}` }] } });
  },
};

/* ---------- 38.17 ---------- */
const A_STOP2: AskDef = {
  id: 'stop2',
  title: '38.17: две стадии — коэффициент трения из остановки',
  hint: 'Груз P с нагрузкой P₁ тянет тело Q по шероховатой плоскости; кольцо снимает нагрузку, груз проходит ещё s₂ и останавливается.',
  n: { Q: 0.8, P: 0.1, P1: 0.1, s1: 0.5, s2: 0.3 },
  fields: [
    { k: 'Q', label: 'вес тела Q' },
    { k: 'P', label: 'вес груза P' },
    { k: 'P1', label: 'вес нагрузки P₁' },
    { k: 's1', label: 'путь с нагрузкой s₁, м' },
    { k: 's2', label: 'путь без нагрузки s₂, м' },
  ],
  solve: (q, ex) => {
    const { Q, P, P1, s1, s2 } = q.n;
    if (!pos(Q, P, P1, s1, s2)) return fail(['Все данные — положительные числа.']);
    const f = ((P + P1) * s1 + P * s2) / (Q * (s1 + s2));
    const v2 = (2 * G * ((P + P1 - f * Q) * s1)) / (P + P1 + Q);
    const steps = [
      stepEx(ex, 'Вся остановка одной теоремой', 'В начале и в конце система неподвижна, поэтому работа всех сил на пути s₁ + s₂ равна нулю: нагрузка P₁ работает только на s₁, груз P — на всём пути, трение — на всём.', eqB('(P + P₁)s₁ + P·s₂ − fQ(s₁ + s₂) = 0', `f = [(P + P₁)s₁ + P·s₂]/[Q(s₁ + s₂)] = ${sg(f)}`)),
      stepB('Наибольшая скорость (у кольца)', eqB(`(P + P₁ + Q)v²/(2g) = (P + P₁ − fQ)s₁`, `v = ${sg(v2 > 0 ? sqrt(v2) : 0)} м/с`)),
      stepB('Ответ', ansB([[bold(`f = ${sg(f)}`)], 'коэффициент трения тела о плоскость'], [`v = ${sg(v2 > 0 ? sqrt(v2) : 0)} м/с`, 'скорость у кольца', 'aux'])),
    ];
    return done({ vals: { f, v: v2 > 0 ? sqrt(v2) : 0 }, steps });
  },
};

/* ---------- 38.18 ---------- */
export function tableRope(L: number, l: number, f: number) {
  const xs = (f * L) / (1 + f);
  const k = sqrt(((1 + f) * G) / L);
  const T = Math.acosh((L - xs) / (l - xs)) / k;
  const v = k * sqrt((L - xs) ** 2 - (l - xs) ** 2);
  return { xs, k, T, v };
}
const A_TABLE: AskDef = {
  id: 'table',
  title: '38.18: весомая нить сходит со стола',
  hint: 'Однородная нить длиной L, часть l свисает со стола; f — коэффициент трения лежащей части о стол (0 — гладкий стол).',
  n: { L: 2, l: 0.5, f: 0 },
  fields: [
    { k: 'L', label: 'длина нити L, м' },
    { k: 'l', label: 'свисающая часть l, м' },
    { k: 'f', label: 'трение f (0 — гладкий стол)' },
  ],
  solve: (q, ex) => {
    const { L, l, f } = q.n;
    if (!pos(L, l) || !nn(f) || l >= L) return fail(['Длина L и свисающая часть l — положительные, l < L; f ≥ 0.']);
    const xs = (f * L) / (1 + f);
    if (l <= xs) return fail([`Нить не сдвинется: нужно l > fL/(1 + f) = ${sg(xs)} м.`]);
    const r = tableRope(L, l, f);
    const body = (x: number) => xs + (l - xs) * Math.cosh(r.k * x);
    const steps = [
      stepEx(
        ex,
        'Уравнение движения',
        'Движущая сила — вес свисающей части ρgx, сопротивление — трение лежащей части fρg(L − x); масса всей нити ρL.',
        eqB('ρL·x″ = ρg·x − fρg(L − x)', f > 0 ? `x″ = k²(x − x*), k² = (1 + f)g/L = ${sg(r.k * r.k)} с⁻², x* = fL/(1 + f) = ${sg(xs)} м` : `x″ = (g/L)·x,  k² = g/L = ${sg(r.k * r.k)} с⁻²`),
      ),
      stepB('Решение', eqB('x(t) = x* + (l − x*)·ch(kt)', `x = L:  ch(kT) = (L − x*)/(l − x*)`, `T = (1/k)·arch((L − x*)/(l − x*))${f === 0 ? ' = √(L/g)·ln[(L + √(L² − l²))/l]' : ''} = ${sg(r.T)} с`)),
      stepB('Скорость в момент ухода', eqB(`v² = k²[(L − x*)² − (l − x*)²]`, `v = ${sg(r.v)} м/с`)),
      stepB('Ответ', ansB([[bold(`T = ${sg(r.T)} с`)], 'время, за которое нить покинет стол'], [`v = ${sg(r.v)} м/с`, 'скорость нити в этот момент', 'aux'])),
    ];
    return done({ vals: { T: r.T, v: r.v }, steps, plot: { xl: 't, с', yl: 'x, м', series: [{ name: 'x(t)', pts: sample((t) => body(t), 0, r.T, 100) }], marks: [{ x: r.T, y: L, label: `T = ${sg(r.T, 3)}` }] } });
  },
};

/* ---------- 38.19 ---------- */
const A_PEG: AskDef = {
  id: 'peg',
  title: '38.19: весомая нить на гладком штифте',
  hint: 'Нить длиной 2a висит на штифте, одна сторона длиннее другой на 2d; начальная скорость v₀ направлена в сторону длинной части.',
  n: { a: 1, v0: 1, d: 0 },
  fields: [
    { k: 'a', label: 'половина длины нити a, м' },
    { k: 'v0', label: 'начальная скорость v₀, м/с' },
    { k: 'd', label: 'смещение d: стороны a + d и a − d, м' },
  ],
  solve: (q, ex) => {
    const { a, v0, d } = q.n;
    if (!pos(a) || !nn(v0, d) || d >= a) return fail(['Длина a — положительная; v₀ ≥ 0; 0 ≤ d < a.']);
    if (v0 === 0 && d === 0) return fail(['Нить в равновесии и v₀ = 0: движения нет.']);
    const v2 = v0 * v0 + (G * (a * a - d * d)) / a;
    const steps = [
      stepEx(ex, 'Положение центра масс', 'Свисающие части — вертикальные отрезки длиной a + d и a − d; центр каждого лежит посередине. Когда нить сойдёт, она висит вертикально отрезком 2a, центр масс — на a ниже штифта.', eqB(`начало: y₁ = [(a + d)² + (a − d)²]/(4a) = (a² + d²)/(2a)`, `конец: y₂ = a`)),
      stepB('Теорема об изменении кинетической энергии', eqB(`½v² − ½v₀² = g(y₂ − y₁)`, `v² = v₀² + g(a² − d²)/a = ${sg(v2)} м²/с²`)),
      stepB('Ответ', ansB([[bold(`v = ${sg(sqrt(v2))} м/с`)], 'скорость нити в момент, когда она сойдёт со штифта'])),
    ];
    return done({ vals: { v: sqrt(v2) }, steps });
  },
};

/* ---------- 38.47 ---------- */
export function cable(P: number, p: number, J: number, R: number, l: number, x0: number, x: number) {
  const v2 = ((x - x0) * (2 * P + p * (x + x0)) * G * R * R) / (J * G + (P + p * l) * R * R);
  return v2;
}
const A_CABLE: AskDef = {
  id: 'cable',
  title: '38.47: груз на тросе, навитом на барабан',
  hint: 'Весь трос длиной l движется со скоростью груза; потенциальную энергию навитой части не считаем (она не смещается).',
  n: { P: 10, p: 1, J: 2, R: 0.5, l: 10, x0: 1, x: 5 },
  fields: [
    { k: 'P', label: 'вес груза P' },
    { k: 'p', label: 'вес единицы длины троса p' },
    { k: 'J', label: 'момент инерции барабана J' },
    { k: 'R', label: 'радиус барабана R, м' },
    { k: 'l', label: 'длина троса l, м' },
    { k: 'x0', label: 'начальная свисающая часть x₀, м' },
    { k: 'x', label: 'свисающая часть x, м' },
  ],
  solve: (q, ex) => {
    const { P, p, J, R, l, x0, x } = q.n;
    if (!pos(P, J, R, l) || !nn(p, x0, x) || x < x0 || x > l) return fail(['Данные положительные; x₀ ≤ x ≤ l.']);
    const v2 = cable(P, p, J, R, l, x0, x);
    const v = sqrt(v2);
    const steps = [
      stepEx(
        ex,
        'Кинетическая энергия',
        'Груз и весь трос (и свисающий, и намотанный) движутся со скоростью v — намотанный трос вращается вместе с барабаном, ω = v/R, при этом толщиной троса пренебрегаем. Масса системы постоянна.',
        eqB('T = ½[(P + pl)/g + J/R²]·v²'),
      ),
      stepEx(ex, 'Работа', 'Поднимается или опускается только груз и свисающая часть: вес свисающего участка растёт линейно с x.', eqB('A = P(x − x₀) + p(x² − x₀²)/2 = (x − x₀)[2P + p(x + x₀)]/2')),
      stepB('Теорема об изменении кинетической энергии', eqB(`T − 0 = A`, `v = R·√( g[2P + p(x + x₀)](x − x₀) / (Jg + (P + pl)R²) ) = ${sg(v)} м/с`)),
      stepB('Ответ', ansB([[bold(`v = ${sg(v)} м/с`)], `скорость груза при свисающей части x = ${sg(x)} м`])),
    ];
    return done({ vals: { v }, steps, plot: { xl: 'x, м', yl: 'v, м/с', series: [{ name: 'v(x)', pts: sample((t) => sqrt(cable(P, p, J, R, l, x0, t)), x0, l, 100) }], marks: [{ x, y: v, label: `v = ${sg(v, 3)}` }] } });
  },
};

/* ---------- 38.48 ---------- */
export function cable48(P1: number, Q: number, L: number, P2: number, r: number, fk: number, l: number, h: number) {
  const hang = (Q / (2 * L)) * (2 * l + 2 * r + h);
  const N = P2 + Q * (0.5 - l / (2 * L) - (Math.PI * r) / (4 * L) - h / (4 * L));
  const num = 2 * G * h * (P1 + hang - (fk / r) * N);
  return { v2: num / (P1 + 2 * P2 + Q), hang, N };
}
const A_CABLE48: AskDef = {
  id: 'cable48',
  title: '38.48: груз и трос через блок к оси катка с трением качения',
  hint: 'Трос длиной L (вес Q) переброшен через блок B; другой конец — на оси катка C; свисает часть l.',
  n: { P1: 5, Q: 2, L: 4, P2: 1, r: 0.1, fk: 0.005, l: 0.5, h: 1 },
  fields: [
    { k: 'P1', label: 'вес груза A, P₁' },
    { k: 'Q', label: 'вес троса Q' },
    { k: 'L', label: 'длина троса L, м' },
    { k: 'P2', label: 'вес блока B и катка C, P₂ (каждого)' },
    { k: 'r', label: 'радиус блока и катка r, м' },
    { k: 'fk', label: 'трение качения f_k, м' },
    { k: 'l', label: 'свисает с блока l, м' },
    { k: 'h', label: 'опускание груза h, м' },
  ],
  solve: (q, ex) => {
    const { P1, Q, L, P2, r, fk, l, h } = q.n;
    const hmax = L - l - (Math.PI * r) / 2;
    if (!pos(P1, Q, L, P2, r) || !nn(fk, l, h) || hmax <= 0 || h > hmax) return fail([`Данные положительные; груз может опуститься не более чем на L − l − πr/2 = ${sg(hmax)} м.`]);
    const R = cable48(P1, Q, L, P2, r, fk, l, h);
    if (R.v2 < 0) return fail(['Система не сдвигается: трение качения больше движущей силы.']);
    const v = sqrt(R.v2);
    const steps = [
      stepEx(ex, 'Кинетическая энергия', 'Весь трос, груз и ось катка движутся со скоростью v; блок и каток — однородные диски, ω = v/r.', eqB('T = ½[(P₁ + Q)/g + P₂/(2g) + P₂/g + P₂/(2g)]·v² = (P₁ + 2P₂ + Q)·v²/(2g)')),
      stepEx(
        ex,
        'Работа',
        'Груз и свисающая часть троса опускаются; участок длиной h переходит с горизонтальной части (на высоте верха блока, на r выше оси) вниз. Давление катка на плоскость — вес катка и половина веса горизонтального участка троса; оно линейно убывает с h, поэтому работа трения качения содержит h/(4L).',
        eqB(
          `A(P₁) = P₁h;   A(трос) = (Q/2L)·h(2l + 2r + h) = ${sg(R.hang * h)}`,
          `A(качение) = −(f_k/r)·h·[P₂ + Q(½ − l/2L − πr/4L − h/4L)] = ${sg(-(fk / r) * h * R.N)}`,
        ),
      ),
      stepB('Теорема об изменении кинетической энергии', eqB(`v = √( 2gh{P₁ + (Q/2L)(2l + 2r + h) − (f_k/r)[P₂ + Q(½ − l/2L − πr/4L − h/4L)]} / (P₁ + 2P₂ + Q) )`, `v = ${sg(v)} м/с`)),
      stepB('Ответ', ansB([[bold(`v = ${sg(v)} м/с`)], `скорость груза A при опускании на h = ${sg(h)} м`])),
    ];
    return done({
      vals: { v },
      steps,
      plot: { xl: 'h, м', yl: 'v, м/с', series: [{ name: 'v(h)', pts: sample((x) => sqrt(Math.max(0, cable48(P1, Q, L, P2, r, fk, l, x).v2)), 0, hmax, 100) }], marks: [{ x: h, y: v, label: `v = ${sg(v, 3)}` }] },
    });
  },
};

/* ---------- 38.34 ---------- */
export function ladder(l: number, rho: number, h0: number, h: number, P: number) {
  const k = l * l + rho * rho;
  const th = Math.acos(h / (2 * l));
  const w2 = (G * (h0 - h)) / k;
  const vB = 2 * l * Math.sin(th) * sqrt(Math.max(0, w2));
  const ddth = (G * l * Math.sin(th)) / k;
  const ddy = -l * (Math.sin(th) * ddth + Math.cos(th) * w2);
  return { th, w2, vB, N: P * (1 + ddy / G) };
}
const A_LADDER: AskDef = {
  id: 'ladder',
  title: '38.34: падение стремянки на гладком полу',
  hint: 'Две одинаковые стороны AB = BC = 2l, шарнир B на высоте h₀; стяжка разорвалась, шарнир движется по вертикали.',
  n: { l: 1, rho: 0.5, h0: 1.5, hq: 0.75, P: 1 },
  fields: [
    { k: 'l', label: 'половина стороны l, м (сторона 2l)' },
    { k: 'rho', label: 'радиус инерции ρ, м' },
    { k: 'h0', label: 'начальная высота шарнира h₀, м' },
    { k: 'hq', label: 'высота шарнира для скорости, м' },
    { k: 'P', label: 'вес одной стороны P (для реакции пола)' },
  ],
  solve: (q, ex) => {
    const { l, rho, h0, hq, P } = q.n;
    if (!pos(l, rho, h0, P) || !nn(hq) || h0 >= 2 * l || hq > h0) return fail(['Данные положительные; h₀ < 2l; 0 ≤ h ≤ h₀.']);
    const a = ladder(l, rho, h0, 0, P);
    const b = ladder(l, rho, h0, hq, P);
    const steps = [
      stepEx(
        ex,
        'Движение сторон',
        'Пол гладкий, горизонтальных внешних сил нет: центр масс системы и шарнир B движутся по вертикали. Мгновенный центр скоростей стороны AB — на пересечении перпендикуляров к скоростям точек A (горизонталь) и B (вертикаль); от него до центра тяжести D стороны расстояние l.',
        eqB(`cos θ = h/(2l), θ — угол стороны с вертикалью`, `T = 2·½·(P/g)(ρ² + l²)θ̇² = (P/g)(l² + ρ²)θ̇²`, `работа веса: P(h₀ − h)  (центр тяжести каждой стороны на h/2)`),
      ),
      stepB('Угловая скорость и скорость шарнира', eqB(`θ̇² = g(h₀ − h)/(l² + ρ²)`, `v_B = 2l·sin θ·θ̇ = 2l·√(1 − h²/4l²)·√(g(h₀ − h)/(l² + ρ²))`)),
      stepB('1) Перед ударом шарнира об пол (h = 0, θ = 90°)', eqB(`v_B = 2l·√(g·h₀/(l² + ρ²)) = ${sg(a.vB)} м/с`)),
      stepB(`2) На высоте h = ${sg(hq)} м`, eqB(`θ = ${sg((b.th * 180) / Math.PI)}°,  v_B = ${sg(b.vB)} м/с`, `при h = h₀/2: v_B = ½√(g·h₀(16l² − h₀²)/(2(l² + ρ²)))`)),
      stepEx(ex, 'Реакция пола', 'Вертикальное уравнение для системы: 2N − 2P = 2m·ÿ_D, y_D = l cos θ; θ̈ = g l sin θ/(l² + ρ²) из дифференцирования энергии.', eqB(`N = P(1 + ÿ_D/g) = ${sg(b.N)}  на высоте h (в начале N = ${sg(ladder(l, rho, h0, h0, P).N)})`)),
      stepB('Ответ', ansB([[bold(`v_B = ${sg(a.vB)} м/с`)], '1) в момент удара шарнира об пол'], [bold(`v_B = ${sg(b.vB)} м/с`), `2) на высоте ${sg(hq)} м`])),
    ];
    return done({
      vals: { v1: a.vB, v2: b.vB, N: b.N },
      steps,
      plot: { xl: 'h, м', yl: 'v_B, м/с', series: [{ name: 'v_B(h)', pts: sample((x) => ladder(l, rho, h0, x, P).vB, 0, h0, 100) }], marks: [{ x: hq, y: b.vB, label: `${sg(b.vB, 3)}` }] },
    });
  },
};

/* ---------- 38.35 ---------- */
export function fallRod(a: number, h: number, P: number) {
  const ph = Math.acos(h / a);
  const s = Math.sin(ph),
    c = Math.cos(ph);
  const w = 1 + 3 * s * s,
    u = 1 - c;
  const w2 = ((6 * G) / a) * (u / w);
  const dw2 = ((6 * G) / a) * ((s * w - u * 6 * s * c) / (w * w));
  const ddph = dw2 / 2;
  const ddy = -a * (s * ddph + c * w2);
  return { ph, w2, vC: a * s * sqrt(Math.max(0, w2)), N: P * (1 + ddy / G) };
}
const A_ROD: AskDef = {
  id: 'rod',
  title: '38.35: падающий стержень на гладком полу',
  hint: 'Стержень длиной 2a стоял вертикально и начинает падать; конец A скользит по гладкому полу, центр C движется по вертикали.',
  n: { a: 1, h: 0.5, P: 1 },
  fields: [
    { k: 'a', label: 'половина длины a, м' },
    { k: 'h', label: 'высота центра h, м' },
    { k: 'P', label: 'вес стержня P (для реакции)' },
  ],
  solve: (q, ex) => {
    const { a, h, P } = q.n;
    if (!pos(a, P) || !nn(h) || h > a) return fail(['a и P — положительные; 0 ≤ h ≤ a.']);
    const r = fallRod(a, h, P);
    const steps = [
      stepEx(
        ex,
        'Кинематика',
        'Центр C движется по вертикали (горизонтальных сил нет), конец A — по горизонтали: мгновенный центр скоростей лежит на пересечении горизонтали через C и вертикали через A, на расстоянии a·sin φ от C.',
        eqB('h = a·cos φ,  v_C = a·sin φ·φ̇', 'T = ½(ma²/3 + ma²sin²φ)φ̇² = (ma²/6)(1 + 3sin²φ)φ̇²'),
      ),
      stepB('Теорема об изменении кинетической энергии', eqB(`(ma²/6)(1 + 3sin²φ)φ̇² = mg(a − h)`, `v_C² = 6g(a − h)²(a + h)/(4a² − 3h²)`, `v_C = (a − h)·√(6g(a + h)/(4a² − 3h²)) = ${sg(r.vC)} м/с`)),
      stepEx(ex, 'Реакция пола', 'N − P = m·ÿ_C, y_C = a cos φ; φ̈ — из дифференцирования φ̇²(φ).', eqB(`N = P(1 + ÿ_C/g) = ${sg(r.N)}`)),
      stepB('Ответ', ansB([[bold(`v_C = ${sg(r.vC)} м/с`)], `скорость центра тяжести на высоте h = ${sg(h)} м`], [`N = ${sg(r.N)}`, 'реакция пола (в единицах веса)', 'aux'])),
    ];
    return done({ vals: { v: r.vC, N: r.N }, steps, plot: { xl: 'h, м', yl: 'v_C, м/с', series: [{ name: 'v_C(h)', pts: sample((x) => fallRod(a, x, P).vC, 0, a, 100) }], marks: [{ x: h, y: r.vC, label: `${sg(r.vC, 3)}` }] } });
  },
};

/* ---------- 38.4 ---------- */
const A_TRACK: AskDef = {
  id: 'track',
  title: '38.4: кинетическая энергия гусеницы',
  hint: 'Колёса радиуса r, расстояние между осями l, вес метра гусеницы γ; трактор движется со скоростью v₀ без проскальзывания.',
  n: { gamma: 1, l: 3, r: 0.5, v0: 2 },
  fields: [
    { k: 'gamma', label: 'вес метра гусеницы γ' },
    { k: 'l', label: 'расстояние между осями l, м' },
    { k: 'r', label: 'радиус колёс r, м' },
    { k: 'v0', label: 'скорость трактора v₀, м/с' },
  ],
  solve: (q, ex) => {
    const { gamma, l, r, v0 } = q.n;
    if (!pos(gamma, l, r, v0)) return fail(['Все данные — положительные числа.']);
    const top = (2 * gamma * l * v0 * v0) / G,
      arcs = (2 * gamma * Math.PI * r * v0 * v0) / G;
    const T = top + arcs;
    const steps = [
      stepEx(ex, 'Скорости звеньев', 'Нижняя ветвь гусеницы лежит на земле (скорость 0), верхняя движется со скоростью 2v₀. Звено на дуге у колеса: скорость 2v₀·cos(ψ/2), где ψ — угол от нижней точки.', eqB('верхняя ветвь: m = γl/g, v = 2v₀;  нижняя: v = 0', 'дуга: <v²> = 4v₀²·<cos²(ψ/2)> = 2v₀²,  m = γπr/g')),
      stepB('Кинетическая энергия', eqB(`T_верх = ½(γl/g)(2v₀)² = ${sg(top)}`, `T_дуг = 2·½(γπr/g)·2v₀² = ${sg(arcs)}`, `T = 2γ(l + πr)v₀²/g = ${sg(T)}`)),
      stepB('Ответ', ansB([[bold(`T = 2γ(l + πr)v₀²/g = ${sg(T)}`)], 'кинетическая энергия гусеницы'])),
    ];
    return done({ vals: { T }, steps });
  },
};

/* ---------- 38.51–38.53 ---------- */
export interface JwP {
  hypo: boolean;
  P: number;
  Q: number;
  R: number;
  r: number;
  M0: number;
  alpha: number;
  Mfr: number;
  w0: number;
  t: number;
  byWeight: boolean;
}
export function jw(p: JwP) {
  const m = p.byWeight ? 1 / G : 1;
  const arm = p.hypo ? p.R - p.r : p.R + p.r;
  const J = arm * arm * (m * p.P / 3 + (3 * m * p.Q) / 2);
  const Mfr = (p.Mfr * p.R) / p.r;
  return { J, arm, Mfr };
}
const A_JW: AskDef = {
  id: 'jw',
  title: '38.51–38.53: приведённый момент инерции и J·dω/dt = M(ω)',
  hint: 'Кривошип — тонкий однородный стержень, сателлит — однородный диск; неподвижная шестерня радиуса R.',
  n: { P: 2, Q: 1, R: 0.3, r: 0.1, M0: 10, alpha: 2, Mfr: 0.2, w0: 20, t: 1 },
  s: { kind: 'epi', unit: 'mass' },
  selects: [
    {
      k: 'kind',
      label: 'Механизм',
      options: [
        ['epi', 'эпициклический: разгон моментом M₀ − αω (38.51–38.52)'],
        ['hypo', 'гипоциклический: торможение трением (38.53)'],
      ],
    },
    {
      k: 'unit',
      label: 'Данные',
      options: [
        ['mass', 'массы m и M'],
        ['weight', 'веса P и Q (m = P/g)'],
      ],
    },
  ],
  fields: [
    { k: 'P', label: 'кривошип: масса m или вес P' },
    { k: 'Q', label: 'сателлит: масса M или вес Q' },
    { k: 'R', label: 'радиус неподвижной шестерни R, м' },
    { k: 'r', label: 'радиус сателлита r, м' },
    { k: 'M0', label: 'момент M₀ (движущий)', show: (q) => q.s.kind === 'epi' },
    { k: 'alpha', label: 'α в M = M₀ − αω (0 — постоянный)', show: (q) => q.s.kind === 'epi' },
    { k: 'Mfr', label: 'момент трения на оси сателлита (0 — нет)' },
    { k: 'w0', label: 'начальная ω₀ (в 38.53 — угловая скорость кривошипа), рад/с', show: (q) => q.s.kind === 'hypo' },
    { k: 't', label: 'время t, с (0 — не считать)', show: (q) => q.s.kind === 'epi' },
  ],
  solve: (q: ExtraProblem, ex) => {
    const n = q.n;
    const hypo = q.s.kind === 'hypo';
    if (!pos(n.P, n.Q, n.R, n.r) || !nn(n.M0, n.alpha, n.Mfr, n.w0, n.t) || (hypo && n.R <= n.r)) return fail(['Массы и радиусы — положительные; в гипоциклическом механизме R > r; моменты неотрицательные.']);
    const c = jw({ hypo, P: n.P, Q: n.Q, R: n.R, r: n.r, M0: n.M0, alpha: n.alpha, Mfr: n.Mfr, w0: n.w0, t: n.t, byWeight: q.s.unit === 'weight' });
    const mtxt = q.s.unit === 'weight' ? 'P/g' : 'm';
    const steps = [
      stepEx(
        ex,
        'Кинематика механизма',
        hypo ? 'Сателлит катится по неподвижному кольцу изнутри: центр сателлита движется со скоростью (R − r)ω, его абсолютная угловая скорость (R − r)ω/r в сторону, обратную ω.' : 'Сателлит катится по неподвижной шестерне снаружи: центр движется со скоростью (R + r)ω, абсолютная угловая скорость сателлита (R + r)ω/r.',
        eqB(hypo ? 'OO₁ = R − r,  v_O₁ = (R − r)ω,  ω_сат = (R − r)ω/r' : 'OO₁ = R + r,  v_O₁ = (R + r)ω,  ω_сат = (R + r)ω/r'),
      ),
      stepB(
        'Приведённый момент инерции',
        eqB(`T = ½·(${mtxt}·OO₁²/3)ω² + ½M·v_O₁² + ½·(Mr²/2)ω_сат²`, `J_пр = OO₁²·(${mtxt}/3 + 3M/2) = ${sg(c.J)}`, `T = ½J_пр·ω²  ⇒  теорема в дифференциальной форме:  J_пр·ω·dω/dt = N(ω)`),
      ),
    ];
    const vals: Record<string, number> = { J: c.J };
    if (!hypo) {
      const Me = n.M0 - c.Mfr;
      steps.push(
        stepEx(ex, 'Мощность', 'Момент трения на оси сателлита работает на относительном повороте сателлита ω_отн = ωR/r, то есть действует на кривошип как момент M_тр·R/r.', eqB(`J_пр·dω/dt = M₀ − αω − M_тр·R/r = ${sg(Me)} − ${sg(n.alpha)}ω`)),
      );
      if (Me <= 0) return fail(['Движущий момент не больше момента трения: механизм не тронется.']);
      const wInf = n.alpha > 0 ? Me / n.alpha : Infinity;
      const w = (t: number) => (n.alpha > 0 ? (Me / n.alpha) * (1 - Math.exp((-n.alpha * t) / c.J)) : (Me * t) / c.J);
      steps.push(stepB('Угловая скорость кривошипа', eqB(n.alpha > 0 ? `ω(t) = (M₀ − M_тр·R/r)/α·[1 − exp(−αt/J_пр)]` : `ω(t) = (M₀ − M_тр·R/r)·t/J_пр`, ...(n.alpha > 0 ? [`ω(∞) = ${sg(wInf)} рад/с`] : []), ...(n.t > 0 ? [`t = ${sg(n.t)} с:  ω = ${sg(w(n.t))} рад/с`] : []))));
      vals.wInf = wInf;
      if (n.t > 0) vals.w = w(n.t);
      steps.push(stepB('Ответ', ansB([[bold(`J_пр = ${sg(c.J)}`)], 'приведённый момент инерции'], [n.alpha > 0 ? `ω(t) = ${sg(Me / n.alpha)}·(1 − e^(−${sg(n.alpha / c.J)}·t))` : `ω = ${sg(Me / c.J)}·t`, 'угловая скорость кривошипа, рад/с'])));
      const tm = n.alpha > 0 ? (5 * c.J) / n.alpha : n.t > 0 ? n.t : 5;
      return done({ vals, steps, plot: { xl: 't, с', yl: 'ω, рад/с', series: [{ name: 'ω(t)', pts: sample(w, 0, Math.max(tm, n.t), 100) }] } });
    }
    if (n.Mfr <= 0) return fail(['Для торможения нужен момент трения M_тр > 0.']);
    steps.push(stepEx(ex, 'Мощность трения', 'Относительная угловая скорость сателлита и кривошипа — ωR/r; постоянный момент трения M_тр на оси сателлита отнимает мощность M_тр·ωR/r.', eqB('J_пр·ω·dω/dt = −M_тр·(R/r)·ω', 'J_пр·dω/dt = −M_тр·R/r')));
    const tau = (c.J * n.w0 * n.r) / (n.Mfr * n.R);
    const phi = (c.J * n.w0 * n.w0 * n.r) / (2 * n.Mfr * n.R);
    steps.push(stepB('Время и угол торможения', eqB('τ = J_пр·ω₀·r/(M_тр·R)', `τ = ${sg(tau)} с`, 'φ = J_пр·ω₀²·r/(2M_тр·R)', `φ = ${sg(phi)} рад = ${sg(phi / (2 * Math.PI))} оборота`)));
    steps.push(stepB('Ответ', ansB([[bold(`τ = ${sg(tau)} с`)], 'время торможения'], [bold(`φ = ${sg(phi)} рад`), 'угол поворота кривошипа за это время'])));
    return done({ vals: { ...vals, tau, phi }, steps, plot: { xl: 't, с', yl: 'ω, рад/с', series: [{ name: 'ω(t)', pts: [[0, n.w0], [tau, 0]] as [number, number][] }], marks: [{ x: tau, y: 0, label: `τ = ${sg(tau, 3)}` }] } });
  },
};

export const ENERGY_ASKS: AskDef[] = [A_ROD, A_LADDER, A_PULLEY, A_SLIDE, A_STOP2, A_TABLE, A_PEG, A_CABLE, A_CABLE48, A_TRACK, A_JW, ...ENERGY_ASKS_29];
void parB;
