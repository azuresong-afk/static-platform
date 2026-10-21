/**
 * Пункт 28, «Центр масс»: второй экран.
 *
 *  - tip    29.1 — работа на опрокидывание однородного массива вокруг ребра: A = P(√(a² + y_C²) − y_C);
 *  - pend   29.16 — потенциальная энергия маятника двумя способами: Py и работа горизонтальной силы Px/l;
 *  - crane  35.15–35.16 — крановая тележка с грузом на тросе: вертикальная и горизонтальная реакции, колебания;
 *  - prism  Яблонский, Д.7 — тело 3 и тела 1, 2, движущиеся относительно него: перемещение s₃, реакция упора,
 *           шероховатая плоскость (условие начала движения и закон движения);
 *  - brake  Яблонский, Д.8 — внутреннее торможение: скорость тела 1 при сухом (и вязком) трении;
 *  - roll   Яблонский, Д.12 — сила P, при которой качение колеса без скольжения имеет граничный характер.
 */
import { ansB, bold, eqB, fail, parB, sample, sg, stepB, stepEx, type AskDef, type ExtraOut, type Ln } from '../../../shared/extra';

const G = 9.81;
const D2R = Math.PI / 180;
const pos = (...x: number[]) => x.every((v) => v > 0 && Number.isFinite(v));
const nn = (...x: number[]) => x.every((v) => v >= 0 && Number.isFinite(v));
const done = (o: Omit<ExtraOut, 'ok' | 'errors'>): ExtraOut => ({ ok: true, errors: [], ...o });

/* ---------- 29.1 ---------- */
const A_TIP: AskDef = {
  id: 'tip',
  title: '29.1: работа, необходимая для опрокидывания однородного массива вращением вокруг ребра',
  hint: 'Работа равна приращению потенциальной энергии: центр тяжести поднимается до положения над ребром. Массив — прямоугольный (ширина основания b, высота h) или задано положение центра тяжести относительно ребра.',
  n: { P: 4000, b: 6, h: 8, a: 3, yc: 4 },
  s: { body: 'rect' },
  selects: [
    {
      k: 'body',
      label: 'Массив',
      options: [
        ['rect', 'прямоугольный: основание b, высота h'],
        ['cg', 'центр тяжести: a — по горизонтали от ребра, y_C — высота'],
      ],
    },
  ],
  fields: [
    { k: 'P', label: 'вес P' },
    { k: 'b', label: 'ширина основания b', show: (p) => p.s.body === 'rect' },
    { k: 'h', label: 'высота h', show: (p) => p.s.body === 'rect' },
    { k: 'a', label: 'расстояние по горизонтали от ребра до центра тяжести a', show: (p) => p.s.body === 'cg' },
    { k: 'yc', label: 'высота центра тяжести y_C', show: (p) => p.s.body === 'cg' },
  ],
  solve: (q, ex) => {
    const { P } = q.n;
    const rect = q.s.body === 'rect';
    const a = rect ? q.n.b / 2 : q.n.a;
    const yc = rect ? q.n.h / 2 : q.n.yc;
    if (!pos(P, a, yc)) return fail(['Вес и размеры — положительные.']);
    const d = Math.hypot(a, yc);
    const A = P * (d - yc);
    const steps = [
      stepEx(ex, 'Центр тяжести', rect ? 'У однородного прямоугольного массива центр тяжести — в центре прямоугольника.' : null, eqB(`a = ${sg(a)},  y_C = ${sg(yc)}`, `расстояние от ребра до центра тяжести  ρ = √(a² + y_C²) = ${sg(d)}`)),
      stepEx(ex, 'Работа', 'При повороте вокруг ребра центр тяжести движется по окружности радиуса ρ; наивысшее положение — над ребром. Дальше массив опрокидывается сам, поэтому затраченная работа равна приращению потенциальной энергии.', eqB('A = P(ρ − y_C)', `A = ${sg(P)}·(${sg(d)} − ${sg(yc)}) = ${sg(A)}`)),
      stepB('Ответ', ansB([[bold(`A = ${sg(A)}`)], 'работа на опрокидывание (в единицах P × длина)'])),
    ];
    return done({ vals: { A, rho: d }, steps });
  },
};

