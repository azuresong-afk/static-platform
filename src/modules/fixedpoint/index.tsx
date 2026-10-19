/** Раздел «Тело с неподвижной точкой» (Мещерский §19, 20, 25): сложение вращений, углы Эйлера, кинематический винт; файл проекта. */
import type { Chrome, StatikaModule } from '../../app/module';
import { FpStore, FIXEDPOINT_MODULE } from './ui/store';
import { FixedView } from './ui/FixedView';
import { taskEntries } from '../../shared/tasks';
import { FP_PRESETS, type FpPresetKey } from './presets';

const EXPLAIN_KEY = 'statika.explain';

export function createFixedPointModule(): StatikaModule {
  let explain = true;
  try {
    const v = localStorage.getItem(EXPLAIN_KEY);
    explain = v == null ? true : v === '1';
  } catch {
    /* по умолчанию */
  }
  const store = new FpStore({ explain });
  store.subscribe(() => {
    try {
      localStorage.setItem(EXPLAIN_KEY, store.get().explain ? '1' : '0');
    } catch {
      /* не запомнится */
    }
  });
  function Screen({ chrome }: { chrome: Chrome }) {
    return <FixedView chrome={chrome} store={store} />;
  }
  return {
    id: FIXEDPOINT_MODULE,
    tab: 'Неподвижная точка',
    store: {
      undo: store.undo,
      redo: store.redo,
      exportProject: store.exportProject,
      importProject: store.importProject,
      notify: store.notify,
      projectTitle: store.projectTitle,
    },
    Screen,
    tasks: taskEntries(FP_PRESETS),
    loadTask: (k) => store.loadPreset(k as FpPresetKey),
  };
}
