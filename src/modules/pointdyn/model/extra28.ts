/**
 * Пункт 28, «Динамика точки»: силы по закону движения (§26), обратная задача о колечке с пружиной (§31), маятник
 * с движущейся точкой подвеса и относительное равновесие (§33), сила, заданная графиком (Яблонский, Д.5).
 *
 *  - press   26.25 — груз A колеблется на пружине над грузом B: R = P_A + P_B ± m_A·a·ω², ω = 2π/T;
 *  - weigh   26.28 — показание пружинных весов на другом небесном теле: P₁ = P·g₁/g;
 *  - swing   26.30 — натяжение нити маятника при заданном φ(t): T = m(g cos φ + l·φ̇²);
 *  - ring    31.14 — колечко на гладком кольце, пружина от верхней точки A: жёсткость, при которой давление в нижней
 *              точке B равно нулю (или давление при заданной жёсткости);
 *  - susp    33.2–33.3 — точка подвеса движется по вертикали с ускорением p: g′ = g + p (вверх) или g − p (вниз);
 *  - car     33.6 — маятник в вагоне с ускорением w: tg θ = w/g, T₁ = T·√cos θ;
 *  - hsusp   33.7 — подвес колеблется горизонтально: φ̈ + k²φ = (a p²/l) sin pt;
 *  - piston  33.8 — тележка на пружине в крейцкопфе: ξ̈ + k²ξ = lΩ² cos Ωt, η = rωt;
 *  - graph   Яблонский Д.5 — тело на шероховатой наклонной плоскости, сила P(t) по графику (кусочно-линейная).
 */
import { evalExpr, parseExpr } from '../../../shared/expr';
import { parseNum } from '../../../shared/format';
import { ansB, bold, eqB, fail, parB, sample, sg, stepB, stepEx, type AskDef, type ExtraOut, type Ln } from '../../../shared/extra';

const G = 9.81;
const D2R = Math.PI / 180;
const pos = (...x: number[]) => x.every((v) => v > 0 && Number.isFinite(v));
const done = (o: Omit<ExtraOut, 'ok' | 'errors'>): ExtraOut => ({ ok: true, errors: [], ...o });

/* ---------- 26.25 ---------- */
const A_PRESS: AskDef = {
  id: 'press',
  title: '26.25: давление на опору при колебаниях груза на пружине',
  hint: 'Груз A колеблется по вертикали на пружине, опирающейся на груз B; найти наибольшее и наименьшее давление грузов на опору.',
  n: { PA: 20, PB: 40, a: 0.01, T: 0.25, g: G },
  fields: [
    { k: 'PA', label: 'вес груза A, P_A' },
    { k: 'PB', label: 'вес груза B, P_B' },
    { k: 'a', label: 'амплитуда колебаний a, м' },
    { k: 'T', label: 'период T, с' },
    { k: 'g', label: 'g, м/с²' },
  ],
  solve: (q, ex) => {
    const { PA, PB, a, T, g } = q.n;
    if (!pos(PA, T, g) || !(PB >= 0) || !(a >= 0)) return fail(['P_A, T, g — положительные; P_B и a — неотрицательные.']);
    const w = (2 * Math.PI) / T;
    const dP = (PA / g) * a * w * w;
    const Rmax = PA + PB + dP,
      Rmin = PA + PB - dP;
    const steps = [
      stepEx(
        ex,
        'Ускорение груза A',
        'Груз A движется по закону x = a sin ωt; его ускорение по модулю наибольшее в крайних положениях: a·ω².',
        eqB(`ω = 2π/T = ${sg(w)} 1/с`, `a_max = a·ω² = ${sg(a * w * w)} м/с²`),
      ),
      stepEx(
        ex,
        'Давление на опору',
        'Система грузов A и B: внешние силы — веса и реакция опоры R; по теореме о движении центра масс R − P_A − P_B = m_A·ẍ_A (груз B неподвижен). В нижнем положении ускорение A направлено вверх — давление наибольшее, в верхнем — вниз, наименьшее.',
        eqB('R = P_A + P_B + (P_A/g)·ẍ_A', `R_max = P_A + P_B + (P_A/g)aω² = ${sg(Rmax)}`, `R_min = P_A + P_B − (P_A/g)aω² = ${sg(Rmin)}`),
      ),
      ...(Rmin < 0 ? [stepB('Замечание', { k: 'badge', tone: 'warn', text: 'R_min < 0: груз B отрывается от опоры, и формула верна только до отрыва' })] : []),
      stepB('Ответ', ansB([[bold(`R_max = ${sg(Rmax)}`)], 'наибольшее давление (в единицах веса)'], [[bold(`R_min = ${sg(Rmin)}`)], 'наименьшее давление'])),
    ];
    const pts = sample((t) => PA + PB + dP * Math.sin(w * t), 0, 2 * T, 120);
    return done({ vals: { Rmax, Rmin }, steps, plot: { xl: 't, с', yl: 'R', series: [{ name: 'R(t)', pts }] } });
  },
};

