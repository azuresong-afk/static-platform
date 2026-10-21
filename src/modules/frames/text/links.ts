/**
 * Текст о связях между телами — касаниях и нитях: как они действуют на тела, какие условия накладывают на силы
 * (давление и натяжение не отрицательны, трение не больше f·N) и что с ними происходит в предельном состоянии.
 */
import { join, sym, v, type Inline } from '../../../shared/doc';
import { fmt } from '../../../shared/format';
import { roman } from '../model/geometry';
import type { Active } from '../solver/friction';
import type { LinkInfo, Model } from '../solver/model';

/** Есть ли в системе отдельные тела: тогда части называем телами. */
export const manyBodies = (m: Model): boolean =>
  m.links.length > 0 || m.badLinks.length > 0 || m.offLinks.length > 0 || Object.keys(m.parts.points).length > 0 || m.g.order.some((id) => m.g.body[id] > 0);

/** «тело II» / «часть II» в родительном или винительном падеже — по контексту. */
export const bodyName = (m: Model, p: number): string => `${manyBodies(m) ? 'тело' : 'часть'} ${roman(p)}`;

/** Направление словами: «вправо», «вверх» или «под углом 30° к оси x». */
export function dirWord(a: number): string {
  const t = ((a % 360) + 360) % 360;
  const names: Record<number, string> = { 0: 'вправо', 90: 'вверх', 180: 'влево', 270: 'вниз' };
  for (const k of [0, 90, 180, 270]) if (Math.abs(t - k) < 1e-9) return names[k];
  return `под углом ${fmt(t, 2)}° к оси x`;
}

const pt = (n: string) => v(n);

/** Как связь действует на тела (для шага «Расчленяем систему»). */
export function linkText(m: Model, l: LinkInfo): Inline[] {
  if (l.link.type === 'hinge')
    return [
      'Шарнир в точке ',
      pt(l.B),
      ' (с ней совпадает точка ',
      pt(l.A),
      ` другого тела) соединяет ${bodyName(m, l.on)} и ${bodyName(m, l.from)}: передаёт силу, но не момент. На ${bodyName(m, l.on)} действуют силы `,
      ...join(
        l.list.map((u) => [sym(u)]),
        ', ',
      ),
      `, на ${bodyName(m, l.from)} — такие же силы в обратную сторону.`,
    ];
  if (l.link.type === 'contact') {
    const N = l.list[0],
      T = l.list[1];
    const r: Inline[] = [
      'Касание в точке ',
      pt(l.B),
      ...(l.A !== l.B ? [' (с ней совпадает точка ', pt(l.A), ' другого тела)'] : []),
      `: ${bodyName(m, l.from)} давит на ${bodyName(m, l.on)}, поверхность ${T ? `шероховатая, f = ${fmt(l.f)}` : 'гладкая'}. `,
      'Давление ',
      sym(N),
      ` направлено по общей нормали к поверхностям (${N.angleName ? N.angleName + ' = ' : ''}${fmt(N.angle, 2)}° к оси x)`,
    ];
    if (T) r.push(', сила трения ', sym(T), ` — вдоль касательной (положительное направление — ${dirWord(T.angle)})`);
    r.push(
      `. На ${bodyName(m, l.on)} действу${T ? 'ют эти силы' : 'ет эта сила'}, на ${bodyName(m, l.from)} — так${T ? 'ие же силы' : 'ая же сила'} в обратную сторону (действие равно противодействию).`,
    );
    return r;
  }
  const T = l.list[0];
  const many = l.via.length > 1;
  const r: Inline[] = ['Нить ', pt(l.A), '–', ...l.via.flatMap((n) => [pt(n), '–']), pt(l.B)];
  if (l.via.length)
    r.push(
      ` перекинута через блок${many ? 'и' : ''} `,
      ...join(
        l.via.map((n) => [pt(n)]),
        ', ',
      ),
      ' (размеры блоков и трение на них не учитываем)',
    );
  r.push(': натяжение ', sym(T), ' одно и то же по всей нити. Нить тянет каждое тело к соседней точке нити: ');
  const ends: Inline[] = [];
  const chain = [l.A, ...l.via, l.B];
  const part = (i: number) => (i === 0 ? l.from : i === chain.length - 1 ? l.on : null);
  chain.forEach((n, i) => {
    const p = part(i);
    if (i === 0) ends.push(p != null ? `${bodyName(m, p)} в точке ` : 'в точке ', pt(n), ' — к точке ', pt(chain[1]));
    else if (i === chain.length - 1) ends.push('; ', p != null ? `${bodyName(m, p)} в точке ` : 'в точке ', pt(n), ' — к точке ', pt(chain[i - 1]));
    else ends.push('; блок ', pt(n), ' — две силы ', sym(T), ' вдоль ветвей, к точкам ', pt(chain[i - 1]), ' и ', pt(chain[i + 1]));
  });
  r.push(...ends, '.');
  return r;
}

