/**
 * Готовые задачи вкладки «Балки и рамы» для списка и «Задачника»: примеры прототипа и задачи Мещерского
 * (§3–4: одно тело, составные конструкции, наклонные участки, трение) с ответами из книги.
 */
import { createIdGen, type IdGen } from '../../shared/ids';
import { normAng } from './model/constants';
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

/**
 * Пример задания С.3 сборника Яблонского (рис. 20): левая часть — Г-образная рама на шарнире A (P₁ = 5 кН под 60°
 * к горизонтали в левом конце, q = 2 кН/м на стойке), правая — стержень CB на шарнире B (P₂ = 7 кН перпендикулярно
 * CB в его середине, пара M = 22 кН·м). Части соединены шарниром C или скользящей заделкой с горизонтальной
 * направляющей (вид для вариантов 1–3 по табл. 6). Ответы книги: X_A = −7,97, Y_A = 3,36 (шарнир) и
 * X_A = −5,50, Y_A = 3,85 (скользящая заделка). Пара M приложена к правой части; её точка на ответ не влияет.
 */
function yabC3(slide: boolean, ids?: IdGen): Structure {
  const n = (ids ?? createIdGen()) as IdGen;
  const [A, D, L, C, K, B] = [n.node(), n.node(), n.node(), n.node(), n.node(), n.node()];
  const half = Math.sqrt(13) / 2,
    ang = normAng((Math.atan2(-3, 2) * 180) / Math.PI);
  return {
    nodes: [{ id: A }, { id: D }, { id: L }, slide ? { id: C, slide: 90 } : { id: C, hinge: true }, { id: K }, { id: B }],
    segs: [
      { id: n.seg(), a: A, b: D, dir: 'u', len: 4 },
      { id: n.seg(), a: D, b: L, dir: 'l', len: 3 },
      { id: n.seg(), a: D, b: C, dir: 'r', len: 3 },
      { id: n.seg(), a: C, b: K, dir: 'a', len: half, ang },
      { id: n.seg(), a: K, b: B, dir: 'a', len: half, ang },
    ],
    items: [
      { id: n.item(), type: 'pin', at: A, side: 'below' },
      { id: n.item(), type: 'pin', at: B, side: 'below' },
      { id: n.item(), type: 'force', at: L, F: 5, ref: 'left', rot: 'ccw', alpha: 60, unknown: false },
      { id: n.item(), type: 'dist', from: A, to: D, q1: 2, q2: 2, dir: 'right' },
      { id: n.item(), type: 'force', at: K, F: 7, ref: 'left', rot: 'ccw', alpha: (Math.atan2(2, 3) * 180) / Math.PI, unknown: false },
      { id: n.item(), type: 'moment', at: B, M: 22, dir: 'cw', unknown: false },
    ],
  };
}

/** Примеры заданий Яблонского с ответами книги (для проверки в тестах — answerVals). */
export const YAB_FRAMES: (BookTask & { answerVals: Record<string, number> })[] = [
  {
    key: 'yb:С.3a',
    title: 'Яблонский, С.3: пример — части соединены шарниром C',
    build: (ids?: IdGen) => yabC3(false, ids),
    answer:
      'Ответ книги: X_A = −7,97 кН, Y_A = 3,36 кН, R_A = 8,65 кН. Точки: A — шарнир левой части, H — опора B книги, D — шарнир C книги; P₂ приложена в середине CB (точка E), пара M — к правой части (в точке опоры).',
    answerVals: { X_A: -7.97, Y_A: 3.36 },
  },
  {
    key: 'yb:С.3b',
    title: 'Яблонский, С.3: пример — скользящая заделка в C',
    build: (ids?: IdGen) => yabC3(true, ids),
    answer:
      'Ответ книги: X_A = −5,50 кН, Y_A = 3,85 кН, R_A = 6,71 кН — меньше, чем при шарнире (≈ на 22 %). Направляющая заделки горизонтальна: передаются сила по вертикали (Y_C книги = 0,48 кН) и момент.',
    answerVals: { X_A: -5.5, Y_A: 3.85 },
  },
];

/** Все задачи вкладки: задачи Мещерского и примеры прототипа (ключи прототипа — как были). */
export const FRAMES_TASKS: TaskEntry[] = [
  ...FRAMES_BOOK.map(({ key, title }) => ({ key, title })),
  ...YAB_FRAMES.map(({ key, title }) => ({ key, title })),
  ...(Object.keys(PRESET_TITLES) as PresetKey[]).map((k) => ({ key: k, title: PRESET_TITLES[k] })),
];

export const isBookKey = (k: string) => k.startsWith('tb:') || k.startsWith('yb:');
