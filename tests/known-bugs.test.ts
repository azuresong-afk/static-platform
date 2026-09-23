/**
 * Поведение прототипа, похожее на ошибку, но не влияющее на расчёт. Перенесено как есть;
 * тесты фиксируют текущее поведение, чтобы исправление было осознанным и видимым.
 * Баги №1 и №2 (влияли на расчёт) исправлены — см. tests/fixes.test.ts.
 * При исправлении тест меняется вместе с кодом.
 */
import { describe, expect, it } from 'vitest';
import { analyze } from '../src/core';
import { removeSeg } from '../src/model/edit';
import { idGenAfter } from '../src/model/ids';
import { loadPreset } from '../src/model/presets';

describe('известные особенности прототипа', () => {
  it('№3: «что найти» хранится по имени, после новой точки отметка теряется', () => {
    const s = loadPreset('simple');
    const before = analyze(s, { notTarget: new Set(['R_E']) });
    expect(before.html).toContain('промежуточная');
    // Новая точка на первом участке: точки переименовываются, каток теперь в точке H, ключа R_E больше нет.
    const ids = idGenAfter(s);
    const n = { id: ids.node() };
    const first = s.segs[0];
    const s2 = {
      ...s,
      nodes: [...s.nodes, n],
      segs: [{ ...first, b: n.id, len: 1 }, { id: ids.seg(), a: n.id, b: first.b, dir: first.dir, len: 1 }, ...s.segs.slice(1)],
    };
    const after = analyze(s2, { notTarget: new Set(['R_E']) });
    expect(after.model.unknowns.map((u) => u.key)).toContain('R_H');
    expect(after.html).not.toContain('промежуточная');
  });

  it('№4: проверка не может показать «Ошибка» — невязка отсеивается раньше (статус noequilibrium)', () => {
    for (const k of ['simple', 'cantilever', 'rod', 'lever', 'gframe', 'pframe', 'post', 'bracket'] as const)
      expect(analyze(loadPreset(k)).html).not.toContain('Ошибка: сумма не равна нулю');
  });

  it('№7: «Убрать участок» никогда не срабатывает', () => {
    const s = loadPreset('simple');
    for (const q of s.segs) expect(removeSeg(s, q.id)).toMatchObject({ ok: false, msg: 'Этот участок нельзя убрать: участки пересекутся.' });
  });
});
