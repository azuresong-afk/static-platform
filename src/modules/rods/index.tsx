/** Раздел «Стержневые системы» (Антонов, гл. 3, п. 4.5): узел или жёсткий брус на упругих стержнях; файл проекта. */
import type { Chrome, StatikaModule } from '../../app/module';
import { taskEntries } from '../../shared/tasks';
import { ROD_PRESETS, type RodPresetKey } from './presets';
import { RodsStore, RODS_MODULE } from './ui/store';
import { RodsView } from './ui/RodsView';

const EXPLAIN_KEY = 'statika.explain';

export function createRodsModule(): StatikaModule {
  let explain = true;
  try {
    const v = localStorage.getItem(EXPLAIN_KEY);
    explain = v == null ? true : v === '1';
  } catch {
    /* по умолчанию */
  }
  const store = new RodsStore({ explain });
  store.subscribe(() => {
    try {
      localStorage.setItem(EXPLAIN_KEY, store.get().explain ? '1' : '0');
    } catch {
      /* не запомнится */
    }
  });
  function Screen({ chrome }: { chrome: Chrome }) {
    return <RodsView chrome={chrome} store={store} />;
  }
  return {
    id: RODS_MODULE,
    tab: 'Стержневые системы',
    store: {
      undo: store.undo,
      redo: store.redo,
      exportProject: store.exportProject,
      importProject: store.importProject,
      notify: store.notify,
      projectTitle: store.projectTitle,
    },
    Screen,
    tasks: taskEntries(ROD_PRESETS),
    loadTask: (k) => store.loadPreset(k as RodPresetKey),
  };
}