/* ---------- 29.16 ---------- */
const A_PEND: AskDef = {
  id: 'pend',
  title: '29.16: потенциальная энергия маятника — как работа силы тяжести и как работа горизонтальной силы Px/l',
  hint: 'Математический маятник весом P и длиной l медленно отклоняется горизонтальной силой Px/l (x — горизонтальное отклонение груза) и поднимается на высоту y.',
  n: { P: 1, l: 1, y: 0.1 },
  fields: [
    { k: 'P', label: 'вес P' },
    { k: 'l', label: 'длина l' },
    { k: 'y', label: 'высота подъёма y' },
  ],
  solve: (q, ex) => {
    const { P, l, y } = q.n;
    if (!pos(P, l, y) || !(y < l)) return fail(['P, l, y > 0; y < l (сила Px/l — для отклонений меньше 90°).']);
    const x2 = 2 * l * y - y * y;
    const A1 = P * y;
    const A2 = (P * x2) / (2 * l);
    const steps = [
      stepEx(ex, 'Работа силы тяжести', 'Потенциальная энергия — работа, которую совершит сила тяжести при возвращении в нижнее положение.', eqB(`Π₁ = Py = ${sg(A1)}`)),
      stepEx(ex, 'Работа горизонтальной силы', 'Сила Px/l направлена по горизонтали, её работа на горизонтальном перемещении dx.', eqB('Π₂ = ∫₀ˣ (P x/l) dx = P x²/(2l)', `x² = l² − (l − y)² = 2ly − y² = ${sg(x2)}`, `Π₂ = ${sg(A2)}`)),
      stepEx(ex, 'Сравнение', 'Сила Px/l уравновешивает маятник лишь приближённо (точно — P tg φ), поэтому результаты различаются на величину порядка y².', eqB(`Π₁ − Π₂ = P y²/(2l) = ${sg(A1 - A2)}`), parB('Оба способа дают одно и то же, если можно пренебречь y² по сравнению с ly (малые отклонения).')),
      stepB('Ответ', ansB([[bold(`Π₁ = Py = ${sg(A1)}`)], 'как работа силы тяжести'], [[bold(`Π₂ = Px²/(2l) = ${sg(A2)}`)], 'как работа силы Px/l'])),
    ];
    return done({
      vals: { A1, A2, diff: A1 - A2 },
      steps,
      plot: {
        xl: 'y',
        yl: 'Π',
        series: [
          { name: 'Py', pts: sample((t) => P * t, 0, l * 0.9, 60) },
          { name: 'Px²/(2l)', pts: sample((t) => (P * (2 * l * t - t * t)) / (2 * l), 0, l * 0.9, 60) },
        ],
        marks: [{ x: y, y: A1, label: 'y' }],
      },
    });
  },
};

