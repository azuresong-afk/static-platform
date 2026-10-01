/** Теорема об изменении кинетической энергии: ответы Мещерского §38 и независимая проверка интегрированием уравнения движения. */
import { describe, expect, it } from 'vitest';
import { solveEnergy, type EnergyProblem } from '../src/modules/energy/model/energy';
import { ENERGY_PRESETS, type EnergyPresetKey } from '../src/modules/energy/presets';
import { renderEnergy } from '../src/modules/energy/draw/energy';
import { energyDoc } from '../src/modules/energy/text/solution';
import { EnergyStore, parseEnergy } from '../src/modules/energy/ui/store';

const tol = (v: number) => {
  const s = String(Math.abs(v));
  const d = s.includes('.') ? s.split('.')[1].length : 0;
  return d > 6 ? 1e-9 * Math.max(1, Math.abs(v)) : 2 * Math.pow(10, -d);
};

describe('Мещерский §38', () => {
  for (const [key, p] of Object.entries(ENERGY_PRESETS).filter(([, x]) => 'book' in x))
    it(p.title, () => {
      const r = solveEnergy(p.problem as EnergyProblem);
      expect(r.ok, key + r.errors.join()).toBe(true);
      expect(r.note, key).toBe(key === 'm3823' || key === 'm3824' ? 'reverse' : 'ok');
      const got: Record<string, number> = { v: r.v, v0: r.v0, s: r.s, revs: r.s / (2 * Math.PI) };
      for (const [k, book] of Object.entries((p as { book: Record<string, number> }).book)) expect(Math.abs(got[k] - book), `${k}: ${got[k]} против ${book}`).toBeLessThanOrEqual(tol(book));
    });
});

/** Интегрирование m_пр·a = Q(s) методом Рунге — Кутты: независимо от формулы T − T₀ = A. */
function integrate(r: ReturnType<typeof solveEnergy>, v0: number, sEnd: number) {
  let s = 0,
    v = v0,
    t = 0;
  const h = 1e-5;
  const f = (x: number) => r.Q(x) / r.mred;
  while (s < sEnd && t < 100) {
    const k1s = v,
      k1v = f(s);
    const k2s = v + (h / 2) * k1v,
      k2v = f(s + (h / 2) * k1s);
    const k3s = v + (h / 2) * k2v,
      k3v = f(s + (h / 2) * k2s);
    const k4s = v + h * k3v,
      k4v = f(s + h * k3s);
    const ns = s + (h / 6) * (k1s + 2 * k2s + 2 * k3s + k4s);
    const nv = v + (h / 6) * (k1v + 2 * k2v + 2 * k3v + k4v);
    if (ns >= sEnd) return v + ((nv - v) * (sEnd - s)) / (ns - s);
    if (nv <= 0) return 0;
    s = ns;
    v = nv;
    t += h;
  }
  return v;
}

