/** Решение: сложение вращений по схеме в плоскости осей, кинематические формулы Эйлера, кинематический винт. */
import { b, sub, v, type AnswerRow, type Block, type Doc, type Inline, type Step } from '../../../shared/doc';
import { fmt } from '../../../shared/format';
import { BODY, FIXED, type EulerProblem, type EulerResult } from '../model/euler';
import { LEN, type SchemeProblem, type SchemeResult } from '../model/scheme';
import type { ScrewProblem, ScrewResult } from '../model/screw';
import { angleDeg, norm, type V3 } from '../model/vec';

export const f = (x: number) => fmt(x, 4);
const deg = (x: number) => fmt(x, 2);
const bad = (errors: string[]): Doc => ({
  steps: [
    {
      title: 'Данные',
      blocks: [
        { k: 'badge', tone: 'bad', text: 'проверьте данные' },
        { k: 'ul', items: errors.map((x) => [x]) },
      ],
    },
  ],
});
const exf =
  (opts: { explain?: boolean }) =>
  (bl: Block[], ...c: Inline[]) => {
    if (opts.explain) bl.push({ k: 'p', cls: 'explain', c });
  };
/** Обозначение с индексом-названием звена: ω_{IV}. */
const sv = (L: string, S: string): Inline[] => [v(L), sub(S)];
/** Вектор: (x; y; z) с подписью осей. */
export const vecT = (a: V3, names = ['x', 'y', 'z']) => `${names[0]}: ${f(a[0])}; ${names[1]}: ${f(a[1])}; ${names[2]}: ${f(a[2])}`;
/** Слагаемое k·ω с правильным знаком: «7·ω₁», «− 2·ω₃». */
function lin(terms: { k: number; s: Inline[] }[]): Inline[] {
  const out: Inline[] = [];
  terms
    .filter((t) => Math.abs(t.k) > 1e-12)
    .forEach((t, i) => {
      const a = Math.abs(t.k);
      out.push(i === 0 ? (t.k < 0 ? '−' : '') : t.k < 0 ? ' − ' : ' + ');
      if (Math.abs(a - 1) > 1e-12) out.push(f(a) + '·');
      out.push(...t.s);
    });
  return out.length ? out : ['0'];
}
const RPM = 30 / Math.PI;

/* ---------- схема ---------- */

