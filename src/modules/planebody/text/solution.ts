/** Решение: тело и силы, связи (условия на ускорения), уравнения плоского движения, реакции, силы инерции и проверка кинетостатикой. */
import { b, sub, sup, v, type AnswerRow, type Block, type Doc, type Inline, type Step } from '../../../shared/doc';
import { fmt } from '../../../shared/format';
import { accOf, type BodyProblem, type BodyResult, type Constr, type Reaction } from '../model/body';

const f = (x: number) => fmt(x, 4);
const fp = (x: number) => (x < 0 ? `(${f(x)})` : f(x));
const vec = (p: [number, number]) => `(${f(p[0])}; ${f(p[1])})`;
const bad = (errors: string[]): Doc => ({
  steps: [
    {
      title: 'Данные',
      blocks: [
        { k: 'badge', tone: 'bad', text: 'проверьте данные' },
        { k: 'ul', items: errors.map((x) => [x]) },
      ],
    },
  ],
});
const cross = (r: [number, number], F: [number, number]) => r[0] * F[1] - r[1] * F[0];

/** Сумма слагаемых c·X без нулевых (X = null — число); пустая сумма — «0». */
function lin(ts: [number, Inline[] | null][]): Inline[] {
  const out: Inline[] = [];
  for (const [c, x] of ts) {
    if (Math.abs(c) < 1e-12) continue;
    const a = Math.abs(c);
    out.push(out.length ? (c < 0 ? ' − ' : ' + ') : c < 0 ? '−' : '');
    if (!x) out.push(f(a));
    else {
      if (Math.abs(a - 1) > 1e-12) out.push(f(a) + '·');
      out.push(...x);
    }
  }
  return out.length ? out : ['0'];
}
const aCx: Inline[] = [v('a'), sub('Cx')],
  aCy: Inline[] = [v('a'), sub('Cy')],
  epsI: Inline[] = ['ε'];
/** Обозначение составляющей реакции связи i: T₁, N₂, X₃, … */
const lab = (name: string, i: number): Inline[] => [v(name), sub(String(i + 1))];
const KIND: Record<Constr['kind'], string> = {
  pin: 'шарнир',
  roller: 'опора (ролик)',
  rope: 'нить к неподвижной точке',
  unwind: 'нить сходит с тела',
  roll: 'качение без скольжения',
};

/** Описание связи и её условие на ускорения. */
function constrItem(pr: BodyProblem, c: Constr, re: Reaction): Inline[] {
  const i = re.i,
    P = c.at.trim();
  const rr = re.r;
  const head: Inline[] = [`${i + 1}. ${KIND[c.kind]} в точке ${P}, r = ${vec(rr)}: `];
  const n = [Math.cos((c.ang * Math.PI) / 180), Math.sin((c.ang * Math.PI) / 180)] as [number, number];
  switch (c.kind) {
    case 'pin':
      return [...head, v('a'), sub(P), ' = 0 (два условия); неизвестные ', ...lab('X', i), ', ', ...lab('Y', i), '.'];
    case 'roller':
      return [
        ...head,
        `нормаль n = ${vec(n)} (${f(c.ang)}°); `,
        v('a'),
        sub(P),
        '·',
        v('n'),
        ' = 0; неизвестная ',
        ...lab('N', i),
        c.one ? ' ≥ 0 (опора односторонняя)' : ' (опора двусторонняя)',
        c.f > 0 ? `; трение f = ${f(c.f)}: при скольжении F = −f·N·sign v_t вдоль t = (n_y; −n_x), при покое точки — сила сцепления |F| ≤ fN.` : '.',
      ];
    case 'rope': {
      const L = Math.hypot(c.qx - rr[0], c.qy - rr[1]);
      const e: [number, number] = [(c.qx - rr[0]) / L, (c.qy - rr[1]) / L];
      const vP: [number, number] = [pr.vx - pr.omega * rr[1], pr.vy + pr.omega * rr[0]];
      return [
        ...head,
        `закреплена в Q ${vec([c.qx, c.qy])}, длина L = ${f(L)}, e = (Q − ${P})/L = ${vec(e)}; `,
        v('a'),
        sub(P),
        '·',
        v('e'),
        ' = ',
        v('v'),
        sub(P),
        '²/',
        v('L'),
        ` = ${f((vP[0] ** 2 + vP[1] ** 2) / L)}; натяжение `,
        ...lab('T', i),
        ' ≥ 0.',
      ];
    }
    case 'unwind':
      return [
        ...head,
        `направление нити d = ${vec(n)} (${f(c.ang)}°); `,
        v('a'),
        sub(P),
        '·',
        v('d'),
        ' = 0 (точка схода не имеет ускорения вдоль нити); натяжение ',
        ...lab('T', i),
        ' ≥ 0.',
      ];
    default:
      return [
        ...head,
        `нормаль опоры n = ${vec(n)} (${f(c.ang)}°); `,
        v('a'),
        sub('C'),
        '·',
        v('n'),
        ' = 0 и ',
        v('a'),
        sub(P),
        '·',
        v('t'),
        ' = 0 (точка касания — мгновенный центр скоростей); неизвестные ',
        ...lab('N', i),
        ' ≥ 0 и сила сцепления ',
        ...lab('F', i),
        '.',
      ];
  }
}

