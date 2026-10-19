/**
 * Контакт тел в статике («Балки и рамы», пункт 13): несколько тел, тела-точки, касания (гладкие и с трением),
 * нити через блоки, шарниры между телами, перебор случаев для односторонних связей.
 * Ответы — против книг (Мещерский §2–4, Яблонский С.5, С.9); равновесие каждого тела проверяется независимо:
 * свои координаты (обход тел), свои направления сил, только значения неизвестных берутся из решения.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { analyze } from '../src/modules/frames/analyze';
import { CONTACT_PROBLEMS } from '../src/modules/frames/model/contacts';
import { addBody, addLink, patchLink, removeBody, removeSeg } from '../src/modules/frames/model/edit';
import { parseProject, remapIds, serializeProject } from '../src/modules/frames/model/project';
import type { Item, Structure } from '../src/modules/frames/model/types';
import type { Model } from '../src/modules/frames/solver/model';
import { createIdGen } from '../src/shared/ids';
import { docText } from './helpers/doctext';

const unit = (deg: number): [number, number] => [Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180)];
const SIDE_ANG: Record<string, number> = { below: 90, above: 270, left: 0, right: 180 };
const REF_ANG: Record<string, number> = { right: 0, up: 90, left: 180, down: 270 };
const LOAD_ANG: Record<string, number> = { down: 270, up: 90, right: 0, left: 180 };

/** Свои координаты: обход участков от каждого начала тела, тела — от точки другого тела со смещением. */
function coords(s: Structure): Record<string, [number, number]> {
  const pos: Record<string, [number, number]> = {};
  const incoming = new Set(s.segs.map((q) => q.b));
  const grow = (root: string) => {
    const queue = [root];
    while (queue.length) {
      const id = queue.shift()!;
      for (const q of s.segs)
        if (q.a === id) {
          const d = q.dir === 'a' ? unit(q.ang as number) : ({ r: [1, 0], l: [-1, 0], u: [0, 1], d: [0, -1] } as Record<string, [number, number]>)[q.dir];
          pos[q.b] = [pos[id][0] + d[0] * q.len, pos[id][1] + d[1] * q.len];
          queue.push(q.b);
        }
    }
  };
  const main = s.nodes.find((n) => !incoming.has(n.id) && !n.place)!.id;
  pos[main] = [0, 0];
  grow(main);
  for (let more = true; more; ) {
    more = false;
    for (const n of s.nodes)
      if (n.place && !(n.id in pos) && n.place.from in pos) {
        pos[n.id] = [pos[n.place.from][0] + n.place.dx, pos[n.place.from][1] + n.place.dy];
        grow(n.id);
        more = true;
      }
  }
  return pos;
}

/** Тела: деревья участков (внутренние шарниры не делят — их силы внутренние), тело-точка — отдельно. */
function bodies(s: Structure): Record<string, number> {
  const out: Record<string, number> = {};
  let k = 0;
  const incoming = new Set(s.segs.map((q) => q.b));
  for (const r of s.nodes.filter((n) => !incoming.has(n.id))) {
    const set = [r.id];
    for (let i = 0; i < set.length; i++) for (const q of s.segs) if (q.a === set[i]) set.push(q.b);
    set.forEach((id) => (out[id] = k));
    k++;
  }
  return out;
}

interface W {
  body: number;
  x: number;
  y: number;
  fx: number;
  fy: number;
  m: number;
}

