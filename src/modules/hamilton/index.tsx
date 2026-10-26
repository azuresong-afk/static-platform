/** Раздел «Устойчивость и нелинейные колебания» (Мещерский §49, 55, 56); файл проекта. */
import type { Chrome, StatikaModule } from '../../app/module';
import { taskEntries } from '../../shared/tasks';
import { HAM_PRESETS, type HamPresetKey } from './presets';
import { HAM_EXTRA_PRESETS, type HamExtraKey } from './extraPresets';
import { HamStore, HAM_MODULE } from './ui/store';
import { HamView } from './ui/HamView';

const EXPLAIN_KEY = 'statika.explain';

export function createHamModule(): StatikaModule {
  let explain = true;
  try {
    const v = localStorage.getItem(EXPLAIN_KEY);
    explain = v == null ? true : v === '1';
  } catch {
    /* по умолчанию */
  }
  const store = new HamStore({ explain });
  store.subscribe(() => {
    try {
      localStorage.setItem(EXPLAIN_KEY, store.get().explain ? '1' : '0');
    } catch {
      /* не запомнится */
    }
  });
  function Screen({ chrome }: { chrome: Chrome }) {
    return <HamView chrome={chrome} store={store} />;
  }
  return {
    id: HAM_MODULE,
    tab: 'Устойчивость и нелинейные колебания',
    store: {
      undo: store.undo,
      redo: store.redo,
      exportProject: store.exportProject,
      importProject: store.importProject,
      notify: store.notify,
      projectTitle: store.projectTitle,
    },
    Screen,
    tasks: taskEntries({ ...HAM_PRESETS, ...HAM_EXTRA_PRESETS }),
    loadTask: (k) => store.loadPreset(k as HamPresetKey | HamExtraKey),
  };
}
