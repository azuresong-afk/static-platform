/**
 * Пункты списка «Готовая задача», сгруппированные по источнику: задачник Мещерского по параграфам,
 * пособие Антонова по задачам и главам, затем другие примеры. Название в группе — без указания книги.
 */
import { groupTasks, type TaskEntry } from '../tasks';

export function PresetOptions({ items }: { items: TaskEntry[] }) {
  const groups = groupTasks(items);
  return (
    <>
      {groups.map((g) => (
        <optgroup
          key={g.group}
          label={g.book === 'mesh' ? `Мещерский, ${g.title}` : g.book === 'ant' ? `Антонов, ${g.title}` : g.book === 'yab' ? `Яблонский, ${g.title}` : g.title}
        >
          {g.items.map((it) => (
            <option key={it.key} value={it.key}>
              {it.info.label}
            </option>
          ))}
        </optgroup>
      ))}
    </>
  );
}
