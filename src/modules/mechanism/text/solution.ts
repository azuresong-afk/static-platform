/** Решение: положение, скорости через МЦС, ускорения методом полюса, мгновенные центры ускорений. */
import { b, sub, sup, v, type AnswerRow, type Block, type Doc, type Inline, type Step } from '../../../shared/doc';
import { fmt } from '../../../shared/format';
import type { MechProblem, MechResult } from '../model/mech';

const f = (x: number) => fmt(x, 4);
const vec = (p: [number, number]) => `(${f(p[0])}; ${f(p[1])})`;
const hyp = (p: [number, number]) => Math.hypot(p[0], p[1]);
const dist = (a: [number, number], c: [number, number]) => Math.hypot(a[0] - c[0], a[1] - c[1]);
const turn = (w: number) => (w > 0 ? 'против часовой стрелки' : 'по часовой стрелке');

export function mechDoc(pr: MechProblem, r: MechResult, opts: { explain?: boolean } = {}): Doc {
  const steps: Step[] = [];
  const ex = (bl: Block[], ...c: Inline[]) => {
    if (opts.explain) bl.push({ k: 'p', cls: 'explain', c });
  };
  if (!r.ok) return { steps: [{ title: 'Данные', blocks: [{ k: 'badge', tone: 'bad', text: 'проверьте механизм' }, { k: 'ul', items: r.errors.map((x) => [x]) }] }] };
  const P = (n: string) => r.points.find((p) => p.name === n)!;
  const B = (n: string) => r.bodies.find((q) => q.name === n)!;
  {
    const lines = r.points.map((p) => ({ c: [b(p.name), ` ${vec(p.pos)}${p.aux ? ' — вспомогательная' : ''}`] as Inline[] }));
    const bl: Block[] = [{ k: 'eq', lines }];
    const nDrive = pr.drives.reduce((s, d) => s + (d.k === 'vec' ? 2 : 1), 0);
    bl.push({ k: 'p', c: [`Подвижность механизма — ${r.dof}; задано условий движения: ${nDrive}.`] });
    ex(bl, 'Координаты построены по заданным длинам и углам. Подвижность — число независимых скоростей, которые нужно задать, чтобы движение всех звеньев стало определённым.');
    steps.push({ title: 'Положение механизма', blocks: bl });
  }
  {
    const lines: { c: Inline[] }[] = [];
    for (const d of pr.drives) {
      if (d.k === 'omega') lines.push({ c: [v('ω'), sub(d.b), ` = ${d.w} = ${f(B(d.b).omega)} рад/с (задана)`] });
      else if (d.k === 'proj') lines.push({ c: [`проекция скорости точки ${d.p} на направление ${d.ang}° = ${d.v} (задана)`] });
      else lines.push({ c: [v('v'), sub(d.p), ` = ${d.v} под углом ${d.vang}° к оси x (задана)`] });
    }
    const bl: Block[] = [{ k: 'eq', lines }];
    for (const name of r.order) {
      const body = B(name),
        pole = r.pole[name],
        bp = pr.bodies.find((q) => q.name === name)!;
      const L: { c: Inline[] }[] = [];
      const others = bp.pts.filter((q) => q !== pole && !P(q).aux);
      if (body.icr == null) {
        L.push({ c: [`Звено ${name}: ω = 0 — движется поступательно (в данный момент), скорости всех точек равны `, v('v'), sub(pole), ` = ${vec(P(pole).v)}, |v| = ${f(hyp(P(pole).v))}`] });
      } else {
        const pv = P(pole),
          d = dist(pv.pos, body.icr);
        const atPole = d < 1e-9 * Math.max(1, ...r.points.map((p) => hyp(p.pos)));
        L.push({ c: [`Звено ${name}: МЦС P`, sub(name), ` ${vec(body.icr)}${atPole ? ` — совпадает с точкой ${pole}` : ''}`] });
        L.push({ c: atPole ? [v('ω'), sub(name), ' = ', b(f(body.omega)), ` рад/с (${turn(body.omega)})`] : [v('ω'), sub(name), ` = v`, sub(pole), `/P${pole} = ${f(hyp(pv.v))}/${f(d)} = `, b(f(Math.abs(body.omega))), ` рад/с (${turn(body.omega)})`] });
        for (const q of others) {
          const pq = P(q);
          L.push({ c: [v('v'), sub(q), ` = ω·P${q} = ${f(Math.abs(body.omega))}·${f(dist(pq.pos, body.icr))} = `, b(f(hyp(pq.v))), `;  `, v('v'), sub(q), ` = ${vec(pq.v)}`] });
        }
      }
      bl.push({ k: 'eq', lines: L });
    }
    ex(bl, 'Мгновенный центр скоростей P звена лежит на пересечении перпендикуляров к скоростям двух его точек; скорость любой точки M звена равна ω·PM и перпендикулярна PM. Если перпендикуляры параллельны (скорости двух точек параллельны и равны), звено движется поступательно: ω = 0. Скорость точки касания колеса с неподвижной поверхностью равна нулю — это МЦС колеса.');
    steps.push({ title: 'Скорости: мгновенные центры скоростей', blocks: bl });
  }
  {
    const lines: { c: Inline[] }[] = [];
    for (const d of pr.drives) if (d.k === 'omega') lines.push({ c: [v('ε'), sub(d.b), ` = ${d.e} (задано)`] });
    const bl: Block[] = lines.length ? [{ k: 'eq', lines }] : [];
    for (const name of r.order) {
      const body = B(name),
        pole = r.pole[name],
        bp = pr.bodies.find((q) => q.name === name)!;
      const pa = P(pole);
      const L: { c: Inline[] }[] = [{ c: [`Звено ${name}: полюс ${pole}, `, v('a'), sub(pole), ` = ${vec(pa.a)};  `, v('ε'), sub(name), ' = ', b(f(body.eps)), ' рад/с²'] }];
      for (const q of bp.pts.filter((x) => x !== pole && !P(x).aux)) {
        const pq = P(q),
          l = dist(pq.pos, pa.pos);
        const an: Inline[] = [v('a'), sup('n'), sub(`${q}${pole}`)],
          at: Inline[] = [v('a'), sup('τ'), sub(`${q}${pole}`)];
        L.push({ c: [v('a'), sub(q), ' = ', v('a'), sub(pole), ' + ', ...an, ' + ', ...at, ';  ', ...an, ` = ω²·${pole}${q} = ${f(body.omega ** 2)}·${f(l)} = ${f(body.omega ** 2 * l)};  `, ...at, ` = |ε|·${pole}${q} = ${f(Math.abs(body.eps) * l)}`] });
        L.push({ c: [v('a'), sub(q), ` = ${vec(pq.a)}, |`, v('a'), sub(q), '| = ', b(f(hyp(pq.a)))] });
      }
      if (body.ica) L.push({ c: [`мгновенный центр ускорений Q`, sub(name), ` ${vec(body.ica)}`] });
      bl.push({ k: 'eq', lines: L });
    }
    ex(bl, 'Ускорение точки B звена: a_B = a_A + aⁿ_BA + aᵗ_BA, где A — полюс (точка с известным ускорением), aⁿ_BA = ω²·AB направлено от B к A, aᵗ_BA = ε·AB перпендикулярно AB. Неизвестные ε и ускорения точек находят, проецируя это равенство на оси с учётом связей (ползун — ускорение вдоль направляющей, неподвижная точка — нулевое). Мгновенный центр ускорений Q — точка звена с нулевым ускорением.');
    steps.push({ title: 'Ускорения: метод полюса', blocks: bl });
  }
  const rows: AnswerRow[] = [
    ...r.bodies.map((q) => ({ kind: 'main' as const, val: [v('ω'), sub(q.name), ` = ${f(q.omega)}, `, v('ε'), sub(q.name), ` = ${f(q.eps)}`] as Inline[], note: q.omega === 0 ? 'ω = 0' : turn(q.omega) })),
    ...r.points
      .filter((p) => !p.aux && (hyp(p.v) > 0 || hyp(p.a) > 0))
      .map((p) => ({ kind: 'aux' as const, val: [v('v'), sub(p.name), ` = ${f(hyp(p.v))}, `, v('a'), sub(p.name), ` = ${f(hyp(p.a))}`] as Inline[], note: `v ${vec(p.v)}, a ${vec(p.a)}` })),
  ];
  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows }] });
  return { steps };
}
