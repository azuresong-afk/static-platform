/**
 * Поиск положения равновесия и трение в шарнирах («Балки и рамы», пункт 17): неизвестен угол или размер, а не
 * нагрузка. Ответы — против книги (Мещерский §2, §4): корни и границы промежутков, устойчивость, реакции в найденном
 * положении; формулы полей, файл проекта, история отмены, сообщения об ошибках.
 */
import { describe, expect, it } from 'vitest';
import { analyze } from '../src/modules/frames/analyze';
import { POSITION_PROBLEMS } from '../src/modules/frames/model/positions';
import { compileSearch, instantiate, searchFields } from '../src/modules/frames/model/search';
import { parseProject, remapIds, serializeProject } from '../src/modules/frames/model/project';
import type { Structure } from '../src/modules/frames/model/types';
import { Store } from '../src/modules/frames/ui/store';
import { virtualWork } from '../src/modules/virtual/model/virtual';
import { createIdGen } from '../src/shared/ids';
import { docText } from './helpers/doctext';

const near = (a: number, b: number, rel = 1e-6, abs = 1e-6) => Math.abs(a - b) <= Math.max(abs, rel * Math.abs(b));

describe('готовые задачи: ответы книги', () => {
  for (const p of POSITION_PROBLEMS)
    it(p.id, () => {
      const a = analyze(p.build(), { explain: true, pick: p.check.pick });
      const c = p.check;
      if (c.points) {
        expect(a.search, p.id).toBeTruthy();
        expect(a.search!.errors).toEqual([]);
        const pts = a.search!.points.map((x) => x.p);
        expect(pts.length, p.id).toBe(c.points.length);
        const span = a.structure.search!.max - a.structure.search!.min;
        c.points.forEach((x, i) => expect(near(pts[i], x, 0, 1e-6 * span), `${p.id}: ${pts[i]} ≠ ${x}`).toBe(true));
        a.search!.points.forEach((x, i) => expect(x.ok, `${p.id}: корень ${i}`).toBe(!c.rejected?.[i]));
      }
      if (c.ranges) {
        const span = a.structure.search!.max - a.structure.search!.min;
        expect(a.search!.ranges.length).toBe(c.ranges.length);
        c.ranges.forEach(([lo, hi], i) => {
          expect(near(a.search!.ranges[i][0], lo, 0, 1e-6 * span)).toBe(true);
          expect(near(a.search!.ranges[i][1], hi, 0, 1e-6 * span)).toBe(true);
        });
      }
      if (c.stable) c.stable.forEach((st, i) => expect(a.search!.points[i].stable, `${p.id}: устойчивость ${i}`).toBe(st));
      if (c.vals) {
        const vals = a.solution.status === 'friction' ? a.solution.friction!.sample! : a.solution.vals;
        for (const [k, v] of Object.entries(c.vals)) expect(near(vals[k], v, 1e-6), `${p.id}: ${k} = ${vals[k]} ≠ ${v}`).toBe(true);
      }
      // Текст решения строится и в найденном положении сходится проверка.
      const text = docText(a.doc);
      expect(text).not.toContain('NaN');
      if (a.search) expect(text).toContain('Ищем положение равновесия');
    });

  it('у каждой задачи есть ответ книги, расхождения объяснены', () => {
    for (const p of POSITION_PROBLEMS) {
      expect(p.answer.startsWith('Ответ задачника'), p.id).toBe(true);
      for (const d of Object.values(p.discrepancy ?? {})) expect(d.why.length).toBeGreaterThan(40);
    }
  });
});

