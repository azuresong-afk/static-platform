/**
 * Пункт 29, «Кинетическая энергия»: задачи §38 с пространственным вращением и механизмами своей геометрии
 * и задание Яблонского Д.18.
 *
 *  - runners 38.8  — мельничные бегуны: ось CD вращается вокруг вертикали, бегуны катятся по дну чаши;
 *  - epi     38.27 — эпициклический механизм в горизонтальной плоскости под постоянным моментом: ω(φ);
 *  - cam     38.28 — эксцентрик сжимает пружину штанги: наименьшая ω, чтобы перевести штангу в крайнее положение;
 *  - yd18    Д.18  — тело A на колесе B с электродвигателем (b₁·dM/dt + b₂M = b₃ − αω): трогание, разгон
 *                    до установившейся скорости, тормозной путь двигателем и механическим тормозом.
 */
import { ansB, bold, eqB, fail, stepB, stepEx, sg, sample, type AskDef, type ExtraOut, type ExtraProblem } from '../../../shared/extra';

const G = 9.81;
const pos = (...x: number[]) => x.every((v) => v > 0 && Number.isFinite(v));
const done = (o: Omit<ExtraOut, 'ok' | 'errors'>): ExtraOut => ({ ok: true, errors: [], ...o });

/* ---------- 38.8 ---------- */
/** Бегуны: k одинаковых тонких дисков весом P, радиус r, центр на расстоянии l от вертикальной оси; n об/мин. */
export function runners(k: number, P: number, r: number, l: number, n: number) {
  const m = P / G;
  const W = (Math.PI * n) / 30;
  const wr = (W * l) / r;
  const Tc = (m * (W * l) ** 2) / 2;
  const Ta = ((m * r * r) / 2) * wr * wr * 0.5;
  const Td = ((m * r * r) / 4) * W * W * 0.5;
  return { W, wr, Tc, Ta, Td, T: k * (Tc + Ta + Td) };
}
const A_RUNNERS: AskDef = {
  id: 'runners',
  title: '38.8: бегуны — вращение вокруг двух осей',
  hint: 'Бегуны насажены на горизонтальную ось, которая вращается вокруг вертикальной оси; бегуны катятся без скольжения.',
  n: { k: 2, P: 200, D: 1, l: 0.5, n: 20 },
  fields: [
    { k: 'k', label: 'число бегунов' },
    { k: 'P', label: 'вес бегуна P, кГ' },
    { k: 'D', label: 'диаметр бегуна, м' },
    { k: 'l', label: 'расстояние центра бегуна от вертикальной оси l, м' },
    { k: 'n', label: 'частота вращения оси, об/мин' },
  ],
  solve: (q, ex) => {
    const { k, P, D, l, n } = q.n;
    if (!pos(k, P, D, l, n) || !Number.isInteger(k)) return fail(['Данные — положительные числа, число бегунов — целое.']);
    const r = D / 2;
    const c = runners(k, P, r, l, n);
    const steps = [
      stepEx(
        ex,
        'Угловые скорости бегуна',
        'Точка касания бегуна с дном неподвижна: скорость центра Ω·l от вращения вокруг вертикали равна ω₁·r от вращения бегуна вокруг своей оси. Абсолютная угловая скорость — сумма вертикальной Ω и горизонтальной ω₁; обе направлены по главным осям инерции диска.',
        eqB(`Ω = πn/30 = ${sg(c.W)} рад/с`, `v_C = Ω·l = ${sg(c.W * l)} м/с`, `ω₁ = Ω·l/r = ${sg(c.wr)} рад/с`),
      ),
      stepB(
        'Кинетическая энергия одного бегуна',
        eqB(
          'T₁ = ½m·v_C² + ½J_ось·ω₁² + ½J_диам·Ω²,   m = P/g,  J_ось = mr²/2,  J_диам = mr²/4',
          `T₁ = ${sg(c.Tc)} + ${sg(c.Ta)} + ${sg(c.Td)} = ${sg(c.Tc + c.Ta + c.Td)} кГм`,
        ),
      ),
      stepB('Ответ', ansB([[bold(`T = ${sg(k, 3)}·T₁ = ${sg(c.T)} кГм`)], 'кинетическая энергия бегунов'])),
    ];
    return done({ vals: { T: c.T }, steps });
  },
};

