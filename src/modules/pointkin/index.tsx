/** Раздел «Кинематика точки» (Мещерский §10–12): скорость, ускорение, радиус кривизны; файл проекта. */
import type { Chrome, StatikaModule } from '../../app/module';
import { KinStore, KIN_MODULE } from './ui/store';
import { KinView } from './ui/KinView';
import { taskEntries } from '../../shared/tasks';
import { KIN_PRESETS, type KinPresetKey } from './presets';

const EXPLAIN_KEY = 'statika.explain';

export function createKinModule(): StatikaModule {
  let explain = true;
  try {
    const v = localStorage.getItem(EXPLAIN_KEY);
    explain = v == null ? true : v === '1';
  } catch {
    /* по умолчанию */
  }
  const store = new KinStore({ explain });
  store.subscribe(() => {
    try {
      localStorage.setItem(EXPLAIN_KEY, store.get().explain ? '1' : '0');
    } catch {
      /* не запомнится */
    }
  });
  function Screen({ chrome }: { chrome: Chrome }) {
    return <KinView chrome={chrome} store={store} />;
  }
  return {
    id: KIN_MODULE,
    tab: 'Кинематика точки',
    store: { undo: store.undo, redo: store.redo, exportProject: store.exportProject, importProject: store.importProject, notify: store.notify, projectTitle: store.projectTitle },
    Screen,
    tasks: taskEntries(KIN_PRESETS),
    loadTask: (k) => store.loadPreset(k as KinPresetKey),
  };
}