export function schemeDoc(pr: SchemeProblem, r: SchemeResult, opts: { explain?: boolean } = {}): Doc {
  if (!r.ok) return bad(r.errors);
  const ex = exf(opts);
  const L = LEN[pr.unit];
  const steps: Step[] = [];
  const B = r.bodies;
  const nameOf = (id: number) => (id === 0 ? 'стойка' : (B.find((x) => x.id === id)?.name ?? '?'));
  const pname = (id: number) => pr.points.find((p) => p.id === id)?.name ?? '?';
  const w = (i: number) => sv('ω', B[i].name);
  // 1. Схема.
  {
    const items: Inline[][] = B.map((bb) => [
      b(bb.name),
      bb.parent === 0 ? ' — вращается вокруг неподвижной оси' : ` — вращается относительно звена ${nameOf(bb.parent)} вокруг оси, закреплённой на нём`,
      `: ось через (${f(bb.A[0])}; ${f(bb.A[1])}) ${L} под углом ${deg((Math.atan2(bb.e[1], bb.e[0]) * 180) / Math.PI)}° к оси x`,
    ]);
    const pts: Inline[][] = pr.points.map((p) => {
      const q = r.pos.get(p.id)!;
      return [b(p.name), ` (${f(q[0])}; ${f(q[1])}${q[2] ? `; z = ${f(q[2])}` : ''}) ${L}`];
    });
    const bl: Block[] = [
      { k: 'p', c: ['Плоскость чертежа — плоскость осей: x — вправо, y — вверх, z — на нас. Звенья:'] },
      { k: 'ul', items },
    ];
    if (pts.length) bl.push({ k: 'p', c: ['Точки:'] }, { k: 'ul', items: pts });
    ex(
      bl,
      'Угловая скорость звена ω — относительная, вдоль направления его оси: плюс — вращение против часовой стрелки, если смотреть с конца оси. Абсолютная угловая скорость складывается по цепочке: Ω = Ω',
      sub('родителя'),
      ' + ω·e (сложение вращений вокруг пересекающихся осей).',
    );
    steps.push({ title: 'Схема и обозначения', blocks: bl });
  }
  // 2. Уравнения.
  {
    const lines: { num?: boolean; c: Inline[] }[] = [];
    const bl: Block[] = [];
    for (const row of r.rows) {
      const terms = row.coef.map((k, i) => ({ k, s: w(i) }));
      if (row.src.k === 'contact') {
        const c = pr.contacts[row.src.i];
        const comp = row.src.comp === 2 ? '' : ` (проекция на ${'xyz'[row.src.comp]})`;
        lines.push({ c: [`касание ${nameOf(c.a)} — ${nameOf(c.b)} в точке ${pname(c.p)}${comp}: `, ...lin(terms), ' = 0'] });
      } else {
        const inp = pr.inputs[row.src.i];
        if (inp.kind === 'rel') {
          const val =
            inp.unit === 'rpm'
              ? `${f(inp.val)} об/мин = ${f(row.rhs)} с⁻¹`
              : inp.unit === 'period'
                ? `2π/T = 2π/${f(inp.val)} = ${f(row.rhs)} с⁻¹`
                : `${f(inp.val)} с⁻¹`;
          lines.push({ c: ['задано: ', ...w(B.findIndex((x) => x.id === inp.body)), ` = ${val}`, inp.d ? `; ε = ${f(inp.d)} с⁻²` : ''] });
        } else
          lines.push({
            c: [
              `скорость точки ${pname(inp.p)} звена ${nameOf(inp.body)}: v`,
              sub('z'),
              ' = ',
              ...lin(terms),
              ` = ${f(inp.val)} ${L}/с`,
              inp.d ? `; dv/dt = ${f(inp.d)}` : '',
            ],
          });
      }
    }
    if (r.accScale) {
      const inp = pr.inputs[r.accScale.input];
      lines.push({ c: [`|a| точки ${pname(inp.p)} звена ${nameOf(inp.body)} = ${f(inp.val)} ${L}/с²`] });
    }
    bl.push({ k: 'eq', lines });
    ex(
      bl,
      'Скорость точки P звена — сумма вкладов вращений по цепочке: ωₖ·eₖ × (P − Aₖ). Для точки в плоскости осей каждый вклад направлен по z и равен ωₖ·hₖ, где hₖ — расстояние от P до оси k со знаком (плюс — слева от направления оси). Качение без скольжения (зацепление): скорости точек обоих звеньев, совпадающих с точкой касания, равны.',
    );
    steps.push({ title: 'Условия связей', blocks: bl });
  }
  // 3. Угловые скорости.
  {
    const lines: { num?: boolean; c: Inline[] }[] = [];
    if (r.accScale)
      lines.push({
        c: [
          'движение с одной степенью свободы найдено с точностью до множителя k; при k = 1 ускорение точки ',
          `${f(r.accScale.aUnit)}; ускорения пропорциональны k², поэтому k = √(a/a₁) = ${f(r.accScale.k)}`,
        ],
      });
    B.forEach((bb, i) =>
      lines.push({
        c: [...w(i), ' = ', b(f(bb.w)), ' с⁻¹', r.rpm ? ` (${f(bb.w * RPM)} об/мин)` : '', bb.parent ? ` — относительно звена ${nameOf(bb.parent)}` : ''],
      }),
    );
    const bl: Block[] = [{ k: 'eq', lines }];
    const abs: { num?: boolean; c: Inline[] }[] = [];
    for (const bb of B) {
      const Wn = norm(bb.W);
      if (bb.chain.length > 1) {
        const We = norm(bb.We),
          Wr = Math.abs(bb.w);
        const g = angleDeg(bb.We, bb.e);
        abs.push({
          c: [
            ...sv('Ω', bb.name),
            ' = ',
            ...sv('Ω', nameOf(bb.parent)),
            ' + ',
            ...sv('ω', bb.name),
            `·e = (${f(bb.W[0])}; ${f(bb.W[1])}), |`,
            ...sv('Ω', bb.name),
            '| = ',
            b(f(Wn)),
            ' с⁻¹',
          ],
        });
        if (We > 0 && Wr > 0 && Number.isFinite(g))
          abs.push({
            num: true,
            c: [
              `= √(ω_e² + ω_r² + 2ω_e·ω_r·cos ${deg(bb.w >= 0 ? g : 180 - g)}°) = √(${f(We)}² + ${f(Wr)}² + 2·${f(We)}·${f(Wr)}·${f(Math.cos(((bb.w >= 0 ? g : 180 - g) * Math.PI) / 180))})`,
            ],
          });
      }
      const kind: Inline[] =
        bb.kind === 'rest'
          ? ['неподвижно']
          : bb.kind === 'trans'
            ? ['движется мгновенно поступательно (Ω = 0)']
            : bb.kind === 'axis'
              ? ['вращается вокруг неподвижной оси']
              : bb.kind === 'point'
                ? [
                    `вращается вокруг неподвижной точки O (${f(bb.O![0])}; ${f(bb.O![1])}); мгновенная ось проходит через O по Ω под углом ${deg((Math.atan2(bb.W[1], bb.W[0]) * 180) / Math.PI)}° к оси x`,
                  ]
                : bb.kind === 'plane'
                  ? [`движется плоскопараллельно (оси параллельны); мгновенная ось параллельна им и проходит через (${f(bb.inst!.p[0])}; ${f(bb.inst!.p[1])})`]
                  : [`мгновенная ось проходит через (${f(bb.inst?.p[0] ?? 0)}; ${f(bb.inst?.p[1] ?? 0)}) по Ω`];
      if (bb.chain.length > 1 || bb.kind !== 'axis') abs.push({ c: [b(bb.name), ' — ', ...kind] });
    }
    if (abs.length) bl.push({ k: 'p', c: ['Абсолютные угловые скорости (переносная Ω родителя плюс относительная):'] }, { k: 'eq', lines: abs });
    ex(
      bl,
      'Мгновенная ось звена с неподвижной точкой — прямая через эту точку по вектору Ω; точки на ней в данный момент неподвижны. У катящегося тела она проходит через точки касания с неподвижным телом.',
    );
    steps.push({ title: 'Угловые скорости', blocks: bl });
  }
  // 4. Угловые ускорения.
  if (B.some((bb) => norm(bb.E) > 0)) {
    const lines: { num?: boolean; c: Inline[] }[] = [];
    for (const bb of B) {
      if (norm(bb.E) === 0 && bb.chain.length === 1) continue;
      lines.push({
        c: [
          ...sv('ε', bb.name),
          ' = ',
          bb.parent ? [...sv('ε', nameOf(bb.parent)), ' + '] : '',
          bb.eps ? [`${f(bb.eps)}·e + `] : '',
          bb.parent ? [...sv('Ω', nameOf(bb.parent)), ' × ', ...sv('ω', bb.name), '·e'] : '',
          ` = (${vecT(bb.E)}), |`,
          ...sv('ε', bb.name),
          '| = ',
          b(f(norm(bb.E))),
          ' с⁻²',
        ].flat() as Inline[],
      });
    }
    const bl: Block[] = [{ k: 'eq', lines }];
    ex(
      bl,
      'Угловое ускорение — производная Ω. Ось относительного вращения поворачивается вместе с родителем, поэтому к относительному ε·e добавляется Ω',
      sub('родителя'),
      ' × ω·e; этот вектор перпендикулярен плоскости осей. Угловые ускорения звеньев находятся из тех же условий связей с производными заданных величин.',
    );
    steps.push({ title: 'Угловые ускорения', blocks: bl });
  }
  // 5. Аксоиды.
  const aks = B.filter((bb) => bb.aks);
  if (aks.length) {
    const lines = aks.map((bb) => ({
      c: [
        b(bb.name),
        `: неподвижный аксоид — круговой конус с осью вращения ${nameOf(bb.parent)} и углом ${deg(bb.aks!.fix)}° между осью и образующей (раствор ${deg(2 * bb.aks!.fix)}°); подвижный — с осью звена и углом ${deg(bb.aks!.mov)}° (раствор ${deg(2 * bb.aks!.mov)}°)`,
      ] as Inline[],
    }));
    const bl: Block[] = [{ k: 'eq', lines }];
    ex(
      bl,
      'При равномерных вращениях мгновенная ось описывает в пространстве неподвижный конус, а в теле — подвижный; подвижный аксоид катится по неподвижному без скольжения.',
    );
    steps.push({ title: 'Аксоиды', blocks: bl });
  }
  // 6. Точки.
  if (r.points.length) {
    const bl: Block[] = [];
    for (const p of r.points) {
      const bb = B.find((x) => x.id === p.body)!;
      const lines: { num?: boolean; c: Inline[] }[] = [];
      const inPlane = Math.abs(p.r[2]) < 1e-12 && Math.abs(p.v[0]) < 1e-12 && Math.abs(p.v[1]) < 1e-12;
      lines.push({
        c: [
          `точка ${p.name} (звено ${bb.name}): v = `,
          inPlane ? `${f(p.v[2])} ${L}/с по z${p.v[2] > 0 ? ' (к нам)' : p.v[2] < 0 ? ' (от нас)' : ''}` : `(${vecT(p.v)})`,
          ', |v| = ',
          b(`${f(norm(p.v))} ${L}/с`),
        ],
      });
      if (p.rot && p.cen && (bb.kind === 'point' || bb.kind === 'axis')) {
        lines.push({ c: ['вращательное ε × r = (', vecT(p.rot), '); осестремительное ω × (ω × r) = (', vecT(p.cen), ')'] });
      } else
        p.levels.forEach((lv, j) => {
          if (j === 0) return;
          lines.push({ c: [`уровень ${B[lv.k].name}: относительное (${vecT(lv.ar)}), кориолисово (${vecT(lv.cor)})`] });
        });
      lines.push({ c: ['a = (', vecT(p.a), '), |a| = ', b(`${f(norm(p.a))} ${L}/с²`)] });
      bl.push({ k: 'eq', lines });
    }
    ex(
      bl,
      'Для звена с неподвижной точкой O: v = Ω × r, a = ε × r + Ω × (Ω × r) (формула Ривальса), r — радиус-вектор из O; вращательное ускорение перпендикулярно ε, осестремительное направлено к мгновенной оси. Для остальных — сложение ускорений по уровням цепочки: переносное, относительное и кориолисово 2Ω × v',
      sub('отн'),
      '.',
    );
    steps.push({ title: 'Скорости и ускорения точек', blocks: bl });
  }
  // 7. Ответ.
  const rows: AnswerRow[] = [];
  for (const bb of B) {
    rows.push({
      kind: 'main',
      val: [...sv('Ω', bb.name), ` = ${f(norm(bb.W))} с⁻¹`],
      note: bb.parent ? `абсолютная; относительная ω = ${f(Math.abs(bb.w))} с⁻¹` : 'вокруг неподвижной оси',
    });
    if (norm(bb.E) > 0) rows.push({ kind: 'aux', val: [...sv('ε', bb.name), ` = ${f(norm(bb.E))} с⁻²`], note: 'угловое ускорение' });
  }
  for (const p of r.points)
    rows.push({
      kind: 'main',
      val: [v('v'), sub(p.name), ` = ${f(norm(p.v))} ${L}/с; `, v('a'), sub(p.name), ` = ${f(norm(p.a))} ${L}/с²`],
      note: 'скорость и ускорение',
    });
  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows }, ...r.notes.map((n): Block => ({ k: 'badge', tone: 'warn', text: n }))] });
  return { steps };
}

