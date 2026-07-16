import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { TARGET_PREDS, NODE_CONSTRAINTS, PROP_CONSTRAINTS } from '../src/shapes/model';

describe('SHACL Core support matrix', () => {
  it('documents every supported feature', () => {
    const path = fileURLToPath(new URL('../docs/shacl-core-support-matrix.md', import.meta.url));
    const doc = readFileSync(path, 'utf-8');
    const supported = new Set([...TARGET_PREDS, ...NODE_CONSTRAINTS, ...PROP_CONSTRAINTS]);
    const missing = [...supported].filter(name => !doc.includes(`sh:${name}`));
    expect(missing).toEqual([]);
  });
});