/** Все силы на каждое тело при значениях vals. */
function wrenchesByBody(s: Structure, m: Model, vals: Record<string, number>): W[] {
  const pos = coords(s),
    body = bodies(s);
  const val = (itemId: string, L: string) => vals[m.unknowns.find((u) => u.itemId === itemId && u.L === L)!.key];
  const out: W[] = [];
  const add = (id: string, fx: number, fy: number, mm = 0) => out.push({ body: body[id], x: pos[id][0], y: pos[id][1], fx, fy, m: mm });
  for (const it of s.items as Item[]) {
    if (it.type === 'dist') {
      const P = pos[it.from],
        Q = pos[it.to],
        L = Math.hypot(Q[0] - P[0], Q[1] - P[1]);
      const [nx, ny] = unit(LOAD_ANG[it.dir]);
      for (let i = 0; i <= 2; i++) {
        const t = i / 2,
          w = (i === 1 ? 4 : 1) / 6,
          q = it.q1 + (it.q2 - it.q1) * t;
        out.push({ body: body[it.from], x: P[0] + (Q[0] - P[0]) * t, y: P[1] + (Q[1] - P[1]) * t, fx: nx * q * L * w, fy: ny * q * L * w, m: 0 });
      }
      continue;
    }
    const at = it.at;
    if (it.type === 'pin' || it.type === 'fixed') add(at, val(it.id, 'X'), val(it.id, 'Y'), it.type === 'fixed' ? val(it.id, 'M') : 0);
    if (it.type === 'roller') {
      const [ux, uy] = unit(it.side === 'tilt' ? (it.angle as number) : SIDE_ANG[it.side]);
      add(at, ux * val(it.id, 'R'), uy * val(it.id, 'R'));
    }
    if (it.type === 'rough') {
      const a = it.side === 'tilt' ? (it.angle as number) : SIDE_ANG[it.side];
      const [nx, ny] = unit(a),
        [tx, ty] = unit(a - 90);
      const N = val(it.id, 'N'),
        T = val(it.id, 'Fтр');
      add(at, nx * N + tx * T, ny * N + ty * T);
    }
    if (it.type === 'force') {
      const [ux, uy] = unit(REF_ANG[it.ref] + (it.rot === 'ccw' ? 1 : -1) * it.alpha);
      const F = it.unknown ? val(it.id, 'F') : it.F;
      add(at, ux * F, uy * F);
    }
    if (it.type === 'weight') add(at, 0, -it.G);
    if (it.type === 'moment') add(at, 0, 0, (it.dir === 'ccw' ? 1 : -1) * (it.unknown ? val(it.id, 'M') : it.M));
  }
  for (const li of m.links) {
    const l = li.link;
    const key = (i: number) => vals[li.list[i].key];
    if (l.type === 'contact') {
      const [nx, ny] = unit(l.angle),
        [tx, ty] = unit(l.angle - 90);
      const N = key(0),
        T = li.list[1] ? key(1) : 0;
      add(l.b, nx * N + tx * T, ny * N + ty * T);
      add(l.a, -(nx * N + tx * T), -(ny * N + ty * T));
    } else if (l.type === 'hinge') {
      add(l.b, key(0), key(1));
      add(l.a, -key(0), -key(1));
    } else {
      const chain = [l.a, ...(l.via ?? []), l.b];
      const T = key(0);
      chain.forEach((id, i) => {
        for (const j of [i - 1, i + 1]) {
          if (j < 0 || j >= chain.length) continue;
          const dx = pos[chain[j]][0] - pos[id][0],
            dy = pos[chain[j]][1] - pos[id][1],
            d = Math.hypot(dx, dy);
          add(id, (T * dx) / d, (T * dy) / d);
        }
      });
    }
  }
  return out;
}

/** Равновесие каждого тела: проекции и моменты (у тела-точки — только проекции). */
function expectBodiesBalanced(s: Structure, m: Model, vals: Record<string, number>) {
  const ws = wrenchesByBody(s, m, vals);
  const body = bodies(s),
    pos = coords(s);
  const scale = Math.max(1, ...ws.map((w) => Math.abs(w.fx) + Math.abs(w.fy) + Math.abs(w.m)));
  const span = Math.max(1, ...Object.values(pos).map(([x, y]) => Math.abs(x) + Math.abs(y)));
  for (const b of new Set(Object.values(body))) {
    const own = ws.filter((w) => w.body === b);
    const point = !s.segs.some((q) => body[q.a] === b);
    const fx = own.reduce((a, w) => a + w.fx, 0),
      fy = own.reduce((a, w) => a + w.fy, 0);
    expect(Math.abs(fx), `ΣFx тела ${b}`).toBeLessThan(1e-6 * scale);
    expect(Math.abs(fy), `ΣFy тела ${b}`).toBeLessThan(1e-6 * scale);
    if (point) continue;
    for (const [px, py] of [
      [0, 0],
      [3, -2],
    ]) {
      const mm = own.reduce((a, w) => a + (w.x - px) * w.fy - (w.y - py) * w.fx + w.m, 0);
      expect(Math.abs(mm), `ΣM тела ${b}`).toBeLessThan(1e-6 * scale * span);
    }
  }
}

/** Неравенства связей: давление и натяжение не отрицательны, трение не больше f·N. */
function expectAdmissible(m: Model, vals: Record<string, number>) {
  for (const l of m.links) {
    if (l.link.type === 'hinge') continue;
    const N = vals[l.list[0].key];
    expect(N).toBeGreaterThan(-1e-7);
    if (l.list[1]) expect(Math.abs(vals[l.list[1].key])).toBeLessThanOrEqual(l.f * N + 1e-7);
  }
  for (const sp of m.supports)
    if (sp.it.type === 'rough') {
      const N = vals[sp.list[0].key],
        T = vals[sp.list[1].key];
      expect(N).toBeGreaterThan(-1e-7);
      expect(Math.abs(T)).toBeLessThanOrEqual(sp.it.f * N + 1e-7);
    }
}

