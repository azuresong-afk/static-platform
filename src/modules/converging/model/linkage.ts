/**
 * Плоская система тел на шарнирах (пункт 26): многоузловые шарнирные системы и механизмы в равновесии.
 *
 * Точки задаются координатами; тело — список точек (жёсткое звено, «A-C-E»); точка, общая для нескольких тел или
 * с опорой, — шарнир (палец): у него свои уравнения равновесия, сила, приложенная в такой точке, действует на палец.
 * Тело из двух точек без сил на нём — стержень: одно неизвестное усилие S (растяжение «+»), как в методе вырезания
 * узлов. Опора: шарнирно-неподвижная (X, Y) или ползун/каток — реакция по заданной линии (угол нормали), с трением
 * в предельном равновесии линия отклоняется от нормали на угол трения (f со знаком: «+» — против часовой стрелки).
 * Силы известные или с неизвестным модулем (направление известно) — так ищется уравновешивающая сила механизма.
 *
 * Уравнения: три для каждого тела (кроме стержней), два для каждого шарнира. Решение — по рангу: система
 * совместна и неизвестные определяются однозначно; иначе — механизм не в равновесии (нужна неизвестная сила)
 * или неизвестные не определяются (статическая неопределимость, лишние неизвестные).
 */
import { gauss } from '../../../shared/gauss';
import { rankOf } from '../../../shared/rank';

export interface LkPoint {
  name: string;
  x: number;
  y: number;
}
export interface LkSupport {
  at: string;
  kind: 'pin' | 'slider';
  /** Ползун: угол нормали к оси x, град. */
  ang: number;
  /** Коэффициент трения со знаком (0 — гладкая). */
  f: number;
}
export interface LkLoad {
  at: string;
  name: string;
  /** NaN — модуль неизвестен. */
  F: number;
  ang: number;
}
export interface Linkage {
  points: LkPoint[];
  bodies: string[][];
  supports: LkSupport[];
  loads: LkLoad[];
}

