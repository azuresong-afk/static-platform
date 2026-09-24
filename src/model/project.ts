/**
 * Файл проекта (JSON): сохранение и загрузка конструкции с проверкой содержимого.
 *
 * Формат, версия 1:
 * {
 *   "format": "statika-project", "version": 1,
 *   "title": "…", "savedAt": "2026-09-23T12:00:00.000Z",
 *   "structure": { "nodes": [...], "segs": [...], "items": [...] },
 *   "notTarget": ["X_A", …]
 * }
 * Поля конструкции — те же, что в src/model/types.ts. Лишние поля игнорируются.
 * Загрузка проверяет всё, от чего зависит расчёт, и сообщает понятные ошибки по-русски.
 */
import { geomOK } from './geometry';
import type { IdGen } from './ids';
import type { Dir, Item, Node, Seg, Structure } from './types';

export const PROJECT_FORMAT = 'statika-project';
export const PROJECT_VERSION = 1;

export interface Project {
  title: string;
  structure: Structure;
  notTarget: string[];
  savedAt?: string;
}

export interface ProjectFile extends Project {
  format: typeof PROJECT_FORMAT;
  version: number;
}

export function serializeProject(p: Project, now = new Date()): string {
  const file: ProjectFile = {
    format: PROJECT_FORMAT,
    version: PROJECT_VERSION,
    title: p.title,
    savedAt: now.toISOString(),
    structure: {
      nodes: p.structure.nodes.map((n) => (n.hinge ? { id: n.id, hinge: true } : { id: n.id })),
      segs: p.structure.segs.map(({ id, a, b, dir, len }) => ({ id, a, b, dir, len })),
      items: p.structure.items.map(cleanItem),
    },
    notTarget: [...p.notTarget],
  };
  return JSON.stringify(file, null, 2) + '\n';
}

/** Только поля, которые относятся к типу элемента (производные вроде x, y не сохраняются). */
function cleanItem(it: Item): Item {
  const pick = <K extends string>(...keys: K[]) => {
    const o: Record<string, unknown> = { id: it.id, type: it.type };
    for (const k of keys) if ((it as unknown as Record<string, unknown>)[k] !== undefined) o[k] = (it as unknown as Record<string, unknown>)[k];
    return o as unknown as Item;
  };
  switch (it.type) {
    case 'fixed':
    case 'pin':
      return pick('at', 'side');
    case 'roller':
      return pick('at', 'side', 'angle', 'angleName');
    case 'rod':
      return pick('at', 'angle', 'angleName');
    case 'force':
      return pick('at', 'F', 'ref', 'rot', 'alpha', 'unknown', 'angleName');
    case 'weight':
      return pick('at', 'G');
    case 'moment':
      return pick('at', 'M', 'dir', 'unknown');
    case 'dist':
      return pick('from', 'to', 'q1', 'q2', 'dir');
  }
}

export type ParseResult = { ok: true; project: Project } | { ok: false; errors: string[] };

const DIRS = ['r', 'l', 'u', 'd'];
const SIDES = ['below', 'above', 'left', 'right'];
const REFS = ['right', 'left', 'up', 'down'];
const ROTS = ['cw', 'ccw'];
const LOADDIRS = ['down', 'up', 'right', 'left'];
const TYPE_NAMES: Record<string, string> = {
  fixed: 'заделка',
  pin: 'шарнирно-неподвижная опора',
  roller: 'каток',
  rod: 'опорный стержень',
  force: 'сила',
  weight: 'груз',
  moment: 'пара сил',
  dist: 'распределённая нагрузка',
};

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

