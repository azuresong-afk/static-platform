/** Тело переменной массы: уравнение Мещерского, формула Циолковского, многоступенчатые ракеты (Мещерский §45). */
import { describe, expect, it } from 'vitest';
import { renderLine, renderStages } from '../src/modules/varmass/draw/varmass';
import { solveLine, solveStages, type LineResult, type StagesProblem, type StagesResult } from '../src/modules/varmass/model/varmass';
import { line, VAR_PRESETS } from '../src/modules/varmass/presets';
import { lineDoc, stagesDoc } from '../src/modules/varmass/text/solution';
import { parseVar, VmStore } from '../src/modules/varmass/ui/store';
import { taskInfo } from '../src/shared/tasks';
import { docText } from './helpers/doctext';

const G = 9.81;
function rng(seed: number) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;
}
function gotLine(r: LineResult): Record<string, number> {
  const e = r.end!;
  const g: Record<string, number> = { t: e.t, x: e.x, v: e.v, m: e.m, ratio: r.start!.m / e.m, burn: r.start!.m - e.m, A: r.A };
  if (r.coast) g.H = r.coast.x;
  return g;
}
function gotStages(r: StagesResult): Record<string, number> {
  const g: Record<string, number> = { fuel: 1 - 1 / r.stages[0].z };
  r.stages.forEach((s, i) => {
    g['z' + (i + 1)] = s.z;
    g['v' + (i + 1)] = s.v;
    if (s.G != null) {
      g['G' + (i + 1)] = s.G;
      g['P' + (i + 1)] = s.P!;
      g['Q' + (i + 1)] = s.Q!;
    }
  });
  return g;
}

describe('готовые задачи: ответы книги', () => {
  for (const [key, p] of Object.entries(VAR_PRESETS))
    it(p.title, () => {
      let got: Record<string, number>;
      let text: string, svg: string;
      if (p.problem.mode === 'line') {
        const r = solveLine(p.problem.line);
        expect(r.ok, key + r.errors.join()).toBe(true);
        expect(r.notes, key).toEqual([]);
        got = gotLine(r);
        text = docText(lineDoc(p.problem.line, r, { explain: true }));
        svg = renderLine(p.problem.line, r).svg;
      } else {
        const r = solveStages(p.problem.stages);
        expect(r.ok, key + r.errors.join()).toBe(true);
        got = gotStages(r);
        text = docText(stagesDoc(p.problem.stages, r, { explain: true }));
        svg = renderStages(p.problem.stages, r).svg;
      }
      const rel = (p as { relTol?: number }).relTol ?? 0.005;
      const abs = (p as { absTol?: number }).absTol ?? 1e-9;
      for (const [k, book] of Object.entries((p as { book?: Record<string, number> }).book ?? {}))
        expect(Math.abs(got[k] - book), `${k}: ${got[k]} против ${book}`).toBeLessThanOrEqual(book === 0 ? abs : rel * Math.abs(book));
      expect(text).not.toMatch(/NaN|undefined|Infinity/);
      expect(svg).not.toMatch(/NaN|undefined/);
      expect(taskInfo(p.title)).toMatchObject({ book: 'mesh', group: 'mesh:45' });
    });
  it('45.3: высоты в моменты 10 и 50 с — 0,54 и 18,4 км', () => {
    const at = (t: number) => solveLine({ ...VAR_PRESETS.m453.problem.line, t1: t }).end!.x;
    expect(at(10) / 1000).toBeCloseTo(0.54, 2);
    expect(at(50) / 1000).toBeCloseTo(18.4, 1);
  });
  it('45.39: числа книги z₁ = 3,2, z₂ = 4 дают 6118 м/с, а не 6000; оптимум — z_i пропорциональны s_i', () => {
    const r = solveStages({
      ask: 'speeds',
      stages: [
        { ve: 2400, z: 3.2, s: 4, vt: 0 },
        { ve: 2400, z: 4, s: 5, vt: 0 },
      ],
      q: 100,
      v: 0,
    });
    expect(r.vEnd).toBeCloseTo(2400 * Math.log(12.8), 9);
    const o = solveStages(VAR_PRESETS.m4539.problem.stages);
    expect(o.stages[0].z / o.stages[1].z).toBeCloseTo(4 / 5, 12);
    expect(o.vEnd).toBeCloseTo(6000, 9);
  });
  it('45.19: работа тяги положительна и больше кинетической энергии (разность — энергия, унесённая газами)', () => {
    const r = solveLine(VAR_PRESETS.m4519.problem.line);
    const KE = (r.end!.m * r.end!.v ** 2) / 2;
    expect(r.A).toBeGreaterThan(KE);
    expect(Math.abs(KE / ((250 * (2000 * Math.log(4)) ** 2) / 2) - 1)).toBeLessThan(1e-9);
  });
});

