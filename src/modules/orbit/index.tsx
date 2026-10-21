/** Раздел «Тяготение и орбиты» (Мещерский §28, 30, 50, 51): космические скорости, кеплерово движение, импульс скорости, движение по линии центров; файл проекта. */
import type { Chrome, StatikaModule } from '../../app/module';
import { OrbStore, ORBIT_MODULE } from './ui/store';
import { OrbitView } from './ui/OrbitView';
import { taskEntries } from '../../shared/tasks';
import { ORB_PRESETS, type OrbPresetKey } from './presets';

const EXPLAIN_KEY = 'statika.explain';

export function createOrbitModule(): StatikaModule {
  let explain = true;
  try {
    const v = localStorage.getItem(EXPLAIN_KEY);
    explain = v == null ? true : v === '1';
  } catch {
    /* по умолчанию */
  }
  const store = new OrbStore({ explain });
  store.subscribe(() => {
    try {
      localStorage.setItem(EXPLAIN_KEY, store.get().explain ? '1' : '0');
    } catch {
      /* не запомнится */
    }
  });
  function Screen({ chrome }: { chrome: Chrome }) {
    return <OrbitView chrome={chrome} store={store} />;
  }
  return {
    id: ORBIT_MODULE,
    tab: 'Тяготение и орбиты',
    store: {
      undo: store.undo,
      redo: store.redo,
      exportProject: store.exportProject,
      importProject: store.importProject,
      notify: store.notify,
      projectTitle: store.projectTitle,
    },
    Screen,
    tasks: taskEntries(ORB_PRESETS),
    loadTask: (k) => store.loadPreset(k as OrbPresetKey),
  };
}
