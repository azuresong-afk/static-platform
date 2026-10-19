/** Расчёт активного режима вкладки «Пространственное движение». */
import type { SpState } from '../presets';
import { solveCompose, type ComposeOut } from './compose';
import { solveDiff, type DiffOut } from './diff';
import { solveEuler, type EulerOut } from './euler';
import { solveGyro, type GyroOut } from './gyro';
import { solveScrew, type ScrewOut } from './screw';

export interface SpOut {
  compose?: ComposeOut;
  euler?: EulerOut;
  diff?: DiffOut;
  screw?: ScrewOut;
  gyro?: GyroOut;
}
export function solveSpatial(st: SpState): SpOut {
  switch (st.mode) {
    case 'compose':
      return { compose: solveCompose(st.compose) };
    case 'euler':
      return { euler: solveEuler(st.euler) };
    case 'diff':
      return { diff: solveDiff(st.diff) };
    case 'screw':
      return { screw: solveScrew(st.screw) };
    case 'gyro':
      return { gyro: solveGyro(st.gyro) };
  }
}