/** Условия для сил связи: N ≥ 0, −f·N ≤ Fтр ≤ f·N, T ≥ 0. */
export function linkConds(l: LinkInfo): Inline[][] {
  if (l.link.type === 'hinge') return [];
  const N = l.list[0];
  if (l.link.type === 'thread') return [[sym(N), ' ≥ 0 — нить только тянет']];
  const r: Inline[][] = [[sym(N), ' ≥ 0 — тела только давят друг на друга']];
  if (l.list[1]) r.push(['−', v('f'), '·', sym(N), ' ≤ ', sym(l.list[1]), ' ≤ ', v('f'), '·', sym(N), `, f = ${fmt(l.f)}`]);
  return r;
}

/** Предельное состояние связи между телами. */
export function linkActiveText(a: Active, m: Model): Inline[] {
  const l = a.l!;
  if (a.kind === 'slack') return ['нить ', pt(l.A), '–', pt(l.B), ' не натянута (', sym(l.list[0]), ' = 0)'];
  if (a.kind === 'lift')
    return [
      'в точке ',
      pt(l.B),
      ' тела перестают давить друг на друга (',
      sym(l.list[0]),
      ' = 0) — ',
      bodyName(m, l.on),
      ' готово отойти от ',
      bodyName(m, l.from)
        .replace(/^тело/, 'тела')
        .replace(/^часть/, 'части'),
    ];
  const T = l.list[1],
    N = l.list[0];
  const tAng = T.angle + (a.sign > 0 ? 0 : 180);
  return [
    'в точке ',
    pt(l.B),
    ' трение между телами достигло предела: |',
    sym(T),
    '| = ',
    v('f'),
    '·',
    sym(N),
    `; на ${bodyName(m, l.on)} сила трения направлена ${dirWord(tAng)}, значит, оно готово скользить по ${bodyName(m, l.from)
      .replace(/^тело/, 'телу')
      .replace(/^часть/, 'части')} ${dirWord(tAng + 180)}`,
  ];
}

/** Подпись к ответу для силы связи. */
export function linkNote(m: Model, l: LinkInfo, key: string, val: number): string {
  if (l.link.type === 'hinge') return `шарнир ${l.B}: сила на ${bodyName(m, l.on)}, на ${bodyName(m, l.from)} — в обратную сторону`;
  if (l.link.type === 'thread') return val < 0 ? 'нить не может сжиматься' : 'натяжение нити';
  if (key === l.list[0].key) return `давление на ${bodyName(m, l.on)}, на ${bodyName(m, l.from)} — в обратную сторону` + (val < 0 ? '; тела не прижаты' : '');
  return `трение на ${bodyName(m, l.on)}, на ${bodyName(m, l.from)} — в обратную сторону`;
}

/** Связи, которые не учтены, — с причиной. */
export function badLinkText(m: Model): Inline[][] {
  return m.badLinks.map(({ link, why }) => {
    const A = m.g.name[link.a],
      B = m.g.name[link.b];
    const what: Inline[] = [link.type === 'contact' ? 'Касание ' : link.type === 'hinge' ? 'Шарнир ' : 'Нить ', pt(A), '–', pt(B)];
    const reason = why === 'apart' ? 'точки не совпадают' : why === 'same' ? 'обе точки принадлежат одному телу' : 'соседние точки нити совпадают';
    return [...what, ` не учтен${link.type === 'contact' ? 'о' : link.type === 'hinge' ? '' : 'а'}: ${reason}.`];
  });
}
