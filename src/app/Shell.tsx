/**
 * Оболочка приложения: вкладки разделов, открытие и сохранение файлов, общие клавиши.
 * Состояние каждого раздела живёт в его хранилище и сохраняется при переключении вкладок.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { readEnvelope } from '../shared/projectFile';
import { download, FileBar, type FileActions } from './FileBar';
import type { PlannedModule, StatikaModule } from './module';

const TAB_KEY = 'statika.tab';

function initialTab(modules: StatikaModule[]): string {
  const ids = modules.map((m) => m.id);
  const hash = location.hash.slice(1);
  if (ids.includes(hash)) return hash;
  try {
    const v = localStorage.getItem(TAB_KEY);
    if (v && ids.includes(v)) return v;
  } catch {
    /* хранилище недоступно */
  }
  return ids[0];
}

export function Shell({ modules, planned }: { modules: StatikaModule[]; planned: PlannedModule[] }) {
  const [active, setActive] = useState(() => initialTab(modules));
  const m = modules.find((x) => x.id === active) ?? modules[0];

  const switchTo = useCallback((id: string) => {
    setActive(id);
    try {
      localStorage.setItem(TAB_KEY, id);
    } catch {
      /* вкладка не запомнится */
    }
  }, []);

  // Файл открывается в том разделе, к которому относится; вкладка переключается сама.
  const openText = (text: string, name?: string) => {
    const env = readEnvelope(text);
    if (env.ok) {
      // Активный раздел открывает и файлы родственных разделов, иначе — переход на вкладку раздела файла.
      const target = m.id === env.module || m.accepts?.includes(env.module) ? m : modules.find((x) => x.id === env.module);
      if (!target) {
        const p = planned.find((x) => x.id === env.module);
        const why = p ? `раздел «${p.tab}» ещё в разработке` : `раздела «${env.module}» нет в этой версии приложения`;
        m.store.notify(`Не удалось открыть${name ? ` «${name}»` : ' файл'}: ${why}.`, 'bad');
        return;
      }
      if (target !== m) switchTo(target.id);
      target.store.importProject(text, name);
      return;
    }
    m.store.importProject(text, name);
  };

  const actions: FileActions = {
    openFile: (f) => void f.text().then((t) => openText(t, f.name)),
    save: () => {
      const { name, text } = m.store.exportProject();
      download(name, text);
      m.store.notify(`Проект сохранён в файл «${name}».`, 'ok');
    },
    print: () => {
      // Имя PDF в диалоге печати берётся из заголовка страницы.
      const prev = document.title;
      document.title = `${m.store.projectTitle()} — решение`;
      window.addEventListener('afterprint', () => (document.title = prev), { once: true });
      window.print();
    },
  };
  const openDialog = useRef<() => void>(() => {});
  const act = useRef(actions);
  act.current = actions;
  const store = useRef(m.store);
  store.current = m.store;

  // Ctrl+S — сохранить, Ctrl+O — открыть (работают и в полях ввода).
  // Ctrl+Z — отменить, Ctrl+Shift+Z и Ctrl+Y — повторить. В текстовом поле работает отмена браузера.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.code === 'KeyS' && !e.shiftKey) {
        e.preventDefault();
        act.current.save();
        return;
      }
      if (e.code === 'KeyO' && !e.shiftKey) {
        e.preventDefault();
        openDialog.current();
        return;
      }
      const el = document.activeElement as HTMLInputElement | null;
      if (el && el.tagName === 'INPUT' && el.type === 'text') return;
      if (e.code === 'KeyZ' && !e.shiftKey) {
        e.preventDefault();
        store.current.undo();
      } else if ((e.code === 'KeyZ' && e.shiftKey) || e.code === 'KeyY') {
        e.preventDefault();
        store.current.redo();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Файл проекта можно перетащить на страницу.
  useEffect(() => {
    const over = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) e.preventDefault();
    };
    const drop = (e: DragEvent) => {
      const f = e.dataTransfer?.files?.[0];
      if (!f) return;
      e.preventDefault();
      act.current.openFile(f);
    };
    window.addEventListener('dragover', over);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragover', over);
      window.removeEventListener('drop', drop);
    };
  }, []);

  const tabs = (
    <nav className="tabs" role="tablist" aria-label="Разделы">
      {modules.map((x) => (
        <button key={x.id} type="button" role="tab" data-tab={x.id} aria-selected={x.id === m.id} onClick={() => switchTo(x.id)}>
          {x.tab}
        </button>
      ))}
      {planned.map((p) => (
        <button key={p.id} type="button" role="tab" data-tab={p.id} aria-selected={false} disabled title={`Этап ${p.stage} дорожной карты — в разработке`}>
          {p.tab}
          <small>этап {p.stage}</small>
        </button>
      ))}
    </nav>
  );
  const files = <FileBar actions={actions} register={(f) => (openDialog.current = f)} />;
  return <m.Screen key={m.id} chrome={{ tabs, files, goto: switchTo }} />;
}
