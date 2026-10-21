/**
 * Пункт 28, «Вращение тела»: задания Яблонского.
 *
 *  - groove Д.9 — тело H вращается вокруг вертикальной оси z, в точке O его желоба — точка K массой m₂.
 *           1) пара M_z(t) действует время τ: (J_z + m₂ r_O²)(ω_τ − ω₀) = ∫₀^τ M_z dt;
 *           2) точка K движется по желобу по закону s(t): L_z = (J_z + m₂ r_K²)ω + m₂ ṡ h_K = const,
 *              h_K — момент единичного вектора касательной к желобу относительно оси z (в проекции на плоскость ⟂ z).
 *  - gears  Д.11 — колёса 1 и 2 на неподвижных осях (зацепление или ремень, ω₁/ω₂ = ρ₂/ρ₁) и груз 3 на нити,
 *           намотанной на барабан одного из колёс; движущий момент M(t) (или сила P(t) с плечом) на колесе 1,
 *           момент сопротивления M_c на колесе 2. Уравнение, приведённое к колесу 2:
 *           J_пр φ̈₂ = M(t)·u − M_c ∓ m₃ g r u_L,  J_пр = J₁u² + J₂ + m₃ r² u_L².
 */
import { diff, evalExpr, parseExpr, printExpr, simplify } from '../../../shared/expr';
import { ansB, bold, eqB, fail, parB, sample, sg, simpson, stepB, stepEx, type AskDef, type ExtraOut, type Ln } from '../../../shared/extra';

const G = 9.81;
const D2R = Math.PI / 180;
const pos = (...x: number[]) => x.every((v) => v > 0 && Number.isFinite(v));
const done = (o: Omit<ExtraOut, 'ok' | 'errors'>): ExtraOut => ({ ok: true, errors: [], ...o });

