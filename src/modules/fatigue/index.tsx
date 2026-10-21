/** Раздел «Усталостная прочность» (Антонов, гл. 11): цикл, предел выносливости детали, коэффициенты запаса; файл проекта. */
import type { Chrome, StatikaModule } from '../../app/module';
import { taskEntries } from '../../shared/tasks';
import { FATIGUE_PRESETS, type FatiguePresetKey } from './presets';
import { FatigueView } from './ui/FatigueView';
import { FATIGUE_MODULE, FatigueStore } from './ui/store';

const EXPLAIN_KEY = 'statika.explain';

export function createFatigueModule(): StatikaModule {
  let explain = true;
  try {
    const v = localStorage.getItem(EXPLAIN_KEY);
    explain = v == null ? true : v === '1';
  } catch {
    /* по умолчанию */
  }
  const store = new FatigueStore({ explain });
  store.subscribe(() => {
    try {
      localStorage.setItem(EXPLAIN_KEY, store.get().explain ? '1' : '0');
    } catch {
      /* не запомнится */
    }
  });
  function Screen({ chrome }: { chrome: Chrome }) {
    return <FatigueView chrome={chrome} store={store} />;
  }
  return {
    id: FATIGUE_MODULE,
    tab: 'Усталостная прочность',
    store: {
      undo: store.undo,
      redo: store.redo,
      exportProject: store.exportProject,
      importProject: store.importProject,
      notify: store.notify,
      projectTitle: store.projectTitle,
    },
    Screen,
    tasks: taskEntries(FATIGUE_PRESETS),
    loadTask: (k) => store.loadPreset(k as FatiguePresetKey),
  };
}