/* ---------- 35.15–35.16 ---------- */
const A_CRANE: AskDef = {
  id: 'crane',
  title: '35.15–35.16: крановая тележка с грузом на тросе — реакции балки и рельсов, движение тележки',
  hint: 'Тележка весом P₁ посередине балки, в её центре тяжести C₁ подвешен трос длиной l с грузом P₂. Трос совершает малые колебания φ = φ₀ cos ωt, ω = √(g/l). Ось y — вниз от положения статического равновесия C₁, ось x — по балке.',
  n: { P1: 1000, P2: 500, l: 5, phi0: 0.1, c: 100000, g: G, t: 1 },
  s: { find: 'vert' },
  selects: [
    {
      k: 'find',
      label: 'Что найти',
      options: [
        ['vert', '35.15: вертикальная реакция (жёсткая балка) и колебания тележки на упругой балке'],
        ['horiz', '35.16: горизонтальная реакция рельсов (тележка заторможена) и движение незаторможенной тележки'],
      ],
    },
  ],
  fields: [
    { k: 'P1', label: 'вес тележки P₁' },
    { k: 'P2', label: 'вес груза P₂' },
    { k: 'l', label: 'длина троса l', show: (p) => p.s.find === 'horiz' },
    { k: 'phi0', label: 'амплитуда колебаний троса φ₀, рад', show: (p) => p.s.find === 'horiz' },
    { k: 'c', label: 'коэффициент упругости балки c', show: (p) => p.s.find === 'vert' },
    { k: 'g', label: 'g' },
    { k: 't', label: 'момент времени t', zero: true },
  ],
  solve: (q, ex) => {
    const { P1, P2, g, t } = q.n;
    if (!pos(P1, P2, g) || !(t >= 0)) return fail(['P₁, P₂, g > 0; t ≥ 0.']);
    const P = P1 + P2;
    if (q.s.find === 'vert') {
      const c = q.n.c;
      if (!pos(c)) return fail(['c > 0.']);
      const k = Math.sqrt((c * g) / P);
      const A = P / c;
      const y = (tt: number) => -A * Math.cos(k * tt);
      const steps = [
        stepEx(ex, 'Жёсткая балка', 'Теорема о движении центра масс в проекции на вертикаль. При малых колебаниях вертикальное ускорение груза — второго порядка малости (cos φ ≈ 1), центр масс по вертикали не движется.', eqB('(P₁ + P₂)/g · ÿ_C = P₁ + P₂ − R_y,  ÿ_C ≈ 0', `R_y = P₁ + P₂ = ${sg(P)}`)),
        stepEx(ex, 'Упругая балка', 'Трос нерастяжим и колебания малы — груз движется по вертикали вместе с C₁. Сила упругости балки c(y₁ + δ), δ = (P₁ + P₂)/c — статический прогиб.', eqB('(P₁ + P₂)/g · ÿ₁ = −c y₁', `k = √(cg/(P₁ + P₂)) = ${sg(k)} рад/с`)),
        stepEx(ex, 'Начальные условия', 'В начальный момент балка не деформирована (y₁ = −δ) и покоится.', eqB(`y₁ = −(P₁ + P₂)/c · cos kt = −${sg(A)} cos ${sg(k)}t`, `при t = ${sg(t)}:  y₁ = ${sg(y(t))}`)),
        stepB('Ответ', ansB([[bold(`R_y = P₁ + P₂ = ${sg(P)}`)], 'вертикальная реакция жёсткой балки'], [[bold(`y₁ = −${sg(A)} cos ${sg(k)}t`)], 'свободные колебания точки C₁ на упругой балке'])),
      ];
      return done({ vals: { Ry: P, k, A, y: y(t) }, steps, plot: { xl: 't', yl: 'y₁', series: [{ name: 'y₁(t)', pts: sample(y, 0, (4 * Math.PI) / k, 200) }] } });
    }
    const { l, phi0 } = q.n;
    if (!pos(l) || !(Math.abs(phi0) > 0 && Math.abs(phi0) < 0.5)) return fail(['l > 0; 0 < |φ₀| < 0,5 рад (малые колебания).']);
    const w = Math.sqrt(g / l);
    const Rxa = (P2 / g) * l * phi0 * w * w;
    const xa = (P2 * l * phi0) / P;
    const Rx = (tt: number) => -Rxa * Math.cos(w * tt);
    const x1 = (tt: number) => xa * (1 - Math.cos(w * tt));
    const steps = [
      stepEx(ex, 'Координата центра масс', 'Груз отстоит от C₁ по горизонтали на l sin φ ≈ lφ.', eqB('(P₁ + P₂) x_C = P₁ x₁ + P₂ (x₁ + lφ)', `ω = √(g/l) = ${sg(w)} рад/с`)),
      stepEx(ex, 'Тележка заторможена', 'x₁ = const; горизонтальная реакция рельсов — единственная внешняя горизонтальная сила.', eqB('R_x = (P₂/g) l φ̈ = −(P₂/g) l φ₀ ω² cos ωt', `R_x = −${sg(Rxa)} cos ${sg(w)}t;  при t = ${sg(t)}:  R_x = ${sg(Rx(t))}`)),
      stepEx(ex, 'Тележка не заторможена', 'Горизонтальных внешних сил нет — x_C сохраняется. В начальный момент x₁ = 0, φ = φ₀.', eqB('(P₁ + P₂) x₁ + P₂ lφ = P₂ lφ₀', `x₁ = P₂ lφ₀/(P₁ + P₂) · (1 − cos ωt) = ${sg(xa)}(1 − cos ${sg(w)}t)`, `при t = ${sg(t)}:  x₁ = ${sg(x1(t))}`)),
      stepB('Ответ', ansB([[bold(`R_x = −${sg(Rxa)} cos ${sg(w)}t`)], 'горизонтальная реакция рельсов'], [[bold(`x₁ = ${sg(xa)}(1 − cos ${sg(w)}t)`)], 'колебания центра тяжести тележки, амплитуда P₂lφ₀/(P₁ + P₂)'])),
    ];
    return done({
      vals: { Rxa, xa, w, Rx: Rx(t), x1: x1(t) },
      steps,
      plot: { xl: 't', yl: 'x₁', series: [{ name: 'x₁(t)', pts: sample(x1, 0, (4 * Math.PI) / w, 200) }] },
    });
  },
};

