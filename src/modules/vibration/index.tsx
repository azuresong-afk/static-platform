/** Раздел «Колебания систем» (Мещерский §54): малые колебания с несколькими степенями свободы; файл проекта. */
import type { Chrome, StatikaModule } from '../../app/module';
import { taskEntries } from '../../shared/tasks';
import { VIB_EXTRA_PRESETS, type VibExtraKey } from './extraPresets';
import { VIB_PRESETS, type VibPresetKey } from './presets';
import { VibStore, VIB_MODULE } from './ui/store';
import { VibView } from './ui/VibView';

const EXPLAIN_KEY = 'statika.explain';

export function createVibModule(): StatikaModule {
  let explain = true;
  try {
    const v = localStorage.getItem(EXPLAIN_KEY);
    explain = v == null ? true : v === '1';
  } catch {
    /* по умолчанию */
  }
  const store = new VibStore({ explain });
  store.subscribe(() => {
    try {
      localStorage.setItem(EXPLAIN_KEY, store.get().explain ? '1' : '0');
    } catch {
      /* не запомнится */
    }
  });
  function Screen({ chrome }: { chrome: Chrome }) {
    return <VibView chrome={chrome} store={store} />;
  }
  return {
    id: VIB_MODULE,
    tab: 'Колебания систем',
    store: {
      undo: store.undo,
      redo: store.redo,
      exportProject: store.exportProject,
      importProject: store.importProject,
      notify: store.notify,
      projectTitle: store.projectTitle,
    },
    Screen,
    tasks: taskEntries({ ...VIB_PRESETS, ...VIB_EXTRA_PRESETS }),
    loadTask: (k) => store.loadPreset(k as VibPresetKey | VibExtraKey),
  };
}
