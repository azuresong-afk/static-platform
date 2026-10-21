/** Решение: характеристики цикла, предел выносливости детали, коэффициенты запаса усталостной прочности. */
import { b, sub, v, type AnswerRow, type Block, type Doc, type Inline, type Step } from '../../../shared/doc';
import { fmt } from '../../../shared/format';
import type { CycleResult, FatigueProblem, FatigueResult } from '../model/fatigue';

const f = (x: number) => fmt(x, 3);

export function fatigueDoc(pr: FatigueProblem, r: FatigueResult, opts: { explain?: boolean } = {}): Doc {
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
  const kinds: [CycleResult | null, string, string][] = [
    [r.sigma, 'σ', 'нормальных'],
    [r.tau, 'τ', 'касательных'],
  ];
  // 1. Цикл.
  {
    const lines: { c: Inline[] }[] = [];
    for (const [c, s] of kinds) {
      if (!c) continue;
      lines.push({ c: [`${s}_max = ${f(c.max)},  ${s}_min = ${f(c.min)} МПа`] });
      lines.push({
        c: [
          v(s),
          sub('m'),
          ` = (${s}_max + ${s}_min)/2 = `,
          b(f(c.m)),
          ';  ',
          v(s),
          sub('a'),
          ` = (${s}_max − ${s}_min)/2 = `,
          b(f(c.a)),
          ` МПа;  R = ${s}_min/${s}_max = ${c.R == null ? '—' : f(c.R)}`,
        ],
      });
    }
    const bl: Block[] = [{ k: 'eq', lines }];
    for (const [c, s] of kinds) if (c) bl.push({ k: 'p', c: [`Цикл ${s === 'σ' ? 'нормальных' : 'касательных'} напряжений — ${c.kind}.`] });
    ex(
      bl,
      'Среднее напряжение σ_m — постоянная составляющая цикла, амплитуда σ_a — переменная (всегда положительна). Наиболее опасен симметричный цикл: переменная часть у него наибольшая.',
    );
    steps.push({ title: 'Характеристики цикла', blocks: bl });
  }
  // 2. Предел выносливости детали.
  {
    const lines: { c: Inline[] }[] = [];
    for (const [c, s] of kinds) {
      if (!c) continue;
      const Kc = s === 'σ' ? pr.Ks : pr.Kt;
      const KcName = s === 'σ' ? 'K_σ' : 'K_τ';
      lines.push({
        c:
          pr.kMode === 'mult'
            ? [`K_D${s === 'τ' ? '′' : ''} = ${KcName}/(K_F·K_d·β) = ${f(Kc)}/(${f(pr.KF)}·${f(pr.Kd)}·${f(pr.beta)}) = `, b(f(c.KD))]
            : [`K_D${s === 'τ' ? '′' : ''} = (${KcName}/K_d + 1/K_F − 1)/K_v = (${f(Kc)}/${f(pr.Kd)} + 1/${f(pr.KF)} − 1)/${f(pr.Kv)} = `, b(f(c.KD))],
      });
      lines.push({ c: [`предел выносливости детали ${s}₋₁D = ${s}₋₁/K_D = ${f(s === 'σ' ? pr.sig1 : pr.tau1)}/${f(c.KD)} = `, b(`${f(c.limD)} МПа`)] });
    }
    const bl: Block[] = [{ k: 'eq', lines }];
    bl.push({
      k: 'p',
      c: [
        pr.kMode === 'mult'
          ? 'Формула п. 11.5: K_σ — эффективный коэффициент концентрации напряжений, K_F — коэффициент качества поверхности, K_d — масштабный фактор, β — коэффициент агрессивности среды.'
          : 'Формула п. 11.6 (деталь с поверхностным упрочнением): K_v — коэффициент упрочнения (1,1…2,0; без упрочнения 1).',
        ' В п. 11.5 пособия обозначено K = K_F·K_d·β/K_σ < 1 и σ̄₋₁ = σ₋₁·K, а в формулах пп. 11.6–11.7 K ≥ 1 умножает амплитуду — это обратная величина; здесь везде K_D ≥ 1 и σ₋₁D = σ₋₁/K_D.',
      ],
    });
    steps.push({ title: 'Предел выносливости детали', blocks: bl });
  }
  // 3. Запасы.
  const rows: AnswerRow[] = [];
  for (const [c, s, word] of kinds) {
    if (!c) continue;
    const lim = s === 'σ' ? pr.sig1 : pr.tau1;
    const psiTxt =
      s === 'σ'
        ? `ψ_σ = σ₋₁/σ_в = ${f(pr.sig1)}/${f(pr.sigB)} = ${f(c.psi)}`
        : pr.tauB > 0
          ? `ψ_τ = τ₋₁/τ_в = ${f(pr.tau1)}/${f(pr.tauB)} = ${f(c.psi)}`
          : `ψ_τ = 0,5ψ_σ = ${f(c.psi)}`;
    const lines: { c: Inline[] }[] = [
      { c: [psiTxt] },
      {
        c: [
          v('n'),
          sub(s),
          ` = ${s}₋₁/(K_D${s === 'τ' ? '′' : ''}·${s}_a + ψ_${s}·${s}_m) = ${f(lim)}/(${f(c.KD)}·${f(c.a)} + ${f(c.psi)}·${f(c.m)}) = `,
          b(Number.isFinite(c.n) ? f(c.n) : '∞'),
        ],
      },
    ];
    const bl: Block[] = [{ k: 'eq', lines }];
    ex(
      bl,
      `Прямая предельных циклов A₀B₀: ${s}_a/${s}₋₁ + ${s}_m/${s}_в = 1 (замена опытной кривой — в запас прочности). У детали предельная амплитуда при ${s}_m = 0 уменьшается в K_D раз; запас — во сколько раз можно пропорционально увеличить ${s}_a и ${s}_m до предельного цикла.`,
    );
    steps.push({ title: `Запас по ${word} напряжениям`, blocks: bl });
    rows.push({
      kind: r.sigma && r.tau ? 'aux' : 'main',
      val: [v('n'), sub(s), ` = ${Number.isFinite(c.n) ? f(c.n) : '∞'}`],
      note: `по ${word} напряжениям; ${s}₋₁D = ${f(c.limD)} МПа`,
    });
  }
  if (r.sigma && r.tau) {
    const bl: Block[] = [
      { k: 'eq', lines: [{ c: ['1/n² = 1/n_σ² + 1/n_τ²  ⇒  ', v('n'), ' = n_σn_τ/√(n_σ² + n_τ²) = ', b(Number.isFinite(r.n) ? f(r.n) : '∞')] }] },
    ];
    ex(bl, 'Формула Гафа и Полларда для совместного действия нормальных и касательных напряжений (изгиб с кручением).');
    steps.push({ title: 'Сложное напряжённое состояние', blocks: bl });
    rows.unshift({ kind: 'main', val: [v('n'), ` = ${Number.isFinite(r.n) ? f(r.n) : '∞'}`], note: 'общий запас (Гаф и Поллард)' });
  }
  // 4. Проверка.
  {
    const bl: Block[] = [
      {
        k: 'badge',
        tone: r.okN ? 'ok' : 'bad',
        text: r.okN
          ? `n = ${Number.isFinite(r.n) ? f(r.n) : '∞'} ≥ [n] = ${f(pr.nAllow)} — усталостная прочность обеспечена`
          : `n = ${f(r.n)} < [n] = ${f(pr.nAllow)} — запас недостаточен`,
      },
    ];
    bl.push({ k: 'p', c: ['Для обычной точности расчёта на выносливость требуемый запас [n] = 1,4…1,7 (п. 11.5).'] });
    if (r.n1 != null)
      bl.push({
        k: 'p',
        c: [
          `Первое приближение п. 11.5 (без коэффициентов детали, по пределу текучести): 1/n = σ_a/σ₋₁ + σ_m/σ_т ⇒ n = ${Number.isFinite(r.n1) ? f(r.n1) : '∞'}.`,
        ],
      });
    for (const w of r.warnings) bl.push({ k: 'p', c: [w] });
    steps.push({ title: 'Проверка', blocks: bl });
  }
  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows }] });
  return { steps };
}
