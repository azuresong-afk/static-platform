/**
 * Пункт 28, «Геометрия масс»: эллипсоид инерции (Мещерский 34.33).
 *
 * Тензор инерции относительно точки O по осевым J_x, J_y, J_z и центробежным J_xy = Σmxy, J_yz, J_zx (обозначения
 * Мещерского; в матрице тензора они стоят с минусом). Главные моменты и оси — собственные значения и векторы
 * (метод Якоби). Эллипсоид инерции: J_x x² + J_y y² + J_z z² − 2J_xy xy − 2J_yz yz − 2J_zx zx = 1, в главных осях
 * J₁ξ² + J₂η² + J₃ζ² = 1. Тетраэдр с рёбрами a, b, c по осям из вершины O: J_x = M(b² + c²)/10, J_xy = M ab/20, …
 */
import { ansB, bold, eqB, fail, sg, stepB, stepEx, type AskDef, type ExtraOut } from '../../../shared/extra';

const pos = (...x: number[]) => x.every((v) => v > 0 && Number.isFinite(v));
const done = (o: Omit<ExtraOut, 'ok' | 'errors'>): ExtraOut => ({ ok: true, errors: [], ...o });

/** Собственные значения и векторы симметричной матрицы 3×3 (Якоби); векторы — столбцы V. */
export function jacobi3(A0: number[][]): { d: number[]; V: number[][] } {
  const A = A0.map((r) => r.slice());
  const V = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  for (let sweep = 0; sweep < 60; sweep++) {
    let off = 0;
    for (let p = 0; p < 3; p++) for (let q = p + 1; q < 3; q++) off += A[p][q] ** 2;
    if (off < 1e-30) break;
    for (let p = 0; p < 3; p++)
      for (let q = p + 1; q < 3; q++) {
        if (Math.abs(A[p][q]) < 1e-300) continue;
        const th = (A[q][q] - A[p][p]) / (2 * A[p][q]);
        const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1));
        const c = 1 / Math.sqrt(t * t + 1),
          s = t * c;
        for (let k = 0; k < 3; k++) {
          const akp = A[k][p],
            akq = A[k][q];
          A[k][p] = c * akp - s * akq;
          A[k][q] = s * akp + c * akq;
        }
        for (let k = 0; k < 3; k++) {
          const apk = A[p][k],
            aqk = A[q][k];
          A[p][k] = c * apk - s * aqk;
          A[q][k] = s * apk + c * aqk;
        }
        for (let k = 0; k < 3; k++) {
          const vkp = V[k][p],
            vkq = V[k][q];
          V[k][p] = c * vkp - s * vkq;
          V[k][q] = s * vkp + c * vkq;
        }
      }
  }
  return { d: [A[0][0], A[1][1], A[2][2]], V };
}

