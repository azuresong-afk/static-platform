/** Текст обратной задачи: что измерено, что найдено, проверка подстановкой; опыты с эталонной массой. */
import { b, sub, v, type Block, type Inline, type Step } from '../../../shared/doc';
import type { ExpResult, Inverse, InvResult } from '../model/inverse';
import { INV_TARGET, INV_UNKNOWN } from '../model/inverse';
import type { OscProblem } from '../model/osc';
import { f, unitsOf } from './solution';

const UNK_SYM: Record<string, Inline[]> = {
  c: [v('c')],
  l: [v('l')],
  E: [v('E')],
  J: [v('J')],
  A: [v('A')],
  g: [v('g')],
  b: [v('b')],
  m: [v('m')],
  amp: ['амплитуда'],
  p: [v('p')],
  h: [v('h')],
};

function unit(u: string, U: ReturnType<typeof unitsOf>, pr: OscProblem): string {
  switch (u) {
    case 'c':
      return U.c;
    case 'l':
      return U.L;
    case 'E':
      return U.s;
    case 'J':
      return `${U.L}⁴`;
    case 'A':
      return `${U.L}²`;
    case 'g':
      return 'м/с²';
    case 'b':
      return U.b;
    case 'm':
      return pr.byWeight ? U.F : 'кг';
    case 'p':
      return 'с⁻¹';
    case 'h':
      return U.L;
    default:
      return pr.exc.mode === 'base' || pr.exc.mode === 'support' || pr.exc.mode === 'cam' || pr.exc.mode === 'rotor' ? U.L : U.F;
  }
}

/** Единица измеренной величины. */
function targetUnit(t: string, U: ReturnType<typeof unitsOf>): string {
  if (t === 'T0' || t === 'T1') return 'с';
  if (t === 'k' || t === 'pStar') return 'с⁻¹';
  if (t === 'eps') return '°';
  if (t === 'etaMax' || t === 'Kd') return '';
  return U.L;
}

export function invStep(pr: OscProblem, inv: Inverse, res: InvResult): Step {
  const U = unitsOf(pr);
  if (!res.ok)
    return {
      title: 'Обратная задача',
      blocks: [
        { k: 'badge', tone: 'bad', text: 'обратная задача не решена' },
        { k: 'ul', items: res.errors.map((x) => [x]) },
      ],
    };
  const tu = targetUnit(inv.target, U);
  const uu = unit(inv.unknown, U, pr);
  const bl: Block[] = [
    {
      k: 'eq',
      lines: [
        { c: [`задано: ${INV_TARGET[inv.target]} = ${f(inv.value)}${tu ? ' ' + tu : ''}`] },
        { c: [`неизвестно: ${INV_UNKNOWN[inv.unknown]}`] },
        {
          c: [
            'решается уравнение «величина, найденная из прямой задачи, равна заданной» относительно неизвестной (деление отрезка пополам на сетке по логарифмической шкале)',
          ],
        },
        res.roots.length > 1
          ? { c: [`найдено корней: ${res.roots.length}: ${res.roots.map((x) => f(x)).join('; ')} ${uu}`] }
          : { c: [...(UNK_SYM[inv.unknown] ?? []), ' = ', b(`${f(res.value)} ${uu}`)] },
        {
          c: [
            `проверка: подстановка ${f(res.value)} даёт ${INV_TARGET[inv.target].split(',')[0]} = ${res.check == null ? '—' : f(res.check)}${tu ? ' ' + tu : ''}`,
          ],
        },
      ],
    },
  ];
  if (res.roots.length > 1)
    bl.push({
      k: 'p',
      c: [
        `Подставлен корень № ${res.pick + 1} (${f(res.value)} ${uu}); остальные выбираются в панели «Обратная задача». Несколько корней бывают, когда величина как функция неизвестной имеет максимум или резонанс: например, одна и та же амплитуда получается до и после резонанса.`,
      ],
    });
  return { title: 'Обратная задача: поиск неизвестного', blocks: bl };
}

