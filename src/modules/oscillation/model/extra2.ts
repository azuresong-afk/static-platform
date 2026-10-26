/**
 * Пункт 30, «Удар и колебания»: колебания с одной степенью свободы, которых не хватало (Мещерский §53, Яблонский Д.25).
 *
 *  - crank   53.45 — противовес в желобе коленчатого вала: φ̈ + (ω²l/r) sin φ = 0, k = ω√(l/r);
 *  - swing   53.48 — маятник, точка подвеса которого движется по закону ξ(t): lφ̈ + ξ̈ cos φ + g sin φ = 0;
 *  - absin   53.50 — сила F|sin ωt|: периодическое решение с периодом π/ω;
 *  - shaft   53.53 — критическая скорость тяжёлого вала (первая собственная частота балки с распределённой массой);
 *  - reduce  Д.25 — система тел, приведённая к одной обобщённой координате: a q̈ + b q̇ + c q = Q₀ sin pt.
 */
import { diff, evalExpr, parseExpr, type Expr } from '../../../shared/expr';
import { ansB, bisect, bold, eqB, fail, parB, rk4, sample, simpson, sg, stepB, stepEx, type AskDef, type ExtraOut } from '../../../shared/extra';

const G = 9.81;
const D2R = Math.PI / 180;
const TAU = 2 * Math.PI;
const pos = (...x: number[]) => x.every((v) => v > 0 && Number.isFinite(v));
const done = (o: Omit<ExtraOut, 'ok' | 'errors'>): ExtraOut => ({ ok: true, errors: [], ...o });

/** Период нелинейных колебаний φ̈ + k² sin φ = 0 с амплитудой φ₀ (через среднее арифметико-геометрическое). */
export function pendulumPeriod(k: number, phi0: number): number {
  let a = 1,
    b = Math.cos(Math.min(Math.abs(phi0), Math.PI - 1e-9) / 2);
  for (let i = 0; i < 40; i++) [a, b] = [(a + b) / 2, Math.sqrt(a * b)];
  return TAU / (k * a);
}

/* ---------- 53.45 ---------- */
const A_CRANK: AskDef = {
  id: 'crank',
  title: '53.45: противовес в желобе коленчатого вала — частота малых колебаний',
  hint: 'Желоб — дуга окружности радиуса r с центром B на расстоянии AB = l от оси вращения A; точка движется по желобу, вал вращается с угловой скоростью ω; сила тяжести не учитывается. Относительное движение — в системе, вращающейся вместе с валом.',
  n: { r: 0.1, l: 0.02, w: 100, phi0: 5 },
  s: { unit: 'rad' },
  selects: [
    {
      k: 'unit',
      label: 'Угловая скорость вала задана',
      options: [
        ['rad', 'ω, рад/с'],
        ['rpm', 'n, об/мин'],
      ],
    },
  ],
  fields: [
    { k: 'r', label: 'радиус желоба r, м' },
    { k: 'l', label: 'смещение центра желоба l = AB, м' },
    { k: 'w', label: 'угловая скорость вала (рад/с или об/мин)' },
    { k: 'phi0', label: 'амплитуда φ₀ для точного периода и графика, °' },
  ],
  solve: (q, ex) => {
    const { r, l, phi0 } = q.n;
    const w = q.s.unit === 'rpm' ? (q.n.w * Math.PI) / 30 : q.n.w;
    if (!pos(r, l, w, phi0) || phi0 >= 180) return fail(['r, l, угловая скорость, φ₀ — положительные, φ₀ < 180°.']);
    const k = w * Math.sqrt(l / r);
    const T = TAU / k;
    const ph = phi0 * D2R;
    const Tex = pendulumPeriod(k, ph);
    const tEnd = 3 * Tex;
    const nl = rk4((_t, y) => [y[1], -k * k * Math.sin(y[0])], [ph, 0], 0, tEnd, 1200);
    const steps = [
      stepEx(
        ex,
        'Относительное движение',
        'В системе, вращающейся с валом, на точку (масса m) действуют центробежная сила mω²ρ (ρ — расстояние до оси A), сила Кориолиса — перпендикулярна относительной скорости и вдоль желоба не работает — и реакция желоба. Угол φ — от линии AB, отсчёт от положения, наиболее удалённого от оси.',
        eqB('ρ² = l² + r² + 2 l r cos φ'),
      ),
      stepEx(
        ex,
        'Уравнение движения',
        'Центробежная сила потенциальна: её потенциал −mω²ρ²/2. Вдоль дуги (s = rφ):',
        eqB('m r² φ̈ = ∂(mω²ρ²/2)/∂φ = −m ω² l r sin φ', 'φ̈ + (ω² l / r) sin φ = 0'),
      ),
      stepEx(
        ex,
        'Малые колебания',
        'Положение φ = 0 (точка дальше всего от оси) устойчиво: сила стремится вернуть точку. При малых φ sin φ ≈ φ.',
        eqB('φ̈ + k² φ = 0,  k = ω √(l/r)', `ω = ${sg(w)} рад/с,  k = ${sg(k)} 1/с,  T = 2π/k = ${sg(T)} с,  k/ω = √(l/r) = ${sg(Math.sqrt(l / r))}`),
      ),
      stepB(
        'Поправка на амплитуду',
        eqB(`T(φ₀ = ${sg(phi0)}°) = 2π / (k·AGM(1, cos(φ₀/2))) = ${sg(Tex)} с`, `отличие от малых колебаний ${sg(((Tex - T) / T) * 100, 3)} %`),
      ),
      stepB(
        'Ответ',
        ansB(
          [[bold(`k = ω√(l/r) = ${sg(k)} 1/с`)], 'частота малых колебаний противовеса'],
          [`T = ${sg(T)} с`, 'период', 'aux'],
          [`k/ω = ${sg(Math.sqrt(l / r))}`, 'порядок колебаний (отношение к частоте вращения вала)', 'aux'],
        ),
      ),
    ];
    return done({
      vals: { k, T, order: Math.sqrt(l / r), Texact: Tex },
      steps,
      plot: {
        xl: 't, с',
        yl: 'φ, °',
        series: [
          { name: 'φ(t), точное уравнение', pts: nl.filter((_p, i) => i % 6 === 0).map((p) => [p.t, p.y[0] / D2R] as [number, number]) },
          { name: 'φ₀ cos kt, малые колебания', pts: sample((t) => phi0 * Math.cos(k * t), 0, tEnd, 200) },
        ],
      },
    });
  },
};

