/** Поля режима «сложение скоростей с условием»: вид задачи и числа. */
import { LawField } from '../../../shared/ui/LawField';
import { COND_FIELDS, COND_KINDS, type CondKind, type CondProblem } from '../model/cond';
import type { RelStore } from './store';

export function CondEditor({ store, p }: { store: RelStore; p: CondProblem }) {
  return (
    <>
      <label className="field">
        <span>Задача</span>
        <select id="rcond-kind" value={p.kind} onChange={(e) => store.setCondKind(e.target.value as CondKind)}>
          {COND_KINDS.map(([k, t]) => (
            <option key={k} value={k}>
              {t}
            </option>
          ))}
        </select>
      </label>
      <div className="cgpar cg0">
        {COND_FIELDS[p.kind].map(([k, label]) =>
          k === 'dir' ? (
            <label className="field" key={k} style={{ gridColumn: '1 / -1' }}>
              <span>{label.split(':')[0]}</span>
              <select id={`rcond-${k}`} value={p.p[k] ?? ''} onChange={(e) => store.setCondPick(k, e.target.value)}>
                {p.kind === 'flag' ? (
                  <>
                    <option value="same">самолёт летит тем же курсом, что корабль</option>
                    <option value="opp">самолёт летит навстречу кораблю</option>
                  </>
                ) : (
                  <>
                    <option value="same">нарезки одного направления (обе правые или обе левые)</option>
                    <option value="opp">нарезки разных направлений</option>
                  </>
                )}
              </select>
            </label>
          ) : (
            <LawField
              key={k}
              id={`rcond-${k}`}
              label={label}
              wide={false}
              value={p.p[k] ?? ''}
              onType={(s) => store.typeCond(k, s)}
              onEnd={() => store.endSession(`c:${k}`)}
            />
          ),
        )}
      </div>
      <p className="empty">Единицы — любые согласованные (по условию задачи). Числа можно писать формулами: π/6, 9,81.</p>
    </>
  );
}
