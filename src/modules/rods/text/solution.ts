/** Решение задачи о стержневой системе: неопределимость, равновесие, совместность деформаций, закон Гука, прочность. */
import { b, sub, v, type AnswerRow, type Block, type Doc, type Inline, type Step } from '../../../shared/doc';
import { fmt } from '../../../shared/format';
import type { RodProblem, RodResult } from '../model/rods';

/** Число с четырьмя значащими цифрами. */
export function f(x: number): string {
  if (!isFinite(x)) return '—';
  if (Math.abs(x) < 1e-12) return '0';
  const e = Math.floor(Math.log10(Math.abs(x)));
  return fmt(x, Math.min(12, Math.max(2, 3 - e)));
}
const SUBD = '₀₁₂₃₄₅₆₇₈₉';
const idx = (n: number) => String(n).replace(/\d/g, (d) => SUBD[+d]);
const letter = (j: number) => 'ABCDEFGH'[j] ?? `S${j + 1}`;
const cl = (x: number) => (Math.abs(x) < 1e-12 ? 0 : x);

/** Слагаемое «± a·X» для уравнения. */
function term(a: number, name: string, first: boolean): string {
  const s = a < 0 ? (first ? '−' : ' − ') : first ? '' : ' + ';
  const m = Math.abs(a);
  return `${s}${Math.abs(m - 1) < 1e-12 ? '' : `${f(m)}·`}${name}`;
}
function sum(parts: [number, string][], tail: number): string {
  const nz = parts.filter(([a]) => Math.abs(a) > 1e-12);
  let s = nz.map(([a, n], i) => term(a, n, i === 0)).join('');
  if (Math.abs(tail) > 1e-12) s += `${tail < 0 ? (s ? ' − ' : '−') : s ? ' + ' : ''}${f(Math.abs(tail))}`;
  return (s || '0') + ' = 0';
}

