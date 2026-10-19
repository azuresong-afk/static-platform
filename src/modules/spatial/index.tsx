/** Раздел «Пространственное движение тела» (Мещерский §19, 20, 25, 40): неподвижная точка, углы Эйлера, гироскоп; файл проекта. */
import type { Chrome, StatikaModule } from '../../app/module';
import { taskEntries } from '../../shared/tasks';
import { SP_PRESETS, type SpPresetKey } from './presets';
import { SpStore, SPATIAL_MODULE } from './ui/store';
import { SpatialView } from './ui/SpatialView';

const EXPLAIN_KEY = 'statika.explain';

export function createSpatialModule(): StatikaModule {
  let explain = true;
  try {
    const v = localStorage.getItem(EXPLAIN_KEY);
    explain = v == null ? true : v === '1';
  } catch {
    /* по умолчанию */
  }
  const store = new SpStore({ explain });
  store.subscribe(() => {
    try {
      localStorage.setItem(EXPLAIN_KEY, store.get().explain ? '1' : '0');
    } catch {
      /* не запомнится */
    }
  });
  function Screen({ chrome }: { chrome: Chrome }) {
    return <SpatialView chrome={chrome} store={store} />;
  }
  return {
    id: SPATIAL_MODULE,
    tab: 'Пространственное движение',
    store: {
      undo: store.undo,
      redo: store.redo,
      exportProject: store.exportProject,
      importProject: store.importProject,
      notify: store.notify,
      projectTitle: store.projectTitle,
    },
    Screen,
    tasks: taskEntries(SP_PRESETS),
    loadTask: (k) => store.loadPreset(k as SpPresetKey),
  };
}
