/**
 * Пункт 28, «Принцип Даламбера»: однородная пластинка-многоугольник вращается вокруг оси, лежащей в её плоскости
 * (Мещерский 42.12–42.13).
 *
 * Пластинка в плоскости xz, ось вращения z; опоры A (подпятник) и B (подшипник) — на оси. Силы инерции при ω = const:
 *   Φ_x = ω² M x_C,  момент относительно оси y в начале координат M_y = ω² J_xz (J_xz = ∫x z dm);
 * тяжесть (ось вертикальна) — −Mg вдоль z, её момент M_y = M g x_C. Боковые реакции X_A, X_B — из двух уравнений:
 *   X_A + X_B + ω² M x_C = 0,  z_A X_A + z_B X_B + ω² J_xz + M g x_C = 0.
 * Обратная задача: ω, при которой боковое давление на опору равно нулю (линейное уравнение относительно ω²).
 * Площадь, x_C, z_C, ∫xz dA многоугольника — по формулам Грина через вершины.
 */
import { parseNum } from '../../../shared/format';
import { ansB, bold, eqB, fail, parB, sg, stepB, stepEx, type AskDef, type ExtraOut } from '../../../shared/extra';

const G = 9.81;
const pos = (...x: number[]) => x.every((v) => v > 0 && Number.isFinite(v));
const done = (o: Omit<ExtraOut, 'ok' | 'errors'>): ExtraOut => ({ ok: true, errors: [], ...o });

export function parsePoly(src: string): [number, number][] | string {
  const rows = src
    .split(/[;\n]/)
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => x.split(':').map((y) => parseNum(y.trim())));
  if (rows.length < 3) return 'вершины: не менее трёх пар «x : z» через «;»';
  if (rows.some((r) => r.length !== 2 || !r.every(Number.isFinite))) return 'каждая вершина — два числа «x : z»';
  return rows as [number, number][];
}
/** Моменты многоугольника: площадь A, ∫x dA, ∫z dA, ∫xz dA (обход любой; знак площади учитывается). */
export function polyMoments(v: [number, number][]) {
  let A = 0,
    Sx = 0,
    Sz = 0,
    Ixz = 0;
  for (let i = 0; i < v.length; i++) {
    const [x0, z0] = v[i],
      [x1, z1] = v[(i + 1) % v.length];
    const cr = x0 * z1 - x1 * z0;
    A += cr / 2;
    Sx += ((x0 + x1) * cr) / 6;
    Sz += ((z0 + z1) * cr) / 6;
    Ixz += ((x0 * z1 + 2 * x0 * z0 + 2 * x1 * z1 + x1 * z0) * cr) / 24;
  }
  return { A, Sx, Sz, Ixz };
}

