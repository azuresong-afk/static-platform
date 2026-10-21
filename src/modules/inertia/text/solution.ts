/** Решение: массы частей, центральные моменты, теорема Гюйгенса — Штейнера, сумма, радиус инерции, тензор в точке A. */
import { b, sub, v, type AnswerRow, type Block, type Doc, type Inline, type Step } from '../../../shared/doc';
import { fmt } from '../../../shared/format';
import { G, KIND_NAME, type IPart, type IProblem, type InertiaResult } from '../model/inertia';

const f = (x: number) => fmt(x, 4);
const AX = ['x', 'y', 'z'];

/** Формулы центрального момента: относительно оси симметрии и поперечной оси. */
const FORM: Record<string, [string, string]> = {
  point: ['0', '0'],
  rod: ['0', 'ml²/12'],
  ring: ['mR²', 'mR²/2'],
  disk: ['mR²/2', 'm(3R² + h²)/12'],
  tube: ['m(R² + r²)/2', 'm(3(R² + r²) + h²)/12'],
  cone: ['3mR²/10', 'm(3R²/20 + 3h²/80)'],
  sphere: ['2mR²/5', '2mR²/5'],
  hball: ['2m(R⁵ − r⁵)/(5(R³ − r³))', '2m(R⁵ − r⁵)/(5(R³ − r³))'],
  shell: ['2mR²/3', '2mR²/3'],
};
const dims = (q: IPart) =>
  Object.entries(q.p)
    .map(([k, x]) => `${k} = ${f(x)}`)
    .join(', ');

function centralLine(q: IPart, i: number, r: InertiaResult): Inline[] {
  const pr = r.parts[i];
  const head: Inline[] = [v('J'), sub(`C${i + 1}`), ' = '];
  if (q.kind === 'box') {
    const [ux, uy, uz] = r.u;
    const { a, b: bb, c } = q.p;
    const axis = [ux, uy, uz].findIndex((x) => Math.abs(Math.abs(x) - 1) < 1e-12);
    const form = axis === 0 ? 'm(b² + c²)/12' : axis === 1 ? 'm(a² + c²)/12' : axis === 2 ? 'm(a² + b²)/12' : `m[(b² + c²)·${f(ux * ux)} + (a² + c²)·${f(uy * uy)} + (a² + b²)·${f(uz * uz)}]/12`;
    if (axis == null) return [...head, form, ' = ', b(f(pr.Jc))];
    const sq = axis === 0 ? [bb, c] : axis === 1 ? [a, c] : [a, bb];
    return [...head, form, ` = ${f(pr.m)}·(${f(sq[0])}² + ${f(sq[1])}²)/12 = `, b(f(pr.Jc))];
  }
  const [fa, ft] = FORM[q.kind];
  if (q.kind === 'point' || fa === ft || pr.theta == null) return [...head, fa, ' = ', b(f(pr.Jc))];
  if (pr.theta < 1e-6) return [...head, fa, ' = ', b(f(pr.Jc)), ' (ось параллельна оси симметрии части)'];
  if (Math.abs(pr.theta - 90) < 1e-6) return [...head, ft, ' = ', b(f(pr.Jc)), ' (ось перпендикулярна оси симметрии части)'];
  return [...head, `J_a cos²θ + J_t sin²θ, J_a = ${fa}, J_t = ${ft}, θ = ${f(pr.theta)}° → `, b(f(pr.Jc))];
}

