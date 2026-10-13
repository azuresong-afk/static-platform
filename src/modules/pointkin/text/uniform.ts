/** Решение: равнопеременное движение точки — три величины из пяти, касательное, нормальное и полное ускорения. */
import { b, sub, v, type AnswerRow, type Block, type Doc, type Step } from '../../../shared/doc';
import { fmt } from '../../../shared/format';
import type { LinKey, LinResult, LinState, LinUni } from '../model/uniform';

const f = (x: number) => fmt(x, 4);
export const LIN_NAMES: Record<LinKey, string> = {
  v0: 'начальная скорость v₀',
  v: 'конечная скорость v',
  a: 'касательное ускорение a',
  t: 'время t',
  s: 'путь s',
};
const SHORT: Record<LinKey, string> = { v0: 'v₀', v: 'v', a: 'a', t: 't', s: 's' };

export function uniDoc(u: LinUni, r: LinResult, opts: { explain?: boolean } = {}): Doc {
  const steps: Step[] = [];
  if (!r.ok)
    return {
      steps: [
        {
          title: 'Данные',
          blocks: [
            { k: 'badge', tone: 'bad', text: 'проверьте данные' },
            { k: 'ul', items: r.errors.map((x) => [x]) },
          ],
        },
      ],
    };
  const kmh = (x: number) => (u.kmh ? ` (${f(x * 3.6)} км/ч)` : '');
  const val: Record<LinKey, string> = {
    v0: `${f(r.v0)} м/с${kmh(r.v0)}`,
    v: `${f(r.v)} м/с${kmh(r.v)}`,
    a: `${f(r.a)} м/с²`,
    t: `${f(r.t)} с`,
    s: `${f(r.s)} м`,
  };
  {
    const bl: Block[] = [
      {
        k: 'p',
        c: [
          'Движение равнопеременное: касательное ускорение a постоянно. Известны: ',
          u.known.map((k) => `${LIN_NAMES[k]} = ${val[k]}`).join('; '),
          u.kmh ? ' (скорости переведены из км/ч: 1 км/ч = 1/3,6 м/с)' : '',
          '.',
        ],
      },
      {
        k: 'eq',
        lines: [
          {
            c: [
              v('v'),
              ' = ',
              v('v'),
              '₀ + ',
              v('a'),
              v('t'),
              ',   ',
              v('s'),
              ' = ',
              v('v'),
              '₀',
              v('t'),
              ' + ',
              v('a'),
              v('t'),
              '²/2,   ',
              v('v'),
              '² − ',
              v('v'),
              '₀² = 2',
              v('a'),
              v('s'),
              ',   ',
              v('s'),
              ' = (',
              v('v'),
              '₀ + ',
              v('v'),
              ')',
              v('t'),
              '/2',
            ],
          },
        ],
      },
    ];
    if (opts.explain)
      bl.push({ k: 'p', cls: 'explain', c: ['Отрицательное a — замедление. Из четырёх формул выбирается пара, в которую входят две неизвестные величины.'] });
    steps.push({ title: 'Формулы равнопеременного движения', blocks: bl });
  }
  const miss = (['v0', 'v', 'a', 't', 's'] as LinKey[]).filter((k) => !u.known.includes(k));
  steps.push({
    title: 'Неизвестные',
    blocks: [
      {
        k: 'eq',
        lines: [
          { c: [r.how] },
          { c: [b(miss.map((k) => `${SHORT[k]} = ${val[k]}`).join(';  '))] },
          { c: [`закон движения: s(t) = v₀t + (a/2)t² = ${f(r.v0)}t ${r.a < 0 ? '−' : '+'} ${f(Math.abs(r.a) / 2)}t²`] },
        ],
      },
    ],
  });
  const rows: AnswerRow[] = miss.map((k) => ({ kind: 'main', val: [`${SHORT[k]} = ${val[k]}`], note: LIN_NAMES[k] }));
  if (u.rho > 0) {
    const st = (s: LinState, name: string) => ({
      c: [
        `${name} (t = ${f(s.t)} с, v = ${f(s.v)} м/с): `,
        v('a'),
        sub('τ'),
        ` = ${f(r.a)},  `,
        v('a'),
        sub('n'),
        ` = v²/ρ = ${f(s.an)},  `,
        b(`a = ${f(s.a)} м/с²`),
      ],
    });
    const lines = [st(r.start!, 'в начале'), st(r.end!, 'в конце')];
    if (r.mid) lines.push({ c: [...st(r.mid, `в момент t′`).c, `;  пройдено s = ${f(r.mid.s)} м`] });
    const bl: Block[] = [
      { k: 'p', c: [`Траектория — дуга радиуса ρ = ${f(u.rho)} м: нормальное ускорение a_n = v²/ρ, полное a = √(a_τ² + a_n²).`] },
      { k: 'eq', lines },
    ];
    steps.push({ title: 'Ускорения на закруглении', blocks: bl });
    rows.push({ kind: 'main', val: [`a = ${f(r.start!.a)} → ${f(r.end!.a)} м/с²`], note: 'полное ускорение в начале и в конце' });
    if (r.mid) rows.push({ kind: 'main', val: [`a(t′) = ${f(r.mid.a)} м/с²`], note: `a_τ = ${f(r.a)}, a_n = ${f(r.mid.an)}` });
  } else if (r.mid) {
    steps.push({
      title: 'В момент t′',
      blocks: [{ k: 'eq', lines: [{ c: [`t′ = ${f(r.mid.t)} с:  v = ${f(r.mid.v)} м/с${kmh(r.mid.v)},  s = ${f(r.mid.s)} м`] }] }],
    });
    rows.push({ kind: 'aux', val: [`v(t′) = ${f(r.mid.v)} м/с, s(t′) = ${f(r.mid.s)} м`], note: 'промежуточное состояние' });
  }
  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows }] });
  return { steps };
}
