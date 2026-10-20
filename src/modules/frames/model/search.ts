/**
 * Поиск положения равновесия: поля конструкции, которые можно задать формулой от параметра положения, разбор формул
 * и конструкция при заданном значении параметра.
 *
 * Формулы — как в других разделах (src/shared/expr.ts): числа, + − * / ^, скобки, sin, cos, tg, arctg, sqrt…
 * Параметр обозначается своей буквой (φ, α, h…). Тригонометрия в формулах — в градусах, каким бы ни был параметр:
 * sin 30 = 0,5, arctg 1 = 45, — так же, как углы во всех полях раздела.
 */
import { parseExpr, evalExpr, type Expr } from '../../../shared/expr';
import { normAng } from './constants';
import { resolve } from './geometry';
import type { Item, Link, Search, SearchBind, Structure } from './types';

/** Поле, которое можно задать формулой: ссылка, имя поля, подпись для списка и единица. */
export interface FieldInfo {
  ref: string;
  field: string;
  label: string;
  unit: string;
}

const TYPE: Record<string, string> = {
  roller: 'Каток',
  rough: 'Опора с трением',
  slide: 'Скользящая заделка',
  rod: 'Опорный стержень',
  force: 'Сила',
  weight: 'Груз',
  moment: 'Пара сил',
  dist: 'Нагрузка',
};

/** Какие поля элемента можно задать формулой. */
export function itemFields(it: Item): [string, string, string][] {
  switch (it.type) {
    case 'roller':
    case 'slide':
      return [['angle', 'угол реакции', '°']];
    case 'rough':
      return [
        ['angle', 'угол нормали', '°'],
        ['f', 'коэффициент трения', ''],
      ];
    case 'rod':
      return [['angle', 'угол стержня', '°']];
    case 'force':
      return [
        ['F', 'модуль', 'кН'],
        ['alpha', 'угол', '°'],
      ];
    case 'weight':
      return [['G', 'вес', 'кН']];
    case 'moment':
      return [['M', 'момент', 'кН·м']];
    case 'dist':
      return [
        ['q1', 'q в начале', 'кН/м'],
        ['q2', 'q в конце', 'кН/м'],
      ];
    default:
      return [];
  }
}

/** Все поля конструкции, которые можно задать формулой от параметра (для списка в конфигураторе). */
export function searchFields(s: Structure): FieldInfo[] {
  const { g } = resolve(s);
  const nm = (id: string) => g.name[id] ?? '?';
  const out: FieldInfo[] = [];
  for (const q of s.segs) {
    const AB = nm(q.a) + nm(q.b);
    out.push({ ref: q.id, field: 'len', label: `Участок ${AB}: длина`, unit: 'м' });
    out.push({ ref: q.id, field: 'ang', label: `Участок ${AB}: угол к оси x`, unit: '°' });
  }
  for (const n of s.nodes)
    if (n.place) {
      out.push({ ref: n.id, field: 'dx', label: `Тело ${nm(n.id)}: смещение по x от ${nm(n.place.from)}`, unit: 'м' });
      out.push({ ref: n.id, field: 'dy', label: `Тело ${nm(n.id)}: смещение по y от ${nm(n.place.from)}`, unit: 'м' });
    }
  for (const it of s.items) {
    const where = it.type === 'dist' ? `${nm(it.from)}–${nm(it.to)}` : nm(it.at);
    for (const [field, what, unit] of itemFields(it)) out.push({ ref: it.id, field, label: `${TYPE[it.type]} ${where}: ${what}`, unit });
  }
  for (const l of s.links ?? [])
    if (l.type === 'contact') {
      out.push({ ref: l.id, field: 'angle', label: `Касание ${nm(l.a)}–${nm(l.b)}: угол нормали`, unit: '°' });
      out.push({ ref: l.id, field: 'f', label: `Касание ${nm(l.a)}–${nm(l.b)}: коэффициент трения`, unit: '' });
    }
  return out;
}

/** Допустимое обозначение параметра: 1–3 буквы, не t (в формулах t — время) и не имя функции. */
export function searchNameOK(name: string): boolean {
  if (!/^[a-zа-яёα-ωΑ-Ω]{1,3}$/i.test(name) || name.toLowerCase() === 't') return false;
  return !/^(sin|cos|tg|tan|ctg|cot|exp|abs|ln|sh|ch|th|pi|e)$/i.test(name);
}

