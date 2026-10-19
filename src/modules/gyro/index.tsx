/** Раздел «Гироскоп» (Мещерский §40): гироскопический момент, давления на опоры, прецессия, равновесие оси; файл проекта. */
import type { Chrome, StatikaModule } from '../../app/module';
import { GyroStore, GYRO_MODULE } from './ui/store';
import { GyroView } from './ui/GyroView';
import { taskEntries } from '../../shared/tasks';
import { GYRO_PRESETS, type GyroPresetKey } from './presets';

const EXPLAIN_KEY = 'statika.explain';

export function createGyroModule(): StatikaModule {
  let explain = true;
  try {
    const v = localStorage.getItem(EXPLAIN_KEY);
    explain = v == null ? true : v === '1';
  } catch {
    /* по умолчанию */
  }
  const store = new GyroStore({ explain });
  store.subscribe(() => {
    try {
      localStorage.setItem(EXPLAIN_KEY, store.get().explain ? '1' : '0');
    } catch {
      /* не запомнится */
    }
  });
  function Screen({ chrome }: { chrome: Chrome }) {
    return <GyroView chrome={chrome} store={store} />;
  }
  return {
    id: GYRO_MODULE,
    tab: 'Гироскоп',
    store: {
      undo: store.undo,
      redo: store.redo,
      exportProject: store.exportProject,
      importProject: store.importProject,
      notify: store.notify,
      projectTitle: store.projectTitle,
    },
    Screen,
    tasks: taskEntries(GYRO_PRESETS),
    loadTask: (k) => store.loadPreset(k as GyroPresetKey),
  };
}