/* ---------- 26.28 ---------- */
const A_WEIGH: AskDef = {
  id: 'weigh',
  title: '26.28: показание пружинных весов на другом небесном теле',
  hint: 'Пружинные весы показывают силу, с которой тело давит на них: P₁ = m·g₁ = P·g₁/g; масса тела та же, что на Земле.',
  n: { P: 1, g: G, g1: 1.7, g2: 270 },
  fields: [
    { k: 'P', label: 'вес на Земле P' },
    { k: 'g', label: 'g на Земле, м/с²' },
    { k: 'g1', label: 'ускорение притяжения g₁ на первом теле, м/с²' },
    { k: 'g2', label: 'g₂ на втором теле, м/с² (0 — нет)' },
  ],
  solve: (q, ex) => {
    const { P, g, g1, g2 } = q.n;
    if (!pos(P, g, g1) || !(g2 >= 0)) return fail(['P, g, g₁ — положительные; g₂ — неотрицательное.']);
    const P1 = (P * g1) / g,
      P2 = (P * g2) / g;
    const steps = [
      stepEx(
        ex,
        'Масса не меняется',
        'Вес — сила притяжения к планете, масса — мера инертности; пружинные весы измеряют силу, а не массу.',
        eqB(`m = P/g = ${sg(P / g)}`),
      ),
      stepB('Показания весов', eqB(`P₁ = m·g₁ = P·g₁/g = ${sg(P1)}`, ...(g2 > 0 ? [`P₂ = P·g₂/g = ${sg(P2)}`] : []))),
      stepB('Ответ', ansB([[bold(`P₁ = ${sg(P1)}`)], 'на первом теле'], ...(g2 > 0 ? [[[bold(`P₂ = ${sg(P2)}`)], 'на втором теле'] as [Ln, string]] : []))),
    ];
    return done({ vals: { P1, P2 }, steps });
  },
};

/* ---------- 26.30 ---------- */
const A_SWING: AskDef = {
  id: 'swing',
  title: '26.30: натяжение нити маятника при заданном законе φ(t)',
  hint: 'Груз на нити длиной l качается по закону φ(t) (радианы, t — время). Натяжение T = m(g cos φ + l·φ̇²); наибольшее и наименьшее за время от 0 до t₁.',
  n: { P: 10, l: 2, g: G, t1: 1 },
  s: { phi: 'pi/6*sin(2*pi*t)' },
  fields: [
    { k: 'phi', label: 'закон φ(t), рад', text: true, vars: [] },
    { k: 'P', label: 'вес груза P' },
    { k: 'l', label: 'длина нити l, м' },
    { k: 'g', label: 'g, м/с²' },
    { k: 't1', label: 'рассматриваемый промежуток 0…t₁, с' },
  ],
  solve: (q, ex) => {
    const { P, l, g, t1 } = q.n;
    if (!pos(P, l, g, t1)) return fail(['Все числа — положительные.']);
    const e = parseExpr(q.s.phi, { vars: [] });
    if (!e.ok) return fail([`Формула φ(t): ${e.error}.`]);
    const phi = (t: number) => evalExpr(e.e, t);
    const dphi = (t: number) => {
      const h = 1e-5 * Math.max(1, Math.abs(t));
      return (phi(t + h) - phi(t - h)) / (2 * h);
    };
    const m = P / g;
    const T = (t: number) => m * (g * Math.cos(phi(t)) + l * dphi(t) ** 2);
    const N = 4000;
    let tMax = 0,
      tMin = 0;
    for (let i = 0; i <= N; i++) {
      const t = (t1 * i) / N;
      if (!Number.isFinite(T(t))) return fail([`Формула φ(t) не определена при t = ${sg(t)} с.`]);
      if (T(t) > T(tMax)) tMax = t;
      if (T(t) < T(tMin)) tMin = t;
    }
    // уточнение экстремумов золотым сечением в окрестности узла
    const refine = (t0: number, s: 1 | -1) => {
      let a = Math.max(0, t0 - t1 / N),
        b = Math.min(t1, t0 + t1 / N);
      for (let i = 0; i < 60; i++) {
        const c = b - (b - a) * 0.618,
          d = a + (b - a) * 0.618;
        if (s * T(c) > s * T(d)) b = d;
        else a = c;
      }
      return (a + b) / 2;
    };
    tMax = refine(tMax, 1);
    tMin = refine(tMin, -1);
    const Tmax = T(tMax),
      Tmin = T(tMin);
    const steps = [
      stepEx(
        ex,
        'Уравнение в проекции на нить',
        'Груз движется по окружности радиуса l; нормальное ускорение l·φ̇² направлено к точке подвеса. Проекция второго закона Ньютона на нить: m·l·φ̇² = T − mg cos φ.',
        eqB('T = m(g cos φ + l·φ̇²),  m = P/g'),
      ),
      stepB('Наибольшее натяжение', eqB(`t = ${sg(tMax)} с:  φ = ${sg(phi(tMax))} рад,  φ̇ = ${sg(dphi(tMax))} рад/с`, `T_max = ${sg(Tmax)}`)),
      stepB('Наименьшее натяжение', eqB(`t = ${sg(tMin)} с:  φ = ${sg(phi(tMin))} рад,  φ̇ = ${sg(dphi(tMin))} рад/с`, `T_min = ${sg(Tmin)}`)),
      stepEx(
        ex,
        'Проверка по положениям',
        'В нижнем положении (φ = 0) скорость наибольшая, cos φ = 1 — натяжение наибольшее; в крайнем положении φ̇ = 0 и натяжение равно P cos φ_max.',
        parB('Для гармонического закона φ = φ₀ sin kt: T₁ = P(1 + l φ₀²k²/g), T₂ = P cos φ₀.'),
      ),
      stepB(
        'Ответ',
        ansB(
          [[bold(`T_max = ${sg(Tmax)}`)], 'натяжение в нижнем положении (в единицах веса)'],
          [[bold(`T_min = ${sg(Tmin)}`)], 'в крайнем (наивысшем) положении'],
        ),
      ),
    ];
    return done({ vals: { Tmax, Tmin }, steps, plot: { xl: 't, с', yl: 'T', series: [{ name: 'T(t)', pts: sample(T, 0, t1, 200) }] } });
  },
};