/* ---------- 53.48 ---------- */
/** ξ̈(t) по формуле ξ(t): производная берётся аналитически. */
function secondDerivative(src: string): { ok: true; xi: (t: number) => number; xi2: (t: number) => number } | { ok: false; error: string } {
  const pe = parseExpr(src);
  if (!pe.ok) return { ok: false, error: `Закон ξ(t): ${pe.error}.` };
  let dd: Expr;
  try {
    dd = diff(diff(pe.e));
  } catch {
    return { ok: false, error: 'Закон ξ(t): формулу не удалось продифференцировать дважды.' };
  }
  return { ok: true, xi: (t) => evalExpr(pe.e, t), xi2: (t) => evalExpr(dd, t) };
}
const A_SWING: AskDef = {
  id: 'swing',
  title: '53.48: маятник, точка подвеса которого движется по закону ξ(t)',
  hint: 'Нить длины l, точка массы m; подвес движется по горизонтали по закону ξ(t). Точное уравнение lφ̈ + ξ̈ cos φ + g sin φ = 0; при малых φ: φ̈ + k²φ = −ξ̈/l, решение — интеграл Дюамеля.',
  n: { l: 1, g: G, phi0: 0, w0: 0, a: 0.02, p: 2, T: 10 },
  s: { kind: 'harm', xi: '0,02*sin(2*t)' },
  selects: [
    {
      k: 'kind',
      label: 'Закон движения подвеса',
      options: [
        ['harm', 'ξ = a sin pt (решение в замкнутом виде)'],
        ['formula', 'любой ξ(t) — формулой (интеграл Дюамеля)'],
      ],
    },
  ],
  fields: [
    { k: 'a', label: 'амплитуда подвеса a, м', show: (p) => p.s.kind === 'harm' },
    { k: 'p', label: 'частота подвеса p, рад/с', show: (p) => p.s.kind === 'harm' },
    { k: 'xi', label: 'закон подвеса ξ(t), м', text: true, vars: [], show: (p) => p.s.kind === 'formula' },
    { k: 'l', label: 'длина нити l, м' },
    { k: 'g', label: 'g, м/с²' },
    { k: 'phi0', label: 'начальный угол φ₀, °', neg: true, zero: true },
    { k: 'w0', label: 'начальная угловая скорость φ̇₀, рад/с', neg: true, zero: true },
    { k: 'T', label: 'время расчёта T, с' },
  ],
  solve: (q, ex) => {
    const { l, g, a, p, T } = q.n;
    if (!pos(l, g, T)) return fail(['l, g, T — положительные.']);
    const harm = q.s.kind === 'harm';
    let xi2: (t: number) => number;
    if (harm) {
      if (!pos(a, p)) return fail(['a и p — положительные.']);
      xi2 = (t) => -a * p * p * Math.sin(p * t);
    } else {
      const d = secondDerivative(q.s.xi);
      if (!d.ok) return fail([d.error]);
      xi2 = d.xi2;
    }
    const ph0 = q.n.phi0 * D2R,
      w0 = q.n.w0;
    const k = Math.sqrt(g / l);
    const lin = (t: number) => ph0 * Math.cos(k * t) + (w0 / k) * Math.sin(k * t) - (1 / (l * k)) * simpson((s) => xi2(s) * Math.sin(k * (t - s)), 0, t, 400);
    const N = 4000;
    const nl = rk4((t, y) => [y[1], -(xi2(t) * Math.cos(y[0]) + g * Math.sin(y[0])) / l], [ph0, w0], 0, T, N);
    const nlEnd = nl[N].y[0];
    const linEnd = lin(T);
    const off = harm && Math.abs(k - p) > 1e-9 * k;
    const res = harm && !off;
    const closed = (t: number) =>
      ph0 * Math.cos(k * t) + (w0 / k) * Math.sin(k * t) + ((a * p * p) / (l * (k * k - p * p))) * (Math.sin(p * t) - (p / k) * Math.sin(k * t));
    const steps = [
      stepEx(
        ex,
        'Уравнение движения',
        'Обобщённая координата φ — угол нити с вертикалью. Положение точки: x = ξ + l sin φ, y = −l cos φ; T = m(ξ̇² + l²φ̇² + 2lξ̇φ̇ cos φ)/2, Π = −mgl cos φ.',
        eqB('l φ̈ + ξ̈ cos φ + g sin φ = 0', 'малые колебания:  φ̈ + k² φ = −ξ̈(t)/l,  k = √(g/l)'),
      ),
      stepB(
        'Решение (интеграл Дюамеля)',
        eqB('φ = φ₀ cos kt + (φ̇₀/k) sin kt − (1/(lk)) ∫₀ᵗ ξ̈(τ) sin k(t − τ) dτ', `k = ${sg(k)} 1/с,  T₀ = ${sg(TAU / k)} с`),
        parB('Под интегралом — ускорение подвеса ξ̈(τ): сначала подвес двигается, потом уже влияет его ускорение, а не положение.'),
      ),
      ...(off
        ? [
            stepEx(
              ex,
              'Подвес ξ = a sin pt: интеграл берётся',
              'ξ̈ = −a p² sin pt, частное решение φ̈ + k²φ = (a p²/l) sin pt:',
              eqB(
                'φ = φ₀ cos kt + (φ̇₀/k) sin kt + a p²/(l(k² − p²))·(sin pt − (p/k) sin kt)',
                `амплитуда вынужденной части a p²/(l|k² − p²|) = ${sg((a * p * p) / (l * Math.abs(k * k - p * p)))} рад`,
              ),
            ),
          ]
        : res
          ? [stepB('Резонанс p = k', eqB('φ_частное = −(a k/(2l)) t cos kt', 'амплитуда растёт линейно: a k t/(2l)'))]
          : []),
      stepB(
        `Значения при t = ${sg(T)} с`,
        eqB(
          `линейное уравнение: φ = ${sg(linEnd / D2R)}°`,
          `точное уравнение (Рунге — Кутта): φ = ${sg(nlEnd / D2R)}°`,
          ...(off ? [`формула: φ = ${sg(closed(T) / D2R)}°`] : []),
        ),
      ),
      stepB(
        'Ответ',
        ansB(
          [[bold('φ = φ₀ cos kt + (φ̇₀/k) sin kt − (1/(lk))∫₀ᵗ ξ̈(τ) sin k(t − τ) dτ')], 'закон движения маятника'],
          [`φ(${sg(T)}) = ${sg(linEnd / D2R)}°`, 'по малым колебаниям', 'aux'],
        ),
      ),
    ];
    return done({
      vals: { k, phiEnd: linEnd, phiEndNL: nlEnd, ...(off ? { phiClosed: closed(T) } : {}) },
      steps,
      plot: {
        xl: 't, с',
        yl: 'φ, °',
        series: [
          { name: 'φ(t), малые колебания', pts: sample((t) => lin(t) / D2R, 0, T, 150) },
          { name: 'φ(t), точное уравнение', pts: nl.filter((_p, i) => i % 40 === 0).map((s) => [s.t, s.y[0] / D2R] as [number, number]) },
        ],
      },
    });
  },
};