/* ---------- углы Эйлера ---------- */

export function eulerDoc(pr: EulerProblem, r: EulerResult, opts: { explain?: boolean } = {}): Doc {
  if (!r.ok) return bad(r.errors);
  const ex = exf(opts);
  const L = LEN[pr.unit];
  const N = r.info.names;
  const n = r.info.axes.length;
  const steps: Step[] = [];
  const dot = (s: string) => s + '̇';
  // 1. Ориентация.
  {
    const lines = [0, 1, 2].map((i) => ({
      c: [`${BODY[i]}: `, FIXED.map((fx, j) => `cos(${BODY[i]}, ${fx}) = ${r.sym.table[i][j]} = ${f(r.R[j][i])}`).join('; ')] as Inline[],
    }));
    const bl: Block[] = [
      { k: 'p', c: [`Последовательность поворотов — ${r.info.title}. Неподвижные оси Oξηζ, оси тела Oxyz.`] },
      { k: 'eq', lines },
    ];
    ex(bl, 'Матрица направляющих косинусов — произведение матриц поворотов вокруг осей в порядке поворотов; её столбцы — орты осей тела в неподвижных осях.');
    steps.push({ title: 'Ориентация тела', blocks: bl });
  }
  // 2. Углы.
  {
    const lines: { num?: boolean; c: Inline[] }[] = [];
    for (let i = 0; i < n; i++) {
      const src = [pr.q1, pr.q2, pr.q3][i];
      lines.push({ c: [`${N[i]} = ${src}; ${dot(N[i])} = ${r.dLaw[i]}; ${N[i]}̈ = ${r.ddLaw[i]}`] });
      lines.push({
        num: true,
        c: [
          `t₁ = ${f(pr.t1)} с: ${N[i]} = ${f(r.q[i])} рад (${deg((r.q[i] * 180) / Math.PI)}°), ${dot(N[i])} = ${f(r.qd[i])} с⁻¹, ${N[i]}̈ = ${f(r.qdd[i])} с⁻²`,
        ],
      });
    }
    steps.push({ title: 'Углы и их производные', blocks: [{ k: 'eq', lines }] });
  }
  // 3. ω.
  {
    const lines: { num?: boolean; c: Inline[] }[] = [];
    for (let i = 0; i < 3; i++) lines.push({ c: [v('ω'), sub(FIXED[i]), ` = ${r.sym.wF[i]} = `, b(f(r.wF[i]))] });
    for (let i = 0; i < 3; i++) lines.push({ c: [v('ω'), sub(BODY[i]), ` = ${r.sym.wB[i]} = `, b(f(r.wB[i]))] });
    lines.push({ c: ['|ω| = ', b(`${f(r.w)} с⁻¹`)] });
    if (r.wt) r.wt.forEach((s, i) => lines.push({ c: [v('ω'), sub(FIXED[i]), `(t) = ${s}`] }));
    const bl: Block[] = [{ k: 'eq', lines }];
    ex(
      bl,
      'Угловая скорость — сумма скоростей трёх поворотов: каждое слагаемое направлено по оси своего поворота в данный момент (кинематические формулы Эйлера). Проекции ω(t) на неподвижные оси — координаты конца годографа угловой скорости.',
    );
    steps.push({ title: 'Угловая скорость (формулы Эйлера)', blocks: bl });
  }
  // 4. ε.
  {
    const lines: { num?: boolean; c: Inline[] }[] = [
      { c: ['ε = dω/dt: в неподвижных осях (', vecT(r.eF, FIXED), '), в осях тела (', vecT(r.eB, BODY), ')'] },
      { c: ['|ε| = ', b(`${f(r.e)} с⁻²`)] },
    ];
    const bl: Block[] = [{ k: 'eq', lines }];
    ex(bl, 'Производные проекций на неподвижные оси дают проекции ε; производные проекций на оси тела — тоже проекции ε на оси тела (ω × ω = 0).');
    steps.push({ title: 'Угловое ускорение', blocks: bl });
  }
  if (r.aks)
    steps.push({
      title: 'Регулярная прецессия: аксоиды',
      blocks: [
        {
          k: 'eq',
          lines: [
            { c: [`неподвижный аксоид — круговой конус с осью прецессии и углом ${deg(r.aks.fix)}° между осью и образующей (раствор ${deg(2 * r.aks.fix)}°)`] },
            { c: [`подвижный — с осью собственного вращения и углом ${deg(r.aks.mov)}° (раствор ${deg(2 * r.aks.mov)}°)`] },
          ],
        },
      ],
    });
  if (r.point) {
    const p = r.point;
    const lines: { num?: boolean; c: Inline[] }[] = [
      { c: [`M в осях тела (${f(pr.mx)}; ${f(pr.my)}; ${f(pr.mz)}) ${L}; в неподвижных r = R·r`, sub('M'), ` = (${vecT(p.rF, FIXED)})`] },
      { c: ['v = ω × r = (', vecT(p.vF, FIXED), '); в осях тела (', vecT(p.vB, BODY), '); |v| = ', b(`${f(norm(p.vF))} ${L}/с`)] },
      { c: ['вращательное ε × r = (', vecT(p.rot, FIXED), '); осестремительное ω × (ω × r) = (', vecT(p.cen, FIXED), ')'] },
      { c: ['a = (', vecT(p.aF, FIXED), '); в осях тела (', vecT(p.aB, BODY), '); |a| = ', b(`${f(norm(p.aF))} ${L}/с²`)] },
    ];
    steps.push({ title: 'Скорость и ускорение точки M', blocks: [{ k: 'eq', lines }] });
  }
  const rows: AnswerRow[] = [
    { kind: 'main', val: [`ω = ${f(r.w)} с⁻¹`], note: `проекции на ξ, η, ζ: ${f(r.wF[0])}; ${f(r.wF[1])}; ${f(r.wF[2])}` },
    { kind: 'main', val: [`ε = ${f(r.e)} с⁻²`], note: `проекции на ξ, η, ζ: ${f(r.eF[0])}; ${f(r.eF[1])}; ${f(r.eF[2])}` },
  ];
  if (r.point) rows.push({ kind: 'main', val: [`v = ${f(norm(r.point.vF))} ${L}/с; a = ${f(norm(r.point.aF))} ${L}/с²`], note: 'точка M' });
  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows }] });
  return { steps };
}

