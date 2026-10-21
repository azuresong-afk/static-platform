/** Текст решения задачи каталога: шаги машины, ответ и сверка с ответом книги. */
import { sig } from '../../modules/relative/text/earth';
import { type AnswerRow, type Block, type Doc, type Inline } from '../doc';
import type { MachinePreset, Solved } from './types';

export function machineDoc(s: Solved, book: MachinePreset | undefined, opts: { explain?: boolean } = {}): Doc {
  if (!s.ok)
    return {
      steps: [
        {
          title: 'Данные',
          blocks: [
            { k: 'badge', tone: 'bad', text: 'проверьте данные' },
            { k: 'ul', items: s.errors.map((x) => [x]) },
          ],
        },
      ],
    };
  const steps = s.steps.map((st) => {
    const blocks: Block[] = [{ k: 'eq', lines: st.lines.map((c) => ({ c })) }];
    if (st.note && opts.explain) blocks.push({ k: 'p', cls: 'explain', c: [st.note] });
    return { title: st.title, blocks };
  });
  const rows: AnswerRow[] = s.rows.map((r) => ({
    kind: r.aux ? 'aux' : 'main',
    val: [...r.label, ` = ${sig(r.val, r.digits ?? 4)} ${r.unit}`.trimEnd()],
    note: '',
  }));
  const blocks: Block[] = [{ k: 'answer', rows }];
  if (book?.book) {
    const bad: string[] = [];
    const lines: Inline[] = [];
    for (const r of s.rows) {
      const b = book.book[r.key];
      if (b === undefined) continue;
      const tol = book.relTol ?? 0.005;
      const ok = Math.abs(r.val - b) <= tol * Math.max(Math.abs(b), 1e-12) + 1e-12;
      if (!ok) bad.push(`${sig(r.val, 4)} вместо ${sig(b, 4)}`);
      lines.push(...(lines.length ? ['; '] : []), ...r.label, ` = ${sig(b, 4)} ${r.unit}`.trimEnd());
    }
    if (lines.length) {
      blocks.push({ k: 'p', c: ['Ответ книги: ', ...lines, '.'] });
      blocks.push(
        bad.length
          ? { k: 'badge', tone: 'warn', text: `расхождение с книгой: ${bad.join('; ')}` }
          : { k: 'badge', tone: 'ok', text: 'совпадает с ответом книги' },
      );
    }
  }
  if (book?.note) blocks.push({ k: 'p', cls: 'explain', c: [book.note] });
  steps.push({ title: 'Ответ', blocks });
  return { steps };
}
