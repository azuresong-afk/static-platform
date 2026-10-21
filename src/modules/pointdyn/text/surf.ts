/** Решение: движение точки по поверхности и кривой — цилиндр, конус, шероховатая окружность, проволока, цепная линия, винтовая поверхность, маятник на высоте. */
import { b, sub, v, type AnswerRow, type Block, type Doc, type Inline, type Step } from '../../../shared/doc';
import { sig } from '../../relative/text/earth';
import type { SurfProblem, SurfResult } from '../model/surf';

const L = (...c: Inline[]) => ({ c });
const ROUGH_KIND = {
  stop: 'останавливается и остаётся в покое (tg φ ≤ f)',
  slideBack: 'останавливается, но трение не удерживает — соскальзывает назад',
  detach: 'сходит с поверхности (N = 0)',
  top: 'доходит до верхней точки, не отрываясь',
  none: 'проходит четверть окружности',
} as const;

export function surfDoc(p: SurfProblem, r: SurfResult, opts: { explain?: boolean } = {}): Doc {
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
  const head: Block[] = [
    {
      k: 'eq',
      lines: [
        L(v('g'), ` = ${sig(p.g)} м/с²`, p.byWeight ? `;  m = P/g = ${sig(p.m)}/${sig(p.g)} = ${sig(r.mass)}` : `;  m = ${sig(p.m)} кг`),
        L(
          'm',
          v('a'),
          ' = ',
          v('F'),
          ' + ',
          v('N'),
          p.ask === 'rough' || p.ask === 'helix' ? ' + F_тр,  F_тр = fN — против скорости' : ' — связь гладкая, реакция N по нормали',
        ),
      ],
    },
  ];
  ex(head, 'Несвободная точка: уравнение движения проецируем на касательную (закон движения) и на нормаль (реакция связи).');
  steps.push({ title: 'Уравнение движения несвободной точки', blocks: head });
  const rows: AnswerRow[] = [];

  if (r.cyl) {
    const q = r.cyl;
    const bl: Block[] = [
      {
        k: 'eq',
        lines: [
          L('цилиндр гладкий, ось вертикальна: реакция горизонтальна и направлена к оси; по вертикали — только тяжесть'),
          L(
            `горизонтальная проекция скорости постоянна: v₀ cos α = ${sig(p.v0 * Math.cos((p.alpha * Math.PI) / 180))} м/с — равномерно по окружности радиуса r`,
          ),
          L(v('N'), ' = m(v₀ cos α)²/r = ', b(sig(q.N)), ` ${fu}  (Pv₀²cos²α/(gr))`),
          L(`φ = (v₀ cos α/r)t;  x = r cos φ,  y = r sin φ,  z = v₀t sin α + gt²/2 (ось z — вниз)`),
          L(`при t = ${sig(p.t1)} с: φ = ${sig(q.phi)} рад, x = `, b(sig(q.x)), ' м, y = ', b(sig(q.y)), ' м, z = ', b(sig(q.z)), ' м'),
        ],
      },
    ];
    ex(bl, 'Давление постоянно — оно зависит только от горизонтальной составляющей скорости. Траектория — винтовая линия с переменным шагом.');
    steps.push({ title: 'Точка внутри вертикального цилиндра', blocks: bl });
    rows.push(
      { kind: 'main', val: [v('N'), ` = ${sig(q.N)} ${fu}`], note: 'давление на цилиндр' },
      { kind: 'aux', val: [`(${sig(q.x)}; ${sig(q.y)}; ${sig(q.z)}) м`], note: `положение при t = ${sig(p.t1)} с` },
    );
  }

  if (r.cone) {
    const q = r.cone;
    const bl: Block[] = [
      {
        k: 'eq',
        lines: [
          L(`конус: вершина O внизу, ось вверх, α = ${sig(p.alpha)}°; s = OM, r = s sin α, z = s cos α`),
          L('сила отталкивания c·OM и реакция не дают момента относительно оси: r²φ̇ = (a sin α)v₀ — закон площадей'),
          L(
            'вдоль образующей: s̈ = rφ̇² sin α + (c/m)s',
            p.grav ? ' − g cos α' : ' (тяжести нет)',
            ';  по нормали: N = m(',
            p.grav ? 'g sin α + ' : '',
            'rφ̇² cos α)',
          ),
          L(`численно (Рунге — Кутта) до t = ${sig(p.t1)} с: r = `, b(sig(q.r)), ' м, φ = ', b(sig(q.phi)), ` рад, z = ${sig(q.z)} м`),
          L(v('N'), ' = ', b(sig(q.N)), ` ${fu}`),
        ],
      },
    ];
    ex(
      bl,
      'Сила, направленная к вершине или от неё, лежит на образующей и в нормаль не входит. При α = 45° и c/m = 1 с⁻² книга даёт закон r² = e²ᵗ + e⁻²ᵗ (в см²).',
    );
    steps.push({ title: 'Точка на гладком конусе', blocks: bl });
    rows.push(
      { kind: 'main', val: [v('r'), ` = ${sig(q.r)} м`], note: `расстояние от оси при t = ${sig(p.t1)} с` },
      { kind: 'aux', val: ['φ = ', `${sig(q.phi)} рад`], note: 'полярный угол' },
      { kind: 'aux', val: [v('N'), ` = ${sig(q.N)} ${fu}`], note: 'давление на конус' },
    );
  }

  if (r.rough) {
    const q = r.rough;
    const outer = p.side === 'outer';
    const bl: Block[] = [
      {
        k: 'eq',
        lines: [
          L(
            outer
              ? 'снаружи, φ — от верхней точки: N = m(g cos φ − v²/R),  m dv/dt = mg sin φ − fN'
              : 'изнутри, φ — от нижней точки: N = m(v²/R + g cos φ),  m dv/dt = −mg sin φ − fN',
          ),
          L(outer ? 'u = v²: du/dφ − 2fu = 2gR(sin φ − f cos φ)' : 'u = v²: du/dφ + 2fu = −2gR(sin φ + f cos φ)', ' — линейное уравнение, решаем численно'),
          L(
            `v₀ = ${sig(p.v0)} м/с: точка `,
            b(ROUGH_KIND[q.kind]),
            q.kind === 'none' ? '' : ` при φ = ${sig(q.phi)}°${q.kind === 'detach' || q.kind === 'top' ? `, v = ${sig(q.v)} м/с` : ''}`,
          ),
          L(
            outer ? 'остановиться на поверхности можно лишь при φ ≤ φ₀ = arctg f = ' : 'дойти до верхней точки без отрыва: v² ≥ gR вверху; ',
            outer ? `${sig(q.phi0)}°;  ` : '',
            outer ? 'v₀ ≤ √(2gR/(1 + 4f²)·[√(1 + f²)e^{−2fφ₀} − (1 − 2f²)]) = ' : 'v₀ ≥ √(gR/(1 + 4f²)·[2(1 − 2f²) + 3e^{2πf}]) = ',
            b(sig(q.vCritBook)),
            ` м/с (численно ${sig(q.vCrit)} м/с)`,
          ),
        ],
      },
    ];
    ex(
      bl,
      outer
        ? 'Тело на вершине шероховатого полуцилиндра: с малой скоростью трение останавливает его, пока уклон мал (tg φ ≤ f); с большой оно разгоняется и сходит с поверхности.'
        : 'Внутри цилиндра давление и трение больше, чем без трения: потребная скорость растёт как e^{πf}.',
    );
    steps.push({ title: outer ? 'Шероховатый полуцилиндр снаружи' : 'Шероховатый цилиндр изнутри', blocks: bl });
    rows.push(
      {
        kind: 'main',
        val: [v('v'), sub('0'), outer ? ' ≤ ' : ' ≥ ', `${sig(q.vCritBook)} м/с`],
        note: outer ? 'чтобы остановиться на поверхности' : 'чтобы дойти до верхней точки',
      },
      { kind: 'aux', val: [ROUGH_KIND[q.kind]], note: q.kind === 'none' ? '' : `φ = ${sig(q.phi)}°` },
    );
  }

  if (r.wire) {
    const q = r.wire;
    const lines = [
      L(`нить l = ${sig(p.l)} м, проволока O₁: OO₁ = h = ${sig(p.h)} м под углом β = ${sig(p.beta)}° к вертикали; начальный угол α = ${sig(p.alpha)}°, v₀ = 0`),
    ];
    if (!q.reaches) lines.push(L('нить не доходит до проволоки: β ≥ α'));
    else
      lines.push(
        L(`при встрече v² = 2gl(cos β − cos α) = ${sig(q.v ** 2)} (м/с)²;  радиус окружности скачком уменьшается с l до l − h`),
        L(
          `натяжение: до встречи m(v²/l + g cos β) = ${sig(q.T1)} ${fu}, после m(v²/(l − h) + g cos β) = ${sig(q.T2)} ${fu};  Δ`,
          v('T'),
          ' = mv²h/(l(l − h)) = ',
          b(sig(q.dT)),
          ` ${fu}`,
        ),
        L(
          `вверху малой окружности v² = ${sig(q.vTop2)}, нужно не меньше g(l − h) = ${sig(p.g * (p.l - p.h))}: нить `,
          b(q.winds ? 'навивается на проволоку' : 'не навивается (ослабнет раньше)'),
        ),
      );
    if (q.alphaMin != null)
      lines.push(
        L(
          'наименьший угол: cos α = (h/l)(3/2 + cos β) − 3/2, α = ',
          b(`${sig(q.alphaMin)}°`),
          q.dTbook != null ? `;  при нём ΔT = 2mg(h/l)(3/2 + cos β) = ${sig(q.dTbook)} ${fu}` : '',
        ),
      );
    const bl: Block[] = [{ k: 'eq', lines }];
    ex(
      bl,
      'В момент встречи скорость не меняется, а радиус кривизны траектории уменьшается — натяжение возрастает скачком. Чтобы нить навивалась, груз должен пройти верхнюю точку малой окружности с натянутой нитью.',
    );
    steps.push({ title: 'Нить встречает проволоку', blocks: bl });
    if (q.alphaMin != null) rows.push({ kind: 'main', val: ['α', sub('min'), ` = ${sig(q.alphaMin)}°`], note: 'нить навивается на проволоку' });
    if (q.reaches) rows.push({ kind: 'aux', val: ['Δ', v('T'), ` = ${sig(q.dT)} ${fu}`], note: 'скачок натяжения при встрече' });
  }

  if (r.chain) {
    const q = r.chain;
    const bl: Block[] = [
      {
        k: 'eq',
        lines: [
          L(`цепная линия y = a ch(x/a), a = ${sig(p.a)} м; сила kmy вдоль оси y от оси x, k = ${sig(p.k)} с⁻², тяжести нет`),
          L('интеграл энергии: v² − ky² = v₀² − ky₀²;  ρ = y²/a;  N = m(v²/ρ − ka) = m(v²a/y² − ka)'),
          L(q.free ? 'v₀² = ky₀²: N = 0 всё время, v = √k·y, ẋ = v/ch(x/a) = a√k — равномерно по x' : 'v₀² ≠ ky₀²: ẋ = √(v₀² − ky₀² + ky²)/ch(x/a) — численно'),
          L(`при t = ${sig(p.t1)} с: x = `, b(sig(q.x)), ` м, y = ${sig(q.y)} м, v = ${sig(q.v)} м/с;  `, v('N'), ' = ', b(sig(q.N)), ` ${fu}`),
        ],
      },
    ];
    ex(
      bl,
      'Составляющая силы kmy по нормали к цепной линии равна kma — постоянна; если она как раз даёт нужное нормальное ускорение, кривая не давит на точку.',
    );
    steps.push({ title: 'Движение по цепной линии', blocks: bl });
    rows.push(
      { kind: 'main', val: [v('N'), ` = ${sig(q.N)} ${fu}`], note: 'давление на кривую' },
      { kind: 'main', val: [v('x'), ` = ${sig(q.x)} м`], note: `при t = ${sig(p.t1)} с${q.free ? `, x = x₀ + a√k·t` : ''}` },
    );
  }

  if (r.helix) {
    const q = r.helix;
    const bl: Block[] = [
      {
        k: 'eq',
        lines: [
          L(
            `винтовая поверхность z = aφ + f(r), a = ${sig(p.a)} м, r₀ = ${sig(p.r)} м, f′(r₀) = ${sig(p.p)}: tg α = a/r₀ = ${sig(q.tanA)} (α = ${sig(q.ang)}°)`,
          ),
          L('по касательной: mg sin α = kN;  по бинормали: N = mg cos²α·√(1 + tg²α + f′²);  по главной нормали: mv²cos²α/r₀ = N f′/√(1 + tg²α + f′²)'),
          L(
            'условие: tg α − k√(1 + f′²(r₀)cos²α) = 0 ⇒ k = ',
            b(sig(q.kNeed)),
            q.holds == null ? '' : q.holds ? ` — при заданном k = ${sig(p.k)} выполняется` : ` — при заданном k = ${sig(p.k)} не выполняется`,
          ),
          L(v('v'), ' = √(g r₀ f′(r₀)) = ', b(sig(q.v)), ' м/с'),
        ],
      },
    ];
    ex(
      bl,
      'Движение равномерное: трение уравновешивает касательную составляющую тяжести, нормальная реакция — остальные составляющие вместе с силой инерции mv²cos²α/r₀.',
    );
    steps.push({ title: 'Движение по винтовой линии на шероховатой поверхности', blocks: bl });
    rows.push(
      { kind: 'main', val: [v('k'), ` = ${sig(q.kNeed)}`], note: 'коэффициент трения для движения по винтовой линии' },
      { kind: 'main', val: [v('v'), ` = ${sig(q.v)} м/с`], note: 'скорость' },
    );
  }

  if (r.alt) {
    const q = r.alt;
    const bl: Block[] = [
      {
        k: 'eq',
        lines: [
          L('период малых колебаний 2π√(l/g) не изменится, если l/g постоянно; g_H = g(R/(R + H))²'),
          L(`g_H = ${sig(p.g)}·(${sig(p.Re)}/${sig(p.Re + p.H)})² = ${sig(q.gH)} м/с²`),
          L('Δl/l = 1 − (R/(R + H))² = ', b(sig(q.ratio))),
        ],
      },
    ];
    ex(bl, 'Сила тяжести обратно пропорциональна квадрату расстояния до центра Земли; вращение Земли не учитываем.');
    steps.push({ title: 'Маятник на высоте', blocks: bl });
    rows.push({ kind: 'main', val: [`Δl = ${sig(q.ratio)}·l`], note: 'на сколько уменьшить длину нити' });
  }

  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows }] });
  return { steps };
}