/* ---------- 38.27 ---------- */
/** Эпициклический механизм: кривошип (стержень весом Q), колесо II (диск весом P, радиус r₂) по неподвижному r₁. */
export function epiPhi(Q: number, P: number, r1: number, r2: number, M: number, phi: number) {
  const l = r1 + r2;
  const J = ((l * l) / G) * (Q / 3 + (3 * P) / 2);
  return { J, w: Math.sqrt((2 * M * phi) / J) };
}
const A_EPI: AskDef = {
  id: 'epi',
  title: '38.27: эпициклический механизм — ω кривошипа от угла поворота',
  hint: 'Механизм в горизонтальной плоскости, пуск из покоя постоянным моментом M на кривошипе; колесо II — однородный диск, кривошип — однородный стержень.',
  n: { Q: 2, P: 4, r1: 0.3, r2: 0.1, M: 1, phi: 3.1416 },
  fields: [
    { k: 'Q', label: 'вес кривошипа Q, кГ' },
    { k: 'P', label: 'вес колеса II P, кГ' },
    { k: 'r1', label: 'радиус неподвижного колеса r₁, м' },
    { k: 'r2', label: 'радиус колеса II r₂, м' },
    { k: 'M', label: 'вращающий момент M, кГм' },
    { k: 'phi', label: 'угол поворота кривошипа φ, рад' },
  ],
  solve: (q, ex) => {
    const { Q, P, r1, r2, M, phi } = q.n;
    if (!pos(Q, P, r1, r2, M, phi)) return fail(['Все данные — положительные числа.']);
    const c = epiPhi(Q, P, r1, r2, M, phi);
    const steps = [
      stepEx(
        ex,
        'Кинематика',
        'Колесо II катится по неподвижному колесу I: точка касания — мгновенный центр скоростей колеса II.',
        eqB('OA = r₁ + r₂,  v_A = (r₁ + r₂)ω,  ω_II = v_A/r₂ = (r₁ + r₂)ω/r₂'),
      ),
      stepB(
        'Кинетическая энергия',
        eqB('T = ½·(Q/g)(r₁ + r₂)²/3·ω² + ½(P/g)v_A² + ½·(P/g)r₂²/2·ω_II²', `T = ½J_пр·ω²,  J_пр = (r₁ + r₂)²(2Q + 9P)/(6g) = ${sg(c.J)} кГм·с²`),
      ),
      stepEx(
        ex,
        'Теорема об изменении кинетической энергии',
        'Механизм в горизонтальной плоскости: силы тяжести работы не совершают, работает только момент M.',
        eqB('½J_пр·ω² − 0 = M·φ', 'ω = 2/(r₁ + r₂)·√(3gMφ/(9P + 2Q))'),
      ),
      stepB('Ответ', ansB([[bold(`ω = ${sg(c.w)} рад/с`)], `угловая скорость кривошипа при φ = ${sg(phi)} рад`])),
    ];
    return done({
      vals: { J: c.J, w: c.w },
      steps,
      plot: { xl: 'φ, рад', yl: 'ω, рад/с', series: [{ name: 'ω(φ)', pts: sample((x) => Math.sqrt((2 * M * x) / c.J), 0, phi, 100) }] },
    });
  },
};