const A_LAMINA: AskDef = {
  id: 'lamina',
  title: '42.12–42.13: пластинка вращается вокруг оси в своей плоскости — давления на опоры, ω при нулевом давлении',
  hint: 'Вершины пластинки «x : z»: x — расстояние от оси вращения (в плоскости пластинки), z — вдоль оси. Опоры A и B на оси (z_A, z_B). Ось вертикальна (тяжесть вдоль −z) или вес не учитывается (только динамические давления).',
  n: { P: 1, zA: 1, zB: 0, w: 5, g: G },
  s: { V: '0:0; 0:1; 1:1', gravity: 'z', find: 'zeroB' },
  selects: [
    {
      k: 'gravity',
      label: 'Сила тяжести',
      options: [
        ['z', 'ось вертикальна (вес вдоль оси)'],
        ['none', 'не учитывать (динамические давления)'],
      ],
    },
    {
      k: 'find',
      label: 'Что найти',
      options: [
        ['react', 'боковые давления на опоры при заданной ω'],
        ['zeroB', 'ω, при которой боковое давление на опору B равно нулю'],
        ['zeroA', 'ω, при которой боковое давление на опору A равно нулю'],
      ],
    },
  ],
  fields: [
    { k: 'V', label: 'вершины пластинки «x : z» через «;»', text: true },
    { k: 'P', label: 'вес пластинки P' },
    { k: 'zA', label: 'координата опоры A на оси z_A', neg: true },
    { k: 'zB', label: 'координата опоры B на оси z_B', neg: true },
    { k: 'w', label: 'угловая скорость ω, рад/с', show: (p) => p.s.find === 'react' },
    { k: 'g', label: 'g' },
  ],
  solve: (q, ex) => {
    const { P, zA, zB, g } = q.n;
    if (!pos(P, g) || zA === zB) return fail(['P, g > 0; опоры A и B в разных точках оси.']);
    const v = parsePoly(q.s.V);
    if (typeof v === 'string') return fail([v]);
    const mo = polyMoments(v);
    if (!(Math.abs(mo.A) > 1e-12)) return fail(['Площадь пластинки равна нулю.']);
    const M = P / g;
    const xC = mo.Sx / mo.A,
      zC = mo.Sz / mo.A,
      Jxz = (M * mo.Ixz) / mo.A;
    const grav = q.s.gravity === 'z' ? M * g * xC : 0;
    const L = zB - zA;
    // X_A + X_B = −ω²M x_C;  z_A X_A + z_B X_B = −(ω²J_xz + grav)
    const react = (w2: number) => {
      const S = -w2 * M * xC,
        Mo = -(w2 * Jxz + grav);
      const XB = (Mo - zA * S) / L;
      return { XA: S - XB, XB };
    };
    const steps = [
      stepEx(
        ex,
        'Пластинка',
        'Площадь, центр тяжести и центробежный момент инерции однородной пластинки — по вершинам многоугольника (формулы Грина).',
        eqB(`площадь ${sg(Math.abs(mo.A))},  x_C = ${sg(xC)},  z_C = ${sg(zC)}`, `J_xz = (M/S)∫x z dS = ${sg(Jxz)}  (M = P/g = ${sg(M)})`),
      ),
      stepEx(
        ex,
        'Уравнения кинетостатики',
        'Силы инерции частиц направлены от оси: главный вектор ω²M x_C, момент относительно оси y (через начало координат) ω²J_xz. Тяжесть даёт момент M g x_C. Боковые реакции X_A, X_B лежат в плоскости пластинки.',
        eqB('X_A + X_B + ω² M x_C = 0', `z_A X_A + z_B X_B + ω² J_xz${q.s.gravity === 'z' ? ' + M g x_C' : ''} = 0`),
      ),
    ];
    if (q.s.find === 'react') {
      const w = q.n.w;
      if (!(w >= 0)) return fail(['ω ≥ 0.']);
      const r = react(w * w);
      steps.push(
        stepB('Реакции', eqB(`X_A = ${sg(r.XA)},  X_B = ${sg(r.XB)}`)),
        stepB(
          'Ответ',
          ansB([[bold(`X_A = ${sg(r.XA)}`)], 'боковая реакция опоры A (давление — противоположно)'], [[bold(`X_B = ${sg(r.XB)}`)], 'боковая реакция опоры B']),
        ),
      );
      return done({ vals: { XA: r.XA, XB: r.XB, absXB: Math.abs(r.XB), Jxz, xC }, steps });
    }
    const atB = q.s.find === 'zeroB';
    // X_B = 0 ⇒ X_A = −ω²Mx_C, z_A(−ω²Mx_C) + ω²J_xz + grav = 0
    const z0 = atB ? zA : zB;
    const den = z0 * M * xC - Jxz;
    const w2 = Math.abs(den) > 1e-15 ? grav / den : NaN;
    if (!(w2 > 0))
      return fail([
        q.s.gravity === 'z'
          ? 'Такой ω нет: при любой угловой скорости боковое давление на эту опору не обращается в нуль.'
          : 'Без силы тяжести давление обращается в нуль при всех ω или ни при какой ω ≠ 0 (зависит только от J_xz и x_C).',
      ]);
    const w = Math.sqrt(w2);
    const r = react(w2);
    steps.push(
      stepB(
        `Давление на опору ${atB ? 'B' : 'A'} равно нулю`,
        eqB(
          `X_${atB ? 'B' : 'A'} = 0:  ω² (z_${atB ? 'A' : 'B'} M x_C − J_xz) = M g x_C`,
          `ω² = ${sg(w2)},  ω = ${sg(w)} рад/с`,
          `другая опора: X_${atB ? 'A' : 'B'} = ${sg(atB ? r.XA : r.XB)}`,
        ),
      ),
      stepEx(ex, 'Проверка', 'Подстановкой ω обратно в уравнения кинетостатики.', parB(`X_A = ${sg(r.XA)}, X_B = ${sg(r.XB)}.`)),
      stepB('Ответ', ansB([[bold(`ω = ${sg(w)} рад/с`)], `боковое давление на опору ${atB ? 'B' : 'A'} равно нулю`])),
    );
    return done({ vals: { w, w2, Jxz, xC }, steps });
  },
};

export const SHAFT_ASKS: AskDef[] = [A_LAMINA];