const NAME = /^[A-Za-zА-Яа-я][A-Za-zА-Яа-я0-9′']*$/;
const num = (s: string) => Number(s.replace(',', '.'));
const items = (s: string) =>
  s
    .split(/[;\n]/)
    .map((x) => x.trim())
    .filter(Boolean);

/** Разбор полей: «A 0 0; B 3 2», «A-B B-C», «A; K 90 0,1», «B R ? 240». */
export function parseLinkage(pts: string, bodies: string, sups: string, loads: string): { ok: true; lk: Linkage } | { ok: false; errors: string[] } {
  const e: string[] = [];
  const points: LkPoint[] = [];
  for (const it of items(pts)) {
    const t = it.split(/\s+/);
    if (t.length !== 3 || !NAME.test(t[0]) || !Number.isFinite(num(t[1])) || !Number.isFinite(num(t[2]))) e.push(`Точка «${it}»: нужно «имя x y».`);
    else if (points.some((p) => p.name === t[0])) e.push(`Точка ${t[0]} задана дважды.`);
    else points.push({ name: t[0], x: num(t[1]), y: num(t[2]) });
  }
  const has = (n: string) => points.some((p) => p.name === n);
  const bl: string[][] = [];
  for (const it of bodies.split(/[\s;,]+/).filter(Boolean)) {
    const ns = it.split('-').filter(Boolean);
    if (ns.length < 2) e.push(`Тело «${it}»: нужно не меньше двух точек через «-».`);
    else if (ns.some((n) => !has(n))) e.push(`Тело «${it}»: нет точки ${ns.find((n) => !has(n))}.`);
    else if (new Set(ns).size !== ns.length) e.push(`Тело «${it}»: точка повторяется.`);
    else bl.push(ns);
  }
  const supports: LkSupport[] = [];
  for (const it of items(sups)) {
    const t = it.split(/\s+/);
    if (!has(t[0])) e.push(`Опора «${it}»: нет точки ${t[0]}.`);
    else if (t.length === 1) supports.push({ at: t[0], kind: 'pin', ang: 0, f: 0 });
    else if ((t.length === 2 || t.length === 3) && t.slice(1).every((x) => Number.isFinite(num(x))))
      supports.push({ at: t[0], kind: 'slider', ang: num(t[1]), f: t.length === 3 ? num(t[2]) : 0 });
    else e.push(`Опора «${it}»: нужно «точка» (шарнир) или «точка угол [f]» (ползун).`);
  }
  if (new Set(supports.map((s) => s.at)).size !== supports.length) e.push('В одной точке — не больше одной опоры.');
  const ld: LkLoad[] = [];
  for (const it of items(loads)) {
    const t = it.split(/\s+/);
    const named = t.length === 4;
    const [at, name, F, a] = named ? t : [t[0], '', t[1], t[2]];
    if ((t.length !== 3 && !named) || !has(at) || (F !== '?' && !Number.isFinite(num(F))) || !Number.isFinite(num(a ?? '')))
      e.push(`Сила «${it}»: нужно «точка [имя] модуль угол», неизвестный модуль — «?».`);
    else ld.push({ at, name: name || `F${ld.length + 1}`, F: F === '?' ? NaN : num(F), ang: num(a) });
  }
  if (!points.length) e.push('Нет точек.');
  if (!bl.length) e.push('Нет тел.');
  for (const p of points) if (!bl.some((b) => b.includes(p.name))) e.push(`Точка ${p.name} не входит ни в одно тело.`);
  return e.length ? { ok: false, errors: e } : { ok: true, lk: { points, bodies: bl, supports, loads: ld } };
}

export interface LkUnknown {
  /** Обозначение для текста: S_AB, X_A, Y_A, N_K, R. */
  name: string;
  kind: 'bar' | 'pin' | 'sup' | 'load';
}
export interface LkEquation {
  /** Что уравновешиваем: «тело A-C-E: ΣX», «шарнир B: ΣY». */
  what: string;
  a: number[];
  /** Свободный член (известные силы), уравнение: a·x + c = 0. */
  c: number;
}
export interface LinkageResult {
  status: 'ok' | 'mechanism' | 'indeterminate';
  unknowns: LkUnknown[];
  eqs: LkEquation[];
  x: number[];
  rank: number;
  /** Значения по именам (для сверки с книгой): S_AB, X_A, Y_A, R_A (модуль реакции), N_K, имена неизвестных сил. */
  vals: Record<string, number>;
  bars: { body: number; name: string; S: number }[];
  pins: string[];
}

const rad = (a: number) => (a * Math.PI) / 180;
const bodyName = (b: string[]) => b.join('-');

export function solveLinkage(lk: Linkage): LinkageResult {
  const P = new Map(lk.points.map((p) => [p.name, p]));
  const loadAt = (n: string) => lk.loads.filter((l) => l.at === n);
  const bodiesAt = (n: string) => lk.bodies.map((b, i) => (b.includes(n) ? i : -1)).filter((i) => i >= 0);
  const supAt = (n: string) => lk.supports.find((s) => s.at === n);
  const shared = (n: string) => bodiesAt(n).length >= 2;
  // Стержень: две точки, каждая — общая с другим телом или опорная (силы в них действуют на палец, не на стержень).
  const isBar = (b: string[]) => b.length === 2 && b.every((n) => shared(n) || !!supAt(n));
  // Шарнир-палец: общая точка или опора стержня. Опора единственного тела (не стержня) действует прямо на тело.
  const pins = lk.points.map((p) => p.name).filter((n) => shared(n) || (!!supAt(n) && bodiesAt(n).some((i) => isBar(lk.bodies[i]))));
  const isPin = (n: string) => pins.includes(n);

  const unknowns: LkUnknown[] = [];
  const idx = new Map<string, number>();
  const add = (key: string, name: string, kind: LkUnknown['kind']) => {
    idx.set(key, unknowns.length);
    unknowns.push({ name, kind });
  };
  lk.bodies.forEach((b, i) => {
    if (isBar(b)) add(`bar:${i}`, `S_${b.join('')}`, 'bar');
  });
  for (const n of pins) {
    const bs = bodiesAt(n).filter((i) => !isBar(lk.bodies[i]));
    const s = supAt(n);
    for (const i of bs) {
      // Сила пальца на тело; если тело одно и опоры нет — просто X_A, Y_A, иначе с именем тела.
      const tag = bs.length > 1 || s ? `(${bodyName(lk.bodies[i])})` : '';
      add(`pin:${n}:${i}:x`, `X_${n}${tag}`, 'pin');
      add(`pin:${n}:${i}:y`, `Y_${n}${tag}`, 'pin');
    }
  }
  for (const s of lk.supports) {
    const n = s.at;
    if (s.kind === 'pin') {
      add(`sup:${n}:x`, `X_${n}`, 'sup');
      add(`sup:${n}:y`, `Y_${n}`, 'sup');
    } else add(`sup:${n}`, `N_${n}`, 'sup');
  }
  lk.loads.forEach((l, k) => {
    if (Number.isNaN(l.F)) add(`load:${k}`, l.name, 'load');
  });

  const nU = unknowns.length;
  const eqs: LkEquation[] = [];
  const row = () => new Array<number>(nU).fill(0);
  const loadVec = (l: LkLoad): [number, number] => [Math.cos(rad(l.ang)), Math.sin(rad(l.ang))];
  // Тела (кроме стержней): ΣX, ΣY, ΣM относительно первой точки тела.
  lk.bodies.forEach((b, i) => {
    if (isBar(b)) return;
    const O = P.get(b[0])!;
    const ex = row(),
      ey = row(),
      em = row();
    let cx = 0,
      cy = 0,
      cm = 0;
    for (const n of b) {
      const Q = P.get(n)!;
      const dx = Q.x - O.x,
        dy = Q.y - O.y;
      if (isPin(n)) {
        const jx = idx.get(`pin:${n}:${i}:x`)!,
          jy = idx.get(`pin:${n}:${i}:y`)!;
        ex[jx] += 1;
        ey[jy] += 1;
        em[jx] += -dy;
        em[jy] += dx;
      } else {
        const sp = supAt(n);
        if (sp?.kind === 'pin') {
          const jx = idx.get(`sup:${n}:x`)!,
            jy = idx.get(`sup:${n}:y`)!;
          ex[jx] += 1;
          ey[jy] += 1;
          em[jx] += -dy;
          em[jy] += dx;
        } else if (sp) {
          const a = rad(sp.ang) + Math.atan(sp.f);
          const j = idx.get(`sup:${n}`)!;
          ex[j] += Math.cos(a);
          ey[j] += Math.sin(a);
          em[j] += dx * Math.sin(a) - dy * Math.cos(a);
        }
        for (const l of loadAt(n)) {
          const [ux, uy] = loadVec(l);
          const k = lk.loads.indexOf(l);
          if (Number.isNaN(l.F)) {
            const j = idx.get(`load:${k}`)!;
            ex[j] += ux;
            ey[j] += uy;
            em[j] += dx * uy - dy * ux;
          } else {
            cx += l.F * ux;
            cy += l.F * uy;
            cm += l.F * (dx * uy - dy * ux);
          }
        }
      }
    }
    const nm = bodyName(b);
    eqs.push({ what: `тело ${nm}: ΣX`, a: ex, c: cx }, { what: `тело ${nm}: ΣY`, a: ey, c: cy }, { what: `тело ${nm}: ΣM_${b[0]}`, a: em, c: cm });
  });
  // Шарниры: силы от тел (−), от стержней, реакция опоры, приложенные силы.
  for (const n of pins) {
    const ex = row(),
      ey = row();
    let cx = 0,
      cy = 0;
    const Q = P.get(n)!;
    for (const i of bodiesAt(n)) {
      const b = lk.bodies[i];
      if (isBar(b)) {
        const o = P.get(b[0] === n ? b[1] : b[0])!;
        const L = Math.hypot(o.x - Q.x, o.y - Q.y);
        const j = idx.get(`bar:${i}`)!;
        ex[j] += (o.x - Q.x) / L;
        ey[j] += (o.y - Q.y) / L;
      } else {
        ex[idx.get(`pin:${n}:${i}:x`)!] -= 1;
        ey[idx.get(`pin:${n}:${i}:y`)!] -= 1;
      }
    }
    const s = supAt(n);
    if (s?.kind === 'pin') {
      ex[idx.get(`sup:${n}:x`)!] += 1;
      ey[idx.get(`sup:${n}:y`)!] += 1;
    } else if (s) {
      const a = rad(s.ang) + Math.atan(s.f);
      const j = idx.get(`sup:${n}`)!;
      ex[j] += Math.cos(a);
      ey[j] += Math.sin(a);
    }
    for (const l of loadAt(n)) {
      const [ux, uy] = loadVec(l);
      const k = lk.loads.indexOf(l);
      if (Number.isNaN(l.F)) {
        const j = idx.get(`load:${k}`)!;
        ex[j] += ux;
        ey[j] += uy;
      } else {
        cx += l.F * ux;
        cy += l.F * uy;
      }
    }
    eqs.push({ what: `шарнир ${n}: ΣX`, a: ex, c: cx }, { what: `шарнир ${n}: ΣY`, a: ey, c: cy });
  }
  // Масштаб уравнений моментов не влияет на решение, но влияет на допуск ранга: нормируем строки.
  const A = eqs.map((q) => q.a),
    rhs = eqs.map((q) => -q.c);
  const norm = eqs.map((q) => Math.max(1e-300, Math.hypot(...q.a, q.c)));
  const An = A.map((r, i) => r.map((v) => v / norm[i])),
    bn = rhs.map((v, i) => v / norm[i]);
  const rank = nU ? rankOf(An) : 0;
  const rankAug = rankOf(An.map((r, i) => [...r, bn[i]]));
  const base = { unknowns, eqs, rank, pins };
  if (rankAug > rank) return { ...base, status: 'mechanism', x: [], vals: {}, bars: [] };
  if (rank < nU) return { ...base, status: 'indeterminate', x: [], vals: {}, bars: [] };
  // Нормальные уравнения AᵀA x = Aᵀb (система совместна, ранг полный).
  const AtA = Array.from({ length: nU }, (_, i) => Array.from({ length: nU }, (_, j) => An.reduce((s, r) => s + r[i] * r[j], 0)));
  const Atb = Array.from({ length: nU }, (_, i) => An.reduce((s, r, k) => s + r[i] * bn[k], 0));
  const x = gauss(AtA, Atb).map((v) => (Math.abs(v) < 1e-10 ? 0 : v));
  const vals: Record<string, number> = {};
  unknowns.forEach((u, i) => (vals[u.name] = x[i]));
  for (const s of lk.supports) if (s.kind === 'pin') vals[`R_${s.at}`] = Math.hypot(vals[`X_${s.at}`], vals[`Y_${s.at}`]);
  const bars = lk.bodies.flatMap((b, i) => (isBar(b) ? [{ body: i, name: `S_${b.join('')}`, S: x[idx.get(`bar:${i}`)!] }] : []));
  return { ...base, status: 'ok', x, vals, bars };
}