/** Строки кинематических условий в числах. */
function rowLines(re: Reaction): { num?: boolean; c: Inline[] }[] {
  return re.rows.map((row) => ({
    num: true,
    c: [
      ...lin([
        [row.k[0], aCx],
        [row.k[1], aCy],
        [row.k[2], epsI],
      ]),
      ` = ${f(row.rhs)}`,
    ],
  }));
}

/** Слагаемые реакций в уравнениях движения. */
function reactTerms(rs: Reaction[], comp: 0 | 1 | 2): [number, Inline[]][] {
  return rs.flatMap((re) => re.dirs.map((d): [number, Inline[]] => [comp === 2 ? cross(re.r, d.d) : d.d[comp], lab(d.name, re.i)]));
}

/** Ролики, где точка скользит: реакция N·(n − σf·t) — одна неизвестная. */
function slipLines(pr: BodyProblem, rs: Reaction[]): Block[] {
  return rs
    .filter((x) => !x.dropped && x.kind === 'roller' && x.dirs.length === 1 && pr.constr[x.i].f > 0)
    .map((x): Block => {
      const c = pr.constr[x.i];
      const sg = Math.sign(x.vals[1]?.v ?? 0) === Math.sign(x.vals[0].v) ? -1 : 1;
      return {
        k: 'p',
        c: [
          `Опора ${x.i + 1}: точка ${c.at.trim()} скользит ${sg > 0 ? 'по' : 'против'} направлению t (σ = ${sg > 0 ? '+1' : '−1'}), трение против скольжения: реакция `,
          ...lab('N', x.i),
          `·(n − σf·t) = `,
          ...lab('N', x.i),
          `·${vec(x.dirs[0].d)}.`,
        ],
      };
    });
}

function reactItems(pr: BodyProblem, r: BodyResult, FU: string): Inline[][] {
  return r.reactions.map((re): Inline[] => {
    const c = pr.constr[re.i];
    const head = `${re.i + 1}. ${KIND[c.kind]} в ${c.at.trim()}: `;
    if (re.dropped) return [head, b('снята'), ` — ${re.note ?? ''}; реакция равна нулю.`];
    const parts: Inline[] = [];
    re.vals.forEach((x, j) => {
      if (j) parts.push('; ');
      parts.push(...lab(x.name, re.i), ' = ', b(`${f(x.v)} ${FU}`));
    });
    if (re.vals.length > 1) parts.push(`; |R${re.i + 1}| = ${f(Math.hypot(...re.F))} ${FU}`);
    return [head, ...parts, re.note ? ` (${re.note})` : ''];
  });
}