/* ---------- 53.50 ---------- */
/** Периодическое (период π/ω) решение ẍ + k²x = (F/m)|sin ωt| на [0, π/ω]: x = x_p + C cos kt + D sin kt. */
export function absSinSolution(m: number, c: number, F: number, w: number) {
  const k = Math.sqrt(c / m);
  const T = Math.PI / w;
  const f = F / m;
  const resonant = Math.abs(k - w) < 1e-9 * k;
  // частное решение: x_p(0), x_p'(0), x_p(T), x_p'(T)
  const A0 = resonant ? 0 : f / (k * k - w * w);
  const xp = (t: number) => (resonant ? -(f / (2 * k)) * t * Math.cos(k * t) : A0 * Math.sin(w * t));
  const vp = (t: number) => (resonant ? -(f / (2 * k)) * (Math.cos(k * t) - k * t * Math.sin(k * t)) : A0 * w * Math.cos(w * t));
  // x(0) = x(T):  (1 − cos kT)·C − sin kT·D = x_p(T) − x_p(0);  ẋ(0) = ẋ(T):  k sin kT·C + k(1 − cos kT)·D = ẋ_p(T) − ẋ_p(0)
  const ck = Math.cos(k * T),
    sk = Math.sin(k * T);
  const a11 = 1 - ck,
    a12 = -sk,
    b11 = k * sk,
    b12 = k * (1 - ck);
  const r1 = xp(T) - xp(0),
    r2 = vp(T) - vp(0);
  const det = a11 * b12 - a12 * b11;
  if (Math.abs(det) < 1e-9 * k) return null;
  const C = (r1 * b12 - a12 * r2) / det;
  const D = (a11 * r2 - b11 * r1) / det;
  const x = (t: number) => {
    const s = t - Math.floor(t / T) * T;
    return xp(s) + C * Math.cos(k * s) + D * Math.sin(k * s);
  };
  return { k, T, A0, C, D, x, resonant };
}
const A_ABSIN: AskDef = {
  id: 'absin',
  title: '53.50: колебания груза на пружине под действием силы F|sin ωt|',
  hint: 'Сила F|sin ωt| — периодическая с периодом π/ω (выпрямленная синусоида). Колебания «с частотой возмущающей силы» — периодическое решение с тем же периодом π/ω: на промежутке 0 ≤ t ≤ π/ω решение x = x_ч + C cos kt + D sin kt, а C и D находят из условий x(0) = x(π/ω), ẋ(0) = ẋ(π/ω).',
  n: { m: 1, c: 100, F: 10, w: 4, nper: 3 },
  fields: [
    { k: 'm', label: 'масса груза m, кг' },
    { k: 'c', label: 'жёсткость пружины c, Н/м' },
    { k: 'F', label: 'амплитуда силы F, Н' },
    { k: 'w', label: 'частота ω, рад/с' },
    { k: 'nper', label: 'сколько периодов силы показать на графике' },
  ],
  solve: (q, ex) => {
    const { m, c, F, w } = q.n;
    if (!pos(m, c, F, w, q.n.nper)) return fail(['Все данные — положительные.']);
    const k = Math.sqrt(c / m);
    const sol = absSinSolution(m, c, F, w);
    const jRes = (k * Math.PI) / (2 * w);
    if (!sol || Math.abs(Math.sin(jRes)) < 1e-6)
      return fail([`k = ${sg(k)} 1/с кратна 2ω (k = 2jω): частота второй гармоники силы 2ω совпала с собственной, периодического решения нет — резонанс.`]);
    const { T, A0, C, D, x, resonant } = sol;
    const xs = sample(x, 0, T, 400);
    const xmax = Math.max(...xs.map((p) => Math.abs(p[1])));
    const st = F / c;
    const steps = [
      stepEx(
        ex,
        'Уравнение',
        'Уравнение движения груза: m ẍ = −c x + F|sin ωt|. Правая часть периодична с периодом T = π/ω; на промежутке 0 ≤ t ≤ T |sin ωt| = sin ωt.',
        eqB('ẍ + k² x = (F/m) sin ωt  (0 ≤ t ≤ π/ω),  k² = c/m', `k = ${sg(k)} 1/с,  T = π/ω = ${sg(T)} с`),
      ),
      stepB(
        'Общее решение',
        resonant ? eqB('x = −(F/(2mk)) t cos kt + C cos kt + D sin kt  (k = ω)') : eqB('x = F/(m(k² − ω²)) · sin ωt + C cos kt + D sin kt'),
        parB('Частное решение — вынужденные колебания в промежутке, C и D — постоянные свободных колебаний, они определяются периодичностью.'),
      ),
      stepEx(
        ex,
        'Условия периодичности',
        'Движение с частотой силы повторяется через каждый период T = π/ω: сдвиг и скорость в конце промежутка равны начальным.',
        eqB(
          'x(0) = x(π/ω),  ẋ(0) = ẋ(π/ω)',
          resonant ? `C = ${sg(C)},  D = ${sg(D)}` : 'C = −(F ω/(m k (k² − ω²))) ctg(πk/(2ω)),  D = −F ω/(m k (k² − ω²))',
          `C = ${sg(C)} м,  D = ${sg(D)} м`,
        ),
      ),
      stepB(
        'Закон движения',
        resonant
          ? eqB(`x = ${sg(C)} cos kt + ${sg(D)} sin kt − ${sg(F / (2 * m * k))} t cos kt`)
          : eqB('x = F/(m(k² − ω²)) · [ sin ωt − (ω/k) sin kt − (ω/k) ctg(πk/(2ω)) cos kt ],  0 ≤ t ≤ π/ω', 'на следующих промежутках движение повторяется'),
        parB(`Наибольшее отклонение |x|max = ${sg(xmax)} м, статическое F/c = ${sg(st)} м, динамичность ${sg(xmax / st, 3)}.`),
      ),
      stepB(
        'Ответ',
        ansB(
          [[bold('x = F/(m(k² − ω²))·[sin ωt − (ω/k) sin kt − (ω/k) ctg(πk/(2ω)) cos kt]')], '0 ≤ t ≤ π/ω; далее — повторение с периодом π/ω'],
          [`|x|max = ${sg(xmax)} м`, 'наибольшее отклонение', 'aux'],
        ),
      ),
    ];
    return done({
      vals: { k, A0, C, D, xmax, x0: x(0), xHalf: x(T / 2) },
      steps,
      plot: {
        xl: 't, с',
        yl: 'x, м',
        series: [
          { name: 'x(t)', pts: sample(x, 0, q.n.nper * T, 300) },
          { name: 'F|sin ωt|/c, м', pts: sample((t) => st * Math.abs(Math.sin(w * t)), 0, q.n.nper * T, 300) },
        ],
      },
    });
  },
};