describe('формулы полей', () => {
  const s0 = (): Structure => ({
    nodes: [{ id: 'n1' }, { id: 'n2' }],
    segs: [{ id: 's1', a: 'n1', b: 'n2', dir: 'r', len: 2 }],
    items: [
      { id: 'i1', type: 'pin', at: 'n1', side: 'below' },
      { id: 'i2', type: 'weight', at: 'n2', G: 1 },
    ],
    search: { name: 'φ', unit: 'deg', min: 0, max: 90, bind: [{ ref: 's1', field: 'ang', expr: 'arcsin(sin 30) + φ' }] },
  });

  it('тригонометрия в градусах; поле участка становится наклонным', () => {
    const s = s0();
    const c = compileSearch(s);
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    const s2 = instantiate(s, c.fns, 15)!;
    expect(s2.segs[0].dir).toBe('a');
    expect(s2.segs[0].ang).toBeCloseTo(45, 10);
  });

  it('латинское обозначение и длина в метрах', () => {
    const s: Structure = { ...s0(), search: { name: 'h', unit: 'm', min: 0, max: 3, bind: [{ ref: 's1', field: 'len', expr: '2h + 1' }] } };
    const c = compileSearch(s);
    if (!c.ok) throw new Error(c.errors.join());
    expect(instantiate(s, c.fns, 0.5)!.segs[0].len).toBe(2);
    // Длина не положительна — схемы при таком значении нет.
    expect(instantiate(s, c.fns, -1)).toBeNull();
    // Угол от длины: тригонометрия и здесь в градусах.
    const s2: Structure = { ...s0(), search: { name: 'h', unit: 'm', min: 0, max: 2, bind: [{ ref: 's1', field: 'ang', expr: 'arccos(h/2)' }] } };
    const c2 = compileSearch(s2);
    if (!c2.ok) throw new Error(c2.errors.join());
    expect(instantiate(s2, c2.fns, 1)!.segs[0].ang).toBeCloseTo(60, 10);
  });

  it('ошибки: плохая формула, нет поля, плохое обозначение', () => {
    const bad = compileSearch({
      ...s0(),
      search: {
        name: 't',
        unit: 'deg',
        min: 0,
        max: 1,
        bind: [
          { ref: 'zz', field: 'len', expr: 'φ' },
          { ref: 's1', field: 'len', expr: '2 +' },
        ],
      },
    });
    expect(bad.ok).toBe(false);
    if (bad.ok) return;
    expect(bad.errors.join(' ')).toMatch(/Обозначение параметра «t»/);
    expect(bad.errors.join(' ')).toMatch(/такого поля в схеме нет/);
  });

  it('список полей: участки, тела, опоры, нагрузки, касания', () => {
    const p = POSITION_PROBLEMS.find((x) => x.id.startsWith('2.48'))!;
    const f = searchFields(p.build());
    expect(f.some((x) => x.field === 'dx' && x.label.startsWith('Тело'))).toBe(true);
    expect(f.some((x) => x.field === 'angle' && x.label.startsWith('Касание'))).toBe(true);
    expect(f.some((x) => x.field === 'G')).toBe(true);
  });

  it('при неизвестных, сколько уравнений, — понятное сообщение', () => {
    // Балка на шарнире и катке: определима при любом угле — параметр не найти.
    const s: Structure = {
      nodes: [{ id: 'n1' }, { id: 'n2' }],
      segs: [{ id: 's1', a: 'n1', b: 'n2', dir: 'r', len: 2 }],
      items: [
        { id: 'i1', type: 'pin', at: 'n1', side: 'below' },
        { id: 'i2', type: 'roller', at: 'n2', side: 'below' },
        { id: 'i3', type: 'weight', at: 'n2', G: 1 },
      ],
      search: { name: 'φ', unit: 'deg', min: 0, max: 80, bind: [{ ref: 's1', field: 'ang', expr: 'φ' }] },
    };
    const a = analyze(s);
    expect(a.search!.errors[0]).toMatch(/не больше, чем неизвестных/);
    expect(docText(a.doc)).toContain('Поиск не выполнен');
  });

  it('с трением искомой нагрузки быть не должно', () => {
    const s = POSITION_PROBLEMS.find((x) => x.id.startsWith('2.61'))!.build();
    s.items.push({ id: 'zz', type: 'force', at: s.nodes[0].id, F: 1, ref: 'right', rot: 'ccw', alpha: 0, unknown: true });
    expect(analyze(s).search!.errors[0]).toMatch(/искомых нагрузок быть не должно/);
  });

  it('выбор корня: решение и чертёж — в выбранном положении', () => {
    const p = POSITION_PROBLEMS.find((x) => x.id.startsWith('2.49'))!;
    const a0 = analyze(p.build()),
      a1 = analyze(p.build(), { pick: 1 });
    expect(a0.pick).toBe(0);
    expect(a1.pick).toBe(1);
    // При φ = 180° кольцо внизу: реакция по вертикали, верёвка тянет вверх.
    expect(a1.solution.vals.R_B).toBeCloseTo(-1, 6);
    expect(docText(a1.doc)).toContain('= 180°');
  });
});

