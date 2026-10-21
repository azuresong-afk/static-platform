/**
 * Решение «подбор сечения»: исходные данные, требуемый момент сопротивления, прямоугольник, круг, двутавр,
 * сравнение по расходу материала, проверка по касательным напряжениям, ответ.
 */
import { forceNames, type Conventions } from '../../../shared/conventions';
import { sub, sym, v, type Block, type Doc, type Inline, type Step } from '../../../shared/doc';
import { fmt } from '../../../shared/format';
import type { Design } from '../model/design';

export interface SectionsTextInput {
  d: Design;
  M: number;
  Q: number;
  /** Откуда взяты M и Q: «в точке D» и т. п.; null — заданы вручную. */
  where: { M: string; Q: string } | null;
  sigma: number;
  sigmaT?: { sT: number; n: number };
  tau: number;
  k: number;
  overload: number;
  explain?: boolean;
}

const f = (x: number, d = 2) => fmt(x, d);
const mm = (cm: number) => fmt(cm * 10, 1);
const ok = (x: number, lim: number): Inline[] => (x <= lim + 1e-9 ? [' ≤ ', f(lim), ' МПа — условие выполнено'] : [' > ', f(lim), ' МПа — условие не выполнено']);

export function sectionsDoc(inp: SectionsTextInput, c: Conventions): Doc {
  const { d } = inp;
  const names = forceNames(c);
  const ix = names.M.S; // индекс оси изгиба: Wx, Ix — или без индекса
  const W = sym({ L: 'W', S: ix }),
    I = sym({ L: 'I', S: ix }),
    S = sym({ L: 'S', S: ix });
  const Mm = sym(names.M),
    Qm = sym(names.Q);
  const sg: Inline = v('σ'),
    ta: Inline = v('τ');
  const steps: Step[] = [];
  const ex = (bl: Block[], ...c2: Inline[]) => {
    if (inp.explain) bl.push({ k: 'p', cls: 'explain', c: c2 });
  };

  // 1. Исходные данные.
  {
    const bl: Block[] = [
      {
        k: 'ul',
        items: [
          ['|', Mm, '|', sub('max'), ' = ', f(Math.abs(inp.M), 3), ' кН·м', inp.where ? ` (${inp.where.M})` : ''],
          ['|', Qm, '|', sub('max'), ' = ', f(Math.abs(inp.Q), 3), ' кН', inp.where ? ` (${inp.where.Q})` : ''],
          inp.sigmaT
            ? ['[', sg, '] = ', sg, sub('т'), '/', v('n'), ' = ', f(inp.sigmaT.sT), '/', f(inp.sigmaT.n), ' = ', f(inp.sigma), ' МПа']
            : ['[', sg, '] = ', f(inp.sigma), ' МПа'],
          ['[', ta, '] = ', f(inp.tau), ' МПа'],
        ],
      },
    ];
    ex(
      bl,
      inp.where
        ? 'Наибольшие по модулю момент и поперечная сила взяты с эпюр во вкладке «Изгиб». Сечение, где момент наибольший, — опасное: по нему и подбирают размеры.'
        : 'Момент и поперечная сила заданы вручную. Нагрузки — в кН и кН·м, как на чертеже.',
    );
    steps.push({ title: 'Исходные данные', blocks: bl });
  }

  // 2. Требуемый момент сопротивления.
  {
    const bl: Block[] = [
      {
        k: 'eq',
        lines: [
          { c: [sg, sub('max'), ' = |', Mm, '|', sub('max'), '/', W, ' ≤ [', sg, ']  ⇒  ', W, ' ≥ |', Mm, '|', sub('max'), '/[', sg, ']'] },
          { num: true, c: ['= ', f(Math.abs(inp.M), 3), '·10³ Н·м / (', f(inp.sigma), '·10⁶ Па) = ', f(d.Wreq), '·10⁻⁶ м³ = ', f(d.Wreq), ' см³'] },
        ],
      },
    ];
    ex(
      bl,
      'Наибольшие нормальные напряжения — в волокнах, дальше всего отстоящих от нейтральной оси: ',
      sg,
      ' = ',
      Mm,
      '·',
      v('y'),
      sub('max'),
      '/',
      I,
      ' = ',
      Mm,
      '/',
      W,
      '. Момент сопротивления ',
      W,
      ' = ',
      I,
      '/',
      v('y'),
      sub('max'),
      ' зависит только от формы и размеров сечения, поэтому условие прочности сразу даёт требуемый ',
      W,
      '.',
    );
    steps.push({ title: 'Требуемый момент сопротивления', blocks: bl });
  }

  // 3. Прямоугольник.
  {
    const r = d.rect;
    const k = inp.k;
    const bl: Block[] = [
      {
        k: 'eq',
        lines: [
          { c: [v('h'), ' = ', f(k), '·', v('b'), ';  ', W, ' = ', v('b'), '·', v('h'), { t: 'sup', text: '2' }, '/6 = ', f(k * k, 3), '·', v('b'), { t: 'sup', text: '3' }, '/6'] },
          { c: [v('b'), ' ≥ ∛(6·', W, '/', f(k * k, 3), ') = ∛(6·', f(d.Wreq), '/', f(k * k, 3), ') = ', f(r.bCalc, 3), ' см'] },
        ],
      },
      {
        k: 'p',
        c: [
          'Принимаем ',
          v('b'),
          ' = ',
          mm(r.b),
          ' мм, ',
          v('h'),
          ' = ',
          mm(r.h),
          ' мм. ',
          v('A'),
          ' = ',
          v('b'),
          '·',
          v('h'),
          ' = ',
          f(r.A),
          ' см²; ',
          W,
          ' = ',
          f(r.W),
          ' см³; ',
          sg,
          ' = ',
          f(r.sigma),
          ' МПа.',
        ],
      },
    ];
    ex(bl, 'Размеры округляем вверх до целого миллиметра, чтобы сечение не стало слабее требуемого.');
    steps.push({ title: `Прямоугольник, h = ${f(k)}·b`, blocks: bl });
  }

  // 4. Круг.
  {
    const r = d.circle;
    const bl: Block[] = [
      {
        k: 'eq',
        lines: [
          { c: [W, ' = π·', v('d'), { t: 'sup', text: '3' }, '/32 ≈ 0,1·', v('d'), { t: 'sup', text: '3' }] },
          { c: [v('d'), ' ≥ ∛(32·', W, '/π) = ∛(32·', f(d.Wreq), '/π) = ', f(r.dCalc, 3), ' см'] },
        ],
      },
      { k: 'p', c: ['Принимаем ', v('d'), ' = ', mm(r.d), ' мм. ', v('A'), ' = π·', v('d'), { t: 'sup', text: '2' }, '/4 = ', f(r.A), ' см²; ', W, ' = ', f(r.W), ' см³; ', sg, ' = ', f(r.sigma), ' МПа.'] },
    ];
    ex(bl, 'Считаем по точной формуле π·d³/32; в учебниках часто пишут приближённо 0,1·d³ — разница около 2 %.');
    steps.push({ title: 'Круг', blocks: bl });
  }

  // 5. Двутавр.
  {
    const bl: Block[] = [];
    const lim = inp.sigma * (1 + inp.overload / 100);
    if (d.ibeam) {
      const { p, prev } = d.ibeam;
      bl.push({
        k: 'p',
        c: [
          'По сортаменту (ГОСТ 8239-89) подходит двутавр ',
          { t: 'b', c: ['№', p.no] },
          ': ',
          W,
          ' = ',
          f(p.Wx, 1),
          ' см³ ≥ ',
          f(d.Wreq),
          ' см³',
          inp.overload ? ` (с учётом перенапряжения до ${f(inp.overload, 1)} %)` : '',
          '; ',
          v('A'),
          ' = ',
          f(p.A, 1),
          ' см², масса ',
          f(p.m, 1),
          ' кг/м.',
        ],
      });
      bl.push({ k: 'p', c: [sg, ' = ', f(Math.abs(inp.M), 3), '·10³/', f(p.Wx, 1), ' = ', f(d.ibeam.sigma), ' МПа', ...ok(d.ibeam.sigma, lim), '.'] });
      if (prev)
        bl.push({
          k: 'p',
          c: ['Меньший двутавр №', prev.no, ' (', W, ' = ', f(prev.Wx, 1), ' см³) не подходит: ', sg, ' = ', f((Math.abs(inp.M) * 1e3) / prev.Wx), ' МПа > ', f(lim), ' МПа.'],
        });
    } else bl.push({ k: 'p', c: ['Двутавра по ГОСТ 8239-89 не хватает: даже у №60 ', W, ' = 2560 см³ < ', f(d.Wreq), ' см³. Нужно составное сечение или двутавр по другому сортаменту.'] });
    ex(bl, 'Двутавр выбираем по таблице: наименьший номер, у которого момент сопротивления не меньше требуемого. ', inp.overload ? 'Перенапряжение до указанного процента допускается правилами вашего курса.' : 'Перенапряжение не допускается (его можно разрешить в исходных данных, если так принято в вашем курсе).');
    steps.push({ title: 'Двутавр', blocks: bl });
  }

  // 6. Сравнение.
  {
    const rows: [string, number][] = [
      ['прямоугольник', d.rect.A],
      ['круг', d.circle.A],
    ];
    if (d.ibeam) rows.push([`двутавр №${d.ibeam.p.no}`, d.ibeam.A]);
    const min = Math.min(...rows.map((r) => r[1]));
    const bl: Block[] = [
      {
        k: 'answer',
        rows: rows.map(([n, A]) => ({ kind: A === min ? 'main' : 'aux', val: [v('A'), ' = ', f(A), ' см²'], note: n + (A === min ? ' — наименьший расход материала' : ` — в ${f(A / min, 2)} раза тяжелее`) })),
      },
    ];
    ex(
      bl,
      'Масса балки пропорциональна площади сечения. Двутавр выгоднее всего: материал собран в полках, далеко от нейтральной оси, где напряжения наибольшие, а у нейтральной оси, где материал почти не работает, осталась тонкая стенка.',
    );
    steps.push({ title: 'Сравнение сечений по расходу материала', blocks: bl });
  }

  // 7. Касательные напряжения.
  {
    const Q = Math.abs(inp.Q);
    const items: Inline[][] = [
      ['прямоугольник: ', ta, sub('max'), ' = 3/2·', Qm, '/', v('A'), ' = 1,5·', f(Q, 3), '·10³/(', f(d.rect.A), '·10⁻⁴) = ', f(d.rect.tau), ' МПа', ...ok(d.rect.tau, inp.tau)],
      ['круг: ', ta, sub('max'), ' = 4/3·', Qm, '/', v('A'), ' = ', f(d.circle.tau), ' МПа', ...ok(d.circle.tau, inp.tau)],
    ];
    if (d.ibeam) {
      const p = d.ibeam.p;
      items.push([
        `двутавр №${p.no}: `,
        ta,
        sub('max'),
        ' = ',
        Qm,
        '·',
        S,
        '/(',
        I,
        '·',
        v('s'),
        ') = ',
        f(Q, 3),
        '·10³·',
        f(p.Sx, 1),
        '·10⁻⁶/(',
        f(p.Ix, 0),
        '·10⁻⁸·',
        f(p.s, 1),
        '·10⁻³) = ',
        f(d.ibeam.tau),
        ' МПа',
        ...ok(d.ibeam.tau, inp.tau),
      ]);
    }
    const bl: Block[] = [{ k: 'p', c: ['По формуле Журавского ', ta, ' = ', Qm, '·', S, sub('отс'), '/(', I, '·', v('b'), '); наибольшее — на нейтральной оси, в сечении с |', Qm, '|', sub('max'), ':'] }, { k: 'ul', items }];
    ex(bl, 'Для двутавра ', S, ' — статический момент половины сечения, ', v('s'), ' — толщина стенки (из сортамента). Обычно касательные напряжения намного меньше допускаемых — определяющими оказываются нормальные.');
    steps.push({ title: 'Проверка по касательным напряжениям', blocks: bl });
  }

  // 8. Ответ.
  {
    const bestName = d.best === 'ibeam' && d.ibeam ? `двутавр №${d.ibeam.p.no}` : d.best === 'rect' ? 'прямоугольник' : 'круг';
    const rows: { kind: 'main' | 'aux'; val: Inline[]; note: string }[] = [
      { kind: d.best === 'rect' ? 'main' : 'aux', val: ['прямоугольник ', mm(d.rect.b), '×', mm(d.rect.h), ' мм'], note: `A = ${f(d.rect.A)} см²` },
      { kind: d.best === 'circle' ? 'main' : 'aux', val: ['круг ⌀', mm(d.circle.d), ' мм'], note: `A = ${f(d.circle.A)} см²` },
    ];
    if (d.ibeam) rows.push({ kind: d.best === 'ibeam' ? 'main' : 'aux', val: ['двутавр №', d.ibeam.p.no], note: `A = ${f(d.ibeam.A, 1)} см²` });
    const allTau = [d.rect, d.circle, ...(d.ibeam ? [d.ibeam] : [])].every((s) => s.tauOk);
    steps.push({
      title: 'Ответ',
      blocks: [
        { k: 'answer', rows },
        { k: 'p', c: ['Оптимальное сечение — ', { t: 'b', c: [bestName] }, '. ', allTau ? 'Условие прочности по касательным напряжениям выполняется для всех сечений.' : 'Внимание: условие по касательным напряжениям выполняется не для всех сечений — см. проверку.'] },
      ],
    });
  }
  return { steps };
}
