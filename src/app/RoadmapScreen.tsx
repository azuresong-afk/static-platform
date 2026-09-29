/** Вкладка «Дорожная карта»: что уже работает и что появится дальше, по блокам в порядке работы. */
import type { Chrome } from './module';
import { ROADMAP, type RoadmapItem } from './roadmap';

export function RoadmapScreen({ chrome }: { chrome: Chrome }) {
  const all = ROADMAP.flatMap((b) => b.items);
  const done = all.filter((i) => i.status === 'done').length;
  const next = all.find((i) => i.status !== 'done');
  const row = (i: RoadmapItem) => (
    <li key={i.id} className={`rm-item rm-${i.status}${i === next ? ' rm-next' : ''}`} data-rm={i.id}>
      <span className="rm-mark" aria-hidden="true">
        {i.status === 'done' ? '✓' : ''}
      </span>
      <div className="rm-body">
        <div className="rm-title">
          {i.title}
          {i === next && <span className="rm-badge">следующий</span>}
        </div>
        <p className="rm-what">{i.what}</p>
        <p className="rm-refs">{i.refs}</p>
      </div>
      {i.tab && (
        <button type="button" className="rm-open" onClick={() => chrome.goto(i.tab!)}>
          Открыть
        </button>
      )}
    </li>
  );
  return (
    <div className="wrap rm-page">
      {chrome.tabs}
      <header className="top">
        <div>
          <h1>Дорожная карта</h1>
          <p className="lede">
            Готово {done} из {all.length}. Блоки идут в порядке работы: сначала статика, затем динамика, кинематика и аналитическая механика. Эталоны — задачник Мещерского (1975) и «Прикладная механика» Антонова и др.; правила знаков, которые различаются между учебниками, настраиваются в самих разделах.
          </p>
        </div>
      </header>
      <div className="rm-grid">
        {ROADMAP.map((b) => (
          <section key={b.title} className="panel rm-block" aria-label={b.title}>
            <h2>
              {b.title} <span className="rm-count">{b.items.filter((i) => i.status === 'done').length}/{b.items.length}</span>
            </h2>
            <p className="rm-note">{b.note}</p>
            <ol className="rm-list">{b.items.map(row)}</ol>
          </section>
        ))}
      </div>
    </div>
  );
}
