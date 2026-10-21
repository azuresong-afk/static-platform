/**
 * Операции редактирования конструкции. Чистые функции: принимают конструкцию и возвращают новую,
 * исходную не меняют. Правила и сообщения — как в прототипе.
 */
import { AXANG, axisDir, normAng, segAngle } from './constants';
import { r3 } from '../../../shared/format';
import { geom, geomOK, resolve, type Geom } from './geometry';
import type { IdGen } from '../../../shared/ids';
import type { Item, ItemType, Link, Seg, SegDir, Side, Structure } from './types';

export type EditResult =
  | { ok: true; s: Structure }
  | { ok: false; reason: 'invalid' | 'overlap' | 'occupied' | 'noop'; msg?: string };

const clone = (s: Structure): Structure => structuredClone(s);

export const MAX_LEN = 1000;
const lenValid = (v: number) => !(isNaN(v) || v <= 0 || v > MAX_LEN);
/** Длина, заданная с точностью до миллиметра (у участков по проекциям длина бывает иррациональной). */
const mmExact = (v: number) => Math.abs(r3(v) - v) < 1e-12;
/** Совпадают ли направления (углы в градусах). */
const sameAng = (a: number, b: number) => Math.abs(normAng(a - b + 180) - 180) < 1e-9;

/** Записать направление участка: угол, кратный 90°, превращается в направление по оси. */
function setDirAng(q: Seg, dir: SegDir, ang?: number) {
  const ax = dir === 'a' ? axisDir(ang ?? 0) : dir;
  if (ax) {
    q.dir = ax;
    delete q.ang;
  } else {
    q.dir = 'a';
    q.ang = normAng(ang ?? 0);
  }
}

/** Поставить новую точку на участке на расстоянии t от его начала. */
export function splitSeg(src: Structure, segId: string, t: number, ids: IdGen): EditResult {
  const s = clone(src);
  const q = s.segs.find((x) => x.id === segId);
  t = r3(t);
  if (!q || t <= 0.0005 || t >= q.len - 0.0005) return { ok: false, reason: 'invalid' };
  const n = { id: ids.node() },
    ns: Seg = { id: ids.seg(), a: n.id, b: q.b, dir: q.dir, len: mmExact(q.len) ? r3(q.len - t) : q.len - t };
  if (q.dir === 'a') ns.ang = q.ang;
  q.b = n.id;
  q.len = t;
  s.nodes.push(n);
  s.segs.splice(s.segs.indexOf(q) + 1, 0, ns);
  return { ok: true, s };
}

/** Убрать участок: его конечный узел сливается с начальным, элементы переезжают туда же. */
export function removeSeg(src: Structure, segId: string): EditResult {
  const s = clone(src);
  const q = s.segs.find((x) => x.id === segId);
  if (!q || s.segs.length < 2) return { ok: false, reason: 'invalid' };
  const a = q.a,
    b = q.b;
  // Направления участков из точек a и b (без убираемого): после слияния совпавшие направления наложатся.
  const raysAt = (id: string) => s.segs.filter((p) => p !== q && (p.a === id || p.b === id)).map((p) => (p.a === id ? segAngle(p) : normAng(segAngle(p) + 180)));
  const aDirs = raysAt(a);
  if (raysAt(b).some((d) => aDirs.some((e) => sameAng(d, e))))
    return { ok: false, reason: 'overlap', msg: 'Этот участок нельзя убрать: соседние участки наложатся друг на друга.' };
  s.segs.forEach((p) => {
    if (p.a === b) p.a = a;
    if (p.b === b) p.b = a;
  });
  s.segs.splice(s.segs.indexOf(q), 1);
  // Узел b слит с a — убираем его до проверки геометрии. (В прототипе проверка шла раньше,
  // недостижимый узел ломал её, и участок нельзя было убрать никогда — баг №7.)
  s.nodes = s.nodes.filter((n) => n.id !== b);
  // Тела, поставленные от точки b, переходят в точку a (до проверки геометрии — иначе они «потеряются»).
  s.nodes.forEach((n) => {
    if (n.place?.from === b) n.place = { ...n.place, from: a };
  });
  if (!geomOK(s)) return { ok: false, reason: 'overlap', msg: 'Этот участок нельзя убрать: участки пересекутся.' };
  s.items.forEach((it) => {
    if (it.type === 'dist') {
      if (it.from === b) it.from = a;
      if (it.to === b) it.to = a;
    } else if (it.at === b) it.at = a;
  });
  s.items = s.items.filter((it) => !(it.type === 'dist' && it.from === it.to));
  // Связи в точке b переходят в точку a.
  if (s.links) {
    const re = (id: string) => (id === b ? a : id);
    s.links = s.links
      .map((l) => (l.type === 'thread' ? { ...l, a: re(l.a), b: re(l.b), via: l.via?.map(re) } : { ...l, a: re(l.a), b: re(l.b) }))
      .filter((l) => (l.type === 'thread' ? [l.a, ...(l.via ?? []), l.b].every((id, i, arr) => i === 0 || id !== arr[i - 1]) : l.a !== l.b));
  }
  return { ok: true, s };
}

