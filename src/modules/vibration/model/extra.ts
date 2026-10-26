/**
 * Пункт 30, «Колебания систем»: задачи §54 в буквах и приближённые формулы — второй экран раздела.
 *
 *  - rodthread 54.9–54.11 — стержень на нити: частоты, формы, приближённые формулы при малом отношении длин;
 *  - slider    54.23 — маятник на ползуне с пружиной: условие равенства частот c = (P₁ + P₂)/l;
 *  - twopend   54.24 — два маятника с пружиной: положение равновесия, потом частоты;
 *  - platform  54.25 — подвес с демпфером на движущейся платформе ξ(t): уравнения движения, отклик;
 *  - wire      54.26 — два маятника на натянутой проволоке: частоты и приближение малого отношения;
 *  - torsabs   54.41 — крутильные колебания с маятниковым гасителем: уравнения Лагранжа и линеаризация.
 */
import { evalExpr, parseExpr } from '../../../shared/expr';
import { ansB, bisect, bold, eqB, fail, parB, rk4, sample, sg, stepB, stepEx, type AskDef, type ExtraOut } from '../../../shared/extra';
import { eigenSym, solve, solveComplex, type Mat } from './linalg';

const G = 9.81;
const D2R = Math.PI / 180;
const pos = (...x: number[]) => x.every((v) => v > 0 && Number.isFinite(v));
const done = (o: Omit<ExtraOut, 'ok' | 'errors'>): ExtraOut => ({ ok: true, errors: [], ...o });

/* ---------- 54.9–54.11 ---------- */
/** Частоты и формы стержня длины L на нити длины l: k²·M v = K v (на единицу массы стержня). */
export function rodOnThread(L: number, l: number, g: number) {
  const M: Mat = [
    [l * l, (l * L) / 2],
    [(l * L) / 2, (L * L) / 3],
  ];
  const K: Mat = [
    [g * l, 0],
    [0, (g * L) / 2],
  ];
  const e = eigenSym(K, M);
  if (!e) return null;
  const k = e.lam.map((x) => Math.sqrt(Math.max(0, x)));
  // v = (φ_нити, φ_стержня); отношение φ₁/φ₂
  const mu = e.vec.map((v) => v[0] / v[1]);
  return { k, mu, M, K };
}
const A_ROD: AskDef = {
  id: 'rodthread',
  title: '54.9–54.11: однородный стержень на нити — частоты и приближённые формулы при малом отношении длин',
  hint: 'Нить длины l (массой пренебречь) подвешена к неподвижной точке, к её концу шарнирно прикреплён конец однородного стержня длины L. Углы нити φ₁ и стержня φ₂ — от вертикали. Малые колебания: T = m[l²φ̇₁² + lLφ̇₁φ̇₂ + L²φ̇₂²/3]/2, Π = mg[lφ₁² + Lφ₂²/2]/2.',
  n: { L: 1, l: 20, g: G },
  s: { case: 'long' },
  selects: [
    {
      k: 'case',
      label: 'Какую задачу решать',
      options: [
        ['exact', '54.9: любые l и L (частоты и формы по уравнению частот)'],
        ['long', '54.10: нить много длиннее стержня — отношение низшей частоты к частоте математического маятника длиной l'],
        ['short', '54.11: нить много короче стержня — отношение низшей частоты к частоте физического маятника (стержень на оси в конце)'],
      ],
    },
  ],
  fields: [
    { k: 'L', label: 'длина стержня L, м' },
    { k: 'l', label: 'длина нити l, м' },
    { k: 'g', label: 'g, м/с²' },
  ],
  solve: (q, ex) => {
    const { L, l, g } = q.n;
    if (!pos(L, l, g)) return fail(['L, l, g — положительные.']);
    const r = rodOnThread(L, l, g);
    if (!r) return fail(['Матрица инерции не положительно определена.']);
    const [k1, k2] = r.k;
    const cs = q.s.case;
    const eps = cs === 'short' ? l / L : L / l;
    const refK = cs === 'short' ? Math.sqrt((3 * g) / (2 * L)) : Math.sqrt(g / l);
    const ratio = k1 / refK;
    const approx = cs === 'short' ? 1 - (9 / 16) * eps : 1 - eps / 4;
    const steps = [
      stepEx(
        ex,
        'Энергия и уравнения',
        'Скорость центра стержня v_C = l φ̇₁ + (L/2)φ̇₂ (малые углы), ω = φ̇₂, J_C = mL²/12. Высота центра над нижним положением: l(1 − cos φ₁) + (L/2)(1 − cos φ₂).',
        eqB('T = (m/2)[l² φ̇₁² + l L φ̇₁φ̇₂ + (L²/3) φ̇₂²],  Π = (m g/2)[l φ₁² + (L/2) φ₂²]'),
      ),
      stepB(
        'Уравнение частот',
        eqB(
          'det(K − k²M) = 0:  (g l − k² l²)(gL/2 − k²L²/3) − (k² l L/2)² = 0',
          `k₁ = ${sg(k1)} 1/с,  k₂ = ${sg(k2)} 1/с`,
          `φ₁/φ₂ при k₁ = ${sg(r.mu[0], 4)},  при k₂ = ${sg(r.mu[1], 4)}`,
        ),
      ),
      ...(cs === 'exact'
        ? []
        : [
            stepEx(
              ex,
              cs === 'long' ? 'Разложение по малому L/l' : 'Разложение по малому l/L',
              cs === 'long'
                ? 'Для λ = k²l/g и ε = L/l уравнение частот сводится к (1 − λ)(1/2 − λε/3) = λ²ε/4; λ = 1 + δ, δ малое: −δ/2 ≈ ε/4, δ ≈ −ε/2 (ε² отбрасываем).'
                : 'Для λ = k²L/g и ε = l/L уравнение частот (1 − λε)(1/2 − λ/3) = λ²ε/4; низший корень λ = 3/2 + δ (3/2 — стержень на оси в конце): −δ/3 ≈ 9ε/16, δ ≈ −27ε/16, k/k₀ = √(λ/(3/2)) ≈ 1 − 9ε/16 (ε² отбрасываем).',
              eqB(
                cs === 'long' ? 'k₁/√(g/l) ≈ 1 − L/(4l)' : 'k₁/√(3g/(2L)) ≈ 1 − (9/16)·l/L',
                `ε = ${sg(eps)}:  по формуле ${sg(approx, 6)},  по уравнению частот ${sg(ratio, 6)}  (разница ${sg(Math.abs(ratio - approx), 2)})`,
              ),
            ),
          ]),
      stepB(
        'Ответ',
        cs === 'exact'
          ? ansB(
              [[bold(`k₁ = ${sg(k1)} 1/с,  k₂ = ${sg(k2)} 1/с`)], 'главные частоты'],
              [`k₁/√(g/l) = ${sg(k1 / Math.sqrt(g / l))},  k₂/√(g/l) = ${sg(k2 / Math.sqrt(g / l))}`, 'в долях √(g/l)', 'aux'],
            )
          : ansB(
              [
                [bold(`k₁/k₀ ≈ ${cs === 'long' ? '1 − L/(4l)' : '1 − 9l/(16L)'} = ${sg(approx, 5)}`)],
                cs === 'long' ? 'k₀ = √(g/l) — математический маятник длиной l' : 'k₀ = √(3g/(2L)) — стержень, качающийся около конца',
              ],
              [`точное отношение ${sg(ratio, 4)}`, 'по уравнению частот', 'aux'],
            ),
      ),
    ];
    return done({ vals: { k1, k2, mu1: r.mu[0], mu2: r.mu[1], ratio, approx, eps }, steps });
  },
};