describe('независимые проверки', () => {
  it('формула Циолковского при случайных законах массы: v = v₀ + v_e ln(m₀/m) − g·sin α·t', () => {
    const rnd = rng(5);
    for (let i = 0; i < 40; i++) {
      const ve = 500 + 3000 * rnd(),
        a = 0.001 + 0.02 * rnd(),
        al = 180 * rnd() - 90,
        v0 = 100 * rnd() - 50;
      const law = i % 2 ? `1 - ${a}t` : `exp(-${a}t)`;
      const t1 = (i % 2 ? 0.8 / a : 2 / a) * rnd();
      const pr = line({ mLaw: law, ve, alpha: al, v0, t1: Math.max(0.1, t1), grav: i % 3 ? 'uniform' : 'none' });
      const r = solveLine(pr);
      expect(r.ok, r.errors.join()).toBe(true);
      const m = r.end!.m;
      const vt = v0 + ve * Math.log(1 / m) - (pr.grav === 'none' ? 0 : G * Math.sin((al * Math.PI) / 180) * r.end!.t);
      expect(r.end!.v).toBeCloseTo(vt, 6);
      expect(r.tsiol!).toBeCloseTo(vt, 9);
    }
  });
  it('частицы из покоя: d(mv)/dt = F — количество движения растёт как F·t', () => {
    const rnd = rng(9);
    for (let i = 0; i < 20; i++) {
      const m0 = 1 + 5 * rnd(),
        q = 0.1 + rnd(),
        F = 1 + 10 * rnd(),
        v0 = 5 * rnd();
      const pr = line({ alpha: 0, grav: 'none', mLaw: `${m0} + ${q}t`, part: 'zeroAbs', force: String(F), v0, t1: 1 + 5 * rnd() });
      const r = solveLine(pr);
      const e = r.end!;
      expect(e.m * e.v).toBeCloseTo(m0 * v0 + F * e.t, 7);
    }
  });
  it('заданное ускорение: x = v₀t + wt²/2, масса — m₀e^(−λt) при силах, пропорциональных массе', () => {
    const rnd = rng(13);
    for (let i = 0; i < 30; i++) {
      const w = 1 + 20 * rnd(),
        ve = 500 + 2000 * rnd(),
        al = 90 * rnd(),
        f = 0.3 * rnd(),
        v0 = 10 * rnd(),
        t1 = 1 + 20 * rnd();
      const r = solveLine(line({ massMode: 'accel', w, m0: 2, ve, alpha: al, f, v0, t1 }));
      expect(r.end!.x).toBeCloseTo(v0 * t1 + (w * t1 * t1) / 2, 6);
      expect(r.end!.m).toBeCloseTo(2 * Math.exp(-r.expRate! * t1), 9);
    }
  });
  it('наименьший стартовый вес: малое перераспределение z при той же скорости увеличивает вес', () => {
    const rnd = rng(21);
    for (let i = 0; i < 30; i++) {
      const n = 2 + Math.floor(rnd() * 3);
      const stg = Array.from({ length: n }, () => ({ ve: 2000 + 1000 * rnd(), z: 2, s: 3 + 5 * rnd(), vt: 0 }));
      const vMax = stg.reduce((s, x) => s + x.ve * Math.log(x.s), 0);
      const pr: StagesProblem = { ask: 'optimal', stages: stg, q: 100, v: vMax * (0.3 + 0.4 * rnd()) };
      const r = solveStages(pr);
      if (!r.ok) continue;
      expect(r.vEnd).toBeCloseTo(pr.v, 6);
      // Сдвиг: z₁ увеличиваем, z₂ уменьшаем так, чтобы v не изменилась.
      const d = 0.01;
      const z = r.stages.map((s) => s.z);
      const z1 = z[0] * Math.exp(d / stg[0].ve),
        z2 = z[1] * Math.exp(-d / stg[1].ve);
      const W = (zs: number[]) => zs.reduce((p, zz, k) => p * ((zz * (stg[k].s - 1)) / (stg[k].s - zz)), 100);
      expect(W([z1, z2, ...z.slice(2)])).toBeGreaterThan(r.G1! * (1 - 1e-12));
      expect(W(z)).toBeCloseTo(r.G1!, 6);
    }
  });
  it('трение удерживает тело: при v₀ = 0 и малой тяге движения нет; ошибки данных', () => {
    const st = solveLine(line({ alpha: 0, mLaw: '100 - 0,01t', ve: 100, f: 0.5, stop: 'dist', s1: 1 }));
    expect(st.reason).toBe('stuck');
    expect(docText(lineDoc(line({ alpha: 0, mLaw: '100 - 0,01t', ve: 100, f: 0.5, stop: 'dist', s1: 1 }), st))).toContain('трение удерживает');
    expect(solveLine(line({ mLaw: 'sin(' })).ok).toBe(false);
    expect(solveLine(line({ mLaw: '-1' })).errors.join()).toContain('положительной');
    expect(solveLine(line({ mLaw: '1 - 0,1t', t1: 20 })).errors.join()).toContain('неположительной');
    expect(solveLine(line({ stop: 'mass', m1: 2 })).errors.join()).toContain('меньше начальной');
    expect(solveLine(line({ massMode: 'accel', part: 'zeroRel' })).ok).toBe(false);
    expect(solveStages({ ask: 'weights', stages: [{ ve: 2000, z: 5, s: 4, vt: 0 }], q: 1, v: 0 }).errors.join()).toContain('меньше s');
    expect(solveStages({ ask: 'optimal', stages: [{ ve: 2000, z: 2, s: 4, vt: 0 }], q: 1, v: 1e5 }).errors.join()).toContain('недостижима');
    expect(docText(stagesDoc({ ask: 'speeds', stages: [], q: 1, v: 1 }, solveStages({ ask: 'speeds', stages: [], q: 1, v: 1 })))).toContain('проверьте данные');
  });
});