/* ---------- Д.7 ---------- */
const A_PRISM: AskDef = {
  id: 'prism',
  title: 'Яблонский, Д.7: тело 3 и тела 1, 2, движущиеся по нему, — перемещение тела 3, реакция упора, шероховатая плоскость',
  hint: 'Тела 1 и 2 движутся относительно тела 3 поступательно; s₁ᵣ — относительное перемещение тела 1, s₂ᵣ = k·s₁ᵣ (k — по механизму, например r_A/R_A). θ₁, θ₂ — углы положительных направлений s₁ᵣ, s₂ᵣ с осью x (против часовой стрелки; на чертеже книги θ₁ = α, θ₂ = 180° − β). В начале система покоится.',
  n: { m1: 600, m2: 240, m3: 400, k: 1 / 3, th1: 30, th2: 120, fs: 0.11, f: 0.1, g: G },
  s: { plane: 'rough' },
  selects: [
    {
      k: 'plane',
      label: 'Горизонтальная плоскость',
      options: [
        ['smooth', 'гладкая: перемещение тела 3 и реакция упора'],
        ['rough', 'гладкая и шероховатая: ещё условие начала движения и закон движения тела 3'],
      ],
    },
  ],
  fields: [
    { k: 'm1', label: 'масса тела 1 m₁, кг' },
    { k: 'm2', label: 'масса тела 2 m₂, кг', zero: true },
    { k: 'm3', label: 'масса тела 3 m₃, кг' },
    { k: 'k', label: 'k = s₂ᵣ/s₁ᵣ', neg: true, zero: true },
    { k: 'th1', label: 'угол θ₁ направления s₁ᵣ с осью x, °', neg: true, zero: true },
    { k: 'th2', label: 'угол θ₂ направления s₂ᵣ с осью x, °', neg: true, zero: true },
    { k: 'fs', label: 'коэффициент сцепления f_сц', show: (p) => p.s.plane === 'rough' },
    { k: 'f', label: 'коэффициент трения скольжения f', show: (p) => p.s.plane === 'rough' },
    { k: 'g', label: 'g, м/с²' },
  ],
  solve: (q, ex) => {
    const { m1, m2, m3, k, th1, th2, fs, f, g } = q.n;
    if (!pos(m1, m3, g) || !nn(m2)) return fail(['m₁, m₃, g > 0; m₂ ≥ 0.']);
    const c1 = Math.cos(th1 * D2R),
      c2 = Math.cos(th2 * D2R),
      s1 = Math.sin(th1 * D2R),
      s2 = Math.sin(th2 * D2R);
    const m = m1 + m2 + m3;
    const Px = m1 * c1 + m2 * k * c2;
    const Py = m1 * s1 + m2 * k * s2;
    const ratio = -Px / m;
    const steps = [
      stepEx(ex, 'Координаты центров масс', 'Тело 3 смещается на s₃ (вдоль x), тела 1 и 2 — вместе с ним и относительно него.', eqB(`x_C1 = x_C10 + s₃ + s₁ᵣ cos θ₁,  x_C2 = x_C20 + s₃ + k s₁ᵣ cos θ₂,  x_C3 = x_C30 + s₃`)),
      stepEx(ex, 'Гладкая плоскость', 'Внешние силы вертикальны, система вначале покоится — центр масс по оси x не перемещается.', eqB('m₁(s₃ + s₁ᵣ cos θ₁) + m₂(s₃ + k s₁ᵣ cos θ₂) + m₃ s₃ = 0', `s₃ = −(m₁ cos θ₁ + m₂ k cos θ₂)/m · s₁ᵣ = ${sg(ratio)} s₁ᵣ,  v₃ = ${sg(ratio)} v₁ᵣ`), parB(ratio < 0 ? 'Знак «−»: тело 3 движется в отрицательном направлении оси x.' : ratio > 0 ? 'Тело 3 движется в положительном направлении оси x.' : 'Тело 3 не перемещается.')),
      stepEx(ex, 'Тело 3 удерживается упором', 's₃ = const: сумма проекций на x внешних сил равна реакции упора.', eqB(`R_x = (m₁ cos θ₁ + m₂ k cos θ₂) s̈₁ᵣ = ${sg(Px)} s̈₁ᵣ`)),
    ];
    const vals: Record<string, number> = { ratio, Rcoef: Px };
    const rows: [Ln, string][] = [
      [bold(`s₃ = ${sg(ratio)} s₁ᵣ`), 'гладкая плоскость'],
      [bold(`R_x = ${sg(Px)} s̈₁ᵣ`), 'реакция упора, если тело 3 удерживается'],
    ];
    if (q.s.plane === 'rough') {
      if (!(fs > 0 && f > 0)) return fail(['f_сц, f > 0.']);
      const Gw = m * g;
      const den = Math.abs(Px) - fs * Py;
      const aStar = den > 0 ? (fs * Gw) / den : Infinity;
      const B = (Math.abs(Px) - f * Py) / m;
      const sgn = Math.sign(Px) || 1;
      vals.astar = aStar;
      vals.B = B;
      vals.hfg = (f * g) / 2;
      steps.push(
        stepEx(ex, 'Нормальная реакция плоскости', 'Теорема о движении центра масс в проекции на вертикаль: ускорения центров масс тел 1, 2 по вертикали — s̈₁ᵣ sin θ₁, k s̈₁ᵣ sin θ₂.', eqB(`N = G + (m₁ sin θ₁ + m₂ k sin θ₂) s̈₁ᵣ = ${sg(Gw)} + ${sg(Py)} s̈₁ᵣ`)),
        stepEx(
          ex,
          'Условие начала движения тела 3',
          'Тело 3 сдвинется, когда требуемая горизонтальная сила превысит наибольшую силу сцепления f_сц·N.',
          eqB(`|${sg(Px)}| s̈₁ᵣ > f_сц(${sg(Gw)} + ${sg(Py)} s̈₁ᵣ)`, den > 0 ? `s̈₁ᵣ* = f_сц G/(|m₁ cos θ₁ + m₂ k cos θ₂| − f_сц(m₁ sin θ₁ + m₂ k sin θ₂)) = ${sg(aStar)} м/с²` : 'знаменатель ≤ 0 — тело 3 не сдвинется ни при каком ускорении'),
        ),
      );
      if (den > 0) {
        steps.push(
          stepEx(ex, 'Закон движения тела 3', 'Сила трения скольжения fN направлена против скорости тела 3. При s̈₁ᵣ > s̈₁ᵣ* и нулевых начальных условиях:', eqB(`s̈₃ = ${sgn > 0 ? '' : '−'}(fg − B s̈₁ᵣ),  B = (|m₁ cos θ₁ + m₂ k cos θ₂| − f(m₁ sin θ₁ + m₂ k sin θ₂))/m = ${sg(B)}`, `s₃ = ${sgn > 0 ? '' : '−'}(${sg((f * g) / 2)} t² − ${sg(B)} s₁ᵣ)`)),
        );
        rows.push([bold(`s̈₁ᵣ* = ${sg(aStar)} м/с²`), 'тело 3 сдвигается на шероховатой плоскости при s̈₁ᵣ > s̈₁ᵣ*'], [bold(`s₃ = ${sgn > 0 ? '' : '−'}(${sg((f * g) / 2)} t² − ${sg(B)} s₁ᵣ)`), 'закон движения тела 3 (шероховатая плоскость)']);
      } else rows.push(['тело 3 не сдвигается', 'шероховатая плоскость']);
    }
    steps.push(stepB('Ответ', ansB(...rows)));
    return done({ vals, steps });
  },
};