/** Разбор и проверка файла проекта. */
export function parseProject(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['Файл не является JSON: возможно, он повреждён или это не файл проекта.'] };
  }
  if (!isObj(raw) || raw.format !== PROJECT_FORMAT)
    return { ok: false, errors: ['Это не файл проекта «Статика» (нет отметки format: "statika-project").'] };
  if (!isNum(raw.version) || raw.version > PROJECT_VERSION)
    return { ok: false, errors: [`Версия файла (${String(raw.version)}) новее, чем поддерживает приложение (${PROJECT_VERSION}). Обновите приложение.`] };
  const errors: string[] = [];
  const st = raw.structure;
  if (!isObj(st) || !Array.isArray(st.nodes) || !Array.isArray(st.segs) || !Array.isArray(st.items))
    return { ok: false, errors: ['В файле нет конструкции (structure с полями nodes, segs, items).'] };

  const nodes: Node[] = [];
  const nodeIds = new Set<string>();
  st.nodes.forEach((n, i) => {
    if (!isObj(n) || !isStr(n.id)) return errors.push(`Точка №${i + 1}: нет идентификатора.`);
    if (nodeIds.has(n.id)) return errors.push(`Точка «${n.id}» встречается дважды.`);
    nodeIds.add(n.id);
    if (n.hinge !== undefined && typeof n.hinge !== 'boolean') return errors.push(`Точка «${n.id}»: признак шарнира должен быть true или false.`);
    nodes.push(n.hinge ? { id: n.id, hinge: true } : { id: n.id });
  });
  if (!nodes.length) errors.push('В конструкции нет ни одной точки.');

  const segs: Seg[] = [];
  const segIds = new Set<string>();
  st.segs.forEach((q, i) => {
    const where = `Участок №${i + 1}`;
    if (!isObj(q) || !isStr(q.id)) return errors.push(`${where}: нет идентификатора.`);
    if (segIds.has(q.id)) return errors.push(`Участок «${q.id}» встречается дважды.`);
    segIds.add(q.id);
    if (!isStr(q.a) || !nodeIds.has(q.a) || !isStr(q.b) || !nodeIds.has(q.b)) return errors.push(`${where}: ссылается на несуществующую точку.`);
    if (!DIRS.includes(q.dir as string)) return errors.push(`${where}: неизвестное направление «${String(q.dir)}».`);
    if (!isNum(q.len) || q.len <= 0 || q.len > 1000) return errors.push(`${where}: длина должна быть числом от 0 до 1000 м.`);
    segs.push({ id: q.id, a: q.a, b: q.b, dir: q.dir as Dir, len: q.len });
  });

  const items: Item[] = [];
  const itemIds = new Set<string>();
  st.items.forEach((it, i) => {
    const bad = (msg: string) => errors.push(`Элемент №${i + 1}${isObj(it) && TYPE_NAMES[it.type as string] ? ` (${TYPE_NAMES[it.type as string]})` : ''}: ${msg}`);
    if (!isObj(it) || !isStr(it.id)) return bad('нет идентификатора.');
    if (itemIds.has(it.id)) return bad(`идентификатор «${it.id}» встречается дважды.`);
    itemIds.add(it.id);
    const type = it.type as string;
    if (!TYPE_NAMES[type]) return bad(`неизвестный тип «${type}».`);
    const node = (f: string) => {
      if (!isStr(it[f]) || !nodeIds.has(it[f] as string)) {
        bad('привязан к несуществующей точке.');
        return false;
      }
      return true;
    };
    const num = (f: string, label: string) => {
      if (!isNum(it[f])) {
        bad(`${label} должен быть числом.`);
        return false;
      }
      return true;
    };
    const oneOf = (f: string, allowed: string[], label: string) => {
      if (!allowed.includes(it[f] as string)) {
        bad(`${label}: недопустимое значение «${String(it[f])}».`);
        return false;
      }
      return true;
    };
    const bool = (f: string) => {
      if (typeof it[f] !== 'boolean') {
        bad('признак «неизвестна» должен быть true или false.');
        return false;
      }
      return true;
    };
    if (it.angleName !== undefined && !(typeof it.angleName === 'string' && it.angleName.length >= 1 && it.angleName.length <= 3)) return bad('обозначение угла должно быть строкой из 1–3 символов.');
    let ok = true;
    switch (type) {
      case 'fixed':
      case 'pin':
        ok = node('at') && oneOf('side', SIDES, 'опорная поверхность');
        break;
      case 'roller':
        ok = node('at') && oneOf('side', [...SIDES, 'tilt'], 'опорная поверхность') && (it.side !== 'tilt' || num('angle', 'угол'));
        break;
      case 'rod':
        ok = node('at') && num('angle', 'угол');
        break;
      case 'force':
        ok = node('at') && num('F', 'модуль') && num('alpha', 'угол') && oneOf('ref', REFS, 'направление отсчёта') && oneOf('rot', ROTS, 'сторона отсчёта') && bool('unknown');
        break;
      case 'weight':
        ok = node('at') && num('G', 'вес');
        break;
      case 'moment':
        ok = node('at') && num('M', 'момент') && oneOf('dir', ROTS, 'направление') && bool('unknown');
        break;
      case 'dist':
        ok = node('from') && node('to') && num('q1', 'q в начале') && num('q2', 'q в конце') && oneOf('dir', LOADDIRS, 'направление');
        break;
    }
    if (ok) items.push(cleanItem(it as unknown as Item));
  });

  const structure: Structure = { nodes, segs, items };
  if (!errors.length) {
    if (segs.length !== nodes.length - 1) errors.push('Участки должны соединять все точки в одну раму без замкнутых контуров (участков на один меньше, чем точек).');
    else if (!geomOK(structure)) errors.push('Участки не образуют связную раму или пересекаются.');
  }
  const nt = Array.isArray(raw.notTarget) ? raw.notTarget.filter(isStr) : [];
  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    project: { title: isStr(raw.title) ? raw.title : 'Проект', structure, notTarget: nt, savedAt: isStr(raw.savedAt) ? raw.savedAt : undefined },
  };
}

/** Новые идентификаторы для загруженной конструкции (чтобы не пересечься с историей отмены). */
export function remapIds(s: Structure, ids: IdGen): Structure {
  const nm = new Map(s.nodes.map((n) => [n.id, ids.node()]));
  const segs = s.segs.map((q) => ({ ...q, id: ids.seg(), a: nm.get(q.a)!, b: nm.get(q.b)! }));
  const items = s.items.map((it) => {
    const id = ids.item();
    return it.type === 'dist' ? { ...it, id, from: nm.get(it.from)!, to: nm.get(it.to)! } : { ...it, id, at: nm.get(it.at)! };
  }) as Item[];
  return { nodes: s.nodes.map((n) => ({ id: nm.get(n.id)! })), segs, items };
}

/** Имя файла: «Своя схема 2026-09-23.statika.json» без недопустимых символов. */
export function projectFileName(title: string, date = new Date()): string {
  const safe = title.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Проект';
  return `${safe} ${date.toISOString().slice(0, 10)}.statika.json`;
}