describe('хранилище и файл', () => {
  it('режимы, правки, ступени, отмена, файл', () => {
    const st = new VmStore({ preset: 'm4516' });
    st.typeLine('f', 0.2);
    st.typeLaw('mLaw', '50 - t');
    st.setLine('stop', 'rest');
    st.setCoast(true);
    st.setMode('stages');
    st.setAsk('weights');
    st.addStage();
    st.typeStage(1, 's', 6);
    st.typeStagesTop('q', 250);
    const file = st.exportProject(new Date(2026, 0, 1));
    const st2 = new VmStore();
    expect(st2.importProject(file.text)).toBe(true);
    expect(st2.get().problem).toEqual(st.get().problem);
    st.removeStage(0);
    expect(st.get().problem.stages.stages.length).toBe(1);
    st.undo();
    expect(st.get().problem.stages.stages.length).toBe(2);
  });
  it('неполные данные и чужой файл — ошибка', () => {
    const raw = JSON.parse(JSON.stringify({ mode: 'line', line: VAR_PRESETS.m453.problem.line }));
    expect(parseVar(raw).ok).toBe(true);
    expect(parseVar({ ...raw, mode: 'orbit' }).ok).toBe(false);
    expect(parseVar({ ...raw, line: { ...raw.line, part: 'magic' } }).ok).toBe(false);
    expect(parseVar({ mode: 'stages', stages: { ask: 'z', q: 1, v: 1, stages: [] } }).ok).toBe(false);
    expect(new VmStore().importProject('{"format":"statika","module":"frames","problem":{}}')).toBe(false);
  });
});