export function inertiaDoc(pr: IProblem, r: InertiaResult, opts: { explain?: boolean } = {}): Doc {
  const steps: Step[] = [];
  const ex = (bl: Block[], ...c: Inline[]) => {
    if (opts.explain) bl.push({ k: 'p', cls: 'explain', c });
  };
  const JU = pr.byWeight ? 'кГ·м·с²' : 'кг·м²';
  const MU = pr.byWeight ? 'кГ·с²/м' : 'кг';
  if (!r.ok) {
    steps.push({ title: 'Данные', blocks: [{ k: 'badge', tone: 'bad', text: 'проверьте данные' }, { k: 'ul', items: r.errors.map((e) => [e]) }] });
    return { steps };
  }
  const u = r.u;
  const axisName = [0, 1, 2].find((i) => Math.abs(Math.abs(u[i]) - 1) < 1e-12);
  const axisText = axisName != null ? `ось ${AX[axisName]}` : `ось с направляющими косинусами ${u.map(f).join('; ')}`;
  // 1. Части и массы.
  {
    const items = pr.parts.map((q, i): Inline[] => [
      `${i + 1}. ${KIND_NAME[q.kind]}${q.s < 0 ? ' — вырез' : ''}: `,
      ...(pr.byWeight ? [v('m'), sub(String(i + 1)), ` = P/g = ${f(q.m)}/${G} = `, b(f(r.parts[i].m)), ` ${MU}`] : [v('m'), sub(String(i + 1)), ' = ', b(f(q.m)), ` ${MU}`]),
      `; центр масс C${i + 1} (${q.c.map(f).join('; ')})`,
      ...(dims(q) ? [`; ${dims(q)}`] : []),
    ]);
    const bl: Block[] = [{ k: 'p', c: [`Ищем момент инерции относительно оси, проходящей через точку A (${pr.A.map(f).join('; ')}): ${axisText}.`] }, { k: 'ul', items }];
    bl.push({ k: 'p', c: ['Масса системы ', v('M'), ' = Σ', v('m'), sub('i'), ` = ${pr.parts.map((q, i) => (i ? (q.s < 0 ? ' − ' : ' + ') : q.s < 0 ? '−' : '') + f(r.parts[i].m)).join('')} = `, b(`${f(r.M)} ${MU}`), r.C ? `; центр масс системы C (${r.C.map(f).join('; ')}).` : '.'] });
    ex(bl, 'Составное тело разбиваем на части простой формы, для которых момент инерции относительно центральной оси известен. Вырезанную часть учитываем со знаком «−»: её момент инерции вычитается.');
    steps.push({ title: 'Части тела и их массы', blocks: bl });
  }
  // 2. Центральные моменты.
  {
    const lines = pr.parts.map((q, i) => ({ c: centralLine(q, i, r) }));
    const bl: Block[] = [{ k: 'p', c: ['Момент инерции каждой части относительно оси, проходящей через её центр масс параллельно заданной оси:'] }, { k: 'eq', lines }];
    ex(bl, 'J_a — момент относительно оси симметрии части, J_t — относительно перпендикулярной ей центральной оси; для оси под углом θ к оси симметрии J = J_a cos²θ + J_t sin²θ. Формулы: стержень ml²/12, обод mR², диск mR²/2, шар 2mR²/5.');
    steps.push({ title: 'Центральные моменты инерции частей', blocks: bl });
  }
  // 3. Штейнер.
  {
    const lines = pr.parts.map((_, i) => {
      const p = r.parts[i];
      return { c: [v('J'), sub(String(i + 1)), ' = ', v('J'), sub(`C${i + 1}`), ' + ', v('m'), sub(String(i + 1)), v('d'), sub(String(i + 1)), '² = ', f(p.Jc), ' + ', f(p.m), '·', `${f(p.d)}²`, ' = ', b(f(Math.abs(p.J)))] as Inline[] };
    });
    const bl: Block[] = [{ k: 'p', c: ['d', sub('i'), ' — расстояние от центра масс части до заданной оси.'] }, { k: 'eq', lines }];
    ex(bl, 'Теорема Гюйгенса — Штейнера: момент инерции относительно оси равен моменту относительно параллельной ей оси через центр масс плюс произведение массы на квадрат расстояния между осями. Поэтому наименьший момент — относительно центральной оси.');
    steps.push({ title: 'Перенос к заданной оси (теорема Гюйгенса — Штейнера)', blocks: bl });
  }
  // 4. Сумма.
  {
    const sum = r.parts.map((p, i) => (i ? (p.J < 0 ? ' − ' : ' + ') : p.J < 0 ? '−' : '') + f(Math.abs(p.J))).join('');
    const lines: { num?: boolean; c: Inline[] }[] = [{ c: [v('J'), ' = Σ', v('J'), sub('i'), ` = ${sum} = `, b(`${f(r.J)} ${JU}`)] }];
    if (r.rho != null) lines.push({ c: ['ρ = √(', v('J'), '/', v('M'), `) = √(${f(r.J)}/${f(r.M)}) = `, b(`${f(r.rho)} м`)] });
    if (r.Jc != null && pr.parts.length > 1) lines.push({ c: [v('J'), sub('C'), ' = ', v('J'), ' − ', v('M'), v('d'), sub('C'), `² = ${f(r.Jc)} ${JU}`, ' — относительно параллельной центральной оси'] });
    const bl: Block[] = [{ k: 'eq', lines }];
    ex(bl, 'Радиус инерции ρ — расстояние от оси, на котором надо сосредоточить всю массу тела, чтобы её момент инерции был равен моменту инерции тела: J = Mρ².');
    steps.push({ title: 'Момент инерции системы и радиус инерции', blocks: bl });
  }
  // 5. Тензор в точке A.
  {
    const [Jx, Jy, Jz] = r.Jxyz,
      [Jxy, Jyz, Jzx] = r.Jprod;
    const bl: Block[] = [
      {
        k: 'eq',
        lines: [
          { c: [v('J'), sub('x'), ` = ${f(Jx)}; `, v('J'), sub('y'), ` = ${f(Jy)}; `, v('J'), sub('z'), ` = ${f(Jz)} ${JU}`] },
          { c: [v('J'), sub('xy'), ` = Σmxy = ${f(Jxy)}; `, v('J'), sub('yz'), ` = ${f(Jyz)}; `, v('J'), sub('zx'), ` = ${f(Jzx)} ${JU}`] },
          { c: [`главные моменты инерции в точке A: ${r.principal.vals.map(f).join('; ')} ${JU}`] },
        ],
      },
      { k: 'p', c: ['Проверка: ', v('J'), ' = ', v('J'), sub('x'), 'α² + ', v('J'), sub('y'), 'β² + ', v('J'), sub('z'), 'γ² − 2', v('J'), sub('xy'), 'αβ − 2', v('J'), sub('yz'), 'βγ − 2', v('J'), sub('zx'), `γα = ${f(Jx * u[0] ** 2 + Jy * u[1] ** 2 + Jz * u[2] ** 2 - 2 * (Jxy * u[0] * u[1] + Jyz * u[1] * u[2] + Jzx * u[2] * u[0]))} — совпадает.`] },
    ];
    ex(bl, 'Осевые моменты J_x = Σm(y² + z²) и т. д. и центробежные J_xy = Σmxy вычислены относительно осей, проходящих через точку A параллельно x, y, z (части — по теореме Штейнера: J_xy = J_xy,C + m·x_C·y_C). Если все центробежные моменты равны нулю, оси x, y, z — главные оси инерции в точке A.');
    steps.push({ title: 'Осевые и центробежные моменты в точке A', blocks: bl });
  }
  const rows: AnswerRow[] = [{ kind: 'main', val: [v('J'), ` = ${f(r.J)} ${JU}`], note: 'относительно заданной оси' }];
  if (r.rho != null) rows.push({ kind: 'main', val: [`ρ = ${f(r.rho)} м`], note: 'радиус инерции' });
  rows.push({ kind: 'aux', val: [v('M'), ` = ${f(r.M)} ${MU}`], note: 'масса системы' });
  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows }] });
  return { steps };
}

