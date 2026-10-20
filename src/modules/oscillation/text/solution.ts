/** Решение задачи о колебаниях груза на упругом элементе: жёсткость, уравнение, его решение, удар, ответ. */
import { b, sub, v, type AnswerRow, type Block, type Doc, type Inline, type Step } from '../../../shared/doc';
import { fmt } from '../../../shared/format';
import { BEAM_SCHEMES, beamUnit, elemStiff, MASS_COEF_TEXT, type Elem } from '../model/elastic';
import { resonanceOf } from '../model/resonance';
import { damperLever, FORCE_LABEL, HARMONIC, LEN_LABEL, singleElem, type OscProblem, type OscResult } from '../model/osc';

/** Число с четырьмя значащими цифрами (не меньше трёх знаков после запятой у малых чисел). */
export function f(x: number): string {
  if (!isFinite(x)) return '—';
  if (x === 0) return '0';
  const e = Math.floor(Math.log10(Math.abs(x)));
  return fmt(x, Math.min(12, Math.max(2, 3 - e)));
}
const sg = (x: number, first = false) => (x < 0 ? (first ? '−' : ' − ') : first ? '' : ' + ') + f(Math.abs(x));
const deg = (r: number) => (r * 180) / Math.PI;

export interface Units {
  L: string;
  F: string;
  m: string;
  c: string;
  b: string;
  s: string;
}
/** Метров в единице длины. */
const lenM = (l: OscProblem['len']) => ({ m: 1, cm: 0.01, mm: 0.001 })[l];

export function unitsOf(pr: OscProblem): Units {
  const L = LEN_LABEL[pr.len],
    F = FORCE_LABEL[pr.force];
  const s = pr.force === 'N' && pr.len === 'mm' ? 'МПа' : `${F}/${L}²`;
  return { L, F, m: `${F}·с²/${L}`, c: `${F}/${L}`, b: `${F}·с/${L}`, s };
}

const elemName = (e: Elem) => (e.kind === 'spring' ? 'пружина' : e.kind === 'rod' ? 'стержень' : 'балка');

/** Формула закона движения с числами; нулевые слагаемые не пишутся. На участках с разной силой — по участкам. */
export function lawText(r: OscResult): string {
  const scale = Math.max(1e-300, Math.abs(r.max.x), Math.abs(r.min.x), Math.abs(r.x0));
  const nz = (c: number) => Math.abs(c) > 1e-9 * scale;
  const terms = (list: [number, string][]): string =>
    list
      .filter(([c]) => nz(c))
      .map(([c, body], i) => `${sg(c, i === 0)}${body}`)
      .join('');
  const ph = (x: number) => (Math.abs(x) > 1e-12 ? `${x < 0 ? ' − ' : ' + '}${f(Math.abs(deg(x)))}°` : '');
  const piece = (i: number): string => {
    const pc = r.pieces[i];
    // Время в формуле участка — местное τ = t − t₀ для однородной части; частное решение записано в общем t.
    const t = pc.t0 > 0 ? 'τ' : 't';
    let hom = '';
    switch (r.regime) {
      case 'free':
        hom = terms([
          [pc.C1, ` cos ${f(r.k)}${t}`],
          [pc.C2, ` sin ${f(r.k)}${t}`],
        ]);
        break;
      case 'under': {
        const inner = terms([
          [pc.C1, ` cos ${f(r.k1!)}${t}`],
          [pc.C2, ` sin ${f(r.k1!)}${t}`],
        ]);
        hom = inner ? `e^{−${f(r.n)}${t}}(${inner})` : '';
        break;
      }
      case 'critical': {
        const inner = terms([
          [pc.C1, ''],
          [pc.C2, t],
        ]);
        hom = inner ? `e^{−${f(r.n)}${t}}(${inner})` : '';
        break;
      }
      case 'over':
        hom = terms([
          [pc.C1, `·e^{${f(r.roots![0])}${t}}`],
          [pc.C2, `·e^{${f(r.roots![1])}${t}}`],
        ]);
        break;
    }
    let s = hom;
    const k2 = r.k * r.k;
    for (const term of pc.terms) {
      let part: [number, string][] = [];
      if (term.k === 'harm') {
        if (r.n === 0 && Math.abs(term.p - r.k) <= 1e-9 * r.k) part = [[-term.h / (2 * r.k), ` t·cos(${f(r.k)}t${ph(term.dl)})`]];
        else if (r.n === 0) part = [[term.h / (k2 - term.p * term.p), ` sin(${f(term.p)}t${ph(term.dl)})`]];
        else {
          const D = Math.hypot(k2 - term.p * term.p, 2 * r.n * term.p);
          part = [[term.h / D, ` sin(${f(term.p)}t${ph(term.dl - Math.atan2(2 * r.n * term.p, k2 - term.p * term.p))})`]];
        }
      } else if (term.k === 'poly') {
        const B = term.s / k2,
          A = (term.h0 - 2 * r.n * B) / k2;
        const tv = term.t0 > 0 ? `(t − ${f(term.t0)})` : 't';
        part = [
          [A, ''],
          [B, tv],
        ];
        if (nz(A) && !nz(B)) part = [[A, '']];
      } else {
        const be = term.beta,
          den = be * be - 2 * r.n * be + k2;
        if (Math.abs(den) > 1e-9 * Math.max(k2, be * be)) part = [[term.h0 / den, `·e^{−${f(be)}t}`]];
        else if (Math.abs(2 * r.n - 2 * be) > 1e-9 * (r.n + be)) part = [[term.h0 / (2 * r.n - 2 * be), ` t·e^{−${f(be)}t}`]];
        else part = [[term.h0 / 2, ` t²·e^{−${f(be)}t}`]];
      }
      const txt = terms(part);
      if (txt) s += `${s ? (txt.startsWith('−') ? ' − ' + txt.slice(1) : ' + ' + txt) : txt}`;
    }
    return s.trim() || '0';
  };
  if (r.pieces.length <= 1) return 'x = ' + piece(0);
  return r.pieces
    .map((pc, i) => {
      const cond = Number.isFinite(pc.t1) ? `${f(pc.t0)} ≤ t ≤ ${f(pc.t1)}` : `t ≥ ${f(pc.t0)}`;
      return `${cond}: x = ${piece(i)}${pc.t0 > 0 ? ` (τ = t − ${f(pc.t0)})` : ''}`;
    })
    .join(';  ');
}

/** «раз» или «раза» после числа. */
const razA = (q: number) => {
  if (!Number.isInteger(q)) return 'раза';
  const n = Math.abs(q) % 100;
  return n % 10 >= 2 && n % 10 <= 4 && (n < 12 || n > 14) ? 'раза' : 'раз';
};