export function rodsDoc(pr: RodProblem, r: RodResult, opts: { explain?: boolean } = {}): Doc {
  const steps: Step[] = [];
  const ex = (bl: Block[], ...c: Inline[]) => {
    if (opts.explain) bl.push({ k: 'p', cls: 'explain', c });
  };
  if (!r.ok || !r.base) {
    steps.push({
      title: 'Данные',
      blocks: [
        { k: 'badge', tone: 'bad', text: 'проверьте данные' },
        { k: 'ul', items: r.errors.map((x) => [x]) },
      ],
    });
    return { steps };
  }
  const bar = pr.body === 'bar';
  const base = r.base;
  const Nn = (i: number) => `N${idx(i + 1)}`;
  const design = pr.ask === 'design';

  // 1. Неизвестные и степень неопределимости.
  {
    const uNames: Inline[][] = [
      ...pr.rods.map((_, i): Inline[] => [v('N'), sub(String(i + 1))]),
      ...base.reactions.map((R): Inline[] => [v(R.dir === 'r' ? 'R' : R.dir === 'x' ? 'X' : 'Y'), sub(letter(R.support))]),
    ];
    const uList: Inline[] = uNames.flatMap((x, i) => (i ? [', ', ...x] : x));
    const eqTxt = bar
      ? r.collinear
        ? `${r.equations}`
        : 'три (ΣX = 0, ΣY = 0, ΣM = 0)'
      : r.collinear
        ? 'одно (все стержни на одной прямой)'
        : 'два (ΣX = 0, ΣY = 0)';
    const bl: Block[] = [
      { k: 'p', c: [`Неизвестные усилия (${r.unknowns}): `, ...uList, `. Независимых уравнений равновесия ${bar ? 'для бруса' : 'для узла'} — ${eqTxt}.`] },
      {
        k: 'p',
        c: [
          r.degree === 0
            ? 'Система статически определима: усилия находятся из уравнений равновесия.'
            : `Степень статической неопределимости: ${r.unknowns} − ${r.equations} = `,
          r.degree > 0 ? b(String(r.degree)) : '',
          r.degree > 0 ? ` — нужно ${r.degree === 1 ? 'одно уравнение' : `${r.degree} уравнения`} совместности деформаций.` : '',
        ],
      },
    ];
    ex(
      bl,
      'Стержни соединены шарнирами и нагружены только по концам, поэтому каждый работает на растяжение или сжатие и даёт одно неизвестное — продольную силу N (растяжение «+»). Лишние по сравнению с уравнениями равновесия неизвестные находят из условий совместности деформаций: стержни, связанные общим узлом или жёстким брусом, удлиняются не независимо.',
    );
    steps.push({ title: 'Схема и степень статической неопределимости', blocks: bl });
  }

  // 2. Уравнения равновесия.
  {
    const lines: { num?: boolean; c: Inline[] }[] = [];
    for (const eq of base.eqs) {
      const isM = eq.dof === 'theta';
      const coefs = eq.rodCoef.map((h) => cl(-h / (isM ? 1000 : 1)));
      const load = cl(eq.load / (isM ? 1e6 : 1000));
      if (coefs.every((a) => Math.abs(a) < 1e-12) && Math.abs(load) < 1e-12) continue;
      let name: string;
      if (eq.dof === 'u') name = 'ΣX = 0';
      else if (eq.dof === 'v') name = 'ΣY = 0';
      else {
        const a = -eq.z[1] / 1000;
        name =
          Math.abs(eq.z[0]) < 1e-12
            ? `ΣM относительно точки x = ${f(a)} м${pr.supports.some((s) => Math.abs(s.x - a) < 1e-9) ? ` (опора ${letter(pr.supports.findIndex((s) => Math.abs(s.x - a) < 1e-9))})` : ''} = 0`
            : 'уравнение моментов для свободного поворота';
      }
      lines.push({
        c: [
          `${name}:  `,
          sum(
            coefs.map((a, i) => [a, Nn(i)]),
            load,
          ),
        ],
      });
    }
    const bl: Block[] = [{ k: 'eq', lines }];
    if (bar && base.reactions.length)
      bl.push({ k: 'p', c: ['Реакции опор в эти уравнения не входят; их найдём из остальных уравнений равновесия, когда усилия станут известны.'] });
    ex(
      bl,
      bar
        ? 'Усилие растянутого стержня приложено к брусу и направлено к неподвижному шарниру стержня. Плечо усилия относительно точки — расстояние от точки до линии стержня; для вертикального стержня это просто расстояние по брусу.'
        : 'Узел вырезаем и рассматриваем его равновесие: усилие растянутого стержня направлено от узла вдоль стержня (к его неподвижному шарниру).',
    );
    steps.push({ title: 'Статическая сторона: уравнения равновесия', blocks: bl });
  }

  // 3. Совместность деформаций.
  if (r.degree > 0) {
    const lines: { num?: boolean; c: Inline[] }[] = [];
    const free = base.dofs;
    const dofTxt = free.map((d) => (d === 'theta' ? 'θ' : d)).join(', ');
    pr.rods.forEach((_, i) => {
      const g = base.rods[i].g;
      const parts = g
        .map((gj, j) => [cl(gj), free[j] === 'theta' ? 'θ' : free[j]] as [number, string])
        .filter(([a]) => Math.abs(a) > 1e-12)
        .map(([a, nme], k) => term(a, nme, k === 0));
      lines.push({ c: ['Δl', sub(String(i + 1)), ' = ', parts.join('') || '0', ' мм'] });
    });
    for (const c of r.compat)
      lines.push({ c: [b('Δl', sub(String(c.k + 1)), ' = ', c.base.map((bi, j) => term(c.w[j], `Δl${idx(bi + 1)}`, j === 0)).join(''))] });
    const bl: Block[] = [
      {
        k: 'p',
        c: [
          bar
            ? `Брус абсолютно жёсткий: его положение задают ${free.length === 1 ? 'угол поворота θ (рад)' : `координаты ${dofTxt} (мм, θ — рад)`}; удлинение стержня — проекция перемещения точки крепления на ось стержня:`
            : `Узел смещается на (${dofTxt}) мм; удлинение стержня — проекция перемещения узла на ось стержня:`,
        ],
      },
      { k: 'eq', lines },
    ];
    if (r.compat.length) bl.push({ k: 'p', c: ['Исключив перемещения, получаем уравнения совместности деформаций (последние строки).'] });
    ex(
      bl,
      bar
        ? 'При малом повороте жёсткого бруса вокруг шарнира перемещения его точек пропорциональны расстояниям до шарнира (подобные треугольники на плане перемещений). Поэтому удлинения стержней связаны между собой.'
        : 'Все стержни соединены в одном узле, поэтому их удлинения определяются одним и тем же перемещением узла — это и есть условие совместности.',
    );
    steps.push({ title: 'Геометрическая сторона: совместность деформаций', blocks: bl });
  }

  // 4. Закон Гука.
  {
    const hasT = pr.rods.some((x) => x.dT !== 0);
    const hasD = pr.rods.some((x) => x.delta !== 0);
    const lines: { num?: boolean; c: Inline[] }[] = [];
    lines.push({
      c: [
        'Δl',
        sub('i'),
        ' = ',
        v('N'),
        sub('i'),
        v('l'),
        sub('i'),
        '/(',
        v('E'),
        sub('i'),
        v('A'),
        sub('i'),
        ')',
        hasT ? ' + α' : '',
        hasT ? sub('i') : '',
        hasT ? 'ΔT' : '',
        hasT ? sub('i') : '',
        hasT ? v('l') : '',
        hasT ? sub('i') : '',
        hasD ? ' + δ' : '',
        hasD ? sub('i') : '',
      ],
    });
    pr.rods.forEach((rd, i) => {
      const rs = base.rods[i];
      const coef = (1e4 * rd.l) / (rd.E * rd.c * (design ? 1 : pr.A));
      const Amm = design ? `${f(rd.c * 100)}A` : f(rs.A * 100);
      const comp = `Δl${idx(i + 1)} = N${idx(i + 1)}·${f(rd.l * 1000)}·10³/(${f(rd.E)}·${Amm}) = ${f(coef)}·N${idx(i + 1)}${design ? '/A' : ''}`;
      const t = rd.dT ? `${rs.dlT < 0 ? ' − ' : ' + '}${f(Math.abs(rs.dlT))} (нагрев)` : '';
      const d = rd.delta ? `${rd.delta < 0 ? ' − ' : ' + '}${f(Math.abs(rd.delta))} (неточность)` : '';
      lines.push({ c: [`стержень ${i + 1}: ${comp}${t}${d} мм`] });
    });
    const bl: Block[] = [{ k: 'eq', lines }];
    if (design)
      bl.push({
        k: 'p',
        c: [
          'Площадь пока неизвестна: ',
          v('A'),
          sub('i'),
          ' = ',
          v('c'),
          sub('i'),
          '·',
          v('A'),
          ' (A — в см², 1 см² = 100 мм²); l — в мм, E — в МПа, N — в кН.',
        ],
      });
    else bl.push({ k: 'p', c: ['l — в мм, A — в мм², E — в МПа, N — в кН (множитель 10³ переводит кН в Н): Δl получается в мм.'] });
    ex(
      bl,
      'Удлинение стержня складывается из упругого (от силы N), температурного (αΔT·l) и неточности изготовления δ: стержень, изготовленный длиннее на δ, при сборке приходится сжимать.',
    );
    steps.push({ title: 'Физическая сторона: закон Гука', blocks: bl });
  }

  // 5. Решение.
  {
    const lines: { num?: boolean; c: Inline[] }[] = [];
    const disp: string[] = [];
    base.dofs.forEach((d, j) => disp.push(d === 'theta' ? `θ = ${f(base.r[j])} рад` : `${d} = ${f(base.r[j])} мм`));
    if (disp.length) lines.push({ c: ['перемещения: ', disp.join(';  ')] });
    const scaled = (pr.ask === 'allow' || pr.ask === 'limit') && pr.loads.filter((l) => l.F).length === 1 && !r.thermal;
    const F0 = pr.loads.find((l) => l.F)?.F ?? 1;
    pr.rods.forEach((_, i) => {
      const rs = base.rods[i];
      lines.push({
        c: [
          v('N'),
          sub(String(i + 1)),
          ' = ',
          b(`${f(rs.N)} кН`),
          scaled ? ` = ${f(rs.N / F0)}·F` : '',
          rs.N > 1e-9 ? ' (растяжение)' : rs.N < -1e-9 ? ' (сжатие)' : '',
          `;  Δl${idx(i + 1)} = ${f(rs.dl)} мм`,
        ],
      });
    });
    base.reactions.forEach((R) => lines.push({ c: [v(R.dir === 'r' ? 'R' : R.dir === 'x' ? 'X' : 'Y'), sub(letter(R.support)), ` = ${f(R.R)} кН`] }));
    const bl: Block[] = [{ k: 'eq', lines }];
    if (r.thermal) {
      const tl = pr.rods.map((_, i) => `${Nn(i)}ᵗ = ${f(r.thermal!.rods[i].N)}`).join(';  ');
      bl.push({ k: 'p', c: [`Из них от нагрева и неточности изготовления (без нагрузки): ${tl} кН.`] });
    }
    bl.push({
      k: 'badge',
      tone: r.residual < 1e-9 ? 'ok' : 'warn',
      text: r.residual < 1e-9 ? 'проверка: уравнения равновесия и совместности выполняются' : `проверка: невязка равновесия ${f(r.residual)}`,
    });
    ex(
      bl,
      'Подставив закон Гука в уравнения совместности, получаем уравнения в усилиях; вместе с уравнениями равновесия их столько же, сколько неизвестных. Здесь они решены через перемещения (метод перемещений) — это то же самое решение.',
    );
    steps.push({ title: 'Усилия в стержнях', blocks: bl });
  }

  // 6. Прочность.
  {
    const bl: Block[] = [];
    if (pr.ask === 'check') {
      const lines = pr.rods.map((_, i) => {
        const rs = base.rods[i];
        return {
          c: [
            'σ',
            sub(String(i + 1)),
            ' = ',
            v('N'),
            sub(String(i + 1)),
            '/',
            v('A'),
            sub(String(i + 1)),
            ` = ${f(rs.N)}·10/${f(rs.A)} = `,
            b(`${f(rs.sigma)} МПа`),
          ] as Inline[],
        };
      });
      bl.push({ k: 'eq', lines });
    }
    if (pr.ask === 'check') {
      if (r.check != null)
        bl.push({
          k: 'badge',
          tone: r.check ? 'ok' : 'bad',
          text: r.check
            ? `прочность обеспечена: |σ|max = ${f(Math.abs(r.sigmaMax!.v))} ≤ [σ] = ${f(pr.sAllow)} МПа`
            : `прочность не обеспечена: |σ|max = ${f(Math.abs(r.sigmaMax!.v))} > [σ] = ${f(pr.sAllow)} МПа`,
        });
      if (r.nT != null) bl.push({ k: 'p', c: [`Запас по пределу текучести n = σт/|σ|max = ${f(pr.sT)}/${f(Math.abs(r.sigmaMax!.v))} = `, b(f(r.nT))] });
    }
    if (design && r.design) {
      const D = r.design;
      const lines = pr.rods.map((rd, i) => {
        const a = D.a[i],
          t = D.b[i];
        return {
          c: [
            'σ',
            sub(String(i + 1)),
            ` = ${f(a)}/A${Math.abs(t) > 1e-12 ? `${t < 0 ? ' − ' : ' + '}${f(Math.abs(t))}` : ''} МПа  (A в см²; A${idx(i + 1)} = ${f(rd.c)}A)`,
          ] as Inline[],
        };
      });
      lines.push({
        c: [
          'условие |σ',
          sub('i'),
          '| ≤ [σ] = ',
          f(pr.sAllow),
          ' МПа даёт ',
          v('A'),
          ' ≥ ',
          b(`${f(r.design.Amin)} см²`),
          ` (определяет стержень ${r.design.gov + 1})`,
        ],
      });
      if (r.design.Amax != null)
        lines.push({ c: ['и ', v('A'), ' ≤ ', f(r.design.Amax), ' см² — иначе температурные (монтажные) напряжения в другую сторону превысят [σ]'] });
      bl.push({ k: 'eq', lines });
      ex(
        bl,
        'Усилия от нагрузки в статически неопределимой системе зависят только от отношения жёсткостей, поэтому при A_i = c_i·A напряжения от нагрузки обратно пропорциональны A. Температурные и монтажные усилия пропорциональны жёсткостям, и напряжения от них от A не зависят.',
      );
    }
    if (pr.ask === 'allow' && r.allow) {
      const lines = pr.rods.map((_, i) => {
        const a = r.loadOnly!.rods[i].sigma,
          t = r.thermal ? r.thermal.rods[i].sigma : 0;
        return { c: ['σ', sub(String(i + 1)), ` = ${f(a)}·λ${t ? `${t < 0 ? ' − ' : ' + '}${f(Math.abs(t))}` : ''} МПа`] as Inline[] };
      });
      lines.push({ c: ['|σ', sub('i'), '| ≤ [σ] ⇒ λ ≤ ', b(f(r.allow.lam)), ` (определяет стержень ${r.allow.gov + 1})`] });
      lines.push({
        c: [
          'допускаемая нагрузка: ',
          pr.loads
            .filter((l) => l.F)
            .map((l) => `${f(l.F)}·λ = ${f(l.F * r.allow!.lam)} ${l.kind === 'M' ? 'кН·м' : l.kind === 'q' ? 'кН/м' : 'кН'}`)
            .join(';  '),
        ],
      });
      bl.push({ k: 'eq', lines });
      ex(
        bl,
        'Все нагрузки увеличиваем в λ раз; напряжения от них растут пропорционально λ. Допускаемая нагрузка — та, при которой самый напряжённый стержень достигает допускаемого напряжения.',
      );
    }
    if (pr.ask === 'limit' && r.limit) {
      const L = r.limit;
      const P = pr.loads.find((l) => l.F)?.F ?? 1;
      const lines: { num?: boolean; c: Inline[] }[] = [
        { c: ['по допускаемым напряжениям ([σ] = ', f(L.sAllowUsed), ' МПа): λ = ', f(L.lamAllow), '  ⇒  [F] = ', b(`${f(L.lamAllow * P)} кН`)] },
        { c: [`текучесть начинается в стержне ${L.firstYield + 1} при λт = ${f(L.lamT)} (F = ${f(L.lamT * P)} кН)`] },
        { c: ['предельное состояние: ', pr.rods.map((_, i) => `${Nn(i)} = ${f(L.Nu[i])}${L.atYield[i] ? ' (σт)' : ''}`).join(';  '), ' кН'] },
        {
          c: [
            'предельная нагрузка F',
            sub('пр'),
            ' = ',
            b(`${f(L.lamU * P)} кН`),
            ';  [F]',
            sub('п'),
            ' = F',
            sub('пр'),
            '/n = ',
            `${f(L.lamU * P)}/${f(pr.n)} = `,
            b(`${f((L.lamU * P) / pr.n)} кН`),
          ],
        },
        { c: ['[F]', sub('п'), '/[F] = ', b(f(L.lamU / pr.n / L.lamAllow))] },
      ];
      bl.push({ k: 'eq', lines });
      ex(
        bl,
        'После того как стержень потёк, его усилие остаётся равным σт·A, а нагрузку можно увеличивать, пока не потекут столько стержней, что система станет механизмом. Предельная нагрузка определяется только уравнениями равновесия при N = ±σт·A в потёкших стержнях; нагрев и неточность изготовления на неё не влияют.',
      );
    }
    if (bl.length)
      steps.push({
        title:
          pr.ask === 'design'
            ? 'Подбор площади'
            : pr.ask === 'allow'
              ? 'Допускаемая нагрузка'
              : pr.ask === 'limit'
                ? 'Расчёт по предельному состоянию'
                : 'Напряжения и прочность',
        blocks: bl,
      });
  }

  // Ответ.
  const scaledAns = (pr.ask === 'allow' || pr.ask === 'limit') && pr.loads.filter((l) => l.F).length === 1 && !r.thermal;
  const FA = pr.loads.find((l) => l.F)?.F ?? 1;
  const rows: AnswerRow[] = pr.rods.map((_, i) => ({
    kind: 'main',
    val: [v('N'), sub(String(i + 1)), scaledAns ? ` = ${f(base.rods[i].N / FA)}·F` : ` = ${f(base.rods[i].N)} кН`],
    note: design ? `σ = ${f(base.rods[i].sigma)} МПа при A = ${f(r.design!.Amin)} см²` : scaledAns ? 'в упругой стадии' : `σ = ${f(base.rods[i].sigma)} МПа`,
  }));
  if (design && r.design) rows.unshift({ kind: 'main', val: [v('A'), ` = ${f(r.design.Amin)} см²`], note: 'наименьшая площадь' });
  if (pr.ask === 'allow' && r.allow) rows.unshift({ kind: 'main', val: [`λ = ${f(r.allow.lam)}`], note: 'допускаемый множитель нагрузки' });
  if (pr.ask === 'limit' && r.limit) {
    const P = pr.loads.find((l) => l.F)?.F ?? 1;
    rows.unshift({
      kind: 'main',
      val: ['[F]', sub('п'), ` = ${f((r.limit.lamU * P) / pr.n)} кН`],
      note: `[F] = ${f(r.limit.lamAllow * P)} кН по допускаемым напряжениям`,
    });
  }
  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows }] });
  return { steps };
}
