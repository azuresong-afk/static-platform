/**
 * Готовые задачи вкладки «Колебания систем»: Мещерский §54. Буквенные данные заданы числами; ответ книги
 * пересчитан по её формулам с теми же числами.
 *
 * Ключи ответа: kₛ — частоты по возрастанию (с нулевыми); Tₛ — период; rₛ_i_j — отношение амплитуд Aᵢ/Aⱼ в форме s;
 * Dⱼ_ₛ и Eⱼ_ₛ — коэффициенты при cos kₛt и sin kₛt в qⱼ(t) (для нулевой частоты — постоянная и множитель при t);
 * Xⱼ — амплитуда вынужденных колебаний qⱼ (со знаком, qⱼ = Xⱼ sin pt); zⱼ — частота, при которой амплитуда
 * нагруженной координаты равна нулю; nodeₛ — положение узла формы s на звене (от левого тела); m2, c2 — гаситель;
 * hₛ — коэффициент затухания главной координаты.
 */
import type { BeamMass, BeamSupport, BeamSys } from './model/beam';
import type { AbsorberSys, ChainBody, ChainLink, ChainSys, EnergySys, ForceKind, VibCoord, VibProblem } from './model/vibration';

export interface VibPreset {
  title: string;
  problem: VibProblem;
  book?: Record<string, number>;
  relTol?: number;
  /** Свой допуск для отдельных ключей (ответ дан с двумя-тремя значащими цифрами). */
  tol?: Record<string, number>;
  note: string;
}

const G = 9.81;
const Q = (name: string, o: Partial<VibCoord> = {}): VibCoord => ({ name, eq: 0, q0: 0, v0: 0, H: '', ...o });
const par = (o: Record<string, number>) => Object.entries(o).map(([name, value]) => ({ name, value }));
export const energy = (o: Partial<EnergySys>): EnergySys => ({ coords: [Q('x')], params: [], T: '', P: '', D: '', ...o });
export const body = (m: number, o: Partial<ChainBody> = {}): ChainBody => ({ m, cg: 0, q0: 0, v0: 0, H: 0, ...o });
export const link = (c: number, o: Partial<ChainLink> = {}): ChainLink => ({ c, b: 0, len: 1, d: 0, ...o });
export const chain = (o: Partial<ChainSys>): ChainSys => ({
  kind: 'spring',
  bodies: [body(1), body(1)],
  links: [link(1), link(1), link(1)],
  left: 'fixed',
  right: 'free',
  G: 8e10,
  N: 1,
  xi0: 0,
  ...o,
});
const pin = (x: number): BeamSupport => ({ x, kind: 'pin' });
const mass = (x: number, m: number, o: Partial<BeamMass> = {}): BeamMass => ({ x, m, J: 0, e: 0, H: 0, ...o });
export const beam = (o: Partial<BeamSys>): BeamSys => ({ L: 1, EJ: 1, supports: [pin(0), pin(1)], masses: [mass(0.5, 1)], ...o });
export const absorber = (o: Partial<AbsorberSys>): AbsorberSys => ({ m1: 1, c1: 1, c1Res: true, H: 1, by: 'amp', A: 0.01, m2: 0.1, ...o });

const DEF: VibProblem = {
  src: 'energy',
  energy: energy({}),
  chain: chain({}),
  beam: beam({}),
  absorber: absorber({}),
  force: { kind: 'none', p: 1 },
  tEnd: 0,
};
type Src = { energy: EnergySys } | { chain: ChainSys } | { beam: BeamSys } | { absorber: AbsorberSys };
function prob(src: Src, o: { force?: { kind: ForceKind; p: number }; tEnd?: number } = {}): VibProblem {
  const key = Object.keys(src)[0] as VibProblem['src'];
  return { ...structuredClone(DEF), ...src, src: key, force: o.force ?? DEF.force, tEnd: o.tEnd ?? 0 };
}
export const defaultProblem = (): VibProblem => structuredClone(DEF);

// 54.4: m = 1, l = 1, h = 0,5, c = 20, отклонение α = 0,1.
const s4 = { m: 1, l: 1, h: 0.5, c: 20, a: 0.1 };
// 54.8: P = 20, ρ = 0,3, l = 0,8, h = 0,5, c = 100.
const s8 = { P: 20, r: 0.3, l: 0.8, h: 0.5, c: 100 };
// 54.13: P₁ = 10, P₂ = 6, a = 0,5, b = 0,6, φ₀ = 0,05, ω₀ = 3.
const s13 = { P1: 10, P2: 6, a: 0.5, b: 0.6, f0: 0.05, w0: 3 };
// 54.14, 54.40: P = 30, Q = 20, a = 1, p = 4 → b = g/p².
const s14 = { P: 30, Q: 20, a: 1, p: 4, F: 2 };
const b14 = G / s14.p ** 2;
const n1 = G / s14.a,
  n2 = G / b14,
  gm = s14.Q / (s14.P + s14.Q);
