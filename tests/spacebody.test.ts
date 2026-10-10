/** Пространственное тело: ответы Мещерского §8 и независимая проверка шести условий равновесия. */
import { describe, expect, it } from 'vitest';
import { buildModel, solveBody, type Body } from '../src/modules/spacebody/model/body';
import { BODY_PRESETS } from '../src/modules/spacebody/presets';
import { bodyDoc } from '../src/modules/spacebody/text/solution';
import { BodyStore, parseBody } from '../src/modules/spacebody/ui/store';
import { docText } from './helpers/doctext';

const printedUnit = (v: number) => {
  const s = String(Math.abs(v));
  const dd = s.includes('.') ? s.split('.')[1].length : 0;
  return dd > 6 ? 1e-9 : 2 * Math.pow(10, -dd);
};

/** Своими средствами: главный вектор и главный момент относительно начала координат. */
function wrench(b: Body, vals: Record<string, number>) {
  const m = buildModel(b);
  let F = [0, 0, 0],
    M = [0, 0, 0];
  const addF = (r: number[], f: number[]) => {
    F = F.map((v, i) => v + f[i]);
    M = [M[0] + r[1] * f[2] - r[2] * f[1], M[1] + r[2] * f[0] - r[0] * f[2], M[2] + r[0] * f[1] - r[1] * f[0]];
  };
  for (const u of m.unknowns) addF(u.r, u.u.map((x) => x * vals[u.key]));
  for (const d of m.dependents) addF(d.r, d.u.map((x) => x * vals[d.key] * (d.mult ?? 1)));
  for (const k of m.knowns) if (k.kind === 'f') addF(k.r, k.u.map((x) => x * k.val));
  for (const p of b.pairs) M = M.map((v, i) => v + p.M[i]);
  return { F, M };
}

describe('Мещерский §8', () => {
  for (const [key, p] of Object.entries(BODY_PRESETS).filter(([, x]) => 'book' in x))
    it(p.title, () => {
      const b = p.body as Body;
      const sol = solveBody(buildModel(b));
      expect(sol.status, key).toBe('ok');
      for (const [k, book] of Object.entries((p as { book: Record<string, number> }).book)) expect(Math.abs(sol.vals[k] - book), `${k}: ${sol.vals[k]} против ${book}`).toBeLessThanOrEqual(printedUnit(book) + 1e-9);
      const w = wrench(b, sol.vals);
      [...w.F, ...w.M].forEach((v) => expect(Math.abs(v)).toBeLessThan(1e-8));
    });
});

describe('определимость', () => {
  const base = BODY_PRESETS.m826.body as Body;
  it('лишняя опора — неопределима; без острия пластинка поворачивается вокруг AB — равновесие невозможно', () => {
    expect(solveBody(buildModel({ ...base, supports: [...base.supports, { kind: 'rod', at: 2, to: 0 }] })).status).toBe('indeterminate');
    expect(solveBody(buildModel({ ...base, supports: base.supports.slice(0, 2) })).status).toBe('noequilibrium');
  });
  it('шесть стержней, неудачно расположенных (все параллельны z), — изменяема', () => {
    const rods = [0, 1, 2, 3, 4, 5].map((i) => ({ kind: 'normal' as const, at: i % 4, n: [0, 0, 1] as [number, number, number] }));
    expect(solveBody(buildModel({ ...base, supports: rods })).status).toBe('mechanism');
  });
  it('незакреплённое перемещение при нагрузке вдоль него — равновесие невозможно', () => {
    const b = BODY_PRESETS.m825.body as Body;
    expect(solveBody(buildModel(b)).status).toBe('ok');
    expect(solveBody(buildModel({ ...b, forces: [...b.forces, { at: 7, mode: 'comp', F: 1, c: [0, 1, 0] }] })).status).toBe('noequilibrium');
  });
});

it('вал: P = 2, реакции уравновешивают', () => {
  const b = BODY_PRESETS.shaft.body as Body;
  const sol = solveBody(buildModel(b));
  expect(sol.status).toBe('ok');
  expect(sol.vals.P).toBeCloseTo(2, 12);
  [...wrench(b, sol.vals).F, ...wrench(b, sol.vals).M].forEach((v) => expect(Math.abs(v)).toBeLessThan(1e-9));
});