/* ---------- 54.23 ---------- */
const A_SLIDER: AskDef = {
  id: 'slider',
  title: '54.23: маятник на ползуне с пружиной и сопротивлением — условие равенства главных частот',
  hint: 'Ползун веса P₁ движется вертикально на пружине жёсткости c; на нём подвешен математический маятник длины l и веса P₂. Малые колебания (x — вертикальное смещение ползуна, φ — угол маятника): связь вертикального движения ползуна с φ — второго порядка малости, поэтому уравнения линейного приближения разделяются.',
  n: { P1: 20, P2: 5, l: 0.5, c: 100, b: 0, g: G, x0: 0.02, phi0: 5 },
  s: { find: 'c' },
  selects: [
    {
      k: 'find',
      label: 'Что задано',
      options: [
        ['c', 'найти c, при котором главные частоты равны (при b = 0)'],
        ['check', 'c задана — найти частоты и закон движения'],
      ],
    },
  ],
  fields: [
    { k: 'P1', label: 'вес ползуна P₁, Н' },
    { k: 'P2', label: 'вес маятника P₂, Н' },
    { k: 'l', label: 'длина маятника l, м' },
    { k: 'c', label: 'жёсткость пружины c, Н/м', show: (p) => p.s.find === 'check' },
    { k: 'b', label: 'коэффициент сопротивления b (сила −b·ẋ), Н·с/м', zero: true },
    { k: 'g', label: 'g, м/с²' },
    { k: 'x0', label: 'начальное смещение ползуна x₀, м', neg: true, zero: true },
    { k: 'phi0', label: 'начальный угол маятника φ₀, °', neg: true, zero: true },
  ],
  solve: (q, ex) => {
    const { P1, P2, l, g } = q.n;
    const b = q.n.b;
    if (!pos(P1, P2, l, g) || !(b >= 0)) return fail(['P₁, P₂, l, g — положительные, b ≥ 0.']);
    const m = (P1 + P2) / g;
    const cStar = (P1 + P2) / l;
    const c = q.s.find === 'c' ? cStar : q.n.c;
    if (!pos(c)) return fail(['c — положительное.']);
    const k1 = Math.sqrt(c / m),
      k2 = Math.sqrt(g / l),
      h = b / (2 * m);
    const kd = k1 > h ? Math.sqrt(k1 * k1 - h * h) : NaN;
    const x0 = q.n.x0,
      ph0 = q.n.phi0 * D2R;
    const T = (2 * Math.PI) / Math.min(k1, k2);
    const steps = [
      stepEx(
        ex,
        'Уравнения движения',
        'Координаты x (ползун вниз от равновесия) и φ. Положение груза: (l sin φ, x + l cos φ), поэтому кинетическая энергия T = ((m₁ + m₂)ẋ² − 2m₂ l ẋφ̇ sin φ + m₂l²φ̇²)/2: член связи содержит произведение ẋφ̇φ — третьего порядка, в линейном приближении его нет.',
        eqB('(m₁ + m₂) ẍ + b ẋ + c x = 0,   l φ̈ + g φ = 0'),
      ),
      stepB(
        'Главные частоты',
        eqB('k₁² = c/(m₁ + m₂) = c g/(P₁ + P₂),   k₂² = g/l', `k₁ = ${sg(k1)} 1/с,  k₂ = ${sg(k2)} 1/с`),
        b > 0
          ? parB(
              `С сопротивлением: x затухает, h = b/(2(m₁ + m₂)) = ${sg(h)} 1/с, частота ${Number.isFinite(kd) ? sg(kd) + ' 1/с' : 'апериодическое движение (h ≥ k₁)'}; φ — как раньше.`,
            )
          : parB('Без сопротивления.'),
      ),
      stepEx(
        ex,
        'Условие равных частот',
        'Приравниваем k₁² = k₂² при b = 0:',
        eqB(
          'c/(m₁ + m₂) = g/l  ⇒  c = (P₁ + P₂)/l',
          `c* = ${sg(cStar)} Н/м${q.s.find === 'check' ? `,  при заданной c = ${sg(c)}: k₁/k₂ = ${sg(k1 / k2, 4)}` : ''}`,
        ),
      ),
      stepB(
        'Закон движения',
        b > 0 && Number.isFinite(kd)
          ? eqB(`x = A₁ e^(−ht) sin(√(k₁² − h²)·t + ε₁),  A₁ = ${sg(Math.abs(x0))}`, 'φ = A₂ sin(k₂ t + ε₂)')
          : eqB('x = A₁ sin(k₁ t + ε₁),  φ = A₂ sin(k₂ t + ε₂)', 'A₁, A₂, ε₁, ε₂ — по начальным условиям'),
      ),
      stepB(
        'Ответ',
        ansB(
          [[bold(`c = (P₁ + P₂)/l = ${sg(cStar)} Н/м`)], 'при ней главные частоты равны (b = 0)'],
          [`k₁ = ${sg(k1)},  k₂ = ${sg(k2)} 1/с`, 'частоты при заданных данных', 'aux'],
        ),
      ),
    ];
    return done({
      vals: { cStar, k1, k2, ratio: k1 / k2, h },
      steps,
      plot: {
        xl: 't, с',
        yl: 'x, см  ·  φ, °',
        series: [
          {
            name: 'x(t), см',
            pts: sample((t) => 100 * x0 * Math.exp(-h * t) * (Number.isFinite(kd) ? Math.cos(kd * t) + (h / kd) * Math.sin(kd * t) : 1), 0, 3 * T, 300),
          },
          { name: 'φ(t), °', pts: sample((t) => (ph0 / D2R) * Math.cos(k2 * t), 0, 3 * T, 300) },
        ],
      },
    });
  },
};