/** Допуск сравнения с книгой: две единицы последнего знака ответа или relTol. */
const tolOf = (book: number, relTol = 0) => {
  const s = String(Math.abs(book));
  const unitLast = s.includes('.') ? Math.pow(10, -s.split('.')[1].length) : 1;
  return Math.max(2 * unitLast, relTol * Math.abs(book), 1e-9);
};

function expectVals(vals: Record<string, number>, book: Record<string, number>, p: (typeof CONTACT_PROBLEMS)[number]) {
  for (const [k, v0] of Object.entries(book)) {
    const v = k.includes(',') ? Math.hypot(...k.split(',').map((x) => vals[x])) : vals[k];
    expect(v, `${k} — нет в решении`).toBeDefined();
    const d = p.discrepancy?.[k];
    if (d) {
      // Расхождение с книгой подтверждено пересчётом: сверяем с пересчётом, а не с книгой.
      expect(Math.abs(v - d.computed), `${k}: ${v} против пересчёта ${d.computed}`).toBeLessThanOrEqual(tolOf(d.computed));
      expect(Math.abs(v - v0)).toBeGreaterThan(tolOf(v0, p.relTol));
      continue;
    }
    expect(Math.abs(v - v0), `${k}: ${v} против ${v0} по книге`).toBeLessThanOrEqual(tolOf(v0, p.relTol));
  }
}

describe('контакт тел: задачи Мещерского и Яблонского', () => {
  for (const p of CONTACT_PROBLEMS)
    it(`${p.book === 'mesh' ? 'Мещерский' : 'Яблонский'} ${p.id} — ${p.title}`, () => {
      const s = p.build();
      const { model, solution: sol, doc } = analyze(s, { explain: true });
      expect(model.badLinks).toEqual([]);
      const c = p.check;
      if (sol.friction) {
        const fr = sol.friction;
        expect(fr.feasible).toBe(true);
        if (c.min !== undefined) {
          expect(Math.abs(fr.min!.value - c.min), `min ${fr.min!.value}`).toBeLessThanOrEqual(tolOf(c.min, p.relTol));
          expectBodiesBalanced(s, model, fr.min!.vals!);
          expectAdmissible(model, fr.min!.vals!);
          if (c.atMin) expectVals(fr.min!.vals!, c.atMin, p);
        }
        if (c.max !== undefined) {
          expect(Math.abs(fr.max!.value - c.max), `max ${fr.max!.value}`).toBeLessThanOrEqual(tolOf(c.max, p.relTol));
          expectBodiesBalanced(s, model, fr.max!.vals!);
          expectAdmissible(model, fr.max!.vals!);
          if (c.atMax) expectVals(fr.max!.vals!, c.atMax, p);
        }
        if (c.feasible) {
          expect(fr.param).toBeNull();
          expectBodiesBalanced(s, model, fr.sample!);
          expectAdmissible(model, fr.sample!);
          if (c.vals) expectVals(fr.sample!, c.vals, p);
          if (c.fmin !== undefined) expect(Math.abs(fr.lambda! * c.fmin - c.fmin)).toBeLessThan(1e-4);
        }
      } else {
        expect(sol.status).toBe('ok');
        expect(c.min ?? c.max).toBeUndefined();
        expectBodiesBalanced(s, model, sol.vals);
        expectAdmissible(model, sol.vals);
        expectVals(sol.vals, c.vals!, p);
      }
      if (c.cases) {
        expect(sol.cases).toHaveLength(c.cases);
        expect(sol.cases!.at(-1)!.ok).toBe(true);
        expect(sol.cases!.slice(0, -1).every((x) => !x.ok && x.neg && x.neg.val < 0)).toBe(true);
      }
      const text = docText(doc);
      expect(text).toMatch(/Расчленяем систему на тела|Тело I/);
    });
});