/* ---------- 31.14 ---------- */
const A_RING: AskDef = {
  id: 'ring',
  title: '31.14: колечко на кольце с пружиной — жёсткость, при которой давление в нижней точке равно нулю',
  hint: 'Колечко M скользит без трения по кольцу радиуса R в вертикальной плоскости; пружина прикреплена к верхней точке A. Начальное положение — хорда AM₀ = s₀, скорость нуль.',
  n: { R: 0.2, P: 5, s0: 0.2, L0: 0.2, c: 50 },
  s: { find: 'c' },
  selects: [
    {
      k: 'find',
      label: 'Что найти',
      options: [
        ['c', 'жёсткость c, при которой давление в нижней точке B равно нулю'],
        ['N', 'давление в нижней точке B при заданной жёсткости'],
      ],
    },
  ],
  fields: [
    { k: 'R', label: 'радиус кольца R, м' },
    { k: 'P', label: 'вес колечка P' },
    { k: 's0', label: 'начальная хорда AM₀ = s₀, м' },
    { k: 'L0', label: 'длина пружины без натяжения L₀, м' },
    { k: 'c', label: 'жёсткость c (сила на 1 м)', show: (p) => p.s.find === 'N' },
  ],
  solve: (q, ex) => {
    const { R, P, s0, L0 } = q.n;
    if (!pos(R, P, L0) || !(s0 > 0 && s0 < 2 * R)) return fail(['R, P, L₀ — положительные; 0 < s₀ < 2R.']);
    const h0 = (s0 * s0) / (2 * R); // глубина начальной точки под A: s² = 2R·h
    const d = 2 * R - L0; // удлинение пружины в нижней точке
    const d0 = s0 - L0;
    const coef = d + (d * d - d0 * d0) / R;
    const rhs = P + ((2 * P) / R) * (2 * R - h0);
    const steps = [
      stepEx(
        ex,
        'Геометрия',
        'Хорда AM длины s и глубина точки M под A связаны так: s² = 2R·h (прямоугольный треугольник с диаметром AB). Длина пружины равна хорде AM.',
        eqB(`h₀ = s₀²/(2R) = ${sg(h0)} м,  глубина B: 2R = ${sg(2 * R)} м`, `удлинение пружины: в M₀ — ${sg(d0)} м, в B — ${sg(d)} м`),
      ),
      stepEx(
        ex,
        'Скорость в нижней точке',
        'Теорема об изменении кинетической энергии: работа тяжести P(2R − h₀) минус приращение энергии пружины.',
        eqB('m v_B²/2 = P(2R − h₀) − c[(2R − L₀)² − (s₀ − L₀)²]/2'),
      ),
      stepEx(
        ex,
        'Уравнение в нижней точке',
        'Нормаль направлена вверх, к центру кольца: пружина тянет вверх с силой c(2R − L₀), вес — вниз, реакция кольца N (к центру).',
        eqB('m v_B²/R = N + c(2R − L₀) − P'),
      ),
    ];
    if (q.s.find === 'c') {
      if (!(coef > 0)) return fail(['При этих размерах давление в нижней точке нельзя обратить в нуль пружиной.']);
      const c = rhs / coef;
      steps.push(
        stepB(
          'Жёсткость',
          eqB(
            'N = 0:  c(2R − L₀) − P = (2/R)·{P(2R − h₀) − c[(2R − L₀)² − (s₀ − L₀)²]/2}',
            `c = [P + 2P(2R − h₀)/R] / [(2R − L₀) + ((2R − L₀)² − (s₀ − L₀)²)/R] = ${sg(c)} на 1 м`,
          ),
        ),
        stepB('Ответ', ansB([[bold(`c = ${sg(c)} на 1 м = ${sg(c / 100)} на 1 см`)], 'жёсткость пружины (сила в единицах веса)'])),
      );
      return done({ vals: { c, ccm: c / 100 }, steps });
    }
    const c = q.n.c;
    if (!(c >= 0)) return fail(['Жёсткость — неотрицательная.']);
    const mv2 = 2 * (P * (2 * R - h0) - (c * (d * d - d0 * d0)) / 2);
    if (mv2 < 0) return fail(['Колечко не дойдёт до нижней точки: пружина остановит его раньше.']);
    const N = mv2 / R - c * d + P;
    steps.push(
      stepB('Реакция', eqB(`m v_B² = ${sg(mv2)},  N = m v_B²/R − c(2R − L₀) + P = ${sg(N)}`)),
      stepB(
        'Ответ',
        ansB([
          [bold(`N = ${sg(N)}`)],
          N >= 0
            ? 'кольцо давит на колечко вверх; колечко давит на кольцо вниз с той же силой'
            : 'N < 0: колечко прижато к кольцу снаружи (давление направлено вверх)',
        ]),
      ),
    );
    return done({ vals: { N }, steps });
  },
};