const DEG = Math.PI / 180;
/** Тригонометрия в градусах: аргумент sin, cos, tg, ctg — в градусах, обратные функции дают градусы. */
function degTrig(e: Expr): Expr {
  switch (e.k) {
    case 'num':
    case 't':
    case 'var':
      return e;
    case 'neg':
      return { k: 'neg', a: degTrig(e.a) };
    case 'fn': {
      const a = degTrig(e.a);
      if (e.f === 'sin' || e.f === 'cos' || e.f === 'tg' || e.f === 'ctg') return { k: 'fn', f: e.f, a: { k: 'mul', a, b: { k: 'num', v: DEG } } };
      if (e.f === 'arcsin' || e.f === 'arccos' || e.f === 'arctg') return { k: 'div', a: { k: 'fn', f: e.f, a }, b: { k: 'num', v: DEG } };
      return { k: 'fn', f: e.f, a };
    }
    default:
      return { ...e, a: degTrig(e.a), b: degTrig(e.b) };
  }
}

export interface CompiledBind {
  bind: SearchBind;
  at: (p: number) => number;
}
export type CompileResult = { ok: true; fns: CompiledBind[] } | { ok: false; errors: string[] };

/** Разбор формул поиска. Обозначение параметра в формулах — его буква; неизвестные поля и плохие формулы — ошибки. */
export function compileSearch(s: Structure, sr: Search = s.search!): CompileResult {
  const errors: string[] = [];
  if (!searchNameOK(sr.name)) errors.push(`Обозначение параметра «${sr.name}» не подходит: нужны 1–3 буквы, кроме t.`);
  if (!(Number.isFinite(sr.min) && Number.isFinite(sr.max) && sr.max > sr.min)) errors.push('Промежуток поиска: «от» должно быть меньше «до».');
  // Латинское обозначение — переменная формул; иное (греческая буква) подставляем как «ж» (её нет среди функций).
  const latin = /^[a-z]+$/i.test(sr.name);
  const varName = latin ? sr.name.toLowerCase() : 'ж';
  const fields = new Set(searchFields(s).map((f) => f.ref + ':' + f.field));
  const fns: CompiledBind[] = [];
  sr.bind.forEach((b, i) => {
    const where = `Формула №${i + 1}`;
    if (!fields.has(b.ref + ':' + b.field)) return errors.push(`${where}: такого поля в схеме нет.`);
    const src = latin ? b.expr : b.expr.split(sr.name).join(' ж ');
    const r = parseExpr(src, { vars: [varName] });
    if (!r.ok) return errors.push(`${where}: ${r.error}.`);
    const e = degTrig(r.e);
    fns.push({ bind: b, at: (p) => evalExpr(e, 0, { [varName]: p }) });
  });
  if (!errors.length && sr.bind.length && !fns.length) errors.push('Нет ни одной формулы от параметра.');
  return errors.length ? { ok: false, errors } : { ok: true, fns };
}

/** Конструкция при значении параметра p: поля из формул. null — значение поля недопустимо (длина ≤ 0, не число). */
export function instantiate(s: Structure, fns: CompiledBind[], p: number): Structure | null {
  const nodes = s.nodes.map((n) => (n.place ? { ...n, place: { ...n.place } } : n));
  const segs = s.segs.map((q) => ({ ...q }));
  const items = s.items.map((it) => ({ ...it })) as Item[];
  const links = s.links?.map((l) => ({ ...l })) as Link[] | undefined;
  for (const { bind: b, at } of fns) {
    const v = at(p);
    if (!Number.isFinite(v)) return null;
    const q = segs.find((x) => x.id === b.ref);
    if (q) {
      if (b.field === 'len') {
        if (!(v > 1e-9)) return null;
        q.len = v;
      } else {
        q.dir = 'a';
        q.ang = normAng(v);
      }
      continue;
    }
    const n = nodes.find((x) => x.id === b.ref);
    if (n?.place) {
      n.place[b.field as 'dx' | 'dy'] = v;
      continue;
    }
    const it = items.find((x) => x.id === b.ref) as (Item & Record<string, unknown>) | undefined;
    if (it) {
      if (b.field === 'angle') {
        if ('side' in it) it.side = 'tilt';
        it.angle = normAng(v);
      } else if ((b.field === 'f' || b.field === 'k') && v < 0) return null;
      else it[b.field] = v;
      continue;
    }
    const l = links?.find((x) => x.id === b.ref);
    if (l && l.type === 'contact') {
      if (b.field === 'angle') l.angle = normAng(v);
      else if (v < 0) return null;
      else l.f = v;
    }
  }
  const r: Structure = { nodes, segs, items };
  if (links) r.links = links;
  if (s.search) r.search = s.search;
  return r;
}
