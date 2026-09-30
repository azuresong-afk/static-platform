/**
 * Решение с трением и односторонними связями: освобождение от связей, уравнения равновесия,
 * условия для реакций (неравенства), предельные состояния на границах искомой величины, ответ.
 */
import { b, join, sub, sym, v, type Block, type Doc, type Inline } from '../../../shared/doc';
import { fmt } from '../../../shared/format';
import { SIDES, TYPES } from '../model/constants';
import type { Active, Extreme } from '../solver/friction';
import type { Model, SupportInfo } from '../solver/model';
import type { Solution } from '../solver/solve';
import { eqSym, type SolutionOptions } from './solution';
import { forceDirText } from './labels';
import type { ForceItem } from '../model/types';

const ku = (s: SupportInfo, L: string) => s.list.find((u) => u.L === L)!;
const unit = (kind: string) => (kind === 'm' ? 'кН·м' : 'кН');

/** Направление по углу словами: «вправо», «вверх» или «под углом 30° к оси x». */
function dirWord(a: number): string {
  const t = ((a % 360) + 360) % 360;
  const names: Record<number, string> = { 0: 'вправо', 90: 'вверх', 180: 'влево', 270: 'вниз' };
  for (const k of [0, 90, 180, 270]) if (Math.abs(t - k) < 1e-9) return names[k];
  return `под углом ${fmt(t, 2)}° к оси x`;
}

function activeText(a: Active, m: Model, all: Active[]): Inline[] {
  const s = a.s,
    P = v(s.P);
  if (a.kind === 'lift') {
    // Опрокидывание вокруг единственной оставшейся опоры — называем её.
    const rest = m.supports.filter((q) => q !== s && !all.some((x) => x.s === q && x.kind === 'lift'));
    const around: Inline[] = rest.length === 1 ? [' вокруг точки ', v(rest[0].P)] : [' вокруг других опор'];
    return ['связь в точке ', P, ' перестаёт давить (', sym(s.list[0]), ' = 0) — тело готово оторваться от неё и опрокинуться', ...around];
  }
  if (a.kind === 'roll') {
    const M = ku(s, 'Mк'),
      N = ku(s, 'N');
    return ['в точке ', P, ' момент сопротивления качению достиг предела: ', sym(M), ` = ${a.sign > 0 ? '' : '−'}`, v('k'), '·', sym(N), ' — начинается качение'];
  }
  const T = ku(s, 'Fтр'),
    N = ku(s, 'N');
  // Сила трения направлена против возможного скольжения.
  const tAng = T.angle + (a.sign > 0 ? 0 : 180);
  return ['в точке ', P, ' сила трения достигла предела: |', sym(T), '| = ', v('f'), '·', sym(N), `; она направлена ${dirWord(tAng)}, значит, точка готова скользить ${dirWord(tAng + 180)}`];
}

