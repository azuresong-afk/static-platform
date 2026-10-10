/**
 * Решение: положение, скорости через МЦС, кулисный камень (сложное движение точки), ускорения методом полюса,
 * мгновенные центры ускорений; равновесие по принципу возможных перемещений, кинетическая энергия механизма,
 * теорема об изменении кинетической энергии, наибольшее и наименьшее значения по графику.
 */
import { b, sub, sup, v, type AnswerRow, type Block, type Doc, type Inline, type Step } from '../../../shared/doc';
import { fmt } from '../../../shared/format';
import type { MechProblem } from '../model/mech';
import type { MechSolution } from '../model/solve';

const f = (x: number) => fmt(x, 4);
const vec = (p: [number, number]) => `(${f(p[0])}; ${f(p[1])})`;
const hyp = (p: [number, number]) => Math.hypot(p[0], p[1]);
const dist = (a: [number, number], c: [number, number]) => Math.hypot(a[0] - c[0], a[1] - c[1]);
const turn = (w: number) => (w > 0 ? 'против часовой стрелки' : 'по часовой стрелке');

export function mechDoc(pr: MechProblem, r: MechSolution, opts: { explain?: boolean } = {}): Doc {
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
    if (r.phi != null) bl.unshift({ k: 'p', c: ['Параметр положения ', v('φ'), ` = ${f(r.phi)}°.`] });
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
  if (r.guides.length) steps.push(guideStep(pr, r, ex));
  if (pr.acc !== false) {
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
  steps.push(...dynSteps(pr, r, ex));
  const acc = pr.acc !== false;
  const rows: AnswerRow[] = [
    ...dynRows(r),
    ...r.bodies.map((q) => ({ kind: 'main' as const, val: [v('ω'), sub(q.name), ` = ${f(q.omega)}`, ...(acc ? [', ', v('ε'), sub(q.name), ` = ${f(q.eps)}`] : [])] as Inline[], note: q.omega === 0 ? 'ω = 0' : turn(q.omega) })),
    ...r.guides.map((g) => ({
      kind: 'main' as const,
      val: [v('v'), sub('r'), ` камня ${g.p} = ${f(Math.abs(g.vr))}`, ...(acc ? [', ', v('a'), sub('r'), ` = ${f(Math.abs(g.ar))}, `, v('a'), sub('c'), ` = ${f(hyp(g.ac))}`] : [])] as Inline[],
      note: `относительно ${g.b}, вдоль ${g.g1}${g.g2}`,
    })),
    ...r.points
      .filter((p) => !p.aux && (hyp(p.v) > 0 || hyp(p.a) > 0))
      .map((p) => {
        const cr = Math.abs(p.v[0] * p.a[1] - p.v[1] * p.a[0]);
        const rho = acc && cr > 1e-12 * Math.max(1, hyp(p.v) * hyp(p.a)) ? `, ρ = ${f(hyp(p.v) ** 3 / cr)}` : '';
        return { kind: 'aux' as const, val: [v('v'), sub(p.name), ` = ${f(hyp(p.v))}`, ...(acc ? [', ', v('a'), sub(p.name), ` = ${f(hyp(p.a))}`] : [])] as Inline[], note: `v ${vec(p.v)}${acc ? `, a ${vec(p.a)}` : ''}${rho}` };
      }),
  ];
  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows }] });
  return { steps };
}

type Ex = (bl: Block[], ...c: Inline[]) => void;
/** Множитель в произведении: отрицательный — в скобках. */
const pf = (x: number) => (f(x).startsWith('−') ? `(${f(x)})` : f(x));
/** Слагаемое после первого: «+ 5» или «− 5». */
const plus = (x: number) => (f(x).startsWith('−') ? ` − ${f(x).slice(1)}` : ` + ${f(x)}`);
const ang = (u: [number, number]) => (Math.atan2(u[1], u[0]) * 180) / Math.PI;

