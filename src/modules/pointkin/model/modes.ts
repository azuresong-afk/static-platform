/** Параметры режимов по умолчанию (поля KinProblem.p), если в задаче их ещё нет. */
import { compDefaults } from './comp';
import type { KinMode } from './kin';

/** Параметры режима по умолчанию (поля p), если в задаче их ещё нет. */
export const MODE_P: Partial<Record<KinMode, Record<string, string>>> = {
  tor: { a: '1' },
  path: { src: 'xyz', n: '6' },
  integ: { src: 'a', f: '', t0: '0', x0: '0', v0: '0' },
  harm: { src: 'law', T: '2', eps: '0', x0: '0', a0: '0', x1: '3', v1: '8', x2: '4', v2: '6' },
  comp: compDefaults('drops'),
  conv: { sys: 'cyl', rb: '', pb: '', zb: '' },
  shot: { v0: '50', al: '30', g: '9,81', h0: '0', xt: '', yt: '' },
  cam: {
    kind: 'rot',
    in: 'law',
    T: '8',
    rpm: '20',
    a1: '0',
    b1: '4',
    f1: '30 + 5t',
    a2: '4',
    b2: '8',
    f2: '30 + 5(8 − t)',
    a3: '',
    b3: '',
    f3: '',
    a4: '',
    b4: '',
    f4: '',
    r: '30',
    u0: '0',
    vc: '5',
    wc: '0',
    find: 'h',
    hg: '4',
  },
};