describe('связанные силы T = k·t', () => {
  const shaft = BODY_PRESETS.shaft.body as Body;
  it('ведущая известна (как в С.7 Яблонского): T = 2·t = 2 — известная нагрузка, составляющие T задают только направление', () => {
    const m = buildModel(shaft);
    const T = m.knowns.find((k) => k.L === 'T')!;
    expect(T.val).toBe(2);
    expect(T.rel).toEqual({ k: 2, of: { L: 't', S: '' } });
    expect(m.dependents).toEqual([]);
    const txt = docText(bodyDoc(shaft, m, solveBody(m)));
    expect(txt).toMatch(/T = 2·t = 2 кН/);
  });
  it('ведущая неизвестна: одна неизвестная t на две силы; реакции те же, что при T = 2, t = 1', () => {
    const ref = solveBody(buildModel(shaft));
    const b: Body = { ...shaft, forces: [shaft.forces[0], { ...shaft.forces[1], unknown: true }, { ...shaft.forces[2], unknown: undefined, F: 2, c: [0, 0, 2] }] };
    const m = buildModel(b);
    expect(m.unknowns.map((u) => u.key)).not.toContain('T');
    expect(m.dependents).toMatchObject([{ L: 'T', key: 't', mult: 2 }]);
    const sol = solveBody(m);
    expect(sol.status).toBe('ok');
    expect(sol.vals.t).toBeCloseTo(1, 12);
    for (const k of Object.keys(ref.vals).filter((k) => k !== 'P')) expect(sol.vals[k]).toBeCloseTo(ref.vals[k], 12);
    [...wrench(b, sol.vals).F, ...wrench(b, sol.vals).M].forEach((v) => expect(Math.abs(v)).toBeLessThan(1e-9));
    const txt = docText(bodyDoc(b, m, sol));
    expect(txt).toMatch(/Сила T = 2·t: связана с неизвестной t/);
    expect(txt).toMatch(/T = 2·t = 2 кН/);
    // В уравнении моментов T входит через t с коэффициентом 2·0,2 = 0,4.
    expect(txt).toMatch(/t·0,4/);
  });
  it('цепочка связей и связь с самой собой не действуют — сила считается заданной сама по себе', () => {
    const b: Body = { ...shaft, forces: [{ ...shaft.forces[0], link: 0 }, shaft.forces[1], shaft.forces[2]] };
    expect(buildModel(b).knowns.find((k) => k.L === 'T')!.rel).toBeUndefined();
  });
  it('файл: связь сохраняется; неверный номер или k ≤ 0 — ошибка', () => {
    const raw = JSON.parse(JSON.stringify(shaft));
    const p = parseBody(raw);
    expect(p.ok && p.body.forces[0]).toMatchObject({ link: 1, k: 2 });
    for (const bad of [{ link: 0 }, { link: 7 }, { link: 1.5 }, { link: 1, k: 0 }, { link: 1, k: -2 }]) {
      const r = JSON.parse(JSON.stringify(shaft));
      Object.assign(r.forces[0], bad);
      expect(parseBody(r).ok, JSON.stringify(bad)).toBe(false);
    }
  });
  it('редактор: удаление силы перенумеровывает связи, удаление ведущей снимает связь; цепочки не создаются', () => {
    const st = new BodyStore({ preset: 'shaft' });
    st.setLink(1, 0);
    expect(st.get().body.forces[1].link).toBeUndefined();
    st.setLink(2, 0);
    expect(st.get().body.forces[2].link).toBeUndefined();
    st.setLink(2, 1);
    expect(st.get().body.forces[2]).toMatchObject({ link: 1, k: 1 });
    expect(st.get().body.forces[2].unknown).toBeUndefined();
    st.undo();
    expect(st.get().body.forces[2].unknown).toBe(true);
    st.removeForce(0);
    expect(st.get().body.forces.map((f) => f.name)).toEqual(['t', 'P']);
    st.undo();
    st.removeForce(1);
    expect(st.get().body.forces[0].link).toBeUndefined();
    expect(st.get().body.forces[0].k).toBeUndefined();
    st.undo();
    st.addForce();
    st.setLink(3, 1);
    st.removeForce(0);
    expect(st.get().body.forces[2]).toMatchObject({ link: 0 });
  });
});