/* ---------- 33.2–33.3 ---------- */
const A_SUSP: AskDef = {
  id: 'susp',
  title: '33.2–33.3: маятник, точка подвеса движется по вертикали с ускорением',
  hint: 'Точка подвеса движется по вертикали равноускоренно. В системе подвеса на груз действует переносная сила инерции −m·p: «эффективное» ускорение тяжести g + p (ускорение вверх) или g − p (вниз).',
  n: { l: 1, p: 2, alpha: 30, g: G },
  fields: [
    { k: 'l', label: 'длина маятника l, м' },
    { k: 'p', label: 'ускорение точки подвеса p, м/с²' },
    { k: 'alpha', label: 'начальное отклонение α, ° (для 33.3)' },
    { k: 'g', label: 'g, м/с²' },
  ],
  solve: (q, ex) => {
    const { l, p, alpha, g } = q.n;
    if (!pos(l, g) || !(p >= 0) || !(alpha > 0 && alpha < 180)) return fail(['l, g — положительные, p ≥ 0, 0 < α < 180°.']);
    const Tup = 2 * Math.PI * Math.sqrt(l / (g + p));
    const Tdn = p < g ? 2 * Math.PI * Math.sqrt(l / (g - p)) : NaN;
    const a = alpha * D2R;
    const s = p === g ? 0 : p > g ? 2 * l * (Math.PI - a) : 2 * l * a;
    const steps = [
      stepEx(
        ex,
        'Относительное движение',
        'Уравнение относительного движения: m·w_r = mg + T + Φ_e, Φ_e = −m·p (переносная сила инерции поступательно движущейся системы). Тяжесть и сила инерции складываются в «эффективную тяжесть» m(g − p) с учётом направлений.',
        eqB('ускорение вверх: g′ = g + p;  вниз: g′ = g − p'),
      ),
      stepB(
        'Период малых колебаний',
        eqB(`1) вверх: T = 2π√(l/(g + p)) = ${sg(Tup)} с`, p < g ? `2) вниз (p < g): T = 2π√(l/(g − p)) = ${sg(Tdn)} с` : '2) вниз при p ≥ g колебаний нет'),
      ),
      stepEx(
        ex,
        'Подвес опускается из покоя (33.3)',
        'Если p = g, эффективная тяжесть нуль: груз, имевший нулевую относительную скорость, остаётся в покое относительно подвеса. Если p > g, эффективная тяжесть направлена вверх: груз «падает» вверх и проходит через верхнее положение до симметричного отклонения — дуга 2l(π − α). При p < g — колебания с амплитудой α: за полупериод дуга 2lα.',
        eqB(`s = ${p === g ? '0' : p > g ? '2l(π − α)' : '2lα (за полупериод)'} = ${sg(s)} м`),
      ),
      stepB(
        'Ответ',
        ansB([[bold(`T = ${sg(Tup)} с`)], 'ускорение подвеса вверх'], ...(p < g ? [[[bold(`T = ${sg(Tdn)} с`)], 'ускорение вниз'] as [Ln, string]] : []), [
          [`s = ${sg(s)} м`],
          'дуга относительного движения при опускании подвеса',
          'aux',
        ]),
      ),
    ];
    return done({ vals: { Tup, Tdn, s }, steps });
  },
};

