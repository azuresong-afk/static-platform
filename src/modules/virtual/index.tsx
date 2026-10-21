/**
 * Раздел «Возможные перемещения» (Мещерский §46). Своей схемы у раздела нет — он работает с хранилищем
 * «Балок и рам» (отмена, файлы, название проекта общие), поэтому открывает и их файлы.
 */
import type { Chrome, StatikaModule } from '../../app/module';
import type { Store as FramesStore } from '../frames/ui/store';
import { VirtualView } from './ui/VirtualView';
import { taskEntries } from '../../shared/tasks';
import { VIRTUAL_PRESETS, type VirtualPresetKey } from './presets';
import { useSyncExternalStore } from 'react';
import { MachinePage } from '../../shared/machines/MachineView';
import { MachineStore, modeStore } from '../../shared/machines/store';
import { VIRTUAL_CATALOG, VIRTUAL_MACHINE_PRESETS } from './machines';

const EXPLAIN_KEY = 'statika.explain';

export function createVirtualModule(frames: FramesStore): StatikaModule {
  let explain = true;
  try {
    const v = localStorage.getItem(EXPLAIN_KEY);
    explain = v == null ? true : v === '1';
  } catch {
    /* по умолчанию */
  }
  const ms = new MachineStore(VIRTUAL_CATALOG, { explain });
  ms.subscribe(() => {
    try {
      localStorage.setItem(EXPLAIN_KEY, ms.get().explain ? '1' : '0');
    } catch {
      /* не запомнится */
    }
  });
  const loadFrames = (k: string) => {
    const p = VIRTUAL_PRESETS[k as VirtualPresetKey];
    frames.loadStructure(p.build(frames.ids), p.title);
  };
  function Screen({ chrome }: { chrome: Chrome }) {
    const active = useSyncExternalStore(ms.subscribe, () => ms.get().active);
    return active ? <MachinePage chrome={chrome} ms={ms} base="Конструкция из «Балок и рам»" extra={taskEntries(VIRTUAL_PRESETS)} loadBase={loadFrames} /> : <VirtualView chrome={chrome} frames={frames} ms={ms} />;
  }
  return {
    id: 'virtual',
    tab: 'Возможные перемещения',
    accepts: ['frames'],
    store: modeStore(
      {
        undo: frames.undo,
        redo: frames.redo,
        exportProject: frames.exportProject,
        importProject: frames.importProject,
        notify: frames.notify,
        projectTitle: frames.projectTitle,
      },
      ms,
    ),
    Screen,
    tasks: [...taskEntries(VIRTUAL_PRESETS), ...taskEntries(VIRTUAL_MACHINE_PRESETS)],
    loadTask: (k) => {
      if (k in VIRTUAL_MACHINE_PRESETS) ms.loadPreset(k);
      else {
        ms.setActive(false);
        loadFrames(k);
      }
    },
  };
}
