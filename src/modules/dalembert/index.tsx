/** Раздел «Принцип Даламбера» (Мещерский §41–42; Антонов п. 9.10): динамические реакции вращающегося тела; файл проекта. */
import type { Chrome, StatikaModule } from '../../app/module';
import { ShaftStore, DALEMBERT_MODULE } from './ui/store';
import { ShaftView } from './ui/ShaftView';
import { taskEntries } from '../../shared/tasks';
import { SHAFT_PRESETS, type ShaftPresetKey } from './presets';

const EXPLAIN_KEY = 'statika.explain';

export function createDalembertModule(): StatikaModule {
  let explain = true;
  try {
    const v = localStorage.getItem(EXPLAIN_KEY);
    explain = v == null ? true : v === '1';
  } catch {
    /* по умолчанию */
  }
  const store = new ShaftStore({ explain });
  store.subscribe(() => {
    try {
      localStorage.setItem(EXPLAIN_KEY, store.get().explain ? '1' : '0');
    } catch {
      /* не запомнится */
    }
  });
  function Screen({ chrome }: { chrome: Chrome }) {
    return <ShaftView chrome={chrome} store={store} />;
  }
  return {
    id: DALEMBERT_MODULE,
    tab: 'Принцип Даламбера',
    store: { undo: store.undo, redo: store.redo, exportProject: store.exportProject, importProject: store.importProject, notify: store.notify, projectTitle: store.projectTitle },
    Screen,
    tasks: taskEntries(SHAFT_PRESETS),
    loadTask: (k) => store.loadPreset(k as ShaftPresetKey),
  };
}
