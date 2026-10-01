/** Решения: центр масс системы по законам движения, сохранение положения центра масс, плоское движение колеса. */
import { b, sub, v, type AnswerRow, type Block, type Doc, type Inline, type Step } from '../../../shared/doc';
import { printExpr } from '../../../shared/expr';
import { fmt } from '../../../shared/format';
import type { PointsProblem, PointsResult, ShiftProblem, ShiftResult } from '../model/system';
import type { WheelProblem, WheelResult } from '../model/wheel';

const f = (x: number) => fmt(x, 4);
const fp = (x: number) => (x < 0 ? `(${f(x)})` : f(x));
const bad = (errors: string[]): Doc => ({ steps: [{ title: 'Данные', blocks: [{ k: 'badge', tone: 'bad', text: 'проверьте данные' }, { k: 'ul', items: errors.map((x) => [x]) }] }] });
const exf = (opts: { explain?: boolean }) => (bl: Block[], ...c: Inline[]) => {
  if (opts.explain) bl.push({ k: 'p', cls: 'explain', c });
};

export function pointsDoc(pr: PointsProblem, r: PointsResult, opts: { explain?: boolean } = {}): Doc {
  if (!r.ok) return bad(r.errors);
  const ex = exf(opts);
  const steps: Step[] = [];
  const FU = pr.byWeight ? '(в единицах веса)' : 'Н';
  {
    const items = pr.pts.map((p, i): Inline[] => [`${i + 1}. ${p.name || 'точка'}: m = ${pr.byWeight ? `${f(p.m)}/g = ` : ''}${f(r.masses[i])}; x = ${printExpr(r.ex[i].x)}, y = ${printExpr(r.ex[i].y)}`]);
    const bl: Block[] = [{ k: 'ul', items }, { k: 'p', c: ['Масса системы ', v('M'), ' = ', b(f(r.M)), pr.gravity ? `; ось y — вверх, сила тяжести вдоль −y (g = ${f(pr.g)}).` : '.'] }];
    steps.push({ title: 'Точки системы и законы их движения', blocks: bl });
  }
  {
    const lines: { num?: boolean; c: Inline[] }[] = [
      { c: [v('x'), sub('C'), ' = Σm', sub('i'), v('x'), sub('i'), '/M = ', b(f(r.C[0])), ';  ', v('y'), sub('C'), ' = ', b(f(r.C[1])), ` (t = ${f(pr.t)} с)`] },
      { c: [v('v'), sub('C'), ` = (${f(r.vC[0])}; ${f(r.vC[1])});  `, v('Q'), ' = M', v('v'), sub('C'), ` = Σm`, sub('i'), v('v'), sub('i'), ` = (${f(r.Q[0])}; ${f(r.Q[1])}), |Q| = `, b(f(Math.hypot(...r.Q)))] },
      { c: [v('a'), sub('C'), ' = Σm', sub('i'), v('a'), sub('i'), `/M = (${f(r.aC[0])}; ${f(r.aC[1])})`] },
    ];
    const bl: Block[] = [{ k: 'eq', lines }];
    ex(bl, 'Скорости и ускорения точек — производные законов движения; центр масс движется так, как двигалась бы точка массы M, к которой приложены все внешние силы.');
    steps.push({ title: 'Центр масс и количество движения', blocks: bl });
  }
  {
    const lines: { num?: boolean; c: Inline[] }[] = [
      { c: ['Теорема о движении центра масс: M', v('a'), sub('C'), ' = Σ', v('F'), '^e:  ', v('R'), ` = (${f(r.R[0])}; ${f(r.R[1])})`] },
    ];
    if (pr.gravity) lines.push({ c: ['внешние силы, кроме тяжести (реакция опоры): ', v('N'), ' = M', v('a'), sub('C'), ' − M', v('g'), ` = (${f(r.N[0])}; `, b(f(r.N[1])), `) ${FU}`] });
    const bl: Block[] = [{ k: 'eq', lines }];
    if (r.range) bl.push({ k: 'p', c: [`На отрезке t ∈ [${f(pr.t1)}; ${f(pr.t2)}]: N_x от ${f(r.range.Nx[0])} до ${f(r.range.Nx[1])}; N_y от `, b(f(r.range.Ny[0])), ' до ', b(f(r.range.Ny[1])), '.'] });
    ex(bl, 'Внутренние силы (в шарнирах, давление газов, мышечные усилия) на движение центра масс не влияют. Давление на опору равно реакции по модулю и противоположно ей.');
    steps.push({ title: 'Внешние силы', blocks: bl });
  }
  const rows: AnswerRow[] = [
    { kind: 'main', val: [v('R'), ` = (${f(r.R[0])}; ${f(r.R[1])})`], note: 'главный вектор внешних сил' },
    ...(pr.gravity ? [{ kind: 'main' as const, val: [v('N'), ` = (${f(r.N[0])}; ${f(r.N[1])})`] as Inline[], note: 'реакция опоры' }] : []),
    { kind: 'aux', val: [v('Q'), ` = ${f(Math.hypot(...r.Q))}`], note: 'количество движения' },
  ];
  if (r.range) rows.push({ kind: 'aux', val: [`N_y: ${f(r.range.Ny[0])} … ${f(r.range.Ny[1])}`], note: 'на отрезке' });
  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows }] });
  return { steps };
}

