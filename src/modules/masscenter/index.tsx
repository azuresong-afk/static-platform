/** Раздел «Центр масс и плоское движение» (Мещерский §35–36, 39); файл проекта. */
import type { Chrome, StatikaModule } from '../../app/module';
import { McStore, MC_MODULE } from './ui/store';
import { McView } from './ui/McView';

const EXPLAIN_KEY = 'statika.explain';

export function createMcModule(): StatikaModule {
  let explain = true;
  try {
    const v = localStorage.getItem(EXPLAIN_KEY);
    explain = v == null ? true : v === '1';
  } catch {
    /* по умолчанию */
  }
  const store = new McStore({ explain });
  store.subscribe(() => {
    try {
      localStorage.setItem(EXPLAIN_KEY, store.get().explain ? '1' : '0');
    } catch {
      /* не запомнится */
    }
  });
  function Screen({ chrome }: { chrome: Chrome }) {
    return <McView chrome={chrome} store={store} />;
  }
  return {
    id: MC_MODULE,
    tab: 'Центр масс',
    store: { undo: store.undo, redo: store.redo, exportProject: store.exportProject, importProject: store.importProject, notify: store.notify, projectTitle: store.projectTitle },
    Screen,
  };
}