/* ---------- 53.53 ---------- */
const SHAFT_CASES: { id: string; label: string; f: (l: number) => number; lo: number; hi: number; formula: string }[] = [
  {
    id: 'pc',
    label: 'один конец в коротком подшипнике (шарнир), другой — в длинном (заделка) — 53.53',
    f: (x) => Math.tan(x) - Math.tanh(x),
    lo: 3.9,
    hi: 3.95,
    formula: 'tg λ = th λ',
  },
  { id: 'pp', label: 'оба конца в коротких подшипниках (шарниры)', f: (x) => Math.sin(x), lo: 3, hi: 3.3, formula: 'sin λ = 0' },
  { id: 'cc', label: 'оба конца в длинных подшипниках (заделки)', f: (x) => Math.cos(x) * Math.cosh(x) - 1, lo: 4.6, hi: 4.8, formula: 'cos λ ch λ = 1' },
  {
    id: 'cf',
    label: 'один конец в длинном подшипнике, другой свободен (консоль)',
    f: (x) => Math.cos(x) * Math.cosh(x) + 1,
    lo: 1.7,
    hi: 2,
    formula: 'cos λ ch λ = −1',
  },
];
export function shaftLambda(id: string): number {
  const cs = SHAFT_CASES.find((c) => c.id === id) ?? SHAFT_CASES[0];
  return bisect(cs.f, cs.lo, cs.hi);
}
const A_SHAFT: AskDef = {
  id: 'shaft',
  title: '53.53: критическая скорость тяжёлого вала',
  hint: 'Критическая скорость вращения равна первой собственной частоте поперечных колебаний вала как балки с равномерно распределённой массой: ω_кр = λ²√(EJ g/(q l⁴)), где λ — первый корень частотного уравнения при заданном закреплении.',
  n: { EJ: 1e5, q: 200, l: 3, g: G },
  s: { sup: 'pc' },
  selects: [{ k: 'sup', label: 'Закрепление концов', options: SHAFT_CASES.map((c) => [c.id, c.label] as [string, string]) }],
  fields: [
    { k: 'EJ', label: 'жёсткость на изгиб EJ, Н·м²' },
    { k: 'q', label: 'вес единицы длины вала q, Н/м' },
    { k: 'l', label: 'длина вала l, м' },
    { k: 'g', label: 'g, м/с²' },
  ],
  solve: (q, ex) => {
    const { EJ, q: qw, l, g } = q.n;
    if (!pos(EJ, qw, l, g)) return fail(['EJ, q, l, g — положительные.']);
    const cs = SHAFT_CASES.find((c) => c.id === q.s.sup) ?? SHAFT_CASES[0];
    const lam = bisect(cs.f, cs.lo, cs.hi);
    if (!Number.isFinite(lam)) return fail(['Корень частотного уравнения не найден.']);
    const coef = lam * lam;
    const w = coef * Math.sqrt((EJ * g) / (qw * l ** 4));
    const steps = [
      stepEx(
        ex,
        'Модель',
        'Вал с распределённой массой (масса единицы длины ρ = q/g) — балка; критическая скорость совпадает с частотой собственных поперечных колебаний (при ω_вр = ω_соб прогиб вала неограниченно растёт).',
        eqB('EJ ∂⁴y/∂x⁴ + (q/g) ∂²y/∂t² = 0,  y = X(x) sin(ωt + β)', 'X⁗ = λ⁴X/l⁴,  λ⁴ = ω² q l⁴/(g EJ)'),
      ),
      stepEx(
        ex,
        'Частотное уравнение',
        'X = A cos(λx/l) + B sin(λx/l) + C ch(λx/l) + D sh(λx/l); из условий на концах (шарнир: X = X″ = 0; заделка: X = X′ = 0) получается уравнение:',
        eqB(`${cs.formula},  первый корень λ = ${sg(lam, 5)},  λ² = ${sg(coef, 5)}`),
      ),
      stepB(
        'Критическая скорость',
        eqB(
          'ω_кр = λ² √(EJ g/(q l⁴))',
          `ω_кр = ${sg(coef)}·√(${sg(EJ)}·${sg(g)}/(${sg(qw)}·${sg(l)}⁴)) = ${sg(w)} рад/с,  n_кр = ${sg((w * 30) / Math.PI)} об/мин`,
        ),
      ),
      stepB(
        'Ответ',
        ansB(
          [[bold(`ω_кр = ${sg(coef, 4)}·√(EJ g/(q l⁴)) = ${sg(w)} рад/с`)], cs.id === 'pc' ? 'книга: 15,4√(EJg/(ql⁴))' : 'критическая скорость вращения'],
          [`λ² = ${sg(coef, 5)}`, 'коэффициент', 'aux'],
        ),
      ),
    ];
    return done({ vals: { coef, w, n: (w * 30) / Math.PI }, steps });
  },
};