/* ---------- Д.8 ---------- */
const A_BRAKE: AskDef = {
  id: 'brake',
  title: 'Яблонский, Д.8: внутреннее торможение — скорость тела 1, когда тела 2 и 3 остановятся относительно него',
  hint: 'Тело 1 движется поступательно по горизонтали (ось x — по начальной скорости v₀). Центры масс тел 2 и 3 движутся относительно тела 1 со скоростями c₂ω₂ и c₃ω₂ (c₂, c₃ — по кинематике механизма, в примере c₂ = R₂, c₃ = (3R₂ + r₂)/2) в направлении под углом θ к оси x. ω₂ = ω₂₀ − ε₂t до остановки при T = ω₂₀/ε₂. Трение в опоре A: F = −f|N|·sign(v), в случае б) ещё сила −bv.',
  n: { m1: 12, m2: 4, m3: 3, c2: 0.5, c3: 0.875, th: 150, v0: 2, w20: 10, eps: 250, f: 0.25, b: 10, g: G },
  s: { case: 'a' },
  selects: [
    {
      k: 'case',
      label: 'Сопротивление',
      options: [
        ['a', 'а) сухое трение в опоре A'],
        ['b', 'б) сухое трение и «вязкое» −bv'],
      ],
    },
  ],
  fields: [
    { k: 'm1', label: 'масса тела 1 m₁, кг' },
    { k: 'm2', label: 'масса тела 2 m₂, кг', zero: true },
    { k: 'm3', label: 'масса тела 3 m₃, кг', zero: true },
    { k: 'c2', label: 'c₂: v_C2r = c₂ω₂, м', zero: true },
    { k: 'c3', label: 'c₃: v_C3r = c₃ω₂, м', zero: true },
    { k: 'th', label: 'угол θ относительных скоростей с осью x, °', neg: true, zero: true },
    { k: 'v0', label: 'начальная скорость тела 1 v₀, м/с' },
    { k: 'w20', label: 'ω₂₀, рад/с' },
    { k: 'eps', label: '|ε₂|, рад/с²' },
    { k: 'f', label: 'коэффициент трения f', zero: true },
    { k: 'b', label: 'коэффициент вязкого сопротивления b, Н·с/м', show: (p) => p.s.case === 'b' },
    { k: 'g', label: 'g, м/с²' },
  ],
  solve: (q, ex) => {
    const { m1, m2, m3, c2, c3, th, v0, w20, eps, f, g } = q.n;
    const b = q.s.case === 'b' ? q.n.b : 0;
    if (!pos(m1, v0, w20, eps, g) || !nn(m2, m3, c2, c3, f, b)) return fail(['m₁, v₀, ω₂₀, ε₂, g > 0; m₂, m₃, c₂, c₃, f, b ≥ 0.']);
    const M = m1 + m2 + m3;
    const mu = m2 * c2 + m3 * c3;
    const ct = Math.cos(th * D2R),
      st = Math.sin(th * D2R);
    const T = w20 / eps;
    const N = M * g - mu * eps * st;
    const D = mu * eps * ct;
    const fN = f * Math.abs(N);
    const be = b / M;
    // v̇ = A − βv на участке с направлением движения s
    const Aof = (s: number) => (D - s * fN) / M;
    const run = (A: number, v: number, dt: number) => (be > 0 ? A / be + (v - A / be) * Math.exp(-be * dt) : v + A * dt);
    const Af = Aof(1);
    let tStar = Infinity;
    if (Af < 0) tStar = be > 0 ? Math.log(1 + (be * v0) / -Af) / be : v0 / -Af;
    let vT: number;
    let phase2 = '';
    if (tStar >= T) vT = run(Af, v0, T);
    else if (Math.abs(D) <= fN) {
      vT = 0;
      phase2 = `после остановки при t = T* сила |μ ε₂ cos θ| = ${sg(Math.abs(D))} не превосходит f|N| = ${sg(fN)} — тело 1 остаётся в покое`;
    } else {
      const s2 = Math.sign(D);
      vT = run(Aof(s2), 0, T - tStar);
      phase2 = `после остановки тело 1 движется в ${s2 < 0 ? 'обратную' : 'ту же'} сторону: ẍ = ${sg(Aof(s2))}${be > 0 ? ` − ${sg(be)}ẋ` : ''}`;
    }
    // f = 0, b = 0
    const v00 = v0 + (D / M) * T;
    // приближённо (книга): G·T, перемещения и вязкость не учитываются
    const kf = ct - f * Math.abs(st);
    const dw = kf < 0 ? (-M * v0) / (mu * kf) : Infinity;
    let vApp: number;
    if (dw >= w20) vApp = v0 + (mu * w20 * kf) / M;
    else {
      const w2s = w20 - dw;
      const s2 = Math.sign(ct);
      const vv = (mu * w2s * (ct - s2 * f * Math.abs(st))) / M;
      vApp = Math.sign(vv) === s2 ? vv : 0;
    }
    const a = -Af,
      abar = -Aof(-1);
    const steps = [
      stepEx(ex, 'Количество движения системы', 'Скорости центров масс тел 2 и 3 — переносная v (тела 1) и относительные c₂ω₂, c₃ω₂ под углом θ к оси x.', eqB(`K_x = m ẋ + μ ω₂ cos θ,  K_y = μ ω₂ sin θ`, `m = m₁ + m₂ + m₃ = ${sg(M)},  μ = m₂c₂ + m₃c₃ = ${sg(mu)}`)),
      stepEx(ex, 'Нормальная реакция', 'dK_y/dt = N − G при ω̇₂ = −ε₂; реакция постоянна во время торможения.', eqB(`N = mg − μ ε₂ sin θ = ${sg(N)}`)),
      stepEx(ex, 'Уравнение движения тела 1', 'dK_x/dt = −f|N| sign ẋ' + (be > 0 ? ' − bẋ.' : '.'), eqB(`ẋ > 0:  ẍ = (μ ε₂ cos θ − f|N|)/m${be > 0 ? ' − βẋ' : ''} = −a${be > 0 ? ' − βẋ' : ''},  a = ${sg(a)} м/с²`, `ẋ < 0:  ẍ = (μ ε₂ cos θ + f|N|)/m${be > 0 ? ' − βẋ' : ''} = −ā${be > 0 ? ' − βẋ' : ''},  ā = ${sg(abar)} м/с²`, ...(be > 0 ? [`β = b/m = ${sg(be)} 1/с`] : []))),
      stepB(
        'Время торможения',
        eqB(`T = ω₂₀/ε₂ = ${sg(T)} с`, Number.isFinite(tStar) ? `тело 1 останавливается при T* = ${be > 0 ? '(1/β) ln(1 + v₀β/a)' : 'v₀/a'} = ${sg(tStar)} с` : 'при ẋ > 0 тело 1 не останавливается', tStar < T ? `T* < T: ${phase2}` : 'T* ≥ T: движение без остановки'),
      ),
      stepEx(ex, 'Сравнение', 'Без трения (f = 0, b = 0) и приближённо — по теореме об изменении количества движения в конечной форме, пренебрегая величинами порядка T (импульс веса, перемещения, вязкая сила).', eqB(`f = 0:  v_T = v₀ + μ ε₂ T cos θ/m = ${sg(v00)} м/с`, `приближённо:  v_T ≈ ${sg(vApp)} м/с`)),
      stepB('Ответ', ansB([[bold(`v_T = ${sg(vT)} м/с`)], 'скорость тела 1 при t = T (точно)'], [`v_T ≈ ${sg(vApp)} м/с`, 'приближённо', 'aux'])),
    ];
    const pts: [number, number][] = [];
    for (let i = 0; i <= 200; i++) {
      const tt = (T * i) / 200;
      if (tt <= tStar) pts.push([tt, run(Af, v0, tt)]);
      else if (Math.abs(D) <= fN) pts.push([tt, 0]);
      else pts.push([tt, run(Aof(Math.sign(D)), 0, tt - tStar)]);
    }
    return done({ vals: { a, abar, N, T, Tstar: tStar, vT, v00, vApp }, steps, plot: { xl: 't, с', yl: 'ẋ, м/с', series: [{ name: 'ẋ(t)', pts }] } });
  },
};