/* ---------- 54.24 ---------- */
export function twoPendulums(R: number, P: number, c: number, l0: number, g: number) {
  // положение равновесия: P·tg α = c(l₀ − l), l = 2R sin α
  const F = (l: number) => (P * l) / Math.sqrt(4 * R * R - l * l) - c * (l0 - l);
  const l = bisect(F, 0, 2 * R * (1 - 1e-12));
  if (!Number.isFinite(l)) return null;
  const al = Math.asin(l / (2 * R));
  const m = P / g;
  // f″ — вторая производная энергии пружины по s = θ₁ + θ₂
  const f2 = c * R * R * Math.cos(al) ** 2 + 0.5 * c * (l0 - l) * R * Math.sin(al);
  const n2 = (f2 + P * R * Math.cos(al)) / (m * R * R);
  const mu2 = f2 / (m * R * R);
  return { l, al, f2, n2, mu2, ka2: (g * Math.cos(al)) / R, ks2: n2 + mu2 };
}
const A_TWOPEND: AskDef = {
  id: 'twopend',
  title: '54.24: два маятника, соединённые пружиной, — положение равновесия и частоты главных колебаний',
  hint: 'Два одинаковых невесомых стержня длины R подвешены в точке O, на концах — грузы веса P, соединённые пружиной жёсткости c и длины l₀ в ненапряжённом состоянии. Равновесие симметричное: стержни отклонены на ±α. Сначала находится α (из уравнения моментов), потом — малые колебания около него.',
  n: { R: 0.5, P: 10, c: 200, l0: 0.6, g: G },
  fields: [
    { k: 'R', label: 'длина стержней R, м' },
    { k: 'P', label: 'вес каждого груза P, Н' },
    { k: 'c', label: 'жёсткость пружины c, Н/м' },
    { k: 'l0', label: 'длина пружины в ненапряжённом состоянии l₀, м' },
    { k: 'g', label: 'g, м/с²' },
  ],
  solve: (q, ex) => {
    const { R, P, c, l0, g } = q.n;
    if (!pos(R, P, c, l0, g)) return fail(['Все данные — положительные.']);
    const r = twoPendulums(R, P, c, l0, g);
    if (!r) return fail(['Положение равновесия не найдено.']);
    const { l, al, f2, n2, mu2 } = r;
    const m = P / g;
    const ka = Math.sqrt(r.ka2),
      ks = Math.sqrt(r.ks2);
    const steps = [
      stepEx(
        ex,
        'Положение равновесия',
        'Углы стержней от вертикали θ₁ и θ₂ (в разные стороны); длина пружины l = 2R sin((θ₁ + θ₂)/2). В симметричном равновесии θ₁ = θ₂ = α, l = 2R sin α. Моменты сил относительно O для одного стержня: P R sin α = c(l₀ − l)·R cos α (пружина сжата — расталкивает грузы).',
        eqB('P·tg α = c(l₀ − l),  sin α = l/(2R)', 'P l/√(4R² − l²) = c(l₀ − l)'),
        parB(`Единственный корень находится делением отрезка: l = ${sg(l)} м, α = ${sg((al * 180) / Math.PI)}°.`),
      ),
      stepEx(
        ex,
        'Энергия около равновесия',
        'Πпр = c(l − l₀)²/2 зависит от s = θ₁ + θ₂ (l = 2R sin(s/2)); вторая производная по s: f″ = c R² cos²α + c(l₀ − l)R sin α/2. Гравитационная часть добавляет P R cos α к каждому диагональному коэффициенту.',
        eqB(
          'T = (m R²/2)(θ̇₁² + θ̇₂²),  Π = ½[(f″ + P R cos α)(u₁² + u₂²) + 2 f″ u₁u₂]',
          `f″ = ${sg(f2)} Н·м`,
          `n² = (f″ + P R cos α)/(m R²) = ${sg(n2)},  μ² = f″/(m R²) = ${sg(mu2)} 1/с²`,
        ),
      ),
      stepB(
        'Частоты',
        eqB(
          'k⁴ − 2n²k² + n⁴ − μ⁴ = 0  ⇒  k² = n² ± μ²',
          `противофазные колебания (u₁ = −u₂): k_a² = n² − μ² = g cos α/R = ${sg(r.ka2)},  k_a = ${sg(ka)} 1/с`,
          `синфазные (u₁ = u₂): k_s² = n² + μ² = g cos α/R + (2f″)/(m R²) = ${sg(r.ks2)},  k_s = ${sg(ks)} 1/с`,
        ),
        parB('При противофазных колебаниях длина пружины в первом приближении не меняется, остаётся только тяжесть.'),
      ),
      stepB(
        'Ответ',
        ansB(
          [[bold(`k_a = ${sg(ka)} 1/с,  k_s = ${sg(ks)} 1/с`)], 'главные частоты около положения равновесия'],
          [`α = ${sg((al * 180) / Math.PI)}°,  l = ${sg(l)} м`, 'положение равновесия', 'aux'],
          [`m = P/g = ${sg(m)} кг`, 'масса груза', 'aux'],
        ),
      ),
    ];
    return done({ vals: { l, alpha: (al * 180) / Math.PI, ka, ks, n2, mu2, f2 }, steps });
  },
};