/* ---------- кинематический винт ---------- */

export function screwDoc(pr: ScrewProblem, r: ScrewResult, opts: { explain?: boolean } = {}): Doc {
  if (!r.ok) return bad(r.errors);
  const ex = exf(opts);
  const L = LEN[pr.unit];
  const steps: Step[] = [];
  {
    const lines = pr.items.map((it, i) => ({
      c: (it.kind === 'rot'
        ? [
            `${i + 1}) вращение ω = (${f(it.x)}; ${f(it.y)}; ${f(it.z)}) с⁻¹ вокруг оси через (${f(it.px)}; ${f(it.py)}; ${f(it.pz)}) ${L}: вклад в v`,
            sub('O'),
            ` = ω × (O − A) = (${vecT(r.parts[i])})`,
          ]
        : [`${i + 1}) поступательное v = (${f(it.x)}; ${f(it.y)}; ${f(it.z)}) ${L}/с`]) as Inline[],
    }));
    const bl: Block[] = [{ k: 'eq', lines }];
    ex(
      bl,
      'Вращение вокруг оси, не проходящей через начало координат, равно вращению вокруг параллельной оси через начало и поступательному движению со скоростью ω × (O − A) (пара вращений).',
    );
    steps.push({ title: 'Составляющие движения', blocks: bl });
  }
  {
    const lines: { num?: boolean; c: Inline[] }[] = [
      { c: ['Ω = Σω = (', vecT(r.Om), '), |Ω| = ', b(`${f(norm(r.Om))} с⁻¹`)] },
      { c: [v('v'), sub('O'), ' = (', vecT(r.vO), `), |v`, sub('O'), '| = ', b(`${f(norm(r.vO))} ${L}/с`)] },
    ];
    steps.push({ title: 'Главный вектор и скорость полюса', blocks: [{ k: 'eq', lines }] });
  }
  {
    const lines: { num?: boolean; c: Inline[] }[] = [];
    if (r.kind === 'rest') lines.push({ c: ['тело неподвижно'] });
    else if (r.kind === 'trans') lines.push({ c: ['Ω = 0: результирующее движение — ', b('поступательное'), ` со скоростью v = (${vecT(r.vO)}) ${L}/с`] });
    else {
      lines.push({
        c: [
          'v* = (v',
          sub('O'),
          '·Ω)/|Ω| = ',
          b(`${f(r.vmin)} ${L}/с`),
          r.kind === 'rot' ? ' — чистое вращение' : ` — винтовое движение, шаг p = v*/Ω = ${f(r.pitch)} ${L}`,
        ],
      });
      lines.push({
        c: [`ось ${r.kind === 'rot' ? 'вращения' : 'винта'} параллельна Ω и проходит через r* = Ω × v`, sub('O'), `/Ω² = (${vecT(r.axisP!)}) ${L}`],
      });
    }
    const bl: Block[] = [{ k: 'eq', lines }];
    ex(
      bl,
      'Наименьшую скорость v* имеют точки мгновенной винтовой оси: их скорость направлена вдоль Ω. Если v* = 0, движение в данный момент — вращение вокруг этой оси.',
    );
    steps.push({ title: 'Результирующее движение', blocks: bl });
  }
  if (r.points.length) {
    const lines = r.points.map((p) => ({
      c: [
        `${p.name} (${vecT(p.r)}): v = v`,
        sub('O'),
        ` + Ω × r = (${vecT(p.v)}), |v| = `,
        b(`${f(norm(p.v))} ${L}/с`),
        p.d != null ? `; расстояние до оси ${f(p.d)} ${L}` : '',
      ] as Inline[],
    }));
    steps.push({ title: 'Скорости точек', blocks: [{ k: 'eq', lines }] });
  }
  const rows: AnswerRow[] = [
    {
      kind: 'main',
      val: [`Ω = ${f(norm(r.Om))} с⁻¹`],
      note: r.kind === 'trans' ? 'поступательное движение' : r.kind === 'rot' ? 'чистое вращение' : r.kind === 'screw' ? 'винтовое движение' : '',
    },
    { kind: 'main', val: [`v* = ${f(Math.abs(r.vmin))} ${L}/с`], note: 'наименьшая скорость точек тела' },
  ];
  for (const p of r.points) rows.push({ kind: 'aux', val: [v('v'), sub(p.name), ` = ${f(norm(p.v))} ${L}/с`], note: 'скорость точки' });
  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows }] });
  return { steps };
}
