/**
 * Решение задачи о ступенчатом брусе в стиле Антонова (гл. 3; задачи 1.1, 1.2): раскрытие статической
 * неопределимости методом сил, продольные силы по участкам, площадь из условия прочности, напряжения,
 * деформации, перемещения, проверки, ответ.
 */
import { b as bold, join, sub, v, type Block, type Doc, type Inline, type Step } from '../../../shared/doc';
import { fmt } from '../../../shared/format';
import { roman } from '../../frames/model/geometry';
import { heldBySupport, type Bar, type BarSolution } from '../model/bar';
import { pointName } from '../draw/bar';

const f = (x: number, d = 3) => fmt(x, d);
const sgn = (x: number, first: boolean): Inline[] => (first ? [x < 0 ? '−' : ''] : [x < 0 ? ' − ' : ' + ']);
const Fs = (j: number): Inline[] => [v('F'), sub(pointName(j))];
const Rs = (j: number): Inline[] => [v('R'), sub(pointName(j))];
const Nn = (i: number): Inline[] => [v('N'), sub(roman(i))];
const An = (i: number): Inline[] => [v('A'), sub(roman(i))];
const cA = (c: number): string => (Math.abs(c - 1) < 1e-12 ? 'A' : `${f(c, 2)}A`);

export function axialDoc(b: Bar, sol: BarSolution, opts: { explain?: boolean } = {}): Doc {
  const n = b.steps.length;
  const steps: Step[] = [];
  const ex = (bl: Block[], ...c: Inline[]) => {
    if (opts.explain) bl.push({ k: 'p', cls: 'explain', c });
  };
  const loads = b.forces.map((F, j) => ({ F, j })).filter((x) => x.F && !heldBySupport(b, x.j));
  const find = b.areaMode === 'find';

  // 1. Дано.
  {
    const items: Inline[][] = b.steps.map((s, i) => [
      `участок ${roman(i)} (${pointName(i)}–${pointName(i + 1)}): `,
      v('l'),
      ' = ',
      f(s.l),
      ' м, ',
      ...An(i),
      ' = ',
      cA(s.c),
      s.dT ? `, нагрев ΔT = ${s.dT > 0 ? '+' : '−'}${f(Math.abs(s.dT), 1)} К` : '',
    ]);
    items.push(loads.length ? ['силы: ', ...join(loads.map((x) => [...Fs(x.j), ` = ${f(Math.abs(x.F))} кН ${x.F > 0 ? 'вправо' : 'влево'}`]), '; ')] : ['сосредоточенных сил нет']);
    items.push([b.supports === 'both' ? `заделки в точках ${pointName(0)} и ${pointName(n)}` : `заделка в точке ${pointName(b.supports === 'left' ? 0 : n)}`]);
    items.push([v('E'), ` = ${f(b.E, 0)} МПа`, ...(b.steps.some((s) => s.dT) ? [', ', v('α'), ` = ${f(b.alpha * 1e6, 3)}·10⁻⁶ 1/К`] : []), ', [σ] = ', f(b.sigmaAllow, 1), ' МПа', ...(b.sigmaT > 0 ? [', ', v('σ'), sub('т'), ' = ', f(b.sigmaT, 1), ' МПа'] : [])]);
    if (!find) items.push([v('A'), ` = ${f(b.A)} см²`]);
    const bl: Block[] = [{ k: 'ul', items }];
    ex(bl, 'Ось ', v('z'), ' направлена вдоль бруса слева направо. Продольная сила ', v('N'), ' положительна при растяжении. Силы — в кН, длины — в м, площади — в см², напряжения — в МПа.');
    steps.push({ title: 'Дано', blocks: bl });
  }

  // 2. Статическая неопределимость (обе заделки).
  if (b.supports === 'both' && sol.indet) {
    const { N0, flex } = sol.indet;
    const bl: Block[] = [
      {
        k: 'p',
        c: ['Неизвестных реакций две (', ...Rs(0), ', ', ...Rs(n), '), уравнение равновесия одно: ', ...Rs(0), ' + ', ...Rs(n), ' + Σ', v('F'), ' = 0. Брус ', bold('один раз статически неопределим'), '.'],
      },
      {
        k: 'p',
        c: [
          'Отбрасываем правую заделку и заменяем её реакцией ',
          ...Rs(n),
          ' (эквивалентная система). Сечение ',
          pointName(n),
          ' перемещаться не может — уравнение совместности деформаций:',
        ],
      },
      {
        k: 'eq',
        lines: [
          { c: ['Δ', sub(pointName(n)), ' = Σ ', v('N'), sub('i'), '·', v('l'), sub('i'), '/(', v('E'), '·', v('A'), sub('i'), ') + Σ ', v('α'), '·Δ', v('T'), sub('i'), '·', v('l'), sub('i'), ' = 0,  ', v('N'), sub('i'), ' = ', v('N'), sub('i'), '⁰ + ', ...Rs(n)] },
          { num: true, c: ['где ', v('N'), '⁰ — силы в эквивалентной системе без ', ...Rs(n), ': ', ...join(N0.map((x, i) => [...Nn(i), '⁰ = ', f(x)]), '; ')] },
        ],
      },
    ];
    const areaTxt = find ? 'A' : `${f(sol.A)} см²`;
    bl.push({
      k: 'eq',
      lines: [
        {
          c: [
            ...Rs(n),
            ' = −(Σ ',
            v('N'),
            sub('i'),
            '⁰·',
            v('l'),
            sub('i'),
            '/(',
            v('E'),
            '·',
            v('c'),
            sub('i'),
            ') + Σ ',
            v('α'),
            '·Δ',
            v('T'),
            sub('i'),
            '·',
            v('l'),
            sub('i'),
            '·',
            v('A'),
            '/10) / Σ ',
            v('l'),
            sub('i'),
            '/(',
            v('E'),
            '·',
            v('c'),
            sub('i'),
            ')',
          ],
        },
        { num: true, c: ['= ', f(sol.RB as number), ' кН', sol.indet.heat ? ` (при A = ${areaTxt})` : ''] },
      ],
    });
    bl.push({ k: 'p', c: ['Из уравнения равновесия ', ...Rs(0), ' = −(', ...Rs(n), ' + Σ', v('F'), ') = ', f(sol.RA as number), ' кН.'] });
    ex(bl, 'Реакции приняты направленными вправо (по оси ', v('z'), ') и входят в формулы со своим знаком: «−» означает, что реакция на самом деле направлена влево. Силы в формулах — по модулю, их направление учтено знаком перед ними.');
    ex(
      bl,
      'Площадь участка ',
      v('i'),
      ' — ',
      v('c'),
      sub('i'),
      '·',
      v('A'),
      ', поэтому в удлинения от сил площадь ',
      v('A'),
      ' входит общим множителем и без нагрева сокращается: усилия зависят только от соотношения жёсткостей. Нагрев даёт удлинение ',
      v('α'),
      '·Δ',
      v('T'),
      '·',
      v('l'),
      ', не зависящее от площади, поэтому температурные усилия пропорциональны ',
      v('A'),
      '. Множитель 10 переводит кН/см² в МПа. Податливость Σ l/(E·c) = ',
      f(flex * 1e6, 4),
      '·10⁻⁶.',
    );
    steps.push({ title: 'Раскрываем статическую неопределимость', blocks: bl });
  } else {
    const j = b.supports === 'left' ? 0 : n;
    const R = b.supports === 'left' ? sol.RA : sol.RB;
    steps.push({
      title: 'Реакция заделки',
      blocks: [{ k: 'p', c: ['Из уравнения равновесия ΣF', sub('z'), ' = 0: ', ...Rs(j), ' = −Σ', v('F'), ' = ', f(R as number), ' кН', (R as number) < 0 ? ' (направлена влево).' : (R as number) > 0 ? ' (направлена вправо).' : '.'] }],
    });
  }

  // 3. Продольные силы.
  {
    const lines: { num?: boolean; c: Inline[] }[] = [];
    sol.steps.forEach((s, i) => {
      const parts: Inline[] = [];
      if (b.supports === 'right') {
        // Левая часть: сила влево — растяжение.
        b.forces.forEach((F, j) => {
          if (j <= i && F) parts.push(...sgn(-F, !parts.length), ...Fs(j));
        });
      } else {
        b.forces.forEach((F, j) => {
          if (j > i && F) parts.push(...sgn(F, !parts.length), ...Fs(j));
        });
        if (b.supports === 'both') parts.push(...sgn(1, !parts.length), ...Rs(n));
      }
      lines.push({ c: [...Nn(i), ' = ', ...(parts.length ? [...parts, ' = '] : []), f(s.N), ' кН', s.N > 1e-9 ? ' (растяжение)' : s.N < -1e-9 ? ' (сжатие)' : ''] });
    });
    const bl: Block[] = [{ k: 'eq', lines }];
    ex(
      bl,
      b.supports === 'right'
        ? 'Рассматриваем часть бруса левее сечения: сила, направленная влево, растягивает участок и входит со знаком «+».'
        : 'Рассматриваем часть бруса правее сечения: сила, направленная вправо, растягивает участок и входит со знаком «+». Реакция заделки в эту часть не попадает — её не нужно знать заранее.',
    );
    steps.push({ title: 'Продольные силы по участкам (метод сечений)', blocks: bl });
  }

  // 4. Площадь A из условия прочности.
  if (find) {
    const ratios = sol.steps.map((s, i) => Math.abs(s.N) / b.steps[i].c);
    const k = ratios.indexOf(Math.max(...ratios));
    const bl: Block[] = [
      { k: 'p', c: ['Напряжения через неизвестную площадь: ', ...join(sol.steps.map((s, i) => [v('σ'), sub(roman(i)), ' = ', f(s.N), '/(', cA(b.steps[i].c), ')']), ';  '), ' (кН/см²).'] },
      {
        k: 'eq',
        lines: [
          { c: [v('σ'), sub('max'), ' = |', ...Nn(k), '|/', An(k)[0], An(k)[1], ' ≤ [σ]  ⇒  ', v('A'), ' ≥ |', ...Nn(k), '|/(', f(b.steps[k].c, 2), '·[σ])'] },
          { num: true, c: ['= ', f(Math.abs(sol.steps[k].N)), '·10/(', f(b.steps[k].c, 2), '·', f(b.sigmaAllow, 1), ') = ', f(sol.A), ' см²'] },
        ],
      },
    ];
    ex(bl, 'Опасен участок, где отношение |N|/c наибольшее. Множитель 10 переводит кН/см² в МПа (1 кН/см² = 10 МПа).');
    steps.push({ title: 'Площадь из условия прочности', blocks: bl });
  }

  // 5. Напряжения.
  {
    const lines = sol.steps.map((s, i) => ({ c: [v('σ'), sub(roman(i)), ' = ', ...Nn(i), '/', ...An(i), ' = ', f(s.N), '·10/', f(s.A), ' = ', f(s.sigma, 2), ' МПа'] as Inline[] }));
    const smax = Math.abs(sol.sigmaMax.v);
    const bl: Block[] = [
      { k: 'eq', lines },
      {
        k: 'p',
        c: [
          '|σ|',
          sub('max'),
          ' = ',
          f(smax, 2),
          ' МПа на участке ',
          roman(sol.sigmaMax.i),
          smax <= b.sigmaAllow + 1e-9 ? ` ≤ [σ] = ${f(b.sigmaAllow, 1)} МПа — прочность обеспечена.` : ` > [σ] = ${f(b.sigmaAllow, 1)} МПа — прочность не обеспечена.`,
          ...(sol.nT ? [' Запас по пределу текучести ', v('n'), ' = ', v('σ'), sub('т'), '/|σ|', sub('max'), ' = ', f(b.sigmaT, 1), '/', f(smax, 2), ' = ', f(sol.nT, 2), '.'] : []),
        ],
      },
    ];
    steps.push({ title: 'Нормальные напряжения', blocks: bl });
  }

  // 6. Деформации.
  {
    const lines = sol.steps.map((s, i) => {
      const heat = Math.abs(s.epsT) > 0;
      return {
        c: [
          v('ε'),
          sub(roman(i)),
          ' = σ/',
          v('E'),
          ...(heat ? [' + ', v('α'), '·Δ', v('T')] : []),
          ' = ',
          f(s.sigma, 2),
          '/',
          f(b.E, 0),
          ...(heat ? [' + ', f(s.epsT * 1e4, 3), '·10⁻⁴'] : []),
          ' = ',
          f((s.epsSigma + s.epsT) * 1e4, 3),
          '·10⁻⁴',
        ] as Inline[],
      };
    });
    const bl: Block[] = [{ k: 'eq', lines }];
    ex(bl, 'По закону Гука ε = σ/E; на нагретом участке к ней добавляется температурная деформация α·ΔT.');
    steps.push({ title: 'Относительные деформации', blocks: bl });
  }

  // 7. Перемещения.
  {
    const lines: { num?: boolean; c: Inline[] }[] = [];
    const Dl = (i: number): Inline[] => ['Δ', v('l'), sub(roman(i))];
    sol.steps.forEach((s, i) => lines.push({ c: [...Dl(i), ' = ε', sub(roman(i)), '·', v('l'), sub(roman(i)), ' = ', f((s.epsSigma + s.epsT) * 1e4, 3), '·10⁻⁴·', f(s.z1 - s.z0), '·10³ = ', f(s.dl, 4), ' мм'] }));
    const pts: Inline[][] = [];
    const u = [sol.steps[0].u0, ...sol.steps.map((s) => s.u1)];
    if (b.supports === 'right') {
      pts.push(['Δ', sub(pointName(n)), ' = 0 (заделка)']);
      for (let i = n - 1; i >= 0; i--) pts.push(['Δ', sub(pointName(i)), ' = Δ', sub(pointName(i + 1)), ' − ', ...Dl(i), ' = ', f(u[i], 4), ' мм']);
    } else {
      pts.push(['Δ', sub(pointName(0)), ' = 0 (заделка)']);
      for (let i = 1; i <= n; i++) pts.push(['Δ', sub(pointName(i)), ' = Δ', sub(pointName(i - 1)), ' + ', ...Dl(i - 1), ' = ', f(u[i], 4), ' мм', i === n && b.supports === 'both' ? ' — сечение в заделке не смещается, проверка выполнена' : '']);
    }
    const bl: Block[] = [{ k: 'eq', lines }, { k: 'ul', items: pts }];
    ex(bl, 'Перемещение сечения равно сумме удлинений участков между ним и заделкой. Внутри участка оно меняется линейно, «+» — вправо.');
    steps.push({ title: 'Удлинения участков и перемещения сечений', blocks: bl });
  }

  // 8. Проверки.
  {
    const items: Inline[][] = [];
    const sumF = b.forces.reduce((a, x) => a + x, 0);
    items.push(['ΣF', sub('z'), ' = ', ...(sol.RA !== null ? [...Rs(0), ' + '] : []), ...(sol.RB !== null ? [...Rs(n), ' + '] : []), 'Σ', v('F'), ' = ', f((sol.RA ?? 0) + (sol.RB ?? 0) + sumF, 6), ' — равновесие выполнено']);
    for (let j = 1; j < n; j++)
      if (b.forces[j]) items.push(['в точке ', pointName(j), ' скачок ', v('N'), ': ', f(sol.steps[j - 1].N), ' → ', f(sol.steps[j].N), ' — на величину силы ', ...Fs(j), ' = ', f(Math.abs(b.forces[j]))]);
    steps.push({ title: 'Проверки', blocks: [{ k: 'ul', items }] });
  }

  // 9. Ответ.
  {
    const rows: { kind: 'main' | 'aux'; val: Inline[]; note: string }[] = [];
    if (find) rows.push({ kind: 'main', val: [v('A'), ' = ', f(sol.A), ' см²'], note: 'из условия прочности' });
    rows.push({ kind: 'main', val: ['|σ|', sub('max'), ' = ', f(Math.abs(sol.sigmaMax.v), 2), ' МПа'], note: `участок ${roman(sol.sigmaMax.i)}` });
    if (sol.nT) rows.push({ kind: 'main', val: [v('n'), ' = ', f(sol.nT, 2)], note: 'запас по пределу текучести' });
    const zi = sol.uMax.z;
    const k = [0, ...sol.steps.map((s) => s.z1)].findIndex((z) => Math.abs(z - zi) < 1e-12);
    rows.push({ kind: 'aux', val: ['|Δ|', sub('max'), ' = ', f(Math.abs(sol.uMax.v), 4), ' мм'], note: k >= 0 ? `сечение ${pointName(k)}` : '' });
    steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows }] });
  }
  return { steps };
}