/* ---------- 38.28 ---------- */
/** Эксцентрик (диск радиуса R весом p, эксцентриситет e) сжимает пружину c на ход штанги 2e. */
export function cam(p: number, c: number, e: number, R: number) {
  const J = (p / G) * ((R * R) / 2 + e * e);
  return { J, w: Math.sqrt((c * (2 * e) ** 2) / J) };
}
const A_CAM: AskDef = {
  id: 'cam',
  title: '38.28: кулачковый механизм — ω эксцентрика для полного хода штанги',
  hint: 'Механизм в горизонтальной плоскости; эксцентрик — однородный круглый диск, массой ролика, штанги и пружины пренебречь. В крайнем левом положении пружина не напряжена.',
  n: { p: 2, c: 50, e: 0.05, R: 0.1 },
  fields: [
    { k: 'p', label: 'вес эксцентрика p, кГ' },
    { k: 'c', label: 'жёсткость пружины c, кГ/м' },
    { k: 'e', label: 'эксцентриситет e, м' },
    { k: 'R', label: 'радиус эксцентрика R, м (в книге R = 2e)' },
  ],
  solve: (q, ex) => {
    const { p, c, e, R } = q.n;
    if (!pos(p, c, e, R)) return fail(['Все данные — положительные числа.']);
    if (e >= R) return fail(['Эксцентриситет меньше радиуса эксцентрика.']);
    const r = cam(p, c, e, R);
    const steps = [
      stepEx(
        ex,
        'Ход штанги и работа пружины',
        'Ролик касается эксцентрика; за пол-оборота эксцентрика из крайнего левого в крайнее правое положение штанга проходит 2e, пружина сжимается на 2e.',
        eqB('A = −c(2e)²/2'),
      ),
      stepB('Кинетическая энергия эксцентрика', eqB('J_O = (p/g)(R²/2 + e²)', `J_O = ${sg(r.J)} кГм·с²`)),
      stepEx(
        ex,
        'Теорема об изменении кинетической энергии',
        'Наименьшая угловая скорость — та, при которой эксцентрик останавливается ровно в крайнем правом положении штанги.',
        eqB('0 − ½J_O·ω² = −c(2e)²/2', 'ω = 2e·√(c/J_O);  при R = 2e:  ω = 2√(cg/(3p))'),
      ),
      stepB('Ответ', ansB([[bold(`ω = ${sg(r.w)} рад/с`)], 'угловая скорость, которую надо сообщить эксцентрику'])),
    ];
    return done({ vals: { J: r.J, w: r.w }, steps });
  },
};