/* ---------- 54.25 ---------- */
const A_PLATFORM: AskDef = {
  id: 'platform',
  title: '54.25: подвес с демпфером на движущейся платформе ξ(t) — уравнения движения и отклик',
  hint: 'Платформа движется по закону ξ(t). К ней на пружине c₁ подвешена масса m₁ с поршнем демпфера; камера демпфера (масса m₂) опирается на пружину c₂, другой конец которой закреплён на поршне; вязкое трение пропорционально относительной скорости поршня и камеры (коэффициент β). Перемещения x₁, x₂ — вниз от положения равновесия.',
  n: { m1: 2, m2: 1, c1: 400, c2: 200, beta: 5, a: 0.01, p: 10, T: 5 },
  s: { kind: 'harm', xi: '0,01*sin(10*t)' },
  selects: [
    {
      k: 'kind',
      label: 'Закон движения платформы',
      options: [
        ['harm', 'ξ = a sin pt — установившиеся колебания и амплитудная кривая'],
        ['formula', 'любой ξ(t) — формулой, интегрирование из состояния покоя'],
      ],
    },
  ],
  fields: [
    { k: 'm1', label: 'масса m₁, кг' },
    { k: 'm2', label: 'масса камеры m₂, кг' },
    { k: 'c1', label: 'жёсткость c₁, Н/м' },
    { k: 'c2', label: 'жёсткость c₂, Н/м' },
    { k: 'beta', label: 'коэффициент сопротивления β, Н·с/м', zero: true },
    { k: 'a', label: 'амплитуда платформы a, м', show: (p) => p.s.kind === 'harm' },
    { k: 'p', label: 'частота платформы p, 1/с', show: (p) => p.s.kind === 'harm' },
    { k: 'xi', label: 'закон платформы ξ(t), м', text: true, vars: [], show: (p) => p.s.kind === 'formula' },
    { k: 'T', label: 'время расчёта T, с', show: (p) => p.s.kind === 'formula' },
  ],
  solve: (q, ex) => {
    const { m1, m2, c1, c2, a, p, T } = q.n;
    const beta = q.n.beta;
    if (!pos(m1, m2, c1, c2) || !(beta >= 0)) return fail(['m₁, m₂, c₁, c₂ — положительные, β ≥ 0.']);
    const harm = q.s.kind === 'harm';
    const M: Mat = [
      [m1, 0],
      [0, m2],
    ];
    const B: Mat = [
      [beta, -beta],
      [-beta, beta],
    ];
    const K: Mat = [
      [c1 + c2, -c2],
      [-c2, c2],
    ];
    const e = eigenSym(K, M)!;
    const [k1, k2] = e.lam.map((x) => Math.sqrt(x));
    const E1 = 'm₁ẍ₁ + β ẋ₁ − β ẋ₂ + (c₁ + c₂) x₁ − c₂ x₂ = c₁ ξ(t)',
      E2 = 'm₂ẍ₂ − β ẋ₁ + β ẋ₂ − c₂ x₁ + c₂ x₂ = 0';
    const eqs = eqB(E1, E2);
    const common = [
      stepEx(
        ex,
        'Силы',
        'На m₁: сила пружины c₁ от платформы c₁(ξ − x₁), сила пружины c₂ от камеры −c₂(x₁ − x₂), сила демпфера −β(ẋ₁ − ẋ₂). На камеру: c₂(x₁ − x₂) и β(ẋ₁ − ẋ₂) (камера массы m₂ опирается на c₂, а не на платформу).',
        eqs,
      ),
      stepB('Частоты без сопротивления', eqB('m₁m₂k⁴ − [(c₁ + c₂)m₂ + c₂m₁]k² + c₁c₂ = 0', `k₁ = ${sg(k1)} 1/с,  k₂ = ${sg(k2)} 1/с`)),
    ];
    if (harm) {
      if (!pos(a, p)) return fail(['a и p — положительные.']);
      const resp = (w: number) => {
        const Re: Mat = K.map((r, i) => r.map((v, j) => v - w * w * M[i][j]));
        const Im: Mat = B.map((r) => r.map((v) => v * w));
        const s = solveComplex(Re, Im, [c1 * a, 0], [0, 0]);
        return s ? [Math.hypot(s.re[0], s.im[0]), Math.hypot(s.re[1], s.im[1])] : [NaN, NaN];
      };
      const [X1, X2] = resp(p);
      const wmax = Math.max(2 * k2, 1.2 * p);
      const steps = [
        ...common,
        stepEx(
          ex,
          'Установившиеся колебания',
          'ξ = a sin pt; ищем x_j = Im(X_j e^{ipt}) с комплексными амплитудами: (K − p²M + i p B) X = (c₁a, 0)ᵀ.',
          eqB(`при p = ${sg(p)} 1/с:  |X₁| = ${sg(X1)} м,  |X₂| = ${sg(X2)} м`, 'при p → 0 обе амплитуды → a (платформа «тащит» систему)'),
        ),
        stepB(
          'Ответ',
          ansB(
            [[bold(`${E1};  ${E2}`)], 'уравнения движения системы'],
            [`|X₁| = ${sg(X1)} м,  |X₂| = ${sg(X2)} м`, 'амплитуды установившихся колебаний при заданной p', 'aux'],
          ),
        ),
      ];
      return done({
        vals: { k1, k2, X1, X2 },
        steps,
        plot: {
          xl: 'p, 1/с',
          yl: '|X|, м',
          series: [
            { name: '|X₁|(p)', pts: sample((w) => Math.min(resp(w)[0], 20 * a), 0, wmax, 300) },
            { name: '|X₂|(p)', pts: sample((w) => Math.min(resp(w)[1], 20 * a), 0, wmax, 300) },
          ],
          marks: [{ x: p, y: X1, label: 'p' }],
        },
      });
    }
    if (!pos(T)) return fail(['T — положительное.']);
    const pe = parseExpr(q.s.xi);
    if (!pe.ok) return fail([`Закон ξ(t): ${pe.error}.`]);
    const xi = (t: number) => evalExpr(pe.e, t);
    const N = 4000;
    const run = rk4(
      (t, y) => {
        const [x1, x2, v1, v2] = y;
        const f = beta * (v1 - v2);
        return [v1, v2, (c1 * (xi(t) - x1) - c2 * (x1 - x2) - f) / m1, (c2 * (x1 - x2) + f) / m2];
      },
      [0, 0, 0, 0],
      0,
      T,
      N,
    );
    const end = run[N].y;
    const steps = [
      ...common,
      stepB('Движение из состояния покоя (Рунге — Кутта)', eqB(`при t = ${sg(T)} с:  x₁ = ${sg(end[0])} м,  x₂ = ${sg(end[1])} м,  ξ = ${sg(xi(T))} м`)),
      stepB('Ответ', ansB([[bold(`${E1};  ${E2}`)], 'уравнения движения при произвольном ξ(t)'])),
    ];
    return done({
      vals: { k1, k2, x1: end[0], x2: end[1] },
      steps,
      plot: {
        xl: 't, с',
        yl: 'x, м',
        series: [
          { name: 'x₁(t)', pts: run.filter((_s, i) => i % 20 === 0).map((s) => [s.t, s.y[0]] as [number, number]) },
          { name: 'x₂(t)', pts: run.filter((_s, i) => i % 20 === 0).map((s) => [s.t, s.y[1]] as [number, number]) },
          { name: 'ξ(t)', pts: sample(xi, 0, T, 200) },
        ],
      },
    });
  },
};

