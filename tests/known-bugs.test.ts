/**
 * Поведение прототипа, похожее на ошибку. Перенесено как есть (решение по этапу 1);
 * тесты фиксируют текущее поведение, чтобы исправление было осознанным и видимым.
 * При исправлении тест меняется вместе с кодом.
 */
import { describe, expect, it } from 'vitest';
import { analyze } from '../src/core';
import { removeSeg } from '../src/model/edit';
import { idGenAfter } from '../src/model/ids';
import { loadPreset, presetStructure } from '../src/model/presets';

describe('известные особенности прототипа', () => {
  it('№1: при n > 3 статус «неопределима» ставится до проверки ранга', () => {
    // Балка на четырёх вертикальных катках: горизонталь не закреплена (ранг 2), но статус — «неопределима», степень n − 3 = 1.
    const s = presetStructure({
      pts: [[0, 0], [2, 0], [4, 0], [6, 0]],
      items: [0, 1, 2, 3].map((i) => ({ type: 'roller' as const, at: i, side: 'below' as const })),
    });
    const { solution, html } = analyze(s);
    expect(solution.rank).toBe(2);
    expect(solution.status).toBe('indeterminate');
    expect(html).toContain('Степень статической неопределимости: 1.');
  });

  it('№2: трапеция с q1 = −q2 теряет пару сил', () => {
    // Консоль в заделке, нагрузка 2…−2 кН/м на 3 м: равнодействующая 0, но момент ∫q·s ds = −3 кН·м.
    const s = presetStructure({
      pts: [[0, 0], [3, 0]],
      items: [
        { type: 'fixed', at: 0, side: 'left' },
        { type: 'dist', from: 0, to: 1, q1: 2, q2: -2, dir: 'down' },
      ],
    });
    const { solution } = analyze(s);
    expect(solution.status).toBe('ok');
    // Правильно было бы M_A = −3 (по часовой); прототип даёт 0.
    expect(Math.abs(solution.vals.M_A)).toBeLessThan(1e-12);
  });

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