export function oscDoc(pr: OscProblem, r: OscResult, opts: { explain?: boolean } = {}): Doc {
  const steps: Step[] = [];
  const ex = (bl: Block[], ...c: Inline[]) => {
    if (opts.explain) bl.push({ k: 'p', cls: 'explain', c });
  };
  if (!r.ok) {
    steps.push({
      title: 'Данные',
      blocks: [
        { k: 'badge', tone: 'bad', text: 'проверьте данные' },
        { k: 'ul', items: r.errors.map((x) => [x]) },
      ],
    });
    return { steps };
  }
  const U = unitsOf(pr);
  const el = pr.el;
  const one = singleElem(pr);

  // 1. Масса и жёсткость.
  {
    const lines: { num?: boolean; c: Inline[] }[] = [];
    if (pr.byWeight) lines.push({ c: [v('m'), ' = ', v('P'), '/', v('g'), ` = ${f(pr.m)}/${f(r.g)} = `, b(`${f(r.mLoad)} ${U.m}`)] });
    else
      lines.push({
        c: [v('m'), ` = ${f(pr.m)} кг`, pr.force === 'N' && pr.len === 'm' ? '' : ` = ${f(r.mLoad)} ${U.m}`],
      });
    if (r.mRed > 0) {
      const coef = one ? MASS_COEF_TEXT[one.kind === 'beam' ? one.scheme : one.kind] : '1/3';
      lines.push({
        c: [
          'масса упругого элемента ',
          v('m'),
          sub('эл'),
          ` = ${f(r.mRed / r.beta!)} ${U.m}; приведённая к грузу β`,
          v('m'),
          sub('эл'),
          ` = ${coef}·${f(r.mRed / r.beta!)} = ${f(r.mRed)}`,
        ],
      });
      lines.push({ c: [v('m'), sub('пр'), ' = ', v('m'), ' + β', v('m'), sub('эл'), ` = `, b(`${f(r.m)} ${U.m}`)] });
    }
    const bl: Block[] = [{ k: 'eq', lines }];
    const cl: { num?: boolean; c: Inline[] }[] = [];
    if (el.mode === 'c') cl.push({ c: [v('c'), ' = ', b(`${f(r.c)} ${U.c}`), ' (задана)'] });
    else if (el.mode === 'static')
      cl.push({ c: [v('c'), ' = (', v('P'), ' sin α + ', v('Q'), ')/δ', sub('ст'), ` = ${f(r.Pax + pr.Q)}/${f(el.dst)} = `, b(`${f(r.c)} ${U.c}`)] });
    else if (el.mode === 'period') {
      if (el.T0damped)
        cl.push({
          c: [
            'период с сопротивлением ',
            v('T'),
            sub('1'),
            ` = ${f(el.T0)} с: `,
            v('k'),
            '² = (2π/',
            v('T'),
            sub('1'),
            ')² + ',
            v('n'),
            `² = ${f((2 * Math.PI) / el.T0)}² + ${f(r.n)}² = ${f(r.k * r.k)}`,
          ],
        });
      else cl.push({ c: [v('k'), ' = 2π/', v('T'), sub('0'), ` = 2π/${f(el.T0)} = ${f(r.k)} с⁻¹`] });
      cl.push({ c: [v('c'), ' = ', v('m'), v('k'), `² = ${f(r.m)}·${f(r.k * r.k)} = `, b(`${f(r.c)} ${U.c}`)] });
    } else {
      const st = el.stages;
      const many = st.length > 1;
      st.forEach((s, i) => {
        s.items.forEach((e, j) => {
          const es = elemStiff(e);
          const nm = `${many || s.items.length > 1 ? `${i + 1}.${j + 1} ` : ''}${elemName(e)}`;
          if (e.kind === 'spring') {
            const extra: string[] = [];
            if (e.ang) extra.push(`cos²${f(e.ang)}°`);
            if (e.lb > 0) extra.push(`(${f(e.la)}/${f(e.lb)})²`);
            cl.push({ c: [`${nm}: `, v('c'), ` = ${f(e.c)}`, extra.length ? `·${extra.join('·')} = ${f(es.c)}` : '', ` ${U.c}`] });
          } else if (e.kind === 'rod')
            cl.push({ c: [`${nm}: `, v('c'), ' = ', v('EA'), '/', v('l'), ` = ${f(e.E)}·${f(e.A)}/${f(e.l)} = ${f((e.E * e.A) / e.l)} ${U.c}`] });
          else {
            const sch = BEAM_SCHEMES.find((x) => x.id === e.scheme)!;
            cl.push({ c: [`${nm} (${sch.label}): ${sch.formula} = ${f(beamUnit(e).d)} ${U.L}/${U.F}; `, v('c'), ` = 1/δ₁₁ = ${f(1 / beamUnit(e).d)} ${U.c}`] });
          }
          if (e.kind !== 'spring' && e.cs > 0) {
            const raw = e.kind === 'rod' ? (e.E * e.A) / e.l : 1 / beamUnit(e).d;
            cl.push({
              c: [
                `${nm} стоит на пружине c`,
                sub('п'),
                ` = ${f(e.cs)} ${U.c} — последовательно: 1/`,
                v('c'),
                ` = 1/${f(raw)} + 1/${f(e.cs)} ⇒ `,
                v('c'),
                ` = ${f(es.c)} ${U.c}`,
              ],
            });
          }
        });
        if (s.items.length > 1)
          cl.push({
            c: [
              many ? `ступень ${i + 1} — параллельно: ` : 'параллельно: ',
              v('c'),
              ' = Σ',
              v('c'),
              sub('i'),
              ` = ${s.items.map((e) => f(elemStiff(e).c)).join(' + ')} = ${f(r.stiff!.stages[i])} ${U.c}`,
            ],
          });
      });
      if (many)
        cl.push({
          c: [
            'ступени последовательно: 1/',
            v('c'),
            ' = Σ1/',
            v('c'),
            sub('i'),
            ` = ${r.stiff!.stages.map((x) => `1/${f(x)}`).join(' + ')}, `,
            v('c'),
            ' = ',
            b(`${f(r.c)} ${U.c}`),
          ],
        });
      else cl.push({ c: [v('c'), ' = ', b(`${f(r.c)} ${U.c}`)] });
    }
    bl.push({ k: 'eq', lines: cl });
    if (el.mode === 'elems' && el.stages.length > 1)
      ex(
        bl,
        'Последовательно соединённые элементы передают одну и ту же силу, а их деформации складываются: складываются податливости 1/c. Параллельные элементы деформируются одинаково, их силы складываются: складываются жёсткости.',
      );
    if (el.mode === 'elems' && el.stages.some((s) => s.items.some((e) => e.kind === 'spring' && (e.ang || e.lb > 0))))
      ex(
        bl,
        'Пружина под углом α к оси движения при малом смещении x удлиняется на x cos α; проекция её силы на ось — c x cos²α. Пружина на рычаге с плечом a деформируется на x·a/b, её сила c x a/b даёт на плече груза b силу c x (a/b)².',
      );
    if (el.mode === 'elems' && el.stages.some((s) => s.items.some((e) => e.kind !== 'spring' && e.cs > 0)))
      ex(
        bl,
        'Пружина под опорой балки (стержня) и сама балка работают последовательно: одна и та же сила, перемещения груза складываются, поэтому складываются податливости 1/c.',
      );
    if (r.mRed > 0)
      ex(
        bl,
        'Масса упругого элемента учтена приближённо, способом Рэлея: кинетическая энергия элемента выражается через скорость груза, будто элемент движется по форме статического прогиба. Её доля β — 1/3 для пружины и стержня, 17/35 для балки на двух опорах, 33/140 для консоли (Антонов, п. 10.7).',
      );
    steps.push({ title: 'Масса и жёсткость упругого элемента', blocks: bl });
  }

  // 2. Равновесие.
  {
    const dir = pr.orient === 'h' ? 'горизонтально вправо' : pr.orient === 'v' ? 'вертикально вниз' : `вниз по наклонной плоскости (α = ${f(pr.alpha)}°)`;
    const lines: { num?: boolean; c: Inline[] }[] = [];
    const parts: string[] = [];
    if (r.Pax) parts.push(pr.orient === 'v' ? 'P' : 'P sin α');
    if (pr.Q) parts.push('Q');
    const num = parts.length > 1 ? `(${parts.join(' + ')})` : parts[0];
    lines.push({ c: ['δ', sub('ст'), ' = ', parts.length ? `${num}/c = ${f(r.Pax + pr.Q)}/${f(r.c)} = ` : '', b(`${f(r.dst)} ${U.L}`)] });
    const bl: Block[] = [
      { k: 'p', c: [`Ось x направлена ${dir}; начало — в положении статического равновесия груза, где упругий элемент деформирован на δ`, sub('ст'), '.'] },
      { k: 'eq', lines },
    ];
    ex(
      bl,
      'В положении равновесия сила упругости cδ',
      sub('ст'),
      ' уравновешивает постоянные силы вдоль оси (составляющую веса и силу Q). При смещении на x сила упругости равна c(δ',
      sub('ст'),
      ' + x), и постоянные силы из уравнения движения выпадают: остаётся −cx.',
    );
    steps.push({ title: 'Положение статического равновесия', blocks: bl });
  }

  // 3. Уравнение движения.
  const fo = r.forced;
  {
    const rhs: Inline[] = [' = −', v('c'), v('x')];
    if (r.n > 0) rhs.push(' − ', v('b'), 'ẋ');
    if (r.dry) rhs.push(' ∓ ', v('f'), v('N'));
    if (fo)
      rhs.push(
        ' + ',
        v('H'),
        r.forced2 ? sub('1') : '',
        ' sin(',
        v('p'),
        r.forced2 ? sub('1') : '',
        v('t'),
        pr.exc.delta ? ' + δ' + (r.forced2 ? '₁' : '') : '',
        ')',
      );
    if (r.forced2) rhs.push(' + ', v('H'), sub('2'), ' sin(', v('p'), sub('2'), v('t'), pr.exc.delta2 ? ' + δ₂' : '', ')');
    if (r.trans) rhs.push(' + ', v('F'), '(', v('t'), ')');
    const lines: { num?: boolean; c: Inline[] }[] = [{ c: [v('m'), 'ẍ', ...rhs] }];
    const can: Inline[] = ['ẍ'];
    if (r.n > 0) can.push(' + 2', v('n'), 'ẋ');
    can.push(
      ' + ',
      v('k'),
      '²',
      v('x'),
      ' = ',
      r.forced2
        ? 'h₁ sin(p₁t' + (pr.exc.delta ? ' + δ₁' : '') + ') + h₂ sin(p₂t' + (pr.exc.delta2 ? ' + δ₂' : '') + ')'
        : fo
          ? 'h sin(pt' + (pr.exc.delta ? ' + δ' : '') + ')'
          : r.trans
            ? 'h(t) = F(t)/m'
            : r.dry
              ? '∓ fN/m'
              : '0',
    );
    lines.push({ c: can });
    lines.push({
      c: [
        v('k'),
        ' = √(',
        v('c'),
        '/',
        v('m'),
        `) = √(${f(r.c)}/${f(r.m)}) = `,
        b(`${f(r.k)} с⁻¹`),
        ';  ',
        v('T'),
        sub('0'),
        ' = 2π/',
        v('k'),
        ' = ',
        b(`${f(r.T0)} с`),
        ';  ',
        v('f'),
        ` = 1/T₀ = ${f(r.freq)} Гц`,
      ],
    });
    if (r.n > 0 || pr.damp.mode === 'n' || pr.damp.mode === 'ratio' || pr.damp.mode === 'T1') {
      const d = pr.damp;
      if (d.mode === 'b' && damperLever(d) !== 1) {
        lines.push({
          c: [
            'демпфер на рычаге: ',
            v('b'),
            sub('пр'),
            ' = ',
            v('b'),
            '(',
            v('a'),
            '/',
            v('b'),
            ')² = ',
            `${f(d.b)}·(${f(d.la)}/${f(d.lb)})² = ${f(d.b * damperLever(d))} ${U.b}`,
          ],
        });
        lines.push({ c: [v('n'), ' = ', v('b'), sub('пр'), '/(2', v('m'), `) = ${f(d.b * damperLever(d))}/(2·${f(r.m)}) = `, b(`${f(r.n)} с⁻¹`)] });
      } else if (d.mode === 'b') lines.push({ c: [v('n'), ' = ', v('b'), '/(2', v('m'), `) = ${f(d.b)}/(2·${f(r.m)}) = `, b(`${f(r.n)} с⁻¹`)] });
      else if (d.mode === 'n') lines.push({ c: [v('n'), ' = ', b(`${f(r.n)} с⁻¹`), ' (задан); ', v('b'), ' = 2', v('n'), v('m'), ` = ${f(r.b)} ${U.b}`] });
      else if (d.mode === 'ratio') {
        const L = Math.log(d.q) / d.N;
        lines.push({
          c: [
            `амплитуда уменьшилась в q = ${f(d.q)} ${razA(+f(d.q).replace(',', '.'))} за N = ${f(d.N)} колебаний: `,
            v('n'),
            v('T'),
            sub('1'),
            ' = ln ',
            v('q'),
            '/',
            v('N'),
            ` = ${f(L)}`,
          ],
        });
        if (pr.el.mode === 'period' && pr.el.T0damped)
          lines.push({ c: [v('n'), ' = ', f(L), '/', v('T'), sub('1'), ` = ${f(L)}/${f(pr.el.T0)} = `, b(`${f(r.n)} с⁻¹`)] });
        else
          lines.push({
            c: [
              v('T'),
              sub('1'),
              ' = 2π/√(',
              v('k'),
              '² − ',
              v('n'),
              '²)  ⇒  ',
              v('n'),
              ' = ',
              v('k'),
              '·',
              f(L),
              '/√(4π² + ',
              f(L),
              `²) = `,
              b(`${f(r.n)} с⁻¹`),
            ],
          });
        lines.push({ c: [v('b'), ' = 2', v('n'), v('m'), ` = ${f(r.b)} ${U.b}`] });
      } else if (d.mode === 'T1')
        lines.push({
          c: [
            v('n'),
            ' = √(',
            v('k'),
            '² − (2π/',
            v('T'),
            sub('1'),
            ')²) = ',
            `√(${f(r.k * r.k)} − ${f(((2 * Math.PI) / d.T1) ** 2)}) = `,
            b(`${f(r.n)} с⁻¹`),
            ';  ',
            v('b'),
            ' = 2',
            v('n'),
            v('m'),
            ` = ${f(r.b)} ${U.b}`,
          ],
        });
    }
    if (r.trans) {
      const e = pr.exc;
      const Fn = (txt: string) => lines.push({ c: [txt] });
      if (e.mode === 'ramp') Fn(`сила растёт пропорционально времени: F = a·t, a = ${f(e.H)} ${U.F}/с`);
      else if (e.mode === 'exp') Fn(`сила F = F₀e^{−βt}, F₀ = ${f(e.H)} ${U.F}, β = ${f(e.beta)} с⁻¹ (убывает в e раз за 1/β = ${f(1 / (e.beta || NaN))} с)`);
      else if (e.mode === 'pulse')
        Fn(`постоянная сила F = ${f(e.H)} ${U.F} действует от t = 0 до t = τ = ${f(e.tau)} с (τ/T₀ = ${f(e.tau / r.T0)}), затем её нет`);
      else if (e.mode === 'ramphold') Fn(`сила нарастает линейно до F₀ = ${f(e.H)} ${U.F} за время τ = ${f(e.tau)} с (F = F₀t/τ), затем остаётся постоянной`);
      else if (e.mode === 'cam') {
        lines.push({
          c: [
            `кулачок: ξ = a(1 − cos ωt) при 0 ≤ t ≤ 2π/ω = ${f((2 * Math.PI) / e.p)} с, затем ξ = 0; пружина кулачка `,
            v('c'),
            sub('1'),
            ` = ${f(e.c1)} ${U.c}: сила `,
            v('c'),
            sub('1'),
            '(ξ − x), x — от положения равновесия;  ',
            v('c'),
            sub('1'),
            v('a'),
            '/',
            v('m'),
            ` = ${f((e.c1 * e.a) / r.m)} ${U.L}/с²`,
          ],
        });
      }
      if (e.mode !== 'cam') lines.push({ c: [v('h'), ' = ', v('F'), '/', v('m'), ` = ${f(e.H)}/${f(r.m)} = ${f(e.H / r.m)} ${U.L}/с²`] });
    }
    if (fo) {
      const e = pr.exc;
      if (e.mode === 'support') {
        const mc = e.mc > 0 ? (pr.byWeight ? e.mc / r.g : e.mc) : r.m;
        lines.push({
          c: [
            'основание движется: ξ = ',
            v('a'),
            ' sin(',
            v('p'),
            v('t'),
            '); пружина и демпфер связаны с основанием, поэтому x — движение груза относительно основания, z̈ = ẍ − ξ̈, и в уравнение входит сила инерции переносного движения ',
            v('H'),
            ' = ',
            v('m'),
            sub(e.mc > 0 ? 'с' : ''),
            v('a'),
            v('p'),
            `² = ${f(mc)}·${f(e.a)}·${f(e.p)}² = ${f(fo.H)} ${U.F}`,
          ],
        });
      }
      if (e.mode === 'rotor')
        lines.push({
          c: [v('H'), ' = ', v('m'), sub('0'), v('e'), v('p'), `² = ${f(pr.byWeight ? e.m0 / r.g : e.m0)}·${f(e.e)}·${f(e.p)}² = ${f(fo.H)} ${U.F}`],
        });
      if (e.mode === 'base')
        lines.push({
          c: [
            'точка крепления движется по закону ξ = ',
            v('a'),
            ' sin(',
            v('p'),
            v('t'),
            '): сила упругости −',
            v('c'),
            '(',
            v('x'),
            ' − ξ), ',
            v('H'),
            ' = ',
            v('c'),
            v('a'),
            ` = ${f(r.c)}·${f(e.a)} = ${f(fo.H)} ${U.F}`,
          ],
        });
      lines.push({ c: [v('h'), ' = ', v('H'), '/', v('m'), ` = ${f(fo.H)}/${f(r.m)} = ${f(fo.h)} ${U.L}/с²;  `, v('p'), ` = ${f(fo.p)} с⁻¹`] });
      if (r.forced2)
        lines.push({
          c: [
            v('h'),
            sub('2'),
            ' = ',
            v('H'),
            sub('2'),
            '/',
            v('m'),
            ` = ${f(r.forced2.H)}/${f(r.m)} = ${f(r.forced2.h)} ${U.L}/с²;  `,
            v('p'),
            sub('2'),
            ` = ${f(r.forced2.p)} с⁻¹`,
          ],
        });
    }
    const bl: Block[] = [{ k: 'eq', lines }];
    ex(
      bl,
      'Второй закон Ньютона в проекции на ось x: сила упругости −cx возвращает груз к положению равновесия',
      r.n > 0 ? ', сила вязкого сопротивления −bẋ направлена против скорости' : '',
      fo || r.trans ? ', возмущающая сила раскачивает систему' : '',
      '. После деления на m: k — круговая частота свободных колебаний',
      r.n > 0 ? ', n — коэффициент затухания' : '',
      '.',
    );
    steps.push({ title: 'Дифференциальное уравнение движения', blocks: bl });
  }

  // 4. Начальные условия.
  {
    const ini = pr.init;
    const lines: { num?: boolean; c: Inline[] }[] = [];
    if (ini.mode === 'eq') lines.push({ c: [v('x'), sub('0'), ` = ${f(r.x0)} ${U.L} (от положения равновесия)`] });
    else if (ini.mode === 'lambda')
      lines.push({
        c: [
          'элемент деформирован на λ',
          sub('0'),
          ` = ${f(ini.lambda0)}: `,
          v('x'),
          sub('0'),
          ' = λ',
          sub('0'),
          ' − δ',
          sub('ст'),
          ` = ${f(ini.lambda0)} − ${f(r.dst)} = `,
          b(`${f(r.x0)} ${U.L}`),
        ],
      });
    else if (ini.mode === 'load')
      lines.push({
        c: [
          `до начала движения элемент держал нагрузку ${f(ini.Fprev)} ${U.F}: λ₀ = ${f(ini.Fprev)}/${f(r.c)} = ${f(ini.Fprev / r.c)}; `,
          v('x'),
          sub('0'),
          ' = λ₀ − δ',
          sub('ст'),
          ' = ',
          b(`${f(r.x0)} ${U.L}`),
        ],
      });
    else {
      lines.push({ c: ['груз касается недеформированного элемента: ', v('x'), sub('0'), ' = −δ', sub('ст'), ' = ', b(`${f(r.x0)} ${U.L}`)] });
      lines.push({ c: ['скорость в момент касания ', v('v'), ' = √(', ini.v0 ? 'v₀² + ' : '', '2', v('g'), v('h'), `) = ${f(r.vHit!)} ${U.L}/с`] });
      if (r.mRed > 0)
        lines.push({
          c: [
            'удар неупругий, после него груз и элемент движутся вместе: ',
            v('v'),
            sub('0'),
            ' = ',
            v('v'),
            '·',
            v('m'),
            '/(',
            v('m'),
            ' + β',
            v('m'),
            sub('эл'),
            `) = `,
            b(`${f(r.v0)} ${U.L}/с`),
          ],
        });
    }
    if (ini.mode !== 'drop') lines.push({ c: [v('v'), sub('0'), ` = ${f(r.v0)} ${U.L}/с`] });
    const bl: Block[] = [{ k: 'eq', lines }];
    if (ini.mode === 'drop')
      ex(
        bl,
        'Пока груз падает, на него действует только сила тяжести: скорость при касании находим из закона сохранения энергии. Дальше груз движется вместе с элементом — это колебания около нового положения равновесия.',
      );
    steps.push({ title: 'Начальные условия', blocks: bl });
  }

  // 5. Решение.
  if (r.dry) {
    const d = r.dry;
    const lines: { num?: boolean; c: Inline[] }[] = [
      { c: [v('N'), ` = P cos α = ${f(d.N)} ${U.F};  сила трения `, v('f'), v('N'), ` = ${f(pr.damp.f * d.N)} ${U.F}`] },
      {
        c: [
          'смещение центра колебаний ',
          v('D'),
          ' = ',
          v('f'),
          v('N'),
          '/',
          v('c'),
          ' = ',
          b(`${f(d.D)} ${U.L}`),
          ';  область застоя |x| ≤ ',
          v('D'),
          sub('0'),
          ' = ',
          v('f'),
          sub('0'),
          v('N'),
          '/',
          v('c'),
          ` = ${f(d.D0)} ${U.L}`,
        ],
      },
    ];
    const items: Inline[][] = d.swings.map((s, i) => [
      `${i + 1}) от x = ${f(s.x1)} до x = ${f(s.x2)} ${U.L} (центр ${f(s.center)}), размах `,
      b(`${f(Math.abs(s.x2 - s.x1))} ${U.L}`),
      `, длится ${f(s.dur)} с`,
    ]);
    const bl: Block[] = [
      { k: 'eq', lines },
      { k: 'ul', items },
      { k: 'p', c: [`Груз остановился при t = ${f(d.stop.t)} с в положении x = `, b(`${f(d.stop.x)} ${U.L}`), ` — число полуразмахов ${d.swings.length}.`] },
    ];
    ex(
      bl,
      'Пока груз движется в одну сторону, сила трения постоянна и направлена против движения — она лишь сдвигает центр колебаний на D в сторону, противоположную движению. Каждый полуразмах — половина гармонического колебания с периодом T₀ около своего центра, поэтому размахи убывают на 2D. Груз останавливается в крайнем положении, если сила упругости не может преодолеть трение покоя: |x| ≤ D₀.',
    );
    steps.push({ title: 'Колебания с сухим трением', blocks: bl });
  } else {
    const lines: { num?: boolean; c: Inline[] }[] = [];
    if (r.regime === 'free')
      lines.push({ c: ['общее решение однородного уравнения: ', v('C'), sub('1'), ' cos ', v('k'), v('t'), ' + ', v('C'), sub('2'), ' sin ', v('k'), v('t')] });
    else if (r.regime === 'under')
      lines.push(
        {
          c: [
            v('n'),
            ' < ',
            v('k'),
            ' — затухающие колебания: ',
            v('k'),
            sub('1'),
            ' = √(',
            v('k'),
            '² − ',
            v('n'),
            `²) = `,
            b(`${f(r.k1!)} с⁻¹`),
            ';  ',
            v('T'),
            sub('1'),
            ' = 2π/',
            v('k'),
            sub('1'),
            ' = ',
            b(`${f(r.T1!)} с`),
          ],
        },
        {
          c: [
            'e',
            { t: 'sup', text: '−nt' },
            '(',
            v('C'),
            sub('1'),
            ' cos ',
            v('k'),
            sub('1'),
            v('t'),
            ' + ',
            v('C'),
            sub('2'),
            ' sin ',
            v('k'),
            sub('1'),
            v('t'),
            ')',
          ],
        },
      );
    else if (r.regime === 'critical')
      lines.push({
        c: [
          v('n'),
          ' = ',
          v('k'),
          ' — критическое затухание, движение апериодическое: e',
          { t: 'sup', text: '−nt' },
          '(',
          v('C'),
          sub('1'),
          ' + ',
          v('C'),
          sub('2'),
          v('t'),
          ')',
        ],
      });
    else
      lines.push(
        {
          c: [
            v('n'),
            ' > ',
            v('k'),
            ' — апериодическое движение: корни ',
            v('r'),
            sub('1,2'),
            ' = −',
            v('n'),
            ' ± √(',
            v('n'),
            '² − ',
            v('k'),
            `²) = ${f(r.roots![0])}; ${f(r.roots![1])} с⁻¹`,
          ],
        },
        { c: [v('C'), sub('1'), 'e', { t: 'sup', text: 'r₁t' }, ' + ', v('C'), sub('2'), 'e', { t: 'sup', text: 'r₂t' }] },
      );
    if (fo) {
      if (fo.resonance)
        lines.push({
          c: [
            v('p'),
            ' = ',
            v('k'),
            ' — резонанс; частное решение ',
            v('x'),
            sub('p'),
            ' = −(',
            v('h'),
            '/2',
            v('k'),
            ')',
            v('t'),
            ' cos(',
            v('k'),
            v('t'),
            pr.exc.delta ? ' + δ' : '',
            `), h/2k = ${f(fo.h / (2 * r.k))} ${U.L}/с`,
          ],
        });
      else if (r.n === 0)
        lines.push({
          c: [
            'частное решение ',
            v('x'),
            sub('p'),
            ' = ',
            v('B'),
            ' sin(',
            v('p'),
            v('t'),
            pr.exc.delta ? ' + δ' : '',
            '), ',
            v('B'),
            ' = ',
            v('h'),
            '/(',
            v('k'),
            '² − ',
            v('p'),
            `²) = ${f(fo.h)}/(${f(r.k * r.k)} − ${f(fo.p * fo.p)}) = `,
            b(`${f(fo.h / (r.k * r.k - fo.p * fo.p))} ${U.L}`),
            fo.p > r.k ? ' (p > k: колебания в противофазе с силой)' : '',
          ],
        });
      else
        lines.push(
          {
            c: [
              'частное решение ',
              v('x'),
              sub('p'),
              ' = ',
              v('B'),
              ' sin(',
              v('p'),
              v('t'),
              pr.exc.delta ? ' + δ' : '',
              ' − ε), ',
              v('B'),
              ' = ',
              v('h'),
              '/√((',
              v('k'),
              '² − ',
              v('p'),
              '²)² + 4',
              v('n'),
              '²',
              v('p'),
              '²) = ',
              b(`${f(fo.B!)} ${U.L}`),
            ],
          },
          { c: ['tg ε = 2', v('n'), v('p'), '/(', v('k'), '² − ', v('p'), `²) = ${f(Math.tan(fo.eps))}, ε = `, b(`${f(deg(fo.eps))}°`)] },
        );
    }
    if (r.forced2) {
      const f2 = r.forced2;
      lines.push({
        c: [
          'вторая гармоника: ',
          v('x'),
          sub('p2'),
          ' = ',
          v('B'),
          sub('2'),
          ' sin(',
          v('p'),
          sub('2'),
          v('t'),
          pr.exc.delta2 ? ' + δ₂' : '',
          r.n > 0 ? ' − ε₂' : '',
          '), ',
          v('B'),
          sub('2'),
          ' = ',
          f2.resonance ? 'резонанс' : b(`${f(f2.B!)} ${U.L}`),
          r.n > 0 && !f2.resonance ? `, ε₂ = ${f(deg(f2.eps))}°` : '',
        ],
      });
      lines.push({ c: ['решение линейно: частные решения от обеих гармоник складываются (принцип суперпозиции)'] });
    }
    if (r.trans) {
      const k2 = r.k * r.k;
      r.pieces.forEach((pc, i) => {
        const cond = Number.isFinite(pc.t1) ? `${f(pc.t0)} ≤ t ≤ ${f(pc.t1)} с` : `t ≥ ${f(pc.t0)} с`;
        if (!pc.terms.length) {
          lines.push({ c: [`участок ${i + 1} (${cond}): сила не действует — свободные колебания от состояния в момент t₀`] });
          return;
        }
        for (const term of pc.terms) {
          if (term.k === 'poly')
            lines.push({
              c: [
                `участок ${i + 1} (${cond}): `,
                v('x'),
                sub('p'),
                ' = A + B(t − t₀), B = ',
                v('s'),
                '/',
                v('k'),
                `² = ${f(term.s / k2)} ${U.L}/с, A = (h₀ − 2nB)/k² = ${f((term.h0 - (2 * r.n * term.s) / k2) / k2)} ${U.L}`,
              ],
            });
          else if (term.k === 'exp')
            lines.push({
              c: [
                `участок ${i + 1}: `,
                v('x'),
                sub('p'),
                ' = h₀e',
                { t: 'sup', text: '−βt' },
                '/(β² − 2nβ + k²) = ',
                `${f(term.h0)}/${f(term.beta ** 2 - 2 * r.n * term.beta + k2)}·e^{−${f(term.beta)}t}`,
                Math.abs(term.beta ** 2 - 2 * r.n * term.beta + k2) < 1e-9 * Math.max(k2, term.beta ** 2)
                  ? ' (β совпадает с корнем характеристического уравнения — решение с множителем t)'
                  : '',
              ],
            });
          else
            lines.push({
              c: [
                `участок ${i + 1} (${cond}): гармоническая составляющая h sin(pt + δ), h = ${f(term.h)} ${U.L}/с², p = ${f(term.p)} с⁻¹ — частное решение по формуле выше`,
              ],
            });
        }
      });
      r.pieces.slice(1).forEach((pc, i) =>
        lines.push({
          c: [
            `в момент t = ${f(pc.t0)} с состояние сшивается: `,
            v('x'),
            ` = ${f(pc.xs)} ${U.L}, `,
            v('v'),
            ` = ${f(pc.vs)} ${U.L}/с → постоянные участка ${i + 2}: `,
            v('C'),
            sub('1'),
            ` = ${f(pc.C1)}, `,
            v('C'),
            sub('2'),
            ` = ${f(pc.C2)} (в τ = t − ${f(pc.t0)})`,
          ],
        }),
      );
    }
    lines.push({ c: ['постоянные из начальных условий: ', v('C'), sub('1'), ` = ${f(r.C1)}, `, v('C'), sub('2'), ` = ${f(r.C2)}`] });
    lines.push({ c: [b(lawText(r)), ` ${U.L}`] });
    const bl: Block[] = [{ k: 'eq', lines }];
    if (r.A != null)
      bl.push({
        k: 'p',
        c: [
          'Амплитуда ',
          v('a'),
          ' = √(',
          v('x'),
          sub('0'),
          '² + ',
          v('v'),
          sub('0'),
          '²/',
          v('k'),
          '²) = ',
          b(`${f(r.A)} ${U.L}`),
          `; в форме x = a sin(kt + φ₀): φ₀ = ${f(deg(r.phase!))}°. Наибольшая скорость a·k = ${f(r.A * r.k)} ${U.L}/с, ускорение a·k² = ${f(r.A * r.k * r.k)} ${U.L}/с².`,
        ],
      });
    if (r.regime === 'under') {
      const L = r.n * r.T1!;
      bl.push({
        k: 'p',
        c: [
          `Затухание: за период амплитуда уменьшается в e^{nT₁} = ${f(Math.exp(L))} раза; логарифмический декремент nT₁ = ${f(L)}, за размах (полупериод, как у Мещерского и Тарга) nT₁/2 = `,
          b(f(L / 2)),
          '.',
        ],
      });
    }
    ex(
      bl,
      'Решение линейного уравнения — сумма общего решения однородного уравнения (свободные колебания)',
      fo ? ' и частного решения (вынужденные колебания с частотой возмущения)' : '',
      '. Постоянные C₁, C₂ находим, подставив t = 0 в x(t) и ẋ(t).',
    );
    if (r.check != null)
      bl.push({
        k: 'badge',
        tone: r.check < 1e-6 ? 'ok' : 'warn',
        text:
          r.check < 1e-6
            ? 'проверка: численное интегрирование уравнения совпадает с формулой (расхождение меньше 10⁻⁶ размаха)'
            : `проверка: численное интегрирование отличается от формулы на ${f(r.check * 100)} % размаха`,
      });
    steps.push({ title: 'Решение уравнения', blocks: bl });
  }

  // 6. Вынужденные колебания.
  if (fo) {
    const lines: { num?: boolean; c: Inline[] }[] = [{ c: ['коэффициент расстройки ', v('z'), ' = ', v('p'), '/', v('k'), ` = ${f(fo.z)}`] }];
    if (fo.eta != null)
      lines.push({
        c: [
          'коэффициент динамичности η = ',
          v('B'),
          '/(',
          v('H'),
          '/',
          v('c'),
          ') = ',
          r.n > 0 ? '1/√((1 − z²)² + 4n²z²/k²)' : '1/|1 − z²|',
          ' = ',
          b(f(fo.eta)),
        ],
      });
    if (fo.Ntr != null)
      lines.push({
        c: ['амплитуда силы, передаваемой на основание, ', v('N'), ' = ', v('B'), '√(', v('c'), '² + ', v('b'), '²', v('p'), `²) = ${f(fo.Ntr)} ${U.F}`],
      });
    if (pr.exc.mode !== 'rotor' && pr.exc.mode !== 'support' && r.n > 0) {
      if (fo.pStar != null)
        lines.push({
          c: [
            'наибольшая амплитуда — при ',
            v('p'),
            ' = √(',
            v('k'),
            '² − 2',
            v('n'),
            '²) = ',
            b(`${f(fo.pStar)} с⁻¹`),
            ': ',
            v('B'),
            sub('max'),
            ' = ',
            v('h'),
            '/(2',
            v('n'),
            '√(',
            v('k'),
            '² − ',
            v('n'),
            '²)) = ',
            b(`${f(fo.Bmax!)} ${U.L}`),
          ],
        });
      else lines.push({ c: [v('n'), ' ≥ ', v('k'), '/√2 — с ростом ', v('p'), ' амплитуда только убывает, максимума нет'] });
    }
    const bl: Block[] = [{ k: 'eq', lines }];
    if (fo.resonance) bl.push({ k: 'badge', tone: 'bad', text: 'резонанс: без сопротивления амплитуда растёт пропорционально времени' });
    else if (Math.abs(fo.z - 1) < 0.15)
      bl.push({ k: 'badge', tone: 'warn', text: 'частота возмущения близка к собственной — система работает вблизи резонанса' });
    ex(
      bl,
      'Свободные колебания со временем затухают (при любом, даже малом сопротивлении), а вынужденные остаются: они идут с частотой возмущения p, их амплитуда B и сдвиг фазы ε зависят только от z = p/k и затухания. При p > k√2 амплитуда меньше статического отклонения H/c (η < 1) — на этом основана виброизоляция.',
    );
    if (fo.rel != null) {
      lines.push({
        c: [
          'относительная амплитуда ',
          v('B'),
          '/',
          v('a'),
          ' = z²/√((1 − z²)² + 4n²z²/k²) = ',
          b(f(fo.rel)),
          fo.z > 1
            ? ' — при p > k перо почти неподвижно в пространстве и записывает движение основания (виброграф, сейсмограф)'
            : ' — при p < k груз движется вместе с основанием, записи нет',
        ],
      });
      if (fo.abs != null)
        lines.push({
          c: [
            'абсолютная амплитуда груза ',
            v('A'),
            '/',
            v('a'),
            ' = √(k⁴ + 4n²p²)/√((k² − p²)² + 4n²p²) = ',
            b(f(fo.abs)),
            fo.abs < 1 ? ' — виброизоляция' : '',
          ],
        });
    }
    if (r.rail)
      lines.push({
        c: [
          `толчки через каждые ${f(pr.exc.L)} ${U.L}: резонанс при `,
          v('p'),
          ' = ',
          v('k'),
          ', то есть критическая скорость ',
          v('v'),
          sub('кр'),
          ' = ',
          v('L'),
          '/',
          v('T'),
          sub('0'),
          ` = ${f(pr.exc.L)}/${f(r.T0)} = `,
          b(`${f(r.rail.vCrit)} ${U.L}/с`),
          ` = ${f((r.rail.vCrit * lenM(pr.len) * 3600) / 1000)} км/ч; при данной частоте скорость `,
          v('v'),
          ' = ',
          v('L'),
          v('p'),
          '/2π = ',
          `${f(r.rail.v)} ${U.L}/с`,
        ],
      });
    steps.push({ title: 'Вынужденные колебания', blocks: bl });
  }

  // 6а. Резонансная кривая.
  if (fo && HARMONIC.includes(pr.exc.mode) && pr.exc.mode !== 'two') {
    const rs = resonanceOf(r, pr.exc.mode as 'H' | 'rotor' | 'base' | 'support');
    if (rs) {
      const lines: { num?: boolean; c: Inline[] }[] = [
        {
          c: [
            rs.rotor
              ? 'кривая B(z)/(H₀/m) = z²/√((1 − z²)² + 4ζ²z²), ζ = n/k, z = p/k; сила пропорциональна p²: H = H₀p²'
              : 'кривая B(z)/(H/c) = 1/√((1 − z²)² + 4ζ²z²), ζ = n/k, z = p/k',
          ],
        },
        { c: ['сейчас ', v('z'), ` = ${f(rs.z)}, ζ = ${f(rs.zeta)}`, rs.etaNow != null ? `, высота кривой ${f(rs.etaNow)}` : ''] },
      ];
      if (rs.zStar != null && rs.etaMax != null)
        lines.push({
          c: [
            'максимум при ',
            v('z'),
            sub('*'),
            ` = ${rs.rotor ? '1/√(1 − 2ζ²)' : '√(1 − 2ζ²)'} = `,
            b(f(rs.zStar)),
            ', высота ',
            b(f(rs.etaMax)),
            ' = 1/(2ζ√(1 − ζ²))',
          ],
        });
      else lines.push({ c: [rs.zeta > 0 ? 'ζ ≥ 1/√2: максимума нет, кривая монотонна' : 'без сопротивления амплитуда неограниченно растёт при z → 1'] });
      if (rs.half)
        lines.push({
          c: [
            '«половинная ширина» (53.37): частоты, где амплитуда вдвое меньше резонансной (при z = 1 она равна 1/(2ζ) = ',
            f(rs.half.etaRes),
            `): z₁ = ${f(rs.half.z1)}, z₂ = ${f(rs.half.z2)}, `,
            'Δ = z₂ − z₁ = ',
            b(f(rs.half.width)),
            `; приближённо Δ ≈ 2√3·ζ = ${f(rs.half.approx)} при ζ ≪ 1`,
          ],
        });
      const bl: Block[] = [{ k: 'eq', lines }];
      ex(
        bl,
        'Резонансная кривая показывает, как амплитуда зависит от частоты возмущения. Чем меньше затухание, тем выше и уже пик; ширина пика на половине высоты Δ ≈ 2√3·ζ — мера затухания, по ней можно определить n из опыта.',
      );
      steps.push({ title: 'Резонансная кривая', blocks: bl });
    }
  }

  // 6б. Возмущения, не являющиеся гармоническими.
  if (r.trans) {
    const T = r.trans;
    const e = pr.exc;
    const lines: { num?: boolean; c: Inline[] }[] = [];
    if (T.xst != null)
      lines.push({ c: ['смещение под постоянной силой ', v('x'), sub('ст'), ' = ', v('F'), '/', v('c'), ` = ${f(T.H)}/${f(r.c)} = ${f(T.xst)} ${U.L}`] });
    lines.push({
      c: [v('x'), sub('max'), ` = ${f(r.max.x)} ${U.L} (t = ${f(r.max.t)} с);  `, v('x'), sub('min'), ` = ${f(r.min.x)} ${U.L} (t = ${f(r.min.t)} с)`],
    });
    if (T.ratio != null)
      lines.push({ c: ['наибольшее отклонение в долях ', v('F'), '/', v('c'), ': ', b(f(T.ratio)), ' (статическое действие — 1; удар — до 2)'] });
    if (r.n === 0 && T.tau != null && (e.mode === 'pulse' || e.mode === 'ramphold')) {
      const kt = (r.k * T.tau) / 2;
      lines.push({
        c: [
          e.mode === 'pulse'
            ? `после выключения силы: амплитуда свободных колебаний 2(F/c)|sin(kτ/2)| = 2·${f(T.xst!)}·${f(Math.abs(Math.sin(kt)))} = `
            : `после выхода силы на F₀: амплитуда около нового равновесия (2F₀/(c·kτ))|sin(kτ/2)| = (2·${f(T.xst!)}/${f(2 * kt)})·${f(Math.abs(Math.sin(kt)))} = `,
          b(`${f((e.mode === 'pulse' ? 2 : 1 / kt) * T.xst! * Math.abs(Math.sin(kt)))} ${U.L}`),
        ],
      });
    }
    const bl: Block[] = [{ k: 'eq', lines }];
    ex(
      bl,
      'Сила, не меняющаяся по гармоническому закону, раскладывается на участки, где она постоянна, линейна по времени или экспоненциальна: на каждом участке — своё частное решение. В моменты смены силы смещение и скорость непрерывны — по ним находятся постоянные следующего участка.',
    );
    steps.push({ title: e.mode === 'ramp' || e.mode === 'exp' || e.mode === 'cam' ? 'Действие возмущающей силы' : 'Кратковременная сила', blocks: bl });
  }

  // 7. Наибольшие отклонения, удар, прочность.
  {
    const lines: { num?: boolean; c: Inline[] }[] = [
      {
        c: [
          `за 0 ≤ t ≤ ${f(r.tEnd)} с: `,
          v('x'),
          sub('max'),
          ` = ${f(r.max.x)} ${U.L} (t = ${f(r.max.t)} с), `,
          v('x'),
          sub('min'),
          ` = ${f(r.min.x)} ${U.L} (t = ${f(r.min.t)} с)`,
        ],
      },
      {
        c: [
          'деформация элемента λ = δ',
          sub('ст'),
          ' + ',
          v('x'),
          ': от ',
          f(r.lamMin),
          ' до ',
          b(`${f(r.lamMax)} ${U.L}`),
          ';  наибольшая сила ',
          v('F'),
          sub('max'),
          ' = ',
          v('c'),
          '·|λ|',
          sub('max'),
          ' = ',
          b(`${f(r.Fmax)} ${U.F}`),
        ],
      },
    ];
    if (r.Kd != null)
      lines.push({ c: ['коэффициент динамичности ', v('K'), sub('д'), ' = λ', sub('max'), '/δ', sub('ст'), ` = ${f(r.lamMax)}/${f(r.dst)} = `, b(f(r.Kd))] });
    if (pr.init.mode === 'drop' && r.n === 0 && !fo && r.Kd != null) {
      const ratio = r.mRed / r.mLoad;
      lines.push({
        c: [
          'по формуле удара: ',
          v('K'),
          sub('д'),
          ' = 1 + √(1 + 2',
          v('h'),
          '/(δ',
          sub('ст'),
          ratio ? '(1 + βm_эл/m)' : '',
          `)) = 1 + √(1 + 2·${f(pr.init.h)}/(${f(r.dst)}${ratio ? `·${f(1 + ratio)}` : ''})) = ${f(1 + Math.sqrt(1 + (2 * pr.init.h) / (r.dst * (1 + ratio))))}`,
        ],
      });
      if (pr.init.h > 0)
        lines.push({
          c: [
            'при ',
            v('h'),
            ' ≫ δ',
            sub('ст'),
            ' приближённо ',
            v('K'),
            sub('д'),
            ' ≈ √(2',
            v('h'),
            '/δ',
            sub('ст'),
            `) = ${f(Math.sqrt((2 * pr.init.h) / (r.dst * (1 + ratio))))} (Антонов, п. 10.2)`,
          ],
        });
    }
    const bl: Block[] = [{ k: 'eq', lines }];
    if (r.stress) {
      const s = r.stress;
      const sl: { num?: boolean; c: Inline[] }[] = [
        one?.kind === 'rod'
          ? {
              c: [
                'σ',
                sub('ст'),
                ' = ',
                v('c'),
                'δ',
                sub('ст'),
                '/',
                v('A'),
                ' = ',
                b(`${f(s.sst)} ${U.s}`),
                ';  σ',
                sub('max'),
                ' = ',
                v('F'),
                sub('max'),
                '/',
                v('A'),
                ' = ',
                b(`${f(s.smax)} ${U.s}`),
              ],
            }
          : {
              c: [
                'σ',
                sub('ст'),
                ' = ',
                v('M'),
                sub('ст'),
                '/',
                v('W'),
                ' = ',
                b(`${f(s.sst)} ${U.s}`),
                ';  σ',
                sub('max'),
                ' = ',
                v('M'),
                sub('max'),
                '/',
                v('W'),
                ' = ',
                b(`${f(s.smax)} ${U.s}`),
                `  (M = F·${f(beamUnit(one!).M)})`,
              ],
            },
      ];
      bl.push({ k: 'eq', lines: sl });
      if (s.ok != null)
        bl.push({
          k: 'badge',
          tone: s.ok ? 'ok' : 'bad',
          text: s.ok ? `прочность обеспечена: σ_max ≤ [σ] = ${f(pr.el.sAllow)} ${U.s}` : `прочность не обеспечена: σ_max > [σ] = ${f(pr.el.sAllow)} ${U.s}`,
        });
    }
    if (r.slack != null)
      bl.push({
        k: 'badge',
        tone: 'warn',
        text:
          pr.init.mode === 'drop'
            ? `при t = ${f(r.slack)} с сила в элементе обращается в нуль — груз отрывается от элемента; дальше формула неверна`
            : `при t = ${f(r.slack)} с трос (нить) ослабевает — дальше формула неверна`,
      });
    ex(
      bl,
      'Сила в упругом элементе пропорциональна его деформации, поэтому во столько же раз, во сколько наибольшая деформация больше статической, больше и наибольшие сила и напряжение: σ_max = K_д·σ_ст.',
    );
    steps.push({ title: pr.init.mode === 'drop' ? 'Удар: наибольшая деформация и напряжения' : 'Наибольшие отклонение и сила', blocks: bl });
  }

  // 8. Состояние в момент t.
  {
    const a = r.at;
    steps.push({
      title: `Состояние при t = ${f(a.t)} с`,
      blocks: [
        {
          k: 'eq',
          lines: [
            {
              c: [
                v('x'),
                ` = ${f(a.x)} ${U.L};  `,
                v('v'),
                ` = ${f(a.v)} ${U.L}/с;  `,
                v('a'),
                ` = ${f(a.a)} ${U.L}/с²;  сила упругости c(δ`,
                sub('ст'),
                ` + x) = ${f(a.F)} ${U.F}`,
              ],
            },
          ],
        },
      ],
    });
  }

  const rows: AnswerRow[] = [];
  if (!r.dry) rows.push({ kind: 'main', val: [lawText(r), ` ${U.L}`], note: 'закон движения' });
  rows.push({ kind: 'main', val: [v('k'), ` = ${f(r.k)} с⁻¹`], note: `T₀ = ${f(r.T0)} с` });
  if (r.T1) rows.push({ kind: 'aux', val: [v('T'), sub('1'), ` = ${f(r.T1)} с`], note: `n = ${f(r.n)} с⁻¹` });
  if (r.A != null) rows.push({ kind: 'aux', val: [v('a'), ` = ${f(r.A)} ${U.L}`], note: 'амплитуда' });
  if (fo && fo.B != null) rows.push({ kind: 'aux', val: [v('B'), ` = ${f(Math.abs(fo.B))} ${U.L}`], note: 'амплитуда вынужденных колебаний' });
  if (fo && fo.B == null) rows.push({ kind: 'aux', val: ['резонанс: ', v('B'), ' → ∞'], note: 'амплитуда растёт как t' });
  if (r.forced2 && r.forced2.B != null)
    rows.push({ kind: 'aux', val: [v('B'), sub('2'), ` = ${f(Math.abs(r.forced2.B))} ${U.L}`], note: `вторая гармоника, p₂ = ${f(r.forced2.p)} с⁻¹` });
  if (fo?.rel != null) rows.push({ kind: 'aux', val: [v('B'), '/', v('a'), ` = ${f(fo.rel)}`], note: 'относительное движение к движению основания' });
  if (r.trans)
    rows.push({
      kind: 'main',
      val: [v('x'), sub('max'), ` = ${f(r.max.x)} ${U.L}`],
      note: r.trans.ratio != null ? `${f(r.trans.ratio)}·F/c (F/c = ${f(r.trans.xst!)} ${U.L})` : `при t = ${f(r.max.t)} с`,
    });
  if (r.rail)
    rows.push({
      kind: 'main',
      val: [v('v'), sub('кр'), ` = ${f((r.rail.vCrit * lenM(pr.len) * 3600) / 1000)} км/ч`],
      note: `L/T₀ = ${f(r.rail.vCrit)} ${U.L}/с`,
    });
  if (r.dry) rows.push({ kind: 'main', val: [`число полуразмахов: ${r.dry.swings.length}`], note: `остановка в x = ${f(r.dry.stop.x)} ${U.L}` });
  if (r.Kd != null && (pr.init.mode === 'drop' || fo))
    rows.push({ kind: 'main', val: [v('K'), sub('д'), ` = ${f(r.Kd)}`], note: `λ_max = ${f(r.lamMax)} ${U.L}` });
  rows.push({ kind: 'aux', val: [v('F'), sub('max'), ` = ${f(r.Fmax)} ${U.F}`], note: 'наибольшая сила в упругом элементе' });
  if (r.stress) rows.push({ kind: 'aux', val: ['σ', sub('max'), ` = ${f(r.stress.smax)} ${U.s}`], note: 'наибольшее напряжение' });
  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows }] });
  return { steps };
}
