/** Раздел «Удар и колебания» (Мещерский §32, 53; Антонов, гл. 10): груз на упругом элементе, удар; файл проекта. */
import type { Chrome, StatikaModule } from '../../app/module';
import { taskEntries } from '../../shared/tasks';
import { OSC_PRESETS, type OscPresetKey } from './presets';
import { OscStore, OSC_MODULE } from './ui/store';
import { OscView } from './ui/OscView';

const EXPLAIN_KEY = 'statika.explain';

export function createOscModule(): StatikaModule {
  let explain = true;
  try {
    const v = localStorage.getItem(EXPLAIN_KEY);
    explain = v == null ? true : v === '1';
  } catch {
    /* по умолчанию */
  }
  const store = new OscStore({ explain });
  store.subscribe(() => {
    try {
      localStorage.setItem(EXPLAIN_KEY, store.get().explain ? '1' : '0');
    } catch {
      /* не запомнится */
    }
  });
  function Screen({ chrome }: { chrome: Chrome }) {
    return <OscView chrome={chrome} store={store} />;
  }
  return {
    id: OSC_MODULE,
    tab: 'Удар и колебания',
    store: {
      undo: store.undo,
      redo: store.redo,
      exportProject: store.exportProject,
      importProject: store.importProject,
      notify: store.notify,
      projectTitle: store.projectTitle,
    },
    Screen,
    tasks: taskEntries(OSC_PRESETS),
    loadTask: (k) => store.loadPreset(k as OscPresetKey),
  };
}