/* ---------- 54.26 ---------- */
export function wirePendulums(m: number, l: number, a: number, P: number, g: number) {
  const mu = (m * g * a) / (P * l);
  const kS = Math.sqrt(g / (l + (m * g * a) / P)); // синфазные
  const kA = Math.sqrt(g / (l + (m * g * a) / (3 * P))); // противофазные
  return { mu, kS, kA };
}
const A_WIRE: AskDef = {
  id: 'wire',
  title: '54.26: два маятника на натянутой проволоке — частоты малых колебаний',
  hint: 'Проволока AB (массой пренебречь) натянута грузом P: натяжение P. В точках C и D (AC = CD = DB = a) подвешены маятники — точки массы m на нитях длины l; колебания поперёк проволоки. Малое отношение μ = m g a/(P l) позволяет разложить частоты.',
  n: { m: 1, l: 0.5, a: 0.6, P: 100, g: G },
  fields: [
    { k: 'm', label: 'масса каждого маятника m, кг' },
    { k: 'l', label: 'длина нити l, м' },
    { k: 'a', label: 'расстояние a (AC = CD = DB), м' },
    { k: 'P', label: 'натяжение проволоки (вес груза P), Н' },
    { k: 'g', label: 'g, м/с²' },
  ],
  solve: (q, ex) => {
    const { m, l, a, P, g } = q.n;
    if (!pos(m, l, a, P, g)) return fail(['Все данные — положительные.']);
    const { mu, kS, kA } = wirePendulums(m, l, a, P, g);
    const k0 = Math.sqrt(g / l);
    const steps = [
      stepEx(
        ex,
        'Проволока как пружина',
        'Поперечные смещения точек C, D — y₁, y₂ (массой проволоки пренебрегаем). Натяжение P: сила на C равна −P(2y₁ − y₂)/a, на D — −P(2y₂ − y₁)/a; кроме того, на каждую точку действует натяжение нити m g φ_j (сила по направлению к грузу). Нить безмассова — равновесие точки проволоки:',
        eqB('(P/a)(2y₁ − y₂) = m g φ₁,  (P/a)(2y₂ − y₁) = m g φ₂'),
      ),
      stepEx(
        ex,
        'Движение груза',
        'Положение груза поперёк: z_j = y_j + l φ_j; m z̈_j = −m g φ_j. Обращая матрицу проволоки: y = (m g a/P)·W φ, W = (1/3)[[2,1],[1,2]], собственные значения W: 1 (синфазно) и 1/3 (противофазно).',
        eqB('(l + m g a/P) φ̈ + g φ = 0  (φ₁ = φ₂),   (l + m g a/(3P)) φ̈ + g φ = 0  (φ₁ = −φ₂)'),
      ),
      stepB(
        'Частоты',
        eqB('k₁² = g/(l + m g a/P),  k₂² = g/(l + m g a/(3P))', `k₁ = ${sg(kS)} 1/с,  k₂ = ${sg(kA)} 1/с`),
        parB(`μ = m g a/(P l) = ${sg(mu)}; при малом μ: k₁ ≈ √(g/l)(1 − μ/2) = ${sg(k0 * (1 - mu / 2))},  k₂ ≈ √(g/l)(1 − μ/6) = ${sg(k0 * (1 - mu / 6))}.`),
      ),
      stepB(
        'Ответ',
        ansB(
          [[bold(`k₁ = √(g/(l + m g a/P)) = ${sg(kS)} 1/с`)], 'маятники качаются в одну сторону'],
          [`k₂ = √(g/(l + m g a/(3P))) = ${sg(kA)} 1/с`, 'в противоположные стороны', 'aux'],
        ),
      ),
    ];
    return done({ vals: { k1: kS, k2: kA, mu, k1approx: k0 * (1 - mu / 2), k2approx: k0 * (1 - mu / 6) }, steps });
  },
};