export function shiftDoc(pr: ShiftProblem, r: ShiftResult, opts: { explain?: boolean } = {}): Doc {
  if (!r.ok) return bad(r.errors);
  const ex = exf(opts);
  const steps: Step[] = [];
  {
    const items = pr.parts.map((p, i): Inline[] => [
      `${i + 1}. ${p.name || 'часть'}: m = ${f(p.m)}; `,
      i === pr.unknown ? `перемещение ищем (под углом ${f(p.theta)}° к оси x)` : `s = ${f(p.s)} под углом ${f(p.theta)}° → Δx отн = s·cos θ = ${f(r.dx[i])}`,
    ]);
    const bl: Block[] = [{ k: 'p', c: [`Основание: m = ${f(pr.M0)}; масса системы ${f(r.total)}. Перемещения частей — относительно основания:`] }, { k: 'ul', items }];
    ex(bl, 'Внешних горизонтальных сил нет, и вначале система покоилась, поэтому центр масс по горизонтали не смещается: Σm_i·Δx_i = 0 для абсолютных перемещений. Абсолютное перемещение части — сумма переносного (перемещения основания) и относительного.');
    steps.push({ title: 'Условие: x_C = const', blocks: bl });
  }
  if (pr.unknown < 0) {
    steps.push({
      title: 'Перемещение основания',
      blocks: [{ k: 'eq', lines: [{ c: ['Σm', sub('i'), '(Δx + Δx', sub('i,отн'), ') + m', sub('осн'), 'Δx = 0 → Δx = −Σm', sub('i'), 'Δx', sub('i,отн'), `/M = −${fp(r.moment)}/${f(r.total)} = `, b(f(r.answer))] }] }, { k: 'p', c: [r.answer < 0 ? 'Основание сместится против оси x (влево).' : r.answer > 0 ? 'Основание сместится вдоль оси x (вправо).' : 'Основание останется на месте.'] }],
    });
  } else {
    const p = pr.parts[pr.unknown];
    steps.push({
      title: `Перемещение части ${pr.unknown + 1}, при котором основание стоит`,
      blocks: [{ k: 'eq', lines: [{ c: ['Σm', sub('i'), 'Δx', sub('i'), ' = 0 → Δx', sub(String(pr.unknown + 1)), ` = −${fp(r.moment)}/${f(p.m)} = ${f(r.dx[pr.unknown])};  s = Δx/cos θ = `, b(f(r.answer))] }] }],
    });
  }
  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows: [{ kind: 'main', val: [pr.unknown < 0 ? `Δx осн = ${f(r.answer)}` : `s${pr.unknown + 1} = ${f(r.answer)}`], note: pr.unknown < 0 ? 'перемещение основания' : 'основание неподвижно' }] }] });
  return { steps };
}