/* ---------- Д.25 ---------- */
export interface ReduceIn {
  trans: [number, number][];
  rot: [number, number][];
  springs: [number, number][];
  weights: [number, number][];
  alpha: number;
  d: number;
  by: 'alpha' | 'eta';
  eta: number;
  Q0: number;
  p: number;
}
export function reduceSystem(i: ReduceIn) {
  const a = i.trans.reduce((s, [m, u]) => s + m * u * u, 0) + i.rot.reduce((s, [J, w]) => s + J * w * w, 0);
  const cs = i.springs.reduce((s, [c, k]) => s + c * k * k, 0);
  const cg = 2 * i.weights.reduce((s, [W, y]) => s + W * y, 0);
  const c = cs + cg;
  if (!(a > 0)) return { ok: false as const, error: 'Коэффициент инерции a = Σ m·u² + Σ J·w² должен быть положительным.' };
  if (!(c > 0)) return { ok: false as const, error: `Коэффициент жёсткости c = ${sg(c)} ≤ 0: положение равновесия неустойчиво, колебаний нет.` };
  const k = Math.sqrt(c / a);
  let n: number, alpha: number;
  if (i.by === 'eta') {
    n = k / Math.sqrt(1 + (Math.PI / i.eta) ** 2);
    alpha = (2 * n * a) / (i.d * i.d);
  } else {
    alpha = i.alpha;
    n = (alpha * i.d * i.d) / (2 * a);
  }
  const b = 2 * n * a;
  if (!(n < k)) return { ok: false as const, error: `n = ${sg(n)} ≥ k = ${sg(k)}: сопротивление слишком велико, колебаний нет (апериодическое движение).` };
  const h = i.Q0 / a;
  const amp = (p: number) => h / Math.sqrt((k * k - p * p) ** 2 + 4 * n * n * p * p);
  const eps = (p: number) => Math.atan2(2 * n * p, k * k - p * p);
  const p1 = k * k > 2 * n * n ? Math.sqrt(k * k - 2 * n * n) : NaN;
  const p3 = k * k > 2 * n * n ? (k * k) / Math.sqrt(k * k - 2 * n * n) : NaN;
  const Aacc = (p: number) => (h * p * p) / Math.sqrt((k * k - p * p) ** 2 + 4 * n * n * p * p);
  return {
    ok: true as const,
    a,
    b,
    c,
    cs,
    cg,
    k,
    n,
    alpha,
    h,
    amp,
    eps,
    p1,
    p3,
    Aacc,
    Amax: Number.isFinite(p1) ? h / (2 * n * Math.sqrt(k * k - n * n)) : NaN,
    Avel: h / (2 * n),
    Ares: h / (2 * n * k),
    Aaccmax: Number.isFinite(p3) ? Aacc(p3) : NaN,
  };
}

