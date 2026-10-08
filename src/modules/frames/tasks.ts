/**
 * Готовые задачи вкладки «Балки и рамы» для списка и «Задачника»: примеры прототипа и задачи Мещерского
 * (§3–4: одно тело, составные конструкции, наклонные участки, трение) с ответами из книги.
 */
import type { IdGen } from '../../shared/ids';
import { fmt } from '../../shared/format';
import type { TaskEntry } from '../../shared/tasks';
import { PRESET_TITLES, presetStructure, type PresetKey } from './model/presets';
import { TEXTBOOK, TEXTBOOK_COMPOSITE, TEXTBOOK_FRICTION, TEXTBOOK_INCLINED, type FrictionProblem, type TextbookProblem } from './model/textbook';
import type { Structure } from './model/types';

export interface BookTask extends TaskEntry {
  build: (ids?: IdGen) => Structure;
  /** Ответ задачника и пояснения к переводу схемы — показываются при загрузке. */
  answer: string;
}

/** «3.7 (81)» → «3.7». */
const numOf = (id: string) => id.replace(/\s*\(.*\)\s*$/, '');
const lc = (s: string) => (s ? s[0].toLowerCase() + s.slice(1) : s);
const v = (x: number) => fmt(x, 4);

function answerOf(p: TextbookProblem | FrictionProblem): string {
  const parts: string[] = [];
  if ('answer' in p) {
    parts.push(
      'Ответ задачника: ' +
        Object.entries(p.answer)
          .map(([k, x]) => `${k} = ${v(x)}`)
          .join('; ') +
        '.',
    );
    if (p.discrepancy) for (const [k, d] of Object.entries(p.discrepancy)) parts.push(`Расхождение: по расчёту ${k} = ${v(d.computed)}. ${d.why}`);
  } else {
    const lo = p.min !== undefined ? v(p.min) : null,
      hi = p.max !== undefined && Number.isFinite(p.max) ? v(p.max) : null;
    parts.push(`Ответ задачника: искомая нагрузка ${lo && hi ? `от ${lo} до ${hi}` : hi ? `не больше ${hi}` : lo ? `не меньше ${lo}` : '—'}.`);
  }
  if (p.note) parts.push(p.note);
  return parts.join(' ');
}

export const FRAMES_BOOK: BookTask[] = [...TEXTBOOK, ...TEXTBOOK_COMPOSITE, ...TEXTBOOK_INCLINED, ...TEXTBOOK_FRICTION].map((p) => ({
  key: 'tb:' + numOf(p.id),
  title: `Мещерский ${numOf(p.id)}: ${lc(p.title)}`,
  build: (ids?: IdGen) => presetStructure(p.preset, ids),
  answer: answerOf(p),
}));

/** Все задачи вкладки: задачи Мещерского и примеры прототипа (ключи прототипа — как были). */
export const FRAMES_TASKS: TaskEntry[] = [
  ...FRAMES_BOOK.map(({ key, title }) => ({ key, title })),
  ...(Object.keys(PRESET_TITLES) as PresetKey[]).map((k) => ({ key: k, title: PRESET_TITLES[k] })),
];

export const isBookKey = (k: string) => k.startsWith('tb:');
