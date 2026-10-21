/**
 * Файл проекта модуля «Балки и рамы»: сохранение и загрузка конструкции с проверкой содержимого.
 *
 * Конверт (format, version, module, title, savedAt) — src/shared/projectFile.ts; данные модуля:
 * {
 *   "structure": { "nodes": [...], "segs": [...], "items": [...], "links": [...] },
 *   "notTarget": ["X_A", …]
 * }
 * Поля конструкции — те же, что в model/types.ts (у наклонного участка dir = "a" и угол ang). Лишние поля игнорируются.
 * Несколько тел: начальная точка отдельного тела — с полем place { from, dx, dy }; связи между телами — links
 * (касание contact: a, b, angle, f; нить thread: a, b, via). Без них файл такой же, как раньше.
 * Файлы версии 1 (без поля module) открываются этим модулем.
 * Загрузка проверяет всё, от чего зависит расчёт, и сообщает понятные ошибки по-русски.
 */
import { isNum, isObj, isStr, readEnvelope, writeEnvelope } from '../../../shared/projectFile';
import { axisDir, normAng } from './constants';
import { geomOK } from './geometry';
import type { IdGen } from '../../../shared/ids';
import type { Dir, Item, Link, Node, PinFriction, Search, Seg, Structure } from './types';

export { projectFileName } from '../../../shared/projectFile';

/** Идентификатор модуля в файле проекта. */
export const FRAMES_MODULE = 'frames';

export interface Project {
  title: string;
  structure: Structure;
  notTarget: string[];
  savedAt?: string;
}

export function serializeProject(p: Project, now = new Date()): string {
  const structure = {
    nodes: p.structure.nodes.map((n) => cleanNode(n)),
    segs: p.structure.segs.map(({ id, a, b, dir, len, ang }) => (dir === 'a' ? { id, a, b, dir, len, ang } : { id, a, b, dir, len })),
    items: p.structure.items.map(cleanItem),
    ...(p.structure.links?.length ? { links: p.structure.links.map(cleanLink) } : {}),
    ...(p.structure.search ? { search: cleanSearch(p.structure.search) } : {}),
  };
  return writeEnvelope(FRAMES_MODULE, p.title, { structure, notTarget: [...p.notTarget] }, now);
}

/** Точка: идентификатор, признак шарнира, угол скользящей заделки между частями, место отдельного тела. */
const cleanNode = (n: Node, id = n.id, from = n.place?.from): Node => {
  const r: Node = n.slide != null ? { id, slide: n.slide } : n.hinge ? { id, hinge: true } : { id };
  if (n.place && from) r.place = { from, dx: n.place.dx, dy: n.place.dy };
  return r;
};

/** Связь: только поля её типа. */
const cleanLink = (l: Link): Link =>
  l.type === 'contact'
    ? { id: l.id, type: 'contact', a: l.a, b: l.b, angle: l.angle, ...(l.angleName ? { angleName: l.angleName } : {}), f: l.f }
    : l.type === 'hinge'
      ? { id: l.id, type: 'hinge', a: l.a, b: l.b }
      : { id: l.id, type: 'thread', a: l.a, b: l.b, ...(l.via?.length ? { via: [...l.via] } : {}) };

/** Поиск положения равновесия: параметр, промежуток и формулы. */
const cleanSearch = (sr: Search): Search => ({ name: sr.name, unit: sr.unit, min: sr.min, max: sr.max, bind: sr.bind.map(({ ref, field, expr }) => ({ ref, field, expr })) });