/* ---------- Д.9 ---------- */
const A_GROOVE: AskDef = {
  id: 'groove',
  title: 'Яблонский, Д.9: тело с точкой в желобе — угловая скорость после действия пары и после перемещения точки',
  hint: 'Координаты — в проекции на плоскость, перпендикулярную оси z (начало на оси, вращение против часовой стрелки при взгляде с +z положительно). Тело H — пластинка: в горизонтальной плоскости (⟂ z) или в вертикальной плоскости, содержащей ось z. Желоб — прямая из точки O под углом γ (κ — доля длины желоба в проекции) или дуга окружности.',
  n: { m1: 200, m2: 80, w0: -2, tau: 4, J: 864, R: 2.4, a: 1.2, xO: -1.6, yO: 1.2, gam: 0, kap: 1, xc: 0, yc: 0, rho: 1, psi0: 0, dir: 1, T: 2 },
  s: { M: '592*t', S: '0.5*t^2', plane: 'horiz', body: 'disk', groove: 'line' },
  selects: [
    {
      k: 'plane',
      label: 'Плоскость пластинки',
      options: [
        ['horiz', 'перпендикулярна оси z'],
        ['vert', 'содержит ось z'],
      ],
    },
    {
      k: 'body',
      label: 'Тело H',
      options: [
        ['disk', 'круглая пластинка радиуса R, центр на расстоянии a от оси'],
        ['J', 'момент инерции J_z задан'],
      ],
    },
    {
      k: 'groove',
      label: 'Желоб',
      options: [
        ['line', 'прямая из точки O'],
        ['arc', 'дуга окружности'],
      ],
    },
  ],
  fields: [
    { k: 'm1', label: 'масса тела H m₁, кг' },
    { k: 'm2', label: 'масса точки K m₂, кг', zero: true },
    { k: 'J', label: 'J_z тела H, кг·м²', show: (p) => p.s.body === 'J' },
    { k: 'R', label: 'радиус пластинки R, м', show: (p) => p.s.body === 'disk' },
    { k: 'a', label: 'расстояние центра пластинки от оси a, м', zero: true, show: (p) => p.s.body === 'disk' },
    { k: 'w0', label: 'начальная угловая скорость ω₀, рад/с', neg: true, zero: true },
    { k: 'M', label: 'момент пары M_z(t), Н·м', text: true },
    { k: 'tau', label: 'время действия пары τ, с', zero: true },
    { k: 'xO', label: 'точка O: x_O (расстояние от оси), м', neg: true, zero: true, show: (p) => p.s.groove === 'line' },
    { k: 'yO', label: 'точка O: y_O, м', neg: true, zero: true, show: (p) => p.s.groove === 'line' && p.s.plane === 'horiz' },
    { k: 'gam', label: 'угол желоба с осью x γ, °', neg: true, zero: true, show: (p) => p.s.groove === 'line' && p.s.plane === 'horiz' },
    { k: 'kap', label: 'κ — проекция единицы длины желоба (для наклонного к оси z — синус угла с осью; со знаком)', neg: true, show: (p) => p.s.groove === 'line' },
    { k: 'xc', label: 'центр дуги: x_c, м', neg: true, zero: true, show: (p) => p.s.groove === 'arc' },
    { k: 'yc', label: 'центр дуги: y_c, м', neg: true, zero: true, show: (p) => p.s.groove === 'arc' && p.s.plane === 'horiz' },
    { k: 'rho', label: 'радиус дуги ρ, м', show: (p) => p.s.groove === 'arc' },
    { k: 'psi0', label: 'угол точки O на дуге ψ₀ (от оси x), °', neg: true, zero: true, show: (p) => p.s.groove === 'arc' },
    { k: 'dir', label: 'направление движения по дуге: 1 — против часовой, −1 — по часовой', neg: true, show: (p) => p.s.groove === 'arc' },
    { k: 'S', label: 'закон движения точки по желобу OK = s(t)', text: true },
    { k: 'T', label: 'момент T (от начала движения точки), с' },
  ],
  solve: (q, ex) => {
    const { m1, m2, w0, tau, T } = q.n;
    if (!pos(m1, T) || !(m2 >= 0 && tau >= 0)) return fail(['m₁, T > 0; m₂, τ ≥ 0.']);
    const horiz = q.s.plane === 'horiz';
    let J: number;
    if (q.s.body === 'disk') {
      const { R, a } = q.n;
      if (!pos(R) || !(a >= 0)) return fail(['R > 0, a ≥ 0.']);
      J = m1 * ((horiz ? R * R / 2 : R * R / 4) + a * a);
    } else {
      J = q.n.J;
      if (!pos(J)) return fail(['J_z > 0.']);
    }
    const eM = parseExpr(q.s.M);
    if (!eM.ok) return fail([`Формула M_z(t): ${eM.error}.`]);
    const eS = parseExpr(q.s.S);
    if (!eS.ok) return fail([`Формула s(t): ${eS.error}.`]);
    const dS = simplify(diff(eS.e));
    const sT = evalExpr(eS.e, T),
      vT = evalExpr(dS, T),
      s0 = evalExpr(eS.e, 0);
    if (![sT, vT].every(Number.isFinite)) return fail(['s(T) или ṡ(T) не вычисляется.']);
    if (Math.abs(s0) > 1e-9) return fail([`Точка начинает движение из O: нужно s(0) = 0 (сейчас ${sg(s0)}).`]);
    // положение и касательная в проекции
    const at = (s: number): { x: number; y: number; tx: number; ty: number } => {
      if (q.s.groove === 'line') {
        const g = horiz ? q.n.gam * D2R : 0;
        const k = q.n.kap;
        return { x: q.n.xO + s * k * Math.cos(g), y: (horiz ? q.n.yO : 0) + s * k * Math.sin(g), tx: k * Math.cos(g), ty: k * Math.sin(g) };
      }
      const { xc, rho, psi0, dir } = q.n;
      const yc = horiz ? q.n.yc : 0;
      const d = dir < 0 ? -1 : 1;
      const ps = psi0 * D2R + (d * s) / rho;
      // в вертикальной плоскости важна только горизонтальная координата
      if (!horiz) return { x: xc + rho * Math.cos(ps), y: 0, tx: -d * Math.sin(ps), ty: 0 };
      return { x: xc + rho * Math.cos(ps), y: yc + rho * Math.sin(ps), tx: -d * Math.sin(ps), ty: d * Math.cos(ps) };
    };
    if (q.s.groove === 'arc' && !pos(q.n.rho)) return fail(['ρ > 0.']);
    const O = at(0),
      K = at(sT);
    const rO2 = O.x * O.x + O.y * O.y,
      rK2 = K.x * K.x + K.y * K.y;
    const hK = horiz ? K.x * K.ty - K.y * K.tx : 0;
    const imp = tau > 0 ? simpson((t) => evalExpr(eM.e, t), 0, tau, 2000) : 0;
    if (!Number.isFinite(imp)) return fail(['Интеграл момента пары не вычисляется.']);
    const J0 = J + m2 * rO2;
    const wt = w0 + imp / J0;
    const L = J0 * wt;
    const JT = J + m2 * rK2;
    const wT = (L - m2 * vT * hK) / JT;
    const steps = [
      stepEx(ex, 'Момент инерции тела H', q.s.body === 'disk' ? `Пластинка — круг; по теореме Гюйгенса — Штейнера (момент относительно ${horiz ? 'перпендикулярной оси через центр mR²/2' : 'диаметра mR²/4'}).` : null, eqB(`J_z = ${sg(J)} кг·м²`)),
      stepEx(ex, 'Действие пары (0 ≤ t ≤ τ)', 'Точка K неподвижна в точке O тела: её кинетический момент m₂ω r_O². Теорема об изменении кинетического момента относительно оси z: d[(J_z + m₂r_O²)ω]/dt = M_z.', eqB(`r_O² = ${sg(rO2)} м²,  J_z + m₂ r_O² = ${sg(J0)} кг·м²`, `∫₀^τ M_z dt = ${sg(imp)} Н·м·с`, `ω_τ = ω₀ + ∫M_z dt/(J_z + m₂r_O²) = ${sg(wt)} рад/с`)),
      stepEx(
        ex,
        'Движение точки по желобу (0 ≤ t ≤ T)',
        'Моментов внешних сил относительно оси z нет — L_z сохраняется. Скорость точки — переносная ω r_K и относительная ṡ по желобу; момент относительной скорости — m₂ṡ·h_K, h_K — плечо направления желоба.',
        eqB(`s(T) = ${sg(sT)} м,  ṡ = ${printExpr(dS)},  ṡ(T) = ${sg(vT)} м/с`, `точка K: x = ${sg(K.x)}, y = ${sg(K.y)};  r_K² = ${sg(rK2)} м²,  h_K = ${sg(hK)} м`, `(J_z + m₂r_O²)ω_τ = (J_z + m₂r_K²)ω_T + m₂ ṡ(T) h_K`, `${sg(L)} = ${sg(JT)}·ω_T + ${sg(m2 * vT * hK)}`),
      ),
      stepB('Ответ', ansB([[bold(`ω_τ = ${sg(wt)} рад/с`)], 'после действия пары'], [[bold(`ω_T = ${sg(wT)} рад/с`)], 'когда точка K прошла по желобу s(T)'])),
    ];
    return done({ vals: { J, wtau: wt, wT, L }, steps });
  },
};

