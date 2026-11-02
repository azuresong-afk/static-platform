import { it } from 'vitest';
import { solveKin } from '../src/modules/pointkin/model/kin';
import { trajEquation } from '../src/modules/pointkin/model/traj';
import { KIN_PRESETS } from '../src/modules/pointkin/presets';
it('x', () => {
  const base = KIN_PRESETS.k1011.problem as any;
  const p = { ...base, x: '3sin(t+0,4)', y: '2sin(t+1,3)', t: 1 };
  const r = solveKin(p);
  require('node:fs').writeFileSync('/tmp/claude-0/-home-user-static-platform/696b8fcf-ee19-57c3-a2d2-7a0e110e33cc/scratchpad/out.txt', JSON.stringify([r.ok, r.errors, trajEquation(p, r)?.rels.map((x) => x.text)]));
});
