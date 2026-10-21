import { describe, expect, it } from 'vitest';
import { defaults } from '../src/shared/machines/types';
import { VIRTUAL_MACHINES, VIRTUAL_MACHINE_PRESETS } from '../src/modules/virtual/machines';
import { machineDoc } from '../src/shared/machines/solution';

describe('Мещерский §46: каталог машин', () => {
  for (const [key, p] of Object.entries(VIRTUAL_MACHINE_PRESETS)) {
    it(`${key}: ${p.title}`, () => {
      const m = VIRTUAL_MACHINES.find((x) => x.id === p.machine)!;
      const s = m.solve({ ...defaults(m), ...p.vals });
      expect(s.ok).toBe(true);
      if (!s.ok) return;
      for (const [k, b] of Object.entries(p.book ?? {})) {
        const r = s.rows.find((x) => x.key === k)!;
        expect(r, k).toBeTruthy();
        expect(Math.abs(r.val - b), `${k}: ${r.val} vs ${b}`).toBeLessThanOrEqual((p.relTol ?? 0.005) * Math.abs(b) + 1e-12);
      }
      const doc = machineDoc(s, p, { explain: true });
      expect(JSON.stringify(doc)).toContain('совпадает с ответом книги');
      expect(s.fig.svg.length).toBeGreaterThan(50);
    });
  }
  it('неверные данные — сообщение, не падение', () => {
    for (const m of VIRTUAL_MACHINES) {
      const v = { ...defaults(m), ...Object.fromEntries(m.params.filter((p) => !p.zero).map((p) => [p.k, 0])) };
      const s = m.solve(v);
      expect(s.ok).toBe(false);
    }
  });
  it('рычаги: ответ 46.6 и 46.12 не зависят от порядка параметров', () => {
    const w = VIRTUAL_MACHINES.find((x) => x.id === 'windlass')!;
    const s = w.solve({ ...defaults(w), r1: 12, r2: 10 });
    expect(s.ok).toBe(false);
  });
});