/** Кулисный камень: v_a = v_e + v_r; a_a = a_e + a_r + a_c. */
function guideStep(pr: MechProblem, r: MechSolution, ex: Ex): Step {
  const bl: Block[] = [];
  const acc = pr.acc !== false;
  for (const g of r.guides) {
    const P = r.points.find((q) => q.name === g.p)!;
    const B = r.bodies.find((q) => q.name === g.b)!;
    const r1 = r.points.find((q) => q.name === g.g1)!;
    const dist = Math.hypot(P.pos[0] - r1.pos[0], P.pos[1] - r1.pos[1]);
    const L: { c: Inline[] }[] = [];
    L.push({ c: [`Камень ${g.p} скользит вдоль прямой ${g.g1}${g.g2} звена ${g.b} (направление ${f(ang(g.u))}°).`] });
    L.push({ c: [v('v'), sub(g.p), ' = ', v('v'), sub('e'), ' + ', v('v'), sub('r'), ';  ', v('v'), sub('e'), ` = `, v('v'), sub(g.g1), ` + ω`, sub(g.b), ` × ${g.g1}${g.p} = ${vec(g.ve)}, |`, v('v'), sub('e'), `| = ${f(hyp(g.ve))}`] });
    if (Math.abs(B.omega) > 0 && hyp(r1.v) === 0) L.push({ c: [`|`, v('v'), sub('e'), `| = |ω`, sub(g.b), `|·${g.g1}${g.p} = ${f(Math.abs(B.omega))}·${f(dist)}`] });
    L.push({
      c: [
        v('v'),
        sub('r'),
        ' = ',
        b(f(g.vr)),
        ` вдоль ${g.g1}→${g.g2}${g.vr === 0 ? '' : g.vr > 0 ? ' (от ' + g.g1 + ')' : ' (к ' + g.g1 + ')'};  проверка: |`,
        v('v'),
        sub(g.p),
        `| = ${f(hyp(P.v))}`,
      ],
    });
    if (acc) {
      L.push({ c: [v('a'), sub(g.p), ' = ', v('a'), sub('e'), ' + ', v('a'), sub('r'), ' + ', v('a'), sub('c'), ';  ', v('a'), sub('e'), ` = `, v('a'), sub(g.g1), ` + ε`, sub(g.b), ` × ${g.g1}${g.p} − ω`, sub(g.b), sup('2'), `·${g.g1}${g.p} = ${vec(g.ae)}`] });
      L.push({ c: [v('a'), sub('c'), ` = 2ω`, sub(g.b), '·', v('v'), sub('r'), ` = 2·${pf(B.omega)}·${pf(g.vr)} = `, b(f(2 * B.omega * g.vr)), ` (перпендикулярно прорези), `, v('a'), sub('c'), ` = ${vec(g.ac)}`] });
      L.push({ c: [v('a'), sub('r'), ' = ', b(f(g.ar)), ` вдоль ${g.g1}→${g.g2};  `, v('a'), sub(g.p), ` = ${vec(P.a)}, |`, v('a'), sub(g.p), `| = ${f(hyp(P.a))}`] });
    }
    bl.push({ k: 'eq', lines: L });
  }
  ex(
    bl,
    'Движение камня — сложное: переносное — вместе со звеном, по которому он скользит (скорость v_e той точки звена, с которой камень совпадает в данный момент), относительное — вдоль прорези. Проецируя v = v_e + v_r на перпендикуляр к прорези, находят угловую скорость кулисы, на прорезь — относительную скорость. Для ускорений добавляется кориолисово a_c = 2ω × v_r: оно перпендикулярно прорези и направлено туда, куда повернётся v_r на 90° в сторону вращения кулисы.',
  );
  return { title: 'Кулисный камень: сложное движение точки', blocks: bl };
}

function loadName(pr: MechProblem, i: number): Inline[] {
  const l = pr.loads![i];
  if (l.k === 'force') return [v('F'), sub(String(i + 1)), ` в точке ${l.p}`];
  if (l.k === 'couple') return [v('M'), sub(String(i + 1)), ` на звене ${l.b}`];
  return [v('M'), sub('с'), ` в шарнире ${l.b1}–${l.b2 || 'опора'}`];
}

