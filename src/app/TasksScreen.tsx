/**
 * «Задачник»: все готовые задачи приложения по книгам — задачник Мещерского по отделам и параграфам,
 * пособие Антонова по задачам и главам, примеры приложения по разделам. Поиск по номеру и словам;
 * щелчок открывает задачу в её разделе.
 */
import { useMemo, useState } from 'react';
import { meshPart, taskInfo, type Book, type TaskInfo } from '../shared/tasks';
import type { Chrome, StatikaModule } from './module';
import { NAV_BLOCKS } from './nav';

export const TASKS_TAB = 'tasks';

interface Row {
  mod: StatikaModule;
  key: string;
  title: string;
  info: TaskInfo;
}

const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е').replace(/,/g, '.').replace(/\s+/g, ' ').trim();

const cmp = (a: number[], b: number[]) => {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? -1) - (b[i] ?? -1);
    if (d) return d;
  }
  return 0;
};

/** Группы с подзаголовками: [заголовок группы, задачи]. */
function groupBy(rows: Row[], key: (r: Row) => string, title: (r: Row) => string): { id: string; title: string; rows: Row[] }[] {
  const m = new Map<string, { id: string; title: string; rows: Row[] }>();
  for (const r of rows) {
    const k = key(r);
    const g = m.get(k);
    if (g) g.rows.push(r);
    else m.set(k, { id: k, title: title(r), rows: [r] });
  }
  return [...m.values()];
}

export function TasksScreen({ chrome, modules }: { chrome: Chrome; modules: StatikaModule[] }) {
  const [q, setQ] = useState('');
  const [book, setBook] = useState<Book | 'all'>('all');
  // Порядок разделов — как в навигации.
  const order = NAV_BLOCKS.flatMap((b) => b.tabs);
  const all: Row[] = useMemo(
    () =>
      [...modules]
        .sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))
        .flatMap((mod) => (mod.tasks ?? []).map((t) => ({ mod, key: t.key, title: t.title, info: taskInfo(t.title) }))),
    [modules],
  );
  const nq = norm(q);
  const rows = all.filter((r) => (book === 'all' || r.info.book === book) && (!nq || norm(r.title + ' ' + r.mod.tab).includes(nq)));
  const count = (b: Book) => all.filter((r) => r.info.book === b).length;
  const open = (r: Row) => {
    r.mod.loadTask?.(r.key);
    chrome.goto(r.mod.id);
  };

  const item = (r: Row) => {
    const [num, rest] =
      r.info.book === 'mesh'
        ? [r.info.num, r.info.label.slice(r.info.num.length).replace(/^:\s*/, '')]
        : r.info.book === 'ant'
          ? ['', r.info.label]
          : ['', r.title];
    return (
      <li key={r.mod.id + ':' + r.key}>
        <button type="button" className="tk-item" data-task={`${r.mod.id}:${r.key}`} onClick={() => open(r)}>
          {num && <span className="tk-num">{num}</span>}
          <span className="tk-title">{rest}</span>
          <span className="tk-sec">{r.mod.tab}</span>
        </button>
      </li>
    );
  };

  const mesh = rows.filter((r) => r.info.book === 'mesh').sort((a, b) => cmp(a.info.order, b.info.order));
  const ant = rows.filter((r) => r.info.book === 'ant').sort((a, b) => cmp(a.info.order, b.info.order));
  const other = rows.filter((r) => r.info.book === 'other');
  const meshParts = groupBy(
    mesh,
    (r) => meshPart(r.info.order[0]).id,
    (r) => meshPart(r.info.order[0]).title,
  );

  return (
    <div className="wrap tk-page">
      {chrome.tabs}
      <header className="top">
        <div>
          <h1>Задачник</h1>
          <p className="lede">
            Все готовые задачи приложения — по книгам и параграфам. Найдите номер своей задачи и откройте её: она загрузится в нужный раздел, данные можно сразу
            менять.
          </p>
        </div>
        <div className="tk-search">
          <input
            type="search"
            id="tksearch"
            placeholder="Номер или слова: 46.19, маятник, сосуд…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Поиск задачи"
          />
          <div className="seg tk-books" role="group" aria-label="Книга">
            {(
              [
                ['all', `Все (${all.length})`],
                ['mesh', `Мещерский (${count('mesh')})`],
                ['ant', `Антонов (${count('ant')})`],
                ['other', `Примеры (${count('other')})`],
              ] as [Book | 'all', string][]
            ).map(([k, label]) => (
              <button key={k} type="button" data-book={k} aria-pressed={book === k} onClick={() => setBook(k)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>
      {!rows.length && <p className="empty tk-none">Ничего не найдено. Попробуйте номер задачи («46.19») или слово из условия.</p>}
      {mesh.length > 0 && (
        <section className="panel tk-book" aria-label="Мещерский">
          <h2>
            Мещерский И. В. Сборник задач по теоретической механике <span className="tk-ed">1975 · {mesh.length}</span>
          </h2>
          <div className="tk-cols">
            {meshParts.map((part) => (
              <div key={part.id} className="tk-part">
                <h3>{part.title}</h3>
                {groupBy(
                  part.rows,
                  (r) => r.info.group,
                  (r) => r.info.groupTitle,
                ).map((g) => (
                  <div key={g.id} className="tk-group">
                    <h4>{g.title}</h4>
                    <ul>{g.rows.map(item)}</ul>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}
      <div className="tk-pair">
        {ant.length > 0 && (
          <section className="panel tk-book" aria-label="Антонов">
            <h2>
              Антонов С. И. и др. Прикладная механика <span className="tk-ed">РХТУ, 2004 · {ant.length}</span>
            </h2>
            {groupBy(
              ant,
              (r) => r.info.group,
              (r) => r.info.groupTitle,
            ).map((g) => (
              <div key={g.id} className="tk-group">
                <h4>{g.title}</h4>
                <ul>{g.rows.map(item)}</ul>
              </div>
            ))}
          </section>
        )}
        {other.length > 0 && (
          <section className="panel tk-book tk-other" aria-label="Примеры">
            <h2>
              Примеры приложения <span className="tk-ed">{other.length}</span>
            </h2>
            {groupBy(
              other,
              (r) => r.mod.id,
              (r) => r.mod.tab,
            ).map((g) => (
              <div key={g.id} className="tk-group">
                <h4>{g.title}</h4>
                <ul>{g.rows.map(item)}</ul>
              </div>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
