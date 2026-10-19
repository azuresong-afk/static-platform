/** Решение: треугольник скоростей (ускорений) — обратная задача сложения движений. */
import { b, sub, v, type AnswerRow, type Block, type Doc, type Inline, type Step } from '../../../shared/doc';
import { fmt } from '../../../shared/format';
import { TRI_VECS, type TriItem, type TriProblem, type TriResult, type TriSol, type TriVec } from '../model/tri';

const f = (x: number) => fmt(x, 4);
const SYM: Record<TriVec, string> = { v: '', e: 'e', r: 'r' };
const KIND: Record<string, string> = {
  vec: 'Неизвестен один вектор целиком — находим его из векторного равенства.',
  lin: 'Направления векторов известны, модули — нет: проецируем равенство на оси, получаем два линейных уравнения.',
  quad: 'Неизвестны модуль одного вектора и направление другого: модуль второго вектора задан — это квадратное уравнение, решений может быть два.',
  sss: 'Известны модули всех трёх векторов: треугольник по трём сторонам, два зеркальных решения.',
  lin4: 'Два наблюдения с общим вектором: два векторных равенства — четыре линейных уравнения.',
};

export function triDoc(p: TriProblem, r: TriResult, opts: { explain?: boolean } = {}): Doc {
  const steps: Step[] = [];
  const L = p.what === 'v' ? 'v' : 'a';
  const nm = (k: TriVec, two = false): Inline[] => [v(L), ...(SYM[k] || two ? [sub(SYM[k] + (two ? '₂' : ''))] : [])];
  const ex = (bl: Block[], ...c: Inline[]) => {
    if (opts.explain) bl.push({ k: 'p', cls: 'explain', c });
  };
  const angle = p.compass ? 'курс (от севера по часовой стрелке)' : 'угол от оси x против часовой стрелки';
  {
    const eq: Inline[] = [...nm('v'), ' = ', ...nm('e'), ' + ', ...nm('r'), ...(p.what === 'a' ? [' + ', v('a'), sub('c')] : [])];
    const show = (k: TriVec, it: TriItem, two = false): { c: Inline[] } => ({
      c: [...nm(k, two), ': модуль ', it.qm ? b('?') : f(it.mod), ', направление ', it.qd ? b('?') : `${f(it.dir)}°`],
    });
    const lines: { c: Inline[] }[] = [{ c: eq }, ...TRI_VECS.map((k) => show(k, p[k]))];
    if (p.what === 'a') lines.push({ c: [v('a'), sub('c'), `: модуль ${f(p.c.mod)}, направление ${f(p.c.dir)}° (известно)`] });
    if (p.two) {
      lines.push({ c: ['второе наблюдение (общий вектор ', ...nm(p.shared), '):'] });
      for (const k of TRI_VECS) if (k !== p.shared) lines.push(show(k, p[`${k}2` as 'v2'], true));
    }
    const bl: Block[] = [{ k: 'eq', lines }];
    ex(
      bl,
      `Абсолютная ${p.what === 'v' ? 'скорость' : 'ускорение'} — векторная сумма переносной и относительной${p.what === 'a' ? ' (и кориолисова ускорения)' : ''}. Направление — ${angle}. Неизвестные: ${r.unknowns.join(', ') || '—'}.`,
    );
    steps.push({ title: 'Векторное равенство', blocks: bl });
  }
  if (!r.ok) {
    steps.push({
      title: 'Решение',
      blocks: [
        { k: 'badge', tone: 'bad', text: 'нет решения' },
        { k: 'ul', items: r.errors.map((x) => [x]) },
      ],
    });
    return { steps };
  }
  const solLines = (s: TriSol): { c: Inline[] }[] => {
    const out: { c: Inline[] }[] = [];
    const one = (k: TriVec, q: { mod: number; dir: number | null }, two = false) =>
      out.push({ c: [...nm(k, two), ' = ', b(f(q.mod)), q.dir == null ? ' (направление не определено)' : `, направление ${f(q.dir)}°`] });
    for (const k of TRI_VECS) one(k, s[k]);
    if (p.two && s.v2 && s.e2 && s.r2) for (const k of TRI_VECS) if (k !== p.shared) one(k, s[`${k}2` as 'v2']!, true);
    return out;
  };
  {
    const bl: Block[] = [];
    if (opts.explain) bl.push({ k: 'p', cls: 'explain', c: [KIND[r.kind] ?? ''] });
    r.sols.forEach((s, i) => {
      if (r.sols.length > 1) bl.push({ k: 'p', c: [b(`Решение ${i + 1}`)] });
      bl.push({ k: 'eq', lines: solLines(s) });
    });
    if (r.sols.length > 1)
      bl.push({
        k: 'p',
        c: [
          'Оба решения удовлетворяют условию; выбор — по смыслу задачи (например, встреча — при положительной относительной скорости по нужному направлению).',
        ],
      });
    steps.push({ title: r.sols.length > 1 ? 'Решения' : 'Решение', blocks: bl });
  }
  const rows: AnswerRow[] = [];
  r.sols.forEach((s, i) => {
    const pre = r.sols.length > 1 ? `решение ${i + 1}: ` : '';
    for (const k of TRI_VECS) {
      const it = p[k];
      if (!it.qm && !it.qd) continue;
      const q = s[k];
      rows.push({
        kind: 'main',
        val: [...nm(k), ` = ${f(q.mod)}`, q.dir == null ? '' : `, ${f(q.dir)}°`],
        note: `${pre}${k === 'v' ? 'абсолютная' : k === 'e' ? 'переносная' : 'относительная'}`,
      });
    }
    if (p.two && s.v2)
      for (const k of TRI_VECS) {
        if (k === p.shared || !p[`${k}2` as 'v2'].qm) continue;
        const q = s[`${k}2` as 'v2']!;
        rows.push({ kind: 'main', val: [...nm(k, true), ` = ${f(q.mod)}`], note: `${pre}второе наблюдение` });
      }
  });
  steps.push({ title: 'Ответ', blocks: [{ k: 'answer', rows }] });
  return { steps };
}
