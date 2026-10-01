/** Решение: равновесие узла (проекции на оси) и приведение системы сил к простейшему виду. */
import { b, join, sub, v, type AnswerRow, type Block, type Doc, type Inline, type Step } from '../../../shared/doc';
import { fmt } from '../../../shared/format';
import { norm, type NodeProblem, type NodeResult, type ReduceProblem, type ReduceResult } from '../model/forces';

const f = (x: number) => fmt(x, 3);
const fp = (x: number) => (x < 0 ? `(${f(x)})` : f(x));
/** Обозначение вида «S_A» → S с индексом A. */
const nm = (s: string): Inline[] => {
  const [L, S] = s.split('_');
  return S ? [v(L), sub(S)] : [v(L)];
};
const KIND = { known: 'известная сила', rope: 'нить (может быть только растянута)', rod: 'стержень («+» — растяжение)', normal: 'реакция гладкой поверхности (только давит)' } as const;
const AX = ['x', 'y', 'z'] as const;

export function nodeDoc(pr: NodeProblem, r: NodeResult, opts: { explain?: boolean } = {}): Doc {
  const steps: Step[] = [];
  const ex = (bl: Block[], ...c: Inline[]) => {
    if (opts.explain) bl.push({ k: 'p', cls: 'explain', c });
  };
  const axes = r.plane ? [0, 1] : [0, 1, 2];
  {
    const items = pr.forces.map((F, i): Inline[] => [
      ...nm(F.name),
      F.kind === 'known' ? ` = ${f(F.F)} кН — ` : ' — ',
      KIND[F.kind],
      '; направляющие косинусы: ',
      axes.map((a) => `${f(r.dirs[i][a])}`).join('; '),
    ]);
    const bl: Block[] = [{ k: 'p', c: [`Все силы приложены в одной точке — система сходящихся сил${r.plane ? ' на плоскости: два уравнения равновесия' : ' в пространстве: три уравнения равновесия'}.`] }, { k: 'ul', items }];
    ex(bl, 'Неизвестные усилия направляем от узла вдоль нити или стержня (растяжение) и по нормали от поверхности; если в ответе получится «−», усилие направлено противоположно. Нить сжать нельзя, гладкая поверхность не может тянуть.');
    steps.push({ title: 'Силы, приложенные к узлу', blocks: bl });
  }
  if (r.status !== 'ok') {
    const why: Record<string, string> = {
      indeterminate: `Неизвестных больше, чем уравнений (${axes.length}): задача статически неопределима.`,
      mechanism: 'Неизвестные усилия лежат на одной прямой (в пространстве — в одной плоскости) и не могут уравновесить нагрузку в остальных направлениях.',
      noequilibrium: 'Уравнения равновесия несовместны: заданные силы нельзя уравновесить.',
      nounknown: 'Неизвестных нет, а заданные силы уравновешены.',
    };
    steps.push({ title: 'Равновесие узла', blocks: [{ k: 'badge', tone: r.status === 'nounknown' ? 'ok' : 'bad', text: r.status === 'nounknown' ? 'узел в равновесии' : 'решения нет' }, { k: 'p', c: [why[r.status]] }] });
    return { steps };
  }
  {
    const lines: { num?: boolean; c: Inline[] }[] = axes.map((a) => {
      const terms: Inline[] = [];
      pr.forces.forEach((F, i) => {
        const c = r.dirs[i][a];
        if (Math.abs(c) < 1e-12) return;
        terms.push(terms.length ? (c < 0 ? ' − ' : ' + ') : c < 0 ? '−' : '');
        if (F.kind === 'known') terms.push(`${f(F.F)}${Math.abs(Math.abs(c) - 1) < 1e-12 ? '' : '·' + f(Math.abs(c))}`);
        else terms.push(...nm(F.name), Math.abs(Math.abs(c) - 1) < 1e-12 ? '' : `·${f(Math.abs(c))}`);
      });
      return { c: ['Σ', v('F'), sub(AX[a]), ' = ', ...(terms.length ? terms : ['0']), ' = 0'] as Inline[] };
    });
    const unk = pr.forces.map((F, i) => (F.kind === 'known' ? -1 : i)).filter((i) => i >= 0);
    lines.push({ num: true, c: join(unk.map((i) => [...nm(pr.forces[i].name), ' = ', b(`${f(r.vals[i])} кН`)]), '; ') });
    const bl: Block[] = [{ k: 'eq', lines }];
    for (const i of r.bad)
      bl.push({ k: 'badge', tone: 'bad', text: `${pr.forces[i].name}: ${pr.forces[i].kind === 'rope' ? 'нить получилась сжатой' : 'опора должна была бы тянуть'} — такое равновесие невозможно` });
    // Теорема о трёх силах (Лами): на плоскости F_i / sin(угол между двумя другими) одинаковы.
    if (r.plane && pr.forces.length === 3) {
      const mags = pr.forces.map((F, i) => Math.abs(F.kind === 'known' ? F.F : r.vals[i]));
      const sgn = pr.forces.map((F, i) => Math.sign(F.kind === 'known' ? F.F : r.vals[i]) || 1);
      const d = r.dirs.map((u, i) => u.map((x) => x * sgn[i]));
      const sinBetween = (j: number, k: number) => Math.abs(d[j][0] * d[k][1] - d[j][1] * d[k][0]);
      const ratios = [0, 1, 2].map((i) => {
        const [j, k] = [0, 1, 2].filter((x) => x !== i);
        return mags[i] / sinBetween(j, k);
      });
      if (ratios.every((x) => isFinite(x)))
        bl.push({ k: 'p', c: ['Проверка по теореме Лами (три сходящиеся силы): ', ...join(pr.forces.map((F, i) => [...nm(F.name), ' / sin α', sub(String(i + 1)), ' = ', f(ratios[i])]), ', '), ' (α', sub('i'), ' — угол между двумя другими силами) — отношения равны: силовой треугольник замкнут.'] });
    }
    ex(bl, 'Геометрически условие равновесия — силовой многоугольник замкнут; аналитически — суммы проекций сил на оси равны нулю. Проекция силы на ось — модуль силы, умноженный на косинус угла между силой и осью.');
    steps.push({ title: 'Уравнения равновесия узла', blocks: bl });
  }
  const rows: AnswerRow[] = pr.forces
    .map((F, i) => ({ F, i }))
    .filter((x) => x.F.kind !== 'known')
    .map(({ F, i }) => ({ kind: 'main', val: [...nm(F.name), ` = ${f(r.vals[i])} кН`], note: F.kind === 'known' ? '' : r.vals[i] < 0 ? (F.kind === 'rod' ? 'стержень сжат' : 'направлена противоположно') : F.kind === 'rod' ? 'стержень растянут' : '' }));
  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows }] });
  return { steps };
}

