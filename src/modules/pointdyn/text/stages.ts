/** Решение: составные задачи — петля с разрывом, трамплин, падение на плиту с пружиной, осколок маховика, полёт после ослабления нити. */
import { b, sub, v, type AnswerRow, type Block, type Doc, type Inline, type Step } from '../../../shared/doc';
import { sig } from '../../relative/text/earth';
import type { StageProblem, StageResult } from '../model/stages';

const L = (...c: Inline[]) => ({ c });

export function stagesDoc(p: StageProblem, r: StageResult, opts: { explain?: boolean } = {}): Doc {
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
    { k: 'eq', lines: [L(v('g'), ` = ${sig(p.g)} м/с²`, p.byWeight ? `;  m = P/g = ${sig(p.m)}/${sig(p.g)} = ${sig(r.mass)}` : `;  m = ${sig(p.m)} кг`)] },
  ];
  ex(head, 'Движение делится на этапы с разными силами; конечное положение и скорость одного этапа — начальные условия следующего.');
  steps.push({ title: 'Данные', blocks: head });
  const rows: AnswerRow[] = [];
  const add = (title: string, lines: { c: Inline[] }[], note?: string) => {
    const bl: Block[] = [{ k: 'eq', lines }];
    if (note) ex(bl, note);
    steps.push({ title, blocks: bl });
  };

  if (r.loop) {
    const q = r.loop;
    add(
      'Этап 2: полёт по параболе от D до C',
      [
        L(
          `разрыв петли симметричен относительно верхней точки B: ∠BOD = ∠BOC = α = ${sig(p.alpha)}°; в D скорость направлена по касательной — под углом α к горизонту`,
        ),
        L('дальность полёта DC = 2r sin α = v_D² sin 2α/g ⇒ v_D² = gr/cos α,  v_D = ', b(sig(q.vD)), ' м/с'),
        L(`время полёта 2v_D sin α/g = ${sig(q.tFly)} с, подъём над D на ${sig(q.apex)} м`),
      ],
      'После точки D связи нет — вагонетка летит под действием одной силы тяжести; чтобы снова попасть на петлю, парабола должна пройти через C.',
    );
    add('Этап 1: спуск до точки D', [
      L('без трения: v_D² = 2g(h − r(1 + cos α)) — высота D над нижней точкой петли r(1 + cos α)'),
      L(v('h'), ' = r(1 + cos α + 1/(2cos α)) = ', b(sig(q.hNeed)), ' м'),
      L('давление в D: N = m(v_D²/r − g cos α) = mg(1/cos α − cos α) ≥ 0 — вагонетка до D не отрывается'),
      L('h(α) наименьшая при dh/dα = 0: sin α(1/(2cos²α) − 1) = 0 ⇒ α = 45°,  h_min = r(1 + √2) = ', b(sig(q.hMin)), ' м'),
      ...(q.check
        ? [
            L(
              `проверка h = ${sig(p.h)} м: v_D = ${sig(q.check.vD)} м/с, дальность ${sig(q.check.range)} м при разрыве ${sig(q.check.gap)} м — `,
              b(q.check.ok ? 'попадает в C' : q.check.range > q.check.gap ? 'перелёт' : 'недолёт'),
            ),
          ]
        : []),
    ]);
    rows.push(
      { kind: 'main', val: [v('h'), ` = ${sig(q.hNeed)} м`], note: 'высота пуска' },
      { kind: 'aux', val: [v('h'), sub('min'), ` = ${sig(q.hMin)} м`], note: 'при α = 45°' },
      { kind: 'aux', val: [v('v'), sub('D'), ` = ${sig(q.vD)} м/с`], note: 'скорость в начале полёта' },
    );
  }

  if (r.jump) {
    const q = r.jump;
    add('Этап 1: спуск по эстакаде с трением', [
      L(`α = ${sig(p.alpha)}°, h = ${sig(p.h)} м, f = ${sig(p.f)}: работа трения f·mg cos α·h/sin α = fmgh ctg α`),
      L(v('v'), sub('C'), ' = √(2gh(1 − f ctg α)) = ', b(sig(q.vC)), ' м/с — горизонтально (площадка BC)'),
    ]);
    add(
      'Этап 2: полёт до линии приземления',
      [
        L(`толчком лыжник добавляет vᵧ = ${sig(p.vy)} м/с вверх: x = v_C t, y = vᵧt − gt²/2`),
        L(`линия приземления y = −x tg β (β = ${sig(p.beta)}°): t = 2(vᵧ + v_C tg β)/g = `, b(sig(q.t)), ' с'),
        L(`x = ${sig(q.x)} м, y = ${sig(q.y)} м;  дальность l = x/cos β = `, b(sig(q.l)), ` м;  скорость приземления ${sig(q.vLand)} м/с`),
      ],
      'Дальность считается вдоль линии приземления от точки отрыва C.',
    );
    rows.push(
      { kind: 'main', val: [v('l'), ` = ${sig(q.l)} м`], note: 'дальность полёта' },
      { kind: 'aux', val: [v('v'), sub('C'), ` = ${sig(q.vC)} м/с`], note: 'скорость отрыва' },
      { kind: 'aux', val: [v('t'), ` = ${sig(q.t)} с`], note: 'время полёта' },
    );
  }

  if (r.plate) {
    const q = r.plate;
    add('Этап 1: свободное падение', [L(`скорость удара v = √(2gH) = ${sig(q.v)} м/с, время падения √(2H/g) = ${sig(Math.sqrt((2 * p.H) / p.g))} с`)]);
    add(
      'Этап 2: сжатие пружины',
      [
        L(`энергия: P(H + h) = ch²/2 ⇒ c = 2P(H + h)/h² = ${sig(q.c)} ${fu}/м;  k = √(c/m) = √(2g(H + h))/h = ${sig(q.k)} с⁻¹`),
        L(`от удара: x = δ + A sin(kt − ψ), δ = P/c = ${sig(q.delta)} м — статическое сжатие; tg ψ = δk/v = h/(2√(H(H + h))), ψ = ${sig(q.psi)}°`),
        L('наибольшее сжатие при kT − ψ = π/2: ', v('T'), ' = (π/2 + ψ)/k = ', b(sig(q.T)), ' с'),
        L('теорема об импульсе за время T: S − PT = 0 − (−mv) ⇒ ', v('S'), ' = P(T + √(2H/g)) = ', b(sig(q.S)), ` ${fu}·с`),
        L(`наибольшая сила пружины ch = ${sig(q.Fmax)} ${fu}`),
      ],
      'Книга записывает ответ как T = (π/2 − α)/k, tg α = −h/(2√(H(H + h))) — это тот же угол с другим знаком.',
    );
    rows.push(
      { kind: 'main', val: [v('T'), ` = ${sig(q.T)} с`], note: 'время сжатия' },
      { kind: 'main', val: [v('S'), ` = ${sig(q.S)} ${fu}·с`], note: 'импульс силы пружины' },
    );
  }

  if (r.fly) {
    const q = r.fly;
    add(
      'Полёт осколка',
      [
        L('дальность на том же уровне s = v² sin 2θ/g наибольшая при θ = 45°: v = √(gs) = ', b(sig(q.v)), ' м/с'),
        L(`осколок отрывается от обода со скоростью ωR: ω = v/R = `, b(sig(q.omega)), ' рад/с = ', b(sig(q.rpm)), ' об/мин'),
      ],
      'Дальность меньше наибольшей при любом другом угле вылета — значит, при меньшей ω осколок не мог улететь на s: найденная ω наименьшая.',
    );
    rows.push({ kind: 'main', val: [`n = ${sig(q.rpm)} об/мин`], note: `ω = ${sig(q.omega)} рад/с` });
  }

  if (r.slack) {
    const q = r.slack;
    add('Этап 1: движение с натянутой нитью', [
      L(`v² = v₀² − 2gl(cos φ₀ − cos φ), T = m(v²/l + g cos φ); T = 0 при φ = ${sig(q.phi)}° от нижней точки`),
      L(`точка M: на ${sig(q.hM)} м ${q.hM >= 0 ? 'выше' : 'ниже'} точки подвеса O, v₁ = `, b(sig(q.v)), ' м/с'),
    ]);
    add(
      'Этап 2: полёт по параболе',
      [
        L(
          `в осях M x (горизонтально), M y (вверх): y = x tg θ − gx²/(2v₁²cos²θ),  tg θ = ${sig(q.tanT)},  g/(2v₁²cos²θ) = ${sig(q.q)} 1/м (${sig(q.q / 100)} 1/см)`,
        ),
        L('нить снова натягивается, когда |OM| = l: ', v('t'), ' = ', b(sig(q.t)), ` с, точка (${sig(q.end[0])}; ${sig(q.end[1])}) м относительно O`),
      ],
      'После ослабления нити груз движется как брошенный под углом к горизонту, пока не окажется снова на окружности радиуса l.',
    );
    rows.push(
      { kind: 'main', val: [v('v'), sub('1'), ` = ${sig(q.v)} м/с`], note: `точка M на ${sig(q.hM)} м над O` },
      { kind: 'main', val: [v('t'), ` = ${sig(q.t)} с`], note: 'время полёта по параболе' },
    );
  }

  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows }] });
  return { steps };
}