export function expStep(pr: OscProblem, inv: Inverse, ex: ExpResult): Step {
  const U = unitsOf(pr);
  const e = inv.exp;
  if (!ex.ok)
    return {
      title: 'Опыт',
      blocks: [
        { k: 'badge', tone: 'bad', text: 'данные опыта' },
        { k: 'ul', items: ex.errors.map((x) => [x]) },
      ],
    };
  const J = `${U.F}·${U.L}·с²`;
  const V = ex.vals;
  const eq = (c: Inline[]) => ({ c });
  if (inv.kind === 'jref')
    return {
      title: 'Момент инерции по периодам: эталонный диск',
      blocks: [
        {
          k: 'eq',
          lines: [
            eq([
              v('J'),
              sub('д'),
              ' = ',
              v('P'),
              v('r'),
              '²/(2',
              v('g'),
              `) = ${f(e.P)}·${f(e.r)}²/(2·${f(pr.gms / ({ m: 1, cm: 0.01, mm: 0.001 } as const)[pr.len])}) = ${f(V.Jr)} ${J}`,
            ]),
            eq([v('c'), ' = ', v('J'), sub('д'), '(2π/', v('T'), sub('д'), `)² = ${f(V.Jr)}·(2π/${f(e.Tr)})² = ${f(V.c)} ${U.F}·${U.L}/рад`]),
            eq([
              v('J'),
              ' = ',
              v('c'),
              v('T'),
              sub('1'),
              '²/(4π²) = ',
              v('J'),
              sub('д'),
              '(',
              v('T'),
              sub('1'),
              '/',
              v('T'),
              sub('д'),
              `)² = `,
              b(`${f(V.J)} ${J}`),
            ]),
          ],
        },
        {
          k: 'p',
          c: [
            'Жёсткость проволоки одна и та же в обоих опытах, а период T = 2π√(J/c) зависит только от J, поэтому J тела относится к J диска как квадраты периодов. Если в задаче дано число размахов, период — это удвоенная продолжительность одного размаха.',
          ],
        },
      ],
    };
  if (inv.kind === 'jadd')
    return {
      title: 'Момент инерции по периодам: диск добавлен к телу',
      blocks: [
        {
          k: 'eq',
          lines: [
            eq([v('J'), sub('д'), ` = ${f(V.Jd)} ${J}`]),
            eq([v('c'), ' = ', v('J'), '(2π/', v('T'), sub('1'), ')² = (', v('J'), ' + ', v('J'), sub('д'), ')(2π/', v('T'), sub('2'), ')²']),
            eq([
              v('J'),
              ' = ',
              v('J'),
              sub('д'),
              v('T'),
              sub('1'),
              '²/(',
              v('T'),
              sub('2'),
              '² − ',
              v('T'),
              sub('1'),
              '²) = ',
              b(`${f(V.J)} ${J}`),
              `;  c = ${f(V.c)} ${U.F}·${U.L}/рад`,
            ]),
          ],
        },
      ],
    };
  if (inv.kind === 'g2')
    return {
      title: 'Ускорение свободного падения по двум опытам',
      blocks: [
        {
          k: 'eq',
          lines: [
            eq([
              'T',
              sub('i'),
              '² = 4π²(δ',
              sub('i'),
              '/',
              v('g'),
              ' + ',
              v('m'),
              sub('а'),
              '/',
              v('c'),
              ') — добавочная масса ',
              v('m'),
              sub('а'),
              ' (пружины) входит в оба опыта одинаково',
            ]),
            eq([
              v('g'),
              ' = 4π²(δ',
              sub('1'),
              ' − δ',
              sub('2'),
              ')/(',
              v('T'),
              sub('1'),
              '² − ',
              v('T'),
              sub('2'),
              `²) = 4π²·(${f(e.d1)} − ${f(e.d2)})/(${f(e.T1)}² − ${f(e.T2)}²) = `,
              b(`${f(V.g)} ${U.L}/с²`),
              ` = ${f(V.g * ({ m: 1, cm: 0.01, mm: 0.001 } as const)[pr.len])} м/с²`,
            ]),
            ...(V.c != null
              ? [eq([v('c'), ` = (P₁ − P₂)/(δ₁ − δ₂) = ${f(V.c)} ${U.c};  `, v('m'), sub('а'), ` = c·T₁²/4π² − P₁/g = ${f(V.ma)} ${U.F}·с²/${U.L}`])]
              : []),
          ],
        },
        {
          k: 'p',
          c: ['Вычитание опытов исключает неизвестную добавочную массу пружины; g находится только по разности удлинений и разности квадратов периодов.'],
        },
      ],
    };
  return {
    title: 'Бифилярный подвес',
    blocks: [
      {
        k: 'eq',
        lines: [
          eq([v('c'), ' = ', v('P'), v('b'), '²/', v('l'), ` = ${f(e.P)}·${f(e.b)}²/${f(e.l)} = ${f(V.c)} ${U.F}·${U.L}/рад`]),
          eq([v('J'), ' = ', v('P'), v('a'), '²/(3', v('g'), `) = ${f(V.J)} ${J}`]),
          eq([v('T'), ' = 2π√(', v('J'), '/', v('c'), ') = (2π', v('a'), '/', v('b'), ')√(', v('l'), '/(3', v('g'), ')) = ', b(`${f(V.T)} с`)]),
          ...(V.Jm != null ? [eq([v('J'), ' по измеренному периоду = ', v('c'), v('T'), 'м²/(4π²) = ', b(`${f(V.Jm)} ${J}`)])] : []),
        ],
      },
      {
        k: 'p',
        c: [
          'Нити натянуты силой P/2 каждая; при повороте на малый угол φ их концы смещаются на bφ, горизонтальная составляющая натяжения даёт момент 2·(P/2)·(bφ/l)·b = Pb²φ/l.',
        ],
      },
    ],
  };
}
