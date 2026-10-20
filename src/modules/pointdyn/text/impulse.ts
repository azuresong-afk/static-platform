/** Решение: теоремы об импульсе и о моменте количества движения точки. */
import { b, sub, v, type AnswerRow, type Block, type Doc, type Inline, type Step } from '../../../shared/doc';
import { sig } from '../../relative/text/earth';
import type { ImpulseProblem, ImpulseResult } from '../model/impulse';

const L = (...c: Inline[]) => ({ c });

export function impulseDoc(p: ImpulseProblem, r: ImpulseResult, opts: { explain?: boolean } = {}): Doc {
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
  const rows: AnswerRow[] = [];
  const add = (title: string, lines: { c: Inline[] }[], note?: string) => {
    const bl: Block[] = [{ k: 'eq', lines }];
    if (note) ex(bl, note);
    steps.push({ title, blocks: bl });
  };
  const mline = L(
    v('g'),
    ` = ${sig(p.g)} м/с²`,
    p.byWeight && !(p.ask === 'line' && p.find === 'm')
      ? `;  m = P/g = ${sig(p.m)}/${sig(p.g)} = ${sig(r.mass)}`
      : p.ask === 'line' && p.find === 'm'
        ? ''
        : `;  m = ${sig(p.m)} кг`,
  );

  if (r.line) {
    const q = r.line;
    const head = [
      mline,
      L('теорема об импульсе: m', v('v'), sub('1'), ' − m', v('v'), sub('0'), ' = Σ', v('F'), '·', v('t'), ' (силы постоянны)'),
      L('сопротивление R = mg(f cos α + sin α) — трение и составляющая тяжести вдоль пути (α > 0 — подъём)'),
    ];
    const lines = [...head];
    const fin = (v1: number) => sig(v1);
    if (p.find === 't') lines.push(L(v('t'), ' = m(v₁ − v₀)/(F − R) = ', b(sig(q.t)), ' с'));
    if (p.find === 'v1') lines.push(L(v('v'), sub('1'), ' = v₀ + (F − R)t/m = ', b(fin(q.v1)), ' м/с'));
    if (p.find === 'F')
      lines.push(L(v('F'), ' = m(v₁ − v₀)/t + R = ', b(sig(q.F)), ` ${fu}`, q.p != null ? `;  среднее давление F/A = ${sig(q.p)} ${fu}/ед. площади` : ''));
    if (p.find === 'f') lines.push(L(v('f'), ' = (F − m(v₁ − v₀)/t − mg sin α)/(mg cos α) = ', b(sig(q.f))));
    if (p.find === 'm')
      lines.push(
        L(
          'Ft − mg(f cos α + sin α)t = m(v₁ − v₀) ⇒ m = Ft/(v₁ − v₀ + gt(f cos α + sin α)) = ',
          b(sig(q.mass)),
          p.byWeight ? `, вес P = mg = ${sig(q.mass * p.g)} ${fu}` : ' кг',
        ),
      );
    if (p.find === 'tpath')
      lines.push(L(`ускорение a = (F − R)/m = ${sig(q.acc)} м/с²; путь s = v₀t + at²/2 ⇒ `, v('t'), ' = ', b(sig(q.t)), ` с, v₁ = ${sig(q.v1)} м/с`));
    lines.push(L(`R = ${sig(q.Rs)} ${fu};  импульс равнодействующей S = (F − R)t = ${sig(q.S)} ${fu}·с;  путь s = (v₀ + v₁)t/2 = `, b(sig(q.s)), ' м'));
    add(
      'Теорема об изменении количества движения',
      lines,
      'Для постоянных сил импульс равен силе, умноженной на время; путь — по средней скорости (движение равнопеременное). Если задан вес, единица силы — кГ, а m = P/g.',
    );
    const main: Record<string, AnswerRow> = {
      t: { kind: 'main', val: [v('t'), ` = ${sig(q.t)} с`], note: 'время' },
      tpath: { kind: 'main', val: [v('t'), ` = ${sig(q.t)} с`], note: `путь ${sig(p.s)} м` },
      v1: { kind: 'main', val: [v('v'), sub('1'), ` = ${sig(q.v1)} м/с`], note: 'конечная скорость' },
      F: { kind: 'main', val: [v('F'), ` = ${sig(q.F)} ${fu}`], note: q.p != null ? `давление ${sig(q.p)}` : 'сила тяги' },
      f: { kind: 'main', val: [v('f'), ` = ${sig(q.f)}`], note: 'коэффициент трения' },
      m: { kind: 'main', val: p.byWeight ? [v('P'), ` = ${sig(q.mass * p.g)} ${fu}`] : [v('m'), ` = ${sig(q.mass)} кг`], note: 'вес (масса)' },
    };
    rows.push(main[p.find], { kind: 'aux', val: [v('s'), ` = ${sig(q.s)} м`], note: 'путь' });
  }

  if (r.vec) {
    const q = r.vec;
    add(
      'Импульс равнодействующей',
      [
        mline,
        L(`v₀ = ${sig(p.v0)} м/с под ${sig(p.a0)}°, v₁ = ${sig(p.v1)} м/с под ${sig(p.a1)}° к оси x`),
        L(
          v('S'),
          sub('x'),
          ' = m(v₁ cos α₁ − v₀ cos α₀) = ',
          b(sig(q.S[0])),
          ',  ',
          v('S'),
          sub('y'),
          ' = m(v₁ sin α₁ − v₀ sin α₀) = ',
          b(sig(q.S[1])),
          ` ${fu}·с`,
        ),
        L(`|S| = ${sig(q.Sabs)} ${fu}·с, направление ${sig(q.ang)}° к оси x`, q.Fm ? `;  средняя сила S/Δt = (${sig(q.Fm[0])}; ${sig(q.Fm[1])}) ${fu}` : ''),
      ],
      'Импульс равнодействующей всех сил равен изменению количества движения — для этого не нужно знать сами силы (тяжесть, сопротивление воздуха).',
    );
    rows.push({ kind: 'main', val: [v('S'), sub('x'), ` = ${sig(q.S[0])},  `, v('S'), sub('y'), ` = ${sig(q.S[1])} ${fu}·с`], note: 'проекции импульса' });
  }

  if (r.circle) {
    const q = r.circle;
    add(
      'Импульс при равномерном движении по окружности',
      [
        mline,
        L(`за поворот на ψ = ${sig(p.psi)}° скорость меняет направление: |Δv| = 2v sin(ψ/2)`),
        L(v('S'), ' = 2mv sin(ψ/2) = ', b(sig(q.S)), ` ${fu}·с;  Δt = Tψ/360° = ${sig(q.dt)} с`),
        L('средняя сила ', v('F'), ' = S/Δt = ', b(sig(q.F)), ` ${fu} — по направлению v₁ − v₀`),
      ],
      'За полоборота скорость меняется на противоположную: S = 2mv, средняя сила направлена по конечной скорости.',
    );
    rows.push(
      { kind: 'main', val: [v('S'), ` = ${sig(q.S)} ${fu}·с`], note: 'импульс' },
      { kind: 'main', val: [v('F'), ` = ${sig(q.F)} ${fu}`], note: 'средняя сила' },
    );
  }

  if (r.area) {
    const q = r.area;
    add(
      'Теорема моментов: закон площадей',
      [
        L('сила натяжения нити проходит через ось трубки — момент её относительно оси равен нулю: mr²ω = const'),
        L(`r₁²n₁ = r₂²n₂ ⇒ n₂ = n₁(r₁/r₂)² = ${sig(p.n1)}·(${sig(p.r1)}/${sig(p.r2)})² = `, b(sig(q.n2)), ' об/мин'),
        L(`скорость: ${sig(q.v1)} → ${sig(q.v2)} м/с`),
      ],
      'Нить втягивают медленно, сила тяжести параллельна оси — момент количества движения относительно оси сохраняется.',
    );
    rows.push({ kind: 'main', val: [`n₂ = ${sig(q.n2)} об/мин`], note: 'новая частота вращения' });
  }

  if (r.hole) {
    const q = r.hole;
    add(
      'Шарик на нити, втягиваемой в отверстие',
      [
        mline,
        L('натяжение направлено к отверстию — момент количества движения сохраняется: r²φ̇ = Ru₀;  r = R − at'),
        L(`φ = Ru₀∫dt/(R − at)² = u₀t/(R − at) = `, b(sig(q.phi)), ` рад при t = ${sig(p.t)} с, r = ${sig(q.r)} м`),
        L('по радиусу: m(r̈ − rφ̇²) = −T, r̈ = 0 ⇒ ', v('T'), ' = mu₀²R²/(R − at)³ = ', b(sig(q.T)), ` ${fu}`),
        L(`поперечная скорость u₀R/r = ${sig(q.vphi)} м/с; шарик дойдёт до отверстия при t = R/a = ${sig(q.tEnd)} с`),
      ],
      'Книга: r = R − at, φ = v₀t/(R − at), T = pv₀²R²/(g(R − at)³).',
    );
    rows.push(
      { kind: 'main', val: [v('T'), ` = ${sig(q.T)} ${fu}`], note: 'натяжение нити' },
      { kind: 'aux', val: ['φ = ', `${sig(q.phi)} рад`], note: `r = ${sig(q.r)} м` },
    );
  }

  if (r.sync) {
    const q = r.sync;
    const lines = [L(`T₁ = 2π√(l₁/g) = ${sig(q.T1)} с, T₂ = 2π√(l₂/g) = ${sig(q.T2)} с; √(l₁/l₂) = ${sig(q.ratio)}`)];
    if (q.k)
      lines.push(
        L(`маятники одновременно в исходном состоянии, если nT₁ = kT₂, т. е. √(l₁/l₂) = k/n = ${q.k}/${q.n} — несократимая дробь`),
        L(v('T'), ` = nT₁ = kT₂ = `, b(sig(q.T)), ' с'),
      );
    else lines.push(L('√(l₁/l₂) не равно отношению целых чисел (знаменатель до 1000): маятники никогда не повторят начальное состояние одновременно'));
    lines.push(L('через положение равновесия маятники проходят в моменты (2j + 1)Tᵢ/4 — одновременно, только если T₁/T₂ — отношение нечётных чисел'));
    add(
      'Два маятника',
      lines,
      'Колебания малые (период не зависит от амплитуды). Книга: √(l₁/l₂) = k/n, T = kT₂ = nT₁ — это время одновременного возврата в начальные (крайние) положения, хотя в условии сказано «в положение равновесия».',
    );
    rows.push({ kind: 'main', val: q.k ? [v('T'), ` = ${sig(q.T)} с`] : ['никогда'], note: q.k ? `k/n = ${q.k}/${q.n}` : 'отношение иррационально' });
  }

  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows }] });
  return { steps };
}
