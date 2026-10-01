/** Решение: переносное и относительное движения, сложение скоростей, теорема Кориолиса. */
import { b, sub, sup, v, type AnswerRow, type Block, type Doc, type Inline, type Step } from '../../../shared/doc';
import { printExpr } from '../../../shared/expr';
import { fmt } from '../../../shared/format';
import { norm, type RelProblem, type RelResult } from '../model/rel';

type V3 = [number, number, number];
const f = (x: number) => fmt(x, 4);
const vec = (p: V3, planar: boolean) => `(${f(p[0])}; ${f(p[1])}${planar ? '' : `; ${f(p[2])}`})`;
const AX = ['ξ', 'η', 'ζ'];

export function relDoc(pr: RelProblem, r: RelResult, opts: { explain?: boolean } = {}): Doc {
  const steps: Step[] = [];
  const ex = (bl: Block[], ...c: Inline[]) => {
    if (opts.explain) bl.push({ k: 'p', cls: 'explain', c });
  };
  if (!r.ok) return { steps: [{ title: 'Данные', blocks: [{ k: 'badge', tone: 'bad', text: 'проверьте данные' }, { k: 'ul', items: r.errors.map((x) => [x]) }] }] };
  // Плоская задача — всё в плоскости ξη.
  const planar = [r.pos, r.v, r.a].every((q) => Math.abs(q[2]) < 1e-12) && r.rho[2].k === 'num';
  const V = (p: V3) => vec(p, planar);
  const rot = pr.carrier === 'rot';
  {
    const lines: { c: Inline[] }[] = [];
    if (rot) {
      lines.push({ c: [v('φ'), `(t) = ${printExpr(r.carrier.e[0])}`] });
      lines.push({ c: [v('ω'), sub('e'), ` = φ′ = ${printExpr(r.carrier.d1[0])} = `, b(f(r.omega)), ' рад/с;  ', v('ε'), sub('e'), ` = φ″ = ${printExpr(r.carrier.d2[0])} = `, b(f(r.eps)), ' рад/с²'] });
    } else {
      ['x', 'y', 'z'].forEach((n, i) => {
        if (!(i === 2 && planar)) lines.push({ c: [v(n), `(t) = ${printExpr(r.carrier.e[i])};  `, v('v'), sub(`e${n}`), ` = ${printExpr(r.carrier.d1[i])};  `, v('a'), sub(`e${n}`), ` = ${printExpr(r.carrier.d2[i])}`] });
      });
    }
    const bl: Block[] = [{ k: 'eq', lines }];
    ex(bl, rot ? `Переносное движение — вращение тела вокруг неподвижной оси ζ; ω > 0 — против часовой стрелки, если смотреть с конца оси ζ${planar ? ' (на чертёж)' : ''}. Векторы ниже — в осях ξηζ, связанных с телом, в рассматриваемый момент.` : 'Переносное движение поступательное: переносные скорость и ускорение одинаковы для всех точек тела, кориолисово ускорение равно нулю.');
    steps.push({ title: rot ? 'Переносное движение: вращение тела' : 'Переносное движение: поступательное', blocks: bl });
  }
  {
    const lines: { c: Inline[] }[] = [];
    r.rho.forEach((e, i) => {
      if (i === 2 && planar) return;
      lines.push({ c: [v(AX[i]), `(t) = ${printExpr(e)};  `, v(AX[i]), '′ = ', printExpr(r.d1[i]), ';  ', v(AX[i]), '″ = ', printExpr(r.d2[i])] });
    });
    lines.push({ c: [`при t = ${f(pr.t)}: M ${V(r.pos)};  `, v('v'), sub('r'), ` = ${V(r.vr)}, |`, v('v'), sub('r'), '| = ', b(f(norm(r.vr)))] });
    lines.push({ c: [v('a'), sub('r'), ` = ${V(r.ar)}, |`, v('a'), sub('r'), `| = ${f(norm(r.ar))};  `, v('a'), sup('τ'), sub('r'), ` = ${f(r.arT)}, `, v('a'), sup('n'), sub('r'), ` = ${f(r.arN)}${r.rhoR != null ? ` (ρ = ${f(r.rhoR)})` : ''}`] });
    const bl: Block[] = [{ k: 'eq', lines }];
    ex(bl, pr.path === 'line' ? 'Относительное движение — по прямой: ρ = ρ₀ + s(t)·e; относительные скорость и ускорение направлены вдоль прямой.' : pr.path === 'circle' ? 'Относительное движение — по окружности: касательное относительное ускорение s̈, нормальное v_r²/R — к центру окружности.' : 'Относительное движение задано координатами точки в осях тела; относительные скорость и ускорение — их производные (тело при этом считается неподвижным).');
    steps.push({ title: 'Относительное движение', blocks: bl });
  }
  {
    const h = Math.hypot(r.pos[0], r.pos[1]);
    const lines: { c: Inline[] }[] = rot ? [{ c: [v('v'), sub('e'), ' = ω × ρ, |', v('v'), sub('e'), `| = |ω|·h = ${f(Math.abs(r.omega))}·${f(h)} = `, b(f(norm(r.ve))), `;  `, v('v'), sub('e'), ` = ${V(r.ve)}`] }] : [{ c: [v('v'), sub('e'), ` = ${V(r.ve)}, |`, v('v'), sub('e'), '| = ', b(f(norm(r.ve)))] }];
    lines.push({ c: [v('v'), ' = ', v('v'), sub('e'), ' + ', v('v'), sub('r'), ` = ${V(r.v)};  |`, v('v'), '| = ', b(f(norm(r.v)))] });
    const bl: Block[] = [{ k: 'eq', lines }];
    ex(bl, rot ? 'Переносная скорость — скорость той точки тела, где сейчас находится M: перпендикулярна плоскости, проходящей через ось и точку, по модулю ω·h, h — расстояние до оси.' : 'Абсолютная скорость — векторная сумма переносной и относительной.');
    steps.push({ title: 'Сложение скоростей', blocks: bl });
  }
  {
    const h = Math.hypot(r.pos[0], r.pos[1]);
    const lines: { c: Inline[] }[] = [];
    if (rot) {
      lines.push({ c: [v('a'), sup('τ'), sub('e'), ` = |ε|·h = ${f(Math.abs(r.eps))}·${f(h)} = ${f(norm(r.aet))};  `, v('a'), sup('τ'), sub('e'), ` = ${V(r.aet)}`] });
      lines.push({ c: [v('a'), sup('n'), sub('e'), ` = ω²·h = ${f(r.omega ** 2)}·${f(h)} = ${f(norm(r.aen))} (к оси);  `, v('a'), sup('n'), sub('e'), ` = ${V(r.aen)}`] });
      const sinA = norm(r.vr) > 1e-12 ? Math.hypot(r.vr[0], r.vr[1]) / norm(r.vr) : 0;
      lines.push({ c: [v('a'), sub('c'), ` = 2ω × v`, sub('r'), `, |`, v('a'), sub('c'), `| = 2|ω|·v`, sub('r'), `·sin(ω, v`, sub('r'), `) = 2·${f(Math.abs(r.omega))}·${f(norm(r.vr))}·${f(sinA)} = `, b(f(norm(r.ac))), `;  `, v('a'), sub('c'), ` = ${V(r.ac)}`] });
    } else lines.push({ c: [v('a'), sub('e'), ` = ${V(r.aet)}, |`, v('a'), sub('e'), `| = ${f(norm(r.aet))};  `, v('a'), sub('c'), ' = 0'] });
    lines.push({ c: [v('a'), sub('r'), ` = ${V(r.ar)}`] });
    lines.push({ c: [v('a'), ' = ', rot ? [v('a'), sup('τ'), sub('e'), ' + ', v('a'), sup('n'), sub('e'), ' + ', v('a'), sub('r'), ' + ', v('a'), sub('c')].flat() : [v('a'), sub('e'), ' + ', v('a'), sub('r')].flat(), ` = ${V(r.a)};  |`, v('a'), '| = ', b(f(norm(r.a)))].flat() });
    if (r.aT != null) lines.push({ c: [`проекции a на касательную и нормаль относительной траектории: ${f(r.aT)} и ${r.aN != null ? f(r.aN) : '—'}`] });
    const bl: Block[] = [{ k: 'eq', lines }];
    ex(bl, 'Теорема Кориолиса: a = a_e + a_r + a_c. Кориолисово ускорение a_c = 2ω_e × v_r перпендикулярно оси вращения и относительной скорости; оно равно нулю, если переносное движение поступательное, если v_r параллельна оси или v_r = 0.');
    steps.push({ title: 'Сложение ускорений (теорема Кориолиса)', blocks: bl });
  }
  const rows: AnswerRow[] = [
    { kind: 'main', val: [v('v'), ` = ${f(norm(r.v))}`], note: `v_e = ${f(norm(r.ve))}, v_r = ${f(norm(r.vr))}` },
    { kind: 'main', val: [v('a'), ` = ${f(norm(r.a))}`], note: `проекции на ${planar ? 'ξ, η' : 'ξ, η, ζ'}: ${V(r.a)}` },
    { kind: 'aux', val: [v('a'), sub('c'), ` = ${f(norm(r.ac))}`], note: 'кориолисово' },
    { kind: 'aux', val: [v('a'), sub('e'), ` = ${f(norm([r.aet[0] + r.aen[0], r.aet[1] + r.aen[1], r.aet[2] + r.aen[2]]))}, `, v('a'), sub('r'), ` = ${f(norm(r.ar))}`], note: 'переносное и относительное' },
  ];
  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows }] });
  return { steps };
}