/** Две балки: верхняя лежит концом на нижней (как 3.35), нагрузки — случайные. */
function twoBeams(l1: number, l2: number, t: number, G1: number, G2: number, P: number, ang: number, ids = createIdGen()): Structure {
  const [A, K, B, C, E, D] = [ids.node(), ids.node(), ids.node(), ids.node(), ids.node(), ids.node()];
  return {
    nodes: [{ id: A }, { id: K }, { id: B }, { id: C, place: { from: B, dx: 0, dy: 0 } }, { id: E }, { id: D }],
    segs: [
      { id: ids.seg(), a: A, b: K, dir: 'r', len: l1 * t },
      { id: ids.seg(), a: K, b: B, dir: 'r', len: l1 * (1 - t) },
      { id: ids.seg(), a: C, b: E, dir: 'r', len: l2 / 2 },
      { id: ids.seg(), a: E, b: D, dir: 'r', len: l2 / 2 },
    ],
    items: [
      { id: ids.item(), type: 'pin', at: A, side: 'below' },
      { id: ids.item(), type: 'weight', at: K, G: G1 },
      { id: ids.item(), type: 'roller', at: E, side: 'below' },
      { id: ids.item(), type: 'pin', at: D, side: 'below' },
      { id: ids.item(), type: 'weight', at: E, G: G2 },
      { id: ids.item(), type: 'force', at: K, F: P, ref: 'right', rot: 'ccw', alpha: ang, unknown: false },
    ],
    links: [{ id: ids.item(), type: 'contact', a: C, b: B, angle: 90, f: 0 }],
  };
}

describe('контакт тел: свойства', () => {
  it('случайные балки, лежащие одна на другой: равновесие тел и знак давления', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1, max: 6, noNaN: true }),
        fc.double({ min: 1, max: 6, noNaN: true }),
        fc.double({ min: 0.1, max: 0.9, noNaN: true }),
        fc.double({ min: 0, max: 20, noNaN: true }),
        fc.double({ min: 0, max: 20, noNaN: true }),
        fc.double({ min: 0, max: 30, noNaN: true }),
        fc.integer({ min: 0, max: 359 }),
        (l1, l2, t, G1, G2, P, ang) => {
          const s = twoBeams(l1, l2, t, G1, G2, P, ang);
          const { model, solution } = analyze(s);
          expect(model.parts.count).toBe(2);
          const N = model.links[0].list[0].key;
          if (solution.status === 'ok') {
            expect(solution.vals[N]).toBeGreaterThan(-1e-7);
            expectBodiesBalanced(s, model, solution.vals);
          } else {
            // Давление получилось отрицательным: верхняя балка отрывается.
            expect(solution.status).toBe('noequilibrium');
            expect(solution.slack).toEqual([N]);
            expect(solution.vals[N]).toBeLessThan(0);
            expectBodiesBalanced(s, model, solution.vals);
          }
        },
      ),
      { numRuns: 400 },
    );
  });

  it('тело-точка даёт два уравнения, тело из участков — три', () => {
    const p = CONTACT_PROBLEMS.find((x) => x.id === '4.54 (166)')!;
    const { model } = analyze(p.build());
    expect(model.parts.dof).toEqual([3, 3, 2]);
  });

  it('односторонняя связь, работающая «наоборот»: отрыв и текст об этом', () => {
    // Верхняя балка прижата к нижней только силой, тянущей вверх, — давление отрицательно.
    const s = twoBeams(4, 4, 0.5, 0, 0, 10, 90);
    const { solution, doc } = analyze(s, { explain: true });
    expect(solution.status).toBe('noequilibrium');
    const text = docText(doc);
    expect(text).toContain('Проверяем односторонние связи');
    expect(text).toContain('тела разойдутся');
  });

  it('перебор случаев (С.9): текст называет оба предположения', () => {
    const p = CONTACT_PROBLEMS.find((x) => x.id === 'С.9')!;
    const text = docText(analyze(p.build(), { explain: true }).doc);
    expect(text).toContain('Какие односторонние связи работают');
    expect(text).toContain('Случай 1');
    expect(text).toContain('предположение неверно');
    expect(text).toContain('Случай 2');
    expect(text).toContain('предположение верно');
  });

  it('трение между телами (2.66): предельные состояния названы — скольжение тела по телу', () => {
    const p = CONTACT_PROBLEMS.find((x) => x.id === '2.66')!;
    const text = docText(analyze(p.build(), { explain: true }).doc);
    expect(text).toContain('трение между телами достигло предела');
    expect(text).toContain('Наибольшее значение');
  });
});