/** Только поля, которые относятся к типу элемента (производные вроде x, y не сохраняются). */
function cleanItem(it: Item): Item {
  const pick = <K extends string>(...keys: K[]) => {
    const o: Record<string, unknown> = { id: it.id, type: it.type };
    for (const k of keys) if ((it as unknown as Record<string, unknown>)[k] !== undefined) o[k] = (it as unknown as Record<string, unknown>)[k];
    return o as unknown as Item;
  };
  switch (it.type) {
    case 'fixed':
      return pick('at', 'side');
    case 'pin': {
      const r = pick('at', 'side') as Item & { fr?: PinFriction };
      if (it.fr) r.fr = { f: it.fr.f, r: it.fr.r, rot: it.fr.rot, ...(it.fr.circle ? { circle: true } : {}) };
      return r;
    }
    case 'roller':
      return pick('at', 'side', 'angle', 'angleName', 'oneSided');
    case 'rough':
      return pick('at', 'side', 'angle', 'angleName', 'f', 'k');
    case 'rod':
      return pick('at', 'angle', 'angleName');
    case 'slide':
      return pick('at', 'side', 'angle', 'angleName');
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
const LOADDIRS = ['down', 'up', 'right', 'left', 'nu', 'nd'];
const TYPE_NAMES: Record<string, string> = {
  fixed: 'заделка',
  pin: 'шарнирно-неподвижная опора',
  roller: 'каток',
  rough: 'опора с трением',
  rod: 'опорный стержень',
  slide: 'скользящая заделка',
  force: 'сила',
  weight: 'груз',
  moment: 'пара сил',
  dist: 'распределённая нагрузка',
};


/** Разбор и проверка файла проекта. */
export function parseProject(text: string): ParseResult {
  const env = readEnvelope(text);
  if (!env.ok) return env;
  if (env.module !== FRAMES_MODULE) return { ok: false, errors: [`Это файл другого раздела («${env.module}»), а не «Балки и рамы».`] };
  const raw = env.raw;
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
    if (n.slide !== undefined && !(typeof n.slide === 'number' && Number.isFinite(n.slide))) return errors.push(`Точка «${n.id}»: угол скользящей заделки должен быть числом.`);
    if (n.place !== undefined && !(isObj(n.place) && isStr(n.place.from) && isNum(n.place.dx) && isNum(n.place.dy)))
      return errors.push(`Точка «${n.id}»: место тела задаётся точкой from и смещением dx, dy (числа, м).`);
    nodes.push(cleanNode(n as unknown as Node));
  });
  for (const n of nodes) if (n.place && !nodeIds.has(n.place.from)) errors.push(`Точка «${n.id}»: тело поставлено от несуществующей точки.`);
  if (!nodes.length) errors.push('В конструкции нет ни одной точки.');

  const segs: Seg[] = [];
  const segIds = new Set<string>();
  st.segs.forEach((q, i) => {
    const where = `Участок №${i + 1}`;
    if (!isObj(q) || !isStr(q.id)) return errors.push(`${where}: нет идентификатора.`);
    if (segIds.has(q.id)) return errors.push(`Участок «${q.id}» встречается дважды.`);
    segIds.add(q.id);
    if (!isStr(q.a) || !nodeIds.has(q.a) || !isStr(q.b) || !nodeIds.has(q.b)) return errors.push(`${where}: ссылается на несуществующую точку.`);
    if (!DIRS.includes(q.dir as string) && q.dir !== 'a') return errors.push(`${where}: неизвестное направление «${String(q.dir)}».`);
    if (!isNum(q.len) || q.len <= 0 || q.len > 1000) return errors.push(`${where}: длина должна быть числом от 0 до 1000 м.`);
    if (q.dir === 'a') {
      if (!isNum(q.ang)) return errors.push(`${where}: у наклонного участка должен быть угол ang — число, градусы.`);
      // Угол, кратный 90°, — это участок по оси.
      const ax = axisDir(q.ang);
      segs.push(ax ? { id: q.id, a: q.a, b: q.b, dir: ax, len: q.len } : { id: q.id, a: q.a, b: q.b, dir: 'a', len: q.len, ang: normAng(q.ang) });
      return;
    }
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
        ok = node('at') && oneOf('side', SIDES, 'опорная поверхность');
        break;
      case 'pin':
        ok = node('at') && oneOf('side', SIDES, 'опорная поверхность');
        if (ok && it.fr !== undefined) {
          const fr = it.fr;
          if (!(isObj(fr) && isNum(fr.f) && fr.f >= 0 && isNum(fr.r) && fr.r >= 0 && ROTS.includes(fr.rot as string) && (fr.circle === undefined || typeof fr.circle === 'boolean')))
            ok = !bad('трение в шарнире задаётся коэффициентом f ≥ 0, радиусом r ≥ 0 и направлением rot (cw, ccw).');
        }
        break;
      case 'roller':
        ok = node('at') && oneOf('side', [...SIDES, 'tilt'], 'опорная поверхность') && (it.side !== 'tilt' || num('angle', 'угол'));
        if (ok && it.oneSided !== undefined && typeof it.oneSided !== 'boolean') ok = !bad('признак односторонней связи должен быть true или false.');
        break;
      case 'rough':
        ok = node('at') && oneOf('side', [...SIDES, 'tilt'], 'опорная поверхность') && (it.side !== 'tilt' || num('angle', 'угол')) && num('f', 'коэффициент трения');
        if (ok && ((it.f as number) < 0 || (it.k !== undefined && !(typeof it.k === 'number' && it.k >= 0)))) ok = !bad('коэффициенты трения не могут быть отрицательными.');
        break;
      case 'rod':
        ok = node('at') && num('angle', 'угол');
        break;
      case 'slide':
        ok = node('at') && oneOf('side', [...SIDES, 'tilt'], 'направляющая') && (it.side !== 'tilt' || num('angle', 'угол'));
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

  const links: Link[] = [];
  if (st.links !== undefined && !Array.isArray(st.links)) errors.push('Связи между телами (links) должны быть списком.');
  (Array.isArray(st.links) ? st.links : []).forEach((l, i) => {
    const where = `Связь №${i + 1}`;
    if (!isObj(l) || !isStr(l.id)) return errors.push(`${where}: нет идентификатора.`);
    if (l.type !== 'contact' && l.type !== 'thread' && l.type !== 'hinge')
      return errors.push(`${where}: неизвестный тип «${String(l.type)}» (касание — contact, нить — thread, шарнир — hinge).`);
    const via = l.type === 'thread' && l.via !== undefined ? l.via : [];
    if (!Array.isArray(via) || ![l.a, l.b, ...via].every((x) => isStr(x) && nodeIds.has(x))) return errors.push(`${where}: ссылается на несуществующую точку.`);
    if (l.type === 'contact') {
      if (!isNum(l.angle)) return errors.push(`${where}: у касания должен быть угол нормали angle — число, градусы.`);
      if (!isNum(l.f) || l.f < 0) return errors.push(`${where}: коэффициент трения f — неотрицательное число.`);
      if (l.a === l.b) return errors.push(`${where}: касание соединяет две разные точки.`);
    }
    if (l.type === 'hinge' && l.a === l.b) return errors.push(`${where}: шарнир соединяет две разные точки.`);
    links.push(cleanLink(l as unknown as Link));
  });

  const structure: Structure = { nodes, segs, items };
  if (links.length) structure.links = links;
  if (st.search !== undefined) {
    const sr = st.search;
    const refs = new Set([...nodeIds, ...segIds, ...itemIds, ...links.map((l) => l.id)]);
    if (!isObj(sr) || !isStr(sr.name) || !isNum(sr.min) || !isNum(sr.max) || !['deg', 'm', ''].includes(sr.unit as string) || !Array.isArray(sr.bind))
      errors.push('Поиск положения (search) задаётся обозначением name, единицей unit (deg, m или пусто), границами min, max и списком формул bind.');
    else if (!sr.bind.every((b) => isObj(b) && isStr(b.ref) && refs.has(b.ref) && isStr(b.field) && isStr(b.expr)))
      errors.push('Поиск положения: каждая формула — ссылка ref на элемент схемы, поле field и текст формулы expr.');
    else structure.search = cleanSearch(sr as unknown as Search);
  }
  if (!errors.length) {
    const bodies = nodes.filter((n) => n.place).length + 1;
    if (segs.length !== nodes.length - bodies)
      errors.push(
        bodies > 1
          ? 'Участки каждого тела должны соединять его точки без замкнутых контуров (участков на столько меньше, чем точек, сколько тел).'
          : 'Участки должны соединять все точки в одну раму без замкнутых контуров (участков на один меньше, чем точек).',
      );
    else if (segs.some((q) => nodes.find((n) => n.id === q.b)?.place)) errors.push('Начальная точка отдельного тела не может быть концом участка.');
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
  const links = s.links?.map((l): Link =>
    l.type === 'thread'
      ? { ...l, id: ids.item(), a: nm.get(l.a)!, b: nm.get(l.b)!, ...(l.via ? { via: l.via.map((x) => nm.get(x)!) } : {}) }
      : { ...l, id: ids.item(), a: nm.get(l.a)!, b: nm.get(l.b)! },
  );
  const r: Structure = { nodes: s.nodes.map((n) => cleanNode(n, nm.get(n.id)!, n.place ? nm.get(n.place.from) : undefined)), segs, items };
  if (links?.length) r.links = links;
  if (s.search) {
    // Ссылки формул — на новые идентификаторы точек, участков, элементов и связей.
    const map = new Map<string, string>([...nm, ...s.segs.map((q, i): [string, string] => [q.id, segs[i].id]), ...s.items.map((it, i): [string, string] => [it.id, items[i].id]), ...(s.links ?? []).map((l, i): [string, string] => [l.id, links![i].id])]);
    r.search = { ...s.search, bind: s.search.bind.map((b) => ({ ...b, ref: map.get(b.ref) ?? b.ref })) };
  }
  return r;
}