const pairs = (n: Record<string, number>, a: string, b: string, cnt: number): [number, number][] =>
  Array.from({ length: cnt }, (_, i) => [n[`${a}${i + 1}`], n[`${b}${i + 1}`]] as [number, number]).filter(([x, y]) => x !== 0 && y !== 0);

const A_REDUCE: AskDef = {
  id: 'reduce',
  title: 'Д.25: вынужденные колебания системы тел с одной степенью свободы — приведение к одной координате',
  hint: 'Все скорости и перемещения выражаются через обобщённую скорость q̇ и координату q: скорость тела v = u·q̇, угловая скорость ω = w·q̇, деформация пружины λ = s·q, подъём центра тяжести h = y·q² (y < 0 — центр опускается). Тогда T = a q̇²/2, Π = c q²/2, Φ = b q̇²/2 и уравнение a q̈ + b q̇ + c q = Q₀ sin pt. Пустые строки — нули.',
  n: {
    m1: 20,
    u1: 0.3,
    m2: 5,
    u2: 0.6,
    m3: 2,
    u3: 0.6,
    J1: 0.9,
    w1: 1,
    J2: 4.86,
    w2: 0.6667,
    J3: 0,
    w3: 0,
    c1: 4000,
    s1: 0.42426,
    c2: 7000,
    s2: 0.1,
    c3: 0,
    s3: 0,
    W1: 19.62,
    y1: -0.1,
    W2: 176.58,
    y2: -0.1,
    d: 0.6,
    alpha: 100,
    eta: 0.812,
    P0: 20,
    f0: 0.1,
    p: 12.566,
  },
  s: { by: 'eta' },
  selects: [
    {
      k: 'by',
      label: 'Сопротивление демпфера задано',
      options: [
        ['eta', 'логарифмическим декрементом η — найти α'],
        ['alpha', 'коэффициентом α — найти η'],
      ],
    },
  ],
  fields: [
    { k: 'm1', label: 'масса тела 1, кг' },
    { k: 'u1', label: 'скорость центра тела 1 при q̇ = 1: u₁, м' },
    { k: 'm2', label: 'масса тела 2, кг' },
    { k: 'u2', label: 'скорость тела 2: u₂, м' },
    { k: 'm3', label: 'масса тела 3, кг' },
    { k: 'u3', label: 'скорость тела 3: u₃, м' },
    { k: 'J1', label: 'момент инерции вращающегося тела 1, кг·м²' },
    { k: 'w1', label: 'его угловая скорость при q̇ = 1: w₁' },
    { k: 'J2', label: 'момент инерции вращающегося тела 2, кг·м²' },
    { k: 'w2', label: 'его угловая скорость: w₂' },
    { k: 'J3', label: 'момент инерции вращающегося тела 3, кг·м²' },
    { k: 'w3', label: 'его угловая скорость: w₃' },
    { k: 'c1', label: 'жёсткость пружины 1, Н/м' },
    { k: 's1', label: 'её деформация при q = 1: s₁, м', neg: true },
    { k: 'c2', label: 'жёсткость пружины 2, Н/м' },
    { k: 's2', label: 'деформация пружины 2: s₂, м', neg: true },
    { k: 'c3', label: 'жёсткость пружины 3, Н/м' },
    { k: 's3', label: 'деформация пружины 3: s₃, м', neg: true },
    { k: 'W1', label: 'вес груза 1, Н (h = y·q²)' },
    { k: 'y1', label: 'y₁: подъём центра тяжести груза 1 (у опускающихся — отрицательное), м', neg: true },
    { k: 'W2', label: 'вес груза 2, Н' },
    { k: 'y2', label: 'y₂ для груза 2, м', neg: true },
    { k: 'd', label: 'скорость поршня демпфера при q̇ = 1: d, м' },
    { k: 'alpha', label: 'коэффициент сопротивления демпфера α, Н·с/м', show: (p) => p.s.by === 'alpha' },
    { k: 'eta', label: 'логарифмический декремент затухания η', show: (p) => p.s.by === 'eta' },
    { k: 'P0', label: 'возмущающая сила P, Н (Q₀ = P·f)' },
    { k: 'f0', label: 'f: возможное перемещение точки приложения силы на единицу q (плечо), м' },
    { k: 'p', label: 'частота возмущения p, 1/с' },
  ],
  solve: (q, ex) => {
    const n = q.n;
    const by = q.s.by === 'alpha' ? 'alpha' : 'eta';
    const inp: ReduceIn = {
      trans: pairs(n, 'm', 'u', 3),
      rot: pairs(n, 'J', 'w', 3),
      springs: pairs(n, 'c', 's', 3),
      weights: pairs(n, 'W', 'y', 2),
      alpha: n.alpha,
      d: n.d,
      by,
      eta: n.eta,
      Q0: n.P0 * n.f0,
      p: n.p,
    };
    const errs: string[] = [];
    if (!pos(n.d)) errs.push('d — положительное.');
    if (by === 'eta' ? !pos(n.eta) : !pos(n.alpha)) errs.push(by === 'eta' ? 'η — положительное.' : 'α — положительное.');
    if (!pos(n.p)) errs.push('p — положительное.');
    if (n.P0 * n.f0 === 0) errs.push('Возмущающая сила P·f не должна быть нулевой.');
    if (errs.length) return fail(errs);
    const r = reduceSystem(inp);
    if (!r.ok) return fail([r.error]);
    const A = r.amp(n.p),
      eps = r.eps(n.p);
    const eta = (Math.PI * r.n) / Math.sqrt(r.k * r.k - r.n * r.n);
    const kin: string[] = [
      ...inp.trans.map(([m, u], i) => `T${i + 1} = m·(u q̇)²/2:  a-вклад m·u² = ${sg(m * u * u)}`),
      ...inp.rot.map(([J, w], i) => `T${i + 1}′ = J·(w q̇)²/2:  a-вклад J·w² = ${sg(J * w * w)}`),
    ];
    const steps = [
      stepEx(
        ex,
        'Координата и кинематика',
        'За обобщённую координату принят q (в книге — угол поворота колеса 1). Все скорости и деформации пропорциональны q̇ и q с коэффициентами, найденными из кинематики системы (мгновенные центры скоростей, малость перемещений).',
        parB('Каждое тело: v = u·q̇, ω = w·q̇; пружина: λ = s·q; демпфер: v_д = d·q̇.'),
      ),
      stepB('Кинетическая энергия и коэффициент инерции', eqB('T = (a/2) q̇²,  a = Σ m·u² + Σ J·w²', ...kin, `a = ${sg(r.a)} кг·м²`)),
      stepB(
        'Потенциальная энергия и коэффициент жёсткости',
        eqB('Π = (c/2) q²,  c = Σ c_пр·s² + 2Σ W·y', `Σ c_пр·s² = ${sg(r.cs)},  2Σ W·y = ${sg(r.cg)},  c = ${sg(r.c)} Н·м`),
        parB(
          'Слагаемые 2W·y учитывают второй порядок малости подъёма центров тяжести: у опускающихся при отклонении тел (перевёрнутый маятник) они уменьшают жёсткость.',
        ),
      ),
      stepEx(
        ex,
        'Параметры затухания',
        'Диссипативная функция Релея Φ = (α/2)v_д² = (b/2)q̇², b = α d², b/a = 2n. Декремент η = πn/√(k² − n²) — по половине условного периода T* = 2π/√(k² − n²).',
        eqB(
          `k = √(c/a) = ${sg(r.k)} 1/с`,
          by === 'eta' ? `n = k/√(1 + π²/η²) = ${sg(r.n)} 1/с,  α = 2n·a/d² = ${sg(r.alpha)} Н·с/м` : `n = α d²/(2a) = ${sg(r.n)} 1/с,  η = ${sg(eta, 4)}`,
        ),
      ),
      stepB(
        'Уравнение вынужденных колебаний',
        eqB(
          'a q̈ + b q̇ + c q = Q₀ sin pt  ⇒  q̈ + 2n q̇ + k² q = h sin pt',
          `Q₀ = P·f = ${sg(inp.Q0)},  h = Q₀/a = ${sg(r.h)} 1/с²`,
          'q = A sin(pt − ε),  A = h/√((k² − p²)² + 4n²p²),  tg ε = 2np/(k² − p²)',
        ),
        eqB(`при p = ${sg(n.p)} 1/с:  A = ${sg(A)},  ε = ${sg((eps * 180) / Math.PI)}° = ${sg(eps)} рад`, `q = ${sg(A)} sin(${sg(n.p)} t − ${sg(eps)})`),
      ),
      stepEx(
        ex,
        'Наибольшие значения при изменяющейся частоте',
        'Амплитуда обобщённой координаты максимальна при p₁ = √(k² − 2n²); амплитуда скорости — при p₂ = k (резонанс); амплитуда ускорения h p²/√(…) — при p₃ = k²/√(k² − 2n²).',
        Number.isFinite(r.p1)
          ? eqB(
              `p₁ = ${sg(r.p1)} 1/с,  A_max = h/(2n√(k² − n²)) = ${sg(r.Amax)}`,
              `p₂ = k = ${sg(r.k)} 1/с,  амплитуда скорости h/(2n) = ${sg(r.Avel)}`,
              `p₃ = ${sg(r.p3)} 1/с,  амплитуда ускорения = ${sg(r.Aaccmax)}`,
            )
          : eqB(`k² ≤ 2n²: амплитуда монотонно убывает с ростом p;  при p = k: A = h/(2nk) = ${sg(r.Ares)}`),
      ),
      stepB(
        'Ответ',
        ansB(
          [[bold(`k = ${sg(r.k)} 1/с,  n = ${sg(r.n)} 1/с`)], 'частота свободных колебаний и коэффициент затухания'],
          [`α = ${sg(r.alpha)} Н·с/м`, 'коэффициент сопротивления демпфера', 'aux'],
          [`A(p) = ${sg(A)},  ε = ${sg(eps)} рад`, 'амплитуда и сдвиг фазы при заданной частоте', 'aux'],
        ),
      ),
    ];
    const pmax = Math.max(2 * r.k, n.p * 1.1);
    return done({
      vals: { a: r.a, c: r.c, k: r.k, n: r.n, alpha: r.alpha, h: r.h, A, eps, p1: r.p1, Amax: r.Amax, Avel: r.Avel, p3: r.p3, Aacc: r.Aaccmax },
      steps,
      plot: {
        xl: 'p, 1/с',
        yl: 'A',
        series: [{ name: 'A(p)', pts: sample((p) => r.amp(p), 0, pmax, 240) }],
        marks: [{ x: n.p, y: A, label: 'p' }, ...(Number.isFinite(r.p1) ? [{ x: r.p1, y: r.Amax, label: 'p₁' }] : [])],
      },
    });
  },
};

export const OSC_ASKS2: AskDef[] = [A_CRANK, A_SWING, A_ABSIN, A_SHAFT, A_REDUCE];
