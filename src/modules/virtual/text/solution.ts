/**
 * Решение принципом возможных перемещений: для каждой неизвестной — какую связь отбрасываем, как перемещаются
 * части конструкции, работы нагрузок, уравнение работ, сравнение с уравнениями равновесия.
 */
import { b, join, sub, sym, type Block, type Doc, type Inline, type Step } from '../../../shared/doc';
import { fmt } from '../../../shared/format';
import { roman, type Pt } from '../../frames/model/geometry';
import type { Model, Unknown } from '../../frames/solver/model';
import type { Release } from '../model/virtual';

export interface VirtualTextOptions {
  explain?: boolean;
}

const EPS = 1e-9;
const f3 = (x: number) => fmt(Math.abs(x) < EPS ? 0 : x, 4);
const deg = (a: number) => (((Math.round(a * 1e6) / 1e6) % 360) + 360) % 360;

/** «δs» для силы, «δφ» для пары; с индексом точки. */
export function deltaOf(u: Unknown): Inline[] {
  return u.kind === 'm' ? ['δφ', sub(u.S)] : ['δs', sub(u.S)];
}

/** Куда направлена сила: «вдоль оси x», «под углом 120° к оси x». */
function dirText(angle: number): string {
  const a = deg(angle);
  if (a === 0) return 'вправо (по оси x)';
  if (a === 180) return 'влево';
  if (a === 90) return 'вверх (по оси y)';
  if (a === 270) return 'вниз';
  return `под углом ${fmt(a, 2)}° к оси x`;
}

/** Имя точки с координатами (x; y) или «точка (x; y)». */
function pointName(m: Model, P: Pt): string {
  const hit = m.pts.find((p) => Math.hypot(p.x - P[0], p.y - P[1]) < 1e-7);
  return hit ? `точки ${hit.name}` : `точки (${fmt(P[0], 3)}; ${fmt(P[1], 3)})`;
}

function releaseText(u: Unknown): Inline[] {
  if (u.support === 'fixed' && u.kind === 'm')
    return [
      'Заменяем заделку ',
      b(u.S),
      ' шарнирно-неподвижной опорой: поворот сечения ',
      u.S,
      ' теперь возможен, вместо запрета поворота действует реактивный момент ',
      sym(u),
      ' (против часовой — «+»).',
    ];
  if (u.support)
    return [
      'Отбрасываем связь, не дающую точке ',
      b(u.S),
      ' перемещаться ',
      dirText(u.angle),
      ', и заменяем её реакцией ',
      sym(u),
      '. Остальные связи сохраняем.',
    ];
  return [
    'Искомая нагрузка ',
    sym(u),
    ' — неизвестная активная сила',
    u.kind === 'm' ? ' (пара)' : '',
    '. Связи не трогаем: конструкция с такой нагрузкой и так допускает перемещение.',
  ];
}