describe('независимая проверка интегрированием', () => {
  for (const key of ['spring', 'm3823', 'm3824', 'm3846'] as const)
    it(key, () => {
      // У 38.23–38.24 из покоя груз не поднимается — проверяем с начальной скоростью 5 м/с.
      const pr = { ...(ENERGY_PRESETS[key].problem as EnergyProblem), ...(key === 'm3823' || key === 'm3824' ? { v0: 5 } : {}) };
      const r = solveEnergy(pr);
      expect(r.note).toBe('ok');
      expect(integrate(r, pr.v0, pr.s)).toBeCloseTo(r.v, 4);
    });
  it('пружина: ускорение переменно и в конце равно Q/m', () => {
    const r = solveEnergy(ENERGY_PRESETS.spring.problem as EnergyProblem);
    expect(r.linear).toBe(false);
    const a = (9.81 * (Math.sin(Math.PI / 6) - 0.1 * Math.cos(Math.PI / 6)) * 2 - 200 * 0.05) / 2;
    expect(r.a).toBeCloseTo(a, 12);
  });
  it('пружина: груз останавливается на 2mg(sin α − f cos α)/c', () => {
    const pr = { ...(ENERGY_PRESETS.spring.problem as EnergyProblem), s: 1 };
    const r = solveEnergy(pr);
    expect(r.note).toBe('stops');
    expect(r.sStop!).toBeCloseTo((2 * 2 * 9.81 * (0.5 - 0.1 * Math.cos(Math.PI / 6))) / 200, 9);
  });
  it('38.23: в начале момент aφ = 0 — из покоя груз не поднимется; ответ книги — формальный', () => {
    const r = solveEnergy(ENERGY_PRESETS.m3823.problem as EnergyProblem);
    expect(r.Q(0)).toBeLessThan(0);
    expect(r.A(0.05)).toBeLessThan(0);
  });
  it('из покоя система пойдёт в другую сторону', () => {
    const pr = structuredClone(ENERGY_PRESETS.m3839.problem) as EnergyProblem;
    pr.bodies[0].M = [5, 0, 0];
    expect(solveEnergy(pr).note).toBe('reverse');
  });
  it('режим «найти путь»: обратная задача к «найти скорость»', () => {
    const pr = ENERGY_PRESETS.m3845.problem as EnergyProblem;
    const v = solveEnergy(pr).v;
    expect(solveEnergy({ ...pr, mode: 's', v1: v }).s).toBeCloseTo(pr.s, 9);
  });
  it('мутация: каток с нитью через ось вместо обода не даёт ответа 38.45', () => {
    const pr = structuredClone(ENERGY_PRESETS.m3845.problem) as EnergyProblem;
    pr.bodies[2].link!.to = 'c';
    expect(Math.abs(solveEnergy(pr).v - ENERGY_PRESETS.m3845.book.v)).toBeGreaterThan(0.05);
  });
});

describe('кинетическая энергия: файл проекта, схема и текст', () => {
  for (const [key, p] of Object.entries(ENERGY_PRESETS)) {
    it(`${key}: файл туда-обратно, схема и решение без NaN`, () => {
      const s = new EnergyStore({ preset: key as EnergyPresetKey });
      const { text } = s.exportProject(new Date(2026, 0, 1));
      const s2 = new EnergyStore();
      expect(s2.importProject(text)).toBe(true);
      expect(s2.get().problem).toEqual(p.problem);
      const pr = p.problem as EnergyProblem;
      const r = solveEnergy(pr);
      for (const t of [renderEnergy(pr, r).svg, JSON.stringify(energyDoc(pr, r, { explain: true }))]) expect(t).not.toMatch(/NaN|undefined|Infinity/);
    });
  }
  it('чужой и испорченный файл', () => {
    const s = new EnergyStore();
    expect(s.importProject(JSON.stringify({ format: 'statika-project', version: 2, module: 'inertia', problem: {} }))).toBe(false);
    expect(parseEnergy({ bodies: [{ kind: 'rotate' }], mode: 'v', v0: 0, s: 1, v1: 0 }).ok).toBe(false);
  });
  it('редактирование: тело, связь, удаление с перепривязкой, отмена', () => {
    const s = new EnergyStore();
    s.addBody();
    expect(s.get().problem.bodies[3].link).toEqual({ from: 2, at: 'c', to: 'R' });
    s.setKind(2, 'rotate');
    expect(s.get().problem.bodies[2].link!.to).toBe('R');
    expect(s.get().problem.bodies[3].link!.at).toBe('R');
    s.removeBody(1);
    const bs = s.get().problem.bodies;
    expect(bs.length).toBe(3);
    expect(bs[1].link!.from).toBe(0);
    expect(bs[2].link!.from).toBe(1);
    s.undo();
    s.undo();
    s.undo();
    expect(s.get().problem.bodies.length).toBe(3);
    expect(solveEnergy(s.get().problem).v).toBeCloseTo(ENERGY_PRESETS.m3845.book.v, 12);
  });
});
