/** Раздел «Растяжение-сжатие»: ступенчатый брус (Антонов, задачи 1.1 и 1.2). Своя модель и свой файл проекта. */
import type { Chrome, StatikaModule } from '../../app/module';
import { AxialStore, AXIAL_MODULE } from './ui/store';
import { AxialView } from './ui/AxialView';
import { taskEntries } from '../../shared/tasks';
import { AXIAL_PRESETS, type AxialPresetKey } from './presets';

const EXPLAIN_KEY = 'statika.explain';

export function createAxialModule(): StatikaModule {
  let explain = true;
  try {
    const v = localStorage.getItem(EXPLAIN_KEY);
    explain = v == null ? true : v === '1';
  } catch {
    /* настройка по умолчанию */
  }
  const store = new AxialStore({ explain });
  store.subscribe(() => {
    try {
      localStorage.setItem(EXPLAIN_KEY, store.get().explain ? '1' : '0');
    } catch {
      /* не запомнится */
    }
  });
  function Screen({ chrome }: { chrome: Chrome }) {
    return <AxialView chrome={chrome} store={store} />;
  }
  return {
    id: AXIAL_MODULE,
    tab: 'Растяжение-сжатие',
    store: {
      undo: store.undo,
      redo: store.redo,
      exportProject: store.exportProject,
      importProject: store.importProject,
      notify: store.notify,
      projectTitle: store.projectTitle,
    },
    Screen,
    tasks: taskEntries(AXIAL_PRESETS),
    loadTask: (k) => store.loadPreset(k as AxialPresetKey),
  };
}