export function virtualDoc(m: Model, releases: Release[], opts: VirtualTextOptions = {}): Doc {
  const steps: Step[] = [];
  const ex = (bl: Block[], ...c: Inline[]) => {
    if (opts.explain) bl.push({ k: 'p', cls: 'explain', c });
  };
  {
    const bl: Block[] = [
      {
        k: 'p',
        c: [
          'Принцип возможных перемещений: система с идеальными связями находится в равновесии, если сумма работ всех активных сил на любом возможном перемещении равна нулю: ',
          b('Σ δA = 0'),
          '. Чтобы найти реакцию, отбрасываем её связь и считаем реакцию активной силой: конструкция становится механизмом с одной степенью свободы, и в уравнение работ входит одна неизвестная.',
        ],
      },
    ];
    if (m.parts.count > 1)
      bl.push({
        k: 'p',
        c: [
          'Конструкция состоит из ',
          String(m.parts.count),
          ' частей, соединённых шарнирами: ',
          ...join(
            m.partNames.map((ns, i) => [roman(i), ' (', ns.join(', '), ')']),
            '; ',
          ),
          '.',
        ],
      });
    ex(
      bl,
      'Возможное перемещение каждой жёсткой части — малый поворот вокруг мгновенного центра (или поступательный сдвиг). Центр находится по точкам, перемещения которых известны: у неподвижного шарнира или шарнира, соединяющего с неподвижной частью, перемещение нулевое; у катка — вдоль опорной поверхности; центр лежит на перпендикулярах к перемещениям точек. Перемещение точки на расстоянии r от центра равно r·δφ.',
    );
    steps.push({ title: 'Принцип возможных перемещений', blocks: bl });
  }
  for (const r of releases) {
    const u = r.unknown;
    const d = deltaOf(u);
    const bl: Block[] = [{ k: 'p', c: releaseText(u) }];
    // Перемещения частей.
    const items: Inline[][] = r.motions.map((mo, p) => {
      const head: Inline[] = m.parts.count > 1 ? ['часть ', roman(p), ' (', m.partNames[p].join(', '), ')'] : ['конструкция'];
      if (mo.kind === 'still') return [...head, ' неподвижна'];
      if (mo.kind === 'rot')
        return [
          ...head,
          ' поворачивается вокруг ',
          pointName(m, mo.center!),
          ' на угол ',
          f3(Math.abs(mo.dphi)),
          '·',
          ...d,
          mo.dphi > 0 ? ' против часовой стрелки' : ' по часовой стрелке',
        ];
      const ang = (Math.atan2(mo.dy, mo.dx) * 180) / Math.PI;
      return [...head, ' перемещается поступательно на ', f3(Math.hypot(mo.dx, mo.dy)), '·', ...d, ' ', dirText(ang)];
    });
    bl.push({
      k: 'p',
      c:
        u.kind === 'm'
          ? ['Даём сечению ', u.S, ' возможный поворот ', ...d, ' в положительную сторону ', sym(u), ' (против часовой стрелки). Тогда:']
          : ['Даём точке ', u.S, ' возможное перемещение ', ...d, ' вдоль ', sym(u), ' (', dirText(u.angle), '). Тогда:'],
    });
    bl.push({ k: 'ul', items });
    if (!r.unique)
      bl.push({
        k: 'p',
        cls: 'explain',
        c: [
          'Связей меньше, чем нужно для неподвижности, поэтому возможных перемещений больше одного; взято одно из них — ответ от выбора не зависит, раз равновесие есть.',
        ],
      });
    // Работы.
    const working = r.terms.filter((t) => Math.abs(t.work) > EPS * Math.max(1, Math.abs(t.act.val)));
    const idle = r.terms.filter((t) => !working.includes(t));
    const lines: { c: Inline[] }[] = working.map((t) => {
      const what: Inline[] =
        t.act.kind === 'm'
          ? ['поворот части ', m.parts.count > 1 ? roman(t.part) : '', ' ', f3(t.disp), '·', ...d]
          : ['перемещение точки вдоль силы ', f3(t.disp), '·', ...d];
      return { c: ['δA(', sym(t.act), ') = ', f3(t.act.val), '·(', f3(t.disp), ')·', ...d, ' = ', b(f3(t.work)), '·', ...d, '   — ', ...what] };
    });
    if (lines.length) bl.push({ k: 'eq', lines });
    if (idle.length)
      bl.push({
        k: 'p',
        c: [
          'Работы не совершают: ',
          ...join(
            idle.map((t) => [sym(t.act)]),
            ', ',
          ),
          ' (точки приложения неподвижны или перемещаются перпендикулярно силе).',
        ],
      });
    // Уравнение.
    const sumParts: Inline[] = [sym(u), '·', ...d];
    for (const t of working) sumParts.push(t.work < 0 ? ' − ' : ' + ', f3(Math.abs(t.work)), '·', ...d);
    const ok = Math.abs(r.value - r.ref) <= 1e-7 * Math.max(1, Math.abs(r.ref));
    bl.push({
      k: 'eq',
      lines: [{ c: ['Σ δA = ', ...sumParts, ' = 0'] }, { c: [sym(u), ' = ', b(f3(r.value))] }],
    });
    bl.push({ k: 'p', c: ['Из уравнений равновесия («Балки и рамы»): ', sym(u), ' = ', f3(r.ref), ok ? ' — совпадает ✓' : ' — не совпадает!'] });
    ex(
      bl,
      'Знак «−» означает, что ',
      sym(u),
      ' направлена против стрелки на расчётной схеме. Работа силы — произведение силы на проекцию перемещения точки приложения на её направление; работа пары — момент на угол поворота части.',
    );
    steps.push({ title: `${u.support ? 'Реакция' : 'Неизвестная нагрузка'} ${u.L}${u.S ? '_' + u.S : ''}`, blocks: bl });
  }
  steps.push({
    title: 'Ответ',
    blocks: [
      {
        k: 'answer',
        rows: releases.map((r) => ({
          kind: 'main' as const,
          val: [sym(r.unknown), ' = ', f3(r.value)],
          note:
            Math.abs(r.value - r.ref) <= 1e-7 * Math.max(1, Math.abs(r.ref)) ? 'совпадает с уравнениями равновесия' : `уравнения равновесия дают ${f3(r.ref)}`,
        })),
      },
    ],
  });
  return { steps };
}