/** Новый участок из точки from в направлении dir (для наклонного — под углом ang к оси x). */
export function addSeg(src: Structure, from: string, dir: SegDir, len: number, ids: IdGen, ang?: number): EditResult {
  if (!lenValid(len)) return { ok: false, reason: 'invalid', msg: 'Длина должна быть больше нуля.' };
  if (dir === 'a' && !Number.isFinite(ang)) return { ok: false, reason: 'invalid', msg: 'Укажите угол наклона участка.' };
  return pushSeg(src, from, dir, r3(len), ids, ang);
}

/** Новый участок из точки from по проекциям на оси: dx вправо, dy вверх (со знаком). */
export function addSegXY(src: Structure, from: string, dx: number, dy: number, ids: IdGen): EditResult {
  dx = r3(dx);
  dy = r3(dy);
  const len = Math.hypot(dx, dy);
  if (!(len > 0) || len > MAX_LEN) return { ok: false, reason: 'invalid', msg: 'Длина должна быть больше нуля.' };
  if (!dy) return pushSeg(src, from, dx > 0 ? 'r' : 'l', Math.abs(dx), ids);
  if (!dx) return pushSeg(src, from, dy > 0 ? 'u' : 'd', Math.abs(dy), ids);
  return pushSeg(src, from, 'a', len, ids, (Math.atan2(dy, dx) * 180) / Math.PI);
}

function pushSeg(src: Structure, from: string, dir: SegDir, len: number, ids: IdGen, ang?: number): EditResult {
  const q: Seg = { id: '', a: from, b: '', dir, len };
  setDirAng(q, dir, ang);
  const g = geom(src);
  if (g.rays[from] && g.rays[from].some((d) => sameAng(d, segAngle(q))))
    return { ok: false, reason: 'occupied', msg: 'Из этой точки в этом направлении уже идёт участок.' };
  const s = clone(src);
  const n = { id: ids.node() };
  s.nodes.push(n);
  s.segs.push({ ...q, id: ids.seg(), b: n.id });
  if (!geomOK(s)) return { ok: false, reason: 'overlap', msg: 'Новый участок пересёк бы существующие.' };
  return { ok: true, s };
}

/** Изменить длину участка. */
export function setSegLen(src: Structure, segId: string, v: number): EditResult {
  const q0 = src.segs.find((x) => x.id === segId);
  if (!q0 || !lenValid(v)) return { ok: false, reason: 'invalid' };
  if (Math.abs(v - q0.len) < 1e-9) return { ok: false, reason: 'noop' };
  const s = clone(src);
  s.segs.find((x) => x.id === segId)!.len = r3(v);
  if (!geomOK(s)) return { ok: false, reason: 'overlap', msg: 'При такой длине участки пересекаются.' };
  return { ok: true, s };
}

