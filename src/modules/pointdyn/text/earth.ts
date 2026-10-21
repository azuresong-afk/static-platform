/** Решение: движение точки вблизи вращающейся Земли — падение, движение по горизонтали, маятник Фуко, g по широте. */
import { b, sub, v, type AnswerRow, type Block, type Doc, type Inline, type Step } from '../../../shared/doc';
import { fmt } from '../../../shared/format';
import { courseName } from '../../relative/model/earth';
import { sig } from '../../relative/text/earth';
import type { EarthDyn, EarthDynResult } from '../model/earth';

export function earthDoc(p: EarthDyn, r: EarthDynResult, opts: { explain?: boolean } = {}): Doc {
  const steps: Step[] = [];
  const ex = (bl: Block[], ...c: Inline[]) => {
    if (opts.explain) bl.push({ k: 'p', cls: 'explain', c });
  };
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
  const fu = p.byWeight ? 'кГ' : 'Н';
  const f = (p.lat * Math.PI) / 180;
  const head: Block[] = [
    {
      k: 'eq',
      lines: [
        {
          c: [
            `φ = ${fmt(p.lat, 4)}°;  `,
            v('ω'),
            ` = ${sig(p.omega)} рад/с;  `,
            v('g'),
            ` = ${sig(p.g)} м/с²${p.byWeight ? `;  m = P/g = ${sig(p.m)}/${sig(p.g)} = ${sig(r.mass)}` : ''}`,
          ],
        },
        {
          c: [
            v('m'),
            v('a'),
            sub('r'),
            ' = ',
            v('m'),
            v('g'),
            ' + ',
            v('Φ'),
            sub('c'),
            ',  ',
            v('Φ'),
            sub('c'),
            ' = −2',
            v('m'),
            'Ω × ',
            v('v'),
            sub('r'),
            ',  Ω = ω(0; cos φ; sin φ)',
          ],
        },
      ],
    },
  ];
  ex(
    head,
    'Оси места: x — на восток, y — на север, z — вверх. Переносная сила инерции (центробежная) входит в силу тяжести mg — g направлено по отвесу. Остаётся кориолисова сила инерции; она перпендикулярна оси Земли и относительной скорости.',
  );
  steps.push({ title: 'Уравнение относительного движения', blocks: head });
  const rows: AnswerRow[] = [];
  if (r.fall) {
    const q = r.fall;
    const lines: { c: Inline[] }[] = [
      { c: ['ẍ = 2ω(ẏ sin φ − ż cos φ),  ÿ = −2ωẋ sin φ,  z̈ = −g + 2ωẋ cos φ'] },
      { c: [`начало: z₀ = h = ${sig(p.h)} м, скорость (${sig(p.vE)}; ${sig(p.vN)}; ${sig(p.vh)}) м/с — численное интегрирование до z = 0`] },
      {
        c: [
          `время полёта T = `,
          b(sig(q.T)),
          ' с; точка падения (',
          sig(q.land[0]),
          '; ',
          sig(q.land[1]),
          ') м, без вращения Земли — (',
          sig(q.land0[0]),
          '; ',
          sig(q.land0[1]),
          ') м',
        ],
      },
      { c: ['отклонение: на восток ', b(sig(q.dev[0])), ' м, на север ', sig(q.dev[1]), ' м'] },
    ];
    if (q.approxE != null)
      lines.push({
        c: [
          'приближённо (падение из покоя): x ≈ ⅓ωgT³ cos φ = ',
          `⅓·${sig(p.omega)}·${sig(p.g)}·${sig(q.T)}³·${fmt(Math.cos(f), 4)} = `,
          b(sig(q.approxE)),
          ' м',
        ],
      });
    const bl: Block[] = [{ k: 'eq', lines }];
    ex(
      bl,
      'При падении скорость направлена вниз, кориолисова сила −2mΩ × v направлена на восток (в обоих полушариях): точка отклоняется к востоку. Отклонение считается от точки падения без вращения Земли с той же силой тяжести.',
    );
    steps.push({ title: 'Свободное движение до падения на Землю', blocks: bl });
    rows.push(
      { kind: 'main', val: ['отклонение на восток ', `${sig(q.dev[0])} м`], note: `на север ${sig(q.dev[1])} м` },
      { kind: 'aux', val: [v('T'), ` = ${sig(q.T)} с`], note: 'время полёта' },
    );
  }
  if (r.line) {
    const q = r.line;
    const lines: { c: Inline[] }[] = [
      { c: [v('v'), sub('E'), ` = v sin k = ${sig(q.vE)},  `, v('v'), sub('N'), ` = v cos k = ${sig(q.vN)} м/с`] },
      { c: [v('a'), sub('c'), ' по горизонтали = 2ωv sin φ = ', `2·${sig(p.omega)}·${sig(p.v)}·${fmt(Math.sin(f), 4)} = `, b(sig(q.acH)), ' м/с²'] },
      {
        c: [
          v('Φ'),
          sub('c'),
          ' по горизонтали = m·2ωv sin φ = ',
          `${sig(r.mass)}·${sig(q.acH)} = `,
          b(sig(q.FH)),
          ` ${fu}${q.FH > 0 ? ` — на ${courseName(q.FHk)} (${p.lat >= 0 ? 'вправо' : 'влево'} от скорости)` : ''}`,
        ],
      },
      {
        c: [
          v('Φ'),
          sub('c'),
          ' по вертикали = 2mωv',
          sub('E'),
          ' cos φ = ',
          sig(q.FV),
          ` ${fu}${q.FV > 0 ? ' — вверх: давление на опору меньше веса' : q.FV < 0 ? ' — вниз: давление больше веса' : ''}`,
        ],
      },
    ];
    if (p.L > 0)
      lines.push({
        c: [`путь L = ${sig(p.L)} м за t = L/v = ${sig(q.t)} с; если вбок движение свободно: d = ½·2ωv sin φ·t² = ω sin φ·L²/v = `, b(sig(q.dev)), ' м'],
      });
    if (p.b > 0)
      lines.push({
        c: [
          `перекос поверхности воды: tg β = 2ωv sin φ/g = ${sig(q.tanB)}; на ширине b = ${sig(p.b)} м разность уровней Δh = b·tg β = `,
          b(sig(q.dh)),
          ` м — выше у ${p.lat >= 0 ? 'правого' : 'левого'} берега`,
        ],
      });
    const bl: Block[] = [{ k: 'eq', lines }];
    ex(
      bl,
      'Точка движется по горизонтальной прямой с постоянной скоростью: относительное ускорение равно нулю, и связь (рельс) уравновешивает горизонтальную кориолисову силу инерции — давление на рельс равно ей и направлено туда же. Горизонтальная составляющая 2ωv sin φ не зависит от курса. Поверхность воды перпендикулярна сумме g и −a_c.',
    );
    steps.push({ title: 'Движение по горизонтали', blocks: bl });
    rows.push({ kind: 'main', val: ['давление вбок ', `${sig(q.FH)} ${fu}`], note: q.FH > 0 ? `на ${courseName(q.FHk)}` : '' });
    if (p.L > 0) rows.push({ kind: 'main', val: [v('d'), ` = ${sig(q.dev)} м`], note: `отклонение ${p.lat >= 0 ? 'вправо' : 'влево'} на пути L` });
    if (p.b > 0) rows.push({ kind: 'main', val: ['Δ', v('h'), ` = ${sig(q.dh)} м`], note: 'разность уровней берегов' });
  }
  if (r.pend) {
    const q = r.pend;
    const lines: { c: Inline[] }[] = [
      { c: ['угловая скорость поворота плоскости качаний ω sin φ = ', `${sig(p.omega)}·${fmt(Math.abs(Math.sin(f)), 4)} = `, b(sig(q.rate)), ' рад/с'] },
      { c: [`поворот на ψ = ${fmt(p.psi, 4)}°: t = ψ/(ω sin φ) = `, b(sig(q.t)), ` с = ${sig(q.t / 3600)} ч`] },
      { c: [`плоскость (прямая) повторяется через 180°: t = (ψ + kπ)/(ω sin φ) = ${sig(q.t / 3600)} + ${sig(q.Thalf / 3600)}·k ч, k = 0, 1, 2, …`] },
      { c: [`полный оборот плоскости — за 2π/(ω sin φ) = ${sig(q.T / 3600)} ч`] },
    ];
    const bl: Block[] = [{ k: 'eq', lines }];
    ex(
      bl,
      `Для малых колебаний вертикальная составляющая кориолисовой силы мала, горизонтальная поворачивает плоскость качаний ${p.lat >= 0 ? 'по часовой стрелке (если смотреть сверху) — в северном полушарии' : 'против часовой стрелки (если смотреть сверху) — в южном полушарии'} с угловой скоростью ω sin φ относительно Земли.`,
    );
    steps.push({ title: 'Маятник Фуко', blocks: bl });
    rows.push({ kind: 'main', val: [v('t'), ` = ${sig(q.t / 3600)} ч`], note: `поворот на ${fmt(p.psi, 4)}°, далее через ${sig(q.Thalf / 3600)} ч` });
  }
  if (r.gr) {
    const q = r.gr;
    const lines: { c: Inline[] }[] = [
      {
        c: [
          v('a'),
          sub('e'),
          ' = ω²R cos φ = ',
          `${sig(p.omega)}²·${sig(p.R)}·${fmt(Math.cos(f), 4)} = ${sig(q.aOmega)} м/с² — от оси Земли (центробежная сила инерции)`,
        ],
      },
      { c: [v('g'), '(φ) = |', v('g'), sub('0'), ' + ω²R cos φ| = √(g₀² − 2g₀ω²R cos²φ + ω⁴R² cos²φ) = ', b(sig(q.gPhi)), ' м/с²'] },
      { c: ['без члена с ω⁴: ', v('g'), '(φ) ≈ g₀(1 − cos²φ/n),  n = g₀/(ω²R) = ', b(sig(q.n)), ` → ${sig(q.gApprox)} м/с²`] },
      { c: [`отвес отклонён от направления к центру Земли на ${sig(q.dev)}°`] },
      { c: ['на экваторе вес исчезает, если ω увеличить в √n = ', b(sig(q.wMul)), ' раз'] },
    ];
    const bl: Block[] = [{ k: 'eq', lines }];
    ex(
      bl,
      'g₀ — ускорение притяжения (на полюсе, где центробежной силы нет). Сила тяжести — сумма притяжения и центробежной силы инерции mω²R cos φ, направленной от оси Земли: на экваторе она наибольшая и направлена против притяжения.',
    );
    steps.push({ title: 'Ускорение силы тяжести на широте φ', blocks: bl });
    rows.push(
      { kind: 'main', val: [v('g'), `(φ) = ${sig(q.gPhi)} м/с²`], note: `n = g₀/(ω²R) = ${sig(q.n)}` },
      { kind: 'aux', val: [`ω′/ω = ${sig(q.wMul)}`], note: 'невесомость на экваторе' },
      { kind: 'aux', val: [v('P'), ` = ${sig(q.P)} ${fu}`], note: 'вес на широте φ' },
    );
  }
  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows }] });
  return { steps };
}