function dynSteps(pr: MechProblem, r: MechSolution, ex: Ex): Step[] {
  const steps: Step[] = [];
  const F = r.forces;
  if (r.extraErrors.length) steps.push({ title: 'Силы, массы, график', blocks: [{ k: 'badge', tone: 'bad', text: 'проверьте данные' }, { k: 'ul', items: r.extraErrors.map((x) => [x]) }] });
  if (!F) return steps;
  const lead: Inline[] = F.lead.kind === 'omega' ? [v('ω'), sub(F.lead.name)] : [v('v'), sub(F.lead.name)];
  const red = F.lead.kind === 'omega' ? 'момент' : 'сила';
  if ((pr.loads ?? []).length || F.weights.length) {
    const bl: Block[] = [];
    const L: { c: Inline[] }[] = [];
    for (const t of F.loads) {
      const nm = loadName(pr, t.i);
      if (t.friction) {
        L.push({ c: [...nm, `: N = −M·|ω₁ − ω₂| = −${f(t.val)}·${f(Math.abs(t.omega!))} = ${f(t.P)}`] });
      } else if (t.dir) {
        const th = f(ang(t.dir));
        const val = t.unknown ? v('X') : f(t.val);
        L.push({ c: [...nm, ` (${th}°): N = F·(vₓ cos θ + v_y sin θ) = `, val, `·(${pf(t.v![0])}·${pf(t.dir[0])} + ${pf(t.v![1])}·${pf(t.dir[1])}) = `, ...(t.unknown ? [`${pf(t.coef)}·`, v('X')] : [f(t.P)])] });
      } else {
        L.push({ c: [...nm, ': N = M·ω = ', t.unknown ? v('X') : pf(t.val), `·${pf(t.omega!)} = `, ...(t.unknown ? [`${pf(t.coef)}·`, v('X')] : [f(t.P)])] });
      }
    }
    for (const w of F.weights) L.push({ c: [`вес массы ${w.i + 1}: N = −m·g·v`, sub('Cy'), ` = ${f(w.P)}`] });
    bl.push({ k: 'eq', lines: L });
    if (F.unknown != null) {
      const t = F.loads[F.unknown];
      const hasFr = F.loads.some((q) => q.friction);
      bl.push({
        k: 'eq',
        lines: [
          { c: ['Σ N = 0:  ', `${f(F.Pknown)}${plus(t.coef)}·`, v('X'), ' = 0  ⇒  ', v('X'), ' = ', b(f(F.X!))] },
          {
            c: [
              F.X! < 0
                ? `Знак «−»: ${t.dir ? 'сила направлена противоположно заданному направлению' : 'пара направлена по часовой стрелке'}.`
                : `${t.dir ? 'Сила направлена так, как задано' : 'Пара направлена против часовой стрелки'}.`,
              hasFr ? ' Моменты сопротивления в уравнение равновесия не входят.' : '',
            ],
          },
        ],
      });
      ex(
        bl,
        'Механизм с одной степенью свободы: возможные перемещения точек пропорциональны их скоростям (δs = v·δt), поэтому условие равновесия — сумма возможных мощностей всех активных сил равна нулю: Σ F·v·cos(F, v) + Σ M·ω = 0. Реакции идеальных связей (шарниров, направляющих) работы не совершают и в уравнение не входят. Величина скорости ведущего звена не важна — она сокращается.',
      );
      steps.push({ title: 'Равновесие: принцип возможных перемещений', blocks: bl });
    } else {
      const Pt = F.Pknown + F.Pfric;
      bl.push({ k: 'eq', lines: [{ c: ['Σ N = ', b(f(Pt)), ';  приведённый ', red, ' = Σ N / ', ...lead, ` = ${f(Pt)}/${f(F.lead.value)} = `, b(f(Pt / F.lead.value))] }] });
      ex(bl, `Мощность сил при заданной скорости ведущего; приведённый ${red} — такой ${red}, приложенный к ведущему звену, развивает ту же мощность.`);
      steps.push({ title: 'Мощность сил', blocks: bl });
    }
  }
  if (F.masses.length) {
    const bl: Block[] = [];
    const L: { c: Inline[] }[] = [];
    for (const m of F.masses) {
      const mm = pr.masses![m.i];
      const v2 = m.vC[0] ** 2 + m.vC[1] ** 2;
      if (mm.k === 'point') L.push({ c: [`масса ${m.i + 1} (точка ${mm.p}): T = m v²/2 = ${f(m.m)}·${f(Math.sqrt(v2))}²/2 = `, b(f(m.T))] });
      else
        L.push({
          c: [
            `масса ${m.i + 1} (${mm.k === 'rod' ? `стержень ${mm.p1}${mm.p2}` : `звено ${mm.b}`}, J`,
            sub('C'),
            mm.k === 'rod' ? ` = m l²/12 = ${f(m.J)}` : mm.shape === 'disk' ? ` = m r²/2 = ${f(m.J)}` : mm.shape === 'ring' ? ` = m r² = ${f(m.J)}` : ` = ${f(m.J)}`,
            `): T = m v`,
            sub('C'),
            `²/2 + J`,
            sub('C'),
            `ω²/2 = ${f(m.m)}·${f(Math.sqrt(v2))}²/2 + ${f(m.J)}·${pf(m.omega)}²/2 = `,
            b(f(m.T)),
          ],
        });
    }
    L.push({ c: ['T = Σ = ', b(f(F.T)), ' при ', ...lead, ` = ${f(F.lead.value)}`] });
    L.push({ c: [F.lead.kind === 'omega' ? 'J' : 'm', sub('пр'), ' = 2T/', ...lead, '² = ', b(f(F.Jred!))] });
    bl.push({ k: 'eq', lines: L });
    ex(bl, 'Кинетическая энергия звена в плоском движении — по теореме Кёнига: T = m v_C²/2 + J_C ω²/2 (C — центр масс). Скорости центров масс и угловые скорости найдены выше. Энергия пропорциональна квадрату скорости ведущего звена: T = J_пр ω²/2, J_пр — приведённый момент инерции (для ведущей точки — приведённая масса).');
    steps.push({ title: 'Кинетическая энергия механизма', blocks: bl });
  }
  const E = r.energy;
  if (E) {
    const bl: Block[] = [];
    bl.push({
      k: 'eq',
      lines: [
        { c: ['T − T', sub('0'), ' = ΣA', ';  T = J', sub('пр'), '(φ)·', ...lead, '²/2'] },
        { c: ['T', sub('0'), ` = J`, sub('пр'), `(φ₀)·`, ...lead, `(φ₀)²/2 = ${f(E.J0)}·${pf(E.lam0)}²/2 = ${f(E.T0)}  (φ₀ = ${f(E.phi0)}°)`] },
        { c: [`ΣA = ∫ M`, sub('пр'), ` dφ от φ₀ = ${f(E.phi0)}° до φ = ${f(E.phi)}° = `, b(f(E.A)), ...(E.Afric ? [';  работа моментов сопротивления ', b(f(E.Afric))] : [])] },
        { c: [`T = ${f(E.T0)}${plus(E.A)}${E.Afric ? plus(E.Afric) : ''} = ${f(E.T)}`] },
        E.lam == null
          ? { c: ['T < 0 — механизм остановится, не дойдя до положения φ.'] }
          : { c: [...lead, ` = √(2T/J`, sub('пр'), `) = √(2·${f(E.T)}/${f(E.J)}) = `, b(f(E.lam))] },
      ],
    });
    ex(
      bl,
      `Работа сил на конечном перемещении — интеграл приведённого ${red === 'момент' ? 'момента' : 'силы'} по углу φ (в радианах); он вычислен численно по формуле Симпсона, приведённый момент инерции — в начальном и конечном положениях. Моменты сопротивления всегда направлены против движения и совершают отрицательную работу.${Math.abs(E.ratio - 1) > 1e-6 ? ` Параметр φ — не угол ведущего звена: dφ/dt = ${f(E.ratio)}·(скорость ведущего).` : ''}`,
    );
    steps.push({ title: 'Теорема об изменении кинетической энергии', blocks: bl });
  }
  return steps;
}

