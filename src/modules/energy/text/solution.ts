/** Решение: кинематические связи, кинетическая энергия и приведённая масса, работа сил, теорема, ускорение. */
import { b, sub, v, type AnswerRow, type Block, type Doc, type Inline, type Step } from '../../../shared/doc';
import { fmt } from '../../../shared/format';
import { ATTACH_NAME, G, tensions, type Body, type EnergyProblem, type EnergyResult } from '../model/energy';

const f = (x: number) => fmt(x, 4);
const KIND = { translate: 'груз (поступательно)', rotate: 'блок (вращение вокруг неподвижной оси)', roll: 'каток (катится без скольжения)' } as const;
const INERTIA = { disk: 'сплошной диск', ring: 'масса на ободе', rho: 'по радиусу инерции', J: 'момент инерции задан' } as const;

export function energyDoc(pr: EnergyProblem, r: EnergyResult, opts: { explain?: boolean } = {}): Doc {
  const steps: Step[] = [];
  const ex = (bl: Block[], ...c: Inline[]) => {
    if (opts.explain) bl.push({ k: 'p', cls: 'explain', c });
  };
  if (!r.ok) {
    steps.push({ title: 'Данные', blocks: [{ k: 'badge', tone: 'bad', text: 'проверьте данные' }, { k: 'ul', items: r.errors.map((e) => [e]) }] });
    return { steps };
  }
  const ang = r.angular;
  const V = ang ? 'ω' : 'v',
    S = ang ? 'φ' : 's',
    Acc = ang ? 'ε' : 'a';
  const VU = ang ? 'рад/с' : 'м/с',
    SU = ang ? 'рад' : 'м',
    AU = ang ? 'рад/с²' : 'м/с²';
  const MU = pr.byWeight ? (ang ? 'кГ·м·с²' : 'кГ·с²/м') : ang ? 'кг·м²' : 'кг';
  const FU = pr.byWeight ? 'кГ' : 'Н';
  const nm = (i: number) => `${i + 1}`;
  const name = (bd: Body, i: number) => `${i + 1} (${bd.name || KIND[bd.kind]})`;
  const cf = (x: number) => (Math.abs(x - 1) < 1e-12 ? '' : `${f(x)}·`);

  // 1. Кинематика.
  {
    const items = pr.bodies.map((bd, i): Inline[] => {
      const { k, q } = r.kin[i];
      const head: Inline[] = [`Тело ${name(bd, i)} — ${KIND[bd.kind]}: `];
      if (i === 0) return [...head, ang ? `ведущее, его угол поворота φ и угловая скорость ω — искомые координата и скорость` : `ведущее, его перемещение s и скорость v`, ...(bd.kind === 'roll' ? [`; ω`, sub(nm(i)), ` = v/r = ${cf(q)}v`] : [])];
      const L = bd.link!;
      const link: Inline[] = [`нить от тела ${L.from + 1} (${ATTACH_NAME[L.at]}) к ${ATTACH_NAME[L.to]}: `];
      const vs = bd.kind === 'translate' ? [v('v'), sub(nm(i)), ` = ${cf(k)}${V}`] : bd.kind === 'rotate' ? [v('ω'), sub(nm(i)), ` = ${cf(q)}${V}`] : [v('v'), sub(`C${nm(i)}`), ` = ${cf(k)}${V}, `, v('ω'), sub(nm(i)), ` = ${cf(q)}${V}`];
      return [...head, ...link, ...vs];
    });
    const bl: Block[] = [{ k: 'p', c: ['Выражаем скорости всех тел через ', v(V), ' ведущего тела 1. Перемещения связаны теми же коэффициентами.'] }, { k: 'ul', items }];
    ex(bl, 'Нить нерастяжима: скорости всех её точек по модулю одинаковы. У блока скорость обода v = ωR. Каток катится без скольжения — мгновенный центр скоростей в точке касания: v_C = ωr, а точка на расстоянии R над осью движется со скоростью ω(r + R).');
    steps.push({ title: 'Кинематические соотношения', blocks: bl });
  }
  // 2. Кинетическая энергия.
  {
    const lines: { num?: boolean; c: Inline[] }[] = [];
    pr.bodies.forEach((bd, i) => {
      const kin = r.kin[i];
      const m: Inline[] = pr.byWeight ? [v('m'), sub(nm(i)), ` = P/g = ${f(bd.m)}/${f(G)} = ${f(kin.mass)}`] : [v('m'), sub(nm(i)), ` = ${f(kin.mass)}`];
      if (bd.kind === 'translate') lines.push({ c: [v('T'), sub(nm(i)), ' = ', v('m'), sub(nm(i)), v('v'), sub(nm(i)), '²/2', '; ', ...m] });
      else {
        const J: Inline[] = [v('J'), sub(nm(i)), ` = ${bd.inertia === 'J' ? '' : bd.inertia === 'disk' ? (bd.kind === 'rotate' ? 'mR²/2 = ' : 'mr²/2 = ') : bd.inertia === 'ring' ? (bd.kind === 'rotate' ? 'mR² = ' : 'mr² = ') : 'mρ² = '}${f(kin.J)} (${INERTIA[bd.inertia]})`];
        if (bd.kind === 'rotate') lines.push({ c: [v('T'), sub(nm(i)), ' = ', v('J'), sub(nm(i)), v('ω'), sub(nm(i)), '²/2; ', ...(bd.m > 0 ? [...m, '; '] : []), ...J] });
        else lines.push({ c: [v('T'), sub(nm(i)), ' = ', v('m'), sub(nm(i)), v('v'), sub(`C${nm(i)}`), '²/2 + ', v('J'), sub(nm(i)), v('ω'), sub(nm(i)), '²/2; ', ...m, '; ', ...J] });
      }
    });
    const terms = r.kin.map((k, i) => {
      const parts: string[] = [];
      if (k.mass * k.k * k.k > 0) parts.push(`${f(k.mass)}·${f(k.k)}²`);
      if (k.J * k.q * k.q > 0) parts.push(`${f(k.J)}·${f(k.q)}²`);
      return parts.join(' + ') || `0 (тело ${i + 1})`;
    });
    lines.push({ c: [v('T'), ' = ', v('m'), sub('пр'), v(V), '²/2, ', v('m'), sub('пр'), ' = Σ(', v('m'), sub('i'), v('k'), sub('i'), '² + ', v('J'), sub('i'), v('q'), sub('i'), '²)'] });
    lines.push({ num: true, c: [v('m'), sub('пр'), ' = ', terms.join(' + '), ' = ', b(`${f(r.mred)} ${MU}`)] });
    const bl: Block[] = [{ k: 'eq', lines }];
    ex(bl, `Кинетическая энергия: груза — mv²/2, блока — Jω²/2, катка (плоское движение) — mv_C²/2 + J_Cω²/2. Подставив скорости через ${V}, получаем T = m_пр${V}²/2, где k_i и q_i — коэффициенты из кинематических соотношений${ang ? '; при ведущем блоке m_пр — приведённый момент инерции' : ''}.`);
    steps.push({ title: 'Кинетическая энергия системы', blocks: bl });
  }
  // 3. Работа сил.
  const sEnd = r.note === 'stops' && r.sStop != null ? r.sStop : r.s;
  {
    const items: Inline[][] = r.terms.map((t) => {
      const bd = pr.bodies[t.body],
        i = t.body,
        { k, q } = r.kin[i];
      const si: Inline[] = [v('s'), sub(nm(i)), ` = ${cf(k)}${S}`];
      const fi: Inline[] = [v('φ'), sub(nm(i)), ` = ${cf(q)}${S}`];
      const val = `= ${f(t.A(sEnd))}`;
      switch (t.kind) {
        case 'gravity':
          return [`сила тяжести тела ${i + 1}: `, v('A'), ` = ${bd.up ? '−' : ''}P·sin α·`, v('s'), sub(nm(i)), ` = ${bd.up ? '−' : ''}${f(pr.byWeight ? bd.m : bd.m * G)}·${f(Math.sin((bd.alpha * Math.PI) / 180))}·`, v('s'), sub(nm(i)), ` ${val}; `, ...si];
        case 'slide':
          return [`трение скольжения тела ${i + 1}: `, v('A'), ` = −f·P·cos α·`, v('s'), sub(nm(i)), ` = −${f(bd.f)}·${f(pr.byWeight ? bd.m : bd.m * G)}·${f(Math.cos((bd.alpha * Math.PI) / 180))}·`, v('s'), sub(nm(i)), ` ${val}`];
        case 'rolling':
          return [`сопротивление качению тела ${i + 1}: `, v('A'), ` = −δ·P·cos α·`, v('φ'), sub(nm(i)), ` = −${f(bd.fk)}·${f(pr.byWeight ? bd.m : bd.m * G)}·${f(Math.cos((bd.alpha * Math.PI) / 180))}·`, v('φ'), sub(nm(i)), ` ${val}; `, ...fi];
        case 'force':
          return [`сила F на теле ${i + 1}: `, v('A'), ` = F·`, v('s'), sub(nm(i)), ` = ${f(bd.F)}·`, v('s'), sub(nm(i)), ` ${val}`];
        case 'moment': {
          const [M0, M1, M2] = bd.M;
          const p = `φ${nm(i).replace(/\d/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[+d])}`;
          const form = [M0 ? `${f(M0)}${p}` : '', M1 ? `${f(M1)}${p}²/2` : '', M2 ? `${f(M2)}${p}³/3` : ''].filter(Boolean).join(' + ');
          return [`момент на теле ${i + 1}: `, v('A'), ' = ∫', v('M'), 'dφ = ', form, ` ${val}; `, ...fi];
        }
        case 'spring':
          return [`пружина на теле ${i + 1}: `, v('A'), ` = c(λ₀² − (λ₀ + `, v('s'), sub(nm(i)), `)²)/2 = ${f(bd.c)}·(${f(bd.lambda0)}² − (${f(bd.lambda0)} + `, v('s'), sub(nm(i)), `)²)/2 ${val}`];
      }
    });
    const bl: Block[] = [
      { k: 'p', c: [`Работа сил на перемещении ${S} = ${f(sEnd)} ${SU}${pr.byWeight ? ` (силы — в ${FU})` : ''}:`] },
      items.length ? { k: 'ul', items } : { k: 'p', c: ['Работающих сил нет.'] },
      { k: 'p', c: ['Σ', v('A'), ' = ', b(f(r.A(sEnd)))] },
    ];
    ex(bl, 'Не совершают работы: реакции гладких неподвижных опор и осей, натяжения нерастяжимых нитей (внутренние силы системы), сила трения в точке касания катящегося без скольжения катка (её точка приложения — мгновенный центр скоростей). Сила трения скольжения F = fN, момент сопротивления качению M = δN, N = P cos α.');
    steps.push({ title: 'Работа внешних сил', blocks: bl });
  }
  // 4. Теорема.
  {
    const lines: { num?: boolean; c: Inline[] }[] = [{ c: [v('T'), ' − ', v('T'), sub('0'), ' = Σ', v('A'), ':  ', v('m'), sub('пр'), `(${V}² − ${V}₀²)/2 = Σ`, v('A')] }];
    const bl: Block[] = [{ k: 'eq', lines }];
    if (pr.mode === 'v') {
      if (r.note === 'stops') bl.push({ k: 'badge', tone: 'warn', text: `система остановится раньше: при ${S} = ${f(r.sStop!)} ${SU}` });
      lines.push({ c: [v(V), ` = √(${V}₀² + 2Σ`, v('A'), `/`, v('m'), sub('пр'), `) = √(${f(r.v0)}² + 2·${f(r.Atot)}/${f(r.mred)}) = `, b(`${f(r.v)} ${VU}`)] });
    } else if (pr.mode === 'v0') {
      if (r.note === 'impossible') bl.push({ k: 'badge', tone: 'bad', text: 'такой скорости не получить ни при какой начальной скорости' });
      else lines.push({ c: [v(V), `₀ = √(${V}² − 2Σ`, v('A'), '/', v('m'), sub('пр'), `) = √(${f(r.v)}² − 2·${f(r.Atot)}/${f(r.mred)}) = `, b(`${f(r.v0)} ${VU}`)] });
    } else if (r.note === 'never') bl.push({ k: 'badge', tone: 'bad', text: `скорость ${f(pr.v1)} ${VU} не достигается${r.sStop != null ? ` — система остановится при ${S} = ${f(r.sStop)} ${SU}` : ''}` });
    else lines.push({ c: [`Σ`, v('A'), `(${S}) = `, v('m'), sub('пр'), `(${V}² − ${V}₀²)/2 = ${f(r.mred)}·(${f(r.v)}² − ${f(r.v0)}²)/2 = ${f((r.mred * (r.v ** 2 - r.v0 ** 2)) / 2)} → `, v(S), ' = ', b(`${f(r.s)} ${SU}`), ...(ang ? [` (${f(r.s / (2 * Math.PI))} об.)`] : [])] });
    if (r.note === 'reverse')
      bl.push({ k: 'badge', tone: 'warn', text: 'из покоя система сама пойдёт в обратную сторону' }, { k: 'p', c: ['В начальный момент обобщённая сила ', v('Q'), ` = ${f(r.Q(0))} < 0: в принятом направлении система не тронется. Ответ по теореме — формальный: такая скорость будет, если тело как-то провели через начальный участок.`] });
    ex(bl, 'Теорема об изменении кинетической энергии: изменение кинетической энергии системы на перемещении равно сумме работ всех сил (для неизменяемой системы — только внешних).');
    steps.push({ title: 'Теорема об изменении кинетической энергии', blocks: bl });
  }
  // 5. Ускорение.
  {
    const bl: Block[] = [
      {
        k: 'eq',
        lines: [
          { c: [`dT/dt = dΣ`, v('A'), `/dt: `, v('m'), sub('пр'), v(V), `·d${V}/dt = `, v('Q'), v(V)] },
          { num: true, c: [v(Acc), ' = ', v('Q'), '/', v('m'), sub('пр'), ` = ${f(r.Q(sEnd))}/${f(r.mred)} = `, b(`${f(r.a)} ${AU}`)] },
        ],
      },
    ];
    bl.push({ k: 'p', c: [r.linear ? 'Работа пропорциональна перемещению — ускорение постоянно.' : `Работа нелинейна по ${S} — ускорение переменно; дано значение в конце перемещения.`] });
    ex(bl, 'Q = dΣA/ds — обобщённая (приведённая) сила; m_пр·a = Q — уравнение движения системы, полученное из теоремы в дифференциальной форме dT = dA.');
    steps.push({ title: ang ? 'Угловое ускорение' : 'Ускорение', blocks: bl });
  }
  // 6. Натяжения нитей.
  const Ts = tensions(pr, r, sEnd);
  if (Ts.length) {
    const FU2 = pr.byWeight ? 'кГ' : 'Н';
    const lines = Ts.map((t) => ({
      c: [
        v('T'),
        sub(`${pr.bodies[t.body].link!.from + 1}–${t.body + 1}`),
        `: часть {${t.part.map((j) => j + 1).join(', ')}}, `,
        v('T'),
        `·${f(t.w)} = |${f(t.mred)}·${f(r.a)} − ${f(t.Q)}| → `,
        v('T'),
        ' = ',
        b(`${f(t.T)} ${FU2}`),
        t.belt ? ' (разность натяжений ветвей ремня)' : '',
      ] as Inline[],
    }));
    const bl: Block[] = [{ k: 'p', c: ['Отсекаем систему по нити: для части, оставшейся по одну сторону, по принципу Даламбера (в форме мощностей) ', v('T'), '·', v('w'), ' = ', v('m'), sub('пр,S'), v(Acc), ' − ', v('Q'), sub('S'), ', где ', v('w'), ` — скорость нити при ${V} = 1.`] }, { k: 'eq', lines }];
    ex(bl, 'Силы инерции отсечённых тел (−m·a у груза, момент −J·ε у блока и катка) вместе с внешними силами и натяжением нити образуют уравновешенную систему. Нить считается натянутой; если получается, что нить должна была бы толкать, схема не соответствует допущениям задачи.');
    steps.push({ title: 'Натяжения нитей (принцип Даламбера)', blocks: bl });
  }
  const rows: AnswerRow[] = [];
  if (pr.mode === 'v' && r.note !== 'stops') rows.push({ kind: 'main', val: [v(V), ` = ${f(r.v)} ${VU}`], note: r.note === 'reverse' ? 'формально' : `при ${S} = ${f(r.s)} ${SU}` });
  if (pr.mode === 'v' && r.note === 'stops') rows.push({ kind: 'main', val: [v(S), ` = ${f(r.sStop!)} ${SU}`], note: 'система останавливается раньше' });
  if (pr.mode === 'v0' && r.note !== 'impossible') rows.push({ kind: 'main', val: [v(V), `₀ = ${f(r.v0)} ${VU}`], note: 'начальная скорость' });
  if (pr.mode === 's' && r.note === 'ok') rows.push({ kind: 'main', val: [v(S), ` = ${f(r.s)} ${SU}`], note: ang ? `${f(r.s / (2 * Math.PI))} оборота` : `до скорости ${f(pr.v1)} ${VU}` });
  rows.push({ kind: 'aux', val: [v(Acc), ` = ${f(r.a)} ${AU}`], note: r.linear ? 'постоянно' : 'в конце перемещения' });
  rows.push({ kind: 'aux', val: [v('m'), sub('пр'), ` = ${f(r.mred)} ${MU}`], note: ang ? 'приведённый момент инерции' : 'приведённая масса' });
  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows }] });
  return { steps };
}