/** Изменить направление участка (для наклонного — угол к оси x, град). */
export function setSegDir(src: Structure, segId: string, dir: SegDir, ang?: number): EditResult {
  const s = clone(src);
  const q = s.segs.find((x) => x.id === segId);
  if (!q) return { ok: false, reason: 'invalid' };
  if (dir === 'a' && !Number.isFinite(ang)) return { ok: false, reason: 'invalid' };
  setDirAng(q, dir, ang);
  if (!geomOK(s)) return { ok: false, reason: 'overlap', msg: 'В этом направлении участок наложится на другой.' };
  return { ok: true, s };
}

/** Изменить угол наклонного участка к оси x, град (угол, кратный 90°, делает участок осевым). */
export function setSegAng(src: Structure, segId: string, ang: number): EditResult {
  const q0 = src.segs.find((x) => x.id === segId);
  if (!q0 || !Number.isFinite(ang)) return { ok: false, reason: 'invalid' };
  if (q0.dir === 'a' && sameAng(q0.ang ?? 0, ang)) return { ok: false, reason: 'noop' };
  return setSegDir(src, segId, 'a', ang);
}

/** Угол наклона по умолчанию при переходе от направления по оси к наклонному: на 30° против часовой. */
export const defaultTilt = (q: Pick<Seg, 'dir' | 'ang'>): number => normAng((q.dir === 'a' ? (q.ang ?? 0) : AXANG[q.dir]) + 30);

/* ---------- значения по умолчанию для новых элементов ---------- */

/** Где опорная поверхность (стена) относительно точки: направление от точки к ней, град. */
const WALL: [Side, number][] = [
  ['below', 270],
  ['left', 180],
  ['right', 0],
  ['above', 90],
];
/** Угловое расстояние между направлениями, 0…180°. */
const angDist = (a: number, b: number) => Math.abs(normAng(a - b + 180) - 180);

/** Сторона опорной поверхности, свободная от участков (наклонный участок занимает сторону в пределах 25°). */
export function pinSide(g: Geom, id: string): Side {
  const r = g.rays[id] ?? [];
  return (WALL.find(([, w]) => r.every((d) => angDist(d, w) > 25)) ?? WALL[3])[0];
}

/** Для скользящей заделки на конце участка — направляющая вдоль участка (втулка), реакция поперёк него. */
export function slideSide(g: Geom, id: string): Side {
  const r = g.rays[id] ?? [];
  if (r.length === 1) {
    const n = normAng(r[0] + 90);
    return WALL.reduce((b, w) => (Math.min(angDist(n, w[1]), angDist(normAng(n + 180), w[1])) < Math.min(angDist(n, b[1]), angDist(normAng(n + 180), b[1])) - 1e-9 ? w : b))[0];
  }
  return pinSide(g, id);
}

/** Для заделки на конце участка — стена с противоположной стороны. */
export function fixedSide(g: Geom, id: string): Side {
  const r = g.rays[id] ?? [];
  if (r.length === 1) {
    const back = normAng(r[0] + 180);
    return WALL.reduce((b, w) => (angDist(back, w[1]) < angDist(back, b[1]) - 1e-9 ? w : b))[0];
  }
  return pinSide(g, id);
}

type NewItem<T extends ItemType> = Omit<Extract<Item, { type: T }>, 'id' | 'type'>;