/* ---------- Д.11 ---------- */
const A_GEARS: AskDef = {
  id: 'gears',
  title: 'Яблонский, Д.11: колёса и груз — уравнение движения, натяжение нити, окружное усилие',
  hint: 'Колёса 1 и 2 вращаются вокруг неподвижных осей; касание (зубчатое или ремень) на радиусах ρ₁ и ρ₂: ω₁ρ₁ = ω₂ρ₂. Груз 3 висит на нити, намотанной на барабан радиуса r колеса 1 или 2. Время — от момента, когда φ = 0 и ω₁ = ω₁₀. Радиусы инерции 0 — сплошные диски радиусов R₁, R₂.',
  n: { m1: 100, m2: 150, m3: 400, R1: 0.6, R2: 0.4, i1: 0.2 * Math.SQRT2, i2: 0.3, c1: 0.6, c2: 0.4, r: 0.2, rP: 0.6, Mc: 2000, w10: 2, t1: 1, g: G },
  s: { M: '4200 + 200*t', drive: 'M', load: '2', dir: 'lift', body: '2' },
  selects: [
    {
      k: 'drive',
      label: 'Движущее воздействие на колесо 1',
      options: [
        ['M', 'пара сил M(t)'],
        ['P', 'сила P(t) по касательной на радиусе r_P'],
      ],
    },
    {
      k: 'load',
      label: 'Нить груза намотана на',
      options: [
        ['2', 'барабан колеса 2'],
        ['1', 'барабан колеса 1'],
      ],
    },
    {
      k: 'dir',
      label: 'При движении груз',
      options: [
        ['lift', 'поднимается'],
        ['lower', 'опускается'],
      ],
    },
    {
      k: 'body',
      label: 'Уравнение движения',
      options: [
        ['1', 'колеса 1 (φ₁)'],
        ['2', 'колеса 2 (φ₂)'],
        ['3', 'груза 3 (z)'],
      ],
    },
  ],
  fields: [
    { k: 'm1', label: 'масса колеса 1 m₁, кг' },
    { k: 'm2', label: 'масса колеса 2 m₂, кг' },
    { k: 'm3', label: 'масса груза m₃, кг', zero: true },
    { k: 'R1', label: 'наружный радиус колеса 1 R₁, м (для сплошного диска)' },
    { k: 'R2', label: 'наружный радиус колеса 2 R₂, м (для сплошного диска)' },
    { k: 'i1', label: 'радиус инерции колеса 1 i₁, м (0 — диск)', zero: true },
    { k: 'i2', label: 'радиус инерции колеса 2 i₂, м (0 — диск)', zero: true },
    { k: 'c1', label: 'радиус касания на колесе 1 ρ₁, м' },
    { k: 'c2', label: 'радиус касания на колесе 2 ρ₂, м' },
    { k: 'r', label: 'радиус барабана с нитью груза r, м' },
    { k: 'M', label: 'M(t), Н·м или P(t), Н', text: true },
    { k: 'rP', label: 'плечо силы P r_P, м', show: (p) => p.s.drive === 'P' },
    { k: 'Mc', label: 'момент сопротивления на колесе 2 M_c, Н·м', zero: true },
    { k: 'w10', label: 'начальная угловая скорость колеса 1 ω₁₀, рад/с', zero: true },
    { k: 't1', label: 'момент времени t₁, с', zero: true },
    { k: 'g', label: 'g, м/с²' },
  ],
  solve: (q, ex) => {
    const { m1, m2, m3, R1, R2, c1, c2, r, Mc, w10, t1, g } = q.n;
    if (!pos(m1, m2, R1, R2, c1, c2, r, g) || !(m3 >= 0 && Mc >= 0 && w10 >= 0 && t1 >= 0)) return fail(['Массы колёс, радиусы, g > 0; m₃, M_c, ω₁₀, t₁ ≥ 0.']);
    const e = parseExpr(q.s.M);
    if (!e.ok) return fail([`Формула ${q.s.drive === 'P' ? 'P(t)' : 'M(t)'}: ${e.error}.`]);
    const rP = q.s.drive === 'P' ? q.n.rP : 1;
    if (!pos(rP)) return fail(['r_P > 0.']);
    const Mt = (t: number) => evalExpr(e.e, t) * rP;
    const i1 = q.n.i1 > 0 ? q.n.i1 : R1 / Math.SQRT2,
      i2 = q.n.i2 > 0 ? q.n.i2 : R2 / Math.SQRT2;
    const J1 = m1 * i1 * i1,
      J2 = m2 * i2 * i2;
    const u = c2 / c1; // ω₁/ω₂
    const uL = q.s.load === '1' ? u : 1;
    const sig = q.s.dir === 'lift' ? 1 : -1;
    const Jr = J1 * u * u + J2 + m3 * r * r * uL * uL;
    const eps2 = (t: number) => (Mt(t) * u - Mc - sig * m3 * g * r * uL) / Jr;
    const w20 = w10 / u;
    // линейный ли момент
    const A = eps2(0),
      B = eps2(1) - eps2(0);
    const linear = [2, 3.7, 0.4].every((t) => Math.abs(eps2(t) - (A + B * t)) <= 1e-9 * Math.max(1, Math.abs(A), Math.abs(B)));
    const phi2 = (t: number) => (linear ? (B * t ** 3) / 6 + (A * t * t) / 2 + w20 * t : w20 * t + simpson((x) => (t - x) * eps2(x), 0, t, 1000));
    const fac = q.s.body === '1' ? u : q.s.body === '3' ? r * uL : 1;
    const nm = q.s.body === '1' ? 'φ₁' : q.s.body === '3' ? 'z' : 'φ₂';
    const e1 = eps2(t1);
    const a3 = r * uL * e1;
    const Tn = m3 * (g + sig * a3);
    const S = q.s.load === '1' ? (J2 * e1 + Mc) / c2 : (J2 * e1 + sig * Tn * r + Mc) / c2;
    const law = linear ? `${nm} = ${sg((fac * B) / 6)}t³ + ${sg((fac * A) / 2)}t² + ${sg(fac * w20)}t` : `${nm}(t₁) = ${sg(fac * phi2(t1))}`;
    const lines: Ln[] = [
      `J₁ = m₁i₁² = ${sg(J1)},  J₂ = m₂i₂² = ${sg(J2)} кг·м²;  u = ω₁/ω₂ = ρ₂/ρ₁ = ${sg(u)}`,
      `скорость груза v₃ = r ω${q.s.load === '1' ? '₁' : '₂'} = ${sg(r * uL)}·ω₂`,
    ];
    const steps = [
      stepEx(ex, 'Кинематика', 'Касание без проскальзывания: ω₁ρ₁ = ω₂ρ₂. Нить нерастяжима.', eqB(...lines)),
      stepEx(
        ex,
        'Уравнения движения тел',
        'Разрежем нить и разъединим колёса в точке касания: колесо 1 — J₁φ̈₁ = M − S ρ₁, колесо 2 — J₂φ̈₂ = Sρ₂ − M_c' + (q.s.load === '2' ? ' ∓ T r' : '') + ', груз — m₃z̈ = ±(T − G). Исключая S и T, получаем уравнение, приведённое к колесу 2.',
        eqB(`J_пр = J₁u² + J₂ + m₃(r u_L)² = ${sg(Jr)} кг·м²`, `J_пр φ̈₂ = M(t)·u − M_c ${sig > 0 ? '−' : '+'} m₃ g r u_L`, linear ? `φ̈₂ = ${sg(A)} + ${sg(B)}t` : `φ̈₂(t₁) = ${sg(e1)} рад/с²`),
      ),
      stepEx(ex, 'Интегрирование', `Начальные условия: φ₂(0) = 0, ω₂₀ = ω₁₀/u = ${sg(w20)} рад/с.`, eqB(linear ? `φ₂ = ${sg(B / 6)}t³ + ${sg(A / 2)}t² + ${sg(w20)}t` : `φ₂(t₁) = ${sg(phi2(t1))} рад`, ...(q.s.body === '2' ? [] : [law]))),
      stepB('Натяжение нити и окружное усилие', eqB(`при t₁ = ${sg(t1)} с:  ε₂ = ${sg(e1)} рад/с²,  ускорение груза ${sg(a3)} м/с²`, `T = m₃(g ${sig > 0 ? '+' : '−'} a₃) = ${sg(Tn)} Н`, `S = ${q.s.load === '1' ? '(J₂ε₂ + M_c)/ρ₂' : `(J₂ε₂ ${sig > 0 ? '+' : '−'} T r + M_c)/ρ₂`} = ${sg(S)} Н`)),
      stepB('Ответ', ansB([[bold(law)], linear ? 'уравнение движения' : 'положение в момент t₁'], [[bold(`T = ${sg(Tn)} Н`)], 'натяжение нити'], [[bold(`S = ${sg(S)} Н`)], 'окружное усилие в точке касания колёс'])),
    ];
    const tEnd = Math.max(t1 * 1.5, 1);
    if (!(Tn >= 0)) steps.splice(steps.length - 1, 0, stepB('Внимание', parB('Натяжение получилось отрицательным — нить ослабнет, расчёт с натянутой нитью неверен.')));
    return done({
      vals: { c3: (fac * B) / 6, c2: (fac * A) / 2, c1: fac * w20, T: Tn, S, eps2: e1 },
      steps,
      plot: { xl: 't, с', yl: nm, series: [{ name: `${nm}(t)`, pts: sample((t) => fac * phi2(t), 0, tEnd, 120) }] },
    });
  },
};

export const ROT_ASKS_YAB: AskDef[] = [A_GROOVE, A_GEARS];
