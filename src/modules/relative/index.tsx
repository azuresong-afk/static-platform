/** Раздел «Сложное движение точки» (Мещерский §22–23): сложение скоростей и ускорений, ускорение Кориолиса; файл проекта. */
import type { Chrome, StatikaModule } from '../../app/module';
import { RelStore, REL_MODULE } from './ui/store';
import { RelView } from './ui/RelView';
import { taskEntries } from '../../shared/tasks';
import { REL_PRESETS, type RelPresetKey } from './presets';

const EXPLAIN_KEY = 'statika.explain';

export function createRelModule(): StatikaModule {
  let explain = true;
  try {
    const v = localStorage.getItem(EXPLAIN_KEY);
    explain = v == null ? true : v === '1';
  } catch {
    /* по умолчанию */
  }
  const store = new RelStore({ explain });
  store.subscribe(() => {
    try {
      localStorage.setItem(EXPLAIN_KEY, store.get().explain ? '1' : '0');
    } catch {
      /* не запомнится */
    }
  });
  function Screen({ chrome }: { chrome: Chrome }) {
    return <RelView chrome={chrome} store={store} />;
  }
  return {
    id: REL_MODULE,
    tab: 'Сложное движение',
    store: { undo: store.undo, redo: store.redo, exportProject: store.exportProject, importProject: store.importProject, notify: store.notify, projectTitle: store.projectTitle },
    Screen,
    tasks: taskEntries(REL_PRESETS),
    loadTask: (k) => store.loadPreset(k as RelPresetKey),
  };
}