/* ---------- 33.6 ---------- */
const A_CAR: AskDef = {
  id: 'car',
  title: '33.6: маятник в вагоне, движущемся с ускорением',
  hint: 'Вагон движется горизонтально с ускорением w; среднее положение маятника отклонено на угол θ: tg θ = w/g. Период малых колебаний определяется эффективной тяжестью √(g² + w²).',
  n: { theta: 6, w: 1, g: G },
  s: { given: 'theta' },
  selects: [
    {
      k: 'given',
      label: 'Что задано',
      options: [
        ['theta', 'угол отклонения среднего положения θ'],
        ['w', 'ускорение вагона w'],
      ],
    },
  ],
  fields: [
    { k: 'theta', label: 'угол θ, °', show: (p) => p.s.given === 'theta' },
    { k: 'w', label: 'ускорение w, м/с²', show: (p) => p.s.given === 'w' },
    { k: 'g', label: 'g, м/с²' },
  ],
  solve: (q, ex) => {
    const g = q.n.g;
    if (!pos(g)) return fail(['g > 0.']);
    let th: number, w: number;
    if (q.s.given === 'w') {
      w = q.n.w;
      if (!(w >= 0)) return fail(['w ≥ 0.']);
      th = Math.atan2(w, g);
    } else {
      th = q.n.theta * D2R;
      if (!(th >= 0 && th < Math.PI / 2)) return fail(['0 ≤ θ < 90°.']);
      w = g * Math.tan(th);
    }
    const r = Math.sqrt(Math.cos(th));
    const steps = [
      stepEx(
        ex,
        'Относительное равновесие',
        'В системе вагона к тяжести добавляется переносная сила инерции −m·w (горизонтально, против ускорения). Среднее положение нити — по направлению их суммы.',
        eqB(`tg θ = w/g:  θ = ${sg(th / D2R)}°,  w = ${sg(w)} м/с²`),
      ),
      stepEx(
        ex,
        'Период',
        'Малые колебания около отклонённого положения происходят под действием эффективной тяжести g′ = √(g² + w²) = g/cos θ.',
        eqB('T₁ = 2π√(l/g′) = T·√cos θ', `T₁/T = ${sg(r, 6)},  (T − T₁)/T = ${sg(1 - r)}`),
      ),
      stepB('Ответ', ansB([[bold(`w = ${sg(w)} м/с²`)], 'ускорение вагона'], [[bold(`T − T₁ = ${sg(1 - r)}·T`)], 'разность периодов'])),
    ];
    return done({ vals: { w, theta: th / D2R, dT: 1 - r }, steps });
  },
};