/* ---------- 54.41 ---------- */
export function torsionAbsorber(J1: number, J2: number, Jc: number, m: number, l: number, a: number, c1: number, W: number) {
  const mla = m * l * a;
  const M: Mat = [
    [J1, 0, 0],
    [0, J2 + m * l * l, mla],
    [0, mla, Jc + m * a * a],
  ];
  const K: Mat = [
    [c1, -c1, 0],
    [-c1, c1 + mla * W * W, -mla * W * W],
    [0, -mla * W * W, mla * W * W],
  ];
  return { M, K, mla };
}
const A_TORS: AskDef = {
  id: 'torsabs',
  title: '54.41: крутильные колебания с маятниковым гасителем — уравнения Лагранжа и линеаризация',
  hint: 'Две массы I и II с моментами инерции J₁, J₂ на валу жёсткости c₁ вращаются со средней угловой скоростью Ω; ко второй массе на оси A (OA = l) подвешен маятник (масса m, AC = a, момент инерции J_C относительно оси через C). Угол φ_j — абсолютный угол поворота; M = M₀ sin pt приложен ко второй массе. Потенциальной энергией маятника в поле тяжести пренебрегаем.',
  n: { J1: 2, J2: 1, Jc: 0.0005, m: 0.5, l: 0.2, a: 0.05, c1: 500, W: 100, M0: 10, p: 150 },
  fields: [
    { k: 'J1', label: 'момент инерции массы I, J₁, кг·м²' },
    { k: 'J2', label: 'момент инерции массы II, J₂, кг·м²' },
    { k: 'Jc', label: 'момент инерции маятника относительно оси через C, J_C, кг·м²', zero: true },
    { k: 'm', label: 'масса маятника m, кг' },
    { k: 'l', label: 'OA = l, м' },
    { k: 'a', label: 'AC = a, м' },
    { k: 'c1', label: 'жёсткость вала c₁, Н·м/рад' },
    { k: 'W', label: 'средняя угловая скорость вращения Ω, рад/с' },
    { k: 'M0', label: 'амплитуда момента M₀, Н·м' },
    { k: 'p', label: 'частота момента p, рад/с' },
  ],
  solve: (q, ex) => {
    const { J1, J2, m, l, a, c1, W, M0, p } = q.n;
    const Jc = q.n.Jc;
    if (!pos(J1, J2, m, l, a, c1, W, M0, p) || !(Jc >= 0)) return fail(['J₁, J₂, m, l, a, c₁, Ω, M₀, p — положительные, J_C ≥ 0.']);
    const { M, K, mla } = torsionAbsorber(J1, J2, Jc, m, l, a, c1, W);
    const e = eigenSym(K, M);
    if (!e) return fail(['Матрица инерции не положительно определена.']);
    const lam = e.lam.map((x) => (Math.abs(x) < 1e-9 * Math.max(...e.lam.map(Math.abs)) ? 0 : x));
    const [k2, k3] = [Math.sqrt(lam[1]), Math.sqrt(lam[2])];
    const pTune = Math.sqrt((mla * W * W) / (Jc + m * a * a));
    const D: Mat = K.map((r, i) => r.map((v, j) => v - p * p * M[i][j]));
    const X = solve(D, [0, M0, 0]);
    const resp = (w: number) => {
      const Dw: Mat = K.map((r, i) => r.map((v, j) => v - w * w * M[i][j]));
      const s = solve(Dw, [0, M0, 0]);
      return s ? Math.abs(s[1]) : NaN;
    };
    const steps = [
      stepEx(
        ex,
        'Энергия',
        'Обобщённые координаты φ₁, φ₂ (массы) и φ₃ (маятник). Центр маятника C: r_C = l(cos φ₂, sin φ₂) + a(cos φ₃, sin φ₃); v_C² = l²φ̇₂² + a²φ̇₃² + 2 l a φ̇₂φ̇₃ cos(φ₂ − φ₃).',
        eqB('T = ½J₁φ̇₁² + ½(J₂ + m l²)φ̇₂² + ½(J_C + m a²)φ̇₃² + m l a φ̇₂φ̇₃ cos(φ₂ − φ₃),  Π = ½c₁(φ₂ − φ₁)²'),
      ),
      stepB(
        'Уравнения Лагранжа (нелинейные)',
        eqB(
          'J₁φ̈₁ + c₁(φ₁ − φ₂) = 0',
          '(J₂ + m l²)φ̈₂ + m l a φ̈₃ cos(φ₂ − φ₃) + m l a φ̇₃² sin(φ₂ − φ₃) + c₁(φ₂ − φ₁) = M₀ sin pt',
          '(J_C + m a²)φ̈₃ + m l a φ̈₂ cos(φ₂ − φ₃) − m l a φ̇₂² sin(φ₂ − φ₃) = 0',
        ),
        parB('Это и есть ответ задачи: дифференциальные уравнения движения обеих масс и маятника.'),
      ),
      stepEx(
        ex,
        'Линеаризация около равномерного вращения',
        'φ_j = Ωt + θ_j, θ_j малы: sin(φ₂ − φ₃) ≈ θ₂ − θ₃, cos ≈ 1, φ̇₂² ≈ φ̇₃² ≈ Ω². Центробежный момент даёт маятнику «жёсткость» m l a Ω².',
        eqB(
          'J₁θ̈₁ + c₁(θ₁ − θ₂) = 0',
          '(J₂ + m l²)θ̈₂ + m l a θ̈₃ + c₁(θ₂ − θ₁) + m l a Ω²(θ₂ − θ₃) = M₀ sin pt',
          '(J_C + m a²)θ̈₃ + m l a θ̈₂ − m l a Ω²(θ₂ − θ₃) = 0',
        ),
      ),
      stepB(
        'Частоты и настройка гасителя',
        eqB(
          `k₁ = 0 (поворот системы как твёрдого тела),  k₂ = ${sg(k2)} 1/с,  k₃ = ${sg(k3)} 1/с`,
          'настройка на частоту p: p² = m l a Ω²/(J_C + m a²)',
          `p_н = ${sg(pTune)} 1/с  (для точечного маятника J_C = 0: p_н = Ω√(l/a))`,
        ),
      ),
      stepB(
        'Установившиеся колебания',
        X
          ? eqB(
              `при p = ${sg(p)} 1/с:  |θ₁| = ${sg(Math.abs(X[0]))},  |θ₂| = ${sg(Math.abs(X[1]))},  |θ₃| = ${sg(Math.abs(X[2]))} рад`,
              'знак — относительно M₀ sin pt',
              'амплитуда θ₂ равна нулю при p² = m l a Ω²/(J_C + m a²) — маятник гасит колебания массы II',
            )
          : parB('Резонанс: определитель равен нулю.'),
      ),
      stepB(
        'Ответ',
        ansB(
          [
            [
              bold(
                'J₁φ̈₁ + c₁(φ₁ − φ₂) = 0;  (J₂ + m l²)φ̈₂ + m l a[φ̈₃ cos(φ₂ − φ₃) + φ̇₃² sin(φ₂ − φ₃)] + c₁(φ₂ − φ₁) = M₀ sin pt;  (J_C + m a²)φ̈₃ + m l a[φ̈₂ cos(φ₂ − φ₃) − φ̇₂² sin(φ₂ − φ₃)] = 0',
              ),
            ],
            'уравнения движения',
          ],
          [`p_н = ${sg(pTune)} 1/с`, 'частота настройки гасителя', 'aux'],
        ),
      ),
    ];
    const kmax = Math.max(k3 * 1.5, pTune * 1.5, p * 1.2);
    return done({
      vals: { k2, k3, pTune, th1: X ? Math.abs(X[0]) : NaN, th2: X ? Math.abs(X[1]) : NaN, th3: X ? Math.abs(X[2]) : NaN },
      steps,
      plot: {
        xl: 'p, 1/с',
        yl: '|θ₂|, рад',
        series: [{ name: '|θ₂|(p)', pts: sample((w) => Math.min(resp(w), 20 * (M0 / c1)), 0, kmax, 400) }],
        marks: [{ x: pTune, y: 0, label: 'p_н' }],
      },
    });
  },
};

export const VIB_ASKS: AskDef[] = [A_ROD, A_SLIDER, A_TWOPEND, A_PLATFORM, A_WIRE, A_TORS];
