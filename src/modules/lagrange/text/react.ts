/** Шаги решения: реакция связей на тело и отрыв (Мещерский §43), программное движение (Яблонский, Д.20). */
import { b, type AnswerRow, type Block, type Inline, type Step } from '../../../shared/doc';
import { fmt } from '../../../shared/format';
import { prettyName, symText, varName } from '../../../shared/sym';
import type { LagProblem, LagSolution } from '../model/lagrange';
import type { ReactSolution } from '../model/react';

const f4 = (x: number) =>
  Math.abs(x) < 1e-12
    ? '0'
    : Math.abs(x) >= 1e-3
      ? fmt(x, Math.max(0, 3 - Math.floor(Math.log10(Math.abs(x)))))
      : x.toExponential(3).replace('.', ',').replace('-', '−');

export function reactSteps(_pr: LagProblem, r: LagSolution, rr: ReactSolution, opts: { explain?: boolean } = {}): { steps: Step[]; rows: AnswerRow[] } {
  const steps: Step[] = [];
  const rows: AnswerRow[] = [];
  const ex = (bl: Block[], ...c: Inline[]) => {
    if (opts.explain) bl.push({ k: 'p', cls: 'explain', c });
  };
  const names = r.ctx.coords;
  const q = (n: string, ord = 0) => varName(prettyName(n), ord);
  const B = rr.body;
  const lab = B?.beta ? (['e', 'n'] as const) : (['x', 'y'] as const);
  const R = (i: 0 | 1): Inline[] => ['R', { t: 'sub', text: lab[i] }];
  if (B) {
    const bl: Block[] = [
      { k: 'p', c: ['Тело массой ', b(symText(B.m) === 'm' ? 'm' : 'm = ' + symText(B.m)), ', центр масс (ось y — вверх):'] },
      { k: 'eq', lines: [{ c: ['x_C = ', symText(B.xC) || '0'] }, { c: ['y_C = ', symText(B.yC) || '0'] }] },
      { k: 'p', c: ['Теорема о движении центра масс: ', b('m·a_C = m·g + R'), ' — R — равнодействующая реакций связей, приложенных к телу:'] },
      {
        k: 'eq',
        lines: [{ c: ['ẍ_C = ', symText(B.ax) || '0'] }, { c: ['ÿ_C = ', symText(B.ay) || '0'] }, { c: ['R_x = m·ẍ_C,   R_y = m·(ÿ_C + g)'] }],
      },
    ];
    if (B.beta)
      bl.push(
        {
          k: 'p',
          c: [
            `Проекции на ось e (угол β = ${symText(B.beta)} с осью x) и ось n, повёрнутую от неё на 90°: R_e = R_x cos β + R_y sin β, R_n = −R_x sin β + R_y cos β:`,
          ],
        },
        { k: 'eq', lines: [{ c: [...R(0), ' = ', symText(B.Re) || '0'] }, { c: [...R(1), ' = ', symText(B.Rn) || '0'] }] },
      );
    else bl.push({ k: 'eq', lines: [{ c: [...R(0), ' = ', symText(B.Re) || '0'] }, { c: [...R(1), ' = ', symText(B.Rn) || '0'] }] });
    if (B.ReQ && B.RnQ) {
      const n = names[0];
      if (B.vel2) {
        const f = B.from ? symText(B.from) || '0' : '';
        const q0 = `${q(n)}₀`;
        bl.push({ k: 'p', c: [`Интеграл энергии при движении из покоя в ${f === q0 ? q0 : `${q0} = ${f}`}: `, b(`${q(n, 1)}² = ${symText(B.vel2)}`), '.'] });
      }
      bl.push({ k: 'p', c: [`Подставляем ${q(n, 2)} из уравнения движения${B.vel2 ? ` и ${q(n, 1)}²` : ''}:`] });
      bl.push({ k: 'eq', lines: [{ c: [b(...R(0), ' = ', symText(B.ReQ) || '0')] }, { c: [b(...R(1), ' = ', symText(B.RnQ) || '0')] }] });
      rows.push(
        { kind: 'main', val: [`R_${lab[0]} = ${symText(B.ReQ) || '0'}`], note: 'реакция' },
        { kind: 'main', val: [`R_${lab[1]} = ${symText(B.RnQ) || '0'}`], note: 'реакция' },
      );
    }
    bl.push({ k: 'p', c: ['В начальный момент: ', ...R(0), ` = ${f4(B.R0[0])} Н, `, ...R(1), ` = ${f4(B.R0[1])} Н.`] });
    if (!B.ReQ) rows.push({ kind: 'aux', val: [`R_${lab[0]} = ${f4(B.R0[0])} Н, R_${lab[1]} = ${f4(B.R0[1])} Н`], note: 'реакция в начальный момент' });
    ex(
      bl,
      'Ускорение центра масс — вторая производная его координат по времени: в него входят обобщённые ускорения и квадраты скоростей. Если у тела одна опора, R — это её реакция; при нескольких опорах R — их сумма.',
    );
    steps.push({ title: 'Реакция связей на тело', blocks: bl });
  }
  const E = rr.event;
  if (E) {
    const bl: Block[] = [];
    const comp = E.comp ? R(E.comp === 'e' ? 0 : 1) : [];
    if (E.kind === 'stop') bl.push({ k: 'p', c: [`${q(names[0])} достигает значения ${f4(E.q[0])} в момент `, b(`t = ${f4(E.t)} с`), '.'] });
    else if (E.kind === 'sep')
      bl.push({
        k: 'p',
        c: ['Проекция ', ...comp, ' меняет знак в момент ', b(`t = ${f4(E.t)} с`), ' — односторонняя связь больше не удерживает тело: отрыв.'],
      });
    else bl.push({ k: 'p', c: ['Проекция ', ...comp, ' обращается в нуль, касаясь нуля, в момент ', b(`t = ${f4(E.t)} с`), ' — тело отрывается от опоры.'] });
    const items: Inline[][] = names.map((n, i) => [`${q(n)} = `, b(f4(E.q[i])), `,  ${q(n, 1)} = `, b(f4(E.v[i]))]);
    if (E.C && E.vC) items.push([`центр масс: (${f4(E.C[0])}; ${f4(E.C[1])}), скорость (${f4(E.vC[0])}; ${f4(E.vC[1])}) м/с`]);
    if (E.omega != null) items.push(['угловая скорость тела ω = ', b(`${f4(E.omega)} рад/с`)]);
    bl.push({ k: 'ul', items });
    rows.push({
      kind: 'main',
      val: [names.map((n, i) => `${q(n)} = ${f4(E.q[i])}, ${q(n, 1)} = ${f4(E.v[i])}`).join('; ')],
      note: E.kind === 'stop' ? `в момент t = ${f4(E.t)} с` : `в момент отрыва t = ${f4(E.t)} с`,
    });
    if (E.omega != null) rows.push({ kind: 'aux', val: [`ω = ${f4(E.omega)} рад/с`], note: 'угловая скорость тела' });
    const F = rr.flight;
    if (F) {
      bl.push({ k: 'p', c: ['Дальше тело свободно: на него действует только сила тяжести — центр масс движется по параболе, угловая скорость постоянна.'] });
      if (F.parabola) {
        const P = F.parabola;
        const bt = Math.abs(P.b) < 1e-9 * Math.max(1, Math.abs(P.a)) ? '' : ` ${P.b < 0 ? '−' : '+'} ${f4(Math.abs(P.b))}·x_C`;
        const t = `y_C = ${f4(P.a)}${bt} − ${f4(Math.abs(P.c))}·x_C²`;
        bl.push({ k: 'eq', lines: [{ c: ['y_C = y₀ + (v_y/v_x)(x_C − x₀) − g(x_C − x₀)²/(2v_x²)'] }, { num: true, c: [b(t)] }] });
        rows.push({ kind: 'main', val: [t], note: 'траектория центра масс' });
      } else bl.push({ k: 'p', c: ['Горизонтальной скорости нет — центр масс движется по вертикали.'] });
    }
    ex(bl, 'Момент находится по численному решению уравнений Лагранжа и уточняется делением шага пополам.');
    steps.push({ title: E.kind === 'stop' ? 'Состояние в заданном положении' : 'Отрыв', blocks: bl });
  }
  const P = rr.program;
  if (P) {
    const bl: Block[] = [
      { k: 'p', c: ['Заданы законы движения (программа):'] },
      { k: 'eq', lines: names.map((n, i) => ({ c: [`${q(n)}(t) = `, symText(P.laws[i]) || '0'] })) },
      { k: 'p', c: ['Обобщённые силы, которые осуществляют это движение, — левые части уравнений Лагранжа: ', b('Qⱼ = d/dt(∂T/∂q̇ⱼ) − ∂T/∂qⱼ + ∂Π/∂qⱼ'), ':'] },
      { k: 'eq', lines: names.map((n, i) => ({ c: ['Q', { t: 'sub', text: prettyName(n) }, ' = ', symText(P.Q[i]) || '0'] })) },
      { k: 'p', c: [`В момент t* = ${f4(P.at)} с:`] },
      { k: 'ul', items: names.map((n, i) => [`${q(n)} = ${f4(P.qAt[i])},  ${q(n, 1)} = ${f4(P.vAt[i])},  ${q(n, 2)} = ${f4(P.aAt[i])}`]) },
      { k: 'eq', lines: names.map((n, i) => ({ num: true, c: [b(`Q_${prettyName(n)} = ${f4(P.Qat[i])}`)] })) },
    ];
    ex(bl, 'Обратная задача динамики: движение задано, ищутся силы. Сила по координате-углу — момент (Н·м), по линейной координате — сила (Н).');
    steps.push({ title: 'Программное движение: обобщённые силы', blocks: bl });
    names.forEach((n, i) => rows.push({ kind: 'main', val: [`Q_${prettyName(n)} = ${f4(P.Qat[i])}`], note: `обобщённая сила при t = ${f4(P.at)} с` }));
  }
  return { steps, rows };
}