const A_ELLIPSOID: AskDef = {
  id: 'ellipsoid',
  title: '34.33: эллипсоид инерции тела относительно точки, главные моменты и оси',
  hint: 'Тензор инерции относительно точки O задаётся осевыми моментами J_x, J_y, J_z и центробежными J_xy = Σmxy, J_yz, J_zx — или телом: однородный тетраэдр OABC с рёбрами OA = a, OB = b, OC = c по осям x, y, z.',
  n: { Jx: 2, Jy: 3, Jz: 4, Jxy: 0.5, Jyz: 0, Jzx: 0, M: 1, a: 1, b: 1, c: 1 },
  s: { body: 'tetra' },
  selects: [
    {
      k: 'body',
      label: 'Тело',
      options: [
        ['tetra', 'тетраэдр OABC (рёбра по осям из вершины O)'],
        ['tensor', 'задать моменты инерции относительно O'],
      ],
    },
  ],
  fields: [
    { k: 'M', label: 'масса M', show: (p) => p.s.body === 'tetra' },
    { k: 'a', label: 'ребро OA = a (ось x)', show: (p) => p.s.body === 'tetra' },
    { k: 'b', label: 'ребро OB = b (ось y)', show: (p) => p.s.body === 'tetra' },
    { k: 'c', label: 'ребро OC = c (ось z)', show: (p) => p.s.body === 'tetra' },
    { k: 'Jx', label: 'J_x', show: (p) => p.s.body === 'tensor' },
    { k: 'Jy', label: 'J_y', show: (p) => p.s.body === 'tensor' },
    { k: 'Jz', label: 'J_z', show: (p) => p.s.body === 'tensor' },
    { k: 'Jxy', label: 'J_xy = Σmxy', neg: true, show: (p) => p.s.body === 'tensor' },
    { k: 'Jyz', label: 'J_yz = Σmyz', neg: true, show: (p) => p.s.body === 'tensor' },
    { k: 'Jzx', label: 'J_zx = Σmzx', neg: true, show: (p) => p.s.body === 'tensor' },
  ],
  solve: (q, ex) => {
    let Jx: number, Jy: number, Jz: number, Jxy: number, Jyz: number, Jzx: number;
    const steps = [];
    if (q.s.body === 'tetra') {
      const { M, a, b, c } = q.n;
      if (!pos(M, a, b, c)) return fail(['M, a, b, c > 0.']);
      Jx = (M * (b * b + c * c)) / 10;
      Jy = (M * (c * c + a * a)) / 10;
      Jz = (M * (a * a + b * b)) / 10;
      Jxy = (M * a * b) / 20;
      Jyz = (M * b * c) / 20;
      Jzx = (M * c * a) / 20;
      steps.push(stepEx(ex, 'Моменты инерции тетраэдра (34.32)', 'Интегрированием по объёму тетраэдра x/a + y/b + z/c ≤ 1: Σmx² = Ma²/10, Σmxy = Mab/20.', eqB('J_x = M(b² + c²)/10,  J_y = M(c² + a²)/10,  J_z = M(a² + b²)/10', 'J_xy = Mab/20,  J_yz = Mbc/20,  J_zx = Mca/20', `J_x = ${sg(Jx)},  J_y = ${sg(Jy)},  J_z = ${sg(Jz)};  J_xy = ${sg(Jxy)},  J_yz = ${sg(Jyz)},  J_zx = ${sg(Jzx)}`)));
    } else {
      ({ Jx, Jy, Jz, Jxy, Jyz, Jzx } = q.n);
      if (!pos(Jx, Jy, Jz)) return fail(['Осевые моменты — положительные.']);
    }
    const T = [
      [Jx, -Jxy, -Jzx],
      [-Jxy, Jy, -Jyz],
      [-Jzx, -Jyz, Jz],
    ];
    const { d, V } = jacobi3(T);
    if (!d.every((x) => x > 0)) return fail(['Тензор не положительно определён — таких моментов инерции у тела быть не может.']);
    const ord = [0, 1, 2].sort((i, j) => d[j] - d[i]);
    const J = ord.map((i) => d[i]);
    const ax = ord.map((i) => [V[0][i], V[1][i], V[2][i]].map((x) => x * Math.sign(V[0][i] + V[1][i] + V[2][i] || 1)));
    const ang = ax.map((u) => u.map((x) => (Math.acos(Math.max(-1, Math.min(1, x))) * 180) / Math.PI));
    const sym = Math.abs(J[0] - J[1]) < 1e-9 * J[0] ? 2 : Math.abs(J[1] - J[2]) < 1e-9 * J[0] ? 0 : -1;
    steps.push(
      stepEx(ex, 'Эллипсоид инерции', 'Момент инерции относительно оси через O с направляющими косинусами (α, β, γ): J = J_xα² + J_yβ² + J_zγ² − 2J_xyαβ − 2J_yzβγ − 2J_zxγα. Откладывая по оси отрезок 1/√J, получаем поверхность второго порядка.', eqB(`${sg(Jx)}x² + ${sg(Jy)}y² + ${sg(Jz)}z² − 2·${sg(Jxy)}xy − 2·${sg(Jyz)}yz − 2·${sg(Jzx)}zx = 1`)),
      stepEx(ex, 'Главные оси', 'Главные моменты — собственные значения тензора инерции, главные оси — его собственные векторы.', eqB(...J.map((j, i) => `J${i + 1} = ${sg(j)}:  ось (${ax[i].map((x) => sg(x, 4)).join('; ')}),  углы с x, y, z: ${ang[i].map((x) => sg(x, 4)).join('°, ')}°`))),
      ...(sym >= 0 ? [stepB('Эллипсоид вращения', eqB(`ось симметрии — главная ось ${sym + 1} (J${sym + 1} = ${sg(J[sym])}); две другие оси произвольны в перпендикулярной плоскости`))] : []),
      stepB('Ответ', ansB([[bold(`${sg(J[0])}ξ² + ${sg(J[1])}η² + ${sg(J[2])}ζ² = 1`)], 'уравнение эллипсоида инерции в главных осях'])),
    );
    return done({ vals: { J1: J[0], J2: J[1], J3: J[2], c3: Math.abs(ax[2][0]) }, steps });
  },
};

export const INERTIA_ASKS: AskDef[] = [A_ELLIPSOID];
