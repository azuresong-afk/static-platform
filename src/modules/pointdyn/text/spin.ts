/** Решение: равновесие при равномерном вращении — вираж, конический маятник, вертикальная окружность, пружина, стержни тахометра, трубка. */
import { b, sub, v, type AnswerRow, type Block, type Doc, type Inline, type Step } from '../../../shared/doc';
import { sig } from '../../relative/text/earth';
import type { SpinProblem, SpinResult } from '../model/spin';

const L = (...c: Inline[]) => ({ c });
const dm = (deg: number) => {
  const a = Math.abs(deg);
  let d = Math.floor(a),
    m = Math.round((a - d) * 60);
  if (m === 60) {
    d += 1;
    m = 0;
  }
  return `${deg < 0 ? '−' : ''}${d}°${String(m).padStart(2, '0')}′`;
};
const rpm = (w: number) => sig((w * 30) / Math.PI);

export function spinDoc(p: SpinProblem, r: SpinResult, opts: { explain?: boolean } = {}): Doc {
  const steps: Step[] = [];
  const ex = (bl: Block[], ...c: Inline[]) => {
    if (opts.explain) bl.push({ k: 'p', cls: 'explain', c });
  };
  if (!r.ok)
    return {
      steps: [
        {
          title: 'Данные',
          blocks: [
            { k: 'badge', tone: 'bad', text: 'проверьте данные' },
            { k: 'ul', items: r.errors.map((x) => [x]) },
          ],
        },
      ],
    };
  const fu = p.byWeight ? 'кГ' : 'Н';
  const mline = L(v('g'), ` = ${sig(p.g)} м/с²`, p.byWeight ? `;  m = P/g = ${sig(p.m)}/${sig(p.g)} = ${sig(r.mass)}` : `;  m = ${sig(p.m)} кг`);
  const head: Block[] = [
    {
      k: 'eq',
      lines: [
        mline,
        L(
          'm',
          v('a'),
          ' = ',
          v('F'),
          ' + ',
          v('N'),
          ' ⇔ ',
          v('F'),
          ' + ',
          v('N'),
          ' + ',
          v('Φ'),
          ' = 0,  ',
          v('Φ'),
          ' = mω²R — от оси (центробежная сила инерции)',
        ),
      ],
    },
  ];
  ex(
    head,
    'Точка равномерно движется по окружности: ускорение направлено к центру и равно v²/R = ω²R. Добавив к силам центробежную силу инерции, получаем уравнения равновесия (принцип Даламбера) — задача становится статической.',
  );
  steps.push({ title: 'Принцип Даламбера', blocks: head });
  const rows: AnswerRow[] = [];

  if (r.bank) {
    const q = r.bank;
    if (p.find === 'radius') {
      const bl: Block[] = [
        {
          k: 'eq',
          lines: [
            L('давление на весы — сумма веса и центробежной силы: N = m√(g² + (v²/R)²) = kP'),
            L(`v²/R = g√(k² − 1) = ${sig(p.g)}·√(${sig(p.k)}² − 1) = ${sig(p.g * q.q)} м/с²`),
            L(v('R'), ` = v²/(g√(k² − 1)) = ${sig(p.v)}²/${sig(p.g * q.q)} = `, b(sig(q.Rfound)), ' м'),
            L(`груз на весах отклонён от вертикали на arccos(1/k) = ${sig(q.tilt)}°`),
          ],
        },
      ];
      ex(bl, 'Пружинные весы показывают натяжение пружины — модуль суммы силы тяжести и центробежной силы инерции (они перпендикулярны).');
      steps.push({ title: 'Радиус закругления по показанию весов', blocks: bl });
      rows.push({ kind: 'main', val: [v('R'), ` = ${sig(q.Rfound)} м`], note: `k = N/P = ${sig(p.k)}` });
    } else if (p.find === 'angle') {
      const bl: Block[] = [
        {
          k: 'eq',
          lines: [
            L('давление перпендикулярно полотну, если равнодействующая mg и mv²/R направлена по нормали:'),
            L('tg α* = v²/(gR) = ', `${sig(p.v)}²/(${sig(p.g)}·${sig(p.R)}) = `, b(sig(q.q)), ',  α* = ', b(`${sig(q.alphaStar)}° (${dm(q.alphaStar)})`)),
            L(v('N'), ` = m√(g² + v⁴/R²) = `, b(sig(q.Ntot)), ` ${fu}`),
            ...(p.d > 0
              ? [L(v('h'), ` = d sin α* = ${sig(p.d)}·${sig(Math.sin((q.alphaStar * Math.PI) / 180))} = `, b(sig(q.h)), ' м — возвышение наружного рельса')]
              : []),
            L(`на горизонтальной дороге (велосипедист) сила трения должна дать mv²/R: f ≥ v²/(gR) = ${sig(q.fNeed)}`),
          ],
        },
      ];
      ex(
        bl,
        'Тот же угол α* — наклон велосипедиста к вертикали и отклонение подвесного вагона: сила реакции (опоры или подвески) направлена по равнодействующей силы тяжести и центробежной силы.',
      );
      steps.push({ title: 'Наклон без бокового усилия', blocks: bl });
      rows.push(
        { kind: 'main', val: ['α* = ', `${sig(q.alphaStar)}° (${dm(q.alphaStar)})`], note: 'tg α* = v²/(gR)' },
        { kind: 'aux', val: [v('N'), ` = ${sig(q.Ntot)} ${fu}`], note: 'давление (натяжение подвески)' },
      );
      if (p.d > 0) rows.push({ kind: 'aux', val: [v('h'), ` = ${sig(q.h)} м`], note: 'возвышение наружного рельса' });
      rows.push({ kind: 'aux', val: [v('f'), sub('min'), ` = ${sig(q.fNeed)}`], note: 'трение на горизонтальной дороге' });
    } else {
      const inf = !Number.isFinite(q.vMax);
      const bl: Block[] = [
        {
          k: 'eq',
          lines: [
            L(`вираж с уклоном α = ${sig(p.alpha)}°, трение f = ${sig(p.f)}: сила трения fN — вдоль откоса вверх (малая скорость) или вниз (большая)`),
            L('по нормали и вдоль откоса: N = m(g cos α + (v²/R) sin α),  F_тр = m((v²/R) cos α − g sin α)'),
            L(
              v('v'),
              sub('min'),
              ' = √(gR(tg α − f)/(1 + f tg α)) = ',
              b(q.vMin > 0 ? sig(q.vMin) : '0'),
              ' м/с',
              q.vMin > 0 ? '' : ' (тело удерживается трением и в покое)',
            ),
            L(v('v'), sub('max'), ' = √(gR(tg α + f)/(1 − f tg α)) = ', b(inf ? '∞' : sig(q.vMax)), inf ? ' (f tg α ≥ 1 — ограничения нет)' : ' м/с'),
            L(`без трения: v = √(gR tg α) = ${sig(q.vIdeal)} м/с`),
            L(
              `при v = ${sig(p.v)} м/с: N = `,
              b(sig(q.N)),
              ` ${fu},  F_тр = ${sig(q.Ffr)} ${fu} (${q.Ffr >= 0 ? 'вниз по откосу' : 'вверх по откосу'}), нужно f ≥ ${sig(q.fNeed)}`,
            ),
          ],
        },
      ];
      ex(
        bl,
        'При наименьшей скорости точка стремится соскользнуть вниз — трение направлено вверх по откосу; при наибольшей — вверх, трение вниз. Сила трения не больше fN.',
      );
      steps.push({ title: 'Пределы скорости на вираже', blocks: bl });
      rows.push(
        { kind: 'main', val: [v('v'), sub('min'), ` = ${q.vMin > 0 ? sig(q.vMin) : '0'} м/с`], note: 'наименьшая скорость' },
        { kind: 'main', val: [v('v'), sub('max'), ` = ${inf ? '∞' : sig(q.vMax) + ' м/с'}`], note: 'наибольшая скорость' },
        { kind: 'aux', val: [v('N'), ` = ${sig(q.N)} ${fu}`], note: `давление при v = ${sig(p.v)} м/с` },
      );
    }
  }

  if (r.cone) {
    const q = r.cone;
    const lines = [
      L('нить длиной l, угол с вертикалью θ, радиус окружности r = l sin θ, высота подвеса над окружностью z₀ = l cos θ'),
      L('по вертикали T cos θ = mg, по радиусу T sin θ = mω²r ⇒ ω² = g/(l cos θ) = g/z₀,  T = mω²l'),
    ];
    if (q.hangs) lines.push(L(`ω² l = ${sig(p.omega ** 2 * p.l)} ≤ g: отклонённого положения нет — нить вертикальна, T = mg = ${sig(q.T)} ${fu}`));
    else
      lines.push(
        L('θ = ', b(`${sig(q.theta)}°`), `,  r = ${sig(q.r)} м,  z₀ = ${sig(q.z0)} м`),
        L(v('ω'), ' = ', b(sig(q.omega)), ` рад/с (${rpm(q.omega)} об/мин),  `, v('v'), ' = ωr = ', b(sig(q.v)), ' м/с'),
        L(v('T'), ' = ', b(sig(q.T)), ` ${fu},  период обращения 2π/ω = 2π√(z₀/g) = `, b(sig(q.period)), ' с'),
      );
    const bl: Block[] = [{ k: 'eq', lines }];
    ex(
      bl,
      'Сферический маятник описывает горизонтальную окружность, если начальная скорость перпендикулярна плоскости, проходящей через нить и вертикаль, и равна v₀ = r√(g/z₀).',
    );
    steps.push({ title: 'Конический маятник', blocks: bl });
    rows.push(
      { kind: 'main', val: ['θ = ', `${sig(q.theta)}°`], note: 'угол нити с вертикалью' },
      { kind: 'main', val: [v('v'), ` = ${sig(q.v)} м/с`], note: `ω = ${sig(q.omega)} рад/с` },
      { kind: 'aux', val: [v('T'), ` = ${sig(q.T)} ${fu}`], note: 'натяжение нити' },
      { kind: 'aux', val: [`период ${sig(q.period)} с`], note: 'время одного оборота' },
    );
  }

  if (r.vert) {
    const q = r.vert;
    const lines = [L('равномерно по вертикальной окружности радиуса R: внизу N − mg = mω²R, вверху N + mg = mω²R')];
    if (p.find === 'break')
      lines.push(
        L(`нить рвётся внизу, где натяжение наибольшее: T = m(g + ω²R) ⇒ ω = √((T/m − g)/R) = √((${sig(p.T)}/${sig(r.mass)} − ${sig(p.g)})/${sig(p.R)})`),
      );
    if (p.find === 'top') lines.push(L('давление вверху исчезает, когда ω²R = g: ω = √(g/R)'));
    lines.push(
      L(v('ω'), ' = ', b(sig(q.omega)), ` рад/с (${rpm(q.omega)} об/мин),  `, v('v'), ' = ωR = ', b(sig(q.v)), ' м/с'),
      L(v('N'), sub('низ'), ' = m(g + v²/R) = ', b(sig(q.Nb)), ` ${fu},  `, v('N'), sub('верх'), ' = m(v²/R − g) = ', sig(q.Nt), ` ${fu}`),
    );
    if (q.vTrain != null)
      lines.push(
        L(
          `шатун движется поступательно, его точки — по окружностям радиуса кривошипа; скорость тепловоза ωD/2 = ${sig(q.omega)}·${sig(p.D)}/2 = `,
          b(sig(q.vTrain)),
          ` м/с = ${sig(q.vTrain * 3.6)} км/ч`,
        ),
      );
    const bl: Block[] = [{ k: 'eq', lines }];
    ex(
      bl,
      'Нормальное ускорение направлено к центру: внизу — вверх (сила связи больше веса), вверху — вниз (сила связи меньше). Отрицательное N вверху — связь должна тянуть точку вниз (жидкость выливается, нить провисает).',
    );
    steps.push({ title: 'Вертикальная окружность', blocks: bl });
    rows.push({ kind: 'main', val: [v('ω'), ` = ${sig(q.omega)} рад/с`], note: `v = ${sig(q.v)} м/с` });
    if (q.vTrain != null) rows.push({ kind: 'main', val: [v('v'), ` = ${sig(q.vTrain * 3.6)} км/ч`], note: 'скорость тепловоза' });
    rows.push(
      { kind: 'aux', val: [v('N'), sub('низ'), ` = ${sig(q.Nb)} ${fu}`], note: 'в нижней точке' },
      { kind: 'aux', val: [v('N'), sub('верх'), ` = ${sig(q.Nt)} ${fu}`], note: 'в верхней точке' },
    );
  }

  if (r.spring) {
    const q = r.spring;
    const cu = `${fu}/м`;
    const lines = [L('пружина тянет груз к оси с силой c(r − r_s) — она уравновешивает центробежную силу: mω²r = c(r − r_s)')];
    if (p.find === 'r')
      lines.push(L(v('r'), ` = c·r_s/(c − mω²) = ${sig(p.c)}·${sig(p.rs)}/(${sig(p.c)} − ${sig(r.mass * p.omega ** 2)}) = `, b(sig(q.r)), ' м'));
    if (p.find === 'c')
      lines.push(
        L(v('c'), ` = mω²r/(r − r_s) = ${sig(r.mass * p.omega ** 2)}·${sig(p.r)}/${sig(p.r - p.rs)} = `, b(sig(q.c)), ` ${cu} = ${sig(q.c / 100)} ${fu}/см`),
      );
    if (p.find === 'omega') lines.push(L(v('ω'), ' = √(c(r − r_s)/(mr)) = ', b(sig(q.omega)), ` рад/с (${rpm(q.omega)} об/мин)`));
    if (p.find === 'c2')
      lines.push(
        L(
          `два состояния: mω₁²r₁ = c(r₁ − r_s),  mω₂²r₂ = c(r₂ − r_s);  ω₁ = ${sig(p.omega)} (${rpm(p.omega)} об/мин), ω₂ = ${sig(p.w2)} рад/с (${rpm(p.w2)} об/мин)`,
        ),
        L(v('c'), ` = m(ω₂²r₂ − ω₁²r₁)/(r₂ − r₁) = `, b(sig(q.c)), ` ${cu} = ${sig(q.c / 100)} ${fu}/см`),
        L(`r_s = r₁ − mω₁²r₁/c = ${sig(q.rs)} м — предварительное сжатие пружины в первом состоянии ${sig(p.r - q.rs)} м`),
      );
    lines.push(L(`сила пружины ${sig(q.F)} ${fu}`));
    const bl: Block[] = [{ k: 'eq', lines }];
    ex(
      bl,
      'r_s — расстояние центра тяжести груза от оси, при котором пружина не напряжена. Если пружина в рабочем положении уже сжата (предварительный натяг), r_s меньше рабочего радиуса.',
    );
    steps.push({ title: 'Груз на пружине во вращающейся направляющей', blocks: bl });
    rows.push(
      p.find === 'r'
        ? { kind: 'main', val: [v('r'), ` = ${sig(q.r)} м`], note: 'расстояние от оси' }
        : p.find === 'omega'
          ? { kind: 'main', val: [v('ω'), ` = ${sig(q.omega)} рад/с`], note: `${rpm(q.omega)} об/мин` }
          : { kind: 'main', val: [v('c'), ` = ${sig(q.c)} ${cu}`], note: `${sig(q.c / 100)} ${fu}/см` },
    );
  }

  if (r.rods) {
    const q = r.rods;
    const lines = [
      L(`плечи a = ${sig(p.a)} м (θ₁ = φ от вертикали вниз) и b = ${sig(p.b)} м (θ₂ = φ − ${sig(p.gamma)}°)`),
      L('погонная масса ρ = m/(a + b)'),
      L('момент тяжести: (ρg/2)(a² sin θ₁ + b² sin θ₂)'),
      L('момент центробежных сил: ∫ρω²(s sin θ)(s cos θ)ds = (ρω²/3)(a³ sin θ₁ cos θ₁ + b³ sin θ₂ cos θ₂)'),
    ];
    if (p.find === 'omega')
      lines.push(
        L('ω² = (3g/2)(a² sin θ₁ + b² sin θ₂)/(a³ sin θ₁ cos θ₁ + b³ sin θ₂ cos θ₂)'),
        L(`при φ = ${sig(p.phi)}°: ω = `, b(sig(q.omega)), ` рад/с (${rpm(q.omega)} об/мин)`),
      );
    else {
      lines.push(
        L(
          'положения относительного равновесия при ω = ',
          sig(p.omega),
          ' рад/с: ',
          q.roots.map((x) => `${sig(x.phi)}° (${x.stable ? 'устойчиво' : 'неустойчиво'})`).join(', '),
        ),
      );
      lines.push(L('φ = ', b(`${sig(q.phi)}°`)));
    }
    lines.push(
      L(`давление на шарнир: по вертикали P = ${sig(q.Nv)} ${fu}, по горизонтали ρω²Σ(lᵢ²/2) sin θᵢ = ${sig(q.Nh)} ${fu}`),
      L(v('N'), ' = ', b(sig(q.N)), ` ${fu}`),
    );
    const bl: Block[] = [{ k: 'eq', lines }];
    ex(
      bl,
      'Силы инерции элементов стержня пропорциональны расстоянию до оси и параллельны, их равнодействующая приложена не в центре тяжести — поэтому момент считается интегралом. Для одного стержня (b = 0): cos φ = 3g/(2lω²).',
    );
    steps.push({ title: 'Стержни на вращающемся валу', blocks: bl });
    rows.push(
      {
        kind: 'main',
        val: p.find === 'omega' ? [v('ω'), ` = ${sig(q.omega)} рад/с`] : ['φ = ', `${sig(q.phi)}°`],
        note: p.find === 'omega' ? `${rpm(q.omega)} об/мин` : 'угол плеча a с вертикалью',
      },
      { kind: 'aux', val: [v('N'), ` = ${sig(q.N)} ${fu}`], note: 'давление на шарнир' },
    );
  }

  if (r.tube) {
    const q = r.tube;
    const bl: Block[] = [
      {
        k: 'eq',
        lines: [
          L('шарик в покое относительно трубки: равнодействующая mg и mω²x перпендикулярна трубке'),
          L('dy/dx = ω²x/g ⇒ y = ω²x²/(2g) + c — парабола'),
          L(`при x = ${sig(p.x1)} м: y − c = `, b(sig(q.y)), ` м, наклон dy/dx = ${sig(q.slope)} (${sig(q.ang)}°)`),
        ],
      },
    ];
    ex(bl, 'Касательная к трубке должна быть перпендикулярна силе (−mω²x вдоль оси x наружу, mg вниз): tg угла наклона касательной равен ω²x/g.');
    steps.push({ title: 'Форма трубки', blocks: bl });
    rows.push(
      { kind: 'main', val: ['y = ω²x²/(2g) + c'], note: `ω²/(2g) = ${sig(p.omega ** 2 / (2 * p.g))} 1/м` },
      { kind: 'aux', val: [`y(${sig(p.x1)}) − c = ${sig(q.y)} м`], note: 'высота над вершиной параболы' },
    );
  }

  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows }] });
  return { steps };
}
