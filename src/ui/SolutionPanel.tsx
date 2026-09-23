/** Панель решения; на шагах 1–3 мастера решение скрыто. */
import type { Doc } from '../text/doc';
import { DocView } from './DocView';
import { useStore } from './useStore';

export function SolutionPanel({ doc }: { doc: Doc }) {
  const [st, store] = useStore();
  const early = st.wiz.on && st.wiz.step < 4;
  return (
    <section className="panel" aria-label="Решение">
      <div className="sol-head">
        <h2>Решение</h2>
        <label className="toggle">
          <input type="checkbox" checked={st.explain} onChange={(e) => store.setExplain(e.target.checked)} />
          Подробные пояснения
        </label>
      </div>
      <p className="empty" id="solwait" hidden={!early}>
        Решение появится на шаге 5, когда схема будет собрана.
      </p>
      <div id="solution" hidden={early}>
        <DocView doc={doc} />
      </div>
    </section>
  );
}