/* ---------- 33.7 ---------- */
const A_HSUSP: AskDef = {
  id: 'hsusp',
  title: '33.7: подвес маятника колеблется горизонтально',
  hint: 'Точка подвеса O₁ движется по горизонтали: OO₁ = a sin pt; маятник длиной l в начальный момент покоится. Малые колебания: φ̈ + k²φ = (a p²/l) sin pt, k² = g/l.',
  n: { l: 1, a: 0.02, p: 2, g: G },
  fields: [
    { k: 'l', label: 'длина l, м' },
    { k: 'a', label: 'амплитуда подвеса a, м' },
    { k: 'p', label: 'частота подвеса p, 1/с' },
    { k: 'g', label: 'g, м/с²' },
  ],
  solve: (q, ex) => {
    const { l, a, p, g } = q.n;
    if (!pos(l, a, p, g)) return fail(['Все числа — положительные.']);
    const k = Math.sqrt(g / l);
    if (Math.abs(k - p) < 1e-9 * k) return fail([`Резонанс: p = k = ${sg(k)} 1/с — амплитуда растёт со временем, формула решения другая.`]);
    const A = (a * p * p) / (l * (k * k - p * p));
    const phi = (t: number) => A * (Math.sin(p * t) - (p / k) * Math.sin(k * t));
    const steps = [
      stepEx(
        ex,
        'Уравнение относительного движения',
        'В системе, движущейся с подвесом поступательно, на груз действует переносная сила инерции −m·ẍ₁ = m a p² sin pt (горизонтально). Её момент относительно O₁ при малых φ: m a p² l sin pt.',
        eqB('m l² φ̈ = −m g l φ + m a p² l sin pt', 'φ̈ + k²φ = (a p²/l) sin pt,  k² = g/l'),
      ),
      stepEx(
        ex,
        'Решение при нулевых начальных условиях',
        'Общее решение — свободные колебания с частотой k плюс вынужденные с частотой p; постоянные — из φ(0) = 0, φ̇(0) = 0.',
        eqB('φ = a p²/(l(k² − p²))·(sin pt − (p/k) sin kt)', `k = ${sg(k)} 1/с,  a p²/(l(k² − p²)) = ${sg(A)} рад`),
      ),
      stepB('Ответ', ansB([[bold(`φ = ${sg(A)}·(sin ${sg(p)}t − ${sg(p / k)} sin ${sg(k)}t)`)], 'малые колебания маятника, рад'])),
    ];
    const Tm = (2 * Math.PI) / Math.min(k, p);
    return done({ vals: { A, k }, steps, plot: { xl: 't, с', yl: 'φ, рад', series: [{ name: 'φ(t)', pts: sample(phi, 0, 4 * Tm, 300) }] } });
  },
};

/* ---------- 33.8 ---------- */
const A_PISTON: AskDef = {
  id: 'piston',
  title: '33.8: прибор для записи ускорений поршня (тележка на пружине в крейцкопфе)',
  hint: 'Крейцкопф движется по закону x = a + l cos Ωt; тележка весом Q связана с ним пружиной c; карандаш тележки пишет на барабане радиуса r, вращающемся с угловой скоростью ω.',
  n: { Q: 1, c: 100, l: 0.1, W: 20, r: 0.05, w: 1, g: G, xi0: 0, v0: 0 },
  fields: [
    { k: 'Q', label: 'вес тележки Q' },
    { k: 'c', label: 'жёсткость пружины c (сила на 1 м)' },
    { k: 'l', label: 'параметр l в законе x = a + l cos Ωt, м' },
    { k: 'W', label: 'угловая скорость маховика Ω, 1/с' },
    { k: 'r', label: 'радиус барабана r, м' },
    { k: 'w', label: 'угловая скорость барабана ω, 1/с' },
    { k: 'g', label: 'g, м/с²' },
    { k: 'xi0', label: 'начальное смещение тележки ξ₀, м', neg: true },
    { k: 'v0', label: 'начальная относительная скорость ξ̇₀, м/с', neg: true },
  ],
  solve: (q, ex) => {
    const { Q, c, l, W, r, w, g, xi0, v0 } = q.n;
    if (!pos(Q, c, l, W, r, w, g)) return fail(['Q, c, l, Ω, r, ω, g — положительные.']);
    const k = Math.sqrt((c * g) / Q);
    if (Math.abs(k - W) < 1e-9 * k) return fail(['Резонанс: Ω = √(cg/Q).']);
    const B = (Q * l * W * W) / (c * g - Q * W * W);
    const A0 = xi0 - B,
      B0 = v0 / k;
    const xi = (t: number) => A0 * Math.cos(k * t) + B0 * Math.sin(k * t) + B * Math.cos(W * t);
    const steps = [
      stepEx(
        ex,
        'Относительное движение тележки',
        'Начало подвижной системы — крейцкопф; ξ — смещение тележки относительно него от положения, где пружина не деформирована. Переносная сила инерции −(Q/g)ẍ = (Q/g)lΩ² cos Ωt.',
        eqB('(Q/g) ξ̈ = −c ξ + (Q/g) l Ω² cos Ωt', `ξ̈ + k²ξ = lΩ² cos Ωt,  k = √(cg/Q) = ${sg(k)} 1/с`),
      ),
      stepB(
        'Решение',
        eqB(
          'ξ = A cos kt + B sin kt + Q l Ω²/(cg − QΩ²)·cos Ωt,  η = r ω t',
          `Q l Ω²/(cg − QΩ²) = ${sg(B)} м;  A = ξ₀ − ${sg(B)} = ${sg(A0)},  B = ξ̇₀/k = ${sg(B0)}`,
        ),
      ),
      stepEx(
        ex,
        'Кривая на ленте',
        'Лента барабана движется со скоростью rω поперёк хода тележки: координата η = rωt вдоль ленты, ξ — поперёк. Вынужденная часть ξ пропорциональна ускорению крейцкопфа −lΩ² cos Ωt — отсюда назначение прибора.',
        parB(`Вынужденные колебания: амплитуда ${sg(Math.abs(B))} м${B < 0 ? ' (в противофазе: Ω > k)' : ''}.`),
      ),
      stepB(
        'Ответ',
        ansB(
          [[bold(`ξ = ${sg(A0)} cos ${sg(k)}t + ${sg(B0)} sin ${sg(k)}t + ${sg(B)} cos ${sg(W)}t`)], 'координата карандаша поперёк ленты, м'],
          [`η = ${sg(r * w)}·t`, 'вдоль ленты, м', 'aux'],
        ),
      ),
    ];
    const t1 = (4 * Math.PI) / W;
    const pts = sample((t) => t, 0, t1, 300).map(([t]) => [r * w * t, xi(t)] as [number, number]);
    return done({ vals: { B, k }, steps, plot: { xl: 'η, м', yl: 'ξ, м', series: [{ name: 'кривая на ленте', pts }] } });
  },
};

