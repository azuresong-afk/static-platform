/** Решение: относительное движение точки в трубке подвижного тела — уравнение, закон движения, давление на стенку. */
import { b, sub, v, type AnswerRow, type Block, type Doc, type Inline, type Step } from '../../../shared/doc';
import { parseExpr, printExpr } from '../../../shared/expr';
import { fmt } from '../../../shared/format';
import type { RelProblem, RelResult } from '../model/rel';

const f = (x: number) => fmt(x, 4);
/** Слагаемое со знаком: « + 2» / « − 2». */
const sg = (x: number, body = '') => (x < 0 ? ` − ${f(-x)}${body}` : ` + ${f(x)}${body}`);
/** Сумма слагаемых [коэффициент, множитель] без нулевых: «0,6 ch 6,2832t + 0,1». */
function sum(terms: [number, string][]): string {
  const nz = terms.filter(([c]) => Math.abs(c) > 1e-12);
  if (!nz.length) return '0';
  const [c0, b0] = nz[0];
  return (
    (c0 < 0 ? '−' : '') +
    f(Math.abs(c0)) +
    b0 +
    nz
      .slice(1)
      .map(([c, bb]) => sg(c, bb))
      .join('')
  );
}
export const FRAME_NAME: Record<RelProblem['frame'], string> = {
  vert: 'вращение вокруг вертикальной оси',
  horz: 'вращение вокруг горизонтальной оси',
  trans: 'поступательное движение',
};

