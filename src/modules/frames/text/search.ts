/** Текст решения: поиск положения равновесия и трение в шарнирах. */
import { fmt } from '../../../shared/format';
import { b, sym, v, type Block, type Inline, type Step } from '../../../shared/doc';
import { searchFields } from '../model/search';
import type { SearchUnit, Structure } from '../model/types';
import type { Model } from '../solver/model';
import type { SearchResult } from '../solver/search';
import type { Solution } from '../solver/solve';

const explain = (...c: Inline[]): Block => ({ k: 'p', cls: 'explain', c });

/** Значение параметра с единицей; угол — ещё и в градусах с минутами. */
export function paramText(p: number, unit: SearchUnit): string {
  if (unit === 'deg') {
    const sgn = p < 0 ? '−' : '',
      a = Math.abs(p);
    let d = Math.floor(a),
      mnt = Math.round((a - d) * 60);
    if (mnt === 60) {
      d++;
      mnt = 0;
    }
    return `${fmt(p, 2)}°` + (Math.abs(a - Math.round(a)) > 1e-6 ? ` (${sgn}${d}°${String(mnt).padStart(2, '0')}′)` : '');
  }
  return fmt(p, 4) + (unit === 'm' ? ' м' : '');
}

/** Состояние корня словами. */
export function pointText(pt: SearchResult['points'][number]): string {
  if (pt.kind === 'bound') return 'граница: предельное равновесие';
  if (!pt.ok) return 'не подходит' + (pt.why ? `: ${pt.why}` : '');
  if (pt.stable === true) return 'положение равновесия, устойчивое';
  if (pt.stable === false) return 'положение равновесия, неустойчивое';
  if (pt.stable === null) return 'положение равновесия, безразличное (по первому приближению)';
  return 'положение равновесия';
}

/** Первый шаг решения при поиске положения равновесия. */
export function searchStep(s: Structure, res: SearchResult, pick: number | null, ex: boolean): Step {
  const sr = s.search!;
  const nm = sr.name;
  const P = (p: number) => paramText(p, sr.unit);
  const blocks: Block[] = [
    {
      k: 'p',
      c: [
        'Параметр положения ',
        v(nm),
        ` неизвестен — ищем его на промежутке от ${P(sr.min)} до ${P(sr.max)}.` + (sr.bind.length ? ' Формулами от него заданы:' : ''),
      ],
    },
  ];
  const labels = new Map(searchFields(s).map((f) => [f.ref + ':' + f.field, f]));
  if (sr.bind.length)
    blocks.push({
      k: 'ul',
      items: sr.bind.map((bd): Inline[] => {
        const f = labels.get(bd.ref + ':' + bd.field);
        return [`${f?.label ?? 'поле'} = `, v(bd.expr.trim() || '0'), f?.unit ? ` ${f.unit}` : ''];
      }),
    });
  if (ex && sr.bind.some((b) => /sin|cos|tg|ctg|tan|cot/.test(b.expr)))
    blocks.push(explain('Углы в формулах — в градусах, и тригонометрические функции берутся от градусов: sin 30 = 0,5, arccos 0,5 = 60.'));
  if (res.errors.length) {
    blocks.push({ k: 'badge', tone: 'bad', text: 'Поиск не выполнен' }, { k: 'ul', items: res.errors.map((e) => [e]) });
    return { title: 'Ищем положение равновесия', blocks };
  }
  if (res.mode === 'exact') {
    blocks.push({
      k: 'p',
      c: [
        `Неизвестных реакций ${res.n}, а независимых уравнений равновесия ${res.eqs} — на одно больше. Такая система совместна только при особых значениях `,
        v(nm),
        ': это и есть положения равновесия.',
      ],
    });
    if (ex)
      blocks.push(
        explain(
          'Условие совместности: определитель D(',
          v(nm),
          '), составленный из коэффициентов уравнений ΣX = 0, ΣY = 0, ΣM = 0 каждого тела и столбца свободных членов, равен нулю. ',
          'Вычисляем D на мелкой сетке значений параметра, находим, где он меняет знак, и уточняем корень делением отрезка пополам. ',
          'Каждый корень проверяем полным решением: давления касаний и натяжения нитей не должны быть отрицательными.',
        ),
      );
    if (!res.points.length) blocks.push({ k: 'badge', tone: 'bad', text: 'Положений равновесия на промежутке нет' });
    else
      blocks.push(
        { k: 'p', c: ['Корни на промежутке:'] },
        {
          k: 'ul',
          items: res.points.map((pt, i): Inline[] => [
            i === pick ? b(v(nm), ` = ${P(pt.p)}`) : v(nm),
            ...(i === pick ? [] : [` = ${P(pt.p)}`]),
            ` — ${pointText(pt)}`,
          ]),
        },
      );
    if (ex && res.points.some((pt) => pt.stable !== undefined))
      blocks.push(
        explain(
          'Устойчивость: параметр — координата движения, поэтому обобщённая сила Q = Σ F·dr/d',
          v(nm),
          ' в положении равновесия равна нулю. Если при отклонении она возвращает систему (dQ/d',
          v(nm),
          ' < 0, потенциальная энергия минимальна), равновесие устойчиво, иначе — неустойчиво.',
        ),
      );
  } else {
    blocks.push({
      k: 'p',
      c: [
        'В схеме есть трение или односторонние связи: при каждом значении ',
        v(nm),
        ' реакции ограничены неравенствами, и равновесие возможно на целом промежутке значений параметра.',
      ],
    });
    if (ex)
      blocks.push(
        explain(
          'Для каждого значения параметра проверяем, найдутся ли реакции, удовлетворяющие уравнениям равновесия и неравенствам (N ≥ 0, |Fтр| ≤ f·N), — задача линейного программирования. ',
          'Границы промежутков уточняем делением отрезка пополам: на границе равновесие предельное — трение достигает f·N или связь отрывается.',
        ),
      );
    if (!res.ranges.length) blocks.push({ k: 'badge', tone: 'bad', text: 'Равновесие невозможно ни при каком значении параметра' });
    else {
      blocks.push({
        k: 'p',
        c: ['Равновесие возможно при ', ...res.ranges.flatMap(([a, z], i): Inline[] => [...(i ? ['; '] : []), `${P(a)} ≤ `, v(nm), ` ≤ ${P(z)}`]), '.'],
      });
      if (res.points.length)
        blocks.push({
          k: 'ul',
          items: res.points.map((pt, i): Inline[] => [
            i === pick ? b(v(nm), ` = ${P(pt.p)}`) : v(nm),
            ...(i === pick ? [] : [` = ${P(pt.p)}`]),
            ` — ${pointText(pt)}`,
          ]),
        });
      else blocks.push({ k: 'p', c: ['Границ внутри промежутка поиска нет: равновесие возможно при всех его значениях.'] });
    }
  }
  if (pick != null && res.points[pick]) blocks.push({ k: 'p', c: ['Ниже — расчёт в положении ', b(v(nm), ` = ${P(res.points[pick].p)}`), '.'] });
  else if (!res.errors.length) blocks.push({ k: 'p', c: [`Ниже — расчёт при значении параметра ${P((sr.min + sr.max) / 2)} (середина промежутка).`] });
  return { title: 'Ищем положение равновесия', blocks };
}

