import { writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { createModules } from '../src/app/registry';
it('list', () => {
  const out: string[] = [];
  for (const m of createModules()) for (const t of m.tasks ?? []) {
    const title = (t as any).title ?? String(t);
    if (/^Мещерский\s+(1\d|2[0-5])\./u.test(title)) out.push(m.id + '\t' + title);
  }
  writeFileSync('/tmp/claude-0/-home-user-static-platform/696b8fcf-ee19-57c3-a2d2-7a0e110e33cc/scratchpad/have.txt', out.join('\n'));
});