export function relDoc(pr: RelProblem, r: RelResult, opts: { explain?: boolean } = {}): Doc {
  const steps: Step[] = [];
  const ex = (bl: Block[], ...c: Inline[]) => {
    if (opts.explain) bl.push({ k: 'p', cls: 'explain', c });
  };
  if (!r.ok || !r.end || !r.start) {
    steps.push({
      title: 'Данные',
      blocks: [
        { k: 'badge', tone: 'bad', text: 'проверьте данные' },
        { k: 'ul', items: r.errors.map((x) => [x]) },
      ],
    });
    return { steps };
  }
  const FU = pr.byWeight ? 'кГ' : 'Н';
  const m = r.mass;
  const sp = pr.c > 0;
  const fr = pr.f > 0;
  const law = (s: string) => {
    const p = parseExpr(s);
    return p.ok ? printExpr(p.e) : s;
  };
  // 1. Подвижная система отсчёта и силы.
  {
    const items: Inline[][] = [[`масса m = ${pr.byWeight ? `P/g = ${f(pr.m)}/${f(pr.g)} = ` : ''}${f(m)}; вес P = ${f(r.P)} ${FU}`]];
    if (pr.frame === 'vert')
      items.push([
        `тело равномерно вращается вокруг вертикальной оси: ω = ${f(pr.omega)} рад/с; ось x — вдоль трубки от точки O под углом θ = ${f(pr.theta)}° к горизонтали; O — на расстоянии r = ${f(pr.r)} от оси`,
        pr.d ? `; плоскость трубки смещена от оси на d = ${f(pr.d)}` : '',
      ]);
    else if (pr.frame === 'horz')
      items.push([
        `тело равномерно вращается вокруг горизонтальной оси, перпендикулярной чертежу: ω = ${f(pr.omega)} рад/с; угол трубки с горизонталью θ = θ₀ + ωt, θ₀ = ${f(pr.theta)}°; расстояние от оси до трубки h = ${f(pr.h)}, x — от основания перпендикуляра`,
      ]);
    else {
      const y = pr.y1.trim() ? law(pr.y1) : '0',
        z = pr.z1.trim() ? law(pr.z1) : '0';
      items.push([
        `тело движется поступательно: точка тела — по законам y₁(t) = ${y}, z₁(t) = ${z}; ось x — вдоль трубки под углом θ = ${f(pr.theta)}° к горизонтали`,
      ]);
      items.push(['переносное ускорение: ', v('ÿ'), sub('1'), ` = ${r.ay ? printExpr(r.ay) : '0'}, `, v('z̈'), sub('1'), ` = ${r.az ? printExpr(r.az) : '0'}`]);
    }
    items.push([`начальные условия: x₀ = ${f(pr.x0)}, ẋ₀ = ${f(pr.v0)}`]);
    if (sp) items.push([`пружина от точки O: сила −c(x − l₀), c = ${f(pr.c)}, l₀ = ${f(pr.l0)}`]);
    if (fr) items.push([`трение о стенку: −f·N·sign ẋ, f = ${f(pr.f)}, N — полная реакция стенки`]);
    if (pr.form?.trim()) items.push([`сила вдоль трубки F(t, x, v) = ${law(pr.form)} (v = ẋ)`]);
    const bl: Block[] = [{ k: 'ul', items }];
    const cor: Inline[] =
      pr.frame === 'trans'
        ? [' (при поступательном переносном движении кориолисово ускорение равно нулю)']
        : [' и кориолисова ', v('Φ'), sub('c'), ' = −2m', v('ω'), ' × ', v('v'), sub('r')];
    bl.push({
      k: 'p',
      c: [
        'Относительное движение — вдоль трубки; переносное — ',
        FRAME_NAME[pr.frame],
        '. К силам добавляются переносная сила инерции ',
        v('Φ'),
        sub('e'),
        ' = −m',
        v('a'),
        sub('e'),
        ...cor,
        ': m',
        v('a'),
        sub('r'),
        ' = Σ',
        v('F'),
        ' + ',
        v('Φ'),
        sub('e'),
        ...(pr.frame === 'trans' ? [] : [' + ', v('Φ'), sub('c')]),
        '.',
      ],
    });
    if (pr.frame === 'vert')
      ex(
        bl,
        'Переносная сила инерции — центробежная: mω²ρ от оси, ρ — расстояние до оси. Кориолисова сила перпендикулярна плоскости, в которой лежат ось вращения и относительная скорость; её модуль 2mω|ẋ|·sin(ω, v_r) = 2mω|ẋ| cos θ.',
      );
    if (pr.frame === 'horz')
      ex(
        bl,
        'Ось вращения перпендикулярна чертежу, поэтому кориолисова сила 2mωẋ лежит в плоскости чертежа и перпендикулярна трубке; сила тяжести относительно трубки поворачивается: её проекция на трубку −mg sin(θ₀ + ωt).',
      );
    steps.push({ title: 'Подвижная система отсчёта и силы', blocks: bl });
  }
  // 2. Уравнение относительного движения.
  const extra = `${sp ? ' − c(x − l₀)' : ''}${pr.form?.trim() ? ' + F(t, x, ẋ)' : ''}${fr ? ' − f·N·sign ẋ' : ''}`;
  {
    const lines: { c: Inline[] }[] = [];
    if (pr.frame === 'vert') lines.push({ c: ['m', v('ẍ'), ' = mω²(r + x cos θ) cos θ − mg sin θ', extra] });
    else if (pr.frame === 'horz') lines.push({ c: ['m', v('ẍ'), ' = mω²x − mg sin(θ₀ + ωt)', extra] });
    else lines.push({ c: ['m', v('ẍ'), ' = −m(', v('ÿ'), sub('1'), ' cos θ + ', v('z̈'), sub('1'), ' sin θ) − mg sin θ', extra] });
    const c = r.closed;
    if (c) {
      const rhs = pr.frame === 'horz' && pr.omega ? `${c.B ? f(c.B) : ''}${c.B ? ' − ' : '−'}${f(pr.g)} sin(${f(pr.theta)}° + ${f(pr.omega)}t)` : f(c.B);
      lines.push({ c: [v('ẍ'), c.K < 0 ? ` − ${f(-c.K)}x` : c.K > 0 ? ` + ${f(c.K)}x` : '', ' = ', rhs] });
    }
    const bl: Block[] = [{ k: 'eq', lines }];
    if (fr)
      bl.push({
        k: 'p',
        c: [
          'Сила трения зависит от давления на стенку, а давление — от ',
          pr.frame === 'trans' ? 'ускорения тела' : 'скорости ẋ (кориолисова сила)',
          ', поэтому уравнение нелинейное.',
        ],
      });
    steps.push({ title: 'Уравнение относительного движения', blocks: bl });
  }
  // 3. Закон движения.
  {
    const bl: Block[] = [];
    const c = r.closed;
    if (c) {
      const part: [number, string] = [c.A, ` sin(${f(pr.theta)}° + ${f(pr.omega)}t)`];
      if (c.kind === 'lin')
        bl.push({
          k: 'eq',
          lines: [
            {
              c: [b(`x = ${sum([[c.C1, ''], [c.C2, 't'], [c.B / 2, 't²'], part])}`)],
            },
          ],
        });
      else {
        const [u, w] = c.kind === 'osc' ? ['cos', 'sin'] : ['ch', 'sh'];
        bl.push({
          k: 'eq',
          lines: [
            { c: [`k = √|K| = ${f(c.k)} с⁻¹;  частное решение x* = B/K = ${f(c.xs)}`, c.A ? `, A = −g/(K − ω²) = ${f(c.A)}` : ''] },
            { c: [`x = C₁ ${u} kt + C₂ ${w} kt + x*`, c.A ? ' + A sin(θ₀ + ωt)' : '', `;  C₁ = ${f(c.C1)}, C₂ = ${f(c.C2)}`] },
            {
              c: [b(`x = ${sum([[c.C1, ` ${u} ${f(c.k)}t`], [c.C2, ` ${w} ${f(c.k)}t`], [c.xs, ''], part])}`)],
            },
          ],
        });
      }
      ex(
        bl,
        c.kind === 'osc'
          ? 'K > 0: точка колеблется около положения относительного равновесия x*.'
          : c.kind === 'exp'
            ? 'K < 0: положение x* неустойчиво — точка уходит от него по закону гиперболических функций.'
            : 'K = 0: восстанавливающей силы нет, движение равнопеременное.',
        ' Постоянные C₁, C₂ — из начальных условий x(0) = x₀, ẋ(0) = ẋ₀.',
      );
    } else
      bl.push({
        k: 'p',
        c: ['Уравнение решается численно (метод Рунге — Кутты с контролем шага', fr ? '; остановка трением — точно, с проверкой условия сцепления' : '', ').'],
      });
    steps.push({ title: 'Закон относительного движения', blocks: bl });
  }
  // 4. Искомое состояние.
  const e = r.end;
  const rows: AnswerRow[] = [];
  {
    const bl: Block[] = [];
    if (pr.ask === 'x' && r.note !== 'ok') {
      bl.push({ k: 'badge', tone: 'bad', text: `точка не доходит до x = ${f(pr.x1)}` });
      bl.push({
        k: 'p',
        c: [
          r.note === 'stuck'
            ? `Трение удерживает точку в покое при x = ${f(e.x)}.`
            : 'Точка колеблется или уходит в другую сторону и положения x₁ не достигает.',
        ],
      });
      steps.push({ title: `Когда x = ${f(pr.x1)}`, blocks: bl });
      steps.push({
        title: 'Ответ',
        blocks: [{ k: 'answer', rows: [{ kind: 'main', val: ['x₁ не достигается'], note: r.note === 'stuck' ? 'точка остаётся в покое' : '' }] }],
      });
      return { steps };
    }
    bl.push({
      k: 'eq',
      lines: [
        {
          c: [
            pr.ask === 'x' ? b(`t₁ = ${f(e.t)} с`) : `t₁ = ${f(e.t)} с`,
            ':  ',
            pr.ask === 'x' ? `x = ${f(e.x)}` : b(`x₁ = ${f(e.x)}`),
            ',  ',
            b(`ẋ₁ = ${f(e.v)}`),
            ` (|v_r| = ${f(Math.abs(e.v))}),  ẍ₁ = ${f(e.a)}`,
          ],
        },
      ],
    });
    steps.push({ title: pr.ask === 'x' ? `Когда x = ${f(pr.x1)}` : `В момент t₁ = ${f(pr.t1)} с`, blocks: bl });
    rows.push({
      kind: 'main',
      val: pr.ask === 'x' ? [`t₁ = ${f(e.t)} с;  `, v('v'), sub('r'), ` = ${f(Math.abs(e.v))}`] : [`x₁ = ${f(e.x)};  ẋ₁ = ${f(e.v)}`],
      note: 'относительное движение',
    });
  }
  // 5. Давление на стенку.
  {
    const lines: { c: Inline[] }[] = [];
    if (pr.frame === 'vert') {
      const X = pr.r + e.x * Math.cos((pr.theta * Math.PI) / 180);
      lines.push({ c: [v('N'), sub('1'), ` = m(g cos θ + ω²(r + x cos θ) sin θ) = ${f(e.N1)} ${FU}`, `  (ρ = r + x cos θ = ${f(X)})`] });
      lines.push({ c: [v('N'), sub('2'), ` = m(2ωẋ cos θ${pr.d ? ' − ω²d' : ''}) = ${f(e.N2)} ${FU}`] });
    } else if (pr.frame === 'horz') {
      lines.push({
        c: [
          v('N'),
          sub('1'),
          ` = m(g cos(θ₀ + ωt) + 2ωẋ${pr.h ? ' − ω²h' : ''}) = ${f(e.N1)} ${FU}`,
          `  (θ = ${f(pr.theta + (pr.omega * e.t * 180) / Math.PI)}°)`,
        ],
      });
      lines.push({ c: [v('N'), sub('2'), ' = 0'] });
    } else {
      lines.push({ c: [v('N'), sub('1'), ` = m(g cos θ + z̈₁ cos θ − ÿ₁ sin θ) = ${f(e.N1)} ${FU}`] });
      lines.push({ c: [v('N'), sub('2'), ' = 0'] });
    }
    lines.push({ c: [b(`N = √(N₁² + N₂²) = ${f(e.N)} ${FU}`)] });
    const bl: Block[] = [{ k: 'eq', lines }];
    bl.push({
      k: 'p',
      c: [
        'N₁ — составляющая реакции в плоскости чертежа (перпендикулярно трубке), N₂ — перпендикулярно чертежу. Давление точки на стенку равно реакции по модулю и направлено противоположно.',
      ],
    });
    ex(bl, 'Поперёк трубки относительного ускорения нет, поэтому сумма проекций сил, сил инерции и реакции на эти направления равна нулю.');
    steps.push({ title: 'Давление на стенку', blocks: bl });
    rows.push({ kind: 'main', val: [`N = ${f(e.N)} ${FU}`], note: `N₁ = ${f(e.N1)}, N₂ = ${f(e.N2)}` });
  }
  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows }] });
  return { steps };
}
