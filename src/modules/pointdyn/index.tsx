/** Раздел «Динамика точки» (Мещерский §27; Антонов п. 9.1, 9.3): прямолинейное движение под действием сил; файл проекта. */
import type { Chrome, StatikaModule } from '../../app/module';
import { PointStore, POINT_MODULE } from './ui/store';
import { PointView } from './ui/PointView';
import { taskEntries } from '../../shared/tasks';
import { FIRST_PRESETS, PLANE_PRESETS, POINT_PRESETS } from './presets';
import type { AnyPresetKey } from './ui/store';

const EXPLAIN_KEY = 'statika.explain';

export function createPointModule(): StatikaModule {
  let explain = true;
  try {
    const v = localStorage.getItem(EXPLAIN_KEY);
    explain = v == null ? true : v === '1';
  } catch {
    /* по умолчанию */
  }
  const store = new PointStore({ explain });
  store.subscribe(() => {
    try {
      localStorage.setItem(EXPLAIN_KEY, store.get().explain ? '1' : '0');
    } catch {
      /* не запомнится */
    }
  });
  function Screen({ chrome }: { chrome: Chrome }) {
    return <PointView chrome={chrome} store={store} />;
  }
  return {
    id: POINT_MODULE,
    tab: 'Динамика точки',
    store: { undo: store.undo, redo: store.redo, exportProject: store.exportProject, importProject: store.importProject, notify: store.notify, projectTitle: store.projectTitle },
    Screen,
    tasks: [...taskEntries(POINT_PRESETS), ...taskEntries(FIRST_PRESETS), ...taskEntries(PLANE_PRESETS)],
    loadTask: (k) => store.loadPreset(k as AnyPresetKey),
  };
}
