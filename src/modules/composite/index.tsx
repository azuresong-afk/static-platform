/** Раздел «Составное сечение» (Антонов, задача 6). Своя модель и файл проекта. */
import type { Chrome, StatikaModule } from '../../app/module';
import { CompositeStore, COMPOSITE_MODULE } from './ui/store';
import { CompositeView } from './ui/CompositeView';
import { taskEntries } from '../../shared/tasks';
import { COMPOSITE_PRESETS, type CompositePresetKey } from './presets';

const EXPLAIN_KEY = 'statika.explain';

export function createCompositeModule(): StatikaModule {
  let explain = true;
  try {
    const v = localStorage.getItem(EXPLAIN_KEY);
    explain = v == null ? true : v === '1';
  } catch {
    /* по умолчанию */
  }
  const store = new CompositeStore({ explain });
  store.subscribe(() => {
    try {
      localStorage.setItem(EXPLAIN_KEY, store.get().explain ? '1' : '0');
    } catch {
      /* не запомнится */
    }
  });
  function Screen({ chrome }: { chrome: Chrome }) {
    return <CompositeView chrome={chrome} store={store} />;
  }
  return {
    id: COMPOSITE_MODULE,
    tab: 'Составное сечение',
    store: { undo: store.undo, redo: store.redo, exportProject: store.exportProject, importProject: store.importProject, notify: store.notify, projectTitle: store.projectTitle },
    Screen,
    tasks: taskEntries(COMPOSITE_PRESETS),
    loadTask: (k) => store.loadPreset(k as CompositePresetKey),
  };
}
