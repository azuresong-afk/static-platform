/** Решение: закон вращения ведущего колеса, передаточные отношения, угловые скорости, точка колеса. */
import { b, sub, v, type AnswerRow, type Block, type Doc, type Inline, type Step } from '../../../shared/doc';
import { printExpr } from '../../../shared/expr';
import { fmt } from '../../../shared/format';
import { LINKS, type GearProblem, type GearResult } from '../model/gears';

const f = (x: number) => fmt(x, 4);
const fp = (x: number) => (x < 0 ? `(${f(x)})` : f(x));
const LINK = Object.fromEntries(LINKS) as Record<string, string>;

export function gearDoc(pr: GearProblem, r: GearResult, opts: { explain?: boolean } = {}): Doc {
  const steps: Step[] = [];
  const ex = (bl: Block[], ...c: Inline[]) => {
    if (opts.explain) bl.push({ k: 'p', cls: 'explain', c });
  };
  if (!r.ok) return { steps: [{ title: 'Данные', blocks: [{ k: 'badge', tone: 'bad', text: 'проверьте данные' }, { k: 'ul', items: r.errors.map((x) => [x]) }] }] };
  const n = pr.wheels.length,
    k = Math.min(Math.max(0, Math.round(pr.k)), n - 1),
    K = String(k + 1);
  {
    const lines: { c: Inline[] }[] = [];
    if (pr.drive === 'phi') {
      lines.push({ c: [v('φ'), sub('1'), `(t) = ${printExpr(r.law.e)}`] });
      lines.push({ c: [v('ω'), sub('1'), ` = φ′₁ = ${printExpr(r.law.d1)};  `, v('ε'), sub('1'), ` = φ″₁ = ${printExpr(r.law.d2)}`] });
    } else {
      const R = f(pr.wheels[0].r);
      lines.push({ c: [v('x'), `(t) = ${printExpr(r.law.e)} — нить (рейка) на колесе 1, r`, sub('1'), ` = ${R}`] });
      lines.push({ c: [v('ω'), sub('1'), ` = ẋ/r`, sub('1'), ` = (${printExpr(r.law.d1)})/${R};  `, v('ε'), sub('1'), ` = ẍ/r`, sub('1'), ` = (${printExpr(r.law.d2)})/${R}`] });
    }
    const bl: Block[] = [{ k: 'eq', lines }];
    ex(bl, pr.drive === 'phi' ? 'Угловая скорость — первая производная угла поворота по времени, угловое ускорение — вторая.' : 'Нить сходит с колеса без проскальзывания: скорость нити равна скорости точек обода, ẋ = ω₁r₁, поэтому ω₁ = ẋ/r₁ и ε₁ = ẍ/r₁.');
    steps.push({ title: pr.drive === 'phi' ? 'Закон вращения колеса 1' : 'Закон движения нити и колесо 1', blocks: bl });
  }
  if (n > 1) {
    const lines: { c: Inline[] }[] = [];
    for (let j = 1; j < n; j++) {
      const w = pr.wheels[j],
        a = pr.wheels[j - 1],
        J = String(j + 1),
        P = String(j);
      if (w.link === 'shaft') {
        lines.push({ c: [v('ω'), sub(J), ' = ', v('ω'), sub(P), ' (на одном валу) ⇒ ', v('ω'), sub(J), '/', v('ω'), sub('1'), ` = ${f(r.wheels[j].i)}`] });
        continue;
      }
      const z = r.by[j] === 'z';
      const s0 = z ? a.z : a.r,
        s1 = z ? w.z : w.r;
      const sym = z ? 'z' : 'r';
      const sign = w.link === 'ext' || w.link === 'cross' ? '−' : '';
      lines.push({ c: [v('ω'), sub(J), ` = ${sign}`, v('ω'), sub(P), '·', v(sym), sub(P), '/', v(sym), sub(J), ` = ${sign}${fp(r.wheels[j - 1].i)}·${f(s0)}/${f(s1)}·`, v('ω'), sub('1'), ` = ${f(r.wheels[j].i)}`, v('ω'), sub('1'), `  (${LINK[w.link]})`] });
    }
    const bl: Block[] = [{ k: 'eq', lines }];
    ex(bl, 'В зацеплении и в ремённой передаче скорости точек касания одинаковы: ω₁r₁ = ω₂r₂, угловые скорости обратно пропорциональны радиусам (или числам зубьев). Внешнее зацепление и перекрёстный ремень меняют направление вращения, внутреннее зацепление и открытый ремень — нет; колёса на одном валу вращаются с одной угловой скоростью.', r.hasBevel ? ' В конической паре оси пересекаются, поэтому направление вращения указывают по чертежу, а знак здесь не меняется.' : '');
    steps.push({ title: 'Передаточные отношения', blocks: bl });
  }
  {
    const lines: { c: Inline[] }[] = [];
    if (pr.find) {
      const tg = pr.unit === 'rpm' ? `${f(pr.target)} об/мин = ${f((pr.target * Math.PI) / 30)} рад/с` : `${f(pr.target)} рад/с`;
      lines.push({ c: [`|ω`, sub(K), `(t)| = ${tg} ⇒ `, r.found != null ? b(`t = ${f(r.found)}`) : `на отрезке [0; ${f(pr.tMax)}] не достигается`] });
    }
    const W = r.wheels[k];
    lines.push({ c: [`при t = ${f(r.t)}: `, v('ω'), sub(K), ' = ', b(f(W.omega)), ' рад/с (', v('n'), sub(K), ' = 30|ω|/π = ', b(f(W.n)), ' об/мин);  ', v('ε'), sub(K), ' = ', b(f(W.eps)), ' рад/с²'] });
    if (pr.drive === 'phi') lines.push({ c: [v('φ'), sub('1'), `(${f(r.t)}) = ${f(r.phi1)} рад`] });
    lines.push({ c: ['Δ', v('φ'), sub(K), ` = ${f(W.dphi)} рад за [0; ${f(r.t)}] — `, b(f(Math.abs(W.turns))), ' об.'] });
    if (n > 1) lines.push({ c: [v('i'), sub(`1${K}`), ' = ', v('ω'), sub('1'), '/', v('ω'), sub(K), ' = ', b(f(r.i1k))] });
    const bl: Block[] = [{ k: 'eq', lines }];
    ex(bl, 'Число оборотов — угол поворота, делённый на 2π (если направление вращения не менялось). Передаточное отношение больше единицы — передача понижающая.');
    steps.push({ title: `Колесо ${K}`, blocks: bl });
  }
  if (r.point) {
    const p = r.point,
      W = r.wheels[k];
    const lines: { c: Inline[] }[] = [
      { c: [`ρ = ${f(p.rho)}:  `, v('v'), ' = |ω|ρ = ', `${f(Math.abs(W.omega))}·${f(p.rho)} = `, b(f(p.v))] },
      { c: [v('a'), sub('τ'), ' = ερ = ', b(f(p.at)), ';  ', v('a'), sub('n'), ` = ω²ρ = ${fp(W.omega)}²·${f(p.rho)} = `, b(f(p.an))] },
      { c: [v('a'), ' = ρ√(ε² + ω⁴) = ', b(f(p.a)), ';  tg μ = |ε|/ω² ⇒ μ = ', `${f(p.mu)}°`] },
    ];
    const bl: Block[] = [{ k: 'eq', lines }];
    ex(bl, 'Скорость точки вращающегося тела направлена по касательной к окружности радиуса ρ. Касательное ускорение a_τ = ερ (знак «+» — точка разгоняется), нормальное a_n = ω²ρ направлено к оси; μ — угол полного ускорения с радиусом. Скорость нити или рейки, сходящей с колеса, равна v.');
    steps.push({ title: `Точка колеса ${K}`, blocks: bl });
  }
  const W = r.wheels[k];
  const rows: AnswerRow[] = [
    ...(pr.find ? [{ kind: 'main' as const, val: [r.found != null ? `t = ${f(r.found)}` : 'не достигается'] as Inline[], note: `|ω${k + 1}| = ${f(pr.target)} ${pr.unit === 'rpm' ? 'об/мин' : 'рад/с'}` }] : []),
    { kind: 'main', val: [v('ω'), sub(K), ` = ${f(W.omega)} рад/с`], note: `n = ${f(W.n)} об/мин` },
    { kind: 'main', val: [v('ε'), sub(K), ` = ${f(W.eps)} рад/с²`], note: `при t = ${f(r.t)}` },
    ...(n > 1 ? [{ kind: 'aux' as const, val: [v('i'), sub(`1${K}`), ` = ${f(r.i1k)}`] as Inline[], note: 'передаточное отношение' }] : []),
    ...(r.point
      ? [
          { kind: 'main' as const, val: [v('v'), ` = ${f(r.point.v)}`] as Inline[], note: `точка на расстоянии ${f(r.point.rho)} от оси` },
          { kind: 'main' as const, val: [v('a'), ` = ${f(r.point.a)}`] as Inline[], note: `a_τ = ${f(r.point.at)}, a_n = ${f(r.point.an)}` },
        ]
      : []),
    { kind: 'aux', val: [`${f(Math.abs(W.turns))} об.`], note: `число оборотов колеса ${K} за [0; ${f(r.t)}]` },
  ];
  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows }] });
  return { steps };
}