const D14 = Math.sqrt((n1 - n2) ** 2 + 4 * n1 * n2 * gm);
// 54.15: Q = 4000, c = 30000, l = 1,2, ρ = 0,9.
const s15 = { Q: 4000, c: 30000, l: 1.2, r: 0.9 };
// 54.16: P = 2000, c = 40000, a = 0,8, b = 1,2, v₀ = 0,5.
const s16 = { P: 2000, c: 40000, a: 0.8, b: 1.2, v0: 0.5 };
const r16 = Math.sqrt(1 - (0.278 * (s16.a + s16.b) ** 2) / (s16.a ** 2 + s16.b ** 2));
// 54.23: P₁ = 20, P₂ = 10, l = 1, c = 50, b = 0,6.
const s23 = { P1: 20, P2: 10, l: 1, c: 50, b: 0.6 };
// 54.27: числа книги (кГ, см, с).
const s27 = { J1: 87500, J2: 56000, i1: 302, i2: 10.5, k: 5, c1: 316e6, c2: 115e6 };
// 54.42: P = g (m = 1), J = 1/6, a = 0,5, cx = cy = 40, cz = 100 (суммарные жёсткости).
const s42 = { m: 1, J: 1 / 6, a: 0.5, cx: 40, cz: 100 };
const qa = s42.m * s42.J,
  qb = -(s42.m * (s42.cx + s42.cz) * s42.a ** 2 + s42.cx * s42.J),
  qc = s42.cx * s42.cz * s42.a ** 2;
const l42 = [(-qb - Math.sqrt(qb * qb - 4 * qa * qc)) / (2 * qa), (-qb + Math.sqrt(qb * qb - 4 * qa * qc)) / (2 * qa)];
const k42 = [l42[0], l42[0], s42.cz / s42.m, (2 * s42.cx * s42.a ** 2) / s42.J, l42[1], l42[1]].sort((x, y) => x - y).map(Math.sqrt);
// 54.43: M = 3, c = 500, a = 0,6, b = 0,4.
const s43 = { M: 3, c: 500, a: 0.6, b: 0.4 };
// 54.51: m = 1, a = 0,5.
const s51 = { m: 1, a: 0.5 };
// 54.1: числа книги (кГ, см, с).
const s1 = { J1: 5, J2: 150, len: 155.2, d: 2.54, G: 880000 };
// 54.2, 54.38: J = 2, c = 800, M₀ = 10, p = 15.
const s2 = { J: 2, c: 800, M0: 10, p: 15 };
const k2a = Math.sqrt(((3 - Math.sqrt(5)) / 2) * (s2.c / s2.J)),
  k2b = Math.sqrt(((3 + Math.sqrt(5)) / 2) * (s2.c / s2.J));
const D38 = s2.J ** 2 * (s2.p ** 2 - k2a ** 2) * (s2.p ** 2 - k2b ** 2);
// 54.44: Q₁ = 20, Q₂ = 30, Q₃ = 25 т; c₁ = 400, c₂ = 600 т/м.
const s44 = { Q1: 20, Q2: 30, Q3: 25, c1: 400, c2: 600 };
const b44 = G * (s44.c1 / s44.Q1 + (s44.c1 + s44.c2) / s44.Q2 + s44.c2 / s44.Q3),
  c44 = G * G * ((s44.c1 * s44.c2) / (s44.Q1 * s44.Q2) + (s44.c2 * s44.c1) / (s44.Q2 * s44.Q3) + (s44.c1 * s44.c2) / (s44.Q3 * s44.Q1));
// 54.45: Q = 20 т, c = 400 т/м, x₀ = 0,05 м.
const s45 = { Q: 20, c: 400, x0: 0.05 };
// 54.18: Q = 2, p = 50, a = 0,4, b = 0,3.
const s18 = { Q: 2, p: 50, a: 0.4, b: 0.3 };
// 54.52: n = 5, m = 0,2, l = 0,25, P = 40.
const s52 = { n: 5, m: 0.2, l: 0.25, P: 40 };
// 54.37: P₁ = 100 т, F = 10 sin 100t т, A = 2 мм.
const s37 = { P1: 100, F: 10, p: 100, A: 0.002 };
const SQ3 = Math.sqrt(3);