function dynRows(r: MechSolution): AnswerRow[] {
  const rows: AnswerRow[] = [];
  const F = r.forces;
  if (F?.X != null) rows.push({ kind: 'main', val: [v('X'), ' = ', b(f(F.X))], note: 'неизвестная сила (пара) из условия равновесия' });
  if (r.energy?.lam != null) rows.push({ kind: 'main', val: [F!.lead.kind === 'omega' ? v('ω') : v('v'), sub(F!.lead.name), ' = ', b(f(r.energy.lam))], note: `при φ = ${f(r.energy.phi)}° (теорема об энергии)` });
  if (F && F.masses.length) rows.push({ kind: 'main', val: ['T = ', b(f(F.T)), `, ${F.lead.kind === 'omega' ? 'J' : 'm'}`, sub('пр'), ` = ${f(F.Jred!)}`], note: 'кинетическая энергия при заданном ведущем' });
  if (r.plot?.max && r.plot.min)
    rows.push({ kind: 'aux', val: [`${r.plot.label}: max ${f(r.plot.max.y)} при φ ${r.plot.approx ? '≈' : '='} ${fmt(r.plot.max.x, 2)}°, min ${f(r.plot.min.y)} при φ ${r.plot.approx ? '≈' : '='} ${fmt(r.plot.min.x, 2)}°`], note: `по графику на [${fmt(r.plot.xs[0], 2)}°; ${fmt(r.plot.xs[r.plot.xs.length - 1], 2)}°]` });
  return rows;
}