/* ---------- Д.12 ---------- */
const A_ROLL: AskDef = {
  id: 'roll',
  title: 'Яблонский, Д.12: сила P, при которой качение колеса без скольжения имеет граничный характер',
  hint: 'Ось x — вдоль опорной прямой, α — её наклон (α > 0: ось x направлена вверх по уклону). Сила P постоянна: угол β с осью x (β > 0 — от опоры, β < 0 — к опоре), плечо e относительно центра (e > 0 — момент по качению в сторону x). i_C — радиус инерции (0 — сплошной диск), δ — коэффициент трения качения.',
  n: { m: 200, R: 0.6, iC: 0.5, e: 0.1, alpha: 15, beta: -30, fs: 0.1, delta: 0, g: G },
  fields: [
    { k: 'm', label: 'масса колеса m, кг' },
    { k: 'R', label: 'радиус качения R, м' },
    { k: 'iC', label: 'радиус инерции i_C, м (0 — сплошной диск)', zero: true },
    { k: 'e', label: 'плечо силы P относительно центра e, м', neg: true, zero: true },
    { k: 'alpha', label: 'наклон опорной прямой α, °', neg: true, zero: true },
    { k: 'beta', label: 'угол силы P с осью x β, °', neg: true, zero: true },
    { k: 'fs', label: 'коэффициент сцепления f_сц' },
    { k: 'delta', label: 'коэффициент трения качения δ, м', zero: true },
    { k: 'g', label: 'g, м/с²' },
  ],
  solve: (q, ex) => {
    const { m, R, e, alpha, beta, fs, delta, g } = q.n;
    const iC = q.n.iC > 0 ? q.n.iC : R / Math.SQRT2;
    if (!pos(m, R, fs, g) || !(delta >= 0) || !(Math.abs(alpha) < 90)) return fail(['m, R, f_сц, g > 0; δ ≥ 0; |α| < 90°.']);
    const Gw = m * g,
      i2 = iC * iC,
      den = i2 + R * R;
    const ca = Math.cos(alpha * D2R),
      sa = Math.sin(alpha * D2R),
      cb = Math.cos(beta * D2R),
      sb = Math.sin(beta * D2R);
    // N = N0 + N1 P;  F = F0 + F1 P при направлении качения ρ (момент сопротивления −ρδN)
    const N0 = Gw * ca,
      N1 = -sb;
    const Fc = (rho: number) => ({ F0: (i2 * Gw * sa - rho * R * delta * N0) / den, F1: (R * e - rho * R * delta * N1 - i2 * cb) / den });
    const acc = (P: number, F: number) => (P * cb - Gw * sa + F) / m;
    const sols: { P: number; a: number; F: number; N: number }[] = [];
    for (const rho of [1, -1])
      for (const sig of [1, -1]) {
        const { F0, F1 } = Fc(rho);
        const kk = F1 - sig * fs * N1;
        if (Math.abs(kk) < 1e-14) continue;
        const P = (sig * fs * N0 - F0) / kk;
        if (!(P > 0)) continue;
        const N = N0 + N1 * P,
          F = F0 + F1 * P;
        if (!(N > 0)) continue;
        const a = acc(P, F);
        if (delta > 0 && Math.abs(a) > 1e-12 && Math.sign(a) !== rho) continue;
        if (!sols.some((s) => Math.abs(s.P - P) < 1e-9 * Math.max(1, P))) sols.push({ P, a, F, N });
      }
    sols.sort((u, v) => u.P - v.P);
    const { F0, F1 } = Fc(1);
    const steps = [
      stepEx(ex, 'Уравнения плоского движения', 'Качение без скольжения: ẍ_C = Rφ̈, y_C = const. Сила сцепления F_сц — вдоль оси x (знак выяснится).', eqB('m ẍ_C = P cos β − G sin α + F_сц', 'N = G cos α − P sin β', `m i_C² ẍ_C/R = P e − F_сц R${delta > 0 ? ' − δN (при качении в сторону x)' : ''}`)),
      stepEx(ex, 'Сила сцепления', 'Исключаем ẍ_C.', eqB('F_сц = [P(Re − i_C² cos β) + i_C² G sin α' + (delta > 0 ? ' − RδN' : '') + ']/(R² + i_C²)', `F_сц = ${sg(F1)}P + ${sg(F0)},  N = ${sg(N0)} + ${sg(N1)}P`)),
      stepEx(ex, 'Граничные значения P', 'Качение без скольжения возможно, пока |F_сц| ≤ f_сц N; граница — |F_сц| = f_сц N (две ветви: F_сц = ±f_сц N).', eqB(...(sols.length ? sols.map((s, i) => `P${sols.length > 1 ? i + 1 : ''} = ${sg(s.P)}:  F_сц = ${sg(s.F)},  N = ${sg(s.N)},  ẍ_C = ${sg(s.a)} м/с²`) : ['граничных значений с P > 0 и N > 0 нет']))),
    ];
    if (!sols.length) return { ...done({ vals: {}, steps }), ok: false, errors: ['Граничных значений силы P (P > 0, N > 0) нет — при этих данных колесо либо всегда скользит, либо всегда катится без скольжения.'] };
    if (sols.length > 1) steps.push(stepEx(ex, 'Область качения без скольжения', null, parB(`При ${sg(sols[0].P)} ≤ P ≤ ${sg(sols[sols.length - 1].P)} колесо катится без скольжения.`)));
    steps.push(
      stepEx(ex, 'Закон движения центра колеса', 'Ускорение постоянно; x_C0 = 0, v_C0 = 0.', eqB(...sols.map((s, i) => `P${sols.length > 1 ? i + 1 : ''}:  x_C = ${sg(s.a / 2)} t²${s.a < 0 ? ' (колесо катится в отрицательную сторону x)' : ''}`))),
      stepB('Ответ', ansB(...sols.map((s, i): [Ln, string] => [bold(`P${sols.length > 1 ? i + 1 : ''} = ${sg(s.P)} Н,  x_C = ${sg(s.a / 2)} t²`), 'граничное значение силы и закон движения центра']))),
    );
    const vals: Record<string, number> = {};
    sols.forEach((s, i) => {
      vals[`P${i + 1}`] = s.P;
      vals[`a${i + 1}`] = s.a;
    });
    const Pmax = sols[sols.length - 1].P * 1.3;
    return done({
      vals,
      steps,
      plot: {
        xl: 'P, Н',
        yl: 'F, Н',
        series: [
          { name: '|F_сц|', pts: sample((P) => Math.abs(F0 + F1 * P), 0, Pmax, 160) },
          { name: 'f_сц N', pts: sample((P) => fs * (N0 + N1 * P), 0, Pmax, 160) },
        ],
        marks: sols.map((s, i) => ({ x: s.P, y: fs * s.N, label: `P${i + 1}` })),
      },
    });
  },
};

export const MC_ASKS: AskDef[] = [A_TIP, A_PEND, A_CRANE, A_PRISM, A_BRAKE, A_ROLL];