/* ---------- Яблонский Д.5 ---------- */
/** График P(t): «t:P» через «;»; скачок — «t:P_до/P_после». Возвращает узлы (t, P слева, P справа). */
export function parseGraph(src: string): { t: number; L: number; R: number }[] | string {
  const rows = src
    .split(/[;\n]/)
    .map((x) => x.trim())
    .filter(Boolean);
  const out: { t: number; L: number; R: number }[] = [];
  for (const r of rows) {
    const [ts, ps] = r.split(':');
    if (ps == null) return 'график: пары «t:P» через «;», скачок — «t:P₁/P₂»';
    const t = parseNum(ts.trim());
    const pp = ps.split('/').map((y) => parseNum(y.trim()));
    if (!Number.isFinite(t) || pp.length > 2 || !pp.every(Number.isFinite)) return `график: не разобрано «${r}»`;
    out.push({ t, L: pp[0], R: pp[pp.length - 1] });
  }
  if (out.length < 2) return 'график: не менее двух точек';
  for (let i = 1; i < out.length; i++) if (!(out[i].t > out[i - 1].t)) return 'график: моменты времени должны возрастать';
  if (out[0].t !== 0) return 'график начинается с t = 0';
  return out;
}

/**
 * Тело на шероховатой наклонной плоскости; ось x — вверх по плоскости (по начальной скорости), сила P(t) направлена
 * вдоль x. m ẍ = P − mg sin α − F_тр; при v ≠ 0 трение fN против скорости, при v = 0 — покой, пока |P − mg sin α| ≤ fN.
 * Интегрирование по участкам графика мелкими шагами (P линейна — импульс на шаге точный).
 */
export function graphMotion(m: number, v0: number, alpha: number, f: number, g: number, pts: { t: number; L: number; R: number }[]) {
  const a = alpha * D2R;
  const Gs = m * g * Math.sin(a),
    Fr = f * m * g * Math.cos(a);
  let v = v0;
  const trace: [number, number][] = [[0, v0]];
  const vAt: number[] = [v0];
  const stops: number[] = [];
  const S: number[] = [];
  for (let i = 1; i < pts.length; i++) {
    const t0 = pts[i - 1].t,
      t1 = pts[i].t,
      P0 = pts[i - 1].R,
      P1 = pts[i].L;
    S.push(((P0 + P1) / 2) * (t1 - t0));
    const n = 4000;
    const h = (t1 - t0) / n;
    const P = (t: number) => P0 + ((P1 - P0) * (t - t0)) / (t1 - t0);
    for (let j = 0; j < n; j++) {
      const ta = t0 + j * h,
        tb = ta + h;
      const imp = ((P(ta) + P(tb)) / 2) * h - Gs * h;
      if (v === 0) {
        const drive = P(tb) - Gs;
        if (Math.abs(drive) <= Fr) {
          trace.push([tb, 0]);
          continue;
        }
        v = (imp - Math.sign(drive) * Fr * h) / m;
      } else {
        const nv = v + (imp - Math.sign(v) * Fr * h) / m;
        if (nv * v < 0 || nv === 0) {
          stops.push(tb);
          v = 0;
        } else v = nv;
      }
      trace.push([tb, v]);
    }
    vAt.push(v);
  }
  return { vAt, trace, stops, S, Gs, Fr };
}