/* ---------- Яблонский, Д.18 ---------- */
export interface Yd18P {
  mA: number;
  mB: number;
  r: number;
  i: number;
  f: number;
  /** Центр масс C тела A: x_C = a (вперёд по движению), y_C = h (вверх) от оси O. */
  a: number;
  h: number;
  /** Точка опоры D тела A: x_D = b, глубина под осью c. При торможении — b₁, c₁ (опора D₁). */
  b: number;
  c: number;
  bb: number;
  cb: number;
  /** Корпус двигателя связан с телом A (реактивный момент M′ = M действует на A). */
  housing: boolean;
  alpha: number;
  b1: number;
  b2: number;
  b3: number;
  /** Доля установившейся скорости в конце торможения. */
  q: number;
  g: number;
}
/** Коэффициенты уравнения a₃ẍ = a₁M − a₂ для опоры (b, c). */
export function yd18Coef(p: Yd18P, b: number, c: number) {
  const mpr = p.mA + p.mB * (1 + (p.i * p.i) / (p.r * p.r));
  const d = b - p.f * c;
  const a1 = d / p.r + (p.housing ? p.f : 0);
  const a2 = p.f * p.a * p.mA * p.g;
  const a3 = mpr * d - p.f * p.h * p.mA;
  return { mpr, d, a1, a2, a3 };
}
export function yd18(p: Yd18P) {
  const k1 = yd18Coef(p, p.b, p.c);
  const { a1, a2, a3 } = k1;
  const Mn = a2 / a1;
  const Mmax = p.b3 / p.b2;
  const tau = (p.b1 / p.b2) * Math.log(p.b3 / (p.b3 - p.b2 * Mn));
  const n = p.b2 / (2 * p.b1);
  const k2 = (p.alpha * a1) / (p.r * a3 * p.b1);
  const k = Math.sqrt(k2);
  const D = (a1 * p.b3 - a2 * p.b2) / (a3 * p.b1);
  const vs = D / k2;
  const Ms = Mn;
  const kind: 'over' | 'crit' | 'under' = Math.abs(n - k) < 1e-12 * n ? 'crit' : n > k ? 'over' : 'under';
  const ks = Math.sqrt(Math.abs(n * n - k2));
  const v = (t: number) => {
    const s = t - tau;
    if (s <= 0) return 0;
    const e = Math.exp(-n * s);
    if (kind === 'over') return vs * (1 - e * (Math.cosh(ks * s) + (n / ks) * Math.sinh(ks * s)));
    if (kind === 'under') return vs * (1 - e * (Math.cos(ks * s) + (n / ks) * Math.sin(ks * s)));
    return vs * (1 - e * (1 + n * s));
  };
  const A = kind === 'over' ? (-D / (k * ks)) * Math.exp(n * tau) : NaN;
  const beta = kind === 'over' ? 0.5 * Math.log((n + ks) / (n - ks)) - ks * tau : NaN;
  // Торможение: опора D₁ (b₁, c₁) — коэффициенты свои; M = M* − α(x − x₁)/(r·b₁) (двигатель) или M = 0.
  const kb = yd18Coef(p, p.bb, p.cb);
  const dv2 = (1 - p.q * p.q) * vs * vs;
  // α·a₁′/(2r·b₁)·s² − (a₁′M* − a₂′)·s − a₃′(1 − q²)v*²/2 = 0
  const qa = (p.alpha * kb.a1) / (2 * p.r * p.b1),
    qb = -(kb.a1 * Ms - kb.a2),
    qc = (-kb.a3 * dv2) / 2;
  const s = (-qb + Math.sqrt(qb * qb - 4 * qa * qc)) / (2 * qa);
  const l = (kb.a3 * dv2) / (2 * kb.a2);
  return { ...k1, Mn, Mmax, tau, n, k, D, vs, Ms, kind, ks, A, beta, v, kb, s, l };
}
const A_YD18: AskDef = {
  id: 'yd18',
  title: 'Яблонский, Д.18: тело на колесе с двигателем — разгон и торможение',
  hint: 'Тело A опирается на ось колеса B и на шероховатую плоскость в точке D; колесо катится без скольжения, двигатель развивает момент b₁·dM/dt + b₂M = b₃ − αω. Координаты — от оси O колеса: x — по движению, y — вверх.',
  n: { mA: 20, mB: 100, r: 0.5, i: 0.4, f: 0.35, a: 1.4, h: 0.4, b: 2, c: 0.7, bb: 2, cb: 0.7, alpha: 2, b1: 0.025, b2: 0.25, b3: 50, q: 0.9, g: 9.81 },
  s: { housing: 'A', brake: 'same' },
  selects: [
    {
      k: 'housing',
      label: 'Корпус двигателя',
      options: [
        ['A', 'связан с телом A (варианты 1–7, 9, 11–20, 30)'],
        ['out', 'не связан с телами A и B (варианты 8, 10, 21–29)'],
      ],
    },
    {
      k: 'brake',
      label: 'Опора при торможении',
      options: [
        ['same', 'та же точка D'],
        ['D1', 'другая точка D₁ (варианты 9, 11, 30)'],
      ],
    },
  ],
  fields: [
    { k: 'mA', label: 'масса тела A m_A, кг' },
    { k: 'mB', label: 'масса колеса B m_B, кг' },
    { k: 'r', label: 'радиус колеса r, м' },
    { k: 'i', label: 'радиус инерции колеса i, м' },
    { k: 'f', label: 'коэффициент трения f' },
    { k: 'a', label: 'центр масс C: x_C = OH (вперёд «+»), м', neg: true, zero: true },
    { k: 'h', label: 'центр масс C: y_C = HC (вверх «+»), м', neg: true, zero: true },
    { k: 'b', label: 'опора D: x_D = OE (вперёд «+»), м', neg: true, zero: true },
    { k: 'c', label: 'опора D: глубина под осью ED, м', neg: true, zero: true },
    { k: 'bb', label: 'опора D₁ при торможении: x, м', neg: true, zero: true, show: (p: ExtraProblem) => p.s.brake === 'D1' },
    { k: 'cb', label: 'опора D₁ при торможении: глубина, м', neg: true, zero: true, show: (p: ExtraProblem) => p.s.brake === 'D1' },
    { k: 'alpha', label: 'α' },
    { k: 'b1', label: 'b₁' },
    { k: 'b2', label: 'b₂' },
    { k: 'b3', label: 'b₃' },
    { k: 'q', label: 'торможение до доли скорости v* (0,9)' },
    { k: 'g', label: 'g, м/с²' },
  ],
  solve: (q, ex) => {
    const n = q.n;
    if (!pos(n.mA, n.mB, n.r, n.i, n.f, n.alpha, n.b1, n.b2, n.b3, n.g) || !(n.q > 0 && n.q < 1) || ![n.a, n.h, n.b, n.c, n.bb, n.cb].every(Number.isFinite))
      return fail(['Массы, радиусы, f, α, b₁, b₂, b₃, g — положительные; доля скорости — от 0 до 1.']);
    const same = q.s.brake !== 'D1';
    const p: Yd18P = {
      mA: n.mA,
      mB: n.mB,
      r: n.r,
      i: n.i,
      f: n.f,
      a: n.a,
      h: n.h,
      b: n.b,
      c: n.c,
      bb: same ? n.b : n.bb,
      cb: same ? n.c : n.cb,
      housing: q.s.housing !== 'out',
      alpha: n.alpha,
      b1: n.b1,
      b2: n.b2,
      b3: n.b3,
      q: n.q,
      g: n.g,
    };
    const r = yd18(p);
    const errs: string[] = [];
    if (!(r.d > 0)) errs.push(`d = x_D − f·ED = ${sg(r.d)} ≤ 0: опора D не прижимается к плоскости — схема не та.`);
    if (!(r.a3 > 0) || !(r.a1 > 0)) errs.push('Коэффициенты a₁ или a₃ не положительны — проверьте координаты.');
    if (!(r.Mn < r.Mmax)) errs.push(`Момент двигателя не превысит b₃/b₂ = ${sg(r.Mmax)}, а для трогания нужно M_н = ${sg(r.Mn)}: система не тронется.`);
    if (!same && !(r.kb.d > 0 && r.kb.a3 > 0 && r.kb.a2 > 0)) errs.push('Опора D₁ при торможении задана неверно (d₁ ≤ 0 или a₃ ≤ 0).');
    if (same && !(r.a2 > 0)) errs.push('a₂ = f·a·m_A·g ≤ 0: без трения или при x_C ≤ 0 механическое торможение не задаётся этой формулой.');
    if (errs.length) return fail(errs);
    const fx = p.housing ? 'f + d/r' : 'd/r';
    const tEnd = r.tau + Math.max(6 / Math.min(r.n - (r.kind === 'over' ? r.ks : 0), r.n), 0.5);
    const steps = [
      stepEx(
        ex,
        'Теорема об изменении кинетической энергии',
        'Тело A движется поступательно, колесо B катится без скольжения: ω = ẋ/r. Мощность развивают момент M на колесе и сила трения X_D = f·Y_D; реактивный момент на корпусе работы не совершает (тело A не вращается).',
        eqB(
          'T = ½m_A ẋ² + ½m_B ẋ² + ½m_B i²ω² = ½m_пр ẋ²,   m_пр = m_A + m_B(1 + i²/r²)',
          `m_пр = ${sg(r.mpr)} кг`,
          'dT/dt = M·ω − X_D·ẋ   ⇒   m_пр ẍ = M/r − f·Y_D',
        ),
      ),
      stepEx(
        ex,
        'Принцип Даламбера для тела A',
        'Нормальная реакция Y_D неизвестна: её даёт уравнение моментов для тела A относительно оси O с силой инерции Φ = m_A ẍ (против ускорения).',
        eqB(
          `${p.housing ? 'M′ ' : ''}− m_A g·x_C + Y_D(x_D − f·ED) + m_A ẍ·y_C = 0${p.housing ? ',   M′ = M' : ''}`,
          `d = x_D − f·ED = ${sg(r.d)} м`,
          `a₃ẍ = a₁M − a₂:   a₁ = ${fx} = ${sg(r.a1)},  a₂ = f·x_C·m_A g = ${sg(r.a2)} Н·м,  a₃ = m_пр d − f·y_C·m_A = ${sg(r.a3)} кг·м`,
        ),
      ),
      stepEx(
        ex,
        'Момент до трогания и время τ',
        'До трогания ω = 0 и момент растёт по закону b₁ dM/dt + b₂M = b₃; система трогается, когда ẍ становится положительным: M > a₂/a₁.',
        eqB(
          `M(t) = (b₃/b₂)(1 − e^(−b₂t/b₁)) = ${sg(r.Mmax)}(1 − e^(−${sg(n.b2 / n.b1)}t))`,
          `M_н = a₂/a₁ = ${sg(r.Mn)} Н·м`,
          `τ = (b₁/b₂)·ln(b₃/(b₃ − b₂M_н)) = ${sg(r.tau)} с`,
        ),
      ),
      stepEx(
        ex,
        'Разгон: v(t) при t ≥ τ',
        'Исключая M из системы b₁ dM/dt + b₂M = b₃ − αv/r и a₃ dv/dt = a₁M − a₂, получаем линейное уравнение второго порядка; начальные условия v(τ) = 0, dv/dt(τ) = 0.',
        eqB(
          'd²v/dt² + 2n·dv/dt + k²v = D',
          `n = b₂/(2b₁) = ${sg(r.n)} с⁻¹,  k = √(αa₁/(r·a₃·b₁)) = ${sg(r.k)} с⁻¹,  D = (a₁b₃ − a₂b₂)/(a₃b₁) = ${sg(r.D)} м/с³`,
          ...(r.kind === 'over'
            ? [
                `n > k:  k* = √(n² − k²) = ${sg(r.ks)} с⁻¹`,
                `v = A·e^(−nt)·sh(k*t + β) + D/k²,  A = −D·e^(nτ)/(k·k*) = ${sg(r.A)} м/с,  β = ½ln((n + k*)/(n − k*)) − k*τ = ${sg(r.beta)}`,
              ]
            : r.kind === 'under'
              ? [`n < k:  k₁ = √(k² − n²) = ${sg(r.ks)} с⁻¹`, 'v = v*[1 − e^(−n(t − τ))(cos k₁(t − τ) + (n/k₁) sin k₁(t − τ))]']
              : ['n = k:  v = v*[1 − e^(−n(t − τ))(1 + n(t − τ))]']),
          `v* = D/k² = ${sg(r.vs)} м/с,   M* = a₂/a₁ = ${sg(r.Ms)} Н·м`,
        ),
      ),
      stepEx(
        ex,
        'Торможение',
        'Теорема в конечной форме вместе с проинтегрированным по x уравнением моментов для тела A (исключается ∫Y_D dx) — то же уравнение a₃ẍ = a₁M − a₂ по пути. Двигатель-тормоз: b₁ dM/dt = −αω, M = M* − αx/(r·b₁); механический тормоз: M = 0.',
        eqB(
          ...(same ? [] : [`опора D₁: d₁ = ${sg(r.kb.d)} м,  a₁′ = ${sg(r.kb.a1)},  a₂′ = ${sg(r.kb.a2)} Н·м,  a₃′ = ${sg(r.kb.a3)} кг·м`]),
          same
            ? `1-й режим:  a₃(q² − 1)v*²/2 = −αa₁s²/(2r·b₁)   ⇒   s = v*·√(a₃·r·b₁·(1 − q²)/(αa₁)) = ${sg(r.s)} м`
            : `1-й режим:  a₃′(q² − 1)v*²/2 = (a₁′M* − a₂′)s − αa₁′s²/(2r·b₁)   ⇒   s = ${sg(r.s)} м`,
          `2-й режим (M = 0):  l = a₃${same ? '' : '′'}(1 − q²)v*²/(2a₂${same ? '' : '′'}) = ${sg(r.l)} м`,
        ),
      ),
      stepB(
        'Ответ',
        ansB(
          [[bold(`M(t) = ${sg(r.Mmax)}(1 − e^(−${sg(n.b2 / n.b1)}t)) при 0 ≤ t ≤ τ`)], 'момент на этапе до трогания, Н·м'],
          [[bold(`M_н = ${sg(r.Mn)} Н·м,  τ = ${sg(r.tau)} с`)], 'момент трогания и время до начала движения'],
          [[bold(`v* = ${sg(r.vs)} м/с,  M* = ${sg(r.Ms)} Н·м`)], 'установившиеся скорость и момент'],
          [[bold(`s = ${sg(r.s)} м,  l = ${sg(r.l)} м`)], `тормозной путь до ${sg(n.q, 3)}v*: двигателем и механическим тормозом`],
        ),
      ),
    ];
    const vals: Record<string, number> = {
      mpr: r.mpr,
      d: r.d,
      a1: r.a1,
      a2: r.a2,
      a3: r.a3,
      Mn: r.Mn,
      tau: r.tau,
      n: r.n,
      k: r.k,
      D: r.D,
      vs: r.vs,
      Ms: r.Ms,
      s: r.s,
      l: r.l,
    };
    if (r.kind === 'over') Object.assign(vals, { ks: r.ks, A: r.A, beta: r.beta });
    return done({
      vals,
      steps,
      plot: { xl: 't, с', yl: 'v, м/с', series: [{ name: 'v(t)', pts: sample(r.v, 0, tEnd, 160) }], marks: [{ x: r.tau, y: 0, label: `τ = ${sg(r.tau, 3)}` }] },
    });
  },
};

export const ENERGY_ASKS_29: AskDef[] = [A_RUNNERS, A_EPI, A_CAM, A_YD18];