describe('контакт тел: файл проекта и правка схемы', () => {
  it('сохранение и открытие: тела, касания, нити с блоками, шарниры', () => {
    for (const p of CONTACT_PROBLEMS) {
      const s = p.build();
      const text = serializeProject({ title: p.title, structure: s, notTarget: [] });
      const r = parseProject(text);
      expect(r.ok, p.id + ' ' + (r.ok ? '' : r.errors.join(' '))).toBe(true);
      if (!r.ok) continue;
      const a = analyze(s).solution,
        b = analyze(remapIds(r.project.structure, createIdGen())).solution;
      expect(b.status).toBe(a.status);
      const va = Object.values(a.friction?.sample ?? a.vals).sort(),
        vb = Object.values(b.friction?.sample ?? b.vals).sort();
      va.forEach((x, i) => expect(Math.abs(x - vb[i])).toBeLessThan(1e-6 * Math.max(1, Math.abs(x))));
    }
  });

  it('ошибки в файле: связь к несуществующей точке, тело от несуществующей точки', () => {
    const p = CONTACT_PROBLEMS[0];
    const raw = JSON.parse(serializeProject({ title: 't', structure: p.build(), notTarget: [] }));
    raw.structure.links[0].a = 'nope';
    expect(parseProject(JSON.stringify(raw)).ok).toBe(false);
    const raw2 = JSON.parse(serializeProject({ title: 't', structure: p.build(), notTarget: [] }));
    raw2.structure.nodes.find((n: { place?: unknown }) => n.place).place.from = 'nope';
    const r2 = parseProject(JSON.stringify(raw2));
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.errors.join(' ')).toContain('несуществующей точки');
  });

  it('новое тело в точке — сразу касание; убрать тело — с его связями', () => {
    const ids = createIdGen();
    const s0 = analyze(twoBeams(4, 4, 0.5, 10, 10, 0, 0)).model;
    const base = twoBeams(4, 4, 0.5, 10, 10, 0, 0, ids);
    const target = base.nodes[1].id;
    const r = addBody(base, target, 0, 0, ids);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.s.links!.at(-1)).toMatchObject({ type: 'contact', a: target, b: r.id, angle: 90, f: 0 });
    const g = removeBody(r.s, r.id!);
    expect(g.ok).toBe(true);
    if (g.ok) {
      expect(g.s.nodes).toHaveLength(base.nodes.length);
      expect(g.s.links).toHaveLength(base.links!.length);
    }
    // Тело с участками убирается целиком — вместе с касанием.
    const root = base.nodes.find((n) => n.place)!.id;
    const h = removeBody(base, root);
    expect(h.ok && h.s.links!.length === 0 && h.s.segs.length === 2).toBe(true);
    expect(s0.parts.count).toBe(2);
  });

  it('касание и шарнир — только между совпадающими точками разных тел; нить — между телами', () => {
    const ids = createIdGen();
    const one = CONTACT_PROBLEMS.find((x) => x.id === '3.35 (109)')!.build(ids);
    // Касание в 3.35 уже стоит; второго места касания нет.
    expect(addLink(one, 'contact', ids).ok).toBe(false);
    const t = addLink(one, 'thread', ids);
    expect(t.ok).toBe(true);
    const c = one.links![0];
    expect(patchLink(one, c.id, { b: c.a }).ok).toBe(false);
  });

  it('убрать участок: связи и места тел переходят в слитую точку', () => {
    const s = twoBeams(4, 4, 0.5, 10, 10, 0, 0);
    // Участок K–B главного тела: B сливается с K, касание переходит в K, тело II ставится от K.
    const q = s.segs[1];
    const r = removeSeg(s, q.id);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.s.links![0].b).toBe(q.a);
    expect(r.s.nodes.find((n) => n.place)!.place!.from).toBe(q.a);
  });
});

describe('контакт тел: неучтённые связи', () => {
  it('касание точек одного тела не учитывается, причина — в решении', () => {
    const ids = createIdGen();
    const s = twoBeams(4, 4, 0.5, 10, 10, 0, 0, ids);
    const main = s.nodes.slice(0, 3).map((n) => n.id);
    s.nodes = s.nodes.filter((n) => main.includes(n.id));
    s.segs = s.segs.filter((q) => main.includes(q.a));
    s.items = s.items.filter((it) => it.type !== 'dist' && main.includes(it.at));
    s.items.push({ id: ids.item(), type: 'roller', at: main[2], side: 'below' });
    s.links = [{ id: ids.item(), type: 'contact', a: main[0], b: main[2], angle: 90, f: 0 }];
    const { model, solution, doc } = analyze(s);
    expect(model.badLinks.map((b) => b.why)).toEqual(['same']);
    expect(solution.status).toBe('ok');
    expect(docText(doc)).toContain('обе точки принадлежат одному телу');
  });
});