const A_GRAPH: AskDef = {
  id: 'graph',
  title: 'Яблонский, Д.5: скорость тела на наклонной плоскости при силе P(t), заданной графиком',
  hint: 'Тело массой m получило скорость v₀ вверх по наклонной плоскости (угол α); сила P(t) направлена туда же, график — ломаная по точкам (скачок — «P₁/P₂»). Найти скорости в узлах графика.',
  n: { m: 40, v0: 10, alpha: 30, f: 0.1, g: G },
  s: { P: '0:0; 3:250; 8:300/200; 12:150' },
  fields: [
    { k: 'P', label: 'график P(t): «t:P» через «;», Н', text: true },
    { k: 'm', label: 'масса m, кг' },
    { k: 'v0', label: 'начальная скорость v₀ (вверх по плоскости), м/с', zero: true },
    { k: 'alpha', label: 'угол наклона α, °', zero: true },
    { k: 'f', label: 'коэффициент трения f', zero: true },
    { k: 'g', label: 'g, м/с²' },
  ],
  solve: (q, ex) => {
    const { m, v0, alpha, f, g } = q.n;
    if (!pos(m, g) || !(v0 >= 0) || !(alpha >= 0 && alpha < 90) || !(f >= 0)) return fail(['m, g > 0; v₀ ≥ 0; 0 ≤ α < 90°; f ≥ 0.']);
    const pts = parseGraph(q.s.P);
    if (typeof pts === 'string') return fail([pts]);
    const r = graphMotion(m, v0, alpha, f, g, pts);
    const vals: Record<string, number> = {};
    const steps = [
      stepEx(
        ex,
        'Силы',
        'На тело действуют тяжесть, нормальная реакция N = mg cos α, сила трения fN против скорости и сила P(t). Ось x — вверх по плоскости.',
        eqB(`mg sin α = ${sg(r.Gs)} Н,  F = f·mg cos α = ${sg(r.Fr)} Н`),
      ),
      stepEx(
        ex,
        'Теорема об изменении количества движения',
        'На каждом участке графика m(v_k − v_{k−1}) = S_P − (mg sin α ± F)(t_k − t_{k−1}); импульс S_P = ∫P dt — площадь трапеции под графиком. Знак трения — против скорости; если скорость обращается в нуль, тело останавливается и трогается снова, только когда |P − mg sin α| превзойдёт силу трения покоя fN.',
        eqB(
          ...pts
            .slice(1)
            .map(
              (p, i) =>
                `участок ${sg(pts[i].t)}…${sg(p.t)} с:  S_P = (${sg(pts[i].R)} + ${sg(p.L)})/2·${sg(p.t - pts[i].t)} = ${sg(r.S[i])} Н·с,  v = ${sg(r.vAt[i + 1])} м/с`,
            ),
        ),
      ),
      ...(r.stops.length
        ? [
            stepB(
              'Остановки',
              parB(`Скорость обращается в нуль при t ≈ ${r.stops.map((t) => sg(t)).join('; ')} с — дальше трение меняет направление или тело стоит.`),
            ),
          ]
        : []),
      stepB(
        'Ответ',
        ansB(
          ...pts.slice(1).map((p, i): [Ln, string] => {
            vals[`v${i + 1}`] = Math.abs(r.vAt[i + 1]);
            return [
              [bold(`v${i + 1} = ${sg(Math.abs(r.vAt[i + 1]))} м/с`)],
              `в момент t = ${sg(p.t)} с${r.vAt[i + 1] < 0 ? ' (вниз по плоскости)' : r.vAt[i + 1] === 0 ? ' (покой)' : ''}`,
            ];
          }),
        ),
      ),
    ];
    const step = Math.max(1, Math.floor(r.trace.length / 400));
    return done({ vals, steps, plot: { xl: 't, с', yl: 'v_x, м/с', series: [{ name: 'v(t)', pts: r.trace.filter((_, i) => i % step === 0) }] } });
  },
};

export const POINT_ASKS_28: AskDef[] = [A_PRESS, A_WEIGH, A_SWING, A_RING, A_SUSP, A_CAR, A_HSUSP, A_PISTON, A_GRAPH];