export function bodyDoc(pr: BodyProblem, r: BodyResult, opts: { explain?: boolean } = {}): Doc {
  if (!r.ok) return bad(r.errors);
  const ex = (bl: Block[], ...c: Inline[]) => {
    if (opts.explain) bl.push({ k: 'p', cls: 'explain', c });
  };
  const steps: Step[] = [];
  const FU = pr.byWeight ? 'кГ' : 'Н';
  const MU = pr.byWeight ? 'кГ·м' : 'Н·м';
  const given = pr.mode === 'given';
  const live = r.reactions.filter((x) => !x.dropped);
  // 1. Тело и силы.
  {
    const m = r.mass;
    const Jf: Record<BodyProblem['shape'], string> = {
      rod: `mL²/12 = ${f(m)}·${f(pr.L)}²/12`,
      disk: `mR²/2 = ${f(m)}·${f(pr.R)}²/2`,
      ring: `mR² = ${f(m)}·${f(pr.R)}²`,
      rect: `m(a² + b²)/12 = ${f(m)}·(${f(pr.a)}² + ${f(pr.b)}²)/12`,
      rho: `mρ² = ${f(m)}·${f(pr.rho)}²`,
      J: '',
    };
    const lines: { num?: boolean; c: Inline[] }[] = [
      { c: pr.byWeight ? [v('m'), ` = P/g = ${f(pr.m)}/${f(pr.g)} = ${f(m)} кГ·с²/м`] : [v('m'), ` = ${f(m)} кг;  `, v('P'), ` = mg = ${f(r.P)} Н`] },
      {
        c: [
          v('J'),
          sub('C'),
          ` = ${Jf[pr.shape] ? Jf[pr.shape] + ' = ' : ''}`,
          b(`${f(r.J)} ${pr.byWeight ? 'кГ·м·с²' : 'кг·м²'}`),
          pr.shape === 'J' ? ' (задан)' : '',
        ],
      },
    ];
    const pts = [...r.pts.entries()].filter(([k]) => k !== 'C');
    const bl: Block[] = [
      {
        k: 'p',
        c: [
          'Начало координат — центр масс C в данный момент, ось x вправо, y вверх; углы — от оси x против часовой стрелки, «+» момента и ε — против часовой.',
        ],
      },
      { k: 'eq', lines },
    ];
    if (pts.length) bl.push({ k: 'p', c: ['Точки тела (от C): ', pts.map(([k, p]) => `${k} ${vec(p)}`).join(', '), '.'] });
    const forces: Inline[][] = [];
    if (pr.gravity) forces.push([`сила тяжести P = ${f(r.P)} ${FU} в C вдоль −y;`]);
    pr.loads.forEach((l, i) => {
      if (l.kind === 'moment') forces.push([`${i + 1}. пара сил с моментом M = ${f(l.m)} ${MU};`]);
      else {
        const rr = r.pts.get(l.at.trim())!;
        forces.push([
          `${i + 1}. сила (${f(l.fx)}; ${f(l.fy)}) ${FU} в точке ${l.at.trim()}: момент относительно C x·F_y − y·F_x = ${f(cross(rr, [l.fx, l.fy]))} ${MU};`,
        ]);
      }
    });
    if (forces.length) bl.push({ k: 'p', c: ['Заданные силы:'] }, { k: 'ul', items: forces });
    bl.push({
      k: 'eq',
      lines: [
        { c: ['Главный вектор ', v('F'), ` = (${f(r.Fe[0])}; ${f(r.Fe[1])}) ${FU}, главный момент относительно C `, v('M'), sub('C'), ` = ${f(r.Me)} ${MU}`] },
      ],
    });
    if (!given || pr.omega || pr.vx || pr.vy)
      bl.push({
        k: 'p',
        c: [
          `Скорости в данный момент: ω = ${f(pr.omega)} рад/с, v`,
          sub('C'),
          ` = (${f(pr.vx)}; ${f(pr.vy)}) м/с; кинетическая энергия mv`,
          sub('C'),
          '²/2 + ',
          v('J'),
          sub('C'),
          `ω²/2 = ${f(r.T)}.`,
        ],
      });
    ex(
      bl,
      'Плоское движение — поступательное вместе с центром масс и вращение вокруг него: m·a_C = ΣF + ΣR, J_C·ε = ΣM_C(F) + ΣM_C(R). Скорости тела в данный момент входят в ускорения точек (центростремительная часть −ω²r) и в условия для нитей.',
    );
    steps.push({ title: 'Тело и заданные силы', blocks: bl });
  }
  if (!given) {
    // 2. Связи.
    {
      const bl: Block[] = [
        {
          k: 'p',
          c: [
            'Ускорение точки тела: ',
            v('a'),
            sub('P'),
            ' = ',
            v('a'),
            sub('C'),
            ' + ε',
            v('k'),
            '×',
            v('r'),
            ' − ω²',
            v('r'),
            ', ',
            v('r'),
            ' = P − C, ',
            v('k'),
            '×',
            v('r'),
            ' = (−r',
            sub('y'),
            '; r',
            sub('x'),
            ').',
          ],
        },
      ];
      if (!pr.constr.length) bl.push({ k: 'p', c: ['Связей нет — тело свободно.'] });
      for (const re of r.reactions) {
        const c = pr.constr[re.i];
        bl.push({ k: 'p', c: constrItem(pr, c, re) });
        if (re.rows.length) bl.push({ k: 'eq', lines: rowLines(re) });
      }
      ex(
        bl,
        'Каждая связь даёт столько условий на ускорения (a_Cx, a_Cy, ε), сколько у неё неизвестных составляющих реакции: вместе с тремя уравнениями движения система замкнута. Нить нерастяжима — точка крепления движется по окружности радиуса L, отсюда центростремительное ускорение v²/L вдоль нити.',
      );
      steps.push({ title: 'Связи: условия для ускорений', blocks: bl });
    }
    // 3. Уравнения движения.
    {
      const rx = reactTerms(live, 0),
        ry = reactTerms(live, 1),
        rm = reactTerms(live, 2);
      const lines: { num?: boolean; c: Inline[] }[] = [
        {
          c: [
            v('m'),
            v('a'),
            sub('Cx'),
            ' = ΣF',
            sub('x'),
            ' + ΣR',
            sub('x'),
            ';  ',
            v('m'),
            v('a'),
            sub('Cy'),
            ' = ΣF',
            sub('y'),
            ' + ΣR',
            sub('y'),
            ';  ',
            v('J'),
            sub('C'),
            'ε = ΣM',
            sub('C'),
            '(F) + ΣM',
            sub('C'),
            '(R)',
          ],
        },
        { num: true, c: [`${f(r.mass)}·`, ...aCx, ' = ', ...lin([[r.Fe[0], null], ...rx])] },
        { num: true, c: [`${f(r.mass)}·`, ...aCy, ' = ', ...lin([[r.Fe[1], null], ...ry])] },
        { num: true, c: [`${f(r.J)}·ε = `, ...lin([[r.Me, null], ...rm])] },
      ];
      const bl: Block[] = [...slipLines(pr, live), { k: 'eq', lines }];
      bl.push({
        k: 'eq',
        lines: [
          {
            c: [
              v('a'),
              sub('C'),
              ' = (',
              b(f(r.aC[0])),
              '; ',
              b(f(r.aC[1])),
              `) м/с², |`,
              v('a'),
              sub('C'),
              `| = ${f(Math.hypot(...r.aC))};  ε = `,
              b(`${f(r.eps)} рад/с²`),
            ],
          },
        ],
      });
      for (const n of r.notes) bl.push({ k: 'badge', tone: 'warn', text: n });
      const dropped = r.reactions.filter((x) => x.dropped);
      if (dropped.length) {
        bl.push({ k: 'badge', tone: 'warn', text: dropped.length > 1 ? 'связи сняты' : 'связь снята' });
        bl.push({ k: 'ul', items: dropped.map((x) => [`связь ${x.i + 1} (${KIND[x.kind]} в ${x.at.trim()}): ${x.note ?? ''}`]) });
      }
      if (live.length)
        bl.push({ k: 'p', c: ['Ускорения точек связей: ', live.map((x) => `${x.at.trim()} ${vec(accOf(x.r, r.aC, r.eps, pr.omega))}`).join(', '), ' м/с².'] });
      ex(
        bl,
        'Опора и нить могут только толкать или тянуть: если в решении N < 0 или T < 0, такая связь не удерживает тело — оно отрывается или нить ослабевает, и система решается заново без этой связи.',
      );
      steps.push({ title: 'Уравнения движения', blocks: bl });
    }
  } else {
    // 2. Заданное движение и силы инерции.
    const bl: Block[] = [
      {
        k: 'eq',
        lines: [
          { c: ['Задано: ', v('a'), sub('C'), ` = ${vec(r.aC)} м/с², ε = ${f(r.eps)} рад/с²`] },
          {
            c: [
              'Φ = −',
              v('m'),
              v('a'),
              sub('C'),
              ` = (${f(r.Phi[0])}; ${f(r.Phi[1])}) ${FU};  `,
              v('M'),
              sup('Φ'),
              ' = −',
              v('J'),
              sub('C'),
              `ε = −${f(r.J)}·${fp(r.eps)} = `,
              b(`${f(r.MPhi)} ${MU}`),
            ],
          },
        ],
      },
    ];
    ex(
      bl,
      'Силы инерции всех точек тела приводятся к центру масс: главный вектор −m·a_C приложен в C, главный момент −J_C·ε. По принципу Даламбера заданные силы, реакции и силы инерции образуют уравновешенную систему.',
    );
    steps.push({ title: 'Заданное движение и силы инерции', blocks: bl });
    if (pr.constr.length) {
      const rx = reactTerms(live, 0),
        ry = reactTerms(live, 1),
        rm = reactTerms(live, 2);
      const lines: { num?: boolean; c: Inline[] }[] = [
        {
          c: [
            'ΣF',
            sub('x'),
            ' + ΣR',
            sub('x'),
            ' + Φ',
            sub('x'),
            ' = 0;  ΣF',
            sub('y'),
            ' + ΣR',
            sub('y'),
            ' + Φ',
            sub('y'),
            ' = 0;  ΣM',
            sub('C'),
            ' + ',
            v('M'),
            sup('Φ'),
            ' = 0',
          ],
        },
        { num: true, c: [...lin([[r.Fe[0] + r.Phi[0], null], ...rx]), ' = 0'] },
        { num: true, c: [...lin([[r.Fe[1] + r.Phi[1], null], ...ry]), ' = 0'] },
        { num: true, c: [...lin([[r.Me + r.MPhi, null], ...rm]), ' = 0'] },
      ];
      const bl2: Block[] = [
        ...slipLines(pr, live),
        {
          k: 'p',
          c: [
            'Неизвестные: ',
            ...live.flatMap((x, j) => [j ? ', ' : '', ...x.dirs.flatMap((d, q) => [q ? ', ' : '', ...lab(d.name, x.i)])]),
            ` (связи: ${live.map((x) => `${x.i + 1} — ${KIND[x.kind]} в ${x.at.trim()}`).join('; ')}).`,
          ],
        },
        { k: 'eq', lines },
      ];
      const nUnk = live.reduce((s, x) => s + x.dirs.length, 0);
      if (nUnk < 3) bl2.push({ k: 'p', c: [`Неизвестных ${nUnk} — меньше трёх уравнений: реакции подобраны по наименьшим квадратам, невязка ${f(r.resid)}.`] });
      for (const n of r.notes) bl2.push({ k: 'badge', tone: 'warn', text: n });
      ex(bl2, 'Момент сил считаем относительно центра масс: так в уравнение моментов входит момент сил инерции −J_C·ε без момента главного вектора Φ.');
      steps.push({ title: 'Уравнения кинетостатики', blocks: bl2 });
    } else steps.push({ title: 'Связи', blocks: [{ k: 'p', c: ['Связи не заданы — найдены только силы инерции.'] }] });
  }
  // 4. Реакции.
  if (pr.constr.length) {
    const bl: Block[] = [{ k: 'ul', items: reactItems(pr, r, FU) }];
    ex(
      bl,
      'Давление тела на опору (натяжение нити) равно реакции по модулю и противоположно по направлению. Реакция ролика с трением отклонена от нормали на угол трения против скольжения.',
    );
    steps.push({ title: 'Реакции связей', blocks: bl });
  }
  // 5. Проверка кинетостатикой (динамика).
  if (!given) {
    const sx = r.Fe[0] + live.reduce((s, x) => s + x.F[0], 0) + r.Phi[0],
      sy = r.Fe[1] + live.reduce((s, x) => s + x.F[1], 0) + r.Phi[1],
      sm = r.Me + live.reduce((s, x) => s + cross(x.r, x.F), 0) + r.MPhi;
    const lines: { num?: boolean; c: Inline[] }[] = [
      {
        c: [
          'Φ = −',
          v('m'),
          v('a'),
          sub('C'),
          ` = (${f(r.Phi[0])}; ${f(r.Phi[1])}) ${FU};  `,
          v('M'),
          sup('Φ'),
          ' = −',
          v('J'),
          sub('C'),
          `ε = ${f(r.MPhi)} ${MU}`,
        ],
      },
      {
        num: true,
        c: [
          `ΣF`,
          sub('x'),
          ' + ΣR',
          sub('x'),
          ' + Φ',
          sub('x'),
          ` = ${f(sx)};  ΣF`,
          sub('y'),
          ' + ΣR',
          sub('y'),
          ' + Φ',
          sub('y'),
          ` = ${f(sy)};  ΣM`,
          sub('C'),
          ' + ',
          v('M'),
          sup('Φ'),
          ` = ${f(sm)}`,
        ],
      },
    ];
    const bl: Block[] = [{ k: 'eq', lines }];
    ex(
      bl,
      'Принцип Даламбера: если к заданным силам и реакциям добавить силы инерции, система уравновешена — суммы проекций и моментов равны нулю. Это проверка найденного решения.',
    );
    steps.push({ title: 'Проверка: силы инерции (метод кинетостатики)', blocks: bl });
  }
  // Ответ.
  const rows: AnswerRow[] = [];
  if (!given) {
    rows.push({ kind: 'main', val: [v('a'), sub('C'), ` = ${vec(r.aC)} м/с²`], note: `модуль ${f(Math.hypot(...r.aC))} м/с²` });
    rows.push({
      kind: 'main',
      val: [`ε = ${f(r.eps)} рад/с²`],
      note: r.eps > 0 ? 'против часовой стрелки' : r.eps < 0 ? 'по часовой стрелке' : 'угловое ускорение',
    });
  }
  for (const re of r.reactions) {
    if (re.dropped) {
      rows.push({ kind: 'aux', val: [`связь ${re.i + 1}: 0`], note: 'снята' });
      continue;
    }
    re.vals.forEach((x) => rows.push({ kind: 'main', val: [...lab(x.name, re.i), ` = ${f(x.v)} ${FU}`], note: `${KIND[re.kind]} в ${re.at.trim()}` }));
  }
  rows.push({ kind: given ? 'main' : 'aux', val: ['Φ = ', `${vec(r.Phi)} ${FU}`], note: 'главный вектор сил инерции' });
  rows.push({ kind: given ? 'main' : 'aux', val: [v('M'), sup('Φ'), ` = ${f(r.MPhi)} ${MU}`], note: 'главный момент сил инерции' });
  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows }] });
  return { steps };
}