/** Параметры нового элемента по умолчанию (как defaults() в прототипе). */
export function defaults<T extends ItemType>(s: Structure, type: T): NewItem<T> {
  const { g } = resolve(s);
  const o = g.order,
    first = o[0],
    last = o[o.length - 1],
    mid = o[Math.floor((o.length - 1) / 2)];
  const r = ((): object => {
    switch (type) {
      case 'fixed':
        return { at: first, side: fixedSide(g, first) };
      case 'pin':
        return { at: first, side: pinSide(g, first) };
      case 'roller':
        return { at: last, side: pinSide(g, last), angle: 90 };
      case 'rod':
        return { at: last, angle: 90 };
      case 'slide':
        return { at: first, side: slideSide(g, first), angle: 90 };
      case 'rough':
        return { at: first, side: pinSide(g, first), angle: 90, f: 0.3, k: 0 };
      case 'force':
        return { at: mid, F: 10, ref: 'down', rot: 'cw', alpha: 0, unknown: false };
      case 'weight':
        return { at: mid, G: 5 };
      case 'moment':
        return { at: mid, M: 8, dir: 'ccw', unknown: false };
      case 'dist': {
        let best = s.segs[0];
        s.segs.forEach((q) => {
          const h = q.dir === 'r' || q.dir === 'l',
            bh = best.dir === 'r' || best.dir === 'l';
          if ((h && !bh) || (h === bh && q.len > best.len)) best = q;
        });
        const h = best.dir === 'r' || best.dir === 'l';
        return { from: best.a, to: best.b, q1: 2, q2: 2, dir: h || best.dir === 'a' ? 'down' : 'right' };
      }
    }
    throw new Error('Неизвестный тип элемента: ' + type);
  })();
  return r as NewItem<T>;
}

/**
 * Добавить элемент с параметрами по умолчанию. Если на балке только две точки,
 * а добавляется сосредоточенная нагрузка, сначала ставится точка посередине — как в прототипе.
 */
export function addItem(src: Structure, type: ItemType, ids: IdGen): { s: Structure; id: string } {
  let s = src;
  if ((type === 'force' || type === 'weight' || type === 'moment') && s.nodes.length === 2) {
    const r = splitSeg(s, s.segs[0].id, s.segs[0].len / 2, ids);
    if (r.ok) s = r.s;
  }
  const id = ids.item();
  const it = { id, type, ...defaults(s, type) } as Item;
  return { s: { ...s, items: [...s.items, it] }, id };
}

/* ---------- отдельные тела и связи между ними ---------- */

/**
 * Новое тело: его начальная точка смещена от точки from на (dx, dy). При нулевом смещении тело касается тела
 * точки from — сразу ставится касание (давление на новое тело — вверх, поверхность гладкая).
 */
export function addBody(src: Structure, from: string, dx: number, dy: number, ids: IdGen): EditResult & { id?: string } {
  dx = r3(dx);
  dy = r3(dy);
  if (!src.nodes.some((n) => n.id === from) || !Number.isFinite(dx) || !Number.isFinite(dy) || Math.hypot(dx, dy) > MAX_LEN)
    return { ok: false, reason: 'invalid', msg: 'Укажите точку и смещение нового тела (не больше 1000 м).' };
  const s = clone(src);
  const id = ids.node();
  s.nodes.push({ id, place: { from, dx, dy } });
  if (!dx && !dy) s.links = [...(s.links ?? []), { id: ids.item(), type: 'contact', a: from, b: id, angle: 90, f: 0 }];
  return { ok: true, s, id };
}

/** Точки тела с начальной точкой root и всех тел, поставленных от его точек. */
function bodyNodes(s: Structure, root: string): Set<string> {
  const set = new Set([root]);
  for (let more = true; more; ) {
    more = false;
    for (const q of s.segs)
      if (set.has(q.a) && !set.has(q.b)) {
        set.add(q.b);
        more = true;
      }
    for (const n of s.nodes)
      if (n.place && set.has(n.place.from) && !set.has(n.id)) {
        set.add(n.id);
        more = true;
      }
  }
  return set;
}

/** Убрать отдельное тело (и тела, поставленные от него) вместе с его участками, нагрузками, опорами и связями. */
export function removeBody(src: Structure, root: string): EditResult {
  const n0 = src.nodes.find((n) => n.id === root);
  if (!n0?.place) return { ok: false, reason: 'invalid' };
  const s = clone(src);
  const gone = bodyNodes(s, root);
  s.nodes = s.nodes.filter((n) => !gone.has(n.id));
  s.segs = s.segs.filter((q) => !gone.has(q.a));
  s.items = s.items.filter((it) => (it.type === 'dist' ? !gone.has(it.from) && !gone.has(it.to) : !gone.has(it.at)));
  if (s.links) s.links = s.links.filter((l) => ![l.a, l.b, ...(l.type === 'thread' ? (l.via ?? []) : [])].some((id) => gone.has(id)));
  return { ok: true, s };
}