describe('трение в шарнирах', () => {
  it('без трения (f = 0) — обычная балка', () => {
    const p = POSITION_PROBLEMS.find((x) => x.id.startsWith('4.61'))!;
    const s = p.build();
    const pin = s.items.find((i) => i.type === 'pin')!;
    if (pin.type === 'pin') pin.fr = { ...pin.fr!, f: 0 };
    const a = analyze(s);
    // Без трения вал не уравновесить: момент P·R нечем уравновесить, при любом Q — вал вращается.
    expect(a.solution.status).not.toBe('ok');
  });

  it('вместе с трением на опоре не рассчитывается — понятное сообщение; «Возможные перемещения» не считают', () => {
    const p = POSITION_PROBLEMS.find((x) => x.id.startsWith('4.61'))!;
    const s = p.build();
    expect(virtualWork(s, analyze(s))).toEqual({ ok: false, why: 'pinfr' });
    const end = s.items.find((i) => i.type === 'force' && !i.unknown)!;
    s.items.push({ id: 'zz', type: 'rough', at: end.type === 'force' ? end.at : '', side: 'below', f: 0.2 });
    const a = analyze(s);
    expect(a.solution.status).toBe('unsupported');
    expect(docText(a.doc)).toContain('Трение в шарнире вместе с трением на опорах');
  });

  it('без искомой нагрузки — сообщение: отметить искомую', () => {
    const p = POSITION_PROBLEMS.find((x) => x.id.startsWith('4.61'))!;
    const s = p.build();
    for (const it of s.items) if (it.type === 'force') it.unknown = false;
    const a = analyze(s);
    expect(a.solution).toMatchObject({ status: 'unsupported', unsupported: 'load' });
    const t = docText(a.doc);
    expect(t).toContain('Отметьте искомую нагрузку');
    expect(t).not.toContain('NaN');
  });

  it('текст: момент трения, радиус круга трения', () => {
    const p = POSITION_PROBLEMS.find((x) => x.id.startsWith('4.73'))!;
    const t = docText(analyze(p.build(), { explain: true }).doc);
    expect(t).toContain('Учитываем трение в шарнире');
    expect(t).toContain('r·f/√(1 + f²)');
  });
});

describe('файл проекта и история', () => {
  it('поиск и трение в шарнире сохраняются и открываются', () => {
    for (const id of ['2.48', '4.73', '2.70']) {
      const p = POSITION_PROBLEMS.find((x) => x.id.startsWith(id))!;
      const s = p.build();
      const r = parseProject(serializeProject({ title: p.title, structure: s, notTarget: [] }));
      expect(r.ok, id).toBe(true);
      if (!r.ok) continue;
      const s2 = remapIds(r.project.structure, createIdGen());
      const a = analyze(s),
        b = analyze(s2);
      expect(b.search?.points.map((x) => x.p)).toEqual(a.search?.points.map((x) => x.p));
      expect(b.solution.vals).toEqual(a.solution.vals);
    }
  });

  it('плохой поиск в файле — понятная ошибка', () => {
    const p = POSITION_PROBLEMS[0];
    const text = serializeProject({ title: 'x', structure: p.build(), notTarget: [] }).replace(/"unit":\s*"deg"/, '"unit": "rad"');
    const r = parseProject(text);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toMatch(/Поиск положения/);
  });

  it('включение поиска, формулы и выбор корня отменяются', () => {
    const st = new Store();
    st.setSearchOn(true);
    expect(st.get().s.search?.name).toBe('φ');
    st.addBind();
    expect(st.get().s.search!.bind.length).toBe(1);
    st.setBind(0, { expr: '2φ' }, true);
    expect(st.get().s.search!.bind[0].expr).toBe('2φ');
    st.undo();
    expect(st.get().s.search!.bind.length).toBe(1);
    st.undo();
    expect(st.get().s.search!.bind.length).toBe(0);
    st.undo();
    expect(st.get().s.search).toBeUndefined();
    st.redo();
    expect(st.get().s.search).toBeTruthy();
  });
});