export function frictionDoc(m: Model, sol: Solution, opts: SolutionOptions = {}): Doc {
  const fr = sol.friction!;
  const steps: Doc['steps'] = [];
  const ex = !!opts.explain;
  const explain = (...c: Inline[]): Block => ({ k: 'p', cls: 'explain', c });
  const param = fr.param;

  // 1. Связи.
  const li: Inline[][] = m.supports.map((s) => {
    const it = s.it;
    const side = 'side' in it && it.side !== 'tilt' ? `, опорная поверхность ${SIDES[it.side].name}` : '';
    if (it.type === 'rough') {
      const N = ku(s, 'N'),
        T = ku(s, 'Fтр');
      const M = s.list.find((u) => u.L === 'Mк');
      return [
        `${TYPES.rough.name} `,
        v(s.P),
        `${side}: нормальная реакция `,
        sym(N),
        ` ≥ 0 (угол ${fmt(N.angle, 2)}° к оси x) и сила трения `,
        sym(T),
        ` вдоль поверхности (положительное направление — ${dirWord(T.angle)}), |`,
        sym(T),
        '| ≤ ',
        v('f'),
        '·',
        sym(N),
        `, f = ${fmt(it.f)}`,
        ...(M ? ['; момент сопротивления качению |', sym(M), '| ≤ ', v('k'), '·', sym(N), `, k = ${fmt(it.k ?? 0)} м`] : []),
      ];
    }
    const us = join(s.list.map((u) => [sym(u)]), ', ');
    if (it.type === 'roller') return [`${TYPES.roller.name} `, v(s.P), `${side} → реакция `, ...us, it.oneSided ? ' ≥ 0: связь односторонняя, опора может только давить' : ` по нормали, угол ${fmt(it.angle as number, 2)}° к оси x`];
    return [`${TYPES[it.type].name} `, v(s.P), ' → ', ...us];
  });
  if (param)
    li.push(
      param.kind === 'f'
        ? ['Сила ', sym(param), `: ${forceDirText(param.item as ForceItem)}; ищем, при каких значениях возможно равновесие`]
        : ['Момент ', sym(param), ': ищем, при каких значениях возможно равновесие'],
    );
  const b1: Block[] = [{ k: 'p', c: ['Отбрасываем опоры и заменяем их действие реакциями:'] }, { k: 'ul', items: li }];
  if (ex)
    b1.push(
      explain(
        'Сила трения покоя может быть любой — от нуля до предельной f·N, — и направлена против того скольжения, которое произошло бы без неё. ',
        'Поэтому реакции здесь не находятся из одних уравнений равновесия: вместо единственного ответа получаются условия — неравенства. ',
        'Равновесие возможно, пока все они выполняются; на границе одна из связей достигает предела (скольжение, качение или отрыв) — это предельное равновесие.',
      ),
    );
  steps.push({ title: 'Освобождаемся от связей', blocks: b1 });

  if (fr.tooMany) {
    steps.push({ title: 'Что ищем', blocks: [{ k: 'p', c: ['При трении ищем одну величину: оставьте неизвестной только одну нагрузку (или ни одной — тогда проверим, возможно ли равновесие).'] }] });
    return { steps };
  }

  // 2. Уравнения и неравенства.
  const b2: Block[] = [
    { k: 'p', c: ['Уравнения равновесия (', v('X'), ' — вправо, ', v('Y'), ' — вверх, моменты — против часовой стрелки):'] },
    { k: 'eq', lines: fr.eqs.map((e) => ({ c: eqSym(e) })) },
    { k: 'p', c: ['Условия для реакций:'] },
    {
      k: 'ul',
      items: m.supports.flatMap((s): Inline[][] => {
        const it = s.it;
        if (it.type === 'rough') {
          const N = ku(s, 'N'),
            T = ku(s, 'Fтр'),
            M = s.list.find((u) => u.L === 'Mк');
          const r: Inline[][] = [[sym(N), ' ≥ 0'], ['−', v('f'), '·', sym(N), ' ≤ ', sym(T), ' ≤ ', v('f'), '·', sym(N), `, f = ${fmt(it.f)}`]];
          if (M) r.push(['−', v('k'), '·', sym(N), ' ≤ ', sym(M), ' ≤ ', v('k'), '·', sym(N), `, k = ${fmt(it.k ?? 0)} м`]);
          return r;
        }
        if (it.type === 'roller' && it.oneSided) return [[sym(s.list[0]), ' ≥ 0']];
        return [];
      }),
    },
  ];
  if (ex)
    b2.push(
      explain(
        'Неизвестных больше, чем уравнений, поэтому система имеет много решений; из них допустимы те, где выполнены неравенства. ',
        param ? 'Искомая величина может меняться в пределах, при которых такое решение существует; границы находятся там, где выполнение неравенств становится невозможным.' : '',
      ),
    );
  steps.push({ title: 'Уравнения равновесия и условия для реакций', blocks: b2 });

  // 3. Без искомой нагрузки — только проверка.
  if (!param) {
    const b3: Block[] = [];
    if (fr.feasible) b3.push({ k: 'badge', tone: 'ok', text: 'равновесие возможно' }, { k: 'p', c: ['Существуют реакции, удовлетворяющие и уравнениям, и всем условиям, — тело остаётся в покое.'] });
    else b3.push({ k: 'badge', tone: 'bad', text: 'равновесие невозможно' }, { k: 'p', c: ['Уравнения равновесия нельзя удовлетворить при допустимых реакциях: тело скользит, катится или опрокидывается.'] });
    const rough = m.supports.filter((s) => s.it.type === 'rough');
    if (fr.lambda != null && rough.length) {
      const fs = rough.map((s) => (s.it.type === 'rough' ? s.it.f : 0));
      const same = fs.every((f) => Math.abs(f - fs[0]) < 1e-12);
      if (same)
        b3.push({
          k: 'p',
          c: ['Наименьший коэффициент трения, при котором равновесие возможно: ', v('f'), sub('min'), ' = ', b(fmt(fr.lambda * fs[0])), `${fr.feasible ? ' — заданный f не меньше.' : ' — заданный f меньше, поэтому равновесия нет.'}`],
        });
      else b3.push({ k: 'p', c: [`Равновесие станет ${fr.feasible ? 'невозможным' : 'возможным'}, если все коэффициенты трения умножить на ${fmt(fr.lambda)}.`] });
    } else if (!fr.feasible && rough.length) b3.push({ k: 'p', c: ['Никакое трение не удержит тело: мешают отрыв или опрокидывание.'] });
    steps.push({ title: 'Возможно ли равновесие', blocks: b3 });
    steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows: [{ kind: 'main', val: [fr.feasible ? 'равновесие возможно' : 'равновесие невозможно'], note: fr.lambda != null ? 'см. наименьший коэффициент трения' : '' }] }] });
    return { steps };
  }

  // 4. Границы.
  const u = unit(param.kind);
  if (!fr.feasible) {
    steps.push({ title: 'Ответ', blocks: [{ k: 'badge', tone: 'bad', text: 'равновесие невозможно' }, { k: 'p', c: ['Ни при каком значении ', sym(param), ' условия для реакций не выполняются.'] }] });
    return { steps };
  }
  const bound = (e: Extreme, which: 'min' | 'max') => {
    const bl: Block[] = [];
    if (!isFinite(e.value)) {
      bl.push({ k: 'p', c: [which === 'max' ? 'Наибольшего значения нет: ' : 'Наименьшего значения нет: ', sym(param), which === 'max' ? ' может расти неограниченно — связи удерживают тело при любой такой нагрузке.' : ' может убывать неограниченно.'] });
      return bl;
    }
    bl.push({ k: 'p', c: ['При ', sym(param), ' = ', b(`${fmt(e.value)} ${u}`), ' — предельное равновесие:'] });
    bl.push({ k: 'ul', items: e.active.map((a) => activeText(a, m, e.active)) });
    if (e.vals)
      bl.push({
        k: 'eq',
        lines: [
          {
            num: true,
            c: join(
              m.unknowns.filter((x) => x.key !== param.key).map((x) => [sym(x), ` = ${fmt(e.vals![x.key])} ${unit(x.kind)}`]),
              '; ',
            ),
          },
        ],
      });
    bl.push({
      k: 'p',
      c: [which === 'max' ? 'При большем значении ' : 'При меньшем значении ', sym(param), ' это условие нарушится и равновесие станет невозможным.'],
    });
    return bl;
  };
  steps.push({ title: `Наибольшее значение`, blocks: bound(fr.max!, 'max') });
  steps.push({ title: `Наименьшее значение`, blocks: bound(fr.min!, 'min') });
  if (ex)
    steps[steps.length - 1].blocks.push(
      explain(
        'В предельном состоянии неравенство для связи обращается в равенство (например, Fтр = f·N или N = 0), и неизвестных становится столько же, сколько уравнений. ',
        'Отрицательное значение границы означает, что нагрузку можно направить и в противоположную сторону.',
      ),
    );

  // 5. Ответ.
  const lo = fr.min!.value,
    hi = fr.max!.value;
  const range: Inline[] = isFinite(lo) && isFinite(hi) ? [`${fmt(lo)} ≤ `, sym(param), ` ≤ ${fmt(hi)} ${u}`] : isFinite(lo) ? [sym(param), ` ≥ ${fmt(lo)} ${u}`] : isFinite(hi) ? [sym(param), ` ≤ ${fmt(hi)} ${u}`] : [sym(param), ' — любое'];
  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows: [{ kind: 'main', val: range, note: 'равновесие возможно' }] }] });
  return { steps };
}