/** Шаг «Трение в шарнире»: дополнительные уравнения M_тр = ρ·R и их решение. */
export function pinFrictionStep(m: Model, sol: Solution, ex: boolean): Step {
  const blocks: Block[] = [];
  for (const p of m.pinFr) {
    const M = m.byKey[p.M],
      X = m.byKey[p.X],
      Y = m.byKey[p.Y];
    const fr = p.it.fr!;
    blocks.push({
      k: 'p',
      c: [
        'Шарнир ',
        v(p.P),
        `: коэффициент трения f = ${fmt(fr.f)}, радиус цапфы r = ${fmt(fr.r)} м; тело проворачивается ${fr.rot === 'ccw' ? 'против часовой стрелки' : 'по часовой стрелке'}, момент трения `,
        sym(M),
        ` направлен ${fr.rot === 'ccw' ? 'по часовой стрелке' : 'против часовой стрелки'}.`,
      ],
    });
    const R = Math.hypot(sol.vals[p.X] ?? 0, sol.vals[p.Y] ?? 0);
    blocks.push({
      k: 'eq',
      lines: [
        {
          c: [sym(M), ' = ρ·√(', sym(X), '² + ', sym(Y), '²), ρ = ', ...(fr.circle ? ['r·f/√(1 + f²)'] : ['f·r']), ` = ${fmt(p.rho, 5)} м`],
        },
        ...(sol.status === 'ok' ? [{ num: true, c: [sym(M), ` = ${fmt(p.rho, 5)}·${fmt(R)} = `, b(`${fmt(sol.vals[p.M])} кН·м`)] }] : []),
      ],
    });
  }
  if (ex)
    blocks.push(
      explain(
        'Цапфа прижимается к подшипнику силой R — полной реакцией шарнира. При проворачивании сила трения fR (точнее — полная реакция, отклонённая от нормали на угол трения) создаёт момент относительно оси, равный ρR; ρ называют радиусом круга трения: полная реакция шарнира касается этого круга. ',
        'Уравнение M_тр = ρR нелинейно, поэтому вместе с уравнениями равновесия систему решаем методом Ньютона; начальное приближение — полная реакция шарнира направлена против равнодействующей известных сил' +
          (sol.pinIters ? ` (итераций: ${sol.pinIters}).` : '.'),
      ),
    );
  return { title: 'Учитываем трение в шарнир' + (m.pinFr.length > 1 ? 'ах' : 'е'), blocks };
}