export const VIB_PRESETS = {
  m5445: {
    title: 'Мещерский 54.44–54.45: три вагона, крайний отклонён — движение и формы главных колебаний',
    problem: prob(
      {
        chain: chain({
          bodies: [body(s45.Q / G), body(s45.Q / G), body(s45.Q / G, { q0: s45.x0 })],
          links: [link(0), link(s45.c), link(s45.c), link(0)],
          left: 'free',
          right: 'free',
        }),
      },
      { tEnd: 2 },
    ),
    book: {
      k1: 0,
      k2: Math.sqrt((s45.c * G) / s45.Q),
      k3: Math.sqrt((3 * s45.c * G) / s45.Q),
      D1_1: s45.x0 / 3,
      D1_2: -s45.x0 / 2,
      D1_3: s45.x0 / 6,
      D2_1: s45.x0 / 3,
      D2_2: 0,
      D2_3: -s45.x0 / 3,
      D3_1: s45.x0 / 3,
      D3_2: s45.x0 / 2,
      D3_3: s45.x0 / 6,
    },
    note: 'Вагоны по Q = 20 т (m = Q/g), сцепки c = 400 т/м, x₃(0) = 5 см. Книга: k₁ = 0, k₂ = √(cg/Q), k₃ = √(3cg/Q); x₁ = x₀/3 − (x₀/2) cos k₂t + (x₀/6) cos k₃t, x₂ = x₀/3 − (x₀/3) cos k₃t, x₃ = x₀/3 + (x₀/2) cos k₂t + (x₀/6) cos k₃t.',
  },
  m5444: {
    title: 'Мещерский 54.44: три вагона разного веса — частоты главных колебаний',
    problem: prob({
      chain: chain({
        bodies: [body(s44.Q1 / G), body(s44.Q2 / G), body(s44.Q3 / G)],
        links: [link(0), link(s44.c1), link(s44.c2), link(0)],
        left: 'free',
        right: 'free',
      }),
    }),
    book: { k1: 0, k2: Math.sqrt((b44 - Math.sqrt(b44 * b44 - 4 * c44)) / 2), k3: Math.sqrt((b44 + Math.sqrt(b44 * b44 - 4 * c44)) / 2) },
    note: 'Q₁ = 20, Q₂ = 30, Q₃ = 25 т; c₁ = 400, c₂ = 600 т/м. Книга: k₁ = 0, k₂ и k₃ — корни k⁴ − g[c₁/Q₁ + (c₁ + c₂)/Q₂ + c₂/Q₃]k² + g²[c₁c₂/(Q₁Q₂) + c₂c₁/(Q₂Q₃) + c₁c₂/(Q₃Q₁)] = 0.',
  },
  m541: {
    title: 'Мещерский 54.1: турбина и маховик на упругом валу — узловое сечение и период',
    problem: prob({
      chain: chain({
        kind: 'shaft',
        G: s1.G,
        bodies: [body(s1.J1), body(s1.J2)],
        links: [link(0), link(0, { d: s1.d, len: s1.len }), link(0)],
        left: 'free',
        right: 'free',
      }),
    }),
    book: { T2: 0.09, node2: s1.len - 5 },
    relTol: 0.02,
    note: 'J₁ = 5, J₂ = 150 кГ·см·с², вал l = 155,2 см, d = 2,54 см, G = 880 000 кГ/см² (единицы — кГ, см, с). Книга: узловое сечение в a = 50 мм от маховика, T = 0,09 с.',
  },
  m542: {
    title: 'Мещерский 54.2: вал, закреплённый одним концом, с двумя дисками — частоты',
    problem: prob({
      chain: chain({ kind: 'shaft', bodies: [body(s2.J), body(s2.J)], links: [link(s2.c), link(s2.c), link(0)], left: 'fixed', right: 'free' }),
    }),
    book: { k1: 0.62 * Math.sqrt(s2.c / s2.J), k2: 1.62 * Math.sqrt(s2.c / s2.J) },
    relTol: 0.005,
    note: 'J = 2 кг·м², c = 800 Н·м/рад. Книга: k₁ = 0,62√(c/J), k₂ = 1,62√(c/J) (точно — √((3 ∓ √5)/2·c/J)).',
  },
  m543: {
    title: 'Мещерский 54.3: вал с тремя одинаковыми дисками — частоты',
    problem: prob({
      chain: chain({
        kind: 'shaft',
        bodies: [body(s2.J), body(s2.J), body(s2.J)],
        links: [link(0), link(s2.c), link(s2.c), link(0)],
        left: 'free',
        right: 'free',
      }),
    }),
    book: { k1: 0, k2: Math.sqrt(s2.c / s2.J), k3: Math.sqrt((3 * s2.c) / s2.J) },
    note: 'J = 2 кг·м², c = 800 Н·м/рад, концы вала свободны. Книга: k₁ = √(c/J), k₂ = √(3c/J) (и нулевая — вращение вала как целого).',
  },
  m5434: {
    title: 'Мещерский 54.34: к одному из двух дисков внезапно приложен постоянный момент',
    problem: prob(
      { chain: chain({ kind: 'shaft', bodies: [body(s2.J, { H: s2.M0 }), body(s2.J)], links: [link(0), link(s2.c), link(0)], left: 'free', right: 'free' }) },
      { force: { kind: 'const', p: 1 }, tEnd: 0.5 },
    ),
    book: { k1: 0, k2: Math.sqrt((2 * s2.c) / s2.J) },
    note: 'J = 2 кг·м², c = 800 Н·м/рад, M = 10 Н·м. Книга: φ₁ = Mt²/(4J) + (M/(4c))(1 − cos √(2c/J)·t), φ₂ = Mt²/(4J) − (M/(4c))(1 − cos √(2c/J)·t).',
  },
  m5438: {
    title: 'Мещерский 54.38: вынужденные колебания дисков задачи 54.2 под моментом M₀ sin pt',
    problem: prob(
      {
        chain: chain({ kind: 'shaft', bodies: [body(s2.J, { H: s2.M0 }), body(s2.J)], links: [link(s2.c), link(s2.c), link(0)], left: 'fixed', right: 'free' }),
      },
      { force: { kind: 'harm', p: s2.p }, tEnd: 3 },
    ),
    book: { k1: k2a, k2: k2b, X1: (s2.M0 * (s2.c - s2.J * s2.p ** 2)) / D38, X2: (s2.M0 * s2.c) / D38 },
    note: 'J = 2 кг·м², c = 800 Н·м/рад, M₀ = 10 Н·м, p = 15 рад/с; момент приложен к среднему диску (φ₁). Книга: φ₁ = M₀(c − Jp²) sin pt/(J²(p² − k₁²)(p² − k₂²)), φ₂ = M₀c sin pt/(J²(p² − k₁²)(p² − k₂²)).',
  },
  m5418: {
    title: 'Мещерский 54.18: две точки на натянутой нити — частоты и главные координаты',
    problem: prob({
      chain: chain({
        kind: 'string',
        N: s18.p,
        bodies: [body(s18.Q / G), body(s18.Q / G)],
        links: [link(0, { len: s18.a }), link(0, { len: 2 * s18.b }), link(0, { len: s18.a })],
        left: 'fixed',
        right: 'fixed',
      }),
    }),
    book: { k1: Math.sqrt((s18.p * G) / (s18.Q * s18.a)), k2: Math.sqrt(((s18.p * G) / s18.Q) * (1 / s18.a + 1 / s18.b)), r1_2_1: 1, r2_2_1: -1 },
    note: 'Q = 2 Н, натяжение p = 50 Н, a = 0,4 м, b = 0,3 м. Книга: k₁ = √(pg/(Qa)), k₂ = √(pg/Q·(1/a + 1/b)); главные координаты θ₁ = (x₁ + x₂)/2, θ₂ = (x₁ − x₂)/2.',
  },
  m5452: {
    title: 'Мещерский 54.52: натянутая нить с n грузами — частоты',
    problem: prob({
      chain: chain({
        kind: 'string',
        N: s52.P,
        bodies: Array.from({ length: s52.n }, () => body(s52.m)),
        links: Array.from({ length: s52.n + 1 }, () => link(0, { len: s52.l })),
        left: 'fixed',
        right: 'fixed',
      }),
    }),
    book: Object.fromEntries(
      Array.from({ length: s52.n }, (_, i) => ['k' + (i + 1), 2 * Math.sqrt(s52.P / (s52.m * s52.l)) * Math.sin(((i + 1) * Math.PI) / (2 * (s52.n + 1)))]),
    ),
    note: 'n = 5 грузов по m = 0,2 кг через l = 0,25 м, натяжение P = 40 Н. Книга: kₛ = 2√(P/(ml))·sin(sπ/(2(n + 1))), s = 1, …, n.',
  },
  m5447: {
    title: 'Мещерский 54.47: механический фильтр низких частот — цепочка масс с заданным движением левой массы',
    problem: prob(
      {
        chain: chain({
          bodies: Array.from({ length: 6 }, () => body(1)),
          links: Array.from({ length: 7 }, () => link(100)),
          left: 'moving',
          right: 'free',
          xi0: 0.01,
        }),
      },
      { force: { kind: 'harm', p: 24 }, tEnd: 0 },
    ),
    note: 'm = 1 кг, c = 100 Н/м, левая масса движется по закону x = x₀ sin ωt, x₀ = 1 см (в цепочке — движущийся левый конец). Книга: фильтр пропускает колебания с частотой 0 < ω < 2√(c/m) = 20 рад/с; при ω = 24 рад/с амплитуды убывают от массы к массе (знаки чередуются), при ω < 20 — нет.',
  },
  m5429: {
    title: 'Мещерский 54.29: балка на двух опорах с двумя равными грузами в третях пролёта',
    problem: prob({ beam: beam({ masses: [mass(1 / 3, 1), mass(2 / 3, 1)] }) }),
    book: { k1: 5.69, k2: 22.04, r1_1_2: 1, r2_1_2: -1 },
    relTol: 0.002,
    note: 'l = 1, EJ = 1, m = Q/g = 1: частоты — в единицах √(EJg/(Ql³)). Книга: k₁ = 5,69√(EJg/(Ql³)), k₂ = 22,04√(EJg/(Ql³)); A₁⁽¹⁾/A₂⁽¹⁾ = 1, A₁⁽²⁾/A₂⁽²⁾ = −1.',
  },
  m5430: {
    title: 'Мещерский 54.30: балка на двух опорах с грузами Q и 0,5Q в третях пролёта',
    problem: prob({ beam: beam({ masses: [mass(1 / 3, 1), mass(2 / 3, 0.5)] }) }),
    book: { k1: 6.55, k2: 27.2, r1_2_1: 0.95, r2_2_1: -2.09 },
    relTol: 0.005,
    // k₂ = 27,11 — на 0,35 % меньше книжного (README, «Расхождения с книгой»).
    tol: { k2: 0.004 },
    note: 'l = 1, EJ = 1, Q/g = 1. Книга: k₁ = 6,55√(EJg/(Ql³)), k₂ = 27,2√(EJg/(Ql³)); A₂⁽¹⁾/A₁⁽¹⁾ = 0,95, A₂⁽²⁾/A₁⁽²⁾ = −2,09; расчёт даёт k₂ = 27,1√(EJg/(Ql³)).',
  },
  m5431: {
    title: 'Мещерский 54.31: двухпролётная балка с грузами в серединах пролётов',
    problem: prob({ beam: beam({ L: 2, supports: [pin(0), pin(1), pin(2)], masses: [mass(0.5, 1), mass(1.5, 1)] }) }),
    book: { k1: 6.93, k2: 10.46, r1_2_1: -1, r2_2_1: 1 },
    relTol: 0.002,
    note: 'Пролёты l = 1, EJ = 1, Q/g = 1 (балка статически неопределима). Книга: k₁ = 6,93√(EJg/(Ql³)), k₂ = 10,46√(EJg/(Ql³)).',
  },
  m5432: {
    title: 'Мещерский 54.32: два груза на концах консолей балки на двух опорах',
    problem: prob({ beam: beam({ L: 3, supports: [pin(1), pin(2)], masses: [mass(0, 1), mass(3, 1)] }) }),
    book: { k1: Math.sqrt(6 / 5), k2: Math.sqrt(2) },
    note: 'Балка 3l, опоры через l, грузы на концах; l = 1, EJ = 1, Q/g = 1. Книга: k₁ = √(6EJg/(5Ql³)), k₂ = √(2EJg/(Ql³)).',
  },
  m5433: {
    title: 'Мещерский 54.33: пластинка на конце консоли — изгиб и поворот',
    problem: prob({ beam: beam({ supports: [{ x: 0, kind: 'fixed' }], masses: [mass(1, 1, { J: (0.2 ** 2 + 0.1 ** 2) / 12, e: 0.1 })] }) }),
    // k₁ и O₁ книги расчёт не подтверждает (README, «Расхождения с книгой»).
    book: { k2: 20.7 * SQ3, r2_1_2: -0.106 },
    relTol: 0.005,
    tol: { r2_1_2: 0.01 },
    note: 'l = 1, EJ = 1, m = 1; пластинка a × b = 0,2l × 0,1l прикреплена к концу A серединой стороны b: центр масс в a/2 = 0,1l от A, J = m(a² + b²)/12. Книга: k₁ = 0,804√(3EJ/(ml³)), k₂ = 20,7√(3EJ/(ml³)); центры поворота O₁A = 0,612l (слева от A), O₂A = 0,106l (справа). Расчёт даёт k₁ = 0,864√(3EJ/(ml³)) и O₁A = 0,638l — см. README, «Расхождения с книгой».',
  },
  m5446: {
    title: 'Мещерский 54.46: три одинаковых груза на балке на двух опорах',
    problem: prob({ beam: beam({ masses: [mass(0.25, 1), mass(0.5, 1), mass(0.75, 1)] }) }),
    book: { k1: 4.93, k2: 19.6, k3: 41.8 },
    relTol: 0.003,
    // k₃ = 41,61 — на 0,5 % меньше книжного (README, «Расхождения с книгой»).
    tol: { k3: 0.005 },
    note: 'Грузы через l/4, l = 1, EJ = 1, m = 1. Книга: k₁ = 4,93√(EJ/(ml³)), k₂ = 19,6√(EJ/(ml³)), k₃ = 41,8√(EJ/(ml³)); расчёт даёт k₃ = 41,6√(EJ/(ml³)).',
  },
  m5437: {
    title: 'Мещерский 54.37: динамический гаситель колебаний фундамента',
    problem: prob({ absorber: absorber({ m1: s37.P1 / G, c1Res: true, H: s37.F, by: 'amp', A: s37.A }) }, { force: { kind: 'harm', p: s37.p }, tEnd: 0.5 }),
    book: { m2: 4.9 / G, c2: 5000, X1: 0 },
    relTol: 0.002,
    note: 'Фундамент P₁ = 100 т (m₁ = P₁/g), сила F = 10 sin 100t т, резонанс при ω = 100 с⁻¹ (c₁ = m₁ω²), амплитуда гасителя не больше 2 мм. Книга: P₂ = 4,9 т, c₂ = 5·10³ т/м.',
  },
  m549: {
    title: 'Мещерский 54.9: стержень, подвешенный на нити, — частоты и формы главных колебаний',
    problem: prob({
      energy: energy({
        coords: [Q('φ1'), Q('φ2')],
        params: par({ m: 1, L: 1, l: 0.5, g: G }),
        T: "m (l^2 φ1'^2 + L^2 φ2'^2/4 + l L φ1' φ2' cos(φ1 − φ2))/2 + m L^2 φ2'^2/24",
        P: '−m g (l cos φ1 + L cos φ2/2)',
      }),
    }),
    book: { k1: 0.677 * Math.sqrt(G / 0.5), k2: 2.558 * Math.sqrt(G / 0.5), r1_1_2: 0.847, r2_1_2: -1.18 },
    relTol: 0.002,
    note: 'Нить l = 0,5L, стержень L = 1 м; φ₁ — угол нити, φ₂ — стержня. Книга: k₁ = 0,677√(g/l), k₂ = 2,558√(g/l) (l — длина нити); в первом главном колебании φ₁ = 0,847φ₂, во втором φ₁ = −1,180φ₂.',
  },
  m544: {
    title: 'Мещерский 54.4: два маятника, связанные пружиной, — биения',
    problem: prob(
      {
        energy: energy({
          coords: [Q('φ1', { q0: s4.a }), Q('φ2')],
          params: par({ m: s4.m, l: s4.l, h: s4.h, c: s4.c, g: G }),
          T: "m l^2 (φ1'^2 + φ2'^2)/2",
          P: 'm g l (2 − cos φ1 − cos φ2) + c h^2 (sin φ1 − sin φ2)^2/2',
        }),
      },
      { tEnd: 12 },
    ),
    book: {
      k1: Math.sqrt(G / s4.l),
      k2: Math.sqrt(G / s4.l + (2 * s4.c * s4.h ** 2) / (s4.m * s4.l ** 2)),
      D1_1: s4.a / 2,
      D1_2: s4.a / 2,
      D2_1: s4.a / 2,
      D2_2: -s4.a / 2,
    },
    note: 'm = 1 кг, l = 1 м, пружина c = 20 Н/м на уровне h = 0,5 м; φ₁(0) = α = 0,1. Книга: φ₁ = α cos((k₁ + k₂)t/2)·cos((k₂ − k₁)t/2), φ₂ = α sin((k₁ + k₂)t/2)·sin((k₂ − k₁)t/2), k₁ = √(g/l), k₂ = √(g/l + 2ch²/(ml²)).',
  },
  m545: {
    title: 'Мещерский 54.5: маятник на катящемся диске — период',
    problem: prob({
      energy: energy({
        coords: [Q('x'), Q('φ')],
        params: par({ M: 3, m: 1, l: 0.8, g: G }),
        T: "3 M x'^2/4 + m (x'^2 + 2 l x' φ' cos φ + l^2 φ'^2)/2",
        P: '−m g l cos φ',
      }),
    }),
    book: { k1: 0, T2: 2 * Math.PI * Math.sqrt(((3 * 3) / (3 * 3 + 2 * 1)) * (0.8 / G)) },
    note: 'Диск M = 3 кг катится без скольжения (T диска = ¾Mẋ²), стержень l = 0,8 м, груз m = 1 кг. Книга: T = 2π√(3M/(3M + 2m)·l/g).',
  },
  m548: {
    title: 'Мещерский 54.8: два физических маятника, связанные пружиной, — частоты и отношения амплитуд',
    problem: prob({
      energy: energy({
        coords: [Q('φ1'), Q('φ2')],
        params: par({ P: s8.P, ρ: s8.r, l: s8.l, h: s8.h, c: s8.c, g: G }),
        T: "P (ρ^2 + l^2) (φ1'^2 + φ2'^2)/(2 g)",
        P: 'P l (2 − cos φ1 − cos φ2) + c h^2 (sin φ1 − sin φ2)^2/2',
      }),
    }),
    book: {
      k1: Math.sqrt((G * s8.l) / (s8.r ** 2 + s8.l ** 2)),
      k2: Math.sqrt(((s8.P * s8.l + 2 * s8.c * s8.h ** 2) * G) / (s8.P * (s8.r ** 2 + s8.l ** 2))),
      r1_2_1: 1,
      r2_2_1: -1,
    },
    note: 'P = 20 Н, ρ = 0,3 м, l = 0,8 м, пружина c = 100 Н/м на расстоянии h = 0,5 м от осей. Книга: k₁² = gl/(ρ² + l²), k₂² = (Pl + 2ch²)g/(P(ρ² + l²)); A₂⁽¹⁾/A₁⁽¹⁾ = +1, A₂⁽²⁾/A₁⁽²⁾ = −1.',
  },
  m5413: {
    title: 'Мещерский 54.13: двойной физический маятник, второй стержень закреплён в центре тяжести',
    problem: prob(
      {
        energy: energy({
          coords: [Q('φ', { q0: s13.f0 }), Q('ψ', { v0: s13.w0 })],
          params: par({ P1: s13.P1, P2: s13.P2, a: s13.a, b: s13.b, g: G }),
          T: "(P1 4 a^2/3 + P2 4 a^2) φ'^2/(2 g) + P2 b^2 ψ'^2/(24 g)",
          P: '−(P1 a + 2 a P2) cos φ',
        }),
      },
      { tEnd: 4 },
    ),
    book: { k1: 0, k2: Math.sqrt(0.75 * ((s13.P1 + 2 * s13.P2) / (s13.P1 + 3 * s13.P2)) * (G / s13.a)), D1_2: s13.f0, E2_1: s13.w0 },
    note: 'O₁O₂ = 2a = 1 м, P₁ = 10 Н; стержень AB (P₂ = 6 Н, длина b = 0,6 м) закреплён в центре тяжести в O₂. φ(0) = 0,05, ψ(0) = 0, ψ̇(0) = ω₀ = 3 рад/с. Книга: φ = φ₀ cos(√(¾·(P₁ + 2P₂)/(P₁ + 3P₂)·g/a)·t), ψ = ω₀t.',
  },
  m5414: {
    title: 'Мещерский 54.14, 54.40: балка, подвешенная на нитях к стержню, — частоты и гашение колебаний',
    problem: prob(
      {
        energy: energy({
          coords: [Q('φ1', { H: 'F a' }), Q('φ2')],
          params: par({ P: s14.P, Q: s14.Q, a: s14.a, b: b14, F: s14.F, g: G }),
          T: "(P a^2 φ1'^2 + Q (a^2 φ1'^2 + 2 a b φ1' φ2' cos(φ1 − φ2) + b^2 φ2'^2))/(2 g)",
          P: 'P a (1 − cos φ1) + Q (a (1 − cos φ1) + b (1 − cos φ2))',
        }),
      },
      { force: { kind: 'harm', p: s14.p }, tEnd: 0 },
    ),
    book: { k1: Math.sqrt((n1 + n2 - D14) / (2 * (1 - gm))), k2: Math.sqrt((n1 + n2 + D14) / (2 * (1 - gm))), X1: 0, z1: Math.sqrt(G / b14) },
    note: 'Стержень AB (P = 30 Н) на нитях a = 1 м, балка CD (Q = 20 Н) на нитях b; φ₁, φ₂ — углы нитей. Сила F sin pt (F = 2 Н, p = 4 рад/с) в точке A перпендикулярна OA: обобщённая сила Fa. Книга, 54.14: k²₁,₂ = (n₁² + n₂² ∓ √((n₁² − n₂²)² + 4n₁²n₂²γ²))/(2(1 − γ²)), n₁² = g/a, n₂² = g/b, γ² = Q/(P + Q); 54.40: амплитуда AB равна нулю при b = g/p².',
  },
  m5415: {
    title: 'Мещерский 54.15: колебания железнодорожного вагона на рессорах',
    problem: prob({
      energy: energy({
        coords: [Q('x'), Q('ψ')],
        params: par({ Q: s15.Q, ρ: s15.r, l: s15.l, c: s15.c, g: G }),
        T: "Q (x'^2 + ρ^2 ψ'^2)/(2 g)",
        P: 'c ((x − l ψ)^2 + (x + l ψ)^2)/2',
      }),
    }),
    book: { k1: Math.sqrt((2 * s15.c * G) / s15.Q), k2: Math.sqrt((2 * s15.c * G * s15.l ** 2) / (s15.Q * s15.r ** 2)) },
    note: 'Q = 4000 кГ, рессоры c₁ = c₂ = c = 30 000 кГ/м на расстояниях l = 1,2 м от центра тяжести, ρ = 0,9 м; Π отсчитана от положения равновесия. Книга: x = A sin(k₁t + α), ψ = B sin(k₂t + β), k₁ = √(2cg/Q), k₂ = √(2cgl²/(Qρ²)).',
  },
  m5416: {
    title: 'Мещерский 54.16: платформа на двух рессорах после толчка вниз',
    problem: prob(
      {
        energy: energy({
          coords: [Q('y', { v0: s16.v0 }), Q('φ')],
          params: par({ P: s16.P, c: s16.c, a: s16.a, b: s16.b, g: G }),
          T: "P (y'^2 + 0,1 (a^2 + b^2) φ'^2)/(2 g)",
          P: 'c ((y − a φ)^2 + (y + b φ)^2)/2',
        }),
      },
      { tEnd: 1.5 },
    ),
    book: { k1: Math.sqrt(((6 * s16.c * G) / s16.P) * (1 - r16)), k2: Math.sqrt(((6 * s16.c * G) / s16.P) * (1 + r16)) },
    relTol: 0.001,
    note: 'P = 2000 Н, рессоры c = 40 000 Н/м в A и B, AC = a = 0,8 м, CB = b = 1,2 м, J_C = 0,1(a² + b²)P/g, v₀ = 0,5 м/с вниз. Книга: k²₁,₂ = (6cg/P)(1 ∓ √(1 − 0,278(a + b)²/(a² + b²))).',
  },
  m5417: {
    title: 'Мещерский 54.17: платформа тележки после удара в центр тяжести',
    problem: prob(
      {
        energy: energy({
          coords: [Q('z', { v0: 1 }), Q('φ')],
          params: par({ Q: G, c: 1, l: 1, g: G }),
          T: "Q (z'^2 + (0,2 l)^2 φ'^2)/(2 g)",
          P: 'c ((z + l φ/3)^2 + (z − 2 l φ/3)^2)/2',
        }),
      },
      { tEnd: 12 },
    ),
    book: { k1: 1.33, k2: 3.758, E1_1: 0.738, E1_2: 0.00496, E2_1: 0.509, E2_2: -0.18 },
    relTol: 0.002,
    // Коэффициент 0,509 расчёт даёт как 0,5075 (0,3 %, README, «Расхождения с книгой»).
    tol: { k1: 0.003, E1_2: 0.01, E2_1: 0.004, E2_2: 0.006 },
    note: 'AB = l, AC = l/3, ρ = 0,2l; Q = g, c = 1, l = 1, импульс S = 1 (ż(0) = Sg/Q = 1). Книга: z = √(g/(cQ))·S(0,738 sin 1,330√(cg/Q)t + 0,00496 sin 3,758√(cg/Q)t), lφ = √(g/(cQ))·S(0,509 sin 1,330√(cg/Q)t − 0,180 sin 3,758√(cg/Q)t).',
  },
  m5423: {
    title: 'Мещерский 54.23: маятник на ползуне с пружиной и вязким сопротивлением',
    problem: prob(
      {
        energy: energy({
          coords: [Q('x', { q0: 0.05 }), Q('φ', { q0: 0.1 })],
          params: par({ P1: s23.P1, P2: s23.P2, l: s23.l, c: s23.c, b: s23.b, g: G }),
          T: "P1 x'^2/(2 g) + P2 ((x' + l φ' sin φ)^2 + l^2 φ'^2 cos^2 φ)/(2 g)",
          P: 'c x^2/2 + P2 l (1 − cos φ)',
          D: "b x'^2/2",
        }),
      },
      { tEnd: 6 },
    ),
    book: { k1: Math.sqrt(G / s23.l), k2: Math.sqrt((s23.c * G) / (s23.P1 + s23.P2)), h2: (s23.b * G) / (2 * (s23.P1 + s23.P2)) },
    note: 'Ползун P₁ = 20 Н на пружине c = 50 Н/м, сопротивление bẋ (b = 0,6 Н·с/м), маятник l = 1 м, P₂ = 10 Н; x отсчитан от равновесия. Книга: x = A₁e^(−ht) sin(√(k₁² − h²)t + ε₁), φ = A₂ sin(k₂t + ε₂), k₁² = cg/(P₁ + P₂), h = bg/(2(P₁ + P₂)), k₂² = g/l (здесь — по возрастанию: k₁ = √(g/l)); частоты равны при c = (P₁ + P₂)/l.',
  },
  m5427: {
    title: 'Мещерский 54.27: два вала, соединённые зубчатой передачей, — крутильные колебания',
    problem: prob({
      energy: energy({
        coords: [Q('φ1'), Q('φ2'), Q('φ3')],
        params: par(s27),
        T: "J1 φ1'^2/2 + (i1 + i2 k^2) φ2'^2/2 + J2 φ3'^2/2",
        P: 'c1 (φ1 − φ2)^2/2 + c2 (k φ2 − φ3)^2/2',
      }),
    }),
    // Книжная k₁ = 54,8 с⁻¹ расчёт не подтверждает: 58,8 с⁻¹, как и в 54.28 (README, «Расхождения с книгой»).
    book: { k1: 0, k3: 2.38e3 },
    relTol: 0.005,
    note: 'Числа книги (кГ, см, с): J₁ = 87 500, J₂ = 56 000, i₁ = 302, i₂ = 10,5 кГ·см·с², z₁/z₂ = 5, c₁ = 316·10⁶, c₂ = 115·10⁶ кГ·см; φ₂ — угол колеса i₁, колесо i₂ поворачивается на kφ₂. Книга: k₁ = 54,8 с⁻¹, k₂ = 2,38·10³ с⁻¹. Расчёт: 58,8 и 2,38·10³ с⁻¹ — первая частота почти не зависит от массы колёс (без неё, 54.28, книга даёт 58,7 с⁻¹); 54,8 — вероятно, опечатка.',
  },
  m5428: {
    title: 'Мещерский 54.28: валы с зубчатой передачей без учёта массы колёс',
    problem: prob({
      energy: energy({
        coords: [Q('φ1'), Q('ψ')],
        params: par({ J1: s27.J1, J2: s27.J2, k: s27.k, c1: s27.c1, c2: s27.c2 }),
        T: "J1 φ1'^2/2 + J2 k^2 ψ'^2/2",
        P: 'c1 c2 k^2 (φ1 − ψ)^2/(2 (c1 + c2 k^2))',
      }),
    }),
    book: { k1: 0, k2: 58.7 },
    relTol: 0.003,
    note: 'Невесомые колёса: ψ = φ₃/k (угол второго вала, приведённый к первому), валы — последовательные пружины c₁ и c₂k². Книга: k = 58,7 с⁻¹.',
  },
  m5442: {
    title: 'Мещерский 54.42: бак-куб на четырёх пружинах — шесть степеней свободы',
    problem: prob({
      energy: energy({
        coords: [Q('x'), Q('y'), Q('z'), Q('α'), Q('β'), Q('γ')],
        params: par(s42),
        T: "m (x'^2 + y'^2 + z'^2)/2 + J (α'^2 + β'^2 + γ'^2)/2",
        P: 'cx (x − a β)^2/2 + cx (y + a α)^2/2 + cz z^2/2 + cz a^2 (α^2 + β^2)/2 + cx a^2 γ^2',
      }),
    }),
    book: Object.fromEntries(k42.map((k, i) => ['k' + (i + 1), k])),
    note: 'm = P/g = 1, сторона 2a = 1, J = 1/6; cx = cy = 40, cz = 100 — суммарные жёсткости четырёх пружин; α, β, γ — повороты вокруг осей x, y, z. Книга: k_z = √(c_z g/P), k_γ = √(2c_x a²/J), остальные (по две одинаковые) — корни k⁴ − (m(c_x + c_z)a² + c_xJ)k²/(mJ) + c_xc_z a²/(mJ) = 0.',
  },
  m5443: {
    title: 'Мещерский 54.43: прямоугольная пластина на четырёх пружинах',
    problem: prob({
      energy: energy({
        coords: [Q('z'), Q('α'), Q('β')],
        params: par(s43),
        T: "M (z'^2 + b^2 α'^2/12 + a^2 β'^2/12)/2",
        P: 'c ((z + a β/2 + b α/2)^2 + (z − a β/2 + b α/2)^2 + (z + a β/2 − b α/2)^2 + (z − a β/2 − b α/2)^2)/2',
      }),
    }),
    book: { k1: Math.sqrt((4 * s43.c) / s43.M), k2: Math.sqrt((12 * s43.c) / s43.M), k3: Math.sqrt((12 * s43.c) / s43.M) },
    note: 'M = 3 кг, c = 500 Н/м, стороны a = 0,6 м, b = 0,4 м; z — прогиб центра, α, β — повороты. Книга: k₁ = √(4c/M), k₂ = k₃ = √(12c/M).',
  },
  m5451: {
    title: 'Мещерский 54.51: вертикальная нить с тремя грузами — частоты поперечных колебаний',
    problem: prob({
      energy: energy({
        coords: [Q('x1'), Q('x2'), Q('x3')],
        params: par({ ...s51, g: G }),
        T: "m (x1'^2 + x2'^2 + x3'^2)/2",
        P: 'm g (3 x1^2 + 2 (x2 − x1)^2 + (x3 − x2)^2)/(2 a)',
      }),
    }),
    book: { k1: 0.646 * Math.sqrt(G / s51.a), k2: 1.515 * Math.sqrt(G / s51.a), k3: 2.505 * Math.sqrt(G / s51.a) },
    relTol: 0.002,
    note: 'Три груза m через a = 0,5 м, отсчёт сверху; натяжение участка над k-м грузом (n − k + 1)mg. Книга: k₁ = 0,646√(g/a), k₂ = 1,515√(g/a), k₃ = 2,505√(g/a).',
  },
} satisfies Record<string, VibPreset>;

export type VibPresetKey = keyof typeof VIB_PRESETS;