export function reduceDoc(pr: ReduceProblem, r: ReduceResult, opts: { explain?: boolean } = {}): Doc {
  const steps: Step[] = [];
  const ex = (bl: Block[], ...c: Inline[]) => {
    if (opts.explain) bl.push({ k: 'p', cls: 'explain', c });
  };
  const axes = r.plane ? [0, 1] : [0, 1, 2];
  const O = pr.O;
  // 1. Главный вектор.
  {
    const lines = axes.map((a) => ({ c: [v('R'), sub(AX[a]), ' = Σ', v('F'), sub(AX[a]), ' = ', pr.forces.map((F, i) => (i ? ' + ' : '') + fp(F.F[a])).join('') || '0', ' = ', b(f(r.R[a]))] as Inline[] }));
    lines.push({ c: [v('R'), ' = √(', axes.map((a) => `${fp(r.R[a])}²`).join(' + '), ') = ', b(`${f(norm(r.R))} кН`)] });
    const bl: Block[] = [{ k: 'eq', lines }];
    ex(bl, 'Главный вектор — геометрическая сумма всех сил; он не зависит от выбора центра приведения.');
    steps.push({ title: 'Главный вектор', blocks: bl });
  }
  // 2. Главный момент.
  {
    const comp = r.plane ? [2] : [0, 1, 2];
    const lines = comp.map((a) => {
      const [i, j] = [(a + 1) % 3, (a + 2) % 3];
      const terms = pr.forces
        .map((F) => {
          const ri = F.r[i] - O[i],
            rj = F.r[j] - O[j];
          const m = ri * F.F[j] - rj * F.F[i];
          return Math.abs(m) < 1e-12 ? '' : `${fp(ri)}·${fp(F.F[j])} − ${fp(rj)}·${fp(F.F[i])}`;
        })
        .filter(Boolean);
      const pairs = pr.pairs.filter((p) => Math.abs(p.M[a]) > 1e-12).map((p) => fp(p.M[a]));
      return { c: [v('M'), sub(`O${AX[a]}`), ' = Σ(', v(AX[i]), v('F'), sub(AX[j]), ' − ', v(AX[j]), v('F'), sub(AX[i]), ')', pairs.length ? ' + Σ' + 'M' : '', ' = ', [...terms.map((t) => `(${t})`), ...pairs].join(' + ') || '0', ' = ', b(f(r.M[a]))] as Inline[] };
    });
    const bl: Block[] = [{ k: 'p', c: [`Центр приведения O (${O.map(f).join('; ')}). Координаты точек приложения берём относительно O.`] }, { k: 'eq', lines }];
    ex(bl, 'Главный момент — сумма моментов всех сил относительно центра O и моментов пар; при переносе силы параллельно самой себе добавляется пара (теорема Пуансо).');
    steps.push({ title: 'Главный момент относительно центра O', blocks: bl });
  }
  // 3. Простейший вид.
  {
    const bl: Block[] = [];
    const Rn = norm(r.R);
    if (!r.plane) bl.push({ k: 'eq', lines: [{ c: ['Инвариант: ', v('R'), '·', v('M'), sub('O'), ' = ', axes.map((a) => `${fp(r.R[a])}·${fp(r.M[a])}`).join(' + '), ' = ', b(f(r.inv))] }] });
    if (r.kind === 'equilibrium') bl.push({ k: 'badge', tone: 'ok', text: 'система уравновешена' }, { k: 'p', c: ['R = 0 и M_O = 0: силы взаимно уравновешиваются.'] });
    else if (r.kind === 'pair') bl.push({ k: 'badge', tone: 'warn', text: 'приводится к паре' }, { k: 'p', c: [`R = 0, система эквивалентна паре с моментом ${f(norm(r.M))} кН·м (не зависит от центра приведения).`] });
    else if (r.kind === 'resultant') {
      bl.push({ k: 'badge', tone: 'ok', text: 'приводится к равнодействующей' });
      if (r.plane) {
        // x·R_y − y·R_x = M_O (относительно O).
        bl.push({
          k: 'p',
          c: [`Равнодействующая R = ${f(Rn)} кН, её линия действия — множество точек, относительно которых момент системы равен нулю: `, v('x'), `·${fp(r.R[1])} − `, v('y'), `·${fp(r.R[0])} = ${f(r.M[2])} (x, y — от центра O).`],
        });
      } else bl.push({ k: 'p', c: [`R·M_O = 0, R ≠ 0 — система приводится к равнодействующей R = ${f(Rn)} кН; линия действия проходит через точку (${r.axisPoint!.map(f).join('; ')}) параллельно R.`] });
    } else {
      bl.push({ k: 'badge', tone: 'warn', text: `приводится к динамическому винту (${r.Mstar > 0 ? 'правому' : 'левому'})` });
      bl.push({
        k: 'eq',
        lines: [
          { c: [v('M'), '* = ', v('R'), '·', v('M'), sub('O'), '/', v('R'), ` = ${f(r.inv)}/${f(Rn)} = `, b(`${f(r.Mstar)} кН·м`)] },
        ],
      });
      bl.push({ k: 'p', c: ['Центральная ось параллельна ', v('R'), ' и проходит через точку (', r.axisPoint!.map(f).join('; '), ')', ...(r.xyPoint ? ['; плоскость Oxy она пересекает в точке x = ', b(f(r.xyPoint[0])), ', y = ', b(f(r.xyPoint[1]))] : []), '.'] });
      ex(bl, 'Если R·M_O ≠ 0, систему нельзя заменить одной силой: она эквивалентна силе R на центральной оси и паре с моментом M*, лежащей в плоскости, перпендикулярной этой оси (динама). Правый винт — если M* и R направлены в одну сторону.');
    }
    steps.push({ title: 'Простейший вид системы', blocks: bl });
  }
  const rows: AnswerRow[] = [
    { kind: 'main', val: [v('R'), ` = ${f(norm(r.R))} кН`], note: 'главный вектор' },
    { kind: 'main', val: [v('M'), sub('O'), ` = ${f(norm(r.M))} кН·м`], note: 'главный момент' },
    ...(r.kind === 'dynamo' ? [{ kind: 'main' as const, val: [v('M'), `* = ${f(r.Mstar)} кН·м`], note: r.Mstar > 0 ? 'момент динамы, правый винт' : 'момент динамы, левый винт' }] : []),
    ...((r.kind === 'dynamo' || r.kind === 'resultant') && r.xyPoint ? [{ kind: 'main' as const, val: [`ось: x = ${f(r.xyPoint[0])}, y = ${f(r.xyPoint[1])}`], note: r.kind === 'dynamo' ? 'центральная ось пересекает плоскость Oxy' : 'линия действия пересекает плоскость Oxy' }] : []),
  ];
  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows }] });
  return { steps };
}