/** Тело (номер дерева) каждой точки — по участкам и местам тел, без координат. */
function bodyOf(s: Structure): Record<string, string> {
  const out: Record<string, string> = {};
  const roots = s.nodes.filter((n) => n.place || !s.segs.some((q) => q.b === n.id));
  for (const r of roots) {
    const set = new Set([r.id]);
    for (let more = true; more; ) {
      more = false;
      for (const q of s.segs)
        if (set.has(q.a) && !set.has(q.b)) {
          set.add(q.b);
          more = true;
        }
    }
    set.forEach((id) => (out[id] = r.id));
  }
  return out;
}

/**
 * Новая связь. Касание — в первой паре совпадающих точек разных тел, где его ещё нет; нить — между первыми точками
 * двух разных тел.
 */
export function addLink(src: Structure, type: Link['type'], ids: IdGen): EditResult & { id?: string } {
  const s = clone(src);
  const g = geom(s);
  const body = bodyOf(s);
  const order = g.order;
  const links = s.links ?? [];
  const id = ids.item();
  if (type === 'contact' || type === 'hinge') {
    for (let i = 0; i < order.length; i++)
      for (let j = i + 1; j < order.length; j++) {
        const [a, b] = [order[i], order[j]];
        if (body[a] === body[b]) continue;
        if (Math.hypot(g.pos[a][0] - g.pos[b][0], g.pos[a][1] - g.pos[b][1]) > 1e-6) continue;
        if (links.some((l) => l.type !== 'thread' && ((l.a === a && l.b === b) || (l.a === b && l.b === a)))) continue;
        s.links = [...links, type === 'hinge' ? { id, type, a, b } : { id, type: 'contact', a, b, angle: 90, f: 0 }];
        return { ok: true, s, id };
      }
    return {
      ok: false,
      reason: 'invalid',
      msg: `${type === 'hinge' ? 'Шарнир' : 'Касание'} между телами ставится в точке, где совпадают точки двух тел: добавьте тело от этой точки со смещением 0.`,
    };
  }
  const a = order[0],
    b = order.find((x) => body[x] !== body[a]);
  if (!b) return { ok: false, reason: 'invalid', msg: 'Нить соединяет точки двух тел: сначала добавьте второе тело.' };
  s.links = [...links, { id, type: 'thread', a, b }];
  return { ok: true, s, id };
}

/** Изменить связь (точки, угол нормали, коэффициент трения, блоки). */
export function patchLink(src: Structure, id: string, patch: Partial<Link>): EditResult {
  const s = clone(src);
  const l = s.links?.find((x) => x.id === id);
  if (!l) return { ok: false, reason: 'invalid' };
  Object.assign(l, patch);
  if (l.type !== 'thread' && l.a === l.b) return { ok: false, reason: 'invalid', msg: 'Связь соединяет точки двух разных тел.' };
  if (l.type === 'thread' && l.via) l.via = l.via.filter((x) => x !== l.a && x !== l.b);
  return { ok: true, s };
}

export function removeLink(src: Structure, id: string): EditResult {
  if (!src.links?.some((l) => l.id === id)) return { ok: false, reason: 'invalid' };
  const s = clone(src);
  s.links = s.links!.filter((l) => l.id !== id);
  return { ok: true, s };
}

/** Сдвинуть отдельное тело: новое смещение начальной точки от точки from. */
export function setBodyPlace(src: Structure, root: string, dx: number, dy: number): EditResult {
  const s = clone(src);
  const n = s.nodes.find((x) => x.id === root);
  if (!n?.place || !Number.isFinite(dx) || !Number.isFinite(dy)) return { ok: false, reason: 'invalid' };
  n.place = { ...n.place, dx: r3(dx), dy: r3(dy) };
  return { ok: true, s };
}