export function wheelDoc(pr: WheelProblem, r: WheelResult, opts: { explain?: boolean } = {}): Doc {
  if (!r.ok) return bad(r.errors);
  const ex = exf(opts);
  const steps: Step[] = [];
  const FU = pr.byWeight ? '' : 'Н';
  {
    const items: Inline[][] = [
      [`m = ${pr.byWeight ? `P/g = ${f(pr.m)}/${f(pr.g)} = ` : ''}${f(r.mass)}; P = ${f(r.P)}; r = ${f(pr.r)} м`],
      [`J_C = mρ² = ${f(r.mass)}·${f(r.rhoEff)}² = ${f(r.J)} (${pr.inertia === 'disk' ? 'сплошной диск, ρ² = r²/2' : pr.inertia === 'ring' ? 'масса на ободе, ρ = r' : 'по радиусу инерции'})`],
      [`N = P cos α${pr.T ? ' − T sin β' : ''} = ${f(r.N)} ${FU}`],
    ];
    const bl: Block[] = [{ k: 'p', c: [`Ось x — ${pr.alpha ? `вниз по плоскости, наклонённой под ${f(pr.alpha)}°` : 'вдоль опоры'}; положительное вращение — качение вперёд.`] }, { k: 'ul', items }];
    steps.push({ title: 'Колесо и нормальная реакция', blocks: bl });
  }
  {
    const lines: { num?: boolean; c: Inline[] }[] = [
      { c: ['m', v('a'), sub('C'), ' = P sin α', pr.F ? ' + F' : '', pr.T ? ' + T cos β' : '', ' + F', sub('тр'), ` = ${f(r.Fx)} + F`, sub('тр')] },
      { c: ['J', sub('C'), 'ε = ', pr.M ? 'M' : '', pr.T ? ' + T·e' : '', pr.fk ? ' − δN' : '', ' − F', sub('тр'), `r = ${f(r.Mc)} − F`, sub('тр'), `·${f(pr.r)}`] },
    ];
    const bl: Block[] = [{ k: 'eq', lines }];
    ex(bl, 'Дифференциальные уравнения плоского движения: центр масс движется как точка массы m под действием всех внешних сил, вращение вокруг оси через центр масс — как вокруг неподвижной оси. Сила трения в точке касания — неизвестная.');
    steps.push({ title: 'Уравнения плоского движения', blocks: bl });
  }
  {
    const bl: Block[] = [
      {
        k: 'eq',
        lines: [
          { c: ['Пусть скольжения нет: ', v('a'), sub('C'), ' = εr → ', v('a'), sub('C'), ` = (${f(r.Fx)} + ${fp(r.Mc)}/${f(pr.r)})/(m + J/r²) = ${f(r.rolls ? r.a : (r.Fx + r.Mc / pr.r) / (r.mass + r.J / pr.r ** 2))}`] },
          { c: ['требуемая сила трения F', sub('тр'), ` = m·a − ${fp(r.Fx)} = `, b(`${f(r.FtrRoll)} ${FU}`), `; fN = ${f(pr.f)}·${f(r.N)} = ${f(pr.f * r.N)}`] },
        ],
      },
      r.rolls ? { k: 'badge', tone: 'ok', text: 'колесо катится без скольжения: |F_тр| ≤ fN' } : { k: 'badge', tone: 'warn', text: 'колесо скользит: |F_тр| > fN' },
    ];
    if (!r.rolls)
      bl.push({
        k: 'eq',
        lines: [
          { c: ['F', sub('тр'), ` = ${r.Ftr > 0 ? '+' : '−'}fN = ${f(r.Ftr)};  `, v('a'), sub('C'), ` = (${f(r.Fx)} + ${fp(r.Ftr)})/m = `, b(f(r.a))] },
          { c: ['ε = (', f(r.Mc), ' − F', sub('тр'), 'r)/J = ', b(f(r.eps)), `;  скорость точки касания v − ωr = (a − εr)t = ${f(r.slip)} м/с при t = ${f(pr.t)} с`] },
        ],
      });
    bl.push({ k: 'p', c: [`Наименьший коэффициент трения для качения без скольжения: f_min = |F_тр|/N = ${f(r.fMin)}.`] });
    if (r.limit) bl.push({ k: 'p', c: [`Качение без скольжения возможно при ${r.limit.what === 'tgα' ? 'tg α' : r.limit.what} ≤ `, b(f(r.limit.value)), r.limit.what === 'tgα' ? ` (α ≤ ${f((Math.atan(r.limit.value) * 180) / Math.PI)}°).` : '.'] });
    ex(bl, 'При качении без скольжения точка касания — мгновенный центр скоростей, сила трения — сила сцепления (статическая) и по модулю не больше fN. Если требуемая сила больше, колесо проскальзывает, и трение равно fN.');
    steps.push({ title: 'Качение или скольжение', blocks: bl });
  }
  steps.push({
    title: `Движение из покоя за t = ${f(pr.t)} с`,
    blocks: [{ k: 'eq', lines: [{ c: [v('v'), sub('C'), ` = a·t = ${f(r.v)} м/с;  `, v('x'), sub('C'), ` = at²/2 = ${f(r.x)} м;  ω = εt = ${f(r.w)} рад/с`] }] }],
  });
  const rows: AnswerRow[] = [
    { kind: 'main', val: [v('a'), sub('C'), ` = ${f(r.a)} м/с²`], note: r.rolls ? 'без скольжения' : 'со скольжением' },
    { kind: 'main', val: [`ε = ${f(r.eps)} рад/с²`], note: '' },
    { kind: 'main', val: [`F_тр = ${f(r.Ftr)} ${FU}`], note: 'сила трения' },
  ];
  if (r.limit) rows.push({ kind: 'aux', val: [`${r.limit.what === 'tgα' ? 'tg α' : r.limit.what} ≤ ${f(r.limit.value)}`], note: 'условие качения без скольжения' });
  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows }] });
  return { steps };
}
