/** Раздел «Сходящиеся силы» (Мещерский §1–2, 6–7): равновесие узла и приведение системы сил; файл проекта. */
import type { Chrome, StatikaModule } from '../../app/module';
import { ConvStore, CONV_MODULE } from './ui/store';
import { ConvView } from './ui/ConvView';
import { taskEntries } from '../../shared/tasks';
import { CONV_PRESETS, type ConvPresetKey } from './presets';

const EXPLAIN_KEY = 'statika.explain';

export function createConvModule(): StatikaModule {
  let explain = true;
  try {
    const v = localStorage.getItem(EXPLAIN_KEY);
    explain = v == null ? true : v === '1';
  } catch {
    /* по умолчанию */
  }
  const store = new ConvStore({ explain });
  store.subscribe(() => {
    try {
      localStorage.setItem(EXPLAIN_KEY, store.get().explain ? '1' : '0');
    } catch {
      /* не запомнится */
    }
  });
  function Screen({ chrome }: { chrome: Chrome }) {
    return <ConvView chrome={chrome} store={store} />;
  }
  return {
    id: CONV_MODULE,
    tab: 'Сходящиеся силы',
    store: { undo: store.undo, redo: store.redo, exportProject: store.exportProject, importProject: store.importProject, notify: store.notify, projectTitle: store.projectTitle },
    Screen,
    tasks: taskEntries(CONV_PRESETS),
    loadTask: (k) => store.loadPreset(k as ConvPresetKey),
  };
}
